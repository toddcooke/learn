# Node maintenance: cordon, drain, uncordon

**CKA domain:** Troubleshooting

Taking a node out of service is the most routine destructive thing an
administrator does — kernel patches, kubelet upgrades, disk swaps, machine
retirement all start the same way. Kubernetes gives you three verbs for it.
`cordon` stops new Pods from landing on a node. `drain` cordons and then
evicts what is already there. `uncordon` puts the node back in the pool. The
verbs are easy; the interesting part is everything that stands between them
and a successful maintenance window: the flags `drain` demands before it will
start, the PodDisruptionBudget that can refuse it outright, and the one class
of workload it will happily evict and then leave with nowhere to go. This lab
walks all three verbs on a real node in this cluster, and then deliberately
breaks the story by giving a Pod storage that cannot follow it.

## Run it

```
bash run.sh          # the whole walkthrough, then cleans up
KEEP=1 bash run.sh   # leaves the namespace running so you can poke at it
```

Both forms uncordon every node on the way out, including on failure and on
Ctrl-C. That is not politeness — a node left `SchedulingDisabled` produces no
error, appears nowhere in `kubectl get pods`, and silently halves the cluster
for whatever runs next.

## Walkthrough

### 1. Pick the node that is going down for maintenance

```
kubectl get nodes
```

The cluster has one control-plane node and two workers. The lab targets the
second worker, `cka-sandbox-worker2`, which means every Pod that has to move
can only move to `cka-sandbox-worker`: the control-plane node carries a
`node-role.kubernetes.io/control-plane:NoSchedule` taint and is not a
candidate for ordinary workload. Two workers is the minimum interesting
number. On a single-node cluster `drain` has nowhere to send anything and the
whole exercise degenerates into deleting Pods.

### 2. Put a stateless workload on it

```
kubectl apply -f web.yaml
kubectl get pods -l app=web -o wide
```

`web.yaml` is a four-replica Deployment of `nginx:alpine` with a soft
`topologySpreadConstraint` over `kubernetes.io/hostname`, which lands roughly
half the replicas on each worker. The constraint is `ScheduleAnyway` rather
than `DoNotSchedule` on purpose: later in the lab every replica has to fit on
one worker, and a hard spread would leave them `Pending` instead.

Each Pod also mounts an `emptyDir` at `/scratch`. Nothing important is in it —
that is the point. `kubectl drain` cannot tell the difference between scratch
space and the only copy of something, so it refuses to evict any Pod using
`emptyDir` until you tell it the data is expendable.

Then `probe.yaml` adds a bare Pod pinned to the target node with a
`nodeSelector`. It has no `ownerReferences`: no Deployment, no ReplicaSet, no
Job. Nothing in the cluster considers itself responsible for putting it back
if it goes away, and `drain` treats that as a hazard rather than a detail.

### 3. Cordon the node

```
kubectl cordon cka-sandbox-worker2
kubectl get node cka-sandbox-worker2 -o jsonpath='{.spec.unschedulable}'
kubectl get nodes
```

Cordon writes exactly one field: `.spec.unschedulable: true`. `kubectl get
nodes` renders that as `Ready,SchedulingDisabled` in the STATUS column, which
is worth reading carefully — the node is still `Ready`. Its kubelet is
healthy, its Pods are running, and it is still serving traffic. All that has
changed is the scheduler's willingness to put *new* Pods there.

A moment later a second thing appears:

```
kubectl get node cka-sandbox-worker2 -o jsonpath='{.spec.taints}'
```

The node lifecycle controller mirrors the flag as a real taint,
`node.kubernetes.io/unschedulable` with effect `NoSchedule`. That is the
mechanism behind the DaemonSet exception you may have met elsewhere: a
DaemonSet's Pods tolerate this taint, which is why they keep landing on
cordoned nodes when nothing else will.

Nothing already running is disturbed. The replicas on the node stay put, the
bare Pod stays `Running`, and the Deployment still reports four Ready
replicas. To see the other half of the claim, apply `newcomer.yaml` — the same
bare Pod, asking for the same node, created after the cordon:

```
kubectl get pod newcomer
kubectl get events --field-selector involvedObject.name=newcomer
```

It sits `Pending` with `.spec.nodeName` never set, and the scheduler says why:

```
Warning  FailedScheduling  0/3 nodes are available: 1 node(s) were unschedulable,
                           2 node(s) didn't match Pod's node affinity/selector.
```

`node(s) were unschedulable` is cordon, named. Note where the enforcement
lives: in the scheduler, not in the kubelet. A cordoned node will still run a
Pod that arrives with `.spec.nodeName` already filled in — a static Pod, or
anything created with an explicit `nodeName` — because such a Pod never goes
through the scheduler at all.

### 4. Try to drain, and let it tell you what it wants

```
kubectl drain cka-sandbox-worker2
kubectl drain cka-sandbox-worker2 --ignore-daemonsets
kubectl drain cka-sandbox-worker2 --ignore-daemonsets --delete-emptydir-data
```

All three refuse, each naming a different category of Pod it will not move on
its own authority:

```
error: unable to drain node "cka-sandbox-worker2" due to error: [
  cannot delete DaemonSet-managed Pods (use --ignore-daemonsets to ignore): kube-system/kindnet-…, kube-system/kube-proxy-…,
  cannot delete Pods with local storage (use --delete-emptydir-data to override): sandbox-node-maintenance/web-…,
  cannot delete Pods that declare no controller (use --force to override): sandbox-node-maintenance/probe]
```

Each flag means something different, and the differences matter:

- `--ignore-daemonsets` means *leave them alone*, not *evict them*. Evicting a
  DaemonSet Pod would be pointless: the DaemonSet controller ignores
  `unschedulable` and would put it straight back. A drained node keeps its CNI
  and its kube-proxy, which is exactly what you want from a node that is still
  expected to route traffic for the Pods that are still shutting down.
- `--delete-emptydir-data` means *the scratch data in these Pods is
  expendable*. An `emptyDir` lives in the Pod's directory on this node's disk
  and cannot follow the Pod anywhere. Kubernetes will not make that judgement
  for you.
- `--force` means *delete the Pods that nothing owns*. It is the flag people
  reach for most casually and understand least: it does not relocate the bare
  `probe` Pod, because there is nothing in the cluster whose job it is to
  recreate it. `--force` deletes it, permanently. The honest fix is not to
  have bare Pods on a node you intend to maintain, so this lab deletes `probe`
  deliberately rather than hiding the same outcome behind a flag.

Two things are true after all three refusals. Not a single Pod was evicted —
the checks run before any eviction does, so a rejected drain changes nothing.
And the node is nevertheless still cordoned, because `drain` cordons first and
asks questions second. That asymmetry is why `uncordon` belongs in the cleanup
path of any maintenance script rather than at the end of its happy path; this
lab's own `trap` is written that way for exactly that reason.

### 5. Add a PodDisruptionBudget with no room in it

```
kubectl apply -f pdb.yaml
kubectl get pdb web-pdb
kubectl drain cka-sandbox-worker2 --ignore-daemonsets --delete-emptydir-data --timeout=25s
```

`pdb.yaml` sets `minAvailable: 4` against a Deployment that has exactly four
replicas. The disruption controller computes
`.status.disruptionsAllowed = currentHealthy - desiredHealthy`, which settles
at `0`.

`drain` does not delete Pods; it calls the **Eviction API**, and that is what
makes a PodDisruptionBudget enforceable. Every eviction request comes back
`429 Too Many Requests`:

```
error when evicting pods/"web-…" -n "sandbox-node-maintenance" (will retry after 5s):
Cannot evict pod as it would violate the pod's disruption budget.
```

`kubectl` retries until the `--timeout` expires and then gives up, non-zero,
having achieved nothing. The short timeout is a convenience for the lab: the
default is to wait forever, which in a real maintenance window looks
indistinguishable from a hang.

Read the outcome carefully, because it is easy to blame the wrong component.
The budget did exactly what it was written to do — four replicas were required
and four stayed Ready throughout. The mistake is the budget itself: a floor
equal to the replica count leaves no room for *any* voluntary disruption, and
node drains are voluntary disruptions. A PDB written that way does not make an
app highly available; it makes it undrainable, which is to say unpatchable.

### 6. Give the budget room, and run the identical command

```
kubectl scale deploy/web --replicas=6
kubectl get pdb web-pdb
kubectl drain cka-sandbox-worker2 --ignore-daemonsets --delete-emptydir-data --timeout=300s
```

Six healthy replicas against a floor of four leaves
`.status.disruptionsAllowed: 2`, and the same drain now completes. Two details
are worth watching on the way through.

The two new replicas from the scale-up both went to the *other* worker. This
is the real reason `drain` cordons before it evicts: without that, the
ReplicaSet's replacement Pods could be scheduled straight back onto the node
you are trying to empty, and the drain would chase its own tail.

And the eviction is throttled, not batched. If more Pods need to move than the
budget allows at once, `drain` evicts what it can, waits for the replacements
to become Ready somewhere else, and comes back for the rest. That loop is the
budget doing its job during a real rolling maintenance.

Afterwards:

```
kubectl get pods -l app=web -o wide
kubectl get pods -A --field-selector spec.nodeName=cka-sandbox-worker2
```

No `web` Pod is left on the drained node and all six are on the surviving
worker. The node is not empty, though: `kindnet` and `kube-proxy` are still
there, because `--ignore-daemonsets` meant leave them.

### 7. Uncordon

```
kubectl uncordon cka-sandbox-worker2
kubectl get nodes
kubectl get pods -l app=web -o wide
```

`.spec.unschedulable` disappears — the field has `omitempty`, so an
uncordoned node carries no value at all rather than `false` — and the
`node.kubernetes.io/unschedulable` taint is withdrawn with it. The node is
back in the scheduler's pool.

Nothing moves back. All six replicas stay on the worker they were relocated
to, and the freshly returned node stays empty until something new needs
placing. A Pod's node is chosen once, at scheduling time, and written into
`.spec.nodeName`; no controller in Kubernetes revisits that decision
afterwards. There is no rebalancer in the box. If you want the cluster level
again after maintenance you have to create that pressure yourself — a rollout
restart, a scale event, or an external tool such as the descheduler.

