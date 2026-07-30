# PersistentVolume and PersistentVolumeClaim

**CKA domain:** Storage

Most storage in a modern cluster arrives dynamically: a claim names a
StorageClass, a provisioner hears about it, and a volume appears. Static
provisioning is the older, plainer arrangement underneath that, and it is the
one that makes the objects legible. An administrator publishes a
PersistentVolume describing storage that already exists; a user publishes a
PersistentVolumeClaim describing storage they want; a controller matches them
and binds the two together, one to one. This lab does exactly that by hand, and
then takes it apart again to watch what `persistentVolumeReclaimPolicy: Retain`
protects and what it conspicuously does not.

## Run it

```
bash run.sh          # the whole walkthrough, then cleans up
KEEP=1 bash run.sh   # leaves the namespace running so you can poke at it
```

## Walkthrough

### 1. The administrator publishes a volume

```
kubectl apply -f pv.yaml
kubectl get pv sandbox-pv-pvc-static
```

Note the missing `-n`. A PersistentVolume is a cluster-scoped object: it does
not belong to a namespace, it is not deleted when one is deleted, and any
namespace's claims may bind to it. That is a real operational hazard, and it is
why `run.sh` installs its own cleanup trap rather than relying on the shared
namespace teardown.

The manifest is small and every field in it does work:

- `capacity: 1Gi` and `accessModes: [ReadWriteOnce]` describe what this storage
  can do.
- `persistentVolumeReclaimPolicy: Retain` says what should happen when the
  claim using it goes away. This is the field the lab is really about.
- `storageClassName: ""` means *no class at all*. Without it, the claims later
  in the lab would be stamped with this cluster's default class by the
  `DefaultStorageClass` admission plugin and sent off to the dynamic
  provisioner, which would cheerfully create a completely different volume and
  leave this one untouched.
- `hostPath` points at a directory on a node's own filesystem — a teaching
  stand-in for a real disk, and unusable in production precisely because the
  "same" path is a different directory on every node.
- `nodeAffinity` therefore pins the volume to one node, so the scheduler will
  only place Pods that use it there. `run.sh` substitutes a real worker node
  name into the manifest before applying it. This is not a hostPath quirk: the
  local-path provisioner that backs this cluster's `standard` class writes the
  same constraint onto every volume it creates.

Immediately after the apply the volume reports `.status.phase: Available` and
an empty `.spec.claimRef`. It exists, it is idle, and nobody owns it.

### 2. A claim with the wrong access mode never matches

```
kubectl apply -f pvc-wrong-mode.yaml
kubectl get pvc wide
kubectl get events --field-selector involvedObject.name=wide
```

`wide` agrees with the volume about class, capacity and labels, and differs on
one point: it asks for `ReadWriteMany`. The volume offers only
`ReadWriteOnce`, and the binder requires the volume's mode list to contain
every mode the claim requests. So the two are never even candidates. The
script watches `wide` for twenty seconds and asserts it does not move off
`Pending`, with the volume sitting `Available` the whole time — an idle volume
and a waiting claim that will never find each other.

**This is where access modes are most often misread.** They are *matching
criteria used at bind time*, not permissions enforced on the disk. Binding a
`ReadWriteOnce` claim does not stop a second Pod on the same node from mounting
it and writing; RWO constrains how many *nodes* may mount the volume, not how
many Pods, and nothing about it makes the filesystem read-only for anybody.
The upstream documentation is blunt about it: access modes are not enforced on
the volume itself, and `ReadWriteOncePod` is the only mode the kubelet actually
enforces at mount time, by refusing to start a second Pod that references the
same claim.

### 3. A matching claim binds, and both objects record it

```
kubectl apply -f pvc-data.yaml
kubectl get pvc data
kubectl get pv sandbox-pv-pvc-static -o jsonpath='{.spec.claimRef}'
```

`data` asks for `ReadWriteOnce` and 1Gi of a classless volume whose labels match
its selector, which is a description of exactly one object in the cluster.
Within a second or two both objects report `Bound`.

The binding is written down twice, and it is worth reading both halves:

- the claim gains `.spec.volumeName: sandbox-pv-pvc-static`
- the volume gains `.spec.claimRef`, holding the claim's `name`, its
  `namespace`, and its `uid`

The UID is the interesting one. The reference is to that specific object, not
to the name — delete the claim and create another one called `data`, and the
volume will not recognise it.

### 4. A second, identical claim stays Pending

```
kubectl apply -f pvc-second.yaml
kubectl get pvc
```

`data-2` is the same spec as `data` with a different name. It matches the
volume on every criterion the binder checks, and it still waits, because
binding is exclusive: one PersistentVolume to one PersistentVolumeClaim, with
no sharing and no queue. The script watches it for thirty seconds and asserts
it never leaves `Pending`, then confirms the volume's `claimRef` still names
`data`.

A `Pending` claim is the single most common storage symptom you will be asked
to diagnose, and the causes all live in the list from step 3: no volume of that
class, none large enough, none with the right access modes, none whose labels
match the selector — or, as here, none that is still free. `kubectl describe
pvc` reports the reason as an event, and for a classless claim with nothing
available the message is precisely `no persistent volumes available for this
claim and no storage class is set`.

