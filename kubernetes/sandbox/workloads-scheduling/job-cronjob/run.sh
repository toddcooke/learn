#!/usr/bin/env bash
LAB="job-cronjob"
source "$(dirname "$0")/../../cluster/lib.sh"
require_cluster
ns_setup

step "A Job runs Pods to completion: completions 3, parallelism 2"
apply parallel-job.yaml
assert_eq "$(k -n "$NS" get job parallel-demo -o jsonpath='{.spec.completions}')" "3" \
  "the Job declares a quota of 3 completions"
assert_eq "$(k -n "$NS" get job parallel-demo -o jsonpath='{.spec.parallelism}')" "2" \
  "the Job declares a width limit of 2"
assert_eventually 120 "2" "two Pods were active at the same time — the first wave" \
  k -n "$NS" get job parallel-demo -o jsonpath='{.status.active}'
assert_eventually 180 "3" ".status.succeeded reached 3 — the quota is satisfied" \
  k -n "$NS" get job parallel-demo -o jsonpath='{.status.succeeded}'
run k -n "$NS" get pods -l batch.kubernetes.io/job-name=parallel-demo -o wide
note "three Pods for three completions, but never more than two at once: the Job"
note "ran in two waves. Nothing restarts them now — a Job that has met its quota"
note "is finished, which is the whole difference from a Deployment."

step "A Job Pod may not have restartPolicy: Always"
note '$ kubectl apply -f bad-restart-policy.yaml   # expected to be rejected'
if OUT="$(k -n "$NS" apply -f "$LAB_DIR/bad-restart-policy.yaml" 2>&1)"; then
  fail "expected the API server to reject restartPolicy: Always, but the apply succeeded"
fi
note "server said: $OUT"
assert_contains "$OUT" "restartPolicy" "the API server rejected the Job on spec.template.spec.restartPolicy"
assert_contains "$OUT" "Never" "the error names Never as a legal value"
assert_contains "$OUT" "OnFailure" "the error names OnFailure as a legal value"
note "Always means 'restart this container whenever it exits', which would make a"
note "successful exit indistinguishable from a crash. A Job could never finish, so"
note "the object is refused at validation time rather than created and stuck."

step "Indexed completion mode hands every Pod its own index"
apply indexed-job.yaml
run k -n "$NS" wait --for=condition=Complete job/indexed-demo --timeout=180s
RAW="$(k -n "$NS" logs -l batch.kubernetes.io/job-name=indexed-demo --tail=-1 2>&1 || true)"
LOGS="$(printf '%s' "$RAW" | tr '\n' ' ')"
note "logs from all three Pods: $LOGS"
assert_contains "$LOGS" "index=0" "one Pod saw JOB_COMPLETION_INDEX=0"
assert_contains "$LOGS" "index=1" "one Pod saw JOB_COMPLETION_INDEX=1"
assert_contains "$LOGS" "index=2" "one Pod saw JOB_COMPLETION_INDEX=2"
ONE="$(k -n "$NS" logs -l batch.kubernetes.io/job-name=indexed-demo,batch.kubernetes.io/job-completion-index=1 --tail=-1 2>&1 || true)"
assert_contains "$ONE" "index=1" "the Pod labelled completion-index 1 is the one that saw index 1"
run k -n "$NS" get pods -l batch.kubernetes.io/job-name=indexed-demo \
  --label-columns=batch.kubernetes.io/job-completion-index
note "the index arrives as an environment variable, an annotation and a label."
note "The label is what makes one shard addressable after the fact:"
note "kubectl get pods -l batch.kubernetes.io/job-completion-index=2"

step "backoffLimit: 2 means three attempts, then the Job gives up"
apply failing-job.yaml
note "each retry waits longer than the last (10s, then 20s), so this takes ~40s"
assert_eventually 240 "True" "the Failed condition flipped to True" \
  k -n "$NS" get job backoff-demo -o jsonpath='{.status.conditions[?(@.type=="Failed")].status}'
REASON="$(k -n "$NS" get job backoff-demo -o jsonpath='{.status.conditions[?(@.type=="Failed")].reason}' 2>/dev/null || true)"
assert_eq "$REASON" "BackoffLimitExceeded" "the failure reason is BackoffLimitExceeded"
BFAILED="$(k -n "$NS" get job backoff-demo -o jsonpath='{.status.failed}' 2>/dev/null || true)"
assert_eq "$BFAILED" "3" "three Pods failed: the first attempt plus two retries"
BSUCC="$(k -n "$NS" get job backoff-demo -o jsonpath='{.status.succeeded}' 2>/dev/null || true)"
assert_eq "$BSUCC" "" "nothing ever succeeded"
run k -n "$NS" get pods -l batch.kubernetes.io/job-name=backoff-demo
note "backoffLimit counts retries, not attempts — 2 buys you 3 Pods. And because"
note "restartPolicy is Never, every attempt is a separate Pod whose logs survive."

step "activeDeadlineSeconds outranks backoffLimit"
apply deadline-job.yaml
assert_eventually 180 "DeadlineExceeded" "the Job failed with reason DeadlineExceeded" \
  k -n "$NS" get job deadline-demo -o jsonpath='{.status.conditions[?(@.type=="Failed")].reason}'
