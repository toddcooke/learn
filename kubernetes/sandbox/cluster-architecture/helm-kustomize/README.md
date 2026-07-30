# Helm and Kustomize

**CKA domain:** Cluster Architecture, Installation and Configuration

Helm and Kustomize answer the same question — how do you run one application in
several environments without maintaining several copies of its YAML — and they
answer it in opposite ways. Helm treats manifests as a **template** filled in
from a values file, and remembers every install as a numbered **release** it can
roll back. Kustomize treats manifests as **data**: a base of ordinary,
apply-able YAML that overlays patch without editing, with no template language
and no release object anywhere. This lab deploys the same trivial nginx
Deployment both ways, in one namespace, so the difference shows up in the files
rather than in an argument about them. It needs the `helm` CLI on your PATH;
`run.sh` checks for it up front and stops with a clear message if it is missing.

## Run it

```
bash run.sh          # the whole walkthrough, then cleans up
KEEP=1 bash run.sh   # leaves the namespace running so you can poke at it
```

## Walkthrough

### 1. Pin the context — helm does not inherit kubectl's

Every other lab here routes kubectl through a wrapper that supplies
`--context`. Helm is a separate binary with its own kubeconfig handling, so
`run.sh` spells the flag out on every call:

```
helm --kube-context kind-cka-sandbox -n sandbox-helm-kustomize install demo ./chart
```

This is not sandbox pedantry. `helm install` with no `--kube-context` targets
whatever your kubeconfig's current context happens to be, and because Helm
prints a cheerful success message either way, installing a chart into the wrong
cluster is quiet, quick, and entirely undramatic until somebody notices.

### 2. Install the chart

```
helm install demo ./chart
kubectl get deploy demo-hello
```

The chart lives in `chart/` right next to `run.sh` — no repository is added and
nothing is fetched over the network, because a chart is just a directory with a
known layout:

```
chart/
  Chart.yaml              # name, chart version, appVersion
  values.yaml             # the defaults, and the full list of what is tunable
  templates/
    deployment.yaml       # Go template text, NOT valid YAML
```

`Chart.yaml` carries two version fields that are easy to conflate. `version` is
the version of the chart itself and must be semver; `appVersion` is the version
of the software the chart deploys and is free-form. Bumping the app you package
is not the same event as bumping the packaging.

The release is named `demo`, and that name is available inside templates as
`.Release.Name` — which is why the Deployment comes out called `demo-hello`
rather than `hello`. Two releases of one chart can coexist in a namespace
precisely because well-written charts prefix their object names this way.

The Deployment starts with one replica, taken from `replicaCount: 1` in
`values.yaml` with no override in sight.

### 3. Find where the release is stored

```
kubectl get secret -l owner=helm
```

One Secret, of type `helm.sh/release.v1`, sitting in the release's own
namespace. That Secret *is* Helm's database: the rendered manifest, the values
used, the chart, and the status, gzipped and base64-encoded inside it.

This is the single most important structural fact about Helm 3 and later. There
is no Tiller, no cluster-side Helm component, and no state on your laptop. A
colleague with `kubectl` access to this namespace and a `helm` binary sees
exactly the history you see, and — the flip side — anyone who can read Secrets
in the namespace can read every value your chart was installed with, including
the ones you thought of as configuration and the ones you thought of as
passwords.

### 4. Upgrade by overriding a value

```
helm upgrade demo ./chart --set replicaCount=3
helm get values demo
kubectl get deploy demo-hello
```

`--set replicaCount=3` merges on top of `values.yaml` rather than replacing it,
so the image settings keep their defaults and only the replica count moves. The
Deployment scales to three.

Nothing on disk changed. `values.yaml` still says `replicaCount: 1`, and the 3
exists only in the new release record — which is exactly what `helm get values`
reads back, and why that command exists at all. A chart plus a values override
is the deployed state; neither half tells you what is running on its own.

Note that `helm upgrade` resets values to the chart defaults plus whatever you
pass on this invocation. Overrides from the previous revision are *not* carried
forward unless you ask for that with `--reuse-values`. Assuming otherwise is a
reliable way to silently revert last week's tuning.

### 5. Read the history, then roll back

```
helm history demo
helm rollback demo 1
helm history demo
kubectl get deploy demo-hello
```

Before the rollback, `helm history` lists two revisions: 1 from the install and
2 from the upgrade. After it, there are **three**. A rollback is not an undo
that erases revision 2 — it is a new revision whose content is a copy of the
revision you named. The history is append-only, so you can roll back a rollback,
and so the record of what was running when never develops holes.

The Deployment returns to one replica, matching revision 1.

The mechanism is worth being precise about:

```
helm get manifest demo --revision 1     # replicas: 1
helm get manifest demo --revision 2     # replicas: 3
```

Helm archived the fully rendered manifest at each revision, and `rollback`
replays the stored one. It does not re-render the chart. That means a rollback
is unaffected by any chart edit you made in the meantime — a genuinely useful
guarantee during an incident, and a genuinely surprising one the first time you
fix a template, roll back, and find your fix is not in the cluster.

### 6. Uninstall

```
helm uninstall demo
kubectl get deploy demo-hello         # gone
helm history demo                     # Error: release: not found
kubectl get secret -l owner=helm      # no resources found
```

