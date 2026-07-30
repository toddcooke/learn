# Shared helpers for every sandbox lab. Source this file; don't execute it.
#
# A lab starts like this:
#
#   #!/usr/bin/env bash
#   LAB="replicaset"
#   source "$(dirname "$0")/../../cluster/lib.sh"
#   require_cluster
#   ns_setup
#
# LAB must be set before sourcing, because it determines the namespace.

set -euo pipefail

CLUSTER_NAME="${CLUSTER_NAME:-cka-sandbox}"
CONTEXT="kind-${CLUSTER_NAME}"
LAB="${LAB:-unnamed}"
NS="sandbox-${LAB}"

if [ -t 1 ]; then
  C_HEAD=$'\033[1;36m'; C_CMD=$'\033[0;33m'; C_NOTE=$'\033[0;37m'
  C_OK=$'\033[0;32m'; C_ERR=$'\033[1;31m'; C_OFF=$'\033[0m'
else
  C_HEAD=""; C_CMD=""; C_NOTE=""; C_OK=""; C_ERR=""; C_OFF=""
fi

_STEP=0

# Every kubectl call in every lab goes through this wrapper. Calling
# kubectl directly is a bug: kind switches the current context on cluster
# creation, and the ambient context may well be the user's own cluster.
k() { kubectl --context "$CONTEXT" "$@"; }

step() { _STEP=$((_STEP + 1)); printf '\n%s== %d. %s%s\n' "$C_HEAD" "$_STEP" "$1" "$C_OFF"; }
note() { printf '%s   %s%s\n' "$C_NOTE" "$1" "$C_OFF"; }
ok()   { printf '%s   ✓ %s%s\n' "$C_OK" "$1" "$C_OFF"; }
fail() { printf '%s   ✗ %s%s\n' "$C_ERR" "$1" "$C_OFF" >&2; exit 1; }

# Echo a command, then run it. Use it for anything the learner should see.
run() { printf '%s   $ %s%s\n' "$C_CMD" "$*" "$C_OFF"; "$@"; }

assert_eq() {
  if [ "$1" = "$2" ]; then ok "${3:-got '$1'}"
  else fail "${3:-assertion}: expected '$2', got '$1'"; fi
}

assert_contains() {
  case "$1" in
    *"$2"*) ok "${3:-output contains '$2'}" ;;
    *)      fail "${3:-assertion}: '$2' not found in: $1" ;;
  esac
}

assert_not_contains() {
  case "$1" in
    *"$2"*) fail "${3:-assertion}: unexpectedly found '$2'" ;;
    *)      ok "${3:-output does not contain '$2'}" ;;
  esac
}

# Poll until a command's stdout equals the expected value, or give up.
# Waiting on a condition beats sleeping: not flaky, and no slower than
# the thing it waits for.
#   assert_eventually <seconds> <expected> <description> <cmd...>
assert_eventually() {
  local timeout="$1" expected="$2" desc="$3"; shift 3
  local deadline=$((SECONDS + timeout)) actual=""
  while [ $SECONDS -lt $deadline ]; do
    actual="$("$@" 2>/dev/null || true)"
    if [ "$actual" = "$expected" ]; then ok "$desc"; return 0; fi
    sleep 2
  done
  fail "$desc: expected '$expected', last saw '$actual' after ${timeout}s"
}

# Same, but succeeds as soon as the output contains a substring.
assert_eventually_contains() {
  local timeout="$1" needle="$2" desc="$3"; shift 3
  local deadline=$((SECONDS + timeout)) actual=""
  while [ $SECONDS -lt $deadline ]; do
    actual="$("$@" 2>&1 || true)"
    case "$actual" in *"$needle"*) ok "$desc"; return 0 ;; esac
    sleep 2
  done
  fail "$desc: never saw '$needle'; last output: $actual"
}

