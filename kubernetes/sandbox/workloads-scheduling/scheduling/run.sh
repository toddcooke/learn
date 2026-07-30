#!/usr/bin/env bash
LAB="scheduling"
source "$(dirname "$0")/../../cluster/lib.sh"
require_cluster
ns_setup

# This lab writes to NODES, which live outside $NS: one taint and four labels.
# ns_teardown knows nothing about any of that, so on its own it would hand the
# next lab a cluster with a NoSchedule taint nobody put in their manifest — a
# failure mode that shows up as an unrelated Pod mysteriously stuck Pending.
# Replace ns_setup's trap with one that restores the nodes first and runs on
# failure exactly as it does on success.
WORKER1="cka-sandbox-worker"
WORKER2="cka-sandbox-worker2"
TAINT="sandbox-scheduling=demo:NoSchedule"

my_cleanup() {
  local code=$?
  # Undoing node state must not itself abort the trap: every command below is
  # an error when there is nothing to remove, which is exactly the case if the
  # script died before it got that far. Drop errexit, then hand ns_teardown the
  # status we entered with, since it reads $? to decide what to exit with.
  #
  # This happens even under KEEP=1. A kept namespace is a debugging aid; a kept
  # taint is a booby trap for the next lab.
  set +e
  k taint node "$WORKER2" "$TAINT-" >/dev/null 2>&1
  k label node "$WORKER1" sandbox-scheduling-disk- sandbox-scheduling-zone- >/dev/null 2>&1
  k label node "$WORKER2" sandbox-scheduling-disk- sandbox-scheduling-zone- >/dev/null 2>&1
  (exit "$code")
  ns_teardown
}
trap my_cleanup EXIT INT TERM

for n in "$WORKER1" "$WORKER2"; do
  k get node "$n" >/dev/null 2>&1 \
    || fail "node $n not found — this lab assumes the 3-node cka-sandbox cluster"
done
CP="$(k get nodes -l node-role.kubernetes.io/control-plane -o jsonpath='{.items[0].metadata.name}')"

# --- small readers, so the assertions below stay one line each -------------
# Events for one object, as "reason: message" lines.
pod_events() {
  k -n "$NS" get events --field-selector "involvedObject.name=$1" \
    -o jsonpath='{range .items[*]}{.reason}{": "}{.message}{"\n"}{end}'
}
# How many Pods of an app are in a given phase / on a given node.
pods_in_phase()  { k -n "$NS" get pods -l "app=$1" --field-selector "status.phase=$2" \
                     -o jsonpath='{.items[*].metadata.name}' | wc -w | tr -d '[:space:]'; }
pods_on_node()   { k -n "$NS" get pods -l "app=$1" --field-selector "spec.nodeName=$2" \
                     -o jsonpath='{.items[*].metadata.name}' | wc -w | tr -d '[:space:]'; }
node_of()        { k -n "$NS" get pod "$1" -o jsonpath='{.spec.nodeName}'; }
phase_of()       { k -n "$NS" get pod "$1" -o jsonpath='{.status.phase}'; }
taint_keys()     { k get node "$1" -o jsonpath='{range .spec.taints[*]}{.key}={.value}:{.effect}{"\n"}{end}'; }

step "Label the two workers, and taint one of them"
# --overwrite makes both idempotent, so a previous interrupted run cannot make
# this one fail before it has even started.
run k label node "$WORKER1" sandbox-scheduling-disk=ssd sandbox-scheduling-zone=alpha --overwrite
run k label node "$WORKER2" sandbox-scheduling-disk=hdd sandbox-scheduling-zone=beta --overwrite
run k taint node "$WORKER2" "$TAINT" --overwrite
note "the control-plane node $CP is deliberately left untouched — it already"
note "carries its own node-role NoSchedule taint, and it gets neither label"

TAINTS="$(taint_keys "$WORKER2")"
assert_contains "$TAINTS" "sandbox-scheduling=demo:NoSchedule" \
  "$WORKER2 now carries a NoSchedule taint"
LABELLED="$(k get nodes -l 'sandbox-scheduling-disk in (ssd,hdd)' \
  -o jsonpath='{range .items[*]}{.metadata.name}{"\n"}{end}')"
LABELLED_COUNT="$(k get nodes -l sandbox-scheduling-disk --no-headers 2>/dev/null | wc -l | tr -d '[:space:]')"
assert_eq "$LABELLED_COUNT" "2" "exactly two nodes carry sandbox-scheduling-disk"
assert_not_contains "$LABELLED" "$CP" "$CP is not one of them"

