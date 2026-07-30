# PriorityClass and preemption

**CKA domain:** Workloads & Scheduling

Every Pod carries an integer priority, and that integer does two quite different
jobs. It decides the order in which the scheduler looks at Pods, and it decides
who may be thrown off a full node to make room for whom. The second job is
preemption, and it is the one people either forget exists or assume is automatic.
This lab fills a real worker node with low-priority Pods, then submits a
high-priority Pod that cannot possibly fit, and watches the scheduler delete
running work to place it. It then runs the identical Pod at the identical
priority with `preemptionPolicy: Never` to show that the eviction was a policy
decision, not a consequence of the number.

## Run it

```
bash run.sh          # the whole walkthrough, then cleans up
KEEP=1 bash run.sh   # leaves the namespace running so you can poke at it
```

It takes two to three minutes, most of it spent waiting for evicted Pods to
finish terminating.

Two things about this lab are unusual and worth knowing before you start.

The PriorityClasses it creates are **cluster-scoped**. `kubectl delete
namespace` does not touch them, so `run.sh` installs its own `trap` that removes
all three and then calls the shared `ns_teardown`, on the failure path as well
as the success path. Their names are prefixed `sandbox-priorityclass-` so they
cannot collide with anything real. Under `KEEP=1` they are left behind
deliberately, and the script prints the command to delete them.

The manifests `filler.yaml`, `urgent.yaml` and `patient.yaml` are **templates**,
not directly appliable files. They contain `__NODE__`, `__CPU_LOW__` and
`__CPU_HIGH__`, which `run.sh` substitutes at run time. The reason is explained
in step 2: a hardcoded CPU request cannot fill a node whose size you do not know.

## Walkthrough

### 1. Three PriorityClasses, differing in exactly one field

```
kubectl apply -f priorityclasses.yaml
kubectl get priorityclass
```

Notice there is no namespace on that command, and no `-n` would help: a
PriorityClass is a cluster-scoped object, like a StorageClass or a ClusterRole.
Two fields matter.

`value` is a signed 32-bit integer, and it is the only thing the scheduler
compares. `sandbox-priorityclass-low` is 1000 and both high classes are
1000000. The numbers have no units and no inherent meaning; only their ordering
does. Values above 1000000000 are reserved for the system classes
(`system-cluster-critical`, `system-node-critical`), which is why a normal
workload should stay well below that.

`preemptionPolicy` decides what a Pod of the class may do when it does not fit.
`sandbox-priorityclass-high` leaves it unset, and the run asserts that the API
server defaulted it to `PreemptLowerPriority`. `sandbox-priorityclass-high-nopreempt`
sets it to `Never`. Those two classes are otherwise identical, right down to the
value, which is what makes the comparison later in the lab a controlled one.

`globalDefault` is false everywhere here, and the run asserts it. A class with
`globalDefault: true` supplies the priority for every Pod in the cluster that
names no class at all — a single object that silently reprices every unlabelled
workload. Only one PriorityClass may hold that flag, and a sandbox lab has no
business being the one that does.

The step ends by trying to change a value in place:

```
kubectl patch priorityclass sandbox-priorityclass-low --type merge -p '{"value":2000}'
# The PriorityClass "sandbox-priorityclass-low" is invalid: value: Forbidden:
# may not be changed in an update.
```

`value` and `preemptionPolicy` are immutable. Repricing a class means deleting
and recreating it, and Pods already admitted keep the priority they were given —
`.spec.priority` is a copy, resolved once at admission, not a live reference.

### 2. Size the experiment against a node that really exists

```
kubectl get nodes -l '!node-role.kubernetes.io/control-plane'
kubectl get node <worker> -o jsonpath='{.status.allocatable.cpu}'
```

Preemption only happens on a node with nothing left to give, so the lab has to
genuinely fill one — and how much CPU that takes is a property of your machine,
not of this repository. A kind node is a container, and it reports the host's CPU
count as allocatable, so the same hardcoded `700m` that saturates a two-core
laptop leaves a sixteen-core workstation three-quarters empty. A lab that
hardcodes it does not fail loudly; it quietly schedules everything, preempts
nothing, and asserts nothing.

