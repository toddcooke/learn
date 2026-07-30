#!/usr/bin/env bash
LAB="logs"
source "$(dirname "$0")/../../cluster/lib.sh"
require_cluster
ns_setup

# ---------------------------------------------------------------------------
# Cleanup. This lab creates nothing outside $NS. It reads from the nodes with
# docker exec — /var/log/pods, systemctl, crictl — but every one of those is a
# read, and it reads control-plane Pod logs out of kube-system without touching
# them. So the trap ns_setup installed is exactly right and is left alone.
# ---------------------------------------------------------------------------

NODE="cka-sandbox-worker"
CP_NODE="cka-sandbox-control-plane"
API_POD="kube-apiserver-$CP_NODE"

command -v docker >/dev/null 2>&1 \
  || fail "this lab needs the docker CLI: half the point is looking at the log files on the node"
docker inspect "$NODE" >/dev/null 2>&1 \
  || fail "no container named $NODE — this lab assumes the 3-node kind cka-sandbox cluster"
docker inspect "$CP_NODE" >/dev/null 2>&1 \
  || fail "no container named $CP_NODE — this lab assumes the 3-node kind cka-sandbox cluster"

# --- small readers, so the polling assertions below stay one line each ------
# Each swallows its own errors so that "not there yet" reads as an empty or
# stale value and gets retried, instead of aborting the script under errexit.
alpha_lines() { k -n "$NS" logs talker -c alpha 2>/dev/null | wc -l | tr -d ' '; }
beta_lines()  { k -n "$NS" logs talker -c beta  2>/dev/null | wc -l | tr -d ' '; }
fleet_lines() { k -n "$NS" logs -l app=fleet --prefix --tail=1 2>/dev/null | wc -l | tr -d ' '; }
# beta ticks once a second and never stops, so "25 lines exist" is the same
# statement as "the first tick is at least 25 seconds old" — which is what the
# --since assertion needs to be true no matter how long the earlier steps took.
beta_settled() {
  local n
  n="$(beta_lines)"
  case "$n" in ''|*[!0-9]*) return 0 ;; esac
  if [ "$n" -ge 25 ]; then echo settled; fi
}
crasher_reason() {
  k -n "$NS" get pod crasher -o jsonpath='{.status.containerStatuses[0].state.waiting.reason}' 2>/dev/null || true
}
# Echoes nothing until restartCount is at least 1. That threshold is not
# cosmetic: --previous is served from .lastState.terminated, which the kubelet
# only fills in once a SECOND instance exists to have a predecessor.
crasher_restarted() {
  local n
  n="$(k -n "$NS" get pod crasher -o jsonpath='{.status.containerStatuses[0].restartCount}' 2>/dev/null || true)"
  case "$n" in ''|0) return 0 ;; esac
  echo restarted
}

# ---------------------------------------------------------------------------

step "Three workloads that talk: a two-container Pod, a crash-looper, a fleet"
apply talker.yaml
apply crasher.yaml
apply fleet.yaml
run k -n "$NS" wait --for=condition=Ready pod/talker --timeout=180s
run k -n "$NS" rollout status deploy/fleet --timeout=180s
note "no wait for crasher: it is designed never to become Ready"
note "none of these containers writes a log FILE. They write to stdout, the"
note "runtime captures the stream, and every command below is reading that."

