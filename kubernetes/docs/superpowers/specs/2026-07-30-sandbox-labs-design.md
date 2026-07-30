# Kubernetes Sandbox Labs

Status: Draft
Date: 2026-07-30

## Purpose

The CKA exam is entirely hands-on, but this module is entirely read-only —
a study guide, quizzes, flashcards, and a mock exam. Nothing here lets you
watch a ReplicaSet actually replace a deleted Pod.

Add a `kubernetes/sandbox/` directory of runnable labs, one folder per
Kubernetes concept, each teaching that concept by doing it against a real
local cluster. The unit of use is lookup, not curriculum: you go to
`workloads-scheduling/replicaset/` because you want to see how a ReplicaSet
behaves, run it, and watch what happens.

## Scope

- Filesystem only. No changes to `index.html`, any file under `js/`, or
  `css/` — the sandbox is not a site view. This keeps `check-drift.mjs`
  and the repo's no-build-step rule untouched, and it keeps the labs
  usable from a terminal where the site isn't running.
- The module README gains one section linking to `sandbox/README.md`.
  That is the only edit to an existing file.
- Bash and YAML only, matching the repo's zero-dependency constraint. No
  npm packages, no Makefile, no task runner.
- Targets a local `kind` cluster the labs create themselves. The labs do
  not run against a shared or production cluster and say so.

## Cluster

A single 3-node kind cluster, `cka-sandbox`, shared by every lab:
1 control-plane + 2 workers.

Multi-node is load-bearing, not luxury. On one node a DaemonSet is
indistinguishable from a Deployment, `kubectl drain` has nowhere to move
Pods to, pod anti-affinity and topology spread constraints are no-ops, and
a `NoSchedule` taint just makes a Pod unschedulable rather than steering
it. Two workers is the smallest cluster where those lessons land.

### `cluster/` contents

| File | Role |
| --- | --- |
| `kind-config.yaml` | 3-node topology, ingress-ready control-plane (node label + 80/443 `extraPortMappings`), pinned node image |
| `up.sh` | Create the cluster, install add-ons, print a readiness summary |
| `down.sh` | `kind delete cluster --name cka-sandbox` |
| `lib.sh` | Shared shell helpers sourced by every lab's `run.sh` |
| `README.md` | Cluster lifecycle, add-ons, cost, troubleshooting |

`up.sh` is idempotent: re-running it against an existing cluster reports
that fact and re-checks add-ons rather than failing or recreating.

### Add-ons

`up.sh` installs the two add-ons some labs depend on, because a lab that
opens with "first install metrics-server" is a lab you don't run:

- **metrics-server** — required by the `hpa` lab and `kubectl top`
  elsewhere. Pinned to v0.9.0, plus one kind-specific flag.
- **ingress-nginx** — required by the `ingress` lab.

NetworkPolicy needs **no add-on**: kind's default CNI enforces it (see
below), so `disableDefaultCNI` stays false and no Calico is installed.

Add-on install is the slow part of `up.sh` (roughly a minute after the
node image is cached). A `--minimal` flag skips it, and the labs that
need an add-on check for it up front and print the exact fix command.

## Per-lab contract

Every lab folder holds exactly three kinds of file:

**`README.md`** — the teaching artifact, readable on its own without
running anything. Structure: what the concept is and why it exists, the
walkthrough as numbered steps pairing a command with the output to expect
and what that output means, then a short "what this proves" close. Written
in the same explanatory register as the study guide, not as terse comments.

**`*.yaml`** — the manifests the walkthrough applies, kept as separate
readable files rather than heredocs inside the script, so they can be read,
edited, and re-applied by hand.

**`run.sh`** — executes the whole walkthrough unattended, echoing each
command before running it so the terminal transcript reads like the README.

### Shell conventions (`lib.sh`)

| Helper | Behavior |
| --- | --- |
| `require_cluster` | Fails fast with "run `cluster/up.sh` first" if the `kind-cka-sandbox` context is missing or unreachable |
| `require_addon <name>` | Same, per add-on, naming the exact fix command |
| `step "<text>"` | Prints a numbered section header |
| `run <cmd...>` | Echoes the command, runs it, streams its output |
| `note "<text>"` | Prints an indented explanation of what just happened |
| `ns_setup` / `ns_teardown` | Creates and deletes the lab's namespace |

Every `run.sh`:

- works only inside its own `sandbox-<lab>` namespace, so labs never
  collide and a failed lab leaves no debris elsewhere;