So `run.sh` measures instead. It reads `.status.allocatable.cpu` from one worker
and subtracts the CPU **requests** of every Pod already on it — requests, not
usage, because that is the arithmetic the scheduler does. Whatever is left it
divides up:

- the low-priority Deployment gets six replicas of 75% ÷ 6 of the free CPU each,
  so the six together claim three-quarters of what was available;
- the high-priority Pod asks for four of those shares, which is half the node's
  free CPU.

Those proportions are chosen so that two conditions hold on any node size. Half
the free CPU is more than the quarter left over, so the high-priority Pod cannot
fit alongside the fillers. And half the free CPU is comfortably less than all of
it, so evicting some fillers *would* make it fit. The second condition is not
decoration: the scheduler preempts only when preemption would actually make the
Pod schedulable. A Pod too large for the empty node evicts nobody and simply
stays Pending.

Everything is also pinned to that one worker with a `nodeSelector`. That is what
turns "the cluster is full" into a fact this lab controls exactly, and it is what
makes an evicted replica stay visibly Pending instead of quietly reappearing on
the other worker.

### 3. Fill the node with low-priority Pods

```
kubectl get deploy filler
kubectl get pods -l app=filler -o wide
kubectl get pod <filler-pod> -o jsonpath='{.spec.priority}'
```

Six replicas, all Ready, all on the one node. The interesting read is
`.spec.priority`: the Pod template only ever said
`priorityClassName: sandbox-priorityclass-low`, and the Priority admission
plugin looked the class up and wrote the integer `1000` into the Pod spec. From
here on the scheduler never consults the PriorityClass again — deleting the
class would not change these Pods at all.

The filler container is `busybox` running `sleep 3600`, and that choice is load
bearing. `sleep` installs no SIGTERM handler, and a process with no handler that
is PID 1 of its namespace never receives the signal at all, so each filler takes
its full `terminationGracePeriodSeconds` to die. In production that is the bug
behind "why does my Pod take 30 seconds to delete". Here it usefully slows the
eviction down enough to watch it happen in step 5.

### 4. High priority, `preemptionPolicy: Never` — it waits

```
kubectl apply -f patient.yaml     # after templating
kubectl get pod patient -o jsonpath='{.spec.priority}'
kubectl get events --field-selector involvedObject.name=patient
```

`patient` has priority 1000000, a thousand times the fillers', and asks for more
CPU than the node has left. It stays Pending, and the `FailedScheduling` event
says why in two parts:

```
0/3 nodes are available: 1 Insufficient cpu, 2 node(s) didn't match Pod's node
affinity/selector. preemption: not eligible due to preemptionPolicy=Never.
```

The first half is the ordinary filter failure. The second half is the scheduler's
`PostFilter` stage — the stage that would normally go looking for victims —
declining to run at all. The run asserts both strings, and then asserts the thing
that actually matters: all six filler Pods are still Ready, and there is not a
single event with reason `Preempted` anywhere in the namespace. High priority by
itself evicted nobody.

### 5. Same priority, default policy — it preempts

```
kubectl apply -f urgent.yaml      # after templating
kubectl get pod urgent -o jsonpath='{.status.nominatedNodeName}'
kubectl get pod urgent -o jsonpath='{.status.phase}'
kubectl get events --field-selector reason=Preempted
kubectl get pods -o wide
```

`urgent` is byte-for-byte `patient` with one word changed: it names
`sandbox-priorityclass-high` instead of the `Never` class. Same node, same CPU
request, same image, same priority value. This time the scheduler finds a set of
lower-priority Pods whose removal would let it fit, deletes them, and the Pod
that could not be scheduled a moment ago reaches Running.

