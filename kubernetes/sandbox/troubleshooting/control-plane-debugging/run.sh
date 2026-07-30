#!/usr/bin/env bash
LAB="control-plane-debugging"
source "$(dirname "$0")/../../cluster/lib.sh"
require_cluster
ns_setup

# ---------------------------------------------------------------------------
# THIS LAB DELIBERATELY TAKES THE API SERVER DOWN.
#
# For roughly a minute in the middle of this script, `kubectl` does not work
# against this cluster at all — not for you, not for any other terminal, not
# for the controller manager. That is the entire point: you cannot learn to
# debug a control plane through an API server that is answering. It is safe
# here only because this kind cluster is disposable and recreated with one
# command.
#
# The single line that makes it safe is the trap below. It restores
# /etc/kubernetes/manifests/kube-apiserver.yaml from a backup on EXIT, INT and
# TERM, before it does anything else, using nothing but `docker exec` — no
# kubectl, because kubectl is precisely what is broken when the trap matters
# most. Ctrl-C during the broken window still puts the cluster back.
#
# Two things live outside $NS and are therefore invisible to ns_teardown: the
# edit to the static Pod manifest on cka-sandbox-control-plane, and the backup
# file this script writes to /tmp on that node. The trap undoes both, and it
# does so even under KEEP=1 — a kept namespace is a debugging aid, a cluster
# left without an API server is a wrecked sandbox for every lab that follows.
#
# If the restore itself ever fails, the trap says so loudly and prints the
# recovery path: cluster/down.sh && cluster/up.sh.
# ---------------------------------------------------------------------------

CP_NODE="cka-sandbox-control-plane"
MANIFEST="/etc/kubernetes/manifests/kube-apiserver.yaml"
BACKUP="/tmp/sandbox-apiserver-backup.yaml"
# The value we plant in --secure-port. It is not a number, so kube-apiserver
# fails while parsing its flags and exits before it opens a socket — no half
# started API server, nothing written to etcd, nothing to unwind but one line
# of YAML. The token is distinctive so that we can find it again in the
# container's logs and in the manifest.
BOGUS="sandbox-broken-not-a-port"

CORRUPTED=0   # set to 1 immediately BEFORE the edit, cleared after a verified restore
CLEANED=0     # guards the trap against re-entry from a second Ctrl-C
POD_NODE=""   # filled in once the survivor Pod has been scheduled

command -v docker >/dev/null 2>&1 \
  || fail "this lab needs the docker CLI: when the API server is down, docker exec is the only way onto the node"
docker inspect "$CP_NODE" >/dev/null 2>&1 \
  || fail "no docker container named $CP_NODE — this lab assumes the 3-node kind cka-sandbox cluster"
docker exec "$CP_NODE" test -f "$MANIFEST" >/dev/null 2>&1 \
  || fail "$MANIFEST does not exist on $CP_NODE — this cluster was not built by kubeadm"

# --- restore, the one function that must never need kubectl -----------------
# Returns 0 once the manifest on the node no longer contains our planted value,
# 2 if there is no backup to restore from, 1 if the copy would not take.
restore_manifest() {
  docker exec "$CP_NODE" test -f "$BACKUP" >/dev/null 2>&1 || return 2
  local i=0
  while [ "$i" -lt 5 ]; do
    docker exec -i "$CP_NODE" cp "$BACKUP" "$MANIFEST" >/dev/null 2>&1
    if ! docker exec "$CP_NODE" grep -q -- "$BOGUS" "$MANIFEST" >/dev/null 2>&1; then
      return 0
    fi
    i=$((i + 1))
  done
  return 1
}

