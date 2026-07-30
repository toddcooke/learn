# Control-Plane Debugging

**CKA domain:** Troubleshooting

> **This lab deliberately takes the cluster down.** It edits the API server's
> static Pod manifest on the control-plane node so that `kube-apiserver`
> refuses to start, and for roughly a minute in the middle of the run
> `kubectl` does not work against this cluster at all — not in this terminal,
> not in any other, and not for the controller manager or the scheduler. That
> is the point: you cannot practise debugging a control plane through an API
> server that is answering.
>
> It is safe **only** because this kind cluster is disposable. Do not adapt
> this script for a cluster anyone depends on. `run.sh` backs the manifest up
> first, and its cleanup trap copies the backup back on `EXIT`, `INT` and
> `TERM` — before anything else, using only `docker exec`, because `kubectl`
> is exactly what is broken when the trap matters. Pressing Ctrl-C during the
> broken window still puts the cluster back.
>
> If it ever does go wrong, the recovery path is to throw the sandbox away and
> build a new one:
>
> ```
> cluster/down.sh && cluster/up.sh
> ```

Every troubleshooting habit you have is built on `kubectl`: `describe` for
events, `logs` for output, `get -w` for progress. All of them are clients of
the API server, so when the API server is the thing that is broken, the entire
toolkit goes with it in one step and the screen fills with `The connection to
the server ... was refused`. This lab puts you in that position on purpose,
then works back out of it with the two tools that never depended on the API
server in the first place: `crictl`, which talks to the container runtime on
the node, and `journalctl -u kubelet`, which reads the kubelet's own log.

## Run it

```
bash run.sh          # the whole walkthrough, then restores and cleans up
KEEP=1 bash run.sh   # leaves the namespace running so you can poke at it
```

`KEEP=1` keeps only the lab's namespace. The manifest on the node is restored
and the backup file is deleted either way — a kept namespace is a debugging
aid, a cluster left without an API server is a wrecked sandbox for every lab
that runs afterwards.

The lab needs the `docker` CLI, because when the API server is down `docker
exec` into the kind node is the only way in. On a real cluster the same
commands run over SSH; nothing else about them changes.

## Walkthrough

### 1. The control plane is four files on one node

```
docker exec cka-sandbox-control-plane ls -A /etc/kubernetes/manifests
```

```
etcd.yaml
kube-apiserver.yaml
kube-controller-manager.yaml
kube-scheduler.yaml
```

Nothing schedules these. The kubelet on this node reads that directory and
runs whatever it finds there, which is the only bootstrap order that can work:
an API server cannot be a Deployment, because a Deployment needs a controller
manager, which needs an API server, which needs etcd. Starting Pods from files
on local disk is the one thing a machine can do before any of that exists.

The corollary is the dangerous half. `kube-apiserver.yaml` is not a record of
the API server; it *is* the API server. A text editor on this node is enough
to stop the cluster, and no RBAC rule, admission controller or validating
webhook gets a vote, because none of them are involved.

### 2. A workload to watch while the control plane is gone

```
kubectl apply -f survivor.yaml
kubectl get pod survivor -o wide
```

An ordinary Pod on an ordinary worker. Its job is to be boring. The run
records its UID and the node it landed on, then confirms through the node's
own runtime — not through the API — that its container is up:

```
docker exec <its node> crictl ps --name survivor
```

Get used to that distinction now. For the next few minutes it is the only kind
of answer available.

### 3. Back up the manifest before touching it

```
docker exec cka-sandbox-control-plane \
  cp /etc/kubernetes/manifests/kube-apiserver.yaml /tmp/sandbox-apiserver-backup.yaml
```

This one copy is the difference between a two-minute exercise and a rebuilt
cluster, and it costs nothing. Take it before every edit to a control-plane
manifest, on real clusters too.

Note **where** it goes. `/tmp` is fine; `/etc/kubernetes/manifests/kube-apiserver.yaml.bak`
is not. The kubelet does not care about file extensions — it parses everything
in that directory, so a backup left there is not a backup, it is a second API
server Pod fighting the first one for port 6443.

### 4. Break it, one line

```
docker exec cka-sandbox-control-plane \
  sed -i 's|--secure-port=[0-9][0-9]*|--secure-port=sandbox-broken-not-a-port|' \
  /etc/kubernetes/manifests/kube-apiserver.yaml
```

`--secure-port` is an integer flag, so a non-numeric value fails while
`kube-apiserver` is still parsing its command line. The process exits before
it opens a socket, before it contacts etcd and before it writes anything
anywhere — the cheapest possible failure, and one that a single copy back
undoes completely. That is the property to optimise for whenever you are about
to break something on purpose: prefer a changed character to a deleted file.

The kubelet is watching the directory with inotify, so no restart is needed and
none is wanted. Within a few seconds it notices the file changed, computes a
new Pod spec, kills the old container and tries to start the new one.

### 5. kubectl goes dark

```
kubectl get nodes
```

```
The connection to the server 127.0.0.1:52193 was refused - did you specify the right host or port?
```

`run.sh` asserts that this command *fails*, which is the only assertion that
can be made here — and it does so inside an `if`, because `set -e` is armed and
a bare failing command would abandon the script with the cluster still broken.

Read the error properly when this happens for real, because the three common
shapes mean three different things:

- **`connection refused`** — nothing is listening on the port. The API server
  process is not running. Go to the node.
- **`TLS handshake timeout`, or a certificate error** — something *is*
  listening. The API server is probably up and the problem is a certificate, a
  proxy, or the wrong endpoint in your kubeconfig.