require_cluster() {
  # Decide on reachability, and retry before giving up. A single kubectl
  # invocation can fail transiently — a busy API server, a kubeconfig being
  # rewritten underneath us — and an earlier version of this check read the
  # context list exactly once, so a momentary blip told the user to create a
  # cluster that was sitting right there, running. Three tries costs nothing
  # on the happy path, where the first one returns immediately.
  local i
  for i in 1 2 3; do
    if k cluster-info >/dev/null 2>&1; then return 0; fi
    sleep 3
  done

  # Genuinely unreachable. Work out which failure it is only now, so the
  # message is specific without the diagnosis being able to cause a failure.
  if ! kubectl config get-contexts -o name 2>/dev/null | grep -qx "$CONTEXT"; then
    fail "no '$CONTEXT' context found. Run: kubernetes/sandbox/cluster/up.sh"
  fi
  fail "cluster '$CLUSTER_NAME' is unreachable. Is Docker running? Try: cluster/up.sh"
}

# require_addon metrics-server | ingress | networkpolicy
require_addon() {
  case "$1" in
    metrics-server)
      k -n kube-system get deploy metrics-server >/dev/null 2>&1 \
        || fail "metrics-server is not installed. Run: cluster/up.sh (without --minimal)"
      ;;
    ingress)
      k -n ingress-nginx get deploy ingress-nginx-controller >/dev/null 2>&1 \
        || fail "ingress-nginx is not installed. Run: cluster/up.sh (without --minimal)"
      ;;
    networkpolicy)
      # kind's CNI enforces NetworkPolicy, but it FAILS OPEN: if kindnet is
      # unhealthy, every policy is silently ignored while `kubectl get
      # netpol` still lists them. A demo would then "prove" the opposite of
      # what it claims, so refuse to run rather than teach the wrong thing.
      local want have
      want="$(k -n kube-system get ds kindnet -o jsonpath='{.status.desiredNumberScheduled}' 2>/dev/null || echo 0)"
      have="$(k -n kube-system get ds kindnet -o jsonpath='{.status.numberReady}' 2>/dev/null || echo -1)"
      if [ "$want" = "0" ] || [ "$want" != "$have" ]; then
        fail "kindnet is not fully ready ($have/$want). NetworkPolicy fails open, so this lab would prove nothing."
      fi
      k get clusterrole kindnet -o yaml 2>/dev/null | grep -q networkpolicies \
        || fail "this node image predates NetworkPolicy support (needs a v1.31+ image)"
      ;;
    *)
      fail "unknown addon '$1'"
      ;;
  esac
}

ns_teardown() {
  local code=$?
  if [ "${KEEP:-0}" = "1" ]; then
    printf '\n%s   KEEP=1 — namespace %s left running. Inspect it with:%s\n' "$C_NOTE" "$NS" "$C_OFF"
    printf '%s   kubectl --context %s -n %s get all%s\n' "$C_NOTE" "$CONTEXT" "$NS" "$C_OFF"
    printf '%s   Clean up when done: kubectl --context %s delete ns %s%s\n' "$C_NOTE" "$CONTEXT" "$NS" "$C_OFF"
  else
    printf '\n%s   cleaning up namespace %s%s\n' "$C_NOTE" "$NS" "$C_OFF"
    k delete ns "$NS" --wait=false >/dev/null 2>&1 || true
  fi
  exit $code
}

# Labs are order-independent only because each cleans up after itself: a
# leftover bare Pod breaks the drain lab, and a leftover bound PVC pins a
# node and distorts every later scheduling demo.
ns_setup() {
  k delete ns "$NS" --ignore-not-found --wait=true >/dev/null 2>&1 || true
  k create ns "$NS" >/dev/null
  trap ns_teardown EXIT INT TERM
  note "working in namespace $NS (set KEEP=1 to leave it running)"
}

# Path to the sourcing lab's own directory, so manifests resolve no matter
# where the script was invoked from. The fallback covers a caller that has
# already cd'd (cluster/up.sh does), which would leave the recorded source
# path unresolvable from the new working directory.
_lab_src="${BASH_SOURCE[1]:-$0}"
LAB_DIR="$(cd "$(dirname "$_lab_src")" 2>/dev/null && pwd || pwd)"
unset _lab_src

# Apply a manifest that lives beside the lab's run.sh.
apply() { run k -n "$NS" apply -f "$LAB_DIR/$1"; }
