# DaemonSet

**CKA domain:** Workloads & Scheduling

A DaemonSet is the one workload controller with no replica count. You never
tell it how many Pods to run; you tell it which nodes count, and it derives
the number from the cluster as it stands right now. That inversion is the
whole object, and it explains both of the things this lab demonstrates: why
the DaemonSet controller quietly rewrites your Pod template with tolerations
you never asked for, and why adding a single `nodeSelector` line changes the
Pod count without touching any number anywhere.

## Run it

```
bash run.sh          # the whole walkthrough, then cleans up
KEEP=1 bash run.sh   # leaves the namespace running so you can poke at it
```

## Walkthrough

### 1. The naive DaemonSet reaches only two of the three nodes

```
kubectl apply -f plain-agent.yaml
kubectl get ds plain-agent
```

`plain-agent.yaml` is the obvious way to say "run this on every node": a
DaemonSet with a Pod template and nothing else. On this three-node cluster
it reports `DESIRED 2`.

That number is worth staring at. Nothing failed. There is no error event, no
Pending Pod, no unmet condition — the DaemonSet is fully healthy at two out
of three, because two is genuinely all it ever wanted. `desiredNumberScheduled`
is not a target you set; it is the controller's count of nodes whose taints
and labels the Pod template can actually satisfy. A node the template cannot
tolerate is not a shortfall, it is simply not part of the set.

### 2. Why: a role taint the controller will not tolerate for you

```
kubectl get node cka-sandbox-control-plane -o jsonpath='{range .spec.taints[*]}{.key}{":"}{.effect}{"\n"}{end}'
```

The missing node is the control plane, and it carries
`node-role.kubernetes.io/control-plane:NoSchedule`. (kind strips that taint
only on single-node clusters, where leaving it would mean nothing could run
at all. On a multi-node cluster like this one it stays, exactly as on a real
kubeadm cluster.)

The distinction to carry forward is between two kinds of taint. Taints that
describe a node's *condition* — it is not ready, it is out of disk, it has
been cordoned — are transient facts the controller can reason about on its
own. A taint that describes a node's *role* encodes a human's policy about
what that machine is for, and no controller can infer that for you. So the
DaemonSet controller tolerates the first kind automatically and leaves the
second kind entirely to you.

### 3. One hand-written toleration, and every node gets a Pod

```
kubectl apply -f node-agent.yaml
kubectl get ds node-agent
kubectl get pods -l app=node-agent -o wide
```

`node-agent.yaml` is the same agent with one toleration added, for
`node-role.kubernetes.io/control-plane`. `DESIRED`, `CURRENT` and `READY` all
read 3, and `-o wide` shows the three Pods on three different nodes — one
each, never two on the same node. Look at the DaemonSets in `kube-system` —
kube-proxy and the CNI — and you will find they all widen their tolerations
past the automatic set, most of them with a blanket `operator: Exists` that
tolerates every taint on the cluster. This lab's one narrow toleration is the
same move, made deliberately rather than with a sledgehammer.

### 4. Six tolerations nobody typed

```
kubectl get pod <a node-agent pod> -o jsonpath='{range .spec.tolerations[*]}{.key}{":"}{.effect}{"\n"}{end}'
```

The template declared exactly one toleration. The Pod has seven:

| Key | Effect |
| --- | --- |
| `node-role.kubernetes.io/control-plane` | `NoSchedule` (ours) |
| `node.kubernetes.io/not-ready` | `NoExecute` |
| `node.kubernetes.io/unreachable` | `NoExecute` |
| `node.kubernetes.io/disk-pressure` | `NoSchedule` |
| `node.kubernetes.io/memory-pressure` | `NoSchedule` |
| `node.kubernetes.io/pid-pressure` | `NoSchedule` |
| `node.kubernetes.io/unschedulable` | `NoSchedule` |

The run script proves these came from the controller rather than from the
manifest by checking the DaemonSet's own `.spec.template.spec.tolerations`,
which still contains only the one line we wrote.

