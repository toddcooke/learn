# Scheduling

**CKA domain:** Workloads & Scheduling

Every placement decision the scheduler makes is the same two-phase computation:
filter the nodes down to those where the Pod may run, then score the survivors
and pick the best. Everything in this lab is one rule or the other. A taint
filters from the node's side, a `nodeSelector` or a required node affinity
filters from the Pod's side, pod anti-affinity filters on where other Pods
already are, and a topology spread constraint filters on how evenly they are
distributed — while a *preferred* affinity never filters at all and only moves
a node up the scoreboard. Getting the four straight is mostly a matter of
knowing which of them can leave a Pod `Pending` forever, and this lab shows two
that can.

## Run it

```
bash run.sh          # the whole walkthrough, then cleans up
KEEP=1 bash run.sh   # leaves the namespace running so you can poke at it
```

Unlike most labs here, this one writes to the cluster's nodes: a `NoSchedule`
taint on `cka-sandbox-worker2` and four labels across the two workers. `run.sh`
removes all of it on the way out — when an assertion fails as well as when
everything passes, and under `KEEP=1` too, since a kept namespace is a debugging
aid but a kept taint would silently strand Pods in every lab that ran
afterwards.

## Walkthrough

### 1. Label the two workers, and taint one of them

```
kubectl label node cka-sandbox-worker  sandbox-scheduling-disk=ssd sandbox-scheduling-zone=alpha
kubectl label node cka-sandbox-worker2 sandbox-scheduling-disk=hdd sandbox-scheduling-zone=beta
kubectl taint node cka-sandbox-worker2 sandbox-scheduling=demo:NoSchedule
```

A taint is three fields — a key, an optional value, and an effect — and this
one reads `sandbox-scheduling=demo:NoSchedule`. `NoSchedule` is the effect that
matters most in practice: it refuses new Pods that do not tolerate it and does
nothing to Pods already running. `PreferNoSchedule` is the soft version, a
scoring penalty rather than a veto. `NoExecute` is the hard version, which also
evicts running Pods that lack a matching toleration.

The control-plane node gets neither label and no new taint. It already carries
`node-role.kubernetes.io/control-plane:NoSchedule` from kubeadm, which is why
nothing in this lab ever lands there, and its lack of the labels turns out to
matter in step 8.

### 2. A Pod with no toleration for that taint never schedules

```
kubectl apply -f reserved-app.yaml
kubectl get pod reserved-app
kubectl get events --field-selector involvedObject.name=reserved-app
```

`reserved-app` is pinned to `cka-sandbox-worker2` with a
`kubernetes.io/hostname` nodeSelector and declares no tolerations, so the one
node it is allowed to use is the one node that repels it. It sits in `Pending`
with an empty `.spec.nodeName` and an event like:

```
FailedScheduling  0/3 nodes are available: 1 node(s) had untolerated taint
{sandbox-scheduling: demo}, 2 node(s) didn't match Pod's node affinity/selector.
```

Two things about that state are worth internalising. First, `Pending` is not a
failure the cluster will ever give up on or escalate: nothing restarts, nothing
times out, and the Pod will still be there tomorrow. The `FailedScheduling`
event is the only evidence, and events expire after an hour — which is why
`kubectl describe pod` is the first command to reach for on a Pod that is not
running. Second, the taint alone would not have caused this. Delete the
`nodeSelector` and the Pod schedules happily onto the other worker; a taint on
one node can only strand a Pod that has nowhere else to go.

### 3. Adding the toleration schedules it, without recreating the Pod

```
kubectl patch pod reserved-app --type json -p \
  '[{"op":"add","path":"/spec/tolerations/-","value":{"key":"sandbox-scheduling","operator":"Equal","value":"demo","effect":"NoSchedule"}}]'
```

A Pod is very nearly immutable once created. On the ordinary update path the API
server accepts changes to `spec.containers[*].image`,
`spec.initContainers[*].image`, `spec.activeDeadlineSeconds` and
`spec.tolerations` — and tolerations only by *addition*; modifying or deleting an
existing one is rejected. (Container CPU and memory can also be changed on a
running Pod as of the in-place resize feature, stable in v1.35, but that goes
through a separate `resize` subresource rather than a plain update.) That is why the
patch above appends to the list with a JSON patch rather than replacing it with
a merge patch. Replacing would drop the two tolerations the
`DefaultTolerationSeconds` admission plugin adds to every Pod in a kubeadm
cluster (`node.kubernetes.io/not-ready` and `node.kubernetes.io/unreachable`,
each for 300 seconds), and dropping them is exactly what validation forbids.

