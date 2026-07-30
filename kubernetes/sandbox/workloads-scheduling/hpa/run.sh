#!/usr/bin/env bash
LAB="hpa"
source "$(dirname "$0")/../../cluster/lib.sh"
require_cluster
require_addon metrics-server
ns_setup

# Everything this lab creates — Service, Deployment, HorizontalPodAutoscaler
# and the load generator Pod — is namespaced, so ns_teardown removes all of
# it. Nothing cluster-scoped is created and no node is touched, so the trap
# ns_setup installed is the only cleanup needed.

TARGET=50    # spec.metrics[0].resource.target.averageUtilization in hpa.yaml
MINR=1       # spec.minReplicas
MAXR=4       # spec.maxReplicas
REQ=50m      # the container's CPU request: the denominator of "utilization"

# --- small readers, so the assertions below stay one line each -------------
dep_replicas() { k -n "$NS" get deploy web -o jsonpath='{.spec.replicas}'; }
dep_ready()    { k -n "$NS" get deploy web -o jsonpath='{.status.readyReplicas}'; }
hpa_util()     { k -n "$NS" get hpa web -o jsonpath='{.status.currentMetrics[0].resource.current.averageUtilization}'; }
web_top_rows() { k -n "$NS" top pods --no-headers 2>/dev/null | grep -c '^web-' || true; }

# One read, so the three numbers are guaranteed to come from the same
# reconcile: how many replicas the controller saw, what utilization it
# measured across them, and the replica count it decided on.
hpa_snapshot() {
  k -n "$NS" get hpa web \
    -o jsonpath='{.status.currentReplicas} {.status.desiredReplicas} {.status.currentMetrics[0].resource.current.averageUtilization}'
}

metric_known() { if [ -n "$(hpa_util)" ]; then echo known; else echo unknown; fi; }
scaled_out()   { local r; r="$(dep_replicas)"; if [ "${r:-0}" -ge 2 ]; then echo yes; else echo "no(${r:-none})"; fi; }
ready_out()    { local r; r="$(dep_ready)";    if [ "${r:-0}" -ge 2 ]; then echo yes; else echo "no(${r:-0})"; fi; }
top_multi()    { local n; n="$(web_top_rows)"; if [ "${n:-0}" -ge 2 ]; then echo yes; else echo "no($n)"; fi; }

step "A one-replica Deployment with a ${REQ} CPU request, behind a Service"
apply service.yaml
apply web.yaml
if ! run k -n "$NS" rollout status deployment/web --timeout=180s; then
  fail "the web Deployment never became ready"
fi
assert_eq "$(k -n "$NS" get deploy web -o jsonpath='{.spec.template.spec.containers[0].resources.requests.cpu}')" \
  "$REQ" "the container requests ${REQ} of CPU"
note "utilization is a percentage of that request, so a ${TARGET}% target means"
note "${TARGET}% of ${REQ} = 25m of CPU per Pod. Requests are the denominator the"
note "HPA divides by; without one it has nothing to divide and reports <unknown>."

step "kubectl top reads the same Metrics API the HPA reads"
assert_eventually_contains 240 "web-" "kubectl top pods returns a row for the web Pod" \
  k -n "$NS" top pods
run k -n "$NS" top pods
note "metrics-server scrapes every kubelet's summary endpoint on a 15s cycle and"
note "serves the result as metrics.k8s.io. kubectl top and the HPA are two"
note "clients of that one API, which is why an empty top is the first thing to"
note "check when an HPA sits at <unknown> and refuses to move."

step "Create the HorizontalPodAutoscaler"
apply hpa.yaml
assert_eq "$(k -n "$NS" get hpa web -o jsonpath='{.spec.scaleTargetRef.kind}/{.spec.scaleTargetRef.name}')" \
  "Deployment/web" "it targets Deployment/web"
