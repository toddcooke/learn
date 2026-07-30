# Volumes: emptyDir and hostPath

**CKA domain:** Storage

Before persistent volumes and claims and provisioners, there are two volume
types that need none of that machinery, and between them they mark out the two
ends of the storage problem. An `emptyDir` is storage that Kubernetes creates
and destroys with the Pod, so it is always available and never durable. A
`hostPath` is storage Kubernetes does not manage at all — a bind mount of a
directory on whichever node the Pod happens to be running on — so it is durable
and never portable. This lab pins down exactly what each one survives, because
"ephemeral" and "node-local" are easy phrases to repeat and easy to get wrong
under pressure.

## Run it

```
bash run.sh          # the whole walkthrough, then cleans up
KEEP=1 bash run.sh   # leaves the namespace running so you can poke at it
```

Expect two to three minutes. The lab also writes one file onto the node
`cka-sandbox-worker` and removes it again in a trap that fires on success,
failure and interrupt alike — including under `KEEP=1`, because a stray file on
a node would quietly poison whatever runs next.

## Walkthrough

### 1. One Pod, two containers, two emptyDir volumes

```
kubectl apply -f shared-emptydir.yaml
kubectl get pod shared -o jsonpath='{range .spec.volumes[*]}{.name}{" -> "}{.emptyDir.medium}{"\n"}{end}'
```

`shared-emptydir.yaml` declares a Pod with a `writer` container and a `reader`
container, and two volumes. `scratch` is `emptyDir: {}` — the default medium,
which is a directory on the node's disk. `cache` sets `medium: Memory`, which is
the same field pointing at a completely different backing store.

The command prints a third volume you did not write, named `kube-api-access-`
plus a random suffix. That is the projected service account token, injected by
admission. It is a small reminder that `.spec.volumes` shows what the API server
stored, not what you submitted.

Notice what is *not* in the manifest: no PersistentVolumeClaim, no
StorageClass, no provisioner, no capacity request that anything has to satisfy.
An `emptyDir` is created by the kubelet at the moment the Pod is assigned to a
node, and that is the entirety of its lifecycle. This is why an `emptyDir` Pod
never sits `Pending` waiting for storage: there is nothing to wait for.

The `writer` container's command is worth reading, because it is the lab's
restart button. It appends a line to `starts.log` every time it starts, then
blocks until somebody creates `/scratch/restart-me`, deletes that sentinel, and
exits non-zero. Step 5 uses it to restart one container without touching the
Pod.

### 2. The volume belongs to the Pod, so both containers see it

```
kubectl exec shared -c writer -- sh -c 'echo "written by writer" > /scratch/message.txt'
kubectl exec shared -c reader -- cat /scratch/message.txt
```

Two containers, two separate root filesystems, one shared directory. The volume
is declared once under `spec.volumes` and referenced by name from each
container's `volumeMounts`, which is why the mount paths do not have to agree —
they happen to here, but the identity of the volume is its name in the Pod spec,
not the path a container hangs it at.

### 3. Where that directory actually is

```
kubectl get pod shared -o jsonpath='{.metadata.uid}'
docker exec cka-sandbox-worker ls -l /var/lib/kubelet/pods/<uid>/volumes/kubernetes.io~empty-dir/scratch
```

There is no magic underneath. The kubelet made a directory on the node under
`/var/lib/kubelet/pods/<pod-uid>/volumes/kubernetes.io~empty-dir/<volume-name>`
and bind-mounted it into both containers, and `message.txt` is sitting in it as
an ordinary file that you can read from the node.

The path is keyed by the Pod's **UID**, not its name. That is the whole
explanation of step 6 in advance: a Pod deleted and recreated with the same name
is a different object with a different UID, so it gets a different — and empty —
directory.

### 4. `medium: Memory` is a tmpfs

```
kubectl exec shared -c reader -- sh -c 'grep " /cache "   /proc/mounts'
kubectl exec shared -c reader -- sh -c 'grep " /scratch " /proc/mounts'
```

