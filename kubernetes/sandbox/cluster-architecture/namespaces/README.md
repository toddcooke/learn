# Namespaces

**CKA domain:** Cluster Architecture, Installation and Configuration

A Namespace is a scope for object names and a boundary for policy. Neither
half is obvious from the outside: it is easy to assume namespaces isolate
workloads (they do not — Pods in different namespaces reach each other
freely), and just as easy to assume everything in Kubernetes lives in one
(Nodes, PersistentVolumes, StorageClasses and ClusterRoles do not). This lab
runs the same Deployment manifest into two namespaces at once, asks the API
server which kinds have no namespace at all, and then deletes one of the two
namespaces to watch its contents go with it.

## Run it

```
bash run.sh          # the whole walkthrough, then cleans up
KEEP=1 bash run.sh   # leaves the namespace running so you can poke at it
```

This lab creates a second namespace, `sandbox-namespaces-b`, alongside the
usual `sandbox-namespaces`. Deleting it is part of the walkthrough, and
`run.sh` carries its own cleanup trap so that it is removed even if the run
fails partway through.

## Walkthrough

### 1. Two namespaces

```
kubectl create ns sandbox-namespaces-b
kubectl get ns sandbox-namespaces sandbox-namespaces-b
```

A Namespace is an object like any other, with a `.status.phase` that is
`Active` until somebody deletes it. Note that it is created with no `-n`
flag, because a Namespace is not itself in a namespace — a point the lab
returns to in step 4.

### 2. The same Deployment name in both namespaces

```
kubectl apply -f web.yaml            # into sandbox-namespaces
kubectl apply -f web.yaml            # into sandbox-namespaces-b
kubectl get deploy --all-namespaces -l app=web
```

`web.yaml` deliberately omits `metadata.namespace`, so the same file can be
applied anywhere and the `-n` flag decides where the object lands. Both
namespaces now hold a Deployment called `web`, and `--all-namespaces` (or its
short form `-A`) prints a NAMESPACE column to tell them apart.

They are not two views of one object. Comparing `.metadata.uid` shows two
distinct records, which is the concrete form of the rule that an object's
identity is the triple (namespace, kind, name) rather than the name alone:

```
kubectl get deploy web -o jsonpath='{.metadata.uid}'
```

Scaling drives the point home. Taking `sandbox-namespaces-b/web` to two
replicas leaves `sandbox-namespaces/web` sitting at one, because the two
Deployments have separate controllers managing separate ReplicaSets and
separate Pods.

This is what makes a namespace a usable unit of tenancy: every team gets to
call its front end `web` without negotiating names with anyone else.

### 3. A manifest may name its own namespace instead

```
kubectl apply -f pinned.yaml
```

`pinned.yaml` sets `metadata.namespace: sandbox-namespaces-b`, so it lands
there with no `-n` on the command line and regardless of the namespace your
current context is set to. The namespace in the file always wins over the
one in your context.

What it does not do is lose an argument with an explicit flag:

```
kubectl apply -n sandbox-namespaces -f pinned.yaml
error: the namespace from the provided object "sandbox-namespaces-b" does not
match the namespace "sandbox-namespaces". You must pass
'--namespace=sandbox-namespaces-b' to perform this operation.
```

kubectl refuses rather than quietly relocating the object. That refusal is
the reason reusable manifests leave `metadata.namespace` out: a file that
pins it can only ever be applied to one place.

### 4. What is not in a namespace at all

```
kubectl api-resources --namespaced=false
kubectl api-resources --namespaced=true
```

This is the authoritative answer, produced by the API server's own discovery
data rather than by memory. The `--namespaced=false` side holds `nodes`,
`persistentvolumes`, `storageclasses.storage.k8s.io`,
`clusterroles.rbac.authorization.k8s.io`, `ingressclasses.networking.k8s.io`,
`priorityclasses.scheduling.k8s.io` and `namespaces` itself. The
`--namespaced=true` side holds `deployments.apps`, `resourcequotas`,
`rolebindings.rbac.authorization.k8s.io` and `persistentvolumeclaims`.

That last pair is worth pausing on: the PersistentVolumeClaim is namespaced
and the PersistentVolume it binds to is not. A claim belongs to a team; the
volume behind it belongs to the cluster.

For a cluster-scoped kind, `-n` is neither an error nor a filter — it is
ignored outright:

```
kubectl get nodes -n sandbox-namespaces   # same three nodes as without it
```

Learning to read that list saves you from three recurring mistakes: expecting
a namespace delete to clean up a PersistentVolume or a ClusterRole, expecting
a RoleBinding to grant access to Nodes, and expecting two teams to be able to
pick the same StorageClass name.

