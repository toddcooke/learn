#!/usr/bin/env bash
LAB="pod-failure-states"
source "$(dirname "$0")/../../cluster/lib.sh"
require_cluster
ns_setup

# Everything this lab creates is a Pod inside $NS. There is no cluster-scoped
# object, no node label or taint, and nothing written onto a node, so the trap
# ns_setup installed is the whole of the cleanup story. The only thing worth
# knowing is that two of these Pods keep crashing for as long as the namespace
# exists, which is why KEEP=1 carries a warning in the README.

# --- small readers, so each assertion below stays one line -----------------
# Events for one object, as "reason: message" lines. This is the same content
# kubectl describe prints under Events, minus the formatting.
pod_events()     { k -n "$NS" get events --field-selector "involvedObject.name=$1" \
                     -o jsonpath='{range .items[*]}{.reason}{": "}{.message}{"\n"}{end}'; }
phase_of()       { k -n "$NS" get pod "$1" -o jsonpath='{.status.phase}'; }
waiting_reason() { k -n "$NS" get pod "$1" -o jsonpath='{.status.containerStatuses[0].state.waiting.reason}'; }
last_reason()    { k -n "$NS" get pod "$1" -o jsonpath='{.status.containerStatuses[0].lastState.terminated.reason}'; }
last_exit()      { k -n "$NS" get pod "$1" -o jsonpath='{.status.containerStatuses[0].lastState.terminated.exitCode}'; }
restarts_of()    { k -n "$NS" get pod "$1" -o jsonpath='{.status.containerStatuses[0].restartCount}'; }
# The restart count reported for a container in its first backoff may still be
# 0 — the number tracks completed restarts, not deaths — so poll on the
# predicate rather than on a particular value.
restarted_once() {
  local n; n="$(restarts_of "$1" 2>/dev/null || echo 0)"
  if [ "${n:-0}" -ge 1 ]; then echo yes; else echo no; fi
}

step "Four Pods, broken four different ways"
apply pending-unschedulable.yaml
apply image-pull-failure.yaml
apply crashloop.yaml
apply oomkilled.yaml
COUNT="$(k -n "$NS" get pods --no-headers | wc -l | tr -d '[:space:]')"
assert_eq "$COUNT" "4" "all four Pods were accepted by the API server"
note "every one of these manifests is valid YAML and passed admission. Nothing"
note "about a Pod object being created says the workload will ever run."

step "First read: kubectl get pod, for the state"
run k -n "$NS" get pods -o wide
note "the STATUS column is a summary the CLI assembles, and it is not the Pod"
note "phase: for a container stuck in .state.waiting, kubectl prints the waiting"
note "reason instead. That is why CrashLoopBackOff and ImagePullBackOff show up"
note "here even though neither is a value .status.phase can ever hold."
note "give the states a moment to settle; the assertions below wait for them."

step "Pod 1 — Pending: the scheduler never found a node for it"
assert_eventually 90 "Pending" "pending-hog is in phase Pending" phase_of pending-hog
assert_eq "$(k -n "$NS" get pod pending-hog -o jsonpath='{.spec.nodeName}')" "" \
  "its .spec.nodeName is empty — no node was ever assigned"
assert_eq "$(k -n "$NS" get pod pending-hog \
  -o jsonpath='{.status.conditions[?(@.type=="PodScheduled")].status}')" "False" \
  "its PodScheduled condition is False"
assert_eq "$(k -n "$NS" get pod pending-hog \
  -o jsonpath='{.status.conditions[?(@.type=="PodScheduled")].reason}')" "Unschedulable" \
  "...with reason Unschedulable"
assert_eq "$(k -n "$NS" get pod pending-hog -o jsonpath='{.status.containerStatuses}' 2>/dev/null || true)" "" \
  "and .status.containerStatuses is absent entirely — no kubelet ever saw this Pod"