step "-c chooses the container, and leaving it off chooses one for you"
assert_eventually 60 "50" "alpha's log settled at exactly 50 lines" alpha_lines
ALPHA="$(k -n "$NS" logs talker -c alpha)"
assert_contains "$ALPHA" "ALPHA line 1"  "logs -c alpha starts at alpha's first line"
assert_contains "$ALPHA" "ALPHA line 50" "...and ends at its last"
assert_not_contains "$ALPHA" "BETA" "and contains nothing at all from the beta container"
BETA="$(k -n "$NS" logs talker -c beta)"
assert_contains "$BETA" "BETA tick" "logs -c beta returns beta's ticks"
assert_not_contains "$BETA" "ALPHA" "...and none of alpha's lines"
note "the two streams are stored separately on the node, so -c is a file"
note "selection rather than a filter applied to one merged blob"
run k -n "$NS" logs talker --all-containers=true --prefix --tail=2
BOTH="$(k -n "$NS" logs talker --all-containers=true --prefix --tail=2)"
assert_contains "$BOTH" "ALPHA line 50" "--all-containers merges both streams: alpha is there"
assert_contains "$BOTH" "BETA tick"     "...and so is beta"
DEFAULTED="$(k -n "$NS" logs talker --tail=1 2>&1)"
note "kubectl logs talker  (no -c) prints, on stderr:"
note "  $(printf '%s' "$DEFAULTED" | head -1)"
assert_contains "$DEFAULTED" 'Defaulted container "alpha" out of: alpha, beta' \
  "with no -c, kubectl silently defaults to the FIRST container and says so on stderr"
assert_contains "$DEFAULTED" "ALPHA line 50" "...and returned alpha's output, not beta's"
note "this changed in v1.24: it used to be a hard error. Now it is a warning you"
note "can miss in a pipeline, and you go on to debug the wrong container. Set the"
note "kubectl.kubernetes.io/default-container annotation to choose deliberately."

step "--tail bounds the output from the newest end"
TAIL5="$(k -n "$NS" logs talker -c alpha --tail=5 | wc -l | tr -d ' ')"
assert_eq "$TAIL5" "5" "--tail=5 returned exactly 5 lines out of the 50 on disk"
run k -n "$NS" logs talker -c alpha --tail=5
LAST="$(k -n "$NS" logs talker -c alpha --tail=1)"
assert_eq "$LAST" "ALPHA line 50" "--tail counts from the END, so --tail=1 is the newest line"
STAMPED="$(k -n "$NS" logs talker -c alpha --tail=1 --timestamps)"
note "with --timestamps: $STAMPED"
assert_contains "$STAMPED" "Z ALPHA line 50" \
  "--timestamps prepends the RFC3339 time the runtime recorded for that line"
note "the timestamp is not the container's — it is when the runtime read the"
note "line off the stream, which is why it is trustworthy even when the app's"
note "own log format has no clock in it"

step "--since bounds it by time instead"
assert_eventually 120 "settled" \
  "beta has been ticking for at least 25 seconds, so its first line is stale" beta_settled
BETA_FULL_LINES="$(beta_lines || true)"
BETA_FULL="$(k -n "$NS" logs talker -c beta)"
assert_contains "$BETA_FULL" "BETA tick 1 of 3600" \
  "the unbounded read still starts at the very first tick ($BETA_FULL_LINES lines so far)"
run k -n "$NS" logs talker -c beta --since=10s
SINCE="$(k -n "$NS" logs talker -c beta --since=10s)"
assert_contains "$SINCE" "BETA tick" "--since=10s returned the ticks from the last few seconds"
assert_not_contains "$SINCE" "BETA tick 1 of 3600" \
  "...and dropped the first tick, which is well outside a 10-second window"
SINCE_LINES="$(printf '%s\n' "$SINCE" | wc -l | tr -d ' ')"
if [ "$SINCE_LINES" -gt 15 ]; then
  fail "--since=10s returned $SINCE_LINES lines; a one-per-second stream cannot fit that many in 10s"
fi
ok "--since=10s returned $SINCE_LINES lines out of the $BETA_FULL_LINES on disk"
note "--since is evaluated by the kubelet against the node's own clock, so it"
note "is immune to skew between your laptop and the cluster. --since-time takes"
note "an absolute RFC3339 stamp instead, which is what you want when you are"
note "correlating against an alert that fired at a known instant."

step "--previous reads the instance that already died"
assert_eventually 240 "restarted" \
  "the kubelet has restarted crasher at least once" crasher_restarted
