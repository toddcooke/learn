# Resource Requests, Limits and QoS Classes

**CKA domain:** Workloads & Scheduling

A request and a limit look like two halves of one setting, and they are not.
A request is a claim made against the scheduler before the Pod exists anywhere:
it decides which node the Pod fits on, and it is subtracted from that node's
allocatable capacity whether or not the container ever touches the memory. A
limit is a ceiling imposed by the kernel on the container once it is running.
The ratio between the two also decides a third thing nobody writes down — the
Pod's quality-of-service class, which is what the kubelet consults when a node
runs short and something has to go. This lab builds Pods in each of the three
classes, reads the class back off the API, and then puts one container over its
CPU limit and another over its memory limit to watch the kernel respond in two
completely different ways.

## Run it

```
bash run.sh          # the whole walkthrough, then cleans up
KEEP=1 bash run.sh   # leaves the namespace running so you can poke at it
```

Note that `KEEP=1` leaves a container spinning on the CPU and another
crash-looping on memory. Delete the namespace when you have finished reading.

## Walkthrough

### 1. Three Pods that differ only in their resources block

```
kubectl apply -f qos-classes.yaml
kubectl get pods -o custom-columns=NAME:.metadata.name,QOS:.status.qosClass
```

`qos-classes.yaml` declares three Pods running the same `pause` container. The
image does nothing at all — it exists so that the only interesting difference
between the three objects is the `resources` block. The column that comes back
is `.status.qosClass`, and no manifest set it. Kubernetes computes the class
from the numbers in `.spec` when the Pod is admitted, and the field is read-only
afterwards — you cannot patch a Pod into a better class, you can only rewrite
its resources and create a new one.

### 2. Guaranteed

```
kubectl get pod guaranteed -o jsonpath='{.status.qosClass}'
kubectl describe pod guaranteed | grep -A1 'QoS Class'
```

The `guaranteed` Pod sets four numbers: a CPU request and limit of `100m` each,
and a memory request and limit of `64Mi` each. That is the whole bar, and it is
stricter than it first sounds — *every* container in the Pod must set a request
and a limit for *both* CPU and memory, and each request must equal its limit.
Miss one number on one container in a five-container Pod and the entire Pod is
Burstable.

The payoff is predictability. A Guaranteed Pod's request equals its limit, so it
can never be above its request, which means it is never a candidate for
eviction under node memory pressure until the situation is dire enough that
Kubernetes is out of lower-priority options.

### 3. Burstable

```
kubectl get pod burstable -o jsonpath='{.status.qosClass}'
```

The `burstable` Pod requests `50m`/`32Mi` and permits `200m`/`128Mi`. It is
Burstable for the plain reason that it does not clear the Guaranteed bar while
still asking for something. The interesting part is the gap: the scheduler only
ever reserved `50m` and `32Mi` for it, and the other `150m` and `96Mi` are
available only when the node happens to have them free.

That gap is also the eviction rule. When a node comes under memory pressure the
kubelet ranks Burstable Pods by how far above their *requests* they have
climbed, and evicts the greediest first. A Burstable Pod sitting quietly below
its request is in much the same position as a Guaranteed one; a Burstable Pod
that has bloated to four times its request is the first non-BestEffort thing to
go.

### 4. BestEffort

```
kubectl get pod besteffort -o jsonpath='{.status.qosClass}'
kubectl get pod besteffort -o jsonpath='{.spec.containers[0].resources}'
```

The `besteffort` Pod has no `resources` block at all, and the second command
confirms that nothing was defaulted into it. BestEffort is not a setting you
choose; it is what remains when you choose nothing, which is why so much
unlabelled production workload is quietly in this class. One request on one
container would have promoted the whole Pod to Burstable.

The consequence is that the scheduler treats these Pods as free — it will pack
them onto a node it believes is already full, because they claimed no capacity —
and the kubelet evicts them first when that belief turns out to be optimistic.

### 5. Limits with no requests

```
kubectl apply -f limits-only.yaml
kubectl get pod limits-only -o jsonpath='{.spec.containers[0].resources}'
kubectl get pod limits-only -o jsonpath='{.status.qosClass}'
```

`limits-only.yaml` sets a CPU limit and a memory limit and no requests at all,
which looks like a textbook Burstable Pod. Read the stored object back and a
CPU request of `100m` and a memory request of `64Mi` are sitting there. If you
specify a limit for a resource but no request, and no admission-time mechanism
such as a `LimitRange` has already supplied one, Kubernetes copies the limit
into the request. Requests therefore equal limits for both resources, and the
Pod is Guaranteed.

This is worth internalising in both directions. It is the easiest way to write a
Guaranteed Pod, and it is also a common surprise: a team that sets generous
limits "just as a safety net" has silently reserved the full limit on a node for
the lifetime of every replica, and wonders why the cluster will not schedule
anything else.

### 6. A CPU limit throttles

```
kubectl apply -f cpu-throttled.yaml
kubectl exec cpu-throttled -- cat /sys/fs/cgroup/cpu.stat
```