assert_eq "$(k -n "$NS" get hpa web -o jsonpath='{.spec.metrics[0].resource.target.averageUtilization}')" \
  "$TARGET" "its target is ${TARGET}% average CPU utilization"
assert_eventually 180 "known" "it is reading a CPU number out of the Metrics API" metric_known
assert_eventually 120 "True" "its ScalingActive condition is True" \
  k -n "$NS" get hpa web -o jsonpath='{.status.conditions[?(@.type=="ScalingActive")].status}'
run k -n "$NS" get hpa web
assert_contains "$(k -n "$NS" get hpa web)" "/${TARGET}%" "the TARGETS column reads current vs target"
assert_eventually 120 "1" "idle, it wants exactly the one replica already running" \
  k -n "$NS" get hpa web -o jsonpath='{.status.desiredReplicas}'
note "an idle Pod uses about 1m of its ${REQ}, so the ratio is nowhere near the"
note "target — and the answer is still 1, because the formula rounds up. An HPA"
note "cannot take a workload to zero: minReplicas may not be set below 1 unless"
note "the cluster has the alpha HPAScaleToZero feature gate enabled."
if SCALE="$(k -n "$NS" get deploy web --subresource=scale -o jsonpath='{.spec.replicas}' 2>/dev/null)"; then
  assert_eq "$SCALE" "$(dep_replicas)" "the scale subresource carries the same replica count"
  note "that subresource, not the Deployment itself, is what the HPA writes to —"
  note "which is exactly why a DaemonSet, which has none, cannot be autoscaled"
else
  note "this kubectl has no --subresource flag; skipping the scale subresource read"
fi

step "Point a load generator at the Service"
apply load.yaml
if ! run k -n "$NS" wait --for=condition=Ready pod/load --timeout=180s; then
  fail "the load generator Pod never became ready"
fi
if ! OUT="$(k -n "$NS" exec load -- wget -q -O - "http://web:8080/shell?cmd=hostname" 2>&1)"; then
  fail "the load generator could not reach the Service: $OUT"
fi
assert_contains "$OUT" "web-" "one request made a web Pod fork a shell and report its own hostname"
note "that fork is the point: an idle netexec Pod uses about 1m of CPU, and"
note "answering a trivial request costs it a fraction of a millisecond. Making"
note "the server spend milliseconds per request is what lets one single-threaded"
note "client push it well past 25m without outweighing it."

step "Watch the controller decide"
note "polling .status on the HPA once a second. Nothing is instant here: the"
note "controller re-evaluates every 15s, and the metric it reads is itself up to"
note "15s old, so expect a decision somewhere in the first minute."
CAP_KIND=""; CAP_CUR=""; CAP_DES=""; CAP_UTIL=""
CUR=""; DES=""; UTIL=""
DEADLINE=$((SECONDS + 300))
while [ "$SECONDS" -lt "$DEADLINE" ]; do
  CUR=""; DES=""; UTIL=""
  read -r CUR DES UTIL <<<"$(hpa_snapshot 2>/dev/null || true)" || true
  if [ -n "$CUR" ] && [ -n "$DES" ] && [ -n "$UTIL" ]; then
    # Three states in which the published triple can be checked against the
    # formula with no ambiguity at all. The first is the interesting one: a
    # decision taken while there is exactly one replica, so the count the
    # controller multiplied by and the count it published are the same number
    # and no half-started Pod can have been set aside from the average.
    # Each condition also keeps clear of the edges of the tolerance band, so
    # that a value sitting exactly on 45% or 55% — where the controller's
    # float comparison and this script's integer one could disagree by one
    # replica — is never the sample we reason about.
    if [ "$CUR" -eq 1 ] && [ "$DES" -gt "$CUR" ] && [ "$UTIL" -gt 55 ]; then
      CAP_KIND="a scale-up decision"
    # Pinned at the ceiling: the formula wants more than maxReplicas.
    elif [ "$DES" -eq "$CUR" ] && [ "$CUR" -eq "$MAXR" ] && [ "$UTIL" -gt 55 ]; then
      CAP_KIND="the count held at maxReplicas"
    # Settled inside the tolerance band, where the answer is "change nothing".
    elif [ "$DES" -eq "$CUR" ] && [ "$CUR" -gt 1 ] && [ "$UTIL" -ge 46 ] && [ "$UTIL" -le 54 ]; then
      CAP_KIND="a settled count inside the tolerance band"
    fi
    if [ -n "$CAP_KIND" ]; then
      CAP_CUR="$CUR"; CAP_DES="$DES"; CAP_UTIL="$UTIL"
      break
    fi
  fi
  sleep 1   # poll interval, not synchronisation: the loop below has its own deadline
