# Pod Failure States

**CKA domain:** Troubleshooting

Almost every workload problem you will be handed arrives the same way: a Pod
that is not running, and a one-word status. The word is a starting point and
not an answer, because the same word covers several unrelated causes and
because the actual explanation lives in a different place for each one. This
lab breaks four Pods in four unrelated ways — an impossible resource request,
an image tag that was never published, a process that exits non-zero, and a
container that allocates past its memory limit — and works each one through
the same three commands: `kubectl get pod` for the state, `kubectl describe
pod` for the Events, and `kubectl logs --previous` for a container that has
already died.

## Run it

```
bash run.sh          # the whole walkthrough, then cleans up
KEEP=1 bash run.sh   # leaves the namespace running so you can poke at it
```

Under `KEEP=1` two of these Pods go on crashing and restarting for as long as
the namespace exists. Delete the namespace when you have finished reading.

## Walkthrough

### 1. Four Pods, broken four different ways

```
kubectl apply -f pending-unschedulable.yaml
kubectl apply -f image-pull-failure.yaml
kubectl apply -f crashloop.yaml
kubectl apply -f oomkilled.yaml
```

All four are applied at once, both because it is how a bad morning actually
looks and because it lets four independent failure clocks run concurrently.
Every one of these manifests is valid YAML and every one is accepted by the
API server. That is worth sitting with for a moment: admission checked the
shape of the object, not whether the workload could ever run. A Pod existing
is not a Pod working, and the gap between the two is where this whole domain
lives.

### 2. The first read: `kubectl get pod`, for the state

```
kubectl get pods -o wide
```

The `STATUS` column is a summary that `kubectl` assembles, and it is not the
Pod's phase. When a container is sitting in `.state.waiting`, the printer shows
you the waiting reason instead — which is why `ImagePullBackOff` and
`CrashLoopBackOff` appear in this column even though neither is a value
`.status.phase` can ever hold. The five phases are `Pending`, `Running`,
`Succeeded`, `Failed` and `Unknown`, and nothing else.

Take the state as a way of narrowing the search rather than ending it. It tells
you roughly which component is stuck, and that decides where to look next.

### 3. `Pending` — the scheduler never found a node

```
kubectl get pod pending-hog -o jsonpath='{.spec.nodeName}'
kubectl describe pod pending-hog
```

`pending-hog` requests 1000 CPUs, which no node in any sandbox cluster is going
to have. Three fields on the Pod agree that it is stuck: `.spec.nodeName` is
empty, the `PodScheduled` condition is `False` with reason `Unschedulable`, and
`.status.containerStatuses` is absent altogether — that array is written by a
kubelet, and no kubelet has ever heard of this Pod.

What none of those fields tell you is *why*. For that you need the Events, and
`kubectl describe` is where they are:

```
Warning  FailedScheduling  ...  0/3 nodes are available: 1 node(s) had untolerated
taint {node-role.kubernetes.io/control-plane: }, 2 Insufficient cpu.
```

`Insufficient cpu` is the scheduler naming the predicate that rejected every
node. Read that line carefully in a real incident, because the same
`FailedScheduling` event covers untolerated taints, unsatisfiable affinity
rules, unbound PersistentVolumeClaims and node selectors that match nothing;
the count-by-reason breakdown in the message is the diagnosis.

`kubectl logs pending-hog` is worth running precisely because of how it
behaves: it **succeeds, and prints nothing**. No error, exit status zero, empty
output.

That is a trap worth internalising, because silence reads like an answer. Empty
output here does not mean your app started and logged nothing — it means no
container ever existed to log. Contrast it with the `ImagePullBackOff` Pod in
the next section, where a container *does* exist but has not started: there
`kubectl logs` fails loudly with `container "..." is waiting to start: image
can't be pulled`.

So the two silences are different diagnoses. Empty-and-successful means the Pod
was never scheduled; an error means it was scheduled and the container has not
started yet. Either way the failure happened before any of your code ran, and
`describe` is where the reason lives.