step "A Pod with no toleration for that taint never schedules"
apply reserved-app.yaml
assert_eventually 60 "Pending" "reserved-app is Pending" phase_of reserved-app
assert_eq "$(node_of reserved-app)" "" "its .spec.nodeName is still empty"
assert_eq "$(k -n "$NS" get pod reserved-app \
  -o jsonpath='{.status.conditions[?(@.type=="PodScheduled")].status}')" "False" \
  "and its PodScheduled condition is False — no node was ever assigned"
assert_eventually_contains 90 "FailedScheduling" \
  "its events carry a FailedScheduling record" pod_events reserved-app
EV="$(pod_events reserved-app)"
assert_contains "$EV" "untolerated taint" \
  "the reason is an untolerated taint, not a resource shortage"
run k -n "$NS" get events --field-selector involvedObject.name=reserved-app
note "the Pod is pinned to $WORKER2 by hostname, so the one node it may use is"
note "the one node that repels it. Pending is not an error state — nothing"
note "restarts, nothing times out, the scheduler simply keeps trying."

step "Adding the toleration schedules it, without recreating the Pod"
run k -n "$NS" get pod reserved-app \
  -o jsonpath='{range .spec.tolerations[*]}{.key}{":"}{.effect}{"\n"}{end}'
note "whatever is listed above came from the DefaultTolerationSeconds admission"
note "plugin rather than from the manifest: a kubeadm cluster gives every Pod a"
note "300-second toleration of not-ready and unreachable"
# spec.tolerations is one of the very few Pod fields the API will accept an
# update to, and only as an addition. A JSON patch appends to the list rather
# than replacing it, which matters: replacing it would delete the two
# admission-added tolerations, and deletion is what the API forbids. The merge
# branch is a fallback for a cluster whose admission chain left the list absent,
# where there is no element to append to.
TOL='{"key":"sandbox-scheduling","operator":"Equal","value":"demo","effect":"NoSchedule"}'
if [ -n "$(k -n "$NS" get pod reserved-app -o jsonpath='{.spec.tolerations}')" ]; then
  run k -n "$NS" patch pod reserved-app --type json \
    -p "[{\"op\":\"add\",\"path\":\"/spec/tolerations/-\",\"value\":$TOL}]"
else
  run k -n "$NS" patch pod reserved-app --type merge -p "{\"spec\":{\"tolerations\":[$TOL]}}"
fi
assert_eventually 180 "Running" "reserved-app reached Running once the toleration existed" \
  phase_of reserved-app
assert_eq "$(node_of reserved-app)" "$WORKER2" "it landed on $WORKER2, the tainted node"
note "a toleration is permission, never attraction: it removed the node's"
note "objection, and the nodeSelector is what chose the node"

step "Remove the taint"
run k taint node "$WORKER2" "$TAINT-"
assert_not_contains "$(taint_keys "$WORKER2")" "sandbox-scheduling" \
  "the taint is gone — the trailing dash is the removal form"
note "the rest of the lab needs two schedulable nodes. Note that removing a"
note "NoSchedule taint changes nothing for Pods already placed; NoSchedule only"
note "ever governs placement, and only NoExecute evicts."

step "nodeSelector: exact equality on a node label"
apply node-selector.yaml
run k -n "$NS" wait --for=condition=Ready pod/selector-pod --timeout=180s
assert_eq "$(node_of selector-pod)" "$WORKER1" \
  "selector-pod landed on $WORKER1, the only node labelled disk=ssd"

step "nodeAffinity: the same idea with set operators, plus a soft flavour"
apply node-affinity.yaml
run k -n "$NS" wait --for=condition=Ready pod/affinity-pod pod/soft-pod --timeout=180s
AFF_NODE="$(node_of affinity-pod)"
assert_contains "$LABELLED" "$AFF_NODE" \
  "affinity-pod landed on $AFF_NODE — In (ssd,hdd) accepted either worker"
NVME_NODES="$(k get nodes -l sandbox-scheduling-disk=nvme --no-headers 2>/dev/null | wc -l | tr -d '[:space:]')"
assert_eq "$NVME_NODES" "0" "no node in this cluster is labelled disk=nvme"
assert_eq "$(phase_of soft-pod)" "Running" \
  "soft-pod runs anyway on $(node_of soft-pod), despite preferring a disk nobody has"
note "required affinity filters the candidate list; preferred only scores what"
note "survived the filter. An unsatisfiable preference is therefore free."