assert_eventually 240 "CrashLoopBackOff" \
  "crasher's current state is Waiting/CrashLoopBackOff" crasher_reason
EXIT_CODE="$(k -n "$NS" get pod crasher -o jsonpath='{.status.containerStatuses[0].lastState.terminated.exitCode}')"
assert_eq "$EXIT_CODE" "1" "the previous instance terminated with exit code 1"
PREV="$(k -n "$NS" logs crasher --previous 2>&1 || true)"
note "kubectl logs crasher --previous returned:"
printf '%s\n' "$PREV" | while IFS= read -r L; do note "  $L"; done
assert_contains "$PREV" "CRASH-MARKER: opening /etc/app/config.yaml" \
  "--previous returned the dead instance's output"
assert_contains "$PREV" "CRASH-MARKER: no such file - giving up" \
  "...including the line that explains the exit, which the live instance has not printed yet"
if OUT="$(k -n "$NS" logs talker -c alpha --previous 2>&1)"; then
  fail "expected --previous to be rejected for a container that has never restarted"
fi
assert_contains "$OUT" "previous terminated container" \
  "--previous on a container with no predecessor is an error, not an empty result"
note "the error is the kubelet's, not kubectl's: --previous is served from"
note ".status.containerStatuses[].lastState.terminated, and a container on its"
note "first instance has no lastState to serve. 'not found' here means 'never"
note "restarted', which is itself a useful diagnosis."

step "-l reads across every Pod that matches a selector"
assert_eventually 60 "3" "one line from each of the three fleet Pods" fleet_lines
run k -n "$NS" logs -l app=fleet --prefix --tail=1
FLEET_OUT="$(k -n "$NS" logs -l app=fleet --prefix --tail=1)"
FLEET_PODS="$(k -n "$NS" get pods -l app=fleet -o jsonpath='{range .items[*]}{.metadata.name}{"\n"}{end}')"
for P in $FLEET_PODS; do
  assert_contains "$FLEET_OUT" "$P" "the merged output includes $P"
done
assert_not_contains "$FLEET_OUT" "ALPHA" "and nothing from talker, which does not carry app=fleet"
note "--prefix is what makes this readable: without it the lines from three"
note "Pods arrive interleaved and anonymous. Two defaults worth knowing: with a"
note "selector --tail defaults to 10 rather than 'everything', and only 5 Pods"
note "are followed concurrently (--max-log-requests) when you add -f."
note "kubectl logs deploy/fleet is the near miss — it resolves the Deployment to"
note "ONE Pod. -l is the one that fans out."

step "The files behind kubectl logs, on the node"
TALKER_UID="$(k -n "$NS" get pod talker -o jsonpath='{.metadata.uid}')"
TALKER_DIR="/var/log/pods/${NS}_talker_${TALKER_UID}"
run docker exec "$NODE" ls -A /var/log/pods
POD_DIRS="$(docker exec "$NODE" ls -A /var/log/pods 2>/dev/null || true)"
if [ -z "$POD_DIRS" ]; then fail "/var/log/pods on $NODE is empty — the node is not storing container logs where it should"; fi
ok "/var/log/pods on $NODE is not empty"
assert_contains "$POD_DIRS" "${NS}_talker_" \
  "one directory per Pod, named <namespace>_<pod>_<uid>"
run docker exec "$NODE" ls -A "$TALKER_DIR"
CONTAINER_DIRS="$(docker exec "$NODE" ls -A "$TALKER_DIR")"
assert_contains "$CONTAINER_DIRS" "alpha" "inside it, one subdirectory per container: alpha"
assert_contains "$CONTAINER_DIRS" "beta"  "...and beta"
LOG_FILES="$(docker exec "$NODE" ls -A "$TALKER_DIR/alpha")"
assert_contains "$LOG_FILES" "0.log" \
  "and the file is named for the restart count, so a fresh container writes 0.log"
