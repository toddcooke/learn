#!/usr/bin/env bash
LAB="priorityclass"
source "$(dirname "$0")/../../cluster/lib.sh"
require_cluster
ns_setup

# ---------------------------------------------------------------------------
# Cleanup. PriorityClasses are CLUSTER-SCOPED: ns_teardown deletes a namespace
# and would leave all three behind, where they would collide with the next run
# (.value is immutable, so `apply` could not even repair a stale one). So the
# trap ns_setup installed is replaced here with one that removes them too, and
# it has to run on failure as well — hence EXIT INT TERM rather than a tidy
# delete at the bottom of the script.
# ---------------------------------------------------------------------------
PC_LOW="sandbox-priorityclass-low"
PC_HIGH="sandbox-priorityclass-high"
PC_NOPREEMPT="sandbox-priorityclass-high-nopreempt"

my_cleanup() {
  local code=$?
  # errexit is still armed inside a trap handler, and `(exit $code)` below is a
  # deliberately failing command. Without this the handler would abort on it and
  # never reach ns_teardown — exactly the failure path that most needs cleaning.
  set +e
  if [ "${KEEP:-0}" = "1" ]; then
    note "KEEP=1 — these CLUSTER-SCOPED objects were left behind too:"
    note "  kubectl --context $CONTEXT delete priorityclass $PC_LOW $PC_HIGH $PC_NOPREEMPT"
  else
    # The filler Pods run `sleep` as PID 1 and so ignore SIGTERM. A plain
    # namespace delete would keep most of a worker's CPU reserved for another
    # 15 seconds and skew whichever lab runs next, so drop the controller and
    # then the Pod objects outright.
    k -n "$NS" delete deploy --all --ignore-not-found >/dev/null 2>&1 || true
    k -n "$NS" delete pod --all --grace-period=0 --force >/dev/null 2>&1 || true
    k delete priorityclass "$PC_LOW" "$PC_HIGH" "$PC_NOPREEMPT" \
      --ignore-not-found >/dev/null 2>&1 || true
  fi
  (exit $code); ns_teardown
}
trap my_cleanup EXIT INT TERM

# --- small helpers ---------------------------------------------------------

# "8" -> 8000, "7900m" -> 7900, "1.5" -> 1500.
cpu_to_milli() {
  local v="${1:-}"
  case "$v" in
    "")  echo 0 ;;
    *m)  echo "${v%m}" ;;
    *)   awk -v x="$v" 'BEGIN { printf "%d", (x * 1000) + 0.5 }' ;;
  esac
}

# Sum of every container CPU *request* already placed on $NODE. This is what
# the scheduler subtracts from allocatable, and it is not the same thing as
# usage: a Pod that requests 500m and burns none of it still occupies 500m of
# the scheduler's arithmetic.
node_requested_milli() {
  local total=0 v out
  local jp='{range .items[*]}{range .spec.containers[*]}{.resources.requests.cpu}{"\n"}{end}{end}'
  out="$(k get pods --all-namespaces \
      --field-selector "spec.nodeName=$NODE,status.phase!=Succeeded,status.phase!=Failed" \
      -o jsonpath="$jp" 2>/dev/null)" || out=""
  # Every node runs kindnet, so an empty answer means the field selector was
  # rejected rather than that the node is idle. Fall back to the plain form.
  if [ -z "$out" ]; then
    out="$(k get pods --all-namespaces --field-selector "spec.nodeName=$NODE" \
        -o jsonpath="$jp" 2>/dev/null)" || out=""
  fi
  while IFS= read -r v; do
    [ -n "$v" ] || continue
    total=$(( total + $(cpu_to_milli "$v") ))
  done <<< "$out"
  echo "$total"
}

