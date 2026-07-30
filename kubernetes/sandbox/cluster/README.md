# The sandbox cluster

Every lab runs against one shared kind cluster named `cka-sandbox`. This
directory owns its lifecycle and the shell helpers the labs are built from.

```
cluster/up.sh              create it (and install add-ons)
cluster/up.sh --minimal    create it without add-ons
cluster/down.sh            delete it
```

Both scripts are safe to re-run. `up.sh` against an existing cluster
reuses it and re-checks the add-ons rather than rebuilding.

## What you get

Three nodes — one control-plane, two workers — running **Kubernetes
v1.35.0**, plus metrics-server and ingress-nginx.

Two workers is not a luxury. On a single node a DaemonSet is
indistinguishable from a Deployment, `kubectl drain` has nowhere to move
Pods to, pod anti-affinity and topology spread constraints are no-ops, and
a `NoSchedule` taint just makes a Pod unschedulable instead of steering it
somewhere else. Two workers is the smallest cluster where those lessons
actually land.

## Why the node image is pinned

`kind-config.yaml` pins the node image by digest:

```
kindest/node:v1.35.0@sha256:452d707d4862f52530247495d180205e029056831160e22870e37e3f6c1ac31f
```

Kubernetes v1.35 is what the CKA exam tests. Pinning matters for two
separate reasons:

- The `kindest/node:v1.35.0` **tag** has already been re-pushed to a
  different digest, so an unpinned reference no longer resolves to the
  image kind v0.31.0 was built and tested against.
- Leaving it to kind's default is worse. A future kind release defaults to
  Kubernetes v1.36 — a minor version ahead of the exam, and the first
  release where kubeadm config patches must target `v1beta4`.

There is a third, subtler reason: **NetworkPolicy enforcement rides on the
node image.** A v1.30 image accepts NetworkPolicy objects and silently
ignores them, so `kubectl get netpol` lists your policy while traffic
flows straight through. The `networkpolicy` lab preflights for this rather
than teaching you the opposite of the truth.

## Add-ons

**metrics-server** (v0.9.0) powers `kubectl top` and the `hpa` lab. The
stock manifest leaves it stuck at `0/1 Running` on kind forever, because
kind's kubelet serves a self-signed certificate with no IP SANs and the
scrape fails with an x509 error. One flag fixes it: `--kubelet-insecure-tls`.

The commonly-paired `--kubelet-preferred-address-types` is *not* needed —
it is already in the shipped manifest. `up.sh` applies the flag as a
strategic-merge patch listing the full args array rather than appending
one element, because an append is not idempotent: a second `up.sh` would
add the flag twice and force a pointless rollout.

**ingress-nginx** comes from kind's own frozen copy. Upstream
`kubernetes/ingress-nginx` is retired and its repository archived, and
kind's ingress documentation was rewritten to recommend `cloud-provider-kind`
instead. These labs deliberately keep the classic recipe: the newer path
requires `sudo` on macOS, must stay running in a second terminal, and — the
disqualifier — has no cluster selector, so it installs Gateway API CRDs
into *every* kind cluster on your machine.

**NetworkPolicy needs no add-on.** kind's default CNI (kindnet) has
enforced it since kind v0.24.0. The widely repeated advice to install
Calico for this is stale.

## `lib.sh`

Sourced by every lab. It provides the `k()` wrapper — which pins
`--context kind-cka-sandbox` so no lab can ever touch another cluster in
your kubeconfig — plus narration helpers (`step`, `run`, `note`),
assertions (`assert_eq`, `assert_contains`, `assert_eventually`,
`assert_eventually_contains`), preflight checks (`require_cluster`,
`require_addon`), and namespace lifecycle (`ns_setup`, `ns_teardown`).

The assertions are what make the labs a test suite rather than a
slideshow: a lab exits non-zero when Kubernetes doesn't do what its README
says it will.

## Cost and cleanup

The cluster idles at a few hundred MB of Docker memory. `cluster/down.sh`
removes it but leaves the node image cached, so the next `up.sh` takes
well under a minute.

If a lab ever leaves the cluster in a strange state, the recovery is
always the same and always cheap:

```
cluster/down.sh && cluster/up.sh
```

## Troubleshooting

**"cluster is unreachable"** — Docker isn't running, or the cluster was
deleted. Start Docker Desktop and run `cluster/up.sh`.

**A lab fails at `require_addon`** — you created the cluster with
`--minimal`. Re-run `cluster/up.sh` without it.

**`kubectl top` returns "Metrics API not available"** — metrics-server
needs about 30 seconds after install before it has scraped anything.

**Port 80 already in use when creating the cluster** — something on your
machine holds port 80, which the config maps for the ingress lab. Stop it,
or drop the `extraPortMappings` block and reach the ingress controller
through its in-cluster Service instead (which is what the lab does anyway).