### 5. The namespace is the boundary a ResourceQuota applies to

```
kubectl apply -f quota.yaml
kubectl describe ns sandbox-namespaces
```

`quota.yaml` is a ResourceQuota allowing a single Pod. The `web` Pod already
in the namespace spends the entire budget, so the next Pod is rejected at
admission time — not by the scheduler later, but by the API server on
creation:

```
kubectl apply -f probe.yaml
Error from server (Forbidden): ... pods "probe" is forbidden: exceeded quota:
pod-budget, requested: pods=1, used: pods=1, limited: pods=1
```

The identical Pod applied to `sandbox-namespaces-b` starts without comment,
because the quota object lives in the first namespace and constrains only
that namespace. Quota accounting is per namespace, always.

One operational detail: the quota's `.status.used` is filled in by the quota
controller, and admission compares against that status. A quota created a
moment ago has not counted anything yet, which is why `run.sh` waits for
`.status.used.pods` to reach `1` before expecting a rejection.

### 6. ...and the boundary an RBAC RoleBinding applies to

```
kubectl apply -f rbac.yaml
kubectl auth can-i list pods --as=namespace-lab-reader -n sandbox-namespaces
kubectl auth can-i list pods --as=namespace-lab-reader -n sandbox-namespaces-b
kubectl auth can-i list nodes --as=namespace-lab-reader
```

`rbac.yaml` creates a Role granting `get/list/watch` on Pods and a
RoleBinding tying it to the user `namespace-lab-reader`. The three answers
are `yes`, `no`, `no`. The same user, asking for the same verb on the same
kind, is allowed in one namespace and denied in the next, because a Role and
a RoleBinding are both namespaced objects and the permission is scoped with
them.

The third answer is the one people trip over. No RoleBinding can grant access
to Nodes at all, whatever namespace you create it in, because Nodes are on
the `--namespaced=false` list. That takes a ClusterRole bound by a
ClusterRoleBinding — neither of which lives in a namespace either.

`kubectl auth can-i` with `--as=` is the fastest way to check RBAC without
logging in as anybody, and it is worth having in your fingers for the exam.

### 7. Deleting a namespace deletes everything in it

```
kubectl get ns sandbox-namespaces-b -o jsonpath='{.spec.finalizers[0]}'   # kubernetes
kubectl delete ns sandbox-namespaces-b
```

Every Namespace carries the `kubernetes` finalizer, so the delete does not
drop the object immediately. The API server records a deletion timestamp, the
namespace goes to phase `Terminating`, and the namespace controller walks
every namespaced kind removing what it finds. Only when that sweep finishes
does the finalizer come off and the Namespace object disappear.

Afterwards the Deployment, its Pods and the `pinned` ConfigMap are all gone,
though no command ever named them:

```
kubectl get deploy web -n sandbox-namespaces-b
Error from server (NotFound): deployments.apps "web" not found
```

Meanwhile the identically named Deployment in `sandbox-namespaces` is still
running, and all three nodes are still there. Cluster-scoped objects are
outside the blast radius entirely — which is exactly why a leftover
PersistentVolume or ClusterRole survives the cleanup people assume covers
everything.

A namespace stuck in `Terminating` forever is the classic version of this
step going wrong. It nearly always means a finalizer on some object inside it
is not being cleared, or an aggregated API server backing one of the kinds
the controller is trying to enumerate is unreachable, so the sweep cannot
complete.

## What this proves

Namespaces do two jobs. They scope names, so that identity is (namespace,
kind, name) and two teams can both own a `web`; and they scope policy, so
that a ResourceQuota and an RBAC RoleBinding apply to exactly one of them.
Because the policy objects are themselves namespaced, the limit and the thing
being limited are always deleted together.

What namespaces do not do is contain the whole API. Nodes, PersistentVolumes,
StorageClasses, ClusterRoles, IngressClasses and Namespaces themselves are
cluster-scoped: `-n` is ignored when you query them, RoleBindings cannot
grant access to them, and deleting a namespace never removes them.

And a namespace delete is the bluntest cleanup Kubernetes offers — a single
command that removes every namespaced object inside, recursively, without
naming any of them. Convenient for a lab, and worth real caution anywhere
else.

## See also

- Study guide → Cluster Architecture, Installation and Configuration
- Flashcards: `namespace`, `api-resources`, `resourcequota`,
  `role-vs-clusterrole`, `namespace-terminating`
- Related: `workloads-scheduling/priorityclass` — a cluster-scoped object
  that a namespace delete will not clean up for you