FIRST_LINE="$(docker exec "$NODE" head -1 "$TALKER_DIR/alpha/0.log")"
note "the first line of alpha/0.log, exactly as the runtime wrote it:"
note "  $FIRST_LINE"
assert_contains "$FIRST_LINE" "stdout" \
  "the CRI log format tags every line with the stream it came from"
assert_contains "$FIRST_LINE" "ALPHA line 1" "...and then the line the container actually wrote"
note "the format is: <RFC3339Nano> <stdout|stderr> <F|P> <message>. F means the"
note "line is complete; P means partial, i.e. the runtime split an over-long"
note "line and the next record continues it."
CRASHER_UID="$(k -n "$NS" get pod crasher -o jsonpath='{.metadata.uid}')"
CRASH_DIR="/var/log/pods/${NS}_crasher_${CRASHER_UID}/app"
CRASH_FILES="$(docker exec "$NODE" ls -A "$CRASH_DIR" 2>/dev/null || true)"
if [ -z "$CRASH_DIR" ] || [ -z "$CRASH_FILES" ]; then fail "no log files under $CRASH_DIR on $NODE"; fi
run docker exec "$NODE" ls -A "$CRASH_DIR"
assert_contains "$CRASH_FILES" ".log" "the crash-looper has a numbered log file per instance"
note "that numbering IS --previous: instance N writes N.log, and --previous is"
note "the kubelet handing you the file one number down."
LEGACY="$(docker exec "$NODE" sh -c 'ls -A /var/log/containers 2>/dev/null | head -1' || true)"
note "/var/log/containers holds flat symlinks into that tree, one per container,"
note "which is what a node-level logging agent usually tails. First entry here:"
note "  ${LEGACY:-<not present on this node>}"

step "Rotation is why only the current file is retrievable"
note "the kubelet rotates each container's log: containerLogMaxSize (10Mi by"
note "default) caps one file, containerLogMaxFiles (5 by default) caps how many"
note "are kept. But kubectl logs only ever reads the CURRENT, unrotated file."
note "A Pod that has written 40Mi gives you at most the last 10Mi, and the"
note "rotated siblings sitting right next to it on disk are unreachable through"
note "the API. That is the whole argument for shipping logs off the node."
ROT="$(k get --raw "/api/v1/nodes/$NODE/proxy/configz" 2>/dev/null || true)"
case "$ROT" in
  *containerLogMaxSize*)
    assert_contains "$ROT" '"containerLogMaxSize"' \
      "the live kubelet config on $NODE reports containerLogMaxSize"
    assert_contains "$ROT" '"containerLogMaxFiles"' "...and containerLogMaxFiles"
    VALS="$(printf '%s' "$ROT" | tr ',' '\n' | grep containerLogMax || true)"
    note "read live from the kubelet's own /configz:"
    printf '%s\n' "$VALS" | while IFS= read -r L; do note "  $L"; done
    ;;
  *)
    note "(the kubelet's /configz endpoint was not readable from here, so the"
    note " numbers above are the documented defaults rather than a live reading)"
    ;;
esac
note "and the harder limit: delete the Pod and every one of those files goes"
note "with it. kubectl logs cannot answer a question about a Pod that no longer"
note "exists, which is the failure mode that ends most 3am investigations."

step "Why journalctl -u kubelet never shows you the API server"
UNITS="$(docker exec "$CP_NODE" systemctl list-units --type=service --all --no-legend --no-pager 2>/dev/null || true)"
if [ -z "$UNITS" ]; then fail "could not list systemd units on $CP_NODE"; fi
assert_contains "$UNITS" "kubelet.service" "the kubelet IS a host service on $CP_NODE"
assert_contains "$UNITS" "containerd.service" "...and so is the container runtime"
assert_not_contains "$UNITS" "kube-apiserver" \
  "there is no kube-apiserver unit, so journalctl -u kube-apiserver has nothing to find"
