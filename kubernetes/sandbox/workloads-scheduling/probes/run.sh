#!/usr/bin/env bash
LAB="probes"
source "$(dirname "$0")/../../cluster/lib.sh"
require_cluster
ns_setup

# Everything this lab creates — four Pods, one Service, and the EndpointSlice
# the endpoint controller derives from it — is namespaced, so ns_setup's own
# trap is a complete cleanup. Nothing cluster-scoped is created and no node is
# touched, so there is nothing extra to unwind.

# --- helpers --------------------------------------------------------------

# restartCount for a Pod's first (only) container. Empty before the kubelet
# has reported any container status at all.
restart_count() {
  k -n "$NS" get pod "$1" -o jsonpath='{.status.containerStatuses[0].restartCount}'
}

# "yes" once that container has been restarted at least once. assert_eventually
# compares for equality and the question we want to ask is ">= 1", so the
# comparison happens here and the assertion just waits for the word.
restarted() {
  local n
  n="$(restart_count "$1" 2>/dev/null || true)"
  case "$n" in
    '' | *[!0-9]*) printf 'no\n'; return 0 ;;
  esac
  if [ "$n" -ge 1 ]; then printf 'yes\n'; else printf 'no\n'; fi
}

# How many of the Service's endpoints are currently marked ready. A Pod that
# fails its readiness probe is not necessarily deleted from the EndpointSlice
# — the controller flips its conditions.ready to false — so counting the true
# flags is what corresponds to "addresses kube-proxy will still send traffic
# to", which is the thing that actually matters.
ready_endpoints() {
  local flags f n=0
  flags="$(k -n "$NS" get endpointslice -l kubernetes.io/service-name=web \
    -o jsonpath='{.items[*].endpoints[*].conditions.ready}' 2>/dev/null || true)"
  for f in $flags; do
    if [ "$f" = "true" ]; then n=$((n + 1)); fi
  done
  printf '%s\n' "$n"
}

# "yes" when the client Pod can open a TCP connection through the Service.
svc_reachable() {
  if k -n "$NS" exec client -- /agnhost connect --timeout=3s web:80 >/dev/null 2>&1; then
    printf 'yes\n'
  else
    printf 'no\n'
  fi
}

ready_condition() {
  k -n "$NS" get pod "$1" -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}'
}

# --- liveness -------------------------------------------------------------

step "A Pod whose health is a file"
apply liveness.yaml
run k -n "$NS" wait --for=condition=Ready pod/liveness --timeout=180s
note "the container writes /tmp/healthy at startup, and the liveness probe"
note "runs 'test -s /tmp/healthy' every two seconds. The file is there, so"
note "the probe exits 0 and the kubelet leaves the container alone."
run k -n "$NS" get pod liveness -o jsonpath='{.spec.containers[0].livenessProbe}{"\n"}'
assert_eq "$(restart_count liveness)" "0" "restartCount starts at 0"

UID_BEFORE="$(k -n "$NS" get pod liveness -o jsonpath='{.metadata.uid}')"
IP_BEFORE="$(k -n "$NS" get pod liveness -o jsonpath='{.status.podIP}')"
note "Pod uid $UID_BEFORE at $IP_BEFORE — remember both of these"

step "Empty the file: the kubelet kills the container and starts a new one"
run k -n "$NS" exec liveness -- sh -c ': > /tmp/healthy'
note "the file still exists but is now zero bytes, so 'test -s' exits 1."
note "two consecutive failures (failureThreshold: 2) and the kubelet acts."

assert_eventually_contains 120 "Liveness probe failed" \
  "the kubelet recorded an Unhealthy event: Liveness probe failed" \
  k -n "$NS" describe pod liveness
assert_eventually 180 "yes" "restartCount reached at least 1 — the container was restarted" \
  restarted liveness
run k -n "$NS" get pod liveness
note "restartCount is now $(restart_count liveness)"

PREV_FINISHED="$(k -n "$NS" get pod liveness \
  -o jsonpath='{.status.containerStatuses[0].lastState.terminated.finishedAt}' 2>/dev/null || true)"
if [ -z "$PREV_FINISHED" ]; then fail "no lastState.terminated — no record of a previous container"; fi
ok "lastState.terminated records the instance that was killed (finished at $PREV_FINISHED)"

step "A restart is a new container inside the same Pod"
UID_AFTER="$(k -n "$NS" get pod liveness -o jsonpath='{.metadata.uid}')"
IP_AFTER="$(k -n "$NS" get pod liveness -o jsonpath='{.status.podIP}')"
assert_eq "$UID_AFTER" "$UID_BEFORE" "same Pod object — the Pod was never deleted or rescheduled"
assert_eq "$IP_AFTER" "$IP_BEFORE" "same Pod IP — the network sandbox was never torn down"
note "nothing rescheduled, nothing was replaced: only the container inside"
note "the Pod was recreated. A liveness probe is a local repair, which is"
note "also its limit — it cannot fix a Pod on a broken node."

run k -n "$NS" wait --for=condition=Ready pod/liveness --timeout=180s
assert_eq "$(ready_condition liveness)" "True" "the Pod is Ready again after the restart"
note "the replacement container ran the same command, so it wrote /tmp/healthy"
note "again and healed itself. That is the general rule: a restart starts from"
note "the image, and everything the old container wrote to its writable layer"
note "is gone. Had /tmp been an emptyDir the empty file would have survived,"
note "the probe would keep failing, and this Pod would be in CrashLoopBackOff."

# --- readiness ------------------------------------------------------------