render_apply() {
  note "applying $1 with __NODE__=$NODE __CPU_LOW__=${PER}m __CPU_HIGH__=${HIGH}m"
  sed -e "s|__NODE__|$NODE|g" \
      -e "s|__CPU_LOW__|${PER}m|g" \
      -e "s|__CPU_HIGH__|${HIGH}m|g" \
      "$LAB_DIR/$1" | k -n "$NS" apply -f -
}

pending_filler_count() {
  k -n "$NS" get pods -l app=filler --field-selector status.phase=Pending \
    --no-headers 2>/dev/null | wc -l | tr -d '[:space:]' || true
}

some_filler_pending() {
  if [ "$(pending_filler_count)" -ge 1 ]; then echo yes; else echo no; fi
}

preempted_event_count() {
  k -n "$NS" get events --field-selector reason=Preempted \
    --no-headers 2>/dev/null | wc -l | tr -d '[:space:]' || true
}

any_preempted_event() {
  if [ "$(preempted_event_count)" -ge 1 ]; then echo yes; else echo no; fi
}

patient_events() {
  k -n "$NS" get events --field-selector involvedObject.name=patient \
    -o jsonpath='{range .items[*]}{.reason}{": "}{.message}{"\n"}{end}' 2>/dev/null || true
}

# ---------------------------------------------------------------------------

step "Create the PriorityClasses"
note "these are cluster-scoped — notice there is no -n on the apply"
k delete priorityclass "$PC_LOW" "$PC_HIGH" "$PC_NOPREEMPT" --ignore-not-found >/dev/null 2>&1 || true
run k apply -f "$LAB_DIR/priorityclasses.yaml"
run k get priorityclass "$PC_LOW" "$PC_HIGH" "$PC_NOPREEMPT"

assert_eq "$(k get priorityclass "$PC_LOW" -o jsonpath='{.value}')" "1000" \
  "$PC_LOW carries value 1000"
assert_eq "$(k get priorityclass "$PC_HIGH" -o jsonpath='{.value}')" "1000000" \
  "$PC_HIGH carries value 1000000"
assert_eq "$(k get priorityclass "$PC_NOPREEMPT" -o jsonpath='{.value}')" "1000000" \
  "$PC_NOPREEMPT carries the same value 1000000 as $PC_HIGH"
assert_eq "$(k get priorityclass "$PC_HIGH" -o jsonpath='{.preemptionPolicy}')" \
  "PreemptLowerPriority" \
  "the manifest left preemptionPolicy unset and the API server defaulted it to PreemptLowerPriority"
assert_eq "$(k get priorityclass "$PC_NOPREEMPT" -o jsonpath='{.preemptionPolicy}')" "Never" \
  "...while the third class asked for Never, so the only difference between the two is policy"
assert_not_contains "$(k get priorityclass "$PC_HIGH" -o jsonpath='{.globalDefault}')" "true" \
  "globalDefault is not set — Pods elsewhere in the cluster are unaffected"

note "a PriorityClass is not editable in place: try moving .value"
if OUT="$(k patch priorityclass "$PC_LOW" --type merge -p '{"value":2000}' 2>&1)"; then
  fail "expected the API server to reject a change to .value"
fi
note "$OUT"
assert_contains "$OUT" "Forbidden" "the API server refused the update"
assert_eq "$(k get priorityclass "$PC_LOW" -o jsonpath='{.value}')" "1000" \
  "...and .value is still 1000 — repricing a class means delete and recreate"

step "Size the experiment against a node that really exists"
NODE="$(k get nodes -l '!node-role.kubernetes.io/control-plane' \
  -o jsonpath='{.items[0].metadata.name}')"
[ -n "$NODE" ] || fail "found no worker node to fill"
note "target node: $NODE (the control-plane node is excluded — it is tainted)"
run k get node "$NODE" -o jsonpath='{.status.allocatable.cpu}{"\n"}'

ALLOC="$(cpu_to_milli "$(k get node "$NODE" -o jsonpath='{.status.allocatable.cpu}')")"
USED="$(node_requested_milli)"
FREE=$(( ALLOC - USED ))
[ "$FREE" -ge 600 ] || fail "only ${FREE}m schedulable on $NODE — too little headroom to demonstrate preemption"

