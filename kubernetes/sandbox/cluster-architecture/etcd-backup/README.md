# etcd Backup

**CKA domain:** Cluster Architecture, Installation and Configuration

etcd holds every object in the cluster, so a snapshot of it is a snapshot of
the cluster. Taking one is a single command, and the command is written down
in a hundred places — which is the problem, because the version that
circulates most widely does not work on a modern kubeadm cluster, and two of
the ways it fails still print a success message. This lab takes a real
snapshot of this sandbox's etcd, verifies it, retrieves it to the host, and
walks into each of the three traps deliberately so that you recognise them
before you meet them under pressure.

## Run it

```
bash run.sh          # the whole walkthrough, then cleans up
KEEP=1 bash run.sh   # leaves the retrieved snapshot on your machine
```

This lab creates nothing in its own namespace. It reads from `kube-system`,
writes one file to the control-plane node at
`/var/lib/etcd/sandbox-snapshot.db`, and copies that file to a temporary
directory on your machine. `run.sh` carries its own cleanup trap that deletes
the file from the node whether the run succeeds or fails — `/var/lib/etcd` is
etcd's live data directory and no lab should leave litter in it. With `KEEP=1`
the copy on your own machine is left behind and the script prints its path;
the copy on the node is removed either way.

It needs the `docker` CLI, because the last step reaches into the kind node's
filesystem. It never restores anything: a restore would take this cluster down.

Everything below happens in `kube-system`. Orient yourself once and the
commands stay readable:

```
kubectl config set-context --current --namespace=kube-system
```

## Walkthrough

### 1. Find the etcd Pod without hardcoding its name

```
kubectl get pods -l component=etcd -o wide
```

On a kubeadm cluster the etcd Pod is named `etcd-<node>`, so on this sandbox
it is `etcd-cka-sandbox-control-plane` and on yours it will be something else.
Asking by label rather than by name is the habit worth building: `component=etcd`
is set by kubeadm on every control-plane component and does not vary.

The Pod's ownership is the giveaway that it is not an ordinary workload:

```
kubectl get pod etcd-cka-sandbox-control-plane -o jsonpath='{.metadata.ownerReferences[0].kind}'
Node
```

A Deployment's Pod is owned by a ReplicaSet. This one is owned by a Node,
because it is a *mirror Pod*: a read-only reflection, published into the API
by the kubelet, of a file sitting at `/etc/kubernetes/manifests/etcd.yaml` on
the node. Deleting the mirror Pod does not delete etcd; the kubelet simply
recreates it from the file. That file is also where the restore procedure ends
up, in step 7.

### 2. Where the backup command's paths come from

The backup command needs four paths, and none of them have to be guessed —
the manifest already declares all four:

```
kubectl get pod etcd-cka-sandbox-control-plane \
  -o jsonpath='{range .spec.volumes[*]}{.name}{" -> "}{.hostPath.path}{"\n"}{end}'
etcd-certs -> /etc/kubernetes/pki/etcd
etcd-data -> /var/lib/etcd
```

`etcd-certs` is where `--cacert`, `--cert` and `--key` live. `etcd-data` is
etcd's database. Both are `hostPath` volumes, mounted at the *same* path
inside the container as outside it:

```
kubectl get pod etcd-cka-sandbox-control-plane \
  -o jsonpath='{range .spec.containers[0].volumeMounts[*]}{.name}{" -> "}{.mountPath}{"\n"}{end}'
etcd-data -> /var/lib/etcd
etcd-certs -> /etc/kubernetes/pki/etcd
```

Hold on to that second listing. It is what makes the snapshot retrievable at
all in step 6: a file the container writes to `/var/lib/etcd` is, byte for
byte, a file on the node's `/var/lib/etcd`. Reading the manifest before
running the backup is also the fastest way to adapt the command to a cluster
that put its certificates somewhere unusual.

If you cannot reach the API at all — which is precisely when you tend to want
a backup — the same information is in the file itself:

```
docker exec cka-sandbox-control-plane cat /etc/kubernetes/manifests/etcd.yaml
```

### 3. Trap 1 — the etcd image is distroless, so `sh -c` cannot work

The recipe you will find almost everywhere looks like this:

```
kubectl exec etcd-cka-sandbox-control-plane -- sh -c "ETCDCTL_API=3 etcdctl ... snapshot save ..."
error: Internal error occurred: ... exec: "sh": executable file not found in $PATH
```

There is no shell in the image. `registry.k8s.io/etcd` is distroless: it
contains the `etcd`, `etcdctl` and `etcdutl` binaries and essentially nothing
else — no `sh`, no `bash`, no `tar`, no `rm`, no package manager. The failure
happens in the container runtime before `etcdctl` is ever considered, which is
why the error mentions `sh` and never mentions etcd. People read it as "the
backup command is wrong" and start editing flags, which cannot help.

The fix is to drop the wrapper and exec the binary directly, as every command
in this lab does. That costs you the ability to set environment variables —
`kubectl exec` has no `--env` flag — and the good news is that you no longer
need to. `ETCDCTL_API=3` was how you opted in to the v3 API on etcd 3.3; v3
has been etcdctl's default since 3.4, and etcd 3.6 removed the variable
entirely. It survives in copied-and-pasted recipes only, and it is the sole
reason the `sh -c` wrapper was there in the first place.

