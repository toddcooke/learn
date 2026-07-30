#!/usr/bin/env bash
LAB="resources-qos"
source "$(dirname "$0")/../../cluster/lib.sh"
require_cluster
ns_setup

step "Three Pods whose only difference is the resources block"
apply qos-classes.yaml
run k -n "$NS" wait --for=condition=Ready pod/guaranteed pod/burstable pod/besteffort --timeout=120s
run k -n "$NS" get pods -o custom-columns=NAME:.metadata.name,QOS:.status.qosClass
note "nobody wrote those classes down: .status.qosClass is computed from the"
note "numbers in .spec when the Pod is admitted, and is read-only afterwards."

step "Guaranteed — a request and a limit for both resources, and they match"
assert_eq "$(k -n "$NS" get pod guaranteed -o jsonpath='{.status.qosClass}')" "Guaranteed" \
  ".status.qosClass on pod/guaranteed is Guaranteed"
assert_eq "$(k -n "$NS" get pod guaranteed -o jsonpath='{.spec.containers[0].resources.requests.cpu}')" "100m" \
  "cpu request is 100m"
assert_eq "$(k -n "$NS" get pod guaranteed -o jsonpath='{.spec.containers[0].resources.limits.cpu}')" "100m" \
  "cpu limit is the same 100m"
assert_eq "$(k -n "$NS" get pod guaranteed -o jsonpath='{.spec.containers[0].resources.requests.memory}')" "64Mi" \
  "memory request is 64Mi"
assert_eq "$(k -n "$NS" get pod guaranteed -o jsonpath='{.spec.containers[0].resources.limits.memory}')" "64Mi" \
  "memory limit is the same 64Mi"
DESC="$(k -n "$NS" describe pod guaranteed)"
assert_contains "$DESC" "QoS Class:" "kubectl describe reports the class in its own field"
assert_contains "$DESC" "Guaranteed" "and the value it reports is Guaranteed"
note "all four numbers matter, and every container in the Pod has to satisfy all"
note "four. Guaranteed is the class you have to mean; it is never an accident."

step "Burstable — something is set, but the requests sit below the limits"
assert_eq "$(k -n "$NS" get pod burstable -o jsonpath='{.status.qosClass}')" "Burstable" \
  ".status.qosClass on pod/burstable is Burstable"
assert_eq "$(k -n "$NS" get pod burstable -o jsonpath='{.spec.containers[0].resources.requests.cpu}')" "50m" \
  "cpu request is 50m — this is what the scheduler subtracted from the node"
assert_eq "$(k -n "$NS" get pod burstable -o jsonpath='{.spec.containers[0].resources.limits.cpu}')" "200m" \
  "cpu limit is 200m — four times the reservation, available only if the node has room"
note "the gap between request and limit is the burst. It is also the reason this"
note "class is evicted before Guaranteed under node memory pressure: a Pod above"
note "its request is using capacity the scheduler never promised it."

step "BestEffort — no requests and no limits anywhere in the Pod"
assert_eq "$(k -n "$NS" get pod besteffort -o jsonpath='{.status.qosClass}')" "BestEffort" \
  ".status.qosClass on pod/besteffort is BestEffort"
BE_REQ="$(k -n "$NS" get pod besteffort -o jsonpath='{.spec.containers[0].resources.requests}' 2>/dev/null || true)"
BE_LIM="$(k -n "$NS" get pod besteffort -o jsonpath='{.spec.containers[0].resources.limits}' 2>/dev/null || true)"
assert_eq "$BE_REQ" "" "the container declares no requests"
assert_eq "$BE_LIM" "" "and no limits"
note "BestEffort is not something you ask for, it is what is left when you ask for"
note "nothing. One request on one container would have made the whole Pod"
note "Burstable — and under node memory pressure these Pods are evicted first."

step "Limits with no requests: the API server copies the limit into the request"
apply limits-only.yaml
run k -n "$NS" wait --for=condition=Ready pod/limits-only --timeout=120s
STORED="$(k -n "$NS" get pod limits-only -o jsonpath='{.spec.containers[0].resources}' 2>/dev/null || true)"
note "what the API server stored: $STORED"
assert_eq "$(k -n "$NS" get pod limits-only -o jsonpath='{.spec.containers[0].resources.requests.cpu}')" "100m" \
  "a cpu request of 100m appeared, though the manifest never wrote one"
assert_eq "$(k -n "$NS" get pod limits-only -o jsonpath='{.spec.containers[0].resources.requests.memory}')" "64Mi" \
  "and a memory request of 64Mi, equal to the memory limit"
assert_eq "$(k -n "$NS" get pod limits-only -o jsonpath='{.status.qosClass}')" "Guaranteed" \
  "so the Pod is Guaranteed, from a manifest that only mentioned limits"
note "if you set a limit and no request, and no LimitRange has already defaulted"
note "one, Kubernetes uses the limit as the request. Write limits alone and you"
note "get Guaranteed — occasionally a pleasant surprise, more often an accidental"
note "reservation of the full limit on the node for the life of the Pod."

step "A CPU limit throttles: the container is slowed, not killed"
apply cpu-throttled.yaml
run k -n "$NS" wait --for=condition=Ready pod/cpu-throttled --timeout=120s
assert_eq "$(k -n "$NS" get pod cpu-throttled -o jsonpath='{.status.qosClass}')" "Burstable" \
  "cpu-only numbers give Burstable: Guaranteed needs memory pinned too"
