# StatefulSet

**CKA domain:** Workloads & Scheduling

A Deployment treats its replicas as interchangeable: any Pod can serve any
request, and when one dies the ReplicaSet replaces it with a differently named
Pod at a different address holding none of the old one's state. A StatefulSet
inverts every part of that. Each replica gets an ordinal name it keeps forever,
its own PersistentVolumeClaim that follows the name rather than the Pod, and
its own DNS record so peers can address it individually. This lab creates a
StatefulSet of two, deletes one of them, and checks that what comes back is
recognisably the same member of the set.

## Run it

```
bash run.sh          # the whole walkthrough, then cleans up
KEEP=1 bash run.sh   # leaves the namespace running so you can poke at it
```

## Walkthrough

### 1. A headless Service, then the StatefulSet it governs

```
kubectl apply -f web.yaml
kubectl get svc web -o jsonpath='{.spec.clusterIP}'
```

`web.yaml` holds two objects. The first is a Service with `clusterIP: None` —
a *headless* Service. It has no virtual IP and does no load balancing; DNS
answers queries for it with the Pod addresses themselves, and, crucially, it
also publishes one record per Pod. The second is a StatefulSet whose
`spec.serviceName` names that Service.

That pairing is manual and easy to forget. **The StatefulSet controller never
creates the Service for you.** Write the StatefulSet without the headless
Service and you still get ordinal names and per-Pod volumes, but the per-Pod
DNS names this lab depends on simply do not exist.

While the two Pods are coming up, the script polls the Pod list and catches it
half built. It should see exactly one Pod, `web-0`. That is
`podManagementPolicy: OrderedReady`, the default: the controller creates
`web-0`, waits for it to report Ready, and only then creates `web-1`. Setting
the policy to `Parallel` trades that guarantee for a faster start-up.

### 2. Ordinal names and one claim per Pod

```
kubectl get pods -l app=web
kubectl get pvc
```

The Pods are named `web-0` and `web-1` — the StatefulSet's name plus an
ordinal, with none of the `<name>-<replicaset-hash>-<random>` suffixing a
Deployment produces. The names are derived, not random, which is the whole
reason they can be stable.

The `volumeClaimTemplates` block stamps out one PersistentVolumeClaim per Pod,
named `<template>-<pod>`: `data-web-0` and `data-web-1`, each requesting 100Mi
from the cluster's default StorageClass. A Deployment has no equivalent,
because it has no per-replica identity to key a claim on: every replica of a
Deployment shares one volume or has none.

### 3. Per-Pod DNS

```
kubectl exec client -- nslookup web-0.web.sandbox-statefulset.svc.cluster.local
kubectl exec client -- nslookup web.sandbox-statefulset.svc.cluster.local
kubectl exec client -- curl -s http://web-0.web.sandbox-statefulset.svc.cluster.local:8080/hostname
```

The pattern is `<pod>.<serviceName>.<namespace>.svc.cluster.local`. Looking up
the per-Pod name returns that one Pod's address; looking up the Service name
returns the whole set. The HTTP request confirms the mapping end to end — the
server that answers reports its own hostname as `web-0`.

This is the piece that makes clustered software workable. A three-node etcd or
a Postgres primary with two replicas cannot be addressed through a load
balancer that scatters connections, because members have to name each other:
"replicate from `db-0`", "the new member is `db-2`". The headless Service turns
each ordinal into an address you can put in a config file.

### 4. Delete `web-0` and see what comes back

```
kubectl exec web-0 -- sh -c 'echo "written by the first web-0" > /data/id.txt'
kubectl get pvc data-web-0 -o jsonpath='{.spec.volumeName}'
kubectl delete pod web-0
kubectl exec web-0 -- cat /data/id.txt
```

The replacement has a new UID, so it is genuinely a different Pod object — but
it carries the same name, `web-0`, and the controller reattaches it to the
existing `data-web-0` claim. The script compares the claim's `volumeName`
before and after the deletion and asserts they are identical, then reads back
the file the first `web-0` wrote. The identity survived; only the process
restarted.

The replacement also lands on the same node. That is not the StatefulSet's
doing: this cluster's default StorageClass provisions node-local volumes, so
each PersistentVolume carries a hard `nodeAffinity` to the node that created
it, and the scheduler has nowhere else to put a Pod that needs it.

One thing does change — the Pod IP. Verify that by checking DNS again after
the deletion: the name still resolves, now to the new address. Stable name,
unstable address, which is precisely why StatefulSet peers refer to each other
by DNS name and never by IP.

### 5. Scaling down, and back up

```
kubectl scale statefulset web --replicas=1
kubectl get pods -l app=web
kubectl get pvc
kubectl scale statefulset web --replicas=2
```

Scale-down runs in reverse ordinal order, so `web-1` goes first and `web-0` is
the survivor. Its claim, `data-web-1`, stays behind and stays `Bound` with no
Pod using it, because `persistentVolumeClaimRetentionPolicy` defaults to
`Retain` for both `whenScaled` and `whenDeleted`. Kubernetes will not silently
discard a database's disk to save you a scale operation. Scale back to two and
the returning `web-1` reattaches to that same volume.

The flip side is that those claims are yours to clean up. Deleting a
StatefulSet leaves its PVCs behind unless you set the retention policy to
`Delete` or remove them by hand — a common source of storage that nobody
remembers provisioning.

## What this proves

A StatefulSet does not manage replicas; it manages *slots*. `web-0` is a slot,
and the controller keeps refilling it with a Pod that has the same name, the
same PersistentVolumeClaim, and therefore the same bytes on disk. The headless
Service turns each slot into a DNS name so peers can address one another
individually, and the ordering guarantees exist so that software which cares
which member is joining or leaving can actually tell.

All of that is overhead when replicas really are interchangeable. Use a
Deployment by default; reach for a StatefulSet only when an application needs
durable per-instance identity or per-instance storage.

## See also

- Study guide → Workloads and Scheduling
- Flashcards: `statefulset`, `persistent-volume-claim`, `coredns`
- Related: `deployment` — what to use when replicas *are* interchangeable
- Related: `storage/pv-pvc` — what `volumeClaimTemplates` is doing underneath