- **`Unauthorized` / `Forbidden`** — the API server is entirely healthy and
  answering you. This is an authentication or RBAC problem, not an outage.

Only the first of those sends you onto the node.

### 6. Diagnose from the node, where kubectl cannot help

```
docker exec cka-sandbox-control-plane crictl ps -a --name kube-apiserver
```

`crictl` speaks CRI to containerd over a local socket on the node. It has no
idea the API server exists, which is precisely why it still works. `ps -a`
includes stopped containers — without `-a` a crash-looping container is
invisible most of the time, which is the single most common reason people
conclude "there is nothing there".

```
docker exec cka-sandbox-control-plane crictl logs --tail=40 <container id>
```

```
Error: invalid argument "sandbox-broken-not-a-port" for "--secure-port" flag: ...
```

That is the same output `kubectl logs` would have shown you, fetched from the
same log file, without the API server in the path. It names the flag and the
value, which is the entire diagnosis.

```
docker exec cka-sandbox-control-plane journalctl -u kubelet --no-pager -n 20
```

The kubelet's own log is the third witness, and the one that tells you *whose*
fault the failure is. Here it shows the kubelet behaving perfectly: reading the
file, starting a container, watching it exit, backing off, and starting it
again. Nothing is broken except the YAML, and the kubelet has no way to know
that.

Meanwhile, on the worker:

```
docker exec <its node> crictl ps --name survivor
```

Still one container, still running, with no control plane in existence. That
is asserted too, because it is the most useful thing to know during a real
control-plane outage.

### 7. Restore from the backup

```
docker exec -i cka-sandbox-control-plane \
  cp /tmp/sandbox-apiserver-backup.yaml /etc/kubernetes/manifests/kube-apiserver.yaml
```

The copy is the whole repair. There is no command to run, no service to
restart and nobody to notify: the kubelet is watching the directory and will
act on the write. `run.sh` verifies the repair by comparing the restored
`--secure-port` line, and the file's size, against what it recorded before the
edit.

### 8. The cluster comes back

```
kubectl get nodes
```

Recovery is much slower than the breakage was — allow up to a few minutes.
The API server has to start, open its connection to etcd, run its own
initialisation and pass the kubelet's health probes before it will answer, and
the controller manager and scheduler then have to re-acquire their leader
leases. `run.sh` waits with a 300-second budget for the node list to come
back, for the same number of nodes to be `Ready` as before, and for the
`kube-apiserver-cka-sandbox-control-plane` mirror Pod to report `Running`.

Reading is not proof, so the last assertions are writes and identities:
creating a ConfigMap proves the API server is accepting mutations rather than
serving something cached, and the `survivor` Pod's UID and `restartCount` are
compared against the values recorded in step 2. They are unchanged. The Pod
was never recreated and its container never restarted.

Finally the backup file is deleted from the node, but only once the cluster
has been proven healthy — never before.

## What this proves

The API server is a container started from a file. `/etc/kubernetes/manifests/kube-apiserver.yaml`
on the control-plane node is the definition of record, the kubelet acts on any
edit to it within seconds, and there is no validation, no admission control and
no rollback in that path. One non-numeric port number was enough to stop the
cluster.

When `kubectl` stops answering, `kubectl` is useless for finding out why, and
so is everything built on it: no `describe`, no `logs`, no events, no
dashboards, no `kubectl top`. The investigation has to move onto the node and
down one layer, to the two tools that were never clients of the API server.
`crictl ps -a` shows what the runtime has been asked to run and what state it
ended up in; `crictl logs` on the most recent exited container gives you the
process output; `journalctl -u kubelet` gives you the kubelet's side of the
story, which is where you find out whether it is failing to *start* a container
or merely failing to *reach* the API server.

The causes are nearly always mundane and they separate cleanly by symptom. A
bad flag or a malformed value makes the process exit immediately and say why in
its logs. A bad image reference means no container is ever created, so there
are no logs at all and the kubelet journal is the only witness. A wrong etcd
endpoint or an expired certificate lets the process start and then hang or die
seconds later. Asking "did a container exist, and did it restart?" separates
those three faster than reading any one log does.

And notice what did not break. The `survivor` Pod served throughout, on a node
whose kubelet could not reach the control plane at all. Running workloads keep
running, Services keep routing, and kube-proxy keeps the rules it already
programmed. What you lose is *change*: no scheduling, no rescheduling, no
scaling, no rollouts, no new Pods when one dies, and no visibility into any of
it. Recognising that a control-plane outage is a management-plane outage is
worth real composure at three in the morning, because it means you have time to
fix it properly instead of time to make it worse.

The habit that made all of this survivable is the dull one. Copy the file
somewhere the kubelet is not watching before you touch it, and keep the edit
small enough that copying it back is a complete undo.

## See also

- Study guide → Troubleshooting
- Flashcards: `control-plane-manifests`, `apiserver-down-triage`,
  `crictl-basics`, `kubelet-journal`, `static-pod-lifecycle`
- Related: `cluster-architecture/static-pods` — the mechanism this lab abuses,
  covered properly: mirror Pods, the `config.source: file` annotation, and why
  `kubectl delete` cannot remove one
- Related: `cluster-architecture/etcd-backup` — the other file on this node
  whose loss you cannot talk your way out of
- Related: `troubleshooting/pod-failure-states` — the same diagnostic ladder
  for a broken workload, back in the world where `kubectl` works
- Kubernetes docs:
  [Troubleshooting Clusters](https://kubernetes.io/docs/tasks/debug/debug-cluster/),
  [Debugging Kubernetes nodes with crictl](https://kubernetes.io/docs/tasks/debug/debug-cluster/crictl/)
