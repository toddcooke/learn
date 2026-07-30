#!/usr/bin/env bash
LAB="node-maintenance"
source "$(dirname "$0")/../../cluster/lib.sh"
require_cluster
ns_setup

# ---------------------------------------------------------------------------
# Cleanup. This lab modifies NODES, and a node is cluster-scoped: ns_teardown
# deletes a namespace and would leave every node this run touched cordoned. A
# cordoned node does not show up in `kubectl get pods`, produces no error
# anywhere, and quietly halves the cluster for every lab that runs afterwards —
# so the trap ns_setup installed is replaced here with one that uncordons all
# of them first. It has to run on failure and on Ctrl-C too, because a drain
# interrupted halfway is precisely when a node gets left behind.
#
# The uncordon happens even under KEEP=1. Leaving the namespace up for
# inspection is cheap; leaving a node unschedulable is not. The visible
# consequence is that the stranded Pod from the last step schedules a few
# seconds after the script exits — its events outlive it, so `kubectl describe`
# still tells the story.
#
# Nothing else outside the namespace needs removing. The PersistentVolume in
# the last step is dynamically provisioned, carries a claimRef into $NS and
# inherits the standard class's Delete reclaim policy, so deleting the
# namespace reclaims it — and because the uncordon above runs first, the
# provisioner's cleanup helper has a schedulable node to run on.
# ---------------------------------------------------------------------------
uncordon_all() {
  local n
  for n in $(k get nodes -o 'jsonpath={range .items[*]}{.metadata.name}{"\n"}{end}' 2>/dev/null || true); do
    k uncordon "$n" >/dev/null 2>&1 || true
  done
}

my_cleanup() {
  local code=$?
  # errexit is still armed inside a trap handler, and `(exit $code)` below is a
  # deliberately failing command on the failure path. Without this the handler
  # would abort on it and never reach ns_teardown.
  set +e
  uncordon_all
  note "every node uncordoned — the only cluster-scoped state this lab changed"
  (exit $code); ns_teardown
}
trap my_cleanup EXIT INT TERM

# --- helpers ---------------------------------------------------------------

# How many Pods matching a label selector are bound to a node right now.
# `--field-selector spec.nodeName=` is the honest question here: a Pod's node
# assignment lives in its spec, written once by the scheduler.
pods_on_node() {   # $1 = node, $2 = label selector
  k -n "$NS" get pods -l "$2" --field-selector "spec.nodeName=$1" \
    --no-headers 2>/dev/null | grep -c . || true
}

keeper_pod_count() {
  k -n "$NS" get pods -l app=keeper --no-headers 2>/dev/null | grep -c . || true
}

pod_events() {   # $1 = pod name
  k -n "$NS" get events --field-selector "involvedObject.name=$1" \
    -o 'jsonpath={range .items[*]}{.reason}{": "}{.message}{"\n"}{end}' 2>/dev/null || true
}

# .spec.unschedulable is a bool with `omitempty`, so an uncordoned node does not
# carry the field at all rather than carrying `false`. Reading it through a
# yes/no helper keeps the assertions honest about that: "not true" is the claim,
# and it holds whether the API server stores false or stores nothing.
node_unschedulable() {   # $1 = node -> yes | no
  case "$(k get node "$1" -o 'jsonpath={.spec.unschedulable}' 2>/dev/null || true)" in
    true) echo yes ;;
    *)    echo no ;;
  esac
}

# Cordoning sets .spec.unschedulable, and the node lifecycle controller then
# mirrors that flag as a real taint. Asking about the taint by substring rather
# than comparing the whole .spec.taints blob keeps the assertion true on a node
# that happens to carry other taints as well.
unschedulable_taint() {   # $1 = node -> yes | no
  case "$(k get node "$1" -o 'jsonpath={.spec.taints}' 2>/dev/null || true)" in
    *node.kubernetes.io/unschedulable*) echo yes ;;
    *)                                  echo no ;;
  esac
}

# The scheduler's wording for this particular rejection changed in v1.33: it
# used to read "node(s) had volume node affinity conflict" and now reads
# "node(s) didn't match PersistentVolume's node affinity". Accept either, so
# the assertion is about the behaviour rather than about a release's phrasing.
volume_affinity_rejected() {   # $1 = pod name -> yes | no
  case "$(pod_events "$1")" in
    *"volume node affinity conflict"*|*"PersistentVolume's node affinity"*) echo yes ;;
    *)                                                                      echo no ;;
  esac
}