### 4. Take the snapshot

```
kubectl exec etcd-cka-sandbox-control-plane -- etcdctl \
  --endpoints=https://127.0.0.1:2379 \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/server.crt \
  --key=/etc/kubernetes/pki/etcd/server.key \
  snapshot save /var/lib/etcd/sandbox-snapshot.db
{"level":"info", ... ,"msg":"saved","path":"/var/lib/etcd/sandbox-snapshot.db"}
Snapshot saved at /var/lib/etcd/sandbox-snapshot.db
```

`--endpoints` points at etcd's own loopback listener, reachable because the
command is running inside the etcd container. The three certificate flags are
mutual TLS: etcd will not talk to an unauthenticated client, so a call without
them does not fail fast with "permission denied" — it hangs through the dial
timeout and then reports a context deadline, which reads like a network
problem and is not one.

Note which tool this is. `snapshot save` is a *client* operation: it opens a
connection to a running member and streams a consistent point-in-time copy of
the keyspace out of it. That is why it lives in `etcdctl`, and why it is the
one snapshot subcommand that still does.

The output above is the whole reason the next two steps exist. `Snapshot saved`
tells you that etcd wrote a file. It tells you nothing about whether that file
is complete, and nothing about whether you will ever be able to reach it.

### 5. Trap 2 — verify with `etcdutl`, because `etcdctl` no longer can

The verification step everyone remembers is `etcdctl snapshot status`. On this
cluster it does not exist:

```
kubectl exec etcd-cka-sandbox-control-plane -- etcdctl snapshot status /var/lib/etcd/sandbox-snapshot.db
Error: unknown command "status" for "etcdctl snapshot"
```

etcd deprecated `etcdctl snapshot status` and `etcdctl snapshot restore` in
3.5 and removed both in 3.6, which is the version Kubernetes v1.35 ships. The
split is principled rather than arbitrary: `etcdctl` is the client for a
*running* cluster and speaks to it over the network, while `etcdutl` is the
offline tool that operates directly on data files. Reading a snapshot and
rebuilding a data directory from one are both file operations, so both moved.

```
kubectl exec etcd-cka-sandbox-control-plane -- etcdutl snapshot status /var/lib/etcd/sandbox-snapshot.db -w table
+----------+----------+------------+------------+
|   HASH   | REVISION | TOTAL KEYS | TOTAL SIZE |
+----------+----------+------------+------------+
| 8e2f41ac |     4021 |       1183 |     6.4 MB |
+----------+----------+------------+------------+
```

(Your numbers will differ.) Notice what this command did *not* need: no
`--endpoints`, no certificates. `etcdutl` opened a file. That is the quickest
way to remember which tool you want — if the operation needs a live member,
it is `etcdctl`; if it needs a file, it is `etcdutl`.

Read the columns rather than glancing at them. `TOTAL KEYS` is the difference
between a backup and a zero-byte file that a script cheerfully reported as
saved. `REVISION` is the etcd revision the snapshot was taken at, which is the
concrete form of "point in time": everything committed at or before that
revision is in the file, and everything after it is not. Two backups taken a
minute apart differ by exactly the revisions in between, and that gap is your
recovery point objective, stated in etcd's own units.

### 6. Trap 3 — a snapshot you cannot retrieve is not a backup

A backup that only exists on the machine you are backing up protects you from
nothing. Getting it off the node is where the third trap lives, and it has two
halves.

The first half: `kubectl cp` is the obvious tool and it cannot work here.

```
kubectl cp kube-system/etcd-cka-sandbox-control-plane:/var/lib/etcd/sandbox-snapshot.db ./snapshot.db
error: ... exec: "tar": executable file not found in $PATH
```

`kubectl cp` is not a protocol. It is a convenience wrapper that execs `tar`
*inside the container* and streams the archive out — so it inherits every
limitation of `kubectl exec`, including the distroless image from step 3.
There is no `tar` in the etcd image, so there is no `kubectl cp` out of it.

The second half: `docker cp` does work, and it is worth being precise about
why.

```
docker cp cka-sandbox-control-plane:/var/lib/etcd/sandbox-snapshot.db /tmp/
```

That command addresses the **node** container, not the etcd container. It
finds the file only because `/var/lib/etcd` is a `hostPath` — the snapshot is
genuinely sitting on the node's filesystem, and the etcd container merely has
a window onto it. On a real cluster the equivalent is `scp` from the node, and
the same reasoning applies unchanged.

Now the trap proper. Change one thing about the save in step 4 — write to
`/tmp/snapshot.db` instead — and it still prints `Snapshot saved`, exits zero,
and passes any check that greps its output. But `/tmp` is not one of the
Pod's `hostPath` mounts, so the file lands in the etcd *container's* writable
layer, and:

- `docker cp` against the node will not find it, because it is not on the node;
- `kubectl cp` against the Pod cannot reach it either, for want of `tar`;
- you cannot even delete it, because the image has no `rm`. It occupies disk
  until the kubelet next recreates the container.

That is the worst failure mode of the three, because it looks exactly like
success. `run.sh` deliberately does not perform that save — stranding an
undeletable file in a shared teaching cluster is precisely the harm the trap
describes — but it does prove the `kubectl cp` half, and the reasoning for the
`/tmp` half follows from the volume listing in step 2. The rule to carry away
is simple: **always save under a path the manifest mounts as a `hostPath`**,
which on a kubeadm cluster means `/var/lib/etcd`, then move the file off the
node immediately.

One more property of that file is worth stating plainly, since it is a real
exam-adjacent and job-adjacent point: the snapshot contains every Secret in
the cluster, and unless you have configured encryption at rest, it contains
them in plaintext. Treat it like the credential store it is.

### 7. Restoring — the procedure, which this lab does not run

`run.sh` stops short of restoring, and the reason is the lesson: a restore
rewrites a data directory and takes the control plane down while it happens.
On this shared sandbox that would break every other lab. What the script does
check is that the tool and the flag the procedure depends on are really
present:

```
kubectl exec etcd-cka-sandbox-control-plane -- etcdutl snapshot restore --help
```

The procedure itself, for a single-member kubeadm cluster:

1. **Stop the API servers.** Move `/etc/kubernetes/manifests/kube-apiserver.yaml`
   out of the manifests directory; the kubelet notices within seconds and stops
   the container. Restoring underneath a live API server leaves it serving
   state that no longer exists.
2. **Rebuild a data directory from the snapshot.**

   ```
   etcdutl snapshot restore /var/lib/etcd/sandbox-snapshot.db --data-dir /var/lib/etcd-restored
   ```

   The target directory must not already exist — `etcdutl` refuses to write
   into one that does, rather than merging into a half-populated database.
   Note again that this is `etcdutl`: `etcdctl snapshot restore` was removed in
   3.6 alongside `status`, and on 3.5 it was already deprecated.
3. **Point etcd at the new directory.** Edit
   `/etc/kubernetes/manifests/etcd.yaml` so the `etcd-data` volume's `hostPath`
   is `/var/lib/etcd-restored`. The kubelet sees the changed file and recreates
   the etcd Pod against the restored data.
4. **Put the API server back** and restart the other control-plane components
   so that nothing is left holding cached state from before the restore.

There is no `kubectl` step anywhere in that list, and there could not be: the
API server is down for most of it. Every change is a file on the node, picked
up by the kubelet's watch on `staticPodPath`. That is exactly the property
that makes static Pods the right home for the control plane — they are the
part of the system that has to work when the API does not.

On a multi-member etcd cluster, restore *every* member, each from the **same**
snapshot, each with its own `--name`, `--initial-cluster` and
`--initial-advertise-peer-urls`. Restoring one member and letting it rejoin
the others does not roll the cluster back; the surviving members simply
overwrite it with the state you were trying to discard.

Finally, one piece of good news to file away: `kubeadm upgrade` backs up etcd
and the static Pod manifests to `/etc/kubernetes/tmp` before it touches
anything, so a failed upgrade already has a rollback point you did not have to
plan for.

## What this proves

An etcd backup is one client call. `etcdctl snapshot save`, aimed at a live
member and authenticated with the same CA, certificate and key that the etcd
static Pod already mounts, produces a single file containing every object
anyone ever created in the cluster. That is what makes it the most valuable
file on the node, and — since it holds your Secrets in the clear — the most
dangerous one.

Three details decide whether that call actually leaves you holding a backup,
and each of them is invisible until you hit it. The etcd image is distroless,
so the widely copied `kubectl exec ... -- sh -c '...'` form dies on a missing
`sh` before etcdctl is reached; exec the binary directly and drop the
`ETCDCTL_API` variable that the wrapper existed to set. `etcdctl` and
`etcdutl` divide the work between live-cluster operations and file operations,
and etcd 3.6 finished that split by removing `snapshot status` and
`snapshot restore` from `etcdctl`; verification and restoration both belong to
`etcdutl` and need neither an endpoint nor a certificate. And where you write
matters more than whether the write succeeded: only paths the manifest mounts
as `hostPath` volumes are reachable from outside the container, so a snapshot
under `/var/lib/etcd` can be collected with `docker cp` or `scp` while one
under `/tmp` reports the same cheerful `Snapshot saved` and is stranded
forever.

The through-line is that "the command exited zero" is not the property you
care about. A backup is only a backup once you have verified its contents and
moved it somewhere the failure you are insuring against cannot reach.

## See also

- Study guide → Cluster Architecture, Installation and Configuration
- Flashcards: `etcd`, `etcd-backup`, `etcd-restore`, `control-plane-manifests`,
  `kubeadm-upgrade`
- Related: `cluster-architecture/namespaces` — why a namespace delete is not a
  backup strategy, and what it does and does not reach
- Next: `troubleshooting/control-plane-debugging` — reading static Pod
  manifests and container logs when the API server, and therefore `kubectl`,
  is unavailable