The first line comes back as a `tmpfs` mount; the second names the node's real
filesystem. Same API field, same `emptyDir` key, entirely different storage.

A tmpfs is still just a filesystem — you write and read files in the ordinary
way — but the bytes live in RAM and, as the Kubernetes documentation puts it,
they "count against the memory limit of the container that wrote them". A
memory-backed `emptyDir` is therefore a genuine way to get a container
OOM-killed by writing files, which is what `sizeLimit` is for; this manifest caps
it at `32Mi`. Leave `sizeLimit` off and a memory-backed volume is sized to the
node's allocatable memory, which is almost never what you meant.

Reach for `medium: Memory` when you want speed on small hot data, or when you
want decrypted material never to touch a disk. Do not reach for it as a free
performance upgrade: the space is real memory taken from the workload.

### 5. An emptyDir survives a container restart

```
kubectl exec shared -c reader -- touch /scratch/restart-me
kubectl get pod shared -o jsonpath='{.status.containerStatuses[?(@.name=="writer")].restartCount}'
kubectl exec shared -c writer -- cat /scratch/message.txt
kubectl exec shared -c writer -- sh -c 'wc -l < /scratch/starts.log'
```

Creating the sentinel from the *reader* makes the *writer* exit non-zero. The
Pod's `restartPolicy` defaults to `Always`, so the kubelet starts a fresh
`writer` container in place: its `restartCount` goes to 1 while the reader's
stays at 0, and the Pod's UID and node are unchanged. A restart is a
per-container event, not a per-Pod one.

The new container reads `message.txt` — written before it existed — and
`starts.log` now holds two lines, which is the same fact stated from the other
direction: the second instance is reading a file the first instance wrote. The
memory-backed `/cache/hot.txt` survives too, for the same reason. The volume is
attached to the Pod, and the Pod never went anywhere.

This is exactly what the docs mean by "the data in an `emptyDir` volume is safe
across container crashes". A crash does not remove the Pod from the node, and
the node is where the directory lives.

### 6. An emptyDir does not survive the Pod

```
kubectl delete pod shared
docker exec cka-sandbox-worker ls -A /var/lib/kubelet/pods/<uid>/volumes/kubernetes.io~empty-dir/scratch
kubectl apply -f shared-emptydir.yaml
kubectl exec shared -c writer -- cat /scratch/message.txt
```

The directory disappears from the node — the kubelet reclaims it a moment after
the API object goes, which is why the run polls for it rather than looking once.
Re-applying the identical manifest produces a Pod with the same name and a new
UID, and its `/scratch` is empty: `cat` fails with *No such file or directory*,
`starts.log` is back to one line, and `/cache` lists nothing.

Nothing failed and nothing warned. That is the point worth internalising:
"ephemeral" is not a caveat on `emptyDir`, it is the definition. Anything that
removes the Pod from the node takes the data with it — your own `kubectl
delete`, a drain, an eviction under memory pressure, a rolling update replacing
the Pod, or a node that never comes back. `emptyDir` is right for scratch space,
caches, and handoffs between containers in a Pod, and wrong for anything you
would miss.

### 7. hostPath: put a file on a node, then read it from a Pod

```
docker exec cka-sandbox-worker sh -c 'echo hello > /tmp/sandbox-volumes-probe'
kubectl apply -f hostpath.yaml
kubectl exec node-reader -- cat /node/probe.txt
kubectl exec node-reader -- ls /node-tmp
```

The file is created directly on the node, entirely outside Kubernetes — no
object, no API call, nothing the cluster knows about. `hostpath.yaml` then
mounts it into a Pod and the Pod reads `hello` out of it.

Two fields make that work, and both matter. `nodeSelector` pins the Pod to
`cka-sandbox-worker` by `kubernetes.io/hostname`, because a host path means
nothing until you know which host. And `type: File` tells the kubelet to refuse
the mount unless a regular file really exists at that path. The other type
values are worth knowing: `Directory` and `File` require the thing to exist,
`DirectoryOrCreate` and `FileOrCreate` create it (owned by the kubelet, mode
0755 or 0644), `Socket`, `CharDevice` and `BlockDevice` check for those, and an
empty type — the default — performs no check at all.