- sets `set -euo pipefail` and traps errors to run its teardown;
- deletes its namespace on exit unless `KEEP=1` is set, which leaves
  everything running and prints the `kubectl -n sandbox-<lab>` prefix to
  continue poking at it by hand;
- waits on conditions (`kubectl wait`, `kubectl rollout status`) rather
  than sleeping, so it is neither flaky nor needlessly slow;
- is safe to re-run: it deletes any leftover namespace of its own name
  before starting.

Labs that deliberately break something (see below) restore it before
exiting, and their teardown runs on failure too.

## Lab inventory

Bucketed by the same five CKA domains the study guide, quizzes, and
flashcard deck already use, so a concept's card, guide section, and lab
all live under one heading.

### `workloads-scheduling/` (12)

| Lab | Demonstrates |
| --- | --- |
| `pod` | Two containers in one Pod reaching each other over `localhost` and sharing a volume; one IP for the Pod |
| `replicaset` | Deleting a Pod and watching the replacement appear; `ownerReferences`; editing the RS template does *not* touch existing Pods |
| `deployment` | Rolling update with `maxSurge`/`maxUnavailable` observable in `kubectl get pods -w`; `rollout status`/`history`/`undo`/`pause`/`resume`/`restart` |
| `daemonset` | One Pod per node across three nodes; a new Pod appearing when a node is uncordoned; the controller's automatic tolerations |
| `statefulset` | Ordered creation, stable `-0`/`-1` names, per-Pod PVC surviving deletion, headless-Service DNS per Pod |
| `job-cronjob` | `completions`/`parallelism`, `Indexed` completion mode, a failing Job exhausting `backoffLimit`, `activeDeadlineSeconds` winning over it, and a CronJob's `concurrencyPolicy` |
| `configmap-secret` | The three `--from-*` creation flags; `envFrom` frozen at container start vs a volume mount that updates live; `immutable: true` rejecting an edit |
| `init-sidecar` | Init containers running in order and blocking the app container; a native sidecar (`restartPolicy: Always`) staying up alongside it |
| `probes` | A failing liveness probe restarting the container; a failing readiness probe removing the Pod from EndpointSlices without restarting it; a startup probe holding both off |
| `resources-qos` | Guaranteed/Burstable/BestEffort classification from the same manifests; CPU throttling vs an OOMKill with exit code 137 |
| `scheduling` | Taints repelling Pods and tolerations admitting them; `nodeSelector` vs `nodeAffinity`; pod anti-affinity spreading replicas; `topologySpreadConstraints`; PriorityClass preemption evicting a lower-priority Pod |
| `hpa` | metrics-server feeding `kubectl top`; load driving a scale-up; the `ceil(current × ratio)` formula matching observed replica counts |

### `services-networking/` (5)

| Lab | Demonstrates |
| --- | --- |
| `service-clusterip` | Load balancing across backends from a client Pod; a headless Service returning Pod IPs from DNS instead of one virtual IP |
| `service-nodeport-loadbalancer` | Reaching a NodePort on every node; a LoadBalancer Service sitting at `<pending>` forever with no cloud provider — the failure *is* the lesson |
| `ingress` | Host- and path-based routing to two backends through one Ingress; IngressClass selecting the controller |
| `networkpolicy` | Traffic flowing freely before any policy; a default-deny policy cutting it off; default-deny egress silently breaking DNS until a port-53 rule is added; `podSelector`+`namespaceSelector` ANDed in one rule vs ORed as two |
| `dns-endpointslices` | `<svc>.<ns>.svc.cluster.local` resolution and `/etc/resolv.conf` search paths; EndpointSlice contents including an unready endpoint carrying `ready: false` |

### `storage/` (3)

| Lab | Demonstrates |
| --- | --- |
| `volumes` | `emptyDir` shared between two containers and wiped with the Pod; `medium: Memory`; a `hostPath` mount pinned to one node |
| `pv-pvc` | Static provisioning and one-to-one binding; a PVC that stays Pending when no PV matches; `Retain` leaving the PV `Released` vs `Delete` removing it |
| `storageclass` | Dynamic provisioning through the default StorageClass; `WaitForFirstConsumer` holding the PVC Pending until a Pod is scheduled |

### `cluster-architecture/` (7)