# 75% of what is free, split six ways. The high-priority Pod then asks for four
# of those shares — half the free CPU on the node. That is more than the 25%
# left over, so it cannot fit without evicting somebody, and comfortably less
# than the node's total free CPU, so evicting somebody is enough. Both halves
# matter: the scheduler preempts only when preempting would actually make the
# Pod schedulable, and does nothing at all when it would not.
PER=$(( FREE * 75 / 100 / 6 ))
HIGH=$(( PER * 4 ))
LEFTOVER=$(( FREE - PER * 6 ))
note "allocatable ${ALLOC}m minus ${USED}m already requested = ${FREE}m free on $NODE"
note "low  : 6 replicas x ${PER}m = $(( PER * 6 ))m, leaving ${LEFTOVER}m"
note "high : 1 Pod x ${HIGH}m — more than ${LEFTOVER}m, less than ${FREE}m"

step "Fill $NODE with low-priority Pods"
render_apply filler.yaml
assert_eventually 300 "6" "all six low-priority Pods reached Ready" \
  k -n "$NS" get deploy filler -o jsonpath='{.status.readyReplicas}'
run k -n "$NS" get pods -l app=filler -o wide

DISTINCT="$(k -n "$NS" get pods -l app=filler \
  -o jsonpath='{range .items[*]}{.spec.nodeName}{"\n"}{end}' | sort -u | tr -d '[:space:]')"
assert_eq "$DISTINCT" "$NODE" "every replica is on $NODE and nowhere else"
FPOD="$(k -n "$NS" get pods -l app=filler -o jsonpath='{.items[0].metadata.name}')"
assert_eq "$(k -n "$NS" get pod "$FPOD" -o jsonpath='{.spec.priority}')" "1000" \
  "admission resolved priorityClassName into the integer .spec.priority = 1000"
assert_eq "$(pending_filler_count)" "0" "nothing is Pending yet — the node absorbed all six"

step "preemptionPolicy: Never — high priority, but it waits"
render_apply patient.yaml
assert_eq "$(k -n "$NS" get pod patient -o jsonpath='{.spec.priority}')" "1000000" \
  "patient has priority 1000000, a thousand times the fillers'"
assert_eventually_contains 180 "Insufficient cpu" \
  "the scheduler cannot fit ${HIGH}m: Insufficient cpu" patient_events
run k -n "$NS" get events --field-selector involvedObject.name=patient

EV="$(patient_events)"
assert_contains "$EV" "preemptionPolicy=Never" \
  "...and names preemptionPolicy=Never as the reason it will not make room itself"
assert_eq "$(k -n "$NS" get pod patient -o jsonpath='{.status.phase}')" "Pending" \
  "patient is Pending"
assert_eq "$(k -n "$NS" get deploy filler -o jsonpath='{.status.readyReplicas}')" "6" \
  "all six low-priority Pods are still Ready — not one was touched"
assert_eq "$(preempted_event_count)" "0" "there is not a single Preempted event in $NS"
run k -n "$NS" delete pod patient

step "The same priority with the default policy takes the room it needs"
render_apply urgent.yaml
assert_eq "$(k -n "$NS" get pod urgent -o jsonpath='{.spec.priority}')" "1000000" \
  "urgent has the identical priority 1000000 and the identical ${HIGH}m request"
assert_eventually_contains 120 "$NODE" \
  "urgent's .status.nominatedNodeName reserved $NODE while its victims drain" \
  k -n "$NS" get pod urgent -o jsonpath='{.status.nominatedNodeName}'
note "that reservation is why the ReplicaSet's replacement Pods cannot slip into"
note "the space being freed: the scheduler counts a nominated Pod as if it were"
note "already on the node"

