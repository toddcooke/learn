# Logs

**CKA domain:** Troubleshooting

`kubectl logs` looks like a black box that produces text, and treated that way
it produces the wrong text surprisingly often — the sidecar's output instead of
the app's, the restarted instance instead of the one that crashed, ten lines
instead of the ten thousand you needed. It is not a black box. A container
writes to stdout, the runtime captures the stream into a file on the node, and
`kubectl logs` is a bounded read of that file. This lab builds Pods whose output
is predictable enough to check the flags against exact numbers, then goes onto
the node to look at the files those flags were reading, and finishes with the
one case where the whole mechanism is the answer to a different question: why
the API server's output is nowhere to be found in `journalctl -u kubelet`.

## Run it

```
bash run.sh          # the whole walkthrough, then cleans up
KEEP=1 bash run.sh   # leaves the namespace running so you can poke at it
```

The lab creates nothing outside its own namespace. It reads `/var/log/pods`,
`systemctl` and `crictl` on the nodes through `docker exec`, but every one of
those is a read, so deleting the namespace is a complete cleanup.

## Walkthrough

### 1. Three workloads that talk

```
kubectl apply -f talker.yaml
kubectl apply -f crasher.yaml
kubectl apply -f fleet.yaml
```

`talker` is a two-container Pod: `alpha` prints exactly 50 lines and stops,
`beta` prints one line per second and keeps going. `crasher` prints why it is
about to fail and exits 1, which under the default `restartPolicy: Always` puts
it in a crash loop. `fleet` is a three-replica Deployment whose Pods each stamp
their own name into their output.

Note what none of them do: write a log file. They write to stdout, and that is
the only logging interface Kubernetes has. A container that writes to
`/var/log/app.log` inside its own filesystem is invisible to every command
below — which is why the convention exists, and why "just log to a file" is a
real portability problem rather than a style preference.

`talker` and `crasher` are pinned to `cka-sandbox-worker` with a `nodeSelector`
solely so that step 7 knows which node's disk to go and read.

### 2. `-c` chooses the container, and leaving it off chooses one for you

```
kubectl logs talker -c alpha
kubectl logs talker -c beta
kubectl logs talker --all-containers=true --prefix --tail=2
kubectl logs talker
```

`-c alpha` returns alpha's 50 lines and not one line of beta's, and `-c beta`
the reverse. That separation is not a filter applied to a merged stream: each
container's output is a different file on the node, so `-c` is choosing which
file to open. `--all-containers=true` opens both, and `--prefix` is what makes
the result legible once more than one source is involved.

The last command is the interesting one. `talker` has two containers and no
`-c`, and what you get is:

```
Defaulted container "alpha" out of: alpha, beta
ALPHA line 50
```

Before v1.24 this was a hard error — `a container name must be specified for
pod talker, choose one of: [alpha beta]`. Now it is a warning on **stderr** and
kubectl reads the first container anyway. That is friendlier and considerably
more dangerous: pipe the output somewhere, or skim past one grey line, and you
can spend a long time reading a sidecar's logs while wondering why the
application never mentions the error you are chasing. Where the choice matters,
make it explicit with `-c`, or set the
`kubectl.kubernetes.io/default-container` annotation on the Pod template so
that `logs`, `exec` and `attach` all default to the container you meant.

### 3. `--tail` bounds the output from the newest end

```
kubectl logs talker -c alpha --tail=5
kubectl logs talker -c alpha --tail=1
kubectl logs talker -c alpha --tail=1 --timestamps
```

`alpha` wrote exactly 50 lines, so `--tail=5 | wc -l` is exactly 5 — the lab
asserts that number rather than eyeballing it. `--tail` counts from the end,
which is why `--tail=1` returns `ALPHA line 50` and not `ALPHA line 1`. The
default is "everything" for a single Pod, but only 10 once you use a selector,
which is a default worth remembering before you conclude that a Deployment is
suspiciously quiet.

`--timestamps` prepends the RFC3339 time to each line:

```
2026-07-30T18:22:03.148215711Z ALPHA line 50
```

That timestamp is not the application's. It is the moment the container runtime
read the line off the stream, recorded when the line was captured, which makes
it usable for correlation even when the application's own log format has no
clock in it at all.

### 4. `--since` bounds it by time instead

```
kubectl logs talker -c beta --since=10s
```