| Lab | Demonstrates |
| --- | --- |
| `namespaces` | Namespaced vs cluster-scoped objects via `kubectl api-resources --namespaced=false`; the same name coexisting in two namespaces |
| `rbac` | A Role granting one verb; `kubectl auth can-i` before and after; `--as` impersonation; a RoleBinding to a ClusterRole staying namespace-confined; an immutable `roleRef` rejecting an edit |
| `serviceaccounts` | A Pod's projected token; calling the API from inside the Pod with it and getting 403; `kubectl create token`; a dedicated SA plus RoleBinding fixing the 403 |
| `quotas-limitranges` | A ResourceQuota admitting the Deployment while rejecting its Pods, with the errors surfacing on the ReplicaSet; a LimitRange injecting defaults that make the same Pod admissible |
| `static-pods` | Dropping a manifest into `/etc/kubernetes/manifests` on a node and watching the mirror Pod appear; deleting the mirror via kubectl and watching it return; the control plane's own static Pods |
| `etcd-backup` | `etcdctl snapshot save` from inside the etcd Pod with the right cert paths; `etcdutl snapshot status` verifying it |
| `helm-kustomize` | `helm install`/`upgrade`/`rollback` across revisions with `helm history`; the same app as a Kustomize base plus overlay via `kubectl apply -k` |

### `troubleshooting/` (6)

| Lab | Demonstrates |
| --- | --- |
| `pod-failure-states` | Four Pods each broken a different way — unschedulable (Pending/FailedScheduling), bad image (ImagePullBackOff), crashing command (CrashLoopBackOff), memory hog (OOMKilled/137) — diagnosed with `describe` and `logs --previous` |
| `node-maintenance` | `cordon` stopping new placement; `drain` needing `--ignore-daemonsets`; a PodDisruptionBudget blocking the drain until replicas allow it; `uncordon` restoring the node |
| `logs` | `-c`, `--previous`, `-l`, `--since`, `--tail`; where the files live on the node; why the control-plane components aren't in `journalctl` |
| `kubectl-debug` | `kubectl debug` into a distroless Pod with no shell; `--target` joining a process namespace; `kubectl debug node/` with the host filesystem at `/host` |
| `service-debugging` | A Service with a typo'd selector producing an empty EndpointSlice, walked through the documented order until the selector is fixed |
| `control-plane-debugging` | Corrupting the API server's static-Pod manifest so `kubectl` dies, diagnosing it over `docker exec` + `crictl`, then restoring it — the one lab that requires the cluster to be disposable |

Total: 33 labs.

## Verified cluster mechanics

Details that decide whether a lab teaches anything are verified against
current documentation before implementation rather than assumed, because
each has silently changed across releases:

- whether kind's default CNI enforces NetworkPolicy, and the exact
  fallback if not;
- the current ingress-nginx manifest and readiness wait for kind;
- the metrics-server install plus the kind-specific kubelet TLS patch;
- `docker exec` access to control-plane internals, `crictl` availability,
  and the etcd cert paths on a kind node;
- the default StorageClass and its `volumeBindingMode`;
- the current kind release and the `kindest/node` tag matching the
  Kubernetes version the CKA tests.

Findings below were verified on 2026-07-30 by running the commands against
real kind clusters, not by reading documentation alone.

### Node image: pin `v1.35.0`

The CKA exam tests **Kubernetes v1.35** (Linux Foundation exam page; the
CNCF curriculum repo carries `CKA_Curriculum_v1.35.pdf`). The installed
kind is **v0.31.0**, whose default node image is `v1.35.0` — already the
right minor version. `kind-config.yaml` pins it by digest anyway:

```
kindest/node:v1.35.0@sha256:452d707d4862f52530247495d180205e029056831160e22870e37e3f6c1ac31f
```

Pinning is not ceremony here. The `kindest/node:v1.35.0` tag has since
been re-pushed to a different digest, so an unpinned reference no longer
resolves to the image kind v0.31.0 was tested against. Two consequences
worth encoding: do **not** adopt kind v0.32.0's newer `v1.35.5` image
without also upgrading kind (v0.32.0 upgraded containerd, and mixing its
images with kind v0.31.0 breaks `kind load`), and do not fall back to
kind's *unpinned* default on a future kind release, which would jump to
Kubernetes v1.36 — one minor ahead of the exam, and the first release
where kubeadm config patches must target `v1beta4` instead of `v1beta3`.

### NetworkPolicy: enforced by the default CNI — no Calico

kind's default CNI (kindnetd, `v20251212-v0.29.0-alpha-105-g20ccfc88`)
**does** enforce NetworkPolicy. Verified with a three-state probe:

| State | Result |
| --- | --- |
| No policy | reachable |
| `podSelector: {}` default-deny ingress | blocked |
| Plus an `allow-client` ingress rule | reachable |

So `up.sh` installs no CNI, `disableDefaultCNI` stays false, and the
`networkpolicy` lab runs on a stock cluster. This removes what would have
been the setup's most fragile dependency. Support arrived in kind v0.24.0
(2024-08-15) via `kube-network-policies`; the widespread "kindnet can't do
NetworkPolicy, install Calico" advice predates it.

Three enforcement quirks the lab must handle, all verified:

- **Enforcement rides on the node image, not the kind binary.** A
  `v1.30.0` node image accepts policy objects and ignores them silently —
  `kubectl get netpol` lists them while traffic flows. v1.31.0 is the
  floor; the pinned v1.35.0 is well clear of it. A second reason to pin.
- **It fails open.** If the kindnet DaemonSet isn't healthy, every policy
  silently stops applying with no error, event, or status change. The lab
  preflights `kubectl -n kube-system get ds kindnet` and refuses to run a
  demo that would otherwise "prove" the wrong thing.
- **Node-root traffic bypasses policy** (the nft chain accepts
  `meta skuid 0`), and **established connections survive** a new policy.
  So the lab always probes with `kubectl exec` from a Pod, never
  `docker exec <node> curl`, and always opens a fresh connection after
  applying a policy. Both are stated in the README, since either one
  makes a learner conclude enforcement is broken.

AdminNetworkPolicy is out of reach — no ANP/BANP CRDs on stock kind — so
the lab stays on `networking.k8s.io/v1`.

### Storage: dynamic provisioning works, and binding is lazy

The default StorageClass is `standard` (`rancher.io/local-path`),
`Delete` reclaim policy, **`volumeBindingMode: WaitForFirstConsumer`**.
The `storageclass` lab therefore demonstrates lazy binding with no setup:
a lone PVC genuinely sits `Pending`, emitting a `WaitForFirstConsumer`
event, until a consuming Pod is scheduled — then binds in about two
seconds. That event is the artifact the lab points at.

**Provisioned PVs are node-pinned**, with hard `nodeAffinity` to the node
that created them. Draining that node strands the Pod `Pending` forever:
`node(s) didn't match PersistentVolume's node affinity`. This is a trap
for a naive "drain safely relocates your workload" story, so the
`node-maintenance` lab uses a stateless Deployment for the drain itself
and then demonstrates the stateful case deliberately, as the reason
node-local storage isn't highly available.

### LoadBalancer: `<pending>` is the lesson, and nothing is installed

With no cloud provider, a LoadBalancer Service never gets an external
address — which is exactly what the flashcard deck claims, so the lab
lets it hang and reads `kubectl describe` rather than fixing it.

`cloud-provider-kind` would supply real LoadBalancer IPs, and this pass
deliberately does not use it: it needs `sudo` on macOS, must keep running
in a second terminal, and — decisively — has no cluster selector, so it
mutates *every* kind cluster on the machine, installing Gateway API CRDs
that cannot be opted out of. A lab that silently rewrites the user's
other clusters is not a sandbox.

### Control-plane internals: fully reachable

`docker exec -it <cluster>-control-plane bash` works (Debian 12). Node
names are `<cluster>-control-plane`, `<cluster>-worker`,
`<cluster>-worker2`. `/etc/kubernetes/manifests/` holds all four static
Pod manifests, and moving one out and back round-trips correctly — the
`static-pods` and `control-plane-debugging` labs are viable as designed.
`crictl` is at `/usr/local/bin/crictl` with `/etc/crictl.yaml`
pre-populated, so `crictl ps` needs no `--runtime-endpoint` flag.

### etcd: three traps the labs must teach around

The etcd static Pod ships `etcdctl` and `etcdutl` 3.6.6, but:

1. **The image is distroless — no shell.** The form nearly every CKA
   guide uses, `kubectl exec ... -- sh -c "ETCDCTL_API=3 etcdctl ..."`,
   fails with `exec: "sh": executable file not found`. The lab execs the
   binary directly and drops `ETCDCTL_API=3` (default since etcd 3.5).
2. **etcd 3.6 removed `etcdctl snapshot status` and `snapshot restore`.**
   Both must be `etcdutl`. This matches what the flashcard deck already
   teaches; an older node image would silently behave differently, which
   is a second reason to pin.