Watch `.status.nominatedNodeName` while that happens. When the scheduler decides
to preempt on a node, it writes that node's name into the preemptor's status
before the victims have finished terminating. That is a reservation: while
scheduling any other Pod, the scheduler counts nominated Pods of equal or higher
priority as though they were already placed. It is the reason the ReplicaSet's
replacement Pods — created the instant their predecessors got a deletion
timestamp — cannot slip into the space being cleared for `urgent`. Without it,
preemption would be a lottery the preemptor frequently lost.

Three things are asserted at the end of this step. `urgent` reaches Running on
the node it preempted. The victims carry events with reason `Preempted`. And at
least one low-priority Pod is now Pending: the ReplicaSet immediately recreated
what was evicted, and because everything is pinned to the full node, the
replacements have nowhere to go. The scheduler evicts the minimum it needs, so
expect two or three of the six rather than all of them.

Note also what does *not* happen. Those Pending fillers sit behind `urgent`
indefinitely and never displace it. Preemption only ever runs downhill.

### 6. Room that frees up on its own goes to the non-preempting Pod

```
kubectl scale deploy/filler --replicas=2
kubectl apply -f patient.yaml     # after templating
kubectl delete pod urgent
kubectl get pod patient -o jsonpath='{.status.phase}'
```

The Deployment is scaled down so nothing is left queued, `patient` is recreated
while the node is still full — it goes Pending exactly as before — and then
`urgent` is deleted. Capacity is released with no eviction anywhere, and
`patient` is scheduled onto the node it had been waiting for. The run asserts
that the count of `Preempted` events did not move and that the surviving
low-priority Pods are untouched.

That is the whole bargain of `preemptionPolicy: Never`. You keep the queue
position — the Pod is still priority 1000000 and the scheduler still looks at it
before anything at 1000 — but you give up the right to take room by force. It is
the right setting for a batch job that should jump the line without discarding
work already in flight.

One honest caveat, straight from the upstream documentation: non-preempting Pods
are subject to the same scheduling back-off as everything else. A Pod that has
failed to schedule many times is retried less often, so a lower-priority Pod can
in practice be scheduled ahead of a waiting non-preempting one. The queue
ordering is a strong preference, not a guarantee of arrival order. This step
removes the competing Pods before releasing the capacity precisely so that it
tests the policy rather than that race.

## What this proves

Priority is a plain integer that admission copies out of a PriorityClass and
freezes into `.spec.priority`. It buys queue position, and by itself it buys
nothing else. Whether a Pod may evict running work to fit is governed by a
different field entirely — `preemptionPolicy` on the class — and this lab
demonstrates that by running the same Pod, the same size, on the same full node,
at the same priority value, under both settings: one made room and one waited.

Preemption is also narrower than it sounds. It runs strictly downward, so
lower-priority Pods queued behind a preemptor can never push it off. It runs only
when it would actually help, so a Pod too big for the node even when emptied
evicts nobody. And it is transactional in a small but important way: the
preemptor claims the node through `.status.nominatedNodeName` for as long as its
victims take to drain, which is what stops the replacement Pods from taking the
space back.

The operational edges are worth carrying away too. A PriorityClass is
cluster-scoped, so it survives the deletion of the namespace whose workloads use
it — this lab needs a custom `trap` for exactly that reason, and the same trap
is what keeps a failed run from poisoning the next lab. `value` and
`preemptionPolicy` are immutable, so changing a class means delete and recreate,
and Pods already admitted keep the number they were admitted with. And
`globalDefault: true` is a cluster-wide switch that reprices every Pod naming no
class at all, which makes it the single most consequential field on the object
and the one to look at first when priorities in a cluster are not what you
expect.

## See also

- Study guide → Workloads and Scheduling
- Flashcards: `priorityclass`, `pod-priority`, `preemption`, `preemption-policy`,
  `nominated-node-name`
- Related: `daemonset` — the other lab where node-level scheduling constraints,
  not replica counts, decide where Pods land
- Related: `pod` — where `.spec.priority` ends up, and the restart semantics an
  evicted Pod goes through on its way out