Because Helm recorded exactly which objects it created, it can remove exactly
those and nothing else. The revision Secrets go too: by default `uninstall`
purges the history, and `helm history` on the dead release is an error rather
than an empty table. Pass `--keep-history` if you want the release to survive as
a tombstone you can roll back from.

### 7. Apply the Kustomize base

```
kubectl apply -k base
kubectl get deploy hello
```

`base/deployment.yaml` is a complete, ordinary manifest — no placeholders, no
tool required to read it. `kubectl apply -f base/deployment.yaml` would work on
its own, and so would any linter, schema validator or editor that understands
Kubernetes objects. `base/kustomization.yaml` is nothing but an index naming the
files in the layer:

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - deployment.yaml
```

`-k` points kubectl at a directory containing a `kustomization.yaml` instead of
at a file. Kustomize is built into kubectl, so nothing needs installing.

The base runs one replica and carries only its own `app: hello` label.

### 8. Apply the prod overlay

```
kubectl apply -k overlays/prod
kubectl get deploy
```

Now there are two Deployments: `hello` from the base and `prod-hello` from the
overlay, side by side. `overlays/prod/kustomization.yaml` states only what
differs:

```yaml
resources:
  - ../../base
namePrefix: prod-
labels:
  - pairs:
      tier: production
patches:
  - path: replicas-patch.yaml
```

and `replicas-patch.yaml` is a fragment rather than a whole object:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: hello
spec:
  replicas: 3
```

The `apiVersion`, `kind` and `name` are there so Kustomize can work out which
base resource this fragment belongs to; the one field under `spec` is the
change. Everything the fragment omits is left exactly as the base wrote it —
that is what makes it a *strategic merge* patch rather than a replacement.

Two details in the overlay repay attention. `labels:` is the modern replacement
for the deprecated `commonLabels:`, and with `includeSelectors` left at its
default of `false` the pair lands on object metadata only. It is never written
into `spec.selector.matchLabels` — which matters, because a Deployment's
selector is immutable after creation, and a transformer that rewrote it would
break every subsequent apply. `run.sh` asserts the selector came through
untouched for exactly this reason.

The second detail is what did *not* happen: the base Deployment still runs one
replica and still has no `tier` label. The overlay read the base and never wrote
to it. An overlay is a lens, not a fork.

### 9. See the two rendering models next to each other

Both tools can render locally and print YAML without touching a cluster:

```
helm template demo ./chart --set replicaCount=7
kubectl kustomize overlays/prod
```

The output looks similar. The inputs do not. Feed each tool's source file
straight to kubectl and the difference is unmissable:

```
kubectl apply --dry-run=client -f base/deployment.yaml
# deployment.apps/hello configured (dry run)

kubectl apply --dry-run=client -f chart/templates/deployment.yaml
# error: error parsing chart/templates/deployment.yaml:
#   error converting YAML to JSON: yaml: ... line 17 ...
```

The Kustomize base is a manifest. The Helm template is a program that produces
one, and the YAML parser has no idea what to do with `{{`. Helm renders the
whole file including comments, incidentally, which is why the comment block at
the top of `chart/templates/deployment.yaml` has to talk *around* the doubled
braces instead of quoting them.

## What this proves

Helm templates and tracks releases. Its source files are Go templates that only
become manifests when rendered, so values can flow in from `values.yaml`, `-f`
files and `--set`, and a chart can express variation its author never
anticipated. The price is source that no other Kubernetes tool can read and a
values contract every consumer has to learn. On top of that, Helm keeps a record:
install, upgrade and rollback each append a numbered revision stored as a Secret
of type `helm.sh/release.v1` in the release namespace. Install produced one
revision, `--set replicaCount=3` produced a second, and rolling back to revision
1 produced a *third* — a new revision replaying revision 1's archived manifest,
not a deletion of revision 2. That record is what lets `uninstall` delete
precisely what the release created, and why uninstalling drops the history
unless you pass `--keep-history`.

Kustomize patches and tracks nothing. The base is finished YAML that kubectl
accepts unaided; the overlay adds a name prefix, a label and a two-line replica
patch without editing a byte of it. There is no template language to learn and
no release object in the cluster — `kubectl apply -k` renders the overlay and
applies the result, so what the API server receives is ordinary manifests and
your history is your git history. In this lab the base kept one replica and no
`tier` label while the overlay ran three with `tier=production`, both generated
from a single source of truth.

The trade is not really templating versus patching, it is who owns the
variation. Kustomize suits variation you own and can enumerate — your app, your
three environments, all in your repo — and it stays legible because the base
never stops being a manifest. Helm suits software you ship to people whose
requirements you cannot see, and it is the right answer whenever you want the
cluster itself to remember what was deployed and be able to put it back. The two
are not mutually exclusive: `helm template` emits plain YAML that a Kustomize
base can consume, which is how plenty of teams use a vendor's chart without
adopting Helm's release model.

## See also

- Study guide → Cluster Architecture, Installation and Configuration
- Flashcards: `helm`, `helm-release`, `helm-rollback`, `helm-values`,
  `kustomize`, `kustomize-overlay`, `strategic-merge-patch`
- Related: `cluster-architecture/namespaces` — the scope a release and an
  overlay are both applied into
- Related: `workloads-scheduling/deployment` — the rollout the two tools are
  driving, and the difference between `helm rollback` and
  `kubectl rollout undo`