note "the container runs 'while true; do :; done', which wants a whole core,"
note "and its cgroup hands out 200 milli-cores. The kernel resolves that by"
note "freezing the process for the rest of each 100ms period."
CPUSTAT="$(k -n "$NS" exec cpu-throttled -- sh -c 'f=/sys/fs/cgroup/cpu.stat; [ -r "$f" ] || f=/sys/fs/cgroup/cpu/cpu.stat; [ -r "$f" ] && cat "$f" || echo UNAVAILABLE' 2>/dev/null || true)"
case "$CPUSTAT" in
  *nr_throttled*)
    note "cpu.stat inside the container: $(printf '%s' "$CPUSTAT" | tr '\n' ' ')"
    assert_eventually_contains 90 "THROTTLED=yes" "nr_throttled is climbing — the kernel is holding the container back" \
      k -n "$NS" exec cpu-throttled -- sh -c 'f=/sys/fs/cgroup/cpu.stat; [ -r "$f" ] || f=/sys/fs/cgroup/cpu/cpu.stat; n=$(sed -n "s/^nr_throttled //p" "$f" 2>/dev/null); [ "${n:-0}" -gt 0 ] && echo THROTTLED=yes || echo THROTTLED=no'
    ;;
  *)
    note "this runtime does not expose /sys/fs/cgroup/cpu.stat inside the container,"
    note "so the throttle counter cannot be read from here. The behavioural check"
    note "at the end of the lab — still Running, never restarted — still holds."
    ;;
esac

step "A memory limit kills: 32Mi, and a container that asks for more"
apply oom.yaml
assert_eventually 30 "Burstable" "request equals limit for memory, but cpu is unset, so this is Burstable not Guaranteed" \
  k -n "$NS" get pod oom-hog -o jsonpath='{.status.qosClass}'
assert_eventually 180 "OOMKilled" "lastState.terminated.reason is OOMKilled" \
  k -n "$NS" get pod oom-hog -o jsonpath='{.status.containerStatuses[0].lastState.terminated.reason}'
assert_eventually 60 "137" "lastState.terminated.exitCode is 137 — 128 + 9, the shell's way of writing 'killed by SIGKILL'" \
  k -n "$NS" get pod oom-hog -o jsonpath='{.status.containerStatuses[0].lastState.terminated.exitCode}'
PREV="$(k -n "$NS" logs oom-hog --previous --tail=6 2>&1 || true)"
note "last words of the killed container: $(printf '%s' "$PREV" | tr '\n' ' ')"
RC="$(k -n "$NS" get pod oom-hog -o jsonpath='{.status.containerStatuses[0].restartCount}' 2>/dev/null || true)"
if [ "${RC:-0}" -ge 1 ]; then
  ok "the kubelet restarted the container ($RC restart(s) so far)"
else
  fail "expected at least one restart after the OOM kill, saw restartCount='$RC'"
fi
assert_eventually_contains 240 "CrashLoopBackOff" "the restarts have backed off into CrashLoopBackOff" \
  k -n "$NS" get pod oom-hog -o jsonpath='{.status.containerStatuses[0].state.waiting.reason}'
OOMDESC="$(k -n "$NS" describe pod oom-hog)"
assert_contains "$OOMDESC" "OOMKilled" "kubectl describe shows the same verdict under Last State"
note "the Pod is not Failed and not Error: it is a healthy Pod object whose"
note "container keeps dying. OOMKilled with a restart policy of Always is"
note "always going to look like CrashLoopBackOff from the outside, which is why"
note "the Last State block, not the Pod phase, is what you read."

step "Back to the CPU Pod: still running, never restarted"
assert_eq "$(k -n "$NS" get pod cpu-throttled -o jsonpath='{.status.phase}')" "Running" \
  "the CPU-limited Pod is still Running"
CRC="$(k -n "$NS" get pod cpu-throttled -o jsonpath='{.status.containerStatuses[0].restartCount}' 2>/dev/null || true)"
assert_eq "${CRC:-}" "0" "and its restartCount is still 0, after continuously demanding more CPU than it is allowed"
run k -n "$NS" get pods -o custom-columns=NAME:.metadata.name,QOS:.status.qosClass,RESTARTS:.status.containerStatuses[0].restartCount,LASTSTATE:.status.containerStatuses[0].lastState.terminated.reason
note "two containers, both permanently over their limit. The one over its CPU"
note "limit has been running the whole time; the one over its memory limit has"
note "been killed repeatedly. The limits are not enforced by the same mechanism"
note "because the resources are not the same kind of thing."

step "What this proves"
note "QoS class is a derived label, not a setting. Write a request and a limit"
note "for cpu and for memory on every container and make each pair equal, and"
note "the Pod is Guaranteed; write some subset of that and it is Burstable;"
note "write nothing at all and it is BestEffort. The order matters under node"
note "pressure, where the kubelet evicts BestEffort first and Guaranteed last."
note "Requests and limits do different jobs. A request is a scheduling claim:"
note "it decides which node the Pod fits on and is subtracted from that node's"
note "allocatable capacity whether or not the container ever uses it. A limit is"
note "a runtime ceiling, enforced by the kernel on the running container."
note "How that ceiling is enforced depends on the resource. CPU is a rate, so a"
note "process denied CPU is merely a process made to wait: the cgroup throttles"
note "it every period and it keeps running, slowly, forever. Memory is an"
note "allocation the process already holds, and on a node with no swap there is"
note "nowhere to put those pages, so the kernel cannot claw them back — it can"
note "only kill. That asymmetry is the whole reason a CPU limit shows up as a"
note "latency problem and a memory limit shows up as exit code 137."