done
if [ -z "$CAP_KIND" ]; then
  fail "no usable HPA status in 300s (last: currentReplicas=${CUR:-?} desiredReplicas=${DES:-?} cpu=${UTIL:-?}%)"
fi
note "captured $CAP_KIND from .status:"
note "  currentReplicas=$CAP_CUR  currentCPU=${CAP_UTIL}%  desiredReplicas=$CAP_DES"
assert_eventually 300 "yes" "the Deployment's replica count went past its initial 1" scaled_out
if ! run k -n "$NS" rollout status deployment/web --timeout=300s; then
  fail "the replicas the HPA added never became ready"
fi
assert_eventually 120 "yes" "at least two replicas are Ready and taking traffic" ready_out
assert_eventually 240 "yes" "kubectl top now reports a row per replica" top_multi
run k -n "$NS" top pods
run k -n "$NS" get hpa web

step "Reconcile that decision against the formula"
note "desiredReplicas = ceil(currentReplicas x currentMetric / targetMetric)"
DIFF=$(( CAP_UTIL - TARGET ))
if [ "$DIFF" -lt 0 ]; then DIFF=$(( -DIFF )); fi
if [ $(( DIFF * 10 )) -le "$TARGET" ]; then
  # |1 - ratio| <= 0.1: the default tolerance. Treated as noise, not signal.
  EXPECT="$CAP_CUR"
  note "${CAP_UTIL}% is within 10% of the ${TARGET}% target, so the ratio counts as"
  note "noise, the controller changes nothing, and the answer is currentReplicas"
else
  EXPECT=$(( (CAP_CUR * CAP_UTIL + TARGET - 1) / TARGET ))
  note "ceil($CAP_CUR x ${CAP_UTIL}% / ${TARGET}%) = $EXPECT"
fi
if [ "$EXPECT" -gt "$MAXR" ]; then
  note "$EXPECT is more than maxReplicas ($MAXR), so the controller clamps it to $MAXR"
  note "and says so in a ScalingLimited condition rather than silently rounding"
  EXPECT="$MAXR"
fi
if [ "$EXPECT" -lt "$MINR" ]; then
  note "$EXPECT is below minReplicas ($MINR), so the controller raises it to $MINR"
  EXPECT="$MINR"
fi
assert_eq "$CAP_DES" "$EXPECT" "the count the HPA published is the count the formula predicts"
run k -n "$NS" get hpa web -o jsonpath='{range .status.conditions[*]}{.type}={.status} ({.reason}){"\n"}{end}'
note "the arithmetic is the whole controller. Everything else in .status —"
note "the conditions, the clamps, the tolerance band — exists to decide whether"
note "to act on that number, not to compute a different one."

step "The rescale is on the record"
assert_eventually_contains 180 "SuccessfulRescale" "the HPA emitted a SuccessfulRescale event" \
  k -n "$NS" get events --field-selector reason=SuccessfulRescale
MSG="$(k -n "$NS" get events --field-selector reason=SuccessfulRescale -o jsonpath='{.items[0].message}')"
assert_contains "$MSG" "New size:" "and the event says what it changed and why"
note "$MSG"

