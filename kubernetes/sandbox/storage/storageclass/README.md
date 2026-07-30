# StorageClass and WaitForFirstConsumer

**CKA domain:** Storage

A StorageClass is a named recipe for making storage on demand: which
provisioner to call, what parameters to hand it, what to do with the volume
when the claim goes away — and, the part that quietly changes how scheduling
works, *when* to make the volume at all. This cluster's default class,
`standard`, sets `volumeBindingMode: WaitForFirstConsumer`, which means a
PersistentVolumeClaim with nobody using it does not get a volume. It sits at
`Pending`, on purpose, until a Pod gives the system enough information to
provision correctly. This lab watches that happen, then watches the price of
it: the volume that finally appears is nailed to exactly one node.

## Run it

```
bash run.sh          # the whole walkthrough, then cleans up
KEEP=1 bash run.sh   # leaves the namespace running so you can poke at it
```

## Walkthrough

### 1. Read the default StorageClass

```
kubectl get sc
kubectl get sc standard -o yaml
```

`kubectl` prints the class as `standard (default)`. That parenthetical is not a
field — it is `kubectl` reporting the annotation
`storageclass.kubernetes.io/is-default-class: "true"`, which is the only thing
that makes a class default. A cluster can have more than one class carrying
that annotation, and if it does, the behaviour is undefined enough that you
should treat it as a misconfiguration.

Three top-level fields matter here, and note that they really are top-level: a
StorageClass has no `.spec`.

- `provisioner: rancher.io/local-path` — the class hands provisioning to the
  local-path provisioner, which makes a directory on a node's own disk. Nothing
  about this storage is shared or networked.
- `reclaimPolicy: Delete` — when the claim is deleted, the volume is destroyed
  with it rather than being kept for manual cleanup.
- `volumeBindingMode: WaitForFirstConsumer` — the subject of the rest of this
  lab. The alternative, `Immediate`, provisions and binds as soon as a claim
  appears.

### 2. Create a claim with nothing consuming it

```
kubectl apply -f pvc.yaml
kubectl get pvc data
kubectl describe pvc data
kubectl get pv
```

`pvc.yaml` deliberately omits `storageClassName`. That is not the same thing as
setting it to the empty string — an empty string means "use no class at all,
match a pre-created PV" — whereas omitting the field lets the
`DefaultStorageClass` admission plugin fill in the default class's name. Read
the claim back and `.spec.storageClassName` is `standard`, written by the API
server, not by you.

Now the interesting part: the claim is `Pending`, and it stays that way.
`describe` shows an event from `persistentvolume-controller`:

```
Normal  WaitForFirstConsumer  waiting for first consumer to be created before binding
```

`kubectl get pv` shows no volume for this claim anywhere in the cluster. It is
worth sitting with that for a moment, because the instinct on seeing a Pending
PVC is that something is broken. Nothing is broken. The controller has been
told not to guess, and it is not guessing.

The claim also has no `volume.kubernetes.io/selected-node` annotation yet.
Remember that name — it is about to be the mechanism.

### 3. Create a consumer and watch the claim bind

```
kubectl apply -f consumer.yaml
kubectl get pvc data
kubectl get pvc data -o jsonpath='{.metadata.annotations.volume\.kubernetes\.io/selected-node}'
kubectl get pv
```

Within a few seconds the claim is `Bound` and a PersistentVolume named
`pvc-<uid>` exists that did not exist a moment ago. The sequence behind that is
worth stating explicitly, because it runs in the opposite order from the one
most people assume:

1. The scheduler evaluates the `writer` Pod. Because its claim is unbound and
   the class is `WaitForFirstConsumer`, the scheduler — not the volume — picks
   the node.
2. The scheduler writes its choice onto the *claim* as the annotation
   `volume.kubernetes.io/selected-node: <node>`.
3. The local-path provisioner sees that annotation, creates a directory on that
   node, and creates a PersistentVolume describing it.
4. The controller binds claim to volume, and the Pod starts.

Node first, volume second. The run script asserts that the annotation's value
is exactly the node the Pod landed on, which is the observable evidence for
steps 1 and 2.

The new volume inherits the class's `reclaimPolicy: Delete`, so it is not
something you will have to clean up by hand later — deleting the claim destroys
it.

### 4. Look at the volume's nodeAffinity

```
kubectl get pv <pv-name> -o yaml
```

The provisioned volume carries:

```yaml
nodeAffinity:
  required:
    nodeSelectorTerms:
      - matchExpressions:
          - key: kubernetes.io/hostname
            operator: In
            values:
              - cka-sandbox-worker      # or worker2 — whichever ran the Pod
```

`required`, not `preferred`. This is a hard constraint the scheduler cannot
trade away against anything else, and it is honest: the bytes really are in a
directory on one machine's disk. Any Pod that mounts this claim, forever, must
run on that node.

That is the answer to "why does `WaitForFirstConsumer` exist". With `Immediate`
binding, step 3 would have run before step 1 — a volume would have been
provisioned on whatever node or zone the provisioner felt like, and *then* the
scheduler would have been handed a Pod with a hard affinity to that node. If
the node was full, tainted, or already unsuitable for other reasons, the Pod
would be unschedulable forever, through no fault of its own. This is not a
kind-cluster quirk: it is the everyday failure mode of EBS volumes in the wrong
availability zone. Deferring the binding until a consumer exists means the two
decisions are made together, in the order where they can agree.

### 5. The price: a Pod that cannot follow its volume

```
kubectl delete pod writer
kubectl apply -f stranded.yaml     # nodeSelector pins it to the OTHER worker
kubectl get pod stranded
kubectl get events --field-selector involvedObject.name=stranded
```

`stranded.yaml` is the same Pod mounting the same claim, with one addition: a
`nodeSelector` naming the worker that does *not* hold the volume. It never
schedules. The event reads:

```
Warning  FailedScheduling  0/3 nodes are available: ...
                           1 node(s) didn't match PersistentVolume's node affinity, ...
```

(On clusters older than v1.33 the same rejection is phrased "node(s) had volume
node affinity conflict". The run script accepts either wording.)

The claim is still `Bound`, the data is still intact, and `.spec.nodeName` on
the Pod is empty — it was never assigned anywhere. Nothing failed; the
scheduler simply had no legal placement.

This is exactly the shape of a `kubectl drain`. Draining the node evicts the
Pod successfully, its controller recreates it, and the recreated Pod has
nowhere to go, because the one node it is allowed to run on is the node you
just cordoned. `WaitForFirstConsumer` bought a good *first* placement; it did
not make node-local storage movable. See `troubleshooting/node-maintenance` for
the drain itself and what the resulting Pending Pod looks like from the other
direction.

### 6. Let the scheduler choose and it follows the volume

```
kubectl delete pod stranded
kubectl apply -f consumer.yaml
kubectl get pod writer -o wide
kubectl exec writer -- cat /data/id.txt
```

Recreate the Pod without a `nodeSelector` and it goes straight back to the node
the volume is on — the scheduler is not being clever, it is obeying the
`nodeAffinity`. The claim stays bound to the same PersistentVolume (binding
happens once per claim, not once per Pod), and the file the first `writer`
wrote is still there.

## What this proves

`volumeBindingMode` decides the order of two decisions that have to be
consistent with each other: where the Pod runs, and where its storage is made.
`Immediate` makes the storage decision first and blindly, which works fine when
storage is reachable from everywhere and fails badly when it is not.
`WaitForFirstConsumer` refuses to decide until a Pod exists, then lets the
scheduler choose the node and tells the provisioner to follow. A `Pending` PVC
under this mode is the system working, not the system stuck.

The lab also shows what deferred binding does *not* fix. Once the volume is
provisioned it carries a required `nodeAffinity` naming a single node, and
every future scheduling decision for anything mounting that claim is already
made. That is why a Pod pinned elsewhere sits `Pending`, and why node-local
storage and routine node maintenance pull against each other: you cannot drain
a node out from under a volume that only exists on it.

Two practical habits fall out of this. When you see a `Pending` PVC, read its
events before assuming a broken provisioner — `WaitForFirstConsumer` means "no
Pod yet", and the real problem, if there is one, is usually why the Pod cannot
schedule. And when you see a `Pending` Pod complaining about a
PersistentVolume's node affinity, go and look at which node the PV names; the
answer is one `kubectl get pv` away.

## See also

- Study guide → Storage
- Flashcards: `storage-class`, `persistent-volume-claim`, `pv-reclaim-policy`,
  `cordon-drain-uncordon`
- Related: `storage/pv-pvc` — the claim/volume relationship without a class in
  the way
- Related: `troubleshooting/node-maintenance` — the drain that this lab's node
  pinning would obstruct
- Related: `workloads-scheduling/statefulset` — `volumeClaimTemplates` stamping
  out one of these claims per replica
