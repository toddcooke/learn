# Pod

**CKA domain:** Workloads & Scheduling

A Pod is Kubernetes' smallest deployable unit: one or more containers that
always land on the same node and share a network namespace and a set of
volumes. Both kinds of sharing are easy to state and easy to half-believe,
so this lab demonstrates each one directly.

## Run it

```
bash run.sh          # the whole walkthrough, then cleans up
KEEP=1 bash run.sh   # leaves the namespace running so you can poke at it
```

## Walkthrough

### 1. Create a Pod with two containers

```
kubectl apply -f two-containers.yaml
```

`two-containers.yaml` declares one Pod named `shared` holding a `server`
container and a `sidecar` container, plus an `emptyDir` volume that both
mount at `/scratch`.

### 2. They share one IP

```
kubectl get pod shared -o jsonpath='{.status.podIP}'
```

One address for the whole Pod, not one per container. Listing
`.spec.containers[*].name` confirms there really are two of them behind
that single address.

### 3. They reach each other over localhost

```
kubectl exec shared -c sidecar -- /agnhost connect --timeout=5s 127.0.0.1:8080
```

This succeeds with no Service and no cluster networking involved, because
both containers are in the same network namespace.

The flip side is worth holding onto: one namespace means one port space.
A second container in this Pod could not also bind `:8080` — it would
fail exactly the way two processes on one machine fight over a port.

### 4. They share the volume

```
kubectl exec shared -c sidecar -- sh -c 'echo "written by sidecar" > /scratch/note.txt'
kubectl exec shared -c server  -- cat /scratch/note.txt
```

The file one container wrote is readable by the other, because the volume
belongs to the Pod rather than to either container. Delete the Pod and the
`emptyDir` goes with it — see the `storage/volumes` lab for what survives
what.

## What this proves

Co-scheduling onto one node, one network namespace, and shared volumes are
what make a Pod the unit of deployment rather than the container. It also
gives you the test for when to put two containers in one Pod: only when
they genuinely need to share an address, a port space, or a filesystem.
Everything else belongs in its own Pod, where it can be scheduled, scaled,
and restarted independently.

## See also

- Study guide → Workloads and Scheduling
- Flashcards: `pod`, `volume`, `sidecar-containers`
- Next: `replicaset` — what keeps a set of Pods running
