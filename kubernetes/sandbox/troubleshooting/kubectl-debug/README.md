# kubectl debug

**CKA domain:** Troubleshooting

`kubectl exec` can only run a program that is already inside the container's
image, so the moment a service ships as a distroless or `FROM scratch` image
there is nothing to exec into and the usual first move fails. `kubectl debug`
answers that in two quite different ways that happen to share a verb: for a Pod
it adds an *ephemeral container* — a whole new container, with its own image,
injected into the Pod that is already running — and for a Node it creates an
ordinary Pod wired into the host's namespaces with the machine's disk at
`/host`. This lab does both, and pays close attention to what each one leaves
behind.

## Run it

```
bash run.sh          # the whole walkthrough, then cleans up
KEEP=1 bash run.sh   # leaves the namespace running so you can poke at it
```

## Walkthrough

### 1. A Pod you cannot exec into

```
kubectl apply -f distroless.yaml
kubectl exec distroless -c app -- sh -c 'echo hello'
kubectl exec distroless -c app -- ls /
```

`distroless.yaml` runs `registry.k8s.io/pause:3.10`, an image built `FROM
scratch` whose entire contents are the single binary `/pause`. Both execs fail
with something like `exec: "sh": executable file not found in $PATH`.

It is worth being precise about why. `kubectl exec` asks the kubelet to start a
new process *inside the container's existing filesystem*. That filesystem has
no shell, no `ls`, no `cat`, and no `/bin` — so there is no program to start.
No flag fixes this, and neither does `kubectl cp`, which needs `tar` in the
image for the same reason.

### 2. kubectl debug adds an ephemeral container

```
kubectl debug -it pod/distroless --image=busybox:1.36 -- sh
```

That is the form you would type at a terminal. The lab uses the
non-interactive equivalent, because a script has no TTY:

```
kubectl debug pod/distroless --image=busybox:1.36 -c shell --profile=general \
  --attach=false --stdin=false --tty=false \
  -- sh -c 'hostname; ls /; ps; echo SHELL-OK'
kubectl logs distroless -c shell
```

`-c shell` names the container so the logs are easy to find; without it kubectl
invents a name like `debugger-4x9tq` and tells you what it chose. `hostname`
prints `distroless`, because the new container is genuinely inside the Pod and
shares its network namespace. `ls /` prints busybox's filesystem — the tools
come from the debug image, not from the application's.

`--profile=general` is already the default, but naming it keeps the behaviour
from drifting under you. The profile is what decides how much power the debug
container gets; for an ephemeral container `general` adds exactly one thing,
the `SYS_PTRACE` capability.

### 3. What changed on the Pod, and what did not

```
kubectl get pod distroless
kubectl get pod distroless -o jsonpath='{.metadata.uid}{"\n"}'
kubectl get pod distroless -o jsonpath='{.spec.ephemeralContainers[*].name}{"\n"}'
```

The Pod's `uid`, its `startTime`, the app container's image and its
`restartCount` are all exactly what they were before, and `kubectl get` still
reports `READY 1/1` because an ephemeral container is not counted towards
readiness. The debug container is not in `.spec.containers` at all; it lives in
a separate list, `.spec.ephemeralContainers`.

That is the whole appeal. You are debugging the instance that actually broke,
not a fresh replica that may refuse to reproduce the fault.

### 4. Without `--target`, the debug shell sees no processes

The `ps` from step 2 lists only its own shell. Containers in a Pod share a
network namespace and the Pod's volumes, but by default each one gets its own
PID namespace — so the shell was inside the Pod and still could not see the
process it had been sent to look at.

### 5. `--target` joins the target container's process namespace

```
kubectl debug pod/distroless --image=busybox:1.36 -c inspector --target=app \
  --attach=false -- sh -c 'ps'
kubectl logs distroless -c inspector
```

Now `ps` shows `/pause` as PID 1. The field this sets on the Pod is
`targetContainerName`, and it is a request passed down to the container
runtime rather than something the kubelet can emulate. containerd — what kind
runs — honours it. A runtime that does not will either refuse to start the
ephemeral container or start it with an isolated namespace anyway, which is why
the documentation calls the flag runtime-dependent. If `ps` comes back empty on
a cluster you do not control, suspect the runtime before you suspect yourself.

### 6. The same trick gets you the target's filesystem

```
kubectl debug pod/distroless --image=busybox:1.36 -c rootfs --target=app \
  --attach=false -- sh -c 'ls /proc/1/root/'
kubectl logs distroless -c rootfs
```

The two containers do *not* share a mount namespace, so `/host`-style tricks do
not apply — but `/proc/<pid>/root` is the kernel's view of that process's
filesystem root, and once you are in the same PID namespace you can walk it.
The listing shows the `pause` binary. On a real distroless service this is how
you read the config file it was started with, or the log it wrote before it
wedged, using tools the image does not contain.

### 7. You cannot add one by writing the Pod

```
kubectl patch pod distroless --type=strategic \
  -p '{"spec":{"ephemeralContainers":[{"name":"sneaky","image":"busybox:1.36"}]}}'
kubectl get pod distroless -o jsonpath='{.spec.ephemeralContainers[*].name}{"\n"}'
```