# probe.yaml and newcomer.yaml name a node that is only known at run time, so
# they go through sed rather than through the plain `apply` helper.
render_apply() {   # $1 = manifest, $2 = node
  note "applying $1 with __NODE__=$2"
  sed -e "s|__NODE__|$2|g" "$LAB_DIR/$1" | k -n "$NS" apply -f -
}

# ---------------------------------------------------------------------------

step "Pick the node that is going down for maintenance"
run k get nodes
WORKERS="$(k get nodes -l '!node-role.kubernetes.io/control-plane' \
  -o 'jsonpath={range .items[*]}{.metadata.name}{"\n"}{end}' | sed '/^$/d')"
WCOUNT="$(printf '%s\n' "$WORKERS" | grep -c . || true)"
[ "$WCOUNT" -ge 2 ] || fail "this lab needs two worker nodes; found $WCOUNT"
OTHER="$(printf '%s\n' "$WORKERS" | sed -n 1p)"
TARGET="$(printf '%s\n' "$WORKERS" | sed -n 2p)"
note "target node: $TARGET — everything on it has to end up somewhere else"
note "the only somewhere else is $OTHER: the control-plane node carries a"
note "NoSchedule taint, so it is not a candidate for ordinary workload"
assert_eq "$(node_unschedulable "$TARGET")" "no" \
  "$TARGET starts schedulable — .spec.unschedulable is not set"
assert_eq "$(node_unschedulable "$OTHER")" "no" \
  "so does $OTHER; a node left cordoned by an earlier lab would break this one"

step "A stateless workload, spread across both workers"
apply web.yaml
run k -n "$NS" rollout status deploy/web --timeout=300s
run k -n "$NS" get pods -l app=web -o wide
assert_eq "$(k -n "$NS" get deploy web -o jsonpath='{.status.readyReplicas}')" "4" \
  "all four replicas are Ready"
ON_TARGET="$(pods_on_node "$TARGET" app=web)"
[ "$ON_TARGET" -ge 1 ] || fail "no web Pod landed on $TARGET; the topology spread is soft, so re-run the lab"
ok "$ON_TARGET of the four replicas are on $TARGET — the ones a drain will have to move"

note "and a bare Pod on the same node, with no controller behind it"
render_apply probe.yaml "$TARGET"
run k -n "$NS" wait --for=condition=Ready pod/probe --timeout=180s
assert_eq "$(k -n "$NS" get pod probe -o jsonpath='{.spec.nodeName}')" "$TARGET" \
  "probe is running on $TARGET"
assert_eq "$(k -n "$NS" get pod probe -o jsonpath='{.metadata.ownerReferences}')" "" \
  "...and has no ownerReferences at all: nothing in the cluster is responsible for replacing it"

step "cordon: no new Pods, and not a finger laid on the running ones"
run k cordon "$TARGET"
run k get node "$TARGET" -o 'jsonpath={.spec.unschedulable}{"\n"}'
assert_eq "$(node_unschedulable "$TARGET")" "yes" \
  ".spec.unschedulable is now true on $TARGET — that one boolean is everything cordon writes"
run k get nodes
assert_contains "$(k get nodes)" "SchedulingDisabled" \
  "kubectl renders it in the STATUS column as Ready,SchedulingDisabled"
assert_eventually 60 "yes" \
  "the node lifecycle controller mirrored the flag as a node.kubernetes.io/unschedulable:NoSchedule taint" \
  unschedulable_taint "$TARGET"
run k get node "$TARGET" -o 'jsonpath={.spec.taints}{"\n"}'

assert_eq "$(pods_on_node "$TARGET" app=web)" "$ON_TARGET" \
  "the $ON_TARGET web Pods on $TARGET are still on $TARGET — cordon evicts nothing"
assert_eq "$(k -n "$NS" get pod probe -o jsonpath='{.status.phase}')" "Running" \
  "the bare probe Pod is still Running there too"
assert_eq "$(k -n "$NS" get deploy web -o jsonpath='{.status.readyReplicas}')" "4" \
  "the Deployment still reports four Ready replicas — nothing was disrupted"

note "now ask for a NEW Pod on the cordoned node and watch it fail to place"
render_apply newcomer.yaml "$TARGET"
assert_eventually 120 "Pending" "the new Pod is Pending" \
  k -n "$NS" get pod newcomer -o 'jsonpath={.status.phase}'