Note also that `Pending` is not an error condition and nothing about it times
out. The scheduler will retry this Pod indefinitely, because a cluster that
grew a large enough node tomorrow would place it. A Pod spec is very nearly
immutable, so the repair is to re-create the Pod with a request the cluster can
satisfy, or to add capacity. (In-place resource resize became stable in v1.35,
but it is reached through a separate subresource — `kubectl patch
--subresource=resize` — and it addresses containers that are already running.)

### 4. `ImagePullBackOff` — scheduled, but the image does not exist

```
kubectl get pod image-pull-fail -o jsonpath='{.spec.nodeName}'
kubectl describe pod image-pull-fail
```

`image-pull-fail` asks for `agnhost:2.53-does-not-exist`. The repository is
real and the registry answers; the tag was simply never published, which is the
shape of most genuine `ImagePullBackOff` incidents — a typo, or a tag that CI
was supposed to build and did not.

The single field that separates this from the previous case is
`.spec.nodeName`, which here holds a real node. Scheduling succeeded. The
kubelet on that node is the component that is stuck, and its Events say so:

```
Warning  Failed   ...  Failed to pull image "...": ... not found
Normal   BackOff  ...  Back-off pulling image "..."
```

The kubelet cycles between `ErrImagePull` on each attempt and
`ImagePullBackOff` while it waits out an exponentially growing timer, so the
reason you see depends on when you looked. Both mean the same thing.

Two details are worth pinning down. First, the Pod's phase is still `Pending`,
not `Running` — a Pod whose container has never started has not started.
Second, `.lastState` is empty, because there was never a container to
terminate. `kubectl logs` refuses accordingly, with `container "app" in pod
"image-pull-fail" is waiting to start: trying and failing to pull image`.

### 5. `CrashLoopBackOff` — it starts, and then exits 1

```
kubectl get pod crashloop -o jsonpath='{.status.phase}'
kubectl logs crashloop --previous
```

`crashloop` runs a container that prints a startup line, complains that its
config file is missing, and exits 1 — the commonest crash there is.

The first surprise is that the Pod's phase is `Running`. A container waiting to
be restarted counts, to the kubelet's phase calculation, as stopped-and-
restarting, and with `restartPolicy: Always` that is a running Pod. So
`CrashLoopBackOff` is not a phase at all; it is the kubelet telling you it is
waiting out a backoff timer before trying again.

The evidence is in `.status.containerStatuses[0].lastState.terminated`, which
here reads `reason: Error, exitCode: 1`. Reason `Error` means the process chose
its own exit status, which in turn means it probably explained itself first —
and that explanation is in the log of a container that no longer exists:

```
kubectl logs crashloop --previous
FATAL: config file /etc/app/config.yaml not found
```

`--previous` is the whole point. Without it, `kubectl logs` serves the current
instance when one is running and falls back to the last terminated one only
while the Pod is sitting in backoff, so whether you get the crash you care
about depends on when you happened to type the command. With `--previous` you
ask for the dead instance by name.

Finally, resist the urge to wait for a particular restart count. The backoff
doubles — ten seconds, twenty, forty, up to a five-minute ceiling — so a Pod
that has been looping since last night restarts only rarely. Read the state and
the last termination instead.

### 6. `OOMKilled` — the kernel killed it at its memory limit

```
kubectl get pod oom-victim \
  -o jsonpath='{.status.containerStatuses[0].lastState.terminated}'
kubectl describe pod oom-victim
```

`oom-victim` carries a 64Mi memory limit and a container that deliberately
allocates well past it. Nothing here exits by choice. The container is killed
from outside by the kernel's cgroup OOM killer, and two fields record that:

```
Last State:  Terminated
  Reason:    OOMKilled
  Exit Code: 137
```

137 is 128 + 9, the conventional encoding of "killed by signal 9", and in
practice it is the tell for memory. The reason a memory limit kills where a CPU
limit merely throttles is that CPU is a rate — a process denied CPU is just a
process made to wait — while memory is an allocation the process already holds.
On a node without swap there is nowhere to move those pages, so the kernel
cannot reclaim its way out of the overage and killing is the only move left.

Then comes the part that matters most for triage: give it a minute and
`oom-victim` lands in `CrashLoopBackOff` too, exactly like the previous Pod.
`restartPolicy: Always` turns *every* repeating failure into
`CrashLoopBackOff` eventually, whatever caused it. The outward state is the
same; `lastState.terminated` is where the two cases separate.