note "second read: kubectl describe pod, for the Events. This is the only place"
note "the reason lives; the Pod's own fields say 'unschedulable' and stop there."
assert_eventually_contains 120 "FailedScheduling" \
  "pending-hog has a FailedScheduling event" pod_events pending-hog
EV="$(pod_events pending-hog)"
assert_contains "$EV" "Insufficient cpu" \
  "...and the message names the shortage: Insufficient cpu"
assert_contains "$(k -n "$NS" describe pod pending-hog)" "FailedScheduling" \
  "kubectl describe surfaces the same record under Events"
run k -n "$NS" get events --field-selector involvedObject.name=pending-hog

note "third read: kubectl logs. There is nothing to read — and note HOW."
LOG_OUT="$(k -n "$NS" logs pending-hog 2>&1)"; LOG_RC=$?
assert_eq "$LOG_RC" "0" "kubectl logs SUCCEEDS on a Pod that was never scheduled"
assert_eq "$LOG_OUT" "" "...and prints nothing at all"
note "This is a trap. Silence here does not mean the app started and logged"
note "nothing; it means no container ever existed to log. Compare it with the"
note "ImagePullBackOff Pod below, where a container does exist but has not"
note "started: there kubectl logs FAILS and says why. Empty-and-successful"
note "means 'never scheduled'; an error means 'scheduled, not yet running'."
note "Pending is not an error and nothing times out. The scheduler will keep"
note "retrying this Pod forever, because a cluster that grew a large enough"
note "node later would place it. An ordinary edit of a Pod's resources is"
note "rejected — a Pod spec is very nearly immutable — so the fix is to"
note "re-create it with a request the cluster can satisfy, or to add capacity."
note "(In-place resize went stable in v1.35, but it is a separate subresource,"
note "kubectl patch --subresource=resize, and it addresses running containers.)"

step "Pod 2 — ImagePullBackOff: scheduled, but the image does not exist"
assert_eventually_contains 180 "ImagePullBackOff" \
  "image-pull-fail's container is waiting with reason ImagePullBackOff" \
  waiting_reason image-pull-fail
NODE="$(k -n "$NS" get pod image-pull-fail -o jsonpath='{.spec.nodeName}')"
if [ -z "$NODE" ]; then fail "expected image-pull-fail to have been scheduled"; fi
ok "unlike pending-hog it does have a node ($NODE): scheduling succeeded"
assert_eventually 60 "Pending" \
  "yet its phase is still Pending — a Pod whose container never started is not Running" \
  phase_of image-pull-fail
assert_eq "$(last_reason image-pull-fail)" "" \
  "and .lastState is empty: there was never a container to terminate"

assert_eventually_contains 90 "Failed to pull image" \
  "the events record the pull failure itself" pod_events image-pull-fail
assert_eventually_contains 90 "Back-off pulling image" \
  "...and a Back-off event for each retry the kubelet declines to make" \
  pod_events image-pull-fail
assert_eventually_contains 120 "ImagePullBackOff" \
  "kubectl describe reports the same waiting reason" k -n "$NS" describe pod image-pull-fail
run k -n "$NS" get events --field-selector involvedObject.name=image-pull-fail
if OUT="$(k -n "$NS" logs image-pull-fail 2>&1)"; then
  fail "expected kubectl logs to fail for a container that never started"
fi
assert_contains "$OUT" "waiting to start" \
  "kubectl logs says the container is waiting to start, and returns nothing"
note "the distinction that matters: pending-hog is the scheduler's problem and"
note "image-pull-fail is the kubelet's. Both read as 'not running', and"
note ".spec.nodeName tells them apart in one line."

step "Pod 3 — CrashLoopBackOff: it starts, then exits 1"
assert_eventually_contains 180 "CrashLoopBackOff" \
  "crashloop's container is waiting with reason CrashLoopBackOff" \
  waiting_reason crashloop
assert_eventually 60 "Running" \
  "the Pod phase is Running, not Failed — the classic mismatch with the STATUS column" \
  phase_of crashloop