my_cleanup() {
  local code=$?
  # errexit is still armed inside a trap handler, and almost every command
  # below is "an error" on the path that matters most — the one where the
  # script already died. Disarm it, then ignore further interrupts so that an
  # impatient second Ctrl-C cannot abandon a half-finished restore.
  set +e
  trap '' INT TERM
  # An INT handler that calls exit re-enters here through the EXIT trap. The
  # work below is already done by then, so leave rather than repeat it.
  if [ "$CLEANED" = "1" ]; then exit "$code"; fi
  CLEANED=1

  if [ "$CORRUPTED" = "1" ] || docker exec "$CP_NODE" grep -q -- "$BOGUS" "$MANIFEST" >/dev/null 2>&1; then
    printf '\n%s   restoring %s on %s from %s%s\n' "$C_NOTE" "$MANIFEST" "$CP_NODE" "$BACKUP" "$C_OFF"
    if restore_manifest; then
      CORRUPTED=0
      printf '%s   ✓ the API server manifest is back to its backed-up contents%s\n' "$C_OK" "$C_OFF"
    else
      printf '%s   ✗ COULD NOT RESTORE %s ON %s%s\n' "$C_ERR" "$MANIFEST" "$CP_NODE" "$C_OFF" >&2
      printf '%s     recover the sandbox with:  cluster/down.sh && cluster/up.sh%s\n' "$C_ERR" "$C_OFF" >&2
    fi
  fi

  # Wait — bounded — for the API server to answer again before handing control
  # back. assert_eventually cannot be used here: it calls fail, and a trap
  # handler that exits early would skip the rest of the cleanup.
  local deadline=$((SECONDS + 300))
  while [ "$SECONDS" -lt "$deadline" ]; do
    k --request-timeout=10s get --raw=/livez >/dev/null 2>&1 && break
    sleep 3
  done

  if k --request-timeout=10s get --raw=/livez >/dev/null 2>&1; then
    docker exec "$CP_NODE" rm -f "$BACKUP" >/dev/null 2>&1
  else
    printf '%s   ✗ the API server is still not answering after 300s%s\n' "$C_ERR" "$C_OFF" >&2
    printf '%s     the backup is still on the node at %s — try:%s\n' "$C_ERR" "$BACKUP" "$C_OFF" >&2
    printf '%s       docker exec %s cat %s%s\n' "$C_ERR" "$CP_NODE" "$MANIFEST" "$C_OFF" >&2
    printf '%s       docker exec %s crictl ps -a --name kube-apiserver%s\n' "$C_ERR" "$CP_NODE" "$C_OFF" >&2
    printf '%s       docker exec %s systemctl restart kubelet%s\n' "$C_ERR" "$CP_NODE" "$C_OFF" >&2
    printf '%s     or rebuild the sandbox:  cluster/down.sh && cluster/up.sh%s\n' "$C_ERR" "$C_OFF" >&2
  fi

  # ns_teardown reads $? for its own exit status, so hand back what we came in
  # with. It uses kubectl, which is why it runs last rather than first.
  (exit "$code"); ns_teardown
}
trap my_cleanup EXIT INT TERM

# --- small readers, so the assertions below stay one line each --------------
# Every one ends in `|| true` so that "the API server is unreachable" — a state
# this lab produces on purpose — yields an empty string instead of aborting the
# script under errexit.
manifest_port_line() { docker exec "$CP_NODE" grep -m1 -- "--secure-port=" "$MANIFEST" 2>/dev/null || true; }
manifest_bytes()     { docker exec "$CP_NODE" wc -c "$1" 2>/dev/null | awk '{print $1}' || true; }
apiserver_reachable() {
  if k --request-timeout=10s get nodes -o name >/dev/null 2>&1; then echo up; else echo down; fi
}
ready_nodes() {
  k --request-timeout=10s get nodes --no-headers 2>/dev/null | awk '$2 == "Ready"' | wc -l | tr -d ' ' || true
}
# crictl talks to containerd on the node over a local socket. It keeps working
# when the API server is gone, which is the whole reason it is the tool of last
# resort on a control-plane node.
apiserver_ps()      { docker exec "$CP_NODE" crictl ps -a --name kube-apiserver 2>&1 || true; }
apiserver_running() { docker exec "$CP_NODE" crictl ps --name kube-apiserver -q 2>/dev/null | grep -c . || true; }
apiserver_logs() {
  docker exec "$CP_NODE" sh -c \
    'for id in $(crictl ps -a --name kube-apiserver -q 2>/dev/null | head -6); do crictl logs --tail=40 "$id" 2>&1; done' 2>&1 || true
}
kubelet_log()  { docker exec "$CP_NODE" journalctl -u kubelet --no-pager -n 800 2>&1 || true; }
survivor_ctrs() { docker exec "$POD_NODE" crictl ps --name survivor -q 2>/dev/null | grep -c . || true; }
# A read can be served out of a cache; a write cannot. Idempotent on purpose,
# so it can be polled: the create fails harmlessly on every attempt after the
# first, and the value read back is what the assertion is about.
write_probe() {
  k --request-timeout=15s -n "$NS" create configmap post-recovery --from-literal=state=healthy >/dev/null 2>&1 || true
  k --request-timeout=15s -n "$NS" get configmap post-recovery -o jsonpath='{.data.state}' 2>/dev/null || true
}
# ---------------------------------------------------------------------------