The list is unchanged afterwards. Ephemeral containers are written through a
dedicated `ephemeralcontainers` subresource, not through the Pod resource, which
is why `kubectl edit` and `kubectl apply` cannot add one either.

The rule runs the other way too, and this is the part that surprises people:
once added, an ephemeral container may not be changed and may not be removed.
Every `kubectl debug` you run against a Pod is a permanent entry in that Pod's
spec for the rest of its life. Naming them (`-c`) is therefore worth the extra
typing, and running six of them on a production Pod is worth a second thought.

### 8. `kubectl debug node/` is a Pod, not an ephemeral container

```
kubectl debug node/cka-sandbox-worker --image=busybox:1.36 \
  --attach=false -- sh -c 'ls /host/etc'
```

kubectl announces what it made: `Creating debugging pod
node-debugger-cka-sandbox-worker-pdx84 with container debugger on node
cka-sandbox-worker.` Inspect that Pod and the mechanism is entirely different
from the first half of this lab:

- `.spec.nodeName` is already filled in, so the scheduler is never consulted;
- there is a blanket `operator: Exists` toleration, so a cordoned or fully
  tainted node still gets its debugger;
- `hostNetwork`, `hostPID` and `hostIPC` are all `true`;
- a `hostPath` volume named `host-root` maps the node's `/` to `/host`, which is
  why every node path you know gains a prefix — `/var/log/pods` becomes
  `/host/var/log/pods`, `/etc/kubernetes` becomes `/host/etc/kubernetes`;
- `restartPolicy: Never`, so it runs your command once and then sits there as a
  `Completed` Pod.

Bypassing the scheduler is what makes it useful on a broken node. It is not
magic, though: something has to run the Pod, so a node whose kubelet is dead is
still an SSH job, and `kubectl describe node` from the API side is all you get.

### 9. `chroot /host` needs `--profile=sysadmin`

```
kubectl debug node/cka-sandbox-worker --image=busybox:1.36 --profile=sysadmin \
  --attach=false -- sh -c 'chroot /host /bin/sh -c "cat /etc/os-release"'
```

Host namespaces plus a mount of `/` are not the same thing as root on the box.
Under the default `general` profile the debug container is explicitly *not*
privileged, and the Kubernetes documentation is blunt that `chroot /host` will
fail there. `--profile=sysadmin` sets `privileged: true`, and then the chroot
succeeds and you are reading the node's own `/etc/os-release` rather than
busybox's.

That combination — privileged, plus the host's namespaces, plus the whole disk
at `/host` — is root on the machine. It is a good thing to know for the exam and
a good thing to be careful with everywhere else, because it is also the reason
"can create Pods on a node" is very nearly "is an administrator of that node".

### 10. Cleaning up

```
kubectl delete pod node-debugger-cka-sandbox-worker-pdx84 --now
```

Nothing collects a node debugger Pod. It is an ordinary Pod, created in
whatever namespace your context happens to point at — `default`, for most
people, which is exactly where nobody looks. `run.sh` deletes the ones it
created from a trap that fires on the failure path too, and it does so even
under `KEEP=1`, because a Pod loose in someone else's namespace is litter
rather than a debugging aid. The ephemeral containers need no cleanup for the
opposite reason: they cannot be removed at all, and they go when the Pod does.

## What this proves

`kubectl exec` runs a program that is already in the image; `kubectl debug`
brings its own. For a Pod that means an ephemeral container: a new container
with a new image, added to the running Pod without rebuilding it, restarting
it, or changing anything the application can observe. The Pod's `uid`,
`startTime`, image and `restartCount` all survive untouched, which is precisely
why it beats "redeploy it with a debug image and hope it breaks again".

Three details decide whether it actually helps. `--target=<container>` is what
joins the target's process namespace, without which `ps` sees nothing and
`/proc/1/root` is your own filesystem — and it depends on the container runtime,
not on Kubernetes. `--profile` decides what the debug container is allowed to
do, defaulting to `general`. And the `ephemeralcontainers` subresource is the
only way in: `kubectl edit` cannot add one, and nothing at all can remove one,
so every debug container is permanent for the life of the Pod.

`kubectl debug node/<node>` shares the verb and nothing else. It writes an
ordinary Pod with `.spec.nodeName` preset, a blanket toleration, the host's
network, PID and IPC namespaces, and the node's root filesystem at `/host` —
close enough to an SSH session to diagnose a sick node, provided the kubelet is
healthy enough to start a Pod at all. Unprivileged by default, `--profile=sysadmin`
when you need `chroot /host`, and yours to delete afterwards.

## See also

- Study guide → Troubleshooting
- Flashcards: `ephemeral-containers`, `node-debugging`, `container-logs`
- Related: `troubleshooting/logs` — reading logs from crashed and previous
  containers, and where they live on the node
- Related: `troubleshooting/pod-failure-states` — what to reach for when the Pod
  never started in the first place, where `kubectl debug` has nothing to attach to
- Related: `cluster-architecture/etcd-backup` — the same distroless problem seen
  from the other side: etcd's image has no shell either, so `kubectl exec ... -- sh -c`
  fails there too