note "a container waiting to be restarted counts as stopped-and-restarting, and"
note "with restartPolicy Always that phase is Running. CrashLoopBackOff is not"
note "a phase; it is the kubelet telling you it is waiting out a backoff timer."
assert_eventually 90 "Error" "lastState.terminated.reason is Error" last_reason crashloop
assert_eventually 60 "1" \
  "lastState.terminated.exitCode is 1 — the container's own chosen exit status" \
  last_exit crashloop
assert_eventually 150 "yes" \
  "the kubelet has restarted the container at least once" restarted_once crashloop
note "restartCount is now $(restarts_of crashloop)"
assert_eventually_contains 120 "Back-off restarting failed container" \
  "describe shows the kubelet backing off between restarts" k -n "$NS" describe pod crashloop

note "third read, and this time it is the one that matters: kubectl logs"
note "--previous, which asks for the instance that already died."
assert_eventually_contains 180 "config file /etc/app/config.yaml not found" \
  "logs --previous returned the crashed instance's own error message" \
  k -n "$NS" logs crashloop --previous
run k -n "$NS" logs crashloop --previous
NOW="$(k -n "$NS" logs crashloop 2>&1 || true)"
note "plain kubectl logs right now returned: $(printf '%s' "$NOW" | tr '\n' ' ')"
note "that is not a reliable substitute. Without --previous the kubelet serves"
note "the current instance when one is running, and only falls back to the last"
note "terminated one while the Pod sits in backoff. Which of those you get"
note "depends on when you typed the command; --previous does not."
note "the backoff doubles — 10s, 20s, 40s, up to a 5 minute ceiling — so a Pod"
note "that has been looping all night restarts rarely. Waiting for a specific"
note "restart count is a mistake; read the state and the last termination."

step "Pod 4 — OOMKilled: the kernel killed it at its memory limit"
assert_eventually 240 "OOMKilled" \
  "lastState.terminated.reason is OOMKilled" last_reason oom-victim
assert_eventually 90 "137" \
  "lastState.terminated.exitCode is 137 — 128 + 9, the conventional way to write 'killed by SIGKILL'" \
  last_exit oom-victim
assert_contains "$(k -n "$NS" describe pod oom-victim)" "OOMKilled" \
  "describe shows the same verdict under Last State"
run k -n "$NS" get pod oom-victim \
  -o jsonpath='{.status.containerStatuses[0].lastState.terminated}{"\n"}'
assert_eventually_contains 180 "memory limit for this container is 64Mi" \
  "logs --previous recovers the killed instance's output too" \
  k -n "$NS" logs oom-victim --previous
run k -n "$NS" logs oom-victim --previous --tail=4

assert_eventually 240 "CrashLoopBackOff" \
  "and this Pod ALSO ends up in CrashLoopBackOff — the state name is not the diagnosis" \
  waiting_reason oom-victim
assert_eq "$(last_reason crashloop)" "Error" \
  "crashloop's lastState reason is still Error — a process that chose to exit"
assert_eq "$(last_reason oom-victim)" "OOMKilled" \
  "oom-victim's is OOMKilled — a process that was killed. Same STATUS, different cause."
note "restartPolicy Always turns every repeating failure into CrashLoopBackOff"
note "eventually, whatever killed it. lastState.terminated is where the two"
note "cases separate, and an exit code of 137 is the tell for memory."