DFAILED="$(k -n "$NS" get job deadline-demo -o jsonpath='{.status.failed}' 2>/dev/null || true)"
if [ "${DFAILED:-0}" -ge 7 ]; then
  fail "the Job burned all 7 attempts, so the deadline was not what stopped it"
fi
ok "the clock stopped the Job after ${DFAILED:-0} failed Pods, short of the 6 retries allowed"
DCONDS="$(k -n "$NS" get job deadline-demo -o jsonpath='{range .status.conditions[*]}{.type}={.reason} {end}' 2>/dev/null || true)"
note "conditions on the Job: $DCONDS"
note "the same container as the previous step, but backoffLimit: 6 would have"
note "permitted roughly ten minutes of exponential retrying. The 20-second"
note "deadline ended it first, and the reason string is how you tell 'out of"
note "tries' from 'out of time' when reading a failed Job in a postmortem."

step "A CronJob is a factory for Jobs, not a scheduler for Pods"
apply cronjob.yaml
run k -n "$NS" get cronjob heartbeat
assert_eq "$(k -n "$NS" get cronjob heartbeat -o jsonpath='{.spec.schedule}')" "*/1 * * * *" \
  "the schedule is every minute"
assert_eq "$(k -n "$NS" get cronjob heartbeat -o jsonpath='{.spec.concurrencyPolicy}')" "Forbid" \
  "concurrencyPolicy is Forbid"
assert_eq "$(k -n "$NS" get cronjob heartbeat -o jsonpath='{.spec.jobTemplate.spec.template.spec.restartPolicy}')" "OnFailure" \
  "the templated Pod uses restartPolicy OnFailure"
assert_eq "$(k -n "$NS" get cronjob heartbeat -o jsonpath='{.spec.suspend}')" "false" \
  "the CronJob is live, not suspended"
note "Forbid: if the next 60-second slot arrives while the previous Job is still"
note "running, that run is skipped rather than doubled up. Allow would run both;"
note "Replace would kill the straggler and start the new one."
note "this lab does not wait for the schedule to fire — a minute of wall clock"
note "proves nothing you cannot read off the object."
run k -n "$NS" patch cronjob heartbeat -p '{"spec":{"suspend":true}}'
assert_eq "$(k -n "$NS" get cronjob heartbeat -o jsonpath='{.spec.suspend}')" "true" \
  "patching .spec.suspend to true stops future runs"
note "suspend is the safe way to silence a CronJob: the object and its Job"
note "history survive, and any already-running Job is left alone."

step "Run the CronJob's template right now with kubectl create job --from"
run k -n "$NS" create job heartbeat-manual --from=cronjob/heartbeat
run k -n "$NS" wait --for=condition=Complete job/heartbeat-manual --timeout=180s
MANUAL="$(k -n "$NS" logs -l batch.kubernetes.io/job-name=heartbeat-manual --tail=-1 2>&1 || true)"
note "manual Job logs: $(printf '%s' "$MANUAL" | tr '\n' ' ')"
assert_contains "$MANUAL" "heartbeat" "the manual Job ran the CronJob's Pod template"
OWNER_KIND="$(k -n "$NS" get job heartbeat-manual -o jsonpath='{.metadata.ownerReferences[0].kind}' 2>/dev/null || true)"
OWNER_CTRL="$(k -n "$NS" get job heartbeat-manual -o jsonpath='{.metadata.ownerReferences[0].controller}' 2>/dev/null || true)"
assert_eq "$OWNER_KIND" "CronJob" "kubectl stamped an ownerReference back to the CronJob"
assert_eq "$OWNER_CTRL" "true" "and marked it the controlling owner"
ANN="$(k -n "$NS" get job heartbeat-manual -o jsonpath='{.metadata.annotations}' 2>/dev/null || true)"
note "annotations kubectl added: $ANN"
run k -n "$NS" get jobs

# The half-ownership here is genuinely surprising and worth stating carefully.
ACTIVE="$(k -n "$NS" get cronjob heartbeat -o jsonpath='{.status.active}' 2>/dev/null || true)"
assert_eq "$ACTIVE" "" "yet the CronJob's .status.active never lists it"
note "so the ownership is real but partial. Because the ownerReference is"
note "there, deleting the CronJob cascade-deletes this Job, and it counts"
note "against successfulJobsHistoryLimit — it can evict a genuinely scheduled"
note "run from the history. But because it never enters .status.active, it is"
note "invisible to concurrencyPolicy: a Forbid CronJob will happily start its"
note "scheduled run alongside a manual Job that is still going."

step "What this proves"
note "A Job is the controller for work that ends. completions is a quota of"
note "successful exits, parallelism is a cap on how many Pods chase that quota"
note "at once, and Indexed mode additionally numbers the Pods so each can claim"
note "a fixed slice of the work. Because a Job has to be able to recognise"
note "success, its Pods may only use restartPolicy Never or OnFailure, and the"
note "API server enforces that rather than letting you build a Job that can"
note "never complete. Failure is bounded twice over: backoffLimit bounds"
note "retries, activeDeadlineSeconds bounds elapsed time, whichever is reached"
note "first ends the Job, and the reason on the Failed condition tells you"
note "which. A CronJob adds nothing to that model but a clock — it stamps out"
note "Jobs on a schedule, concurrencyPolicy decides what a late run does to the"
note "next one, and suspend or 'create job --from' take manual control of it."