`beta` emits one line a second forever, so by the time this step runs its first
tick is long stale. `--since=10s` returns the last ten or so ticks and drops
`BETA tick 1 of 3600` entirely — the lab asserts both halves of that, plus the
fact that a one-per-second stream cannot possibly return more than about ten
lines for a ten-second window.

The window is evaluated by the kubelet against the **node's** clock, not your
laptop's, so `--since` is immune to client-side clock skew. When you need an
absolute boundary rather than a relative one — correlating against an alert
that fired at a known instant — use `--since-time` with an RFC3339 stamp. Only
one of the two may be used at a time.

### 5. `--previous` reads the instance that already died

```
kubectl get pod crasher
kubectl logs crasher --previous
```

`crasher` is in `CrashLoopBackOff` with a `restartCount` above zero and a
`lastState.terminated.exitCode` of 1. Plain `kubectl logs crasher` is a
question about the instance running (or waiting to run) right now, which has
not reached the interesting part yet. `--previous` asks the kubelet for its
predecessor, and there is the explanation:

```
CRASH-MARKER: opening /etc/app/config.yaml
CRASH-MARKER: no such file - giving up
```

This is the single most useful flag on the command, because the shape of the
problem — the process that can explain itself is already gone — is exactly the
shape of most container failures.

It has a precondition, which the lab also proves by triggering it:

```
kubectl logs talker -c alpha --previous
Error from server (BadRequest): previous terminated container "alpha" in pod "talker" not found
```

`--previous` is served from `.status.containerStatuses[].lastState.terminated`,
and that field is only populated once a second instance exists to have a
predecessor. So this error does not mean "the logs were lost"; it means "this
container has never restarted", which is itself a diagnosis worth having. (Logs
genuinely can be lost here too — the kubelet garbage-collects dead containers,
and their log files go with them — but the message above is the common case.)

### 6. `-l` reads across every Pod that matches a selector

```
kubectl logs -l app=fleet --prefix --tail=1
```

One command, three Pods, output merged and labelled with `[pod/<name>/<container>]`.
This is how you stop guessing which of a Deployment's replicas is the broken
one. Two defaults come with it: `--tail` becomes 10 rather than unlimited when
a selector is present, and `--max-log-requests` caps concurrent follows at 5 if
you add `-f`.

The near miss is `kubectl logs deploy/fleet`, which resolves the Deployment down
to a *single* Pod and reads that. It is useful when any replica will do and
misleading when it will not. `-l` is the one that fans out.

### 7. The files behind `kubectl logs`

```
docker exec cka-sandbox-worker ls -A /var/log/pods
docker exec cka-sandbox-worker ls -A /var/log/pods/sandbox-logs_talker_<uid>
docker exec cka-sandbox-worker ls -A /var/log/pods/sandbox-logs_talker_<uid>/alpha
docker exec cka-sandbox-worker head -1 /var/log/pods/sandbox-logs_talker_<uid>/alpha/0.log
```

The layout is completely regular:

```
/var/log/pods/<namespace>_<pod>_<uid>/<container>/<restart-count>.log
```

One directory per Pod, one subdirectory per container, one file per instance —
so `alpha` has `0.log` and the crash-looper has a numbered file for each of its
lives. That numbering *is* `--previous`: instance N writes `N.log`, and
`--previous` is the kubelet handing you the file one number down.

The first line of `alpha/0.log` shows the CRI logging format:

```
2026-07-30T18:22:01.912441002Z stdout F ALPHA line 1
```

Four fields: an RFC3339Nano timestamp, the stream (`stdout` or `stderr`), a tag
(`F` for a full line, `P` for a partial one the runtime had to split), and the
message. `--timestamps` is reading field one; the stdout/stderr distinction
kubectl does not expose is right there in field two.

`/var/log/containers` holds a flat directory of symlinks into that tree, one per
container, named `<pod>_<namespace>_<container>-<id>.log`. It exists because
node-level logging agents are much easier to write against a flat directory
than against a nested one, and tailing it is what a logging DaemonSet does.

Working out that these are just files also answers "how does `kubectl logs`
work?": kubectl calls the API server, the API server proxies to the kubelet on
the node, and the kubelet reads the file. Three hops, all of which have to be
healthy — which is why `kubectl logs` failing is sometimes a network or
certificate problem rather than anything to do with the Pod.

### 8. Rotation is why only the current file is retrievable

```
kubectl get --raw /api/v1/nodes/cka-sandbox-worker/proxy/configz
```