3. **Save to `/var/lib/etcd/`, never `/tmp`.** A `/tmp` write prints
   "Snapshot saved" but lands in the container's writable layer where
   neither `docker cp` nor `kubectl cp` can retrieve it (`kubectl cp`
   fails regardless — no `tar` in the image). `/var/lib/etcd` is a
   hostPath, so `docker cp <node>:/var/lib/etcd/snapshot.db .` works.

The working invocation, verified end to end:

```
kubectl -n kube-system exec etcd-<node> -- etcdctl \
  --endpoints=https://127.0.0.1:2379 \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/server.crt \
  --key=/etc/kubernetes/pki/etcd/server.key \
  snapshot save /var/lib/etcd/snapshot.db
```

### Ingress: kind's frozen ingress-nginx, and why not the new default

kind's ingress documentation was rewritten on 2025-11-25, two weeks after
ingress-nginx was retired upstream. It no longer contains the
`ingress-ready` node label, the `extraPortMappings`, or any controller
manifest URL; it now points at `cloud-provider-kind`'s native Ingress.

The labs keep the classic recipe anyway, for the reasons above: the new
default needs `sudo`, a second long-running terminal, and mutates every
cluster on the machine. The old recipe was re-verified working end to end
on this machine, using kind's own frozen controller copy (v1.12.1):

```
kubectl apply -f https://kind.sigs.k8s.io/examples/ingress/deploy-ingress-nginx.yaml
```

That URL is kind's, not the archived `kubernetes/ingress-nginx` repo's,
so it stays reachable. The control-plane node carries
`node-labels: "ingress-ready=true"` via a `kubeadmConfigPatches` entry
plus `extraPortMappings` for 80/443, and `up.sh` waits on the controller
with `kubectl wait --for=condition=ready pod -l app.kubernetes.io/component=controller`.

The lab's README states plainly that ingress-nginx is retired upstream
and that Gateway API is the successor — a fact the flashcard deck already
teaches, and a genuinely exam-relevant piece of context rather than an
apology for the tooling.

### metrics-server: one flag, and one piece of stale advice to skip

Pinned to **v0.9.0**. The stock manifest leaves the Pod at `0/1 Running`
forever on kind, because kind's kubelet serves a self-signed certificate
with no IP SANs; the scrape fails with `x509: cannot validate certificate
... doesn't contain any IP SANs` and `kubectl top` reports
`Metrics API not available`.

Only **`--kubelet-insecure-tls`** is required. The commonly-paired
`--kubelet-preferred-address-types=InternalIP,...` is already in the
shipped manifest and adding it is a no-op — `up.sh` does not.

The patch is applied as a strategic merge listing the full `args` array
rather than a JSON `add` op, because the latter is not idempotent: a
second `up.sh` run appends the flag twice and forces a needless rollout.
Cold start to a working `kubectl top nodes` is roughly 30 seconds.

### Context safety

`kind create cluster` silently switches the current kubectl context, and
concurrent clusters caused real cross-cluster confusion during this
research. Every `run.sh` therefore passes `--context kind-cka-sandbox`
explicitly rather than trusting the ambient context, and `lib.sh` wraps
`kubectl` so no lab can forget. This also protects the pre-existing
`minikube` context in the kubeconfig, which no lab should ever touch.

### Lab isolation is load-bearing, not tidiness

Two verified cross-lab hazards justify the per-namespace teardown:

- A bare Pod left behind by an earlier lab makes a later `kubectl drain`
  fail with `cannot delete Pods that declare no controller`, which reads
  as a broken drain lab rather than as leftover state.
- A bound local-path PVC pins its node and distorts later scheduling
  demos.

Each `run.sh` deleting its own namespace on exit is what keeps the labs
order-independent, which is the entire premise of the design.

## Verification

Implementation is not complete until the cluster is created and all 33
`run.sh` scripts have been executed end-to-end, each exiting zero and
producing the behavior its README claims. Any lab whose observed output
contradicts its README is fixed, not documented around. The verification
run's results are reported per lab.

## Out of scope

- No site view, no changes under `js/`, `css/`, or `index.html`.
- No CI integration: the labs need Docker and a real cluster, which the
  GitHub Actions verify job neither has nor should grow.
- No cloud clusters, no `kubeadm` install or upgrade lab — kind's nodes
  are prebuilt, so an upgrade lab would teach kind's mechanics rather
  than kubeadm's.
- No Gateway API, CRD-authoring, or operator-building lab in this pass;
  they are legitimate topics but need more scaffolding than a single
  folder, and the flashcard deck already covers them conceptually.