The scheduler notices the Pod update, requeues it, and this time the taint check
passes: the Pod moves to `Running` on `cka-sandbox-worker2` with no recreation
and no new name.

Then read the result carefully, because it is the single most common
misconception about taints. The toleration did not *send* the Pod to the tainted
node. A toleration is permission, not attraction: it withdraws the node's
objection and nothing more. The `nodeSelector` is what chose the node. Had the
Pod carried the toleration alone, it would have been free to run anywhere in the
cluster — which is precisely why the "dedicated node" pattern always needs both
halves, a taint to keep everyone else off and a selector or affinity to draw the
intended workload on.

### 4. Remove the taint

```
kubectl taint node cka-sandbox-worker2 sandbox-scheduling=demo:NoSchedule-
```

The trailing dash is the removal form, and it is the same syntax `kubectl label`
uses to delete a label. `reserved-app` keeps running: a `NoSchedule` taint is
evaluated once, at scheduling time, so both adding and removing it are invisible
to Pods that are already placed. The rest of the lab needs two schedulable
nodes.

### 5. nodeSelector: exact equality on a node label

```
kubectl apply -f node-selector.yaml
kubectl get pod selector-pod -o wide
```

`nodeSelector` is a map on the Pod spec, and a node qualifies only if it carries
every one of those labels with exactly those values. `selector-pod` asks for
`sandbox-scheduling-disk: ssd` and therefore lands on `cka-sandbox-worker`, the
only node labelled that way. It is the oldest placement mechanism in Kubernetes
and still the right one when the rule really is a single exact match — but it
cannot express "either of these", "anything but this", or "prefer this".

### 6. nodeAffinity: the same idea with set operators, plus a soft flavour

```
kubectl apply -f node-affinity.yaml
kubectl get pod affinity-pod -o wide
kubectl get pod soft-pod -o wide
```

Node affinity reads the same node labels with a richer grammar. `affinity-pod`
uses `operator: In` with `values: ["ssd", "hdd"]`, which accepts either worker —
something a `nodeSelector` cannot say at all, since two map entries are ANDed
and no node here has both disk values. The other operators are `NotIn`,
`Exists`, `DoesNotExist`, `Gt` and `Lt`. Within one `nodeSelectorTerm` the
`matchExpressions` are ANDed; separate terms in `nodeSelectorTerms` are ORed.

The field names are long but they parse cleanly into two halves.
`requiredDuringScheduling` means the scheduler will not place the Pod where the
expression does not match. `IgnoredDuringExecution` means that once the Pod is
running, relabelling the node underneath it changes nothing — no eviction, no
rescheduling. Kubernetes has never shipped the `RequiredDuringExecution`
variant, so every affinity rule you will meet is ignored during execution, and
the only mechanism that moves a running Pod off a node it no longer belongs on
is a `NoExecute` taint.

`soft-pod` is the contrast: a
`preferredDuringSchedulingIgnoredDuringExecution` term, weight 100, asking for
`disk in (nvme)` — a label no node in this cluster has. It runs anyway. A
preference is not a filter; it only adds weight when ranking the nodes that
already survived the filters, and when nothing matches, every candidate scores
the same and the preference costs nothing. That asymmetry is the practical rule
of thumb: a required rule can strand a Pod forever, a preferred rule never can.

### 7. Pod anti-affinity spreads a Deployment across distinct nodes

```
kubectl apply -f anti-affinity.yaml
kubectl get pods -l app=anti-web -o wide
kubectl scale deploy/anti-web --replicas=3
```

Pod affinity and anti-affinity are the only placement rules that read the labels
of *other Pods* rather than of nodes. `anti-web` says "do not place me in a
topology domain that already holds a Pod labelled `app=anti-web`", with
`topologyKey: kubernetes.io/hostname`. That key is what defines a domain: every
node has a unique hostname label, so each node is its own domain and the rule
means one replica per node. Swap in `topology.kubernetes.io/zone` and the same
rule spreads across availability zones instead, tolerating several replicas per
node.

Two replicas therefore land on two distinct nodes, which the run script checks
by collecting `.spec.nodeName` from both Pods and counting the unique values.