step "The control plane is four files on one node"
run docker exec "$CP_NODE" ls -A /etc/kubernetes/manifests
CP_FILES="$(docker exec "$CP_NODE" ls -A /etc/kubernetes/manifests 2>/dev/null || true)"
assert_contains "$CP_FILES" "kube-apiserver.yaml" "the API server is a static Pod manifest on $CP_NODE"
note "nothing schedules these. The kubelet on this node reads the directory and"
note "runs what it finds, which is the only bootstrap order that works: an API"
note "server cannot be a Deployment, because a Deployment needs an API server."
note "The corollary is the dangerous half: a text editor on this node is enough"
note "to stop the entire cluster, and no admission controller gets a vote."
run k get nodes
NODES_READY="$(ready_nodes)"
note "$NODES_READY nodes are Ready right now — that number is the one we expect back at the end"

step "A workload to watch while the control plane is gone"
apply survivor.yaml
run k -n "$NS" wait --for=condition=Ready pod/survivor --timeout=180s
SURVIVOR_UID="$(k -n "$NS" get pod survivor -o jsonpath='{.metadata.uid}')"
POD_NODE="$(k -n "$NS" get pod survivor -o jsonpath='{.spec.nodeName}')"
note "survivor is running on $POD_NODE with uid $SURVIVOR_UID"
docker inspect "$POD_NODE" >/dev/null 2>&1 \
  || fail "no docker container named $POD_NODE — cannot inspect the node the Pod landed on"
assert_eq "$(survivor_ctrs)" "1" "crictl on $POD_NODE sees exactly one survivor container"
note "we read that from the node's container runtime, not from the API. Keep the"
note "distinction in mind: for the next few minutes it is the only one available."

step "Back up the manifest before touching it"
run docker exec "$CP_NODE" cp "$MANIFEST" "$BACKUP"
assert_eq "$(manifest_bytes "$BACKUP")" "$(manifest_bytes "$MANIFEST")" \
  "the backup at $BACKUP is the same size as the original"
note "this copy is the difference between a two-minute lab and a rebuilt cluster."
note "Take it before the edit, every time, on a real cluster too — and take it"
note "somewhere the kubelet does NOT watch. A backup left in /etc/kubernetes/"
note "manifests is not a backup, it is a second static Pod."
ORIG_PORT_LINE="$(manifest_port_line)"
note "the line we are about to ruin: ${ORIG_PORT_LINE:-<no --secure-port line found>}"

step "Break it, one line"
# CORRUPTED is set BEFORE the edit, not after: if the sed is interrupted
# halfway the trap must still know that the manifest may be dirty.
CORRUPTED=1
if [ -n "$ORIG_PORT_LINE" ]; then
  run docker exec "$CP_NODE" sed -i "s|--secure-port=[0-9][0-9]*|--secure-port=$BOGUS|" "$MANIFEST"
else
  # kubeadm always emits --secure-port, but the lab does not stake a working
  # cluster on that: insert the flag instead. pflag fails on the first bad
  # value it parses, so an earlier bogus flag beats any later good one.
  run docker exec "$CP_NODE" sed -i \
    "s|^\\( *\\)- kube-apiserver\$|\\1- kube-apiserver\\n\\1- --secure-port=$BOGUS|" "$MANIFEST"