step "The same failing check, filed under readinessProbe instead"
apply readiness.yaml
run k -n "$NS" wait --for=condition=Ready pod/web --timeout=180s
run k -n "$NS" wait --for=condition=Ready pod/client --timeout=180s
assert_eventually 120 "1" "the Service has exactly one ready endpoint" ready_endpoints
run k -n "$NS" get endpointslice -l kubernetes.io/service-name=web

# Retry rather than firing once. An endpoint appearing in the EndpointSlice
# and kube-proxy having programmed the node's forwarding rules for it are two
# different events, and the gap between them is real: a single immediate
# request can be refused outright, in about a millisecond, by a node that has
# not caught up yet.
curl_hostname() { k -n "$NS" exec client -- curl -sS --max-time 10 http://web/hostname 2>/dev/null; }
assert_eventually 60 "web" "a request through the Service was answered by the Pod named web" curl_hostname

step "Empty its file: the address leaves the Service, the container does not restart"
run k -n "$NS" exec web -- sh -c ': > /tmp/ready'
assert_eventually 120 "0" "ready endpoints fell from 1 to 0" ready_endpoints
# Display only, and tolerant of failure: if the controller has removed the
# endpoint entry outright rather than marking it unready, this jsonpath has
# nothing to walk and kubectl exits non-zero. The assertion above is what
# actually decides the step.
run k -n "$NS" get endpointslice -l kubernetes.io/service-name=web \
  -o jsonpath='{"addresses: "}{.items[*].endpoints[*].addresses[0]}{"   ready: "}{.items[*].endpoints[*].conditions.ready}{"\n"}' || true
note "the endpoint is typically still listed, with conditions.ready flipped to"
note "false rather than deleted, so consumers can tell a backend that exists"
note "but is not serving from one that is gone. kube-proxy programs only the"
note "ready ones, which is why that is the count worth asserting on."

assert_eventually 60 "False" "the Pod's Ready condition is False" ready_condition web
assert_eq "$(k -n "$NS" get pod web -o jsonpath='{.status.phase}')" "Running" \
  "the Pod is still Running — not failed, not evicted, not restarted"
assert_eq "$(restart_count web)" "0" "restartCount is still 0: a readiness failure never restarts anything"

assert_eventually 90 "no" "the client can no longer reach the Service" svc_reachable
note "with no ready endpoints behind the ClusterIP, kube-proxy rejects the"
note "connection outright instead of hanging — the process is alive and"
note "listening, but Kubernetes has stopped sending it work."

step "Readiness is reversible, and reversing it costs nothing"
run k -n "$NS" exec web -- sh -c 'echo ok > /tmp/ready'
assert_eventually 120 "1" "the address came back into rotation on its own" ready_endpoints
assert_eventually 90 "yes" "the client can reach the Service again" svc_reachable
assert_eq "$(restart_count web)" "0" "restartCount is still 0 across the entire cycle"
note "no restart, no rescheduling, no lost connections to other Pods: the Pod"
note "simply stopped and started being a valid destination. That is why slow"
note "dependencies belong in a readiness probe and never in a liveness probe."

# --- startup --------------------------------------------------------------

step "A slow starter, with and without a startup probe"
apply startup.yaml
note "both Pods sleep 25s before their server exists, and both carry the same"
note "liveness probe: one failure, failureThreshold 1, and the container dies."
note "slow-guarded additionally declares a startupProbe worth 20 x 3 = 60s."

assert_eventually 180 "false" \
  "slow-guarded reports started=false while its startup probe is still failing" \
  k -n "$NS" get pod slow-guarded -o jsonpath='{.status.containerStatuses[0].started}'
note "while started is false the kubelet runs neither the liveness nor the"
note "readiness probe, so the identical liveness probe is simply not armed yet"

assert_eventually 240 "yes" \
  "slow-unguarded was killed and restarted before it ever finished booting" \
  restarted slow-unguarded

run k -n "$NS" wait --for=condition=Ready pod/slow-guarded --timeout=240s
assert_eq "$(restart_count slow-guarded)" "0" \
  "slow-guarded reached Ready with restartCount 0 — it was never killed"
assert_eventually 60 "true" "slow-guarded now reports started=true, so liveness is armed" \
  k -n "$NS" get pod slow-guarded -o jsonpath='{.status.containerStatuses[0].started}'
note "slow-unguarded is at restartCount=$(restart_count slow-unguarded) and climbing;"
note "each restart waits longer than the last, so a Pod that cannot boot in"
note "time gets slower to recover rather than faster."
run k -n "$NS" get pods

step "What this proves"
note "One check, three fields, three different meanings. The kubelet ran the"
note "same 'test -s' command in every case and got the same exit code; what it"
note "did with that answer was decided entirely by which probe the check was"
note "written under."
note ""
note "livenessProbe answers 'is this container beyond saving?' and its remedy"
note "is a restart in place: same Pod, same uid, same IP, new container from"
note "the image. That makes it the dangerous one — a probe that fails for a"
note "reason a restart cannot fix, such as a dependency being down, converts a"
note "degraded service into a crash loop on every replica at once."
note ""
note "readinessProbe answers 'should traffic go here right now?' and its remedy"
note "is to drop the address out of the ready set of every matching Service."
note "Nothing restarts, nothing reschedules, and the moment the check passes"
note "again the address comes back. It is the correct home for anything"
note "temporary: a full queue, a cold cache, a dependency you are waiting on."
note ""
note "startupProbe answers 'has this thing finished booting yet?' and exists"
note "only to suspend the other two while it runs. It lets you keep a tight"
note "liveness probe for steady state without that same tightness killing the"
note "container during a slow start — the difference between slow-guarded"
note "reaching Ready untouched and slow-unguarded looping forever."