assert_eventually_contains 180 "were unschedulable" \
  "...and the scheduler names the reason: node(s) were unschedulable" \
  pod_events newcomer
run k -n "$NS" get events --field-selector involvedObject.name=newcomer
assert_eq "$(k -n "$NS" get pod newcomer -o jsonpath='{.spec.nodeName}')" "" \
  "it was never assigned to any node — cordon is a filter in the scheduler, not a wall around the kubelet"
run k -n "$NS" delete pod newcomer

step "drain refuses three times, naming the flag it wants each time"
note "a drain is not a cordon: it also evicts what is already running, and it"
note "will not start while it can see Pods it does not know how to handle"

if OUT="$(k drain "$TARGET" 2>&1)"; then fail "expected drain to refuse to start"; fi
note "$OUT"
assert_contains "$OUT" "--ignore-daemonsets" \
  "first refusal: DaemonSet-managed Pods (kindnet, kube-proxy) — use --ignore-daemonsets"
note "the flag means 'leave them alone', not 'evict them'. A DaemonSet Pod"
note "would be recreated on this node immediately anyway: the DaemonSet"
note "controller ignores unschedulable."

if OUT="$(k drain "$TARGET" --ignore-daemonsets 2>&1)"; then fail "expected drain to refuse to start"; fi
note "$OUT"
assert_contains "$OUT" "--delete-emptydir-data" \
  "second refusal: Pods with local storage — use --delete-emptydir-data"
note "that is web.yaml's emptyDir. The volume dies with the Pod and cannot"
note "follow it anywhere, so kubectl makes you say the data is expendable."

if OUT="$(k drain "$TARGET" --ignore-daemonsets --delete-emptydir-data 2>&1)"; then
  fail "expected drain to refuse to start"
fi
note "$OUT"
assert_contains "$OUT" "--force" \
  "third refusal: Pods that declare no controller — use --force"
note "--force does not relocate the probe Pod. Nothing owns it, so --force"
note "means 'delete it and accept that it is gone'. Deleting it deliberately"
note "is the same outcome, said out loud — which is what we do here."
run k -n "$NS" delete pod probe

assert_eq "$(pods_on_node "$TARGET" app=web)" "$ON_TARGET" \
  "not one web Pod was evicted by the three refusals: the checks run before any eviction does"
assert_eq "$(node_unschedulable "$TARGET")" "yes" \
  "...but the node is still cordoned — drain cordons first and asks questions second, so even a failed drain leaves it unschedulable"

step "A PodDisruptionBudget with no room blocks the drain outright"
apply pdb.yaml
assert_eventually 90 "4" "the disruption controller counts 4 healthy Pods" \
  k -n "$NS" get pdb web-pdb -o 'jsonpath={.status.currentHealthy}'
assert_eq "$(k -n "$NS" get pdb web-pdb -o jsonpath='{.status.desiredHealthy}')" "4" \
  "...and minAvailable: 4 means it needs all 4 of them"
assert_eq "$(k -n "$NS" get pdb web-pdb -o jsonpath='{.status.disruptionsAllowed}')" "0" \
  ".status.disruptionsAllowed is 0 — currentHealthy minus desiredHealthy, and there is nothing to spare"
run k -n "$NS" get pdb web-pdb

note "drain with a 25s timeout, so the blocked attempt comes back promptly"
if OUT="$(k drain "$TARGET" --ignore-daemonsets --delete-emptydir-data --timeout=25s 2>&1)"; then
  fail "expected the drain to fail while the budget allows no disruptions"
fi
note "$OUT"
assert_contains "$OUT" "disruption budget" \
  "every eviction was refused: Cannot evict pod as it would violate the pod's disruption budget"
assert_eq "$(pods_on_node "$TARGET" app=web)" "$ON_TARGET" \
  "all $ON_TARGET web Pods are still on $TARGET — the drain achieved literally nothing"
assert_eq "$(k -n "$NS" get deploy web -o jsonpath='{.status.readyReplicas}')" "4" \
  "and the app never dipped below four Ready replicas, which is exactly what the budget was written to guarantee"
note "the budget is doing its job. It is the drain that is wrong: minAvailable"
note "equal to the replica count leaves no room for any voluntary disruption,"
note "so no amount of waiting would ever have let this drain through."