step "Why spec.replicas has to come out of the manifest"
BEFORE="$(dep_replicas)"
if [ "${BEFORE:-0}" -lt 2 ]; then fail "expected the HPA to have scaled out before this step"; fi
note "the HPA currently holds the Deployment at $BEFORE replicas, and web.yaml"
note "still says replicas: 1. Re-applying that unchanged file:"
note "  \$ kubectl apply -f web.yaml"
# Read .spec.replicas out of the apply response itself, so that nothing can
# race between the write and the read.
AFTER="$(k -n "$NS" apply -f "$LAB_DIR/web.yaml" -o jsonpath='{.spec.replicas}')"
assert_eq "$AFTER" "1" "one apply reset the count from $BEFORE to the manifest's 1"
note "no error and no warning. apply sent replicas: 1 because that is what the"
note "file says, and $(( BEFORE - 1 )) Pods were terminated for it. Nothing about an HPA"
note "makes a workload's own spec read-only."
assert_eventually 240 "yes" "within a sync period the HPA scales it back out" scaled_out

note "web-autoscaled.yaml is that same Deployment with the replicas line deleted:"
note "  \$ kubectl apply -f web-autoscaled.yaml"
BEFORE2="$(dep_replicas)"
AFTER2="$(k -n "$NS" apply -f "$LAB_DIR/web-autoscaled.yaml" -o jsonpath='{.spec.replicas}')"
assert_eq "$AFTER2" "1" "the FIRST apply without the field still drops to 1, from $BEFORE2"
note "which surprises everyone once. Removing a field from a file is not the"
note "same as declining to manage it: apply diffs against the last-applied"
note "annotation, sees a field that used to be managed and is now gone, and"
note "sends replicas: null — which the API server defaults straight back to 1."
assert_eventually 240 "yes" "and once more the HPA scales it back out" scaled_out

BEFORE3="$(dep_replicas)"
note "applying the very same file a second time, now at $BEFORE3 replicas:"
AFTER3="$(k -n "$NS" apply -f "$LAB_DIR/web-autoscaled.yaml" -o jsonpath='{.spec.replicas}')"
if [ "${AFTER3:-0}" -lt 2 ]; then
  fail "the second apply reset the count to ${AFTER3:-none}"
fi
ok "the second apply left the count at $AFTER3 — the field is now unmanaged"
note "replicas is gone from the last-applied annotation as well, so apply has"
note "nothing to say about it and the autoscaler's number survives. One dip is"
note "the whole cost of the migration, which is why you delete the field during"
note "a maintenance window rather than in the middle of an incident."

step "What this proves"
note "A HorizontalPodAutoscaler is a control loop with a very short body. Every"
note "15s it reads one number out of the Metrics API — which is the same number"
note "kubectl top prints, and which does not exist until metrics-server is"
note "installed — divides it by the target, multiplies by the replica count it"
note "sees, rounds up, and writes the result to the target's scale subresource."
note ""
note "This run captured the controller's own published triple and rebuilt its"
note "decision from it: currentReplicas=$CAP_CUR at ${CAP_UTIL}% against a ${TARGET}% target"
note "gives desiredReplicas=$CAP_DES, and that is what .status said. Utilization is"
note "measured against the CPU request, so the request is not merely a"
note "scheduling hint here — change it and you change what 50% means."
note ""
note "The guards around that arithmetic are the parts that bite in production."
note "A 10% tolerance band stops the count flapping on noise. minReplicas and"
note "maxReplicas clamp the answer, and a clamped HPA says so in a"
note "ScalingLimited condition rather than quietly under-serving. Scale-up is"
note "immediate but scale-down waits out a 300s stabilization window, so a"
note "workload sheds replicas far more slowly than it gains them — which is why"
note "this lab could assert the way up and only describe the way down."
note ""
note "And the replica count now has an owner. Leave spec.replicas in a manifest"
note "the HPA manages and every apply — every CI deploy, every GitOps sync —"
note "silently overwrites the autoscaler's decision with a number someone typed"
note "months ago."