### 8. The workload a drain cannot save

```
kubectl apply -f keeper.yaml
kubectl get pods -l app=keeper -o wide
kubectl get pv <pv-name> -o yaml
```

`keeper.yaml` is a single-replica Deployment with a PersistentVolumeClaim: the
shape people reach for the first time a workload has to keep a file. The claim
names no StorageClass, so it gets this cluster's default, `standard`, whose
provisioner is `rancher.io/local-path` — a directory on one node's disk. The
scheduler places the Pod, the provisioner then creates the volume on the node
the scheduler chose, and the resulting PersistentVolume carries a **required**
`nodeAffinity` naming that one node.

Nothing in the manifest says "this Pod can only ever run on one machine", and
nothing about the Pod looks unusual to `drain`. It has no `emptyDir`, so
`--delete-emptydir-data` has nothing to say about it. A ReplicaSet owns it, so
`--force` has nothing to say either.

```
kubectl drain <the node keeper landed on> --ignore-daemonsets --delete-emptydir-data
```

The drain succeeds. It evicts the Pod, waits for it to disappear, prints
`evicted`, and exits `0`. Then:

```
kubectl get pods -l app=keeper
kubectl get events --field-selector involvedObject.name=<new-pod>
```

The ReplicaSet's replacement Pod is `Pending`, with `.spec.nodeName` never
set, and the scheduler has run out of nodes:

```
Warning  FailedScheduling  0/3 nodes are available:
                           1 node(s) had untolerated taint {node-role.kubernetes.io/control-plane: },
                           1 node(s) were unschedulable,
                           1 node(s) didn't match PersistentVolume's node affinity.
```

(On clusters older than v1.33 the last clause reads `node(s) had volume node
affinity conflict`. The run script accepts either wording.)

The claim is still `Bound` and the file written before the drain is still on
disk. Nothing is corrupt and nothing is lost — the data is simply on a machine
the Pod is no longer allowed to run on. The drain exited `0` and the workload
is down, and nothing in the drain's output hinted at the second half of that
sentence.

This is not a bug in `drain`, and it is not a quirk of kind. It is what
node-local storage means: the volume is exactly as available as the node it
lives on. The same failure is an EBS volume in the wrong availability zone.
The fix is at the storage layer — replicated or networked volumes that more
than one node can attach — not at the drain command, and "we drain nodes
routinely" is a claim about your storage before it is a claim about your Pods.

## What this proves

`cordon` and `drain` are different operations and it pays to keep them apart.
Cordon writes one boolean, `.spec.unschedulable`, which the node lifecycle
controller mirrors as a `node.kubernetes.io/unschedulable:NoSchedule` taint.
It changes where the scheduler is willing to place new Pods and nothing else:
everything already running keeps running, and the node stays `Ready`.

Drain cordons and then evicts, and it refuses to start until you have answered
for every category of Pod it cannot move on its own: `--ignore-daemonsets` for
Pods a DaemonSet would immediately replace, `--delete-emptydir-data` for
scratch data that dies with the Pod, `--force` for bare Pods that nothing
would recreate. Those checks run before any eviction, so a refused drain moves
nothing — but it has already cordoned the node, which is why `uncordon`
belongs in a script's cleanup path rather than at the end of its happy path.

Eviction goes through the Eviction API, which is what gives a
PodDisruptionBudget teeth. `minAvailable: 4` against four replicas left zero
disruptions allowed, every eviction came back `429`, and the drain burned its
timeout for nothing. Scaling to six gave the budget two disruptions of
headroom and the identical command completed, moving Pods a couple at a time
and waiting for their replacements to come up elsewhere in between. A budget
whose floor equals the replica count is not high availability; it is a node
that can never be patched.

What a successful drain actually promises is narrow: the Pods that were on
this node are gone, and their controllers have been given the opportunity to
replace them elsewhere. It promises nothing about whether elsewhere exists.
The `keeper` Deployment was evicted cleanly, `drain` exited `0`, and the
replacement Pod has been `Pending` ever since because its PersistentVolume is
pinned to the node that was just drained. Read a drain's exit code as "the
node is empty", never as "the application is fine".

And `uncordon` restores schedulability without restoring balance. Placement is
decided once and recorded in `.spec.nodeName`, so a node that comes back from
maintenance stays idle until new Pods need placing.

## See also

- Study guide → Troubleshooting
- Flashcards: `cordon-drain-uncordon`, `pod-disruption-budget`,
  `node-pressure-conditions`, `down-node-timeline`, `kubeadm-upgrade`
- Related: `storage/storageclass` — the same node pinning approached from the
  storage side, including why `WaitForFirstConsumer` cannot rescue it
- Related: `workloads-scheduling/statefulset` — `volumeClaimTemplates`, which
  give every replica its own copy of this problem
- Related: `workloads-scheduling/daemonset` — why DaemonSet Pods ignore a
  cordon, and the toleration that makes it work