assert_eventually 300 "Running" "urgent reached Running on a node that had no room for it" \
  k -n "$NS" get pod urgent -o jsonpath='{.status.phase}'
assert_eq "$(k -n "$NS" get pod urgent -o jsonpath='{.spec.nodeName}')" "$NODE" \
  "...specifically on $NODE, the node it preempted"

assert_eventually 180 "yes" "victim Pods carry an event with reason Preempted" any_preempted_event
run k -n "$NS" get events --field-selector reason=Preempted
assert_eventually 180 "yes" "at least one low-priority Pod is Pending now" some_filler_pending
run k -n "$NS" get pods -o wide

VICTIMS="$(pending_filler_count)"
note "$VICTIMS of the six low-priority Pods are Pending — the ReplicaSet recreated"
note "the evicted ones immediately, and they have nowhere to go"
assert_eq "$(k -n "$NS" get pod urgent -o jsonpath='{.status.phase}')" "Running" \
  "urgent is still Running — lower-priority Pods queued behind it cannot displace it"

step "Room that frees up on its own goes to the non-preempting Pod"
note "shrink the low-priority Deployment so nothing is left queued, then bring"
note "the Never Pod back while $NODE is still full"
run k -n "$NS" scale deploy/filler --replicas=2
assert_eventually 180 "0" "no low-priority Pod is left Pending after the scale-down" \
  pending_filler_count
render_apply patient.yaml
assert_eventually 60 "Pending" "patient is Pending again — urgent still holds the CPU" \
  k -n "$NS" get pod patient -o jsonpath='{.status.phase}'

BEFORE="$(preempted_event_count)"
run k -n "$NS" delete pod urgent
assert_eventually 300 "Running" "patient reached Running the moment room appeared" \
  k -n "$NS" get pod patient -o jsonpath='{.status.phase}'
assert_eq "$(k -n "$NS" get pod patient -o jsonpath='{.spec.nodeName}')" "$NODE" \
  "...on $NODE, the node it had been waiting for"
assert_eq "$(preempted_event_count)" "$BEFORE" \
  "no new Preempted event — patient got there without evicting anything"
assert_eq "$(k -n "$NS" get deploy filler -o jsonpath='{.status.readyReplicas}')" "2" \
  "the two surviving low-priority Pods are still Ready"
run k -n "$NS" get pods -o wide

step "What this proves"
note "Priority is an integer stamped onto .spec.priority by admission, copied out"
note "of the PriorityClass the Pod names. It does two separate jobs, and the two"
note "are worth keeping apart."
note ""
note "The first is queue order. The scheduler pops Pods highest-priority-first, so"
note "a priority of 1000000 is looked at before every 1000. That much is true of"
note "both high classes here, which carry the identical value."
note ""
note "The second is preemption, and that is governed by preemptionPolicy, not by"
note "the value. urgent and patient asked for the same ${HIGH}m on the same full"
note "node at the same priority. urgent defaulted to PreemptLowerPriority: the"
note "scheduler deleted enough low-priority Pods to fit it, reserved the node via"
note ".status.nominatedNodeName while they drained, and the victims came back as"
note "Pending replicas with nowhere to run. patient's class said Never: it sat in"
note "the queue, logged 'preemption: not eligible due to preemptionPolicy=Never',"
note "evicted nobody, and was scheduled later when capacity was released."
note ""
note "Preemption is also conditional, not automatic. The scheduler evicts only"
note "when evicting would actually make the Pod fit, and only ever downward — the"
note "Pending fillers sat behind urgent indefinitely rather than pushing it off."
note ""
note "Two operational details behind the demo. .value is immutable, so changing a"
note "class's number means deleting and recreating it, and existing Pods keep the"
note "priority they were admitted with. And a PriorityClass is cluster-scoped: it"
note "is not covered by a namespace delete, which is why this lab carries its own"
note "trap. globalDefault: true would be the same hazard at cluster scale, since"
note "it silently repriced every Pod that names no class at all."