step "Pod anti-affinity spreads a Deployment across distinct nodes"
apply anti-affinity.yaml
run k -n "$NS" rollout status deploy/anti-web --timeout=180s
run k -n "$NS" get pods -l app=anti-web -o wide
DISTINCT="$(k -n "$NS" get pods -l app=anti-web \
  -o jsonpath='{range .items[*]}{.spec.nodeName}{"\n"}{end}' | sort -u | wc -l | tr -d '[:space:]')"
assert_eq "$DISTINCT" "2" "the two Pods sit on two distinct nodes"
assert_eq "$(pods_on_node anti-web "$CP")" "0" "neither is on $CP, which still repels them"

note "required anti-affinity is a prohibition, so the replica count is capped by"
note "the number of usable domains. Scaling to 3 shows what that costs:"
run k -n "$NS" scale deploy/anti-web --replicas=3
assert_eventually 120 "1" "the third Pod is stuck Pending — there is no third domain" \
  pods_in_phase anti-web Pending
assert_eventually 60 "2" "the first two are untouched and still Running" \
  pods_in_phase anti-web Running
STUCK="$(k -n "$NS" get pods -l app=anti-web --field-selector status.phase=Pending \
  -o jsonpath='{.items[0].metadata.name}')"
assert_eventually_contains 90 "FailedScheduling" \
  "$STUCK has a FailedScheduling event" pod_events "$STUCK"
assert_contains "$(pod_events "$STUCK")" "anti-affinity" \
  "...and the message names the anti-affinity rule, not a taint or a resource"

step "topologySpreadConstraints: balance rather than prohibition"
apply topology-spread.yaml
run k -n "$NS" rollout status deploy/spread-web --timeout=180s
run k -n "$NS" get pods -l app=spread-web -o wide
assert_eq "$(pods_on_node spread-web "$WORKER1")" "2" "two Pods in zone alpha ($WORKER1)"
assert_eq "$(pods_on_node spread-web "$WORKER2")" "2" "two Pods in zone beta ($WORKER2)"
assert_eq "$(pods_on_node spread-web "$CP")" "0" \
  "none on $CP — with no sandbox-scheduling-zone label it is not a domain at all"
note "2 and 2 is not luck. A 3/1 split is a skew of 2, which maxSkew: 1 forbids,"
note "so the filter rejects every node that would produce it."

run k -n "$NS" scale deploy/spread-web --replicas=5
run k -n "$NS" rollout status deploy/spread-web --timeout=180s
A="$(pods_on_node spread-web "$WORKER1")"
B="$(pods_on_node spread-web "$WORKER2")"
assert_eq "$((A + B))" "5" "all five replicas scheduled — 3 on one zone, 2 on the other"
assert_eq "$(( A > B ? A - B : B - A ))" "1" "the resulting skew is 1, inside the budget"
note "this is the fifth replica the anti-affinity Deployment could not place. A"
note "skew budget lets a workload outgrow its domain count; a prohibition does not."

step "What this proves"
note "Placement is decided by two different kinds of rule, and they are written"
note "by two different people. A taint belongs to the node and says who may not"
note "come; a toleration only answers that objection. Selectors and affinity"
note "belong to the Pod and say where it wants to go. Neither implies the other,"
note "which is why reserved-app needed both a toleration AND a nodeSelector to"
note "end up on $WORKER2: the toleration alone would have left it free to run"
note "anywhere, and the nodeSelector alone left it Pending forever."
note ""
note "Within the Pod's own rules, the axis that matters is hard versus soft."
note "nodeSelector and requiredDuringScheduling... remove nodes from the"
note "candidate list, and if the list empties the Pod waits indefinitely with"
note "nothing but a FailedScheduling event to show for it. preferredDuring... only"
note "ranks the nodes that already passed, so soft-pod asked for hardware that"
note "does not exist in this cluster and ran regardless."
note ""
note "Anti-affinity and topology spread both spread replicas, but they are not"
note "the same tool. Required anti-affinity forbids two Pods in one domain, so"
note "the replica count is hard-capped by the number of domains — the third"
note "anti-web replica has nowhere to go and never will. A topology spread"
note "constraint states a tolerated imbalance instead, so spread-web went to"
note "five on two domains while still refusing a lopsided placement."
note ""
note "IgnoredDuringExecution runs through all of it: every rule here is enforced"
note "once, at scheduling time. Relabel a node afterwards and nothing moves."