Scaling to three shows the cost of expressing this as a prohibition. There are
only two usable domains — the control-plane node is still tainted — so the third
Pod has nowhere legal to go and stays `Pending` with a `FailedScheduling` event
naming the anti-affinity rule. It will never schedule, no matter how idle the
cluster is. Required anti-affinity hard-caps a workload's replica count at the
number of domains, and that is a real operational trap when a node goes away for
maintenance.

One more thing worth knowing before reaching for these in anger: inter-pod
affinity is expensive to evaluate, because every candidate node must be checked
against the Pods already running everywhere else. On large clusters that shows
up in scheduling latency, and it is the main reason topology spread constraints
exist.

### 8. topologySpreadConstraints: balance rather than prohibition

```
kubectl apply -f topology-spread.yaml
kubectl get pods -l app=spread-web -o wide
kubectl scale deploy/spread-web --replicas=5
```

A spread constraint states a tolerated imbalance instead of a flat ban. *Skew*
is the difference between the number of matching Pods in one domain and the
global minimum across all eligible domains, and `maxSkew: 1` with
`whenUnsatisfiable: DoNotSchedule` tells the scheduler to reject any node whose
selection would push the skew past 1.

With four replicas over the two labelled zones the outcome is forced: 2 and 2. A
3/1 split would be a skew of 2, so the filter eliminates every node that would
produce it. This is not the scheduler being tidy — it is arithmetic, and the run
script asserts the exact per-node counts rather than merely counting distinct
nodes.

The `topologyKey` here is `sandbox-scheduling-zone`, a label on the two workers
and *not* on the control-plane node. A node that lacks the topology key is
bypassed entirely: it forms no domain, its Pods do not enter the skew
calculation, and the incoming Pod cannot be placed there. That is why this
manifest never mentions the control-plane taint — the node was already out of
scope. It is also the classic misconfiguration, since a typo in the label key
silently makes *every* node ineligible and every replica Pending.

Scaling to five is the punchline. The fifth Pod makes one zone hold 3 against
the other's 2, a skew of exactly 1, which is inside the budget — so it schedules,
where the fifth `anti-web` replica could not. A prohibition caps you at the
number of domains; a skew budget lets a workload grow past it while still
refusing a lopsided placement.

Two related knobs are worth remembering even though this lab does not exercise
them. `nodeTaintsPolicy` and `nodeAffinityPolicy` control whether nodes your Pod
could never use are still counted as domains — the taints policy defaults to
`Ignore`, so by default a tainted node you cannot tolerate *does* count, which
surprises people. And `minDomains` sets a floor on the number of domains the
global minimum is computed over, so a workload cannot satisfy a spread
constraint by hiding in a single zone.

## What this proves

Placement rules come from two directions and neither implies the other. A taint
belongs to the node and says who may not come; a toleration is the Pod's answer
to that objection and nothing more. Selectors and affinities belong to the Pod
and say where it wants to go. `reserved-app` needed both — the toleration alone
would have left it free to run anywhere, and the nodeSelector alone left it
`Pending` forever — which is the shape of every "dedicated node" setup you will
build.

Within the Pod's own rules the axis that matters is hard versus soft.
`nodeSelector` and `requiredDuringSchedulingIgnoredDuringExecution` remove nodes
from the candidate list, and when the list empties, the Pod waits indefinitely
with a single `FailedScheduling` event as the only evidence.
`preferredDuringSchedulingIgnoredDuringExecution` only reorders the nodes that
already passed, so `soft-pod` asked for hardware that does not exist in this
cluster and ran regardless.

Anti-affinity and topology spread both spread replicas out, and they are not
interchangeable. Required anti-affinity forbids two Pods from sharing a domain,
which caps the replica count at the number of domains — the third `anti-web`
replica has nowhere to go and never will. A spread constraint declares how much
imbalance is acceptable, so `spread-web` reached five replicas across two
domains while still refusing a 4/1 split.

And `IgnoredDuringExecution` runs through all of it. Every rule here is enforced
once, when the Pod is bound to a node. Relabel a node afterwards, or remove a
`NoSchedule` taint, and nothing already running moves. Only a `NoExecute` taint
acts on Pods that are already placed.

## See also

- Study guide → Workloads and Scheduling
- Flashcards: `taints-tolerations`, `node-affinity`, `pod-affinity-anti-affinity`,
  `kube-scheduler`
- Next: `priorityclass` — what happens when the scheduler is allowed to evict
  something to make room