fi
BROKEN_PORT_LINE="$(manifest_port_line)"
assert_contains "$BROKEN_PORT_LINE" "$BOGUS" "the manifest now asks for a port that is not a number"
note "one character class, one substitution. No file deleted, nothing moved:"
note "the smaller the wound, the more certain the cure."

step "kubectl goes dark"
assert_eventually 180 "down" \
  "kubectl can no longer reach the API server — the kubelet acted on the edit" apiserver_reachable
# Guarded on purpose: errexit is armed, and a bare failing command here would
# abort the script and leave the cluster broken. The failure IS the assertion.
if OUT="$(k --request-timeout=10s get nodes 2>&1)"; then
  fail "expected 'kubectl get nodes' to fail while the API server is down, but it printed: $OUT"
fi
ok "kubectl get nodes failed: there is nothing listening to answer it"
note "kubectl said: $(printf '%s\n' "$OUT" | head -1)"
assert_not_contains "$OUT" "$CP_NODE" "that is an error message, not a list of nodes"
note "read the error carefully in real life. 'connection refused' means nothing"
note "is listening on the port; 'TLS handshake timeout' or a certificate error"
note "means something IS listening and the problem is elsewhere; 'Unauthorized'"
note "means the API server is fine and your credentials are not. Three different"
note "outages wearing one word, 'kubectl is broken'."

step "Diagnose from the node, where kubectl cannot help"
assert_eventually 180 "0" \
  "crictl reports zero RUNNING kube-apiserver containers on $CP_NODE" apiserver_running
run docker exec "$CP_NODE" crictl ps -a --name kube-apiserver
# Prove crictl still works against a container that is still UP, rather than
# against the one we just killed. A container that dies on a flag parse error
# never becomes a useful corpse: the kubelet keeps retrying the static Pod and
# garbage-collects the failed attempts, so `crictl ps -a --name kube-apiserver`
# is often completely empty by the time you look. Asserting a dead row exists
# would make this lab fail for a reason that has nothing to do with the lesson.
assert_contains "$(docker exec "$CP_NODE" crictl ps 2>&1 || true)" "etcd" \
  "crictl still works with the API server down — it lists the running etcd container"
note "crictl reaches containerd over a local socket. It never talks to the API"
note "server, which is exactly why it is the tool that still works."
note "note what is NOT here: no Exited kube-apiserver to inspect. A container"
note "that dies while parsing its flags is gone almost immediately, and the"
note "kubelet reaps the attempts, so the evidence lives in the node's logs"
note "rather than in the container list."
# Look in both places: crictl logs if an attempt happens to have survived, and
# the kubelet's journal, which records the failure either way.
diag_text() { printf '%s\n%s\n' "$(apiserver_logs)" "$(kubelet_log)"; }
assert_eventually_contains 240 "$BOGUS" \
  "the node's own logs show the API server rejecting the value we planted" diag_text
LOGTXT="$(diag_text)"
ERRLINE="$(printf '%s\n' "$LOGTXT" | grep -m1 -- "$BOGUS" || true)"
note "the API server's last words:"
note "  $ERRLINE"
note "a flag parse error, so it died before opening a socket. That is the"
note "cheapest possible failure: nothing served, nothing written, nothing to undo."
assert_eventually_contains 180 "kube-apiserver" \
  "journalctl -u kubelet shows the kubelet restarting the Pod in a loop" kubelet_log
run docker exec "$CP_NODE" journalctl -u kubelet --no-pager -n 6
note "the kubelet is doing its job perfectly: it reads the file, starts the"
note "container, watches it exit, backs off, and starts it again. Nothing here"
note "is broken except the YAML, and the kubelet has no way to know that."
assert_eq "$(survivor_ctrs)" "1" \
  "meanwhile the survivor Pod on $POD_NODE is still running, with no control plane at all"
note "no scheduler, no controller manager, no API server — and the workload has"
note "not noticed. A control-plane outage is an outage of CHANGE, not of service."

