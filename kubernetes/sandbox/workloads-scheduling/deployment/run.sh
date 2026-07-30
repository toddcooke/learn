#!/usr/bin/env bash
LAB="deployment"
source "$(dirname "$0")/../../cluster/lib.sh"
require_cluster
ns_setup

IMG_V1="registry.k8s.io/e2e-test-images/agnhost:2.52"
IMG_V2="registry.k8s.io/e2e-test-images/agnhost:2.53"

# Everything this lab creates is namespaced, so ns_teardown is enough for the
# cluster. The extra cleanup below is for the background sampler started in
# step 3: if an assertion fails while it is running, the trap has to stop it,
# or a kubectl loop would keep polling the API server after the script exits.
POLLER=""
SAMPLES=""
my_cleanup() {
  local code=$?
  if [ -n "$POLLER" ]; then
    kill "$POLLER" 2>/dev/null || true
    wait "$POLLER" 2>/dev/null || true
  fi
  if [ -n "$SAMPLES" ]; then rm -f "$SAMPLES"; fi
  (exit $code)
  ns_teardown
}
trap my_cleanup EXIT INT TERM

# --- small readers, so the assertions below stay one line each -------------
rs_names()    { k -n "$NS" get rs -o jsonpath='{range .items[*]}{.metadata.name}{"\n"}{end}'; }
rs_count()    { rs_names | wc -l | tr -d ' '; }
rs_desired()  { k -n "$NS" get rs "$1" -o jsonpath='{.spec.replicas}'; }
rs_image()    { k -n "$NS" get rs "$1" -o jsonpath='{.spec.template.spec.containers[0].image}'; }
dep_image()   { k -n "$NS" get deploy web -o jsonpath='{.spec.template.spec.containers[0].image}'; }
dep_revs()    { k -n "$NS" rollout history deployment/web | grep -E '^[0-9]+[[:space:]]' | awk '{print $1}' | tr '\n' ',' || true; }
pod_images()  { k -n "$NS" get pods -o jsonpath='{range .items[*]}{.spec.containers[0].image}{"\n"}{end}' | sort -u; }
pod_stamps()  { k -n "$NS" get pods -o jsonpath='{range .items[*]}{.metadata.annotations.kubectl\.kubernetes\.io/restartedAt}{"\n"}{end}' | sort -u; }
pod_names()   { k -n "$NS" get pods -o jsonpath='{range .items[*]}{.metadata.name}{"\n"}{end}' | sort | tr '\n' ' '; }

step "Create the Deployment: 3 replicas of agnhost 2.52"
apply web.yaml
if ! run k -n "$NS" rollout status deployment/web --timeout=300s; then
  fail "the initial rollout never completed"
fi
assert_eq "$(rs_count)" "1" "one ReplicaSet backs the Deployment"
RS_V1="$(rs_names)"
assert_eq "$(k -n "$NS" get rs "$RS_V1" -o jsonpath='{.metadata.annotations.deployment\.kubernetes\.io/revision}')" \
  "1" "it is annotated deployment.kubernetes.io/revision=1"
assert_eq "$(rs_desired "$RS_V1")" "3" "and it is scaled to 3"
note "the Deployment never creates Pods itself — it creates ReplicaSets,"
note "and the ReplicaSet creates the Pods"

step "Read the update strategy back from the API"
run k -n "$NS" get deploy web -o jsonpath='{.spec.strategy}{"\n"}'
assert_eq "$(k -n "$NS" get deploy web -o jsonpath='{.spec.strategy.rollingUpdate.maxSurge}')" \
  "1" "maxSurge is 1: at most one Pod above the desired 3"
assert_eq "$(k -n "$NS" get deploy web -o jsonpath='{.spec.strategy.rollingUpdate.maxUnavailable}')" \
  "0" "maxUnavailable is 0: never fewer than 3 available"
note "together these force a surge-first rollout: a replacement Pod must be"
note "Ready before any old Pod is allowed to go away"