### 5. A Pod consumes the claim, and pins it in place

```
kubectl apply -f writer.yaml
kubectl exec writer -- sh -c 'echo "written through claim data" > /data/hello.txt'
kubectl delete pvc data --wait=false
kubectl get pvc data -o jsonpath='{.metadata.finalizers}'
```

The Pod names a claim and nothing else — no volume, no node, no host path. A
workload names a claim, the claim names a volume, and the volume knows where
the bytes are; that indirection is the entire reason claims exist. Because the
volume carries `nodeAffinity`, the scheduler has exactly one node to choose
from, and the script asserts the Pod landed there.

Now delete the claim while the Pod is running. The request is accepted and the
claim is *not* removed. It acquires a `deletionTimestamp`, `kubectl describe`
starts reporting `Status: Terminating`, and a
`kubernetes.io/pvc-protection` finalizer holds the object in the API server —
still `Bound`, still mounted, still working. Storage Object in Use Protection
exists so that a stray `kubectl delete pvc` cannot pull a filesystem out from
under a running workload. The deletion is not cancelled, only postponed: it
completes the moment no Pod references the claim.

### 6. Retain releases the volume instead of destroying it

```
kubectl delete pod writer
kubectl get pv sandbox-pv-pvc-static
```

With the Pod gone the finalizer is dropped, the claim finishes deleting, and
the volume moves to `Released`. Three things are true of it now, and each one
matters:

- **The PV object still exists.** Under `Delete` — the policy nearly every
  dynamic provisioner sets, including this cluster's default class — the PV and
  its backing storage would both be gone by now, with nothing left to inspect.
- **`.spec.claimRef` still names `data`**, a claim that no longer exists. That
  stale reference is not a leak; it is the lock.
- **`Released` is not `Available`.** The script checks that `data-2`, which has
  been waiting since step 4 and matches perfectly, is still `Pending`. A
  released volume is offered to nobody, because the previous tenant's data is
  still on it.

### 7. Manual reclamation, and what it does not do

```
kubectl patch pv sandbox-pv-pvc-static -p '{"spec":{"claimRef":null}}'
kubectl get pv sandbox-pv-pvc-static
kubectl get pvc data-2
kubectl exec reader -- cat /data/hello.txt
```

`Retain` means *manual reclamation*, and this is the manual part. Clearing
`claimRef` removes the lock; the volume controller sees an unreferenced volume
and returns it to `Available`; on its next pass the binder hands it to
`data-2`, which has been queued for it all along. (That pass is driven by the
claim binder's resync, so expect a wait of a few seconds rather than an instant
transition — which is why `run.sh` asserts that the volume left `Released` and
that `data-2` ended up `Bound`, rather than trying to catch the momentary
`Available` in between.) A second Pod, mounting the second claim, then reads
back the file the first claim's Pod wrote.

That last assertion is the point of the whole exercise. `Retain` preserved the
data, which is what you wanted — and then handed it, unchanged, to a different
claim that a different team could have created in a different namespace.
Retention is not sanitation. This is why the documented procedure is to delete
the PV object, clean or destroy the backing storage yourself, and publish a
fresh PV pointing at it; the `claimRef` patch is the shortcut you will
nevertheless see in the field, and it is safe only when you know exactly whose
data is on the disk.

Meanwhile `wide` is still `Pending`, as it has been since step 2. Nothing that
happened to the volume ever made `ReadWriteMany` match `ReadWriteOnce`.

## What this proves

Static provisioning splits one concern across two objects written by two
different people. The PersistentVolume is supply: this storage exists, here is
how to reach it, here is what it can do, here is what to do with it when its
tenant leaves. The PersistentVolumeClaim is demand: I need storage with these
properties, and I will not name a volume. A controller matches supply to
demand on class, capacity, access modes and labels, then records the result in
both directions — `.spec.volumeName` on the claim, `.spec.claimRef` on the
volume — and that match is exclusive, which is why a second identical claim
waits forever rather than sharing.

Access modes participate in that match and stop there. They decide which
volumes a claim may bind to; they are not permissions, and only
`ReadWriteOncePod` is enforced when the volume is actually mounted.

The lifecycle is deliberately hard to run backwards. A claim in use cannot be
deleted out from under its Pod, and a volume whose claim is deleted under
`Retain` does not become free — it becomes `Released`, a dead end that requires
an administrator. But the protection is of the *data*, not of the next tenant:
put the volume back into circulation without wiping it and the next claim
inherits everything the last one left behind. `Retain` buys you a decision;
somebody still has to make it.

## See also

- Study guide → Storage
- Flashcards: `persistent-volume`, `persistent-volume-claim`, `pv-access-modes`,
  `pv-reclaim-policy`, `storage-class`
- Related: `workloads-scheduling/statefulset` — `volumeClaimTemplates` is this
  same handshake, stamped out once per Pod and driven by a StorageClass
- Kubernetes docs: [Persistent Volumes](https://kubernetes.io/docs/concepts/storage/persistent-volumes/),
  [Change the Reclaim Policy of a PersistentVolume](https://kubernetes.io/docs/tasks/administer-cluster/change-pv-reclaim-policy/)
