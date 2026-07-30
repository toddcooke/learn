# ReplicaSet

**CKA domain:** Workloads & Scheduling

A ReplicaSet does one thing: it watches a label selector and creates or
deletes Pods until the number of matching Pods equals the replica count it
was given. That single behaviour explains both what it is good at — Pods
that come back when they die — and the thing it cannot do, which is change
the Pods it already made. This lab demonstrates both halves, because the
second half is the entire reason Deployments exist.

## Run it

```
bash run.sh          # the whole walkthrough, then cleans up
KEEP=1 bash run.sh   # leaves the namespace running so you can poke at it
```

## Walkthrough

### 1. Create a ReplicaSet asking for 3 replicas

```
kubectl apply -f three-replicas.yaml
kubectl get rs web
kubectl get pods -l app=web -o wide
```

`three-replicas.yaml` declares `replicas: 3`, a selector of `app=web`, and a
Pod template carrying the matching label. Within a few seconds three Pods
exist with generated names like `web-4b2xk`, scheduled independently across
the cluster's nodes.

Two fields in that manifest are easy to conflate. `spec.selector` is how the
controller finds the Pods it considers its own; `spec.template.metadata.labels`
is what it stamps onto the Pods it creates. They are separate fields that
happen to agree here, and the API server insists they agree — a ReplicaSet
whose template labels fell outside its own selector would create a Pod, fail
to find it, and create Pods forever.

### 2. Every Pod points back at its owner

```
kubectl get pod <pod> -o custom-columns=POD:.metadata.name,OWNER_KIND:.metadata.ownerReferences[0].kind,OWNER:.metadata.ownerReferences[0].name,CONTROLLER:.metadata.ownerReferences[0].controller
```

Each Pod's `.metadata.ownerReferences[0]` names the ReplicaSet: `kind:
ReplicaSet`, `name: web`, and `controller: true`. The last flag matters —
an object may have several owners but at most one *controlling* owner, the
one whose reconcile loop is responsible for it.

This reference is not decoration. It is how the ReplicaSet re-finds its Pods
after a controller-manager restart, and it is how cascading deletion works:
delete the ReplicaSet and the garbage collector removes everything whose
`ownerReferences` point at it. Nothing here depends on the shared name
prefix, which is only a convenience for humans.

### 3. Delete a Pod and the ReplicaSet puts it back

```
kubectl delete pod <pod>
kubectl get pods -l app=web
```

Count returns to three. Worth being precise about what happened: the
controller does not restart the Pod you deleted. It observes that a Pod it
owned now has a deletion timestamp, stops counting it as active, and creates
a fresh Pod object — new name, new UID, new IP, possibly on a different
node. Anything that lived only inside the old Pod, such as an `emptyDir`
volume or in-memory state, is gone.

This is also why the replacement often appears while the old Pod is still
terminating: "active" excludes Pods that are on their way out, so the
controller does not wait for the grace period to expire.

### 4. Membership is decided by the selector, not by a list of names

```
kubectl label pod <pod> app=web-orphan --overwrite
kubectl get pod <pod> -o jsonpath='{.metadata.ownerReferences}'
kubectl get pods -l app=web
```

Relabel one Pod so it no longer matches `app=web` and two things happen at
once. The ReplicaSet *releases* it — the controller patches the
`ownerReferences` away, leaving a Pod that belongs to nobody — and, now
seeing only two matching Pods, it creates a third.

Notice that the released Pod is still `Running`. It was disowned, not
killed. That makes relabelling the standard way to pull a misbehaving
replica out of a live set for inspection: the controller immediately
backfills capacity, and you keep the evidence.

### 5. Change the Pod template's image

```
kubectl patch rs web -p '{"spec":{"template":{"spec":{"containers":[{"name":"web","image":"registry.k8s.io/pause:3.10"}]}}}}'
kubectl get rs web -o jsonpath='{.spec.template.spec.containers[0].image}'
kubectl get pods -l app=web -o custom-columns=POD:.metadata.name,IMAGE:.spec.containers[0].image
```

The ReplicaSet's template now names the new image. Every running Pod still
reports `nginx:alpine`, and not one of them restarted. (The new image is
`pause` purely because it is a tiny thing that runs forever; any image
different from the original would make the point.)

Nothing is broken. The template describes how to build the *next* Pod, and
the ReplicaSet's only trigger is a count that does not match. Three Pods
match the selector and three are wanted, so the controller has no reason to
act, and it never revisits Pods it has already created.

### 6. Only Pods created after the change carry it

```
kubectl delete pod <pod>
kubectl get pods -l app=web -o custom-columns=POD:.metadata.name,IMAGE:.spec.containers[0].image
```

Delete a Pod and the replacement is built from the current template, so it
runs the new image while its two siblings still run the old one. The set is
now serving two versions simultaneously, purely as a side effect of which
Pods happened to die, and nothing in the ReplicaSet will ever converge them.

This is the failure that Deployments were designed around. A Deployment does
not edit Pods either. When its template changes it creates a **second**
ReplicaSet for the new template and then scales the new one up and the old
one down within a `maxSurge`/`maxUnavailable` budget, so every Pod is
replaced deliberately rather than by accident. Keeping the old ReplicaSet
around at zero replicas is what makes `kubectl rollout undo` possible: the
previous template is still on the cluster, ready to be scaled back up.

## What this proves

A ReplicaSet is a counter over a label selector, and both words carry
weight. *Selector*: it owns whatever matches, ownership recorded in each
Pod's `ownerReferences`, so relabelling a Pod moves it in or out of the set.
*Counter*: it reacts to how many Pods exist, never to how they are
configured, which is what makes deleted Pods come back and template edits do
nothing.

That second property is a real limitation, not a quirk — a bare ReplicaSet
has no concept of a version, an order, or a rollout, so it cannot update a
running application. Deployments add exactly that missing layer by managing
a chain of ReplicaSets rather than Pods, which is why you almost never
create a ReplicaSet by hand outside of a lab like this one.

## See also

- Study guide → Workloads and Scheduling
- Flashcards: `replicaset`, `deployment`, `deployment-rolling-update`
- Previous: `pod` — what the thing being replicated actually is
- Next: `deployment` — the controller that turns a template change into a rollout