note "kubeadm runs the API server, scheduler, controller-manager and etcd as"
note "STATIC PODS. Their output is ordinary container logs, captured by the same"
note "runtime and stored in the same /var/log/pods tree as the Pods above."
note "journalctl -u kubelet and -u containerd are still the right tools — for"
note "the kubelet and the runtime, which really are host services."
run docker exec "$CP_NODE" crictl ps
CRI_PS="$(docker exec "$CP_NODE" crictl ps 2>&1 || true)"
assert_contains "$CRI_PS" "kube-apiserver" "crictl ps on $CP_NODE lists a kube-apiserver container"
CP_PODS="$(docker exec "$CP_NODE" ls -A /var/log/pods 2>/dev/null || true)"
assert_contains "$CP_PODS" "kube-system_kube-apiserver-" \
  "and its logs live in /var/log/pods, in exactly the layout we just dissected"
APILOG="$(k -n kube-system logs "$API_POD" --tail=5 2>&1 || true)"
if [ -z "$APILOG" ]; then fail "kubectl -n kube-system logs $API_POD returned nothing"; fi
ok "kubectl -n kube-system logs $API_POD works like any other Pod's logs"
CPSEL="$(k -n kube-system logs -l component=kube-apiserver --tail=1 --prefix 2>&1 || true)"
assert_contains "$CPSEL" "$API_POD" \
  "-l component=kube-apiserver reaches it too: the mirror Pod carries kubeadm's labels"
CID="$(docker exec "$CP_NODE" crictl ps --name kube-apiserver -q 2>/dev/null | head -1 || true)"
if [ -z "$CID" ]; then fail "crictl ps --name kube-apiserver returned no container id"; fi
note "container id on the node: $CID"
CRILOG="$(docker exec "$CP_NODE" crictl logs --tail=3 "$CID" 2>&1 || true)"
if [ -z "$CRILOG" ]; then fail "crictl logs returned nothing for the API server container"; fi
ok "crictl logs read the same output without involving the API server at all"
note "that last point is the one to remember. When kubectl times out, kubectl"
note "logs times out with it — so you get onto the control-plane node and use"
note "crictl ps / crictl logs, or read /var/log/pods directly. The API server"
note "cannot be asked why the API server is down."

step "What this proves"
note "A container log is a file. The container writes to stdout, the runtime"
note "captures the stream into /var/log/pods/<ns>_<pod>_<uid>/<container>/<n>.log"
note "in CRI format, and kubectl logs asks the API server to proxy a read of"
note "that file from the kubelet. Every flag in this lab is a question about"
note "which file and how much of it: -c and --all-containers pick the container's"
note "directory, --previous steps back one restart number, --tail and --since"
note "bound the read, and -l fans the same read out across matching Pods."
note ""
note "Two of those flags are the ones that actually solve incidents. --previous"
note "is how you read a crash-looper's explanation, because the running instance"
note "has not got to the interesting part yet and the one that did is already"
note "gone. -l is how you stop guessing which of twelve replicas is the broken"
note "one. And the v1.24 behaviour change is a trap worth internalising: on a"
note "multi-container Pod, kubectl no longer refuses — it warns on stderr and"
note "reads the first container, so you can spend ten minutes reading a sidecar."
note ""
note "The limits matter as much as the flags. Rotation means only the current"
note "file is reachable, so a chatty Pod's history is already gone; deleting the"
note "Pod deletes everything. kubectl logs is a live-debugging tool, not a log"
note "store, and that gap is precisely what a node-level logging agent fills."
note ""
note "Finally, the control plane is not special. Because kubeadm runs it as"
note "static Pods, kube-apiserver's output is a container log like any other:"
note "kubectl -n kube-system logs while the cluster is healthy, crictl logs or"
note "/var/log/pods on the node when it is not. journalctl -u kubelet is the"
note "right tool only for the two things that really are host services, the"
note "kubelet and the container runtime — and the kubelet's journal is where you"
note "look when a component never became a container at all."
