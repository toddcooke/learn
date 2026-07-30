#!/usr/bin/env bash
LAB="daemonset"
source "$(dirname "$0")/../../cluster/lib.sh"
require_cluster
ns_setup

# Everything this lab creates is a DaemonSet inside $NS, so ns_teardown is
# enough. Node labels and taints are only ever read here, never written —
# a lab that taints or labels a node and dies mid-run poisons every lab
# scheduled after it.

step "The naive DaemonSet reaches only two of the three nodes"
apply plain-agent.yaml
assert_eventually 60 "2" "desiredNumberScheduled settled at 2, not 3" \
  k -n "$NS" get ds plain-agent -o jsonpath='{.status.desiredNumberScheduled}'
# Wait for the Pods to be placed before reading nodeName, or the check below
# would pass against an empty string and prove nothing.
assert_eventually 120 "2" "currentNumberScheduled caught up at 2" \
  k -n "$NS" get ds plain-agent -o jsonpath='{.status.currentNumberScheduled}'
run k -n "$NS" get ds plain-agent

CP="$(k get nodes -l node-role.kubernetes.io/control-plane -o jsonpath='{.items[0].metadata.name}')"
PLAIN_COUNT="$(k -n "$NS" get pods -l app=plain-agent --no-headers | wc -l | tr -d '[:space:]')"
assert_eq "$PLAIN_COUNT" "2" "exactly two plain-agent Pods exist"
PLAIN_NODES="$(k -n "$NS" get pods -l app=plain-agent -o jsonpath='{.items[*].spec.nodeName}')"
note "Pods landed on: $PLAIN_NODES"
assert_not_contains "$PLAIN_NODES" "$CP" "nothing landed on the control-plane node $CP"

step "Why: a role taint the controller will not tolerate for you"
run k get node "$CP" -o jsonpath='{range .spec.taints[*]}{.key}{":"}{.effect}{"\n"}{end}'
TAINTS="$(k get node "$CP" -o jsonpath='{range .spec.taints[*]}{.key}{":"}{.effect}{"\n"}{end}')"
assert_contains "$TAINTS" "node-role.kubernetes.io/control-plane:NoSchedule" \
  "the control-plane node carries a NoSchedule role taint"
note "the controller tolerates node CONDITIONS automatically; a node's ROLE is"
note "an operator policy decision, so that toleration has to be written by hand"
run k -n "$NS" delete ds plain-agent

step "One hand-written toleration, and every node gets a Pod"
apply node-agent.yaml
assert_eventually 60 "3" "desiredNumberScheduled is 3 — one Pod per node" \
  k -n "$NS" get ds node-agent -o jsonpath='{.status.desiredNumberScheduled}'
assert_eventually 120 "3" "currentNumberScheduled is 3 — all three were placed" \
  k -n "$NS" get ds node-agent -o jsonpath='{.status.currentNumberScheduled}'
assert_eventually 300 "3" "numberReady reached 3 — all three are running" \
  k -n "$NS" get ds node-agent -o jsonpath='{.status.numberReady}'
run k -n "$NS" get ds node-agent
run k -n "$NS" get pods -l app=node-agent -o wide

DISTINCT="$(k -n "$NS" get pods -l app=node-agent \
  -o jsonpath='{range .items[*]}{.spec.nodeName}{"\n"}{end}' | sort -u | wc -l | tr -d '[:space:]')"
assert_eq "$DISTINCT" "3" "the three Pods sit on three distinct nodes, not stacked on one"
AGENT_NODES="$(k -n "$NS" get pods -l app=node-agent -o jsonpath='{.items[*].spec.nodeName}')"
assert_contains "$AGENT_NODES" "$CP" "one of them is on the control-plane node $CP"

step "Six tolerations nobody typed"
POD="$(k -n "$NS" get pods -l app=node-agent -o jsonpath='{.items[0].metadata.name}')"
note "inspecting Pod $POD"
run k -n "$NS" get pod "$POD" -o jsonpath='{range .spec.tolerations[*]}{.key}{":"}{.effect}{"\n"}{end}'
TOL="$(k -n "$NS" get pod "$POD" -o jsonpath='{range .spec.tolerations[*]}{.key}{":"}{.effect}{"\n"}{end}')"
assert_contains "$TOL" "node.kubernetes.io/not-ready:NoExecute" \
  "not-ready is tolerated with NoExecute — schedulable onto a node that is not Ready"