`cpu-throttled.yaml` runs `while true; do :; done` — a loop that never blocks
and would happily consume an entire core — under a CPU limit of `200m`. The
kernel gives its cgroup 20 milliseconds of CPU out of every 100 millisecond
period and then freezes it until the period rolls over. `cpu.stat` records this
directly: `nr_throttled` counts the periods that ended with the cgroup frozen,
and `throttled_usec` totals the time it spent waiting. Both climb continuously,
and the run script asserts that `nr_throttled` is above zero.

Nothing is killed. The container is over its limit permanently, by design, and
it will still be running tomorrow. A CPU limit is a rate limit, and a process
denied a rate is simply a process made to wait.

(If your container runtime does not expose `/sys/fs/cgroup` inside the
container, the script says so and skips the counter — the behavioural check in
step 8 does not depend on it.)

### 7. A memory limit kills

```
kubectl apply -f oom.yaml
kubectl get pod oom-hog -o jsonpath='{.status.containerStatuses[0].lastState.terminated}'
kubectl logs oom-hog --previous
kubectl describe pod oom-hog
```

`oom.yaml` gives a `busybox` container a memory limit of `32Mi` and then asks
it for far more, twice over: first by writing a 64 MiB file into the Pod's
tmpfs at `/dev/shm`, then by doubling a shell variable until the process is
holding tens of megabytes of anonymous memory. Both are genuine allocations —
tmpfs pages are charged to the memory cgroup of whichever process wrote them,
exactly as a memory-backed `emptyDir` is, which is the usual reason a volume
someone described as "just a cache" starts killing containers.

Whichever mechanism crosses the line first, the ending is the same. The kernel
tries to reclaim memory from the cgroup, finds nothing reclaimable — a kind node
has no swap, so anonymous and tmpfs pages have nowhere to go — and invokes the
cgroup OOM killer. The container is `SIGKILL`ed, and the status records it:

```
lastState:
  terminated:
    reason: OOMKilled
    exitCode: 137
```

`137` is `128 + 9`: the shell convention for "terminated by signal 9", which is
`SIGKILL`. Reading it off `lastState` rather than `state` matters — `restartPolicy`
is `Always`, so by the time you look the kubelet has already started a
replacement container, and the kill you care about has moved into the *last*
state. `kubectl logs --previous` reaches the same dead container's output.

Because the replacement dies the same way, the Pod settles into
`CrashLoopBackOff`. Note what the Pod is *not*: it is not `Failed`, and its
phase is not `Error`. The Pod object is perfectly healthy; it is the container
inside that keeps being killed. That is why the triage move for a restarting
Pod is to read the Last State block, not the phase.

### 8. The contrast, side by side

```
kubectl get pods -o custom-columns=NAME:.metadata.name,QOS:.status.qosClass,RESTARTS:.status.containerStatuses[0].restartCount,LASTSTATE:.status.containerStatuses[0].lastState.terminated.reason
```

Two containers have now spent the whole lab over their limits. `cpu-throttled`
is still `Running` with a `restartCount` of `0`. `oom-hog` has been killed
several times over and carries `OOMKilled` in its last state. The script asserts
both.

The asymmetry is not a Kubernetes design decision; it follows from what the two
resources are. CPU is a rate, and you can always take a rate away from a process
by making it wait. Memory is an allocation the process is already holding, and
the only way to take it back is to destroy the process that holds it. So a CPU
limit that is set too low produces a latency mystery, and a memory limit that is
set too low produces exit code 137.

One practical consequence: many teams deliberately set memory requests equal to
memory limits (so the workload is never surprised) while setting CPU requests
well below CPU limits or omitting CPU limits entirely (so idle capacity is
usable and a busy neighbour cannot introduce artificial latency). The two knobs
do not deserve symmetric treatment.

## What this proves

The QoS class is derived, never declared. Set a request and a limit for CPU and
for memory on every container, with each pair equal, and the Pod is Guaranteed.
Set some subset of that and it is Burstable. Set nothing and it is BestEffort.
That ordering is the eviction order under node pressure: BestEffort first,
Guaranteed last. Because a limit with no request is defaulted to a request equal
to the limit, it is possible to land in Guaranteed without meaning to — and to
reserve a great deal of node capacity in the process.

Requests and limits are enforced by different components at different times. The
scheduler enforces requests, once, by placement. The kernel enforces limits,
continuously, on the running container: CPU by throttling, which slows the
container and never kills it, and memory by the OOM killer, which kills the
container and never slows it. `reason: OOMKilled` with `exitCode: 137` in
`lastState.terminated` is the fingerprint of the second, and with the default
`restartPolicy` it presents as `CrashLoopBackOff` from the outside.

## See also

- Study guide → Workloads and Scheduling
- Flashcards: `resource-requests`, `resource-limits`, `qos-classes`,
  `oomkilled-diagnosis`, `limitrange`
- Related: `pod` — the object all of these numbers hang off
- Related: `limitrange` and `resourcequota` — how a namespace default gets
  injected before the kubelet ever computes a QoS class