step "Trigger a rolling update with kubectl set image"
SAMPLES="$(mktemp "${TMPDIR:-/tmp}/sandbox-deployment.XXXXXX")"
(
  while :; do
    if a="$(k -n "$NS" get deploy web -o jsonpath='{.status.availableReplicas}' 2>/dev/null)"; then
      # an absent field means zero available, so record it as 0 rather than
      # dropping the sample — a dip is exactly what this loop is looking for
      printf '%s\n' "${a:-0}" >>"$SAMPLES"
    fi
    sleep 0.5   # sampling interval, not synchronisation: the rollout below waits on its own
  done
) &
POLLER=$!
note "sampling .status.availableReplicas twice a second while the rollout runs"
run k -n "$NS" set image deployment/web app="$IMG_V2"
run k -n "$NS" annotate deployment/web kubernetes.io/change-cause="upgrade to agnhost 2.53" --overwrite
if ! run k -n "$NS" rollout status deployment/web --timeout=300s; then
  fail "the rolling update never completed"
fi
kill "$POLLER" 2>/dev/null || true
wait "$POLLER" 2>/dev/null || true
POLLER=""
MIN="$(grep -E '^[0-9]+$' "$SAMPLES" | sort -n | head -1 || true)"
SEEN="$(grep -cE '^[0-9]+$' "$SAMPLES" || true)"
rm -f "$SAMPLES"; SAMPLES=""
if [ -z "$MIN" ]; then fail "collected no availability samples during the rollout"; fi
if [ "$MIN" -lt 3 ]; then
  fail "availableReplicas fell to $MIN during the rollout — maxUnavailable: 0 was violated"
fi
ok "availableReplicas never dropped below 3 across $SEEN samples"
assert_eq "$(dep_image)" "$IMG_V2" "the Deployment's pod template now names agnhost:2.53"

step "The update created a second ReplicaSet and drained the first"
run k -n "$NS" get rs -o wide
assert_eq "$(rs_count)" "2" "two ReplicaSets now exist"
RS_V2="$(rs_names | grep -vxF "$RS_V1" || true)"
if [ -z "$RS_V2" ]; then fail "could not identify the new ReplicaSet"; fi
assert_eventually 60 "0" "the original ReplicaSet is scaled to 0" rs_desired "$RS_V1"
assert_eq "$(rs_desired "$RS_V2")" "3" "the new ReplicaSet is scaled to 3"
assert_eq "$(rs_image "$RS_V2")" "$IMG_V2" "the new ReplicaSet's template carries 2.53"
assert_eq "$(rs_image "$RS_V1")" "$IMG_V1" "the empty one still remembers 2.52"
note "the drained ReplicaSet is kept, not deleted — it is the rollback target,"
note "and revisionHistoryLimit (10 here) is how many such shells are kept"

step "rollout history lists one revision per ReplicaSet"
run k -n "$NS" rollout history deployment/web
assert_eventually_contains 60 "upgrade to agnhost 2.53" \
  "the change-cause annotation reached revision 2" \
  k -n "$NS" rollout history deployment/web
HIST="$(k -n "$NS" rollout history deployment/web)"
assert_contains "$HIST" "initial rollout: agnhost 2.52" "revision 1 kept its own change-cause"
assert_eq "$(dep_revs)" "1,2," "history lists exactly revisions 1 and 2"
R1="$(k -n "$NS" rollout history deployment/web --revision=1)"
assert_contains "$R1" "$IMG_V1" "revision 1's stored pod template still names 2.52"

step "rollout undo puts the previous revision back"
run k -n "$NS" rollout undo deployment/web
if ! run k -n "$NS" rollout status deployment/web --timeout=300s; then
  fail "the rollback never completed"
fi
assert_eq "$(dep_image)" "$IMG_V1" "the image is back to agnhost:2.52"
assert_eq "$(rs_count)" "2" "still two ReplicaSets — undo created nothing new"
assert_eventually 60 "3" "the original ReplicaSet was scaled back up to 3" rs_desired "$RS_V1"
assert_eventually 60 "0" "the 2.53 ReplicaSet was scaled down to 0" rs_desired "$RS_V2"
assert_eventually 120 "$IMG_V1" "every running Pod is on 2.52 again" pod_images
assert_eq "$(k -n "$NS" get deploy web -o jsonpath='{.metadata.annotations.kubernetes\.io/change-cause}')" \
  "initial rollout: agnhost 2.52" "undo restored that revision's change-cause too"
assert_eq "$(dep_revs)" "2,3," "the rollback is itself a new revision: 1 is gone, 3 appeared"
note "undo re-used the old ReplicaSet and renumbered it, so revision numbers"
note "move with ReplicaSets rather than staying fixed to a point in time"