step "Give the budget room and the same drain succeeds"
run k -n "$NS" scale deploy/web --replicas=6
run k -n "$NS" rollout status deploy/web --timeout=300s
assert_eq "$(k -n "$NS" get deploy web -o jsonpath='{.status.readyReplicas}')" "6" \
  "six replicas are Ready"
assert_eq "$(pods_on_node "$TARGET" app=web)" "$ON_TARGET" \
  "both new Pods went to $OTHER — the cordon kept them off $TARGET, which is the point of cordoning before draining"
assert_eventually 90 "2" \
  "the budget now allows 2 disruptions: 6 healthy, 4 required" \
  k -n "$NS" get pdb web-pdb -o 'jsonpath={.status.disruptionsAllowed}'

run k drain "$TARGET" --ignore-daemonsets --delete-emptydir-data --timeout=300s \
  || fail "the drain did not complete"
ok "the drain completed"
run k -n "$NS" get pods -l app=web -o wide
assert_eq "$(pods_on_node "$TARGET" app=web)" "0" \
  "no web Pod is left on $TARGET"
assert_eventually 300 "6" "the Deployment is back to six Ready replicas" \
  k -n "$NS" get deploy web -o 'jsonpath={.status.readyReplicas}'
assert_eq "$(pods_on_node "$OTHER" app=web)" "6" \
  "all six of them are on $OTHER — every replica relocated, and the budget was never violated on the way"

run k get pods -A --field-selector "spec.nodeName=$TARGET" -o wide
STILL="$(k get pods -A --field-selector "spec.nodeName=$TARGET" \
  -o 'jsonpath={range .items[*]}{.metadata.name}{"\n"}{end}')"
assert_contains "$STILL" "kindnet" \
  "kindnet is still running on the drained node — --ignore-daemonsets meant leave it, and a drained node still needs its CNI"

step "uncordon returns the node to service, and nothing comes back"
run k uncordon "$TARGET"
assert_eq "$(node_unschedulable "$TARGET")" "no" \
  ".spec.unschedulable is gone from $TARGET"
assert_not_contains "$(k get nodes)" "SchedulingDisabled" \
  "no node is left SchedulingDisabled"
assert_eventually 90 "no" \
  "...and the controller withdrew the node.kubernetes.io/unschedulable taint with it" \
  unschedulable_taint "$TARGET"
assert_eq "$(pods_on_node "$TARGET" app=web)" "0" \
  "all six replicas are still on $OTHER — uncordon does not bring anything back"
note "a Pod's node is chosen once, at scheduling time, and written into"
note ".spec.nodeName. Nothing in Kubernetes revisits that choice, so an"
note "uncordoned node stays empty until something new needs placing."

step "The workload drain cannot save: a Pod that owns node-local storage"
note "clear the stage — the stateless half is finished with"
run k -n "$NS" delete pdb web-pdb
run k -n "$NS" delete deploy web
apply keeper.yaml
run k -n "$NS" rollout status deploy/keeper --timeout=300s

KPOD="$(k -n "$NS" get pods -l app=keeper -o jsonpath='{.items[0].metadata.name}')"
[ -n "$KPOD" ] || fail "could not find the keeper Pod"
KNODE="$(k -n "$NS" get pod "$KPOD" -o jsonpath='{.spec.nodeName}')"
[ -n "$KNODE" ] || fail "could not read the node keeper was scheduled onto"
note "the scheduler put keeper on $KNODE; nobody asked for that node"
assert_eventually 120 "Bound" "its claim is Bound" \
  k -n "$NS" get pvc keeper-data -o 'jsonpath={.status.phase}'
run k -n "$NS" exec "$KPOD" -- sh -c 'echo "written before the drain" > /data/id.txt'

PV="$(k -n "$NS" get pvc keeper-data -o jsonpath='{.spec.volumeName}')"
[ -n "$PV" ] || fail "the claim reports Bound but names no volume"
run k get pv "$PV" -o 'custom-columns=NAME:.metadata.name,CLASS:.spec.storageClassName,RECLAIM:.spec.persistentVolumeReclaimPolicy,PINNED-TO:.spec.nodeAffinity.required.nodeSelectorTerms[0].matchExpressions[0].values[0]'
assert_eq "$(k get pv "$PV" -o jsonpath='{.spec.nodeAffinity.required.nodeSelectorTerms[0].matchExpressions[0].values[0]}')" \
  "$KNODE" \
  "$PV carries a REQUIRED nodeAffinity naming exactly one node, $KNODE — the bytes are a directory on that machine's disk"