The reason they exist is a bootstrap deadlock. A CNI plugin ships as a
DaemonSet, and a node with no working pod network never reports `Ready`. If
the plugin's Pods required a Ready node, the plugin could never start on a
fresh node, and the node could therefore never become Ready — each waiting on
the other forever. Tolerating `node.kubernetes.io/not-ready` is what breaks
the cycle: the agent that makes a node usable is allowed onto the node while
it is still unusable.

`NoExecute` rather than `NoSchedule` closes the other half of the problem.
`NoSchedule` would only govern placement; `NoExecute` also governs eviction.
When a node goes unreachable, the node controller normally evicts its Pods
after a grace period, and without this toleration Kubernetes would respond to
a sick node by removing the very agent sent to diagnose and repair it. The
same logic covers the pressure conditions and `unschedulable`: a cordoned
node is still a node you want log shipping and metrics from, so `kubectl
cordon` deliberately does not drive off its daemons.

A seventh toleration, `node.kubernetes.io/network-unavailable`, is added only
to DaemonSet Pods that set `hostNetwork: true`. This lab's agent does not, so
it is absent — which is exactly why `node-agent.yaml` leaves `hostNetwork`
off and says so in a comment.

### 5. DaemonSet Pods still go through the normal scheduler

```
kubectl get pod <a node-agent pod> -o jsonpath='{.spec.affinity.nodeAffinity}'
```

Early Kubernetes had the DaemonSet controller write `.spec.nodeName` directly
and bypass the scheduler entirely. It no longer does. The controller instead
stamps each Pod with a required `nodeAffinity` term matching `metadata.name`
against one specific node, and the ordinary scheduler binds it.

This is not trivia — it is the mechanism behind everything above. Because a
DaemonSet Pod goes through the scheduler like any other Pod, it is subject to
taints, resource fit, and priority preemption like any other Pod. That is why
a taint could exclude the control-plane node in step 1, and why the automatic
tolerations are needed at all. A controller that wrote `nodeName` itself would
never have needed to tolerate anything.

### 6. A nodeSelector redefines what "every node" means

```
kubectl patch ds node-agent --type merge \
  -p '{"spec":{"template":{"spec":{"nodeSelector":{"kubernetes.io/hostname":"cka-sandbox-worker"}}}}}'
kubectl get ds node-agent
```

`kubernetes.io/hostname` is a label the kubelet sets on itself, so it exists
on every node without anyone creating it, and its value is unique per node —
which makes it the standard way to pin a workload to one specific machine.

`DESIRED` drops from 3 to 1, and the two Pods on the other nodes are deleted.
No replica count was edited, because there is no replica count. Narrowing the
selector narrowed the set of matching nodes, and the desired count is just
the size of that set. Widen it again, label another node, or join a new node
to the cluster, and the count climbs back on its own — which is the property
that makes DaemonSets the right tool for per-node infrastructure and the
wrong tool for anything you want a fixed number of.

## What this proves

A DaemonSet's Pod count is an output, not an input. It is derived from the
current membership of a set of nodes, so it changes when the cluster changes,
with no edit and no rollout on your part.

The tolerations the controller adds for free all name node *conditions*, and
they exist to make node-level agents survive exactly the situations that
would evict ordinary workloads: a node that is not Ready yet, one that has
gone unreachable, one under resource pressure, one you have cordoned. Without
them a CNI plugin could not bootstrap the network on a node that cannot become
Ready until the network exists.

What the controller will not do is tolerate a *role* taint on your behalf.
That is the trap the `plain-agent` step exists to show, and its failure mode
is silence rather than an error: a log shipper or metrics agent that appears
perfectly healthy while running nowhere near the control plane, which is
usually the node you most wanted covered.

## See also

- Study guide → Workloads and Scheduling
- Flashcards: `daemonset`, `daemonset-tolerations`, `taints-tolerations`, `node-affinity`
- Next: `statefulset` — the controller that adds identity and ordering instead