### 7. The whole triage on one screen

```
kubectl get pods -o custom-columns='NAME:.metadata.name,PHASE:.status.phase,WAITING:.status.containerStatuses[0].state.waiting.reason,LAST:.status.containerStatuses[0].lastState.terminated.reason,EXIT:.status.containerStatuses[0].lastState.terminated.exitCode,RESTARTS:.status.containerStatuses[0].restartCount'
```

Four rows, and a different column carries the signal in each. Phase alone would
have said `Pending, Pending, Running, Running`, which is nearly useless. The
waiting reason identifies the two Pods the kubelet is retrying; the last
termination reason and exit code separate the two that are crashing; and
`.spec.nodeName`, not shown here, is what separates the scheduler's problem
from the kubelet's.

### 8. Confirming a diagnosis by fixing it

```
kubectl set image pod/image-pull-fail app=registry.k8s.io/e2e-test-images/agnhost:2.53
kubectl wait --for=condition=Ready pod/image-pull-fail --timeout=180s
```

A triage is only right if the fix works. The container image is one of the very
few fields the API server will accept an update to on a live Pod, so this one
can be repaired in place: point the tag at a manifest that exists and the
kubelet pulls it and starts the container. The image-pull backoff is keyed on
the image name, so changing the image clears it rather than waiting it out.
`restartCount` stays at 0 throughout, because nothing ever crashed here — it
simply never started.

The other three cannot be patched like this. `crashloop` needs a different
command, and `command` and `args` are immutable on a live Pod, so it has to be
deleted and re-applied. `pending-hog` needs a smaller request or a bigger
cluster. In production none of these would be bare Pods, and each of those
edits would be a Deployment rollout that replaces the Pod for you.

## What this proves

Four Pods failed for four unrelated reasons, and every one of them was
diagnosed with the same three commands in the same order.

`kubectl get pod` gives the state, and the state's job is to tell you which
component is stuck. `Pending` means no kubelet has the Pod yet, and
`.spec.nodeName` confirms whether the scheduler is the one holding it.
`ImagePullBackOff` and `CrashLoopBackOff` both mean a kubelet has it and is
retrying; what separates them is whether a container ever ran.

`kubectl describe pod` gives the Events, and for anything that failed before
the container started, the Events are the only account of why. The scheduler's
`FailedScheduling` naming `Insufficient cpu` and the kubelet's `Failed to pull
image` exist nowhere else in the API. They also expire — Events default to a
one-hour retention — so a Pod nobody looked at this morning may have lost its
own explanation by lunchtime.

`kubectl logs --previous` gives the output of the container that already died,
which is precisely the container whose output you need. Plain `kubectl logs`
races the kubelet's next restart. `--previous` does not. And when `logs` has
nothing at all to offer, that is itself the clearest signal in the workflow:
the failure happened before your code did, and the answer is in `describe`.

Above all, `CrashLoopBackOff` is a symptom and never a cause. Both crashing
Pods here end up wearing it. The cause is in `lastState.terminated`: exit code
1 with reason `Error` is a process that decided to quit and probably logged
why, while exit code 137 with reason `OOMKilled` is a process that was killed
mid-sentence and never got the chance.

## See also

- Study guide → Troubleshooting
- Flashcards: `pod-pending-triage`, `crashloop-vs-imagepull`,
  `oomkilled-diagnosis`, `container-logs`, `pod-stuck-terminating`
- Related: `workloads-scheduling/resources-qos` — why a memory limit kills and a
  CPU limit only throttles, and how requests and limits produce a QoS class
- Related: `workloads-scheduling/scheduling` — the other things a
  `FailedScheduling` event can mean: taints, affinity, topology spread
- Related: `workloads-scheduling/probes` — a Pod that is `Running` and still not
  serving, which none of the states here cover
- Kubernetes docs: [Debug Pods](https://kubernetes.io/docs/tasks/debug/debug-application/debug-pods/),
  [Determine the Reason for Pod Failure](https://kubernetes.io/docs/tasks/debug/debug-application/determine-reason-pod-failure/)