assert_contains "$TOL" "node.kubernetes.io/unreachable:NoExecute" \
  "unreachable is tolerated with NoExecute — not evicted when the node stops reporting"
assert_contains "$TOL" "node.kubernetes.io/disk-pressure:NoSchedule" "disk-pressure is tolerated"
assert_contains "$TOL" "node.kubernetes.io/memory-pressure:NoSchedule" "memory-pressure is tolerated"
assert_contains "$TOL" "node.kubernetes.io/pid-pressure:NoSchedule" "pid-pressure is tolerated"
assert_contains "$TOL" "node.kubernetes.io/unschedulable:NoSchedule" \
  "unschedulable is tolerated — a cordoned node still keeps its daemon"
assert_not_contains "$TOL" "network-unavailable" \
  "network-unavailable is absent — that seventh one is added only for hostNetwork Pods"

TPL="$(k -n "$NS" get ds node-agent -o jsonpath='{range .spec.template.spec.tolerations[*]}{.key}{"\n"}{end}')"
assert_contains "$TPL" "node-role.kubernetes.io/control-plane" \
  "the template we wrote declares the control-plane toleration"
assert_not_contains "$TPL" "node.kubernetes.io/not-ready" \
  "...and never mentioned not-ready, so the controller really did add it"

step "DaemonSet Pods still go through the normal scheduler"
AFF="$(k -n "$NS" get pod "$POD" -o jsonpath='{.spec.affinity.nodeAffinity}' 2>/dev/null || true)"
POD_NODE="$(k -n "$NS" get pod "$POD" -o jsonpath='{.spec.nodeName}')"
assert_contains "$AFF" "metadata.name" \
  "the controller pinned the Pod with a nodeAffinity term on metadata.name"
assert_contains "$AFF" "$POD_NODE" "...naming $POD_NODE, the node it actually runs on"
note "the controller picks the node and the scheduler binds the Pod, which is why"
note "a DaemonSet Pod is subject to taints at all"

step "A nodeSelector redefines what 'every node' means"
TARGET="$(k get nodes -l '!node-role.kubernetes.io/control-plane' -o jsonpath='{.items[0].metadata.name}')"
MATCHED="$(k get nodes -l "kubernetes.io/hostname=$TARGET" -o jsonpath='{.items[*].metadata.name}')"
assert_eq "$MATCHED" "$TARGET" "kubernetes.io/hostname=$TARGET selects exactly one node"
run k -n "$NS" patch ds node-agent --type merge \
  -p "{\"spec\":{\"template\":{\"spec\":{\"nodeSelector\":{\"kubernetes.io/hostname\":\"$TARGET\"}}}}}"

assert_eventually 120 "1" "desiredNumberScheduled dropped from 3 to 1" \
  k -n "$NS" get ds node-agent -o jsonpath='{.status.desiredNumberScheduled}'
assert_eventually 180 "1" "numberReady settled at 1" \
  k -n "$NS" get ds node-agent -o jsonpath='{.status.numberReady}'
assert_eventually 120 "$TARGET" "the single surviving Pod runs on $TARGET" \
  k -n "$NS" get pods -l app=node-agent -o jsonpath='{.items[*].spec.nodeName}'
run k -n "$NS" get ds node-agent
run k -n "$NS" get pods -l app=node-agent -o wide

step "What this proves"
note "A DaemonSet does not have a replica count. Its desired count is derived"
note "from the cluster: how many nodes match, right now. Narrow the match with a"
note "nodeSelector and the number follows on its own — 3 became 1 with no edit to"
note "any replica field, and it would climb back on its own if you labelled more"
note "nodes or joined new ones."
note ""
note "The tolerations the controller adds for free all name node CONDITIONS:"
note "not-ready, unreachable, the three pressure conditions, unschedulable. They"
note "exist to break a bootstrap deadlock. A CNI plugin ships as a DaemonSet, but"
note "a node without working networking never reaches Ready — so if its Pods"
note "needed a Ready node the plugin could never start, and the node could never"
note "become Ready. NoExecute on not-ready and unreachable closes the other half:"
note "the agent is not evicted from the very node it is there to repair."
note ""
note "What the controller will NOT tolerate for you is a role taint like"
note "node-role.kubernetes.io/control-plane. That taint encodes a human decision"
note "about what a node is for, and the plain-agent above is what forgetting it"
note "looks like: a monitoring agent quietly blind on exactly the node you would"
note "most want to watch, with nothing in its status calling it an error."