note "nothing about this Pod looks special to drain: no emptyDir, and a"
note "ReplicaSet owns it. Neither --delete-emptydir-data nor --force applies."

run k drain "$KNODE" --ignore-daemonsets --delete-emptydir-data --timeout=300s \
  || fail "the drain of $KNODE did not complete"
ok "the drain completed and reported success — evicting the Pod was never the hard part"

assert_eventually 180 "1" "the ReplicaSet created a replacement Pod straight away" keeper_pod_count
STRANDED="$(k -n "$NS" get pods -l app=keeper -o jsonpath='{.items[0].metadata.name}')"
[ -n "$STRANDED" ] || fail "could not find the replacement keeper Pod"
assert_eventually 180 "Pending" "the replacement is Pending" \
  k -n "$NS" get pod "$STRANDED" -o 'jsonpath={.status.phase}'
assert_eventually 180 "yes" \
  "and the scheduler's reason is the volume: node(s) didn't match PersistentVolume's node affinity" \
  volume_affinity_rejected "$STRANDED"
run k -n "$NS" get events --field-selector "involvedObject.name=$STRANDED"
assert_eq "$(k -n "$NS" get pod "$STRANDED" -o jsonpath='{.spec.nodeName}')" "" \
  "it was never assigned to a node: $KNODE is cordoned, and $OTHER cannot reach the volume"
assert_eq "$(k -n "$NS" get pvc keeper-data -o jsonpath='{.status.phase}')" "Bound" \
  "the claim is still Bound and the file is still on disk — the data is fine, it is simply out of reach"
note "the drain exited 0. The workload is down. Both of those are true, and"
note "nothing in the drain's output hinted at the second one."

step "What this proves"
note "Cordon and drain are two different operations and it pays to keep them"
note "apart. cordon writes one boolean, .spec.unschedulable, which the node"
note "lifecycle controller mirrors as a node.kubernetes.io/unschedulable"
note "NoSchedule taint. It changes where the scheduler is willing to place new"
note "Pods and nothing else: every Pod already on $TARGET kept running, and the"
note "Deployment never dropped a replica."
note ""
note "drain cordons and then evicts. It refuses to start until you have answered"
note "for every category of Pod it cannot safely move: --ignore-daemonsets for"
note "Pods a DaemonSet would put straight back, --delete-emptydir-data for local"
note "scratch data that dies with the Pod, --force for bare Pods no controller"
note "would recreate. Those refusals happen before any eviction, so a rejected"
note "drain moves nothing — but it has already cordoned the node, which is why"
note "uncordon belongs in the cleanup path of a maintenance script rather than"
note "at the end of the happy path. This lab's own trap is that argument."
note ""
note "Eviction goes through the Eviction API, so a PodDisruptionBudget can veto"
note "it. minAvailable: 4 on four replicas left .status.disruptionsAllowed at 0,"
note "every eviction came back refused, and the drain burned its timeout and"
note "gave up having achieved nothing. The budget was not malfunctioning: it was"
note "enforcing exactly what it said. Scaling to six gave it two disruptions of"
note "headroom and the identical command then completed. A budget whose floor"
note "equals the replica count does not protect an app; it makes the app"
note "undrainable, which means unpatchable."
note ""
note "What a successful drain actually promises is narrow: the Pods on this node"
note "are gone, and their controllers have been given the chance to replace them"
note "elsewhere. It promises nothing about whether elsewhere exists. The keeper"
note "Deployment was evicted cleanly, drain exited 0, and the replacement Pod"
note "has been Pending ever since, because its PersistentVolume carries a hard"
note "nodeAffinity to the node that was just drained. That is not a bug in"
note "drain — it is node-local storage being exactly as available as the node"
note "it lives on. Replicated or networked storage is what makes a stateful"
note "workload survive planned maintenance, and 'we drain nodes routinely' is a"
note "claim about your storage layer before it is a claim about your Pods."
note ""
note "Finally: uncordon puts the node back in the scheduler's pool and moves"
note "nothing. Placement is decided once and written to .spec.nodeName, so the"
note "cluster stays lopsided until the next thing needs scheduling."