step "The whole triage on one screen"
run k -n "$NS" get pods
run k -n "$NS" get pods -o custom-columns='NAME:.metadata.name,PHASE:.status.phase,WAITING:.status.containerStatuses[0].state.waiting.reason,LAST:.status.containerStatuses[0].lastState.terminated.reason,EXIT:.status.containerStatuses[0].lastState.terminated.exitCode,RESTARTS:.status.containerStatuses[0].restartCount'
# Assert the four distinct signatures are all on screen at once, rather than
# claiming no container is ever ready. That blanket claim is not actually true:
# oom-victim genuinely runs — and, having no readiness probe, reports ready —
# for the twenty-odd seconds it spends allocating before the kernel kills it.
# "Not ready right now" is a property of when you looked; the diagnosis is not.
SUMMARY="$(k -n "$NS" get pods -o custom-columns='A:.status.phase,B:.status.containerStatuses[0].state.waiting.reason,C:.status.containerStatuses[0].lastState.terminated.reason')"
assert_contains "$SUMMARY" "ImagePullBackOff" "the summary shows a Pod that never pulled its image"
assert_contains "$SUMMARY" "CrashLoopBackOff" "...one that starts and exits"
assert_contains "$SUMMARY" "OOMKilled"        "...one the kernel killed at its limit"
assert_contains "$SUMMARY" "Pending"          "...and one that was never scheduled"
note "four rows, four different columns carrying the signal. Phase alone would"
note "have told you Pending, Pending, Running, Running — which is nearly useless."
note "Note too that oom-victim reports ready while it is allocating: a container"
note "with no readiness probe is 'ready' the instant it is running, which is why"
note "READY is a poor column to triage on and lastState is a good one."

step "Confirming a diagnosis by fixing it"
note "a triage is only right if the fix works. The image is one of the very few"
note "fields the API server will accept an update to on a live Pod, so this one"
note "can be repaired in place without deleting anything."
run k -n "$NS" set image pod/image-pull-fail app=registry.k8s.io/e2e-test-images/agnhost:2.53
assert_eventually 300 "Running" \
  "image-pull-fail reached Running the moment the tag pointed at a real manifest" \
  phase_of image-pull-fail
run k -n "$NS" wait --for=condition=Ready pod/image-pull-fail --timeout=180s
assert_eq "$(waiting_reason image-pull-fail)" "" "its container is no longer waiting for anything"
assert_eq "$(restarts_of image-pull-fail)" "0" \
  "and restartCount is 0 — nothing ever crashed here, it simply never started"
note "the other three cannot be repaired with a patch like this. crashloop needs"
note "a different command, and command and args are immutable on a live Pod, so"
note "it has to be deleted and re-applied. pending-hog needs a smaller request or"
note "a bigger cluster. oom-victim's limit could in principle be raised in place"
note "on v1.35, but its container allocates without bound, so no limit saves it."
note "In production none of these are bare Pods, and the same edits are a"
note "Deployment rollout that replaces the Pod for you."

step "What this proves"
note "Four Pods failed for four unrelated reasons and every one of them was"
note "diagnosed with the same three commands, always in the same order."
note ""
note "kubectl get pod gives the state, and the state narrows the search rather"
note "than ending it. Pending means no kubelet has the Pod yet — check"
note ".spec.nodeName to see whether the scheduler is the one stuck."
note "ImagePullBackOff and CrashLoopBackOff both mean a kubelet has it and is"
note "retrying; the difference is whether a container ever ran."
note ""
note "kubectl describe pod gives the Events, and for anything that failed before"
note "the container started, the Events are the only account of why. The"
note "scheduler's FailedScheduling naming Insufficient cpu, and the kubelet's"
note "Failed to pull image, exist nowhere else in the API — and Events expire,"
note "so a Pod nobody looked at for an hour may have lost its explanation."
note ""
note "kubectl logs --previous gives the output of the container that already"
note "died, which is exactly the container whose output you need. Plain logs"
note "races the kubelet's next restart; --previous asks for the dead instance"
note "by name. It is also useless in the two cases where no container ever ran,"
note "which is the clearest signal in the whole workflow: if logs has nothing"
note "to say, the failure happened before your code did, and the answer is in"
note "describe."
note ""
note "Finally, CrashLoopBackOff is a symptom and never a cause. Both crashing"
note "Pods end up wearing it. The cause is in lastState.terminated: exit code 1"
note "with reason Error is a process that decided to quit and probably logged"
note "why; exit code 137 with reason OOMKilled is a process that was killed"
note "mid-sentence by the kernel and never got to explain itself."