step "Restore from the backup"
run docker exec -i "$CP_NODE" cp "$BACKUP" "$MANIFEST"
RESTORED_PORT_LINE="$(manifest_port_line)"
assert_not_contains "$RESTORED_PORT_LINE" "$BOGUS" "the planted value is gone from the manifest"
assert_eq "$RESTORED_PORT_LINE" "$ORIG_PORT_LINE" "the --secure-port line is byte-for-byte what it was"
assert_eq "$(manifest_bytes "$MANIFEST")" "$(manifest_bytes "$BACKUP")" \
  "and the whole file matches the backup again"
CORRUPTED=0
note "the kubelet is watching this directory with inotify, so the copy is the"
note "whole repair. There is no command to run, nothing to restart, nobody to"
note "tell. Recovery is slow anyway: the API server has to start, read etcd and"
note "pass its own health checks before it answers."

step "The cluster comes back"
assert_eventually_contains 300 "$CP_NODE" "kubectl get nodes answers again" \
  k --request-timeout=15s get nodes
run k get nodes
assert_eventually 300 "$NODES_READY" "all $NODES_READY nodes are Ready again" ready_nodes
assert_eventually 300 "Running" "the kube-apiserver mirror Pod is Running once more" \
  k --request-timeout=15s -n kube-system get pod "kube-apiserver-$CP_NODE" -o jsonpath='{.status.phase}'
run k -n kube-system get pods -l component=kube-apiserver
note "answering a read is not the same as being healthy — try a write:"
note "  kubectl -n $NS create configmap post-recovery --from-literal=state=healthy"
assert_eventually 120 "healthy" \
  "the API server accepted a write, so this is a live control plane and not a cache" write_probe
assert_eq "$(k -n "$NS" get pod survivor -o jsonpath='{.metadata.uid}')" "$SURVIVOR_UID" \
  "the survivor Pod is the same object it was — same uid, never recreated"
assert_eq "$(k -n "$NS" get pod survivor -o jsonpath='{.status.containerStatuses[0].restartCount}')" "0" \
  "...and its container never restarted"
run docker exec "$CP_NODE" rm -f "$BACKUP"
assert_eq "$(manifest_bytes "$BACKUP")" "" "the backup file has been removed from the node"
note "the backup goes last, after the cluster is provably healthy. A lab that"
note "leaves files on a node is a lab that breaks the next one."

step "What this proves"
note "The API server is a container started from a file. /etc/kubernetes/"
note "manifests/kube-apiserver.yaml on the control-plane node is not a record of"
note "the API server, it is the API server, and the kubelet will act on any edit"
note "to it within seconds, with no validation, no admission control and no"
note "rollback. One non-numeric port was enough to take the cluster down."
note ""
note "When kubectl stops answering, kubectl is useless for finding out why, and"
note "so is every tool built on it: no describe, no logs, no events, no metrics."
note "The diagnosis moves onto the node and down a level, to the two things that"
note "never depended on the API server in the first place. crictl ps -a shows"
note "what the container runtime has been asked to run and what state it is in;"
note "crictl logs <id> on the most recent exited container gives you the process"
note "output that kubectl logs would have shown; journalctl -u kubelet gives you"
note "the kubelet's side of the story, which is where you learn whether it is"
note "failing to start a container or failing to reach the API server."
note ""
note "The failure is nearly always in that chain and nearly always mundane. A"
note "typo in a flag makes the process exit immediately and say so in its logs."
note "A bad image reference means no container is ever created, so there are no"
note "logs at all and the kubelet journal is the only witness. A wrong etcd"
note "endpoint or an expired certificate lets the process start and then hang or"
note "crash after some seconds — which is why 'has the container restarted?'"
note "distinguishes the cases faster than reading any single log."
note ""
note "And what did not break: the survivor Pod served the whole time, on a node"
note "whose kubelet could not reach the control plane. Existing workloads keep"
note "running, existing Services keep routing, and kube-proxy keeps the rules it"
note "already has. What you lose is change — no scheduling, no rescheduling, no"
note "scaling, no rollouts and no visibility. That is worth knowing at 3am,"
note "because it tells you the outage is a management-plane outage and buys you"
note "the composure to fix it properly."
note ""
note "The habit that made this survivable is the boring one: copy the file"
note "somewhere the kubelet does not watch before you touch it, and keep the"
note "edit small enough that a single copy back undoes it completely."