The second volume mounts the node's whole `/tmp`, which shows what a hostPath
really is: a live window onto the node's filesystem, not a copy of anything.

```
kubectl exec node-reader -- sh -c 'echo tampered > /node-tmp/sandbox-volumes-tamper'
```

This fails with *Read-only file system*, and `readOnly: true` on the volumeMount
is the only reason it does. Without it the Pod could rewrite anything under
`/tmp` on that node; with `path: /` it would have the node's root filesystem,
including the kubelet's credentials and the container runtime socket. Mounting a
node directory writable is equivalent to handing out root on the node to anyone
who can create a Pod, which is why the Baseline Pod Security Standard forbids
`hostPath` volumes outright rather than merely discouraging them. When you must
use one, scope it to the narrowest path that works and mount it read-only.

### 8. hostPath ties the Pod to one specific node

```
kubectl apply -f elsewhere.yaml
kubectl get events --field-selector involvedObject.name=elsewhere
```

`elsewhere.yaml` is `hostpath.yaml` with one label changed: the nodeSelector
points at `cka-sandbox-worker2`, where the probe file was never created. The
Pod schedules perfectly happily — the scheduler does not inspect host paths —
and then never starts. The kubelet's `type: File` check fails, the Pod sits in
`ContainerCreating`, and the events fill with `FailedMount`. Meanwhile the
identical mount on `cka-sandbox-worker` keeps serving `hello`.

Nothing about the manifest is wrong. It is describing a filesystem that exists
on one machine, which is what a hostPath always is. Every hostPath Pod therefore
needs something to keep it where its data is: a `nodeSelector`, a node affinity
rule, or a DaemonSet that runs one copy per node and only ever touches that
node's own paths.

This is also the honest version of a pattern you will meet in practice. On a
single-node practice cluster, a hand-written PersistentVolume is very often
backed by a `hostPath` — it is the simplest way to get a PV without a
provisioner. It works there precisely because there is only one node to be wrong
about. Move that same PV to a multi-node cluster and a Pod will eventually bind
the claim from a node where the directory is empty or absent, silently. A manual
PV built on local storage needs `nodeAffinity` on the PV itself to pin it down,
which is what the `local` volume type formalises.

## What this proves

A volume is declared on the Pod and mounted into containers, so its lifetime is
the Pod's and its visibility is every container's. The `writer` container was
destroyed and replaced under the same Pod UID and its successor read a file its
predecessor had written, while the `reader` beside it never noticed anything
happen.

The boundary is the Pod — not the container, and not the node. Deleting the Pod
deleted the directory under `/var/lib/kubelet`, and the replacement Pod, same
name and new UID, got an empty one with no error and no warning.

`medium: Memory` changes the backing store without changing the interface: a
tmpfs that is fast, never written to disk, wiped on node reboot, and paid for
out of the writing container's memory limit.

`hostPath` is the opposite trade in every respect. The data outlives the Pod
because Kubernetes is not managing it at all, and the price is that node
filesystems are not interchangeable: the identical manifest ran on one worker
and hung forever on the other. It is also a direct route out of the container,
so read-only and a single-file path are the minimum, and a policy that blocks
`hostPath` entirely is the real answer on any shared cluster. The legitimate
uses are all node-level by nature — a log shipper reading `/var/log`, a
monitoring agent reading `/proc`, the static Pod manifests the control plane
mounts for itself — and, on a single-node practice cluster, backing a manual
PersistentVolume.

## See also

- Study guide → Storage
- Flashcards: `volume`, `emptydir`, `hostpath`, `volume-lifecycle`
- Previous: `pod` — where the shared-volume idea is introduced
- Next: `pv-pvc` — what to reach for when the data has to outlive the Pod