step "rollout pause freezes the controller; resume lets it finish"
run k -n "$NS" rollout pause deployment/web
run k -n "$NS" set image deployment/web app="$IMG_V2"
GEN="$(k -n "$NS" get deploy web -o jsonpath='{.metadata.generation}')"
assert_eq "$(dep_image)" "$IMG_V2" "the spec accepted the new image (generation $GEN)"
assert_eventually 60 "$GEN" "the controller has observed that generation" \
  k -n "$NS" get deploy web -o jsonpath='{.status.observedGeneration}'
assert_eventually 60 "DeploymentPaused" "and reports Progressing=Unknown, reason DeploymentPaused" \
  k -n "$NS" get deploy web -o jsonpath='{.status.conditions[?(@.type=="Progressing")].reason}'
assert_eq "$(pod_images)" "$IMG_V1" "yet every running Pod is still on 2.52"
assert_eq "$(rs_desired "$RS_V2")" "0" "and the 2.53 ReplicaSet is still at 0"
if OUT="$(k -n "$NS" rollout undo deployment/web 2>&1)"; then
  fail "expected kubectl to refuse an undo on a paused Deployment"
fi
assert_contains "$OUT" "cannot rollback a paused deployment" "undo is refused while paused"
run k -n "$NS" rollout resume deployment/web
if ! run k -n "$NS" rollout status deployment/web --timeout=300s; then
  fail "the resumed rollout never completed"
fi
assert_eq "$(dep_image)" "$IMG_V2" "after resume the Deployment is on 2.53 again"
assert_eq "$(rs_count)" "2" "still two ReplicaSets: that pod template hash already existed"
assert_eventually 60 "3" "the 2.53 ReplicaSet is back at 3" rs_desired "$RS_V2"
assert_eventually 60 "0" "the 2.52 ReplicaSet is back at 0" rs_desired "$RS_V1"

step "rollout restart replaces every Pod without changing the image"
BEFORE="$(pod_names)"
run k -n "$NS" rollout restart deployment/web
if ! run k -n "$NS" rollout status deployment/web --timeout=300s; then
  fail "the restart rollout never completed"
fi
STAMP="$(k -n "$NS" get deploy web -o jsonpath='{.spec.template.metadata.annotations.kubectl\.kubernetes\.io/restartedAt}')"
if [ -z "$STAMP" ]; then
  fail "no kubectl.kubernetes.io/restartedAt annotation on the pod template"
fi
ok "the pod template carries kubectl.kubernetes.io/restartedAt=$STAMP"
assert_eventually 120 "$STAMP" "every running Pod carries that same stamp" pod_stamps
if [ "$BEFORE" = "$(pod_names)" ]; then fail "the Pods were not replaced"; fi
ok "all three Pod names changed — these are new Pods, not restarted containers"
assert_eq "$(dep_image)" "$IMG_V2" "the image is untouched: a restart is not an update"
assert_eq "$(rs_count)" "3" "a third ReplicaSet appeared, because the annotation changed the template hash"
run k -n "$NS" rollout history deployment/web
assert_eq "$(dep_revs)" "3,4,5," "five spec changes, three ReplicaSets, revisions 3-4-5"
note "the CHANGE-CAUSE column now reads the same on every row: undo replaced"
note "the Deployment's annotations with revision 1's, and every revision since"
note "has inherited them. It is a label you maintain, not an audit log."

step "What this proves"
note "A Deployment is a controller over ReplicaSets. Every change to the pod"
note "template is hashed; a template hash it has never seen becomes a new"
note "ReplicaSet, and one it has seen before is re-used. The rollout is then"
note "just arithmetic on two scale counts, bounded by maxSurge above and"
note "maxUnavailable below — which is why availableReplicas held at 3 the"
note "whole way through the upgrade."
note ""
note "Everything else follows from that. History exists because the drained"
note "ReplicaSets are kept, so undo is a scale-up of a shell that never went"
note "away. Pause stops the arithmetic while still accepting spec edits, so a"
note "batch of changes can roll out as one. Restart owns no new machinery at"
note "all: it stamps restartedAt on the template, which changes the hash, and"
note "the ordinary rolling update does the rest."