The kubelet rotates each container's log file. `containerLogMaxSize` (default
`10Mi`) caps one file and `containerLogMaxFiles` (default `5`) caps how many
are kept per container; the lab reads both back out of the kubelet's live
configuration where that endpoint is reachable.

The consequence is the part people get wrong. **Only the current, unrotated
file is available through `kubectl logs`.** A Pod that has written 40MiB gives
you at most the most recent 10MiB, and the rotated siblings sitting on disk
half a centimetre away are unreachable through the API. There is no flag that
widens this — `--since=24h` on a chatty container returns whatever happens to
still be in the current file and silently tells you nothing about the rest.

And the harder limit: delete the Pod and every one of those files is deleted
with it. `kubectl logs` is a live-debugging tool, not a log store. That gap —
not fashion — is the reason clusters run a node-level logging agent that ships
output somewhere durable before rotation or deletion reaches it.

### 9. Why `journalctl -u kubelet` never shows you the API server

```
docker exec cka-sandbox-control-plane systemctl list-units --type=service --all
docker exec cka-sandbox-control-plane crictl ps
kubectl -n kube-system logs kube-apiserver-cka-sandbox-control-plane --tail=5
docker exec cka-sandbox-control-plane crictl logs --tail=3 <container-id>
```

The unit list on the control-plane node contains `kubelet.service` and
`containerd.service` and **no** `kube-apiserver` unit — so
`journalctl -u kube-apiserver` was never going to find anything, and
`journalctl -u kubelet` shows you the kubelet, which is a different program.

kubeadm runs the API server, scheduler, controller-manager and etcd as static
Pods. Their processes are containers started by the same runtime as everything
else, so their output is an ordinary container log: `crictl ps` lists a
`kube-apiserver` container, `/var/log/pods` on that node contains a
`kube-system_kube-apiserver-…` directory in exactly the layout of step 7, and
`kubectl -n kube-system logs kube-apiserver-…` reads it like any other Pod's
logs. Even `-l` works, because kubeadm labels the manifest
`component: kube-apiserver`.

Which leaves the case that matters. When `kubectl` itself is timing out,
`kubectl logs` times out with it — you cannot ask the API server why the API
server is down. So you get onto the control-plane node and use the runtime
directly: `crictl ps -a` to see whether the container is running or
crash-looping, `crictl logs <id>` for its output, or read the file under
`/var/log/pods` yourself. `journalctl -u kubelet` is still valuable there, but
for a different question: if a static Pod manifest is malformed, no container
is ever created, so there is no container log to read and the kubelet's own
journal is the only place the parse error appears.

## What this proves

A container log is a file. The container writes to stdout, the runtime captures
the stream into
`/var/log/pods/<ns>_<pod>_<uid>/<container>/<n>.log` in CRI format, and
`kubectl logs` is the API server proxying a bounded read of that file from the
kubelet. Every flag in this lab is a question about *which* file and *how much*
of it: `-c` and `--all-containers` pick the container's directory, `--previous`
steps back one restart number, `--tail` and `--since` bound the read, and `-l`
fans the same read out across every Pod matching a selector.

Two of those solve real incidents. `--previous` is how you read a crash
looper's explanation, because the instance that could explain itself is already
dead and the live one has not got there yet. `-l` is how you stop opening
twelve terminals to find the one bad replica. And one is a trap: on a
multi-container Pod, `kubectl logs` no longer refuses to guess — it warns on
stderr and reads the first container, so it is entirely possible to debug a
sidecar for ten minutes by accident.

The limits matter as much as the flags. Rotation means only the current file is
reachable, so a chatty Pod's history is already gone; deleting the Pod deletes
everything. That is the argument for shipping logs off the node, stated as a
mechanism rather than a best practice.

And the control plane is not a special case. Because kubeadm runs it as static
Pods, `kube-apiserver`'s output is a container log like any other: read it with
`kubectl -n kube-system logs` while the cluster is healthy, and with `crictl
logs` or straight off `/var/log/pods` when it is not. `journalctl` is the right
tool only for the two things that genuinely are host services — the kubelet and
the container runtime — and the kubelet's journal is specifically where to look
when a component never became a container at all.

## See also

- Study guide → Troubleshooting
- Flashcards: `container-logs`, `container-log-rotation`,
  `component-log-locations`, `debug-apiserver-down`
- Related: `cluster-architecture/static-pods` — why the control plane is four
  files on a disk, and what a mirror Pod is
- Related: `troubleshooting/pod-failure-states` — reading the status fields that
  tell you *which* log to go and ask for
