#!/usr/bin/env bash
LAB="etcd-backup"
source "$(dirname "$0")/../../cluster/lib.sh"
require_cluster
ns_setup

# ---------------------------------------------------------------------------
# This lab creates nothing in $NS — everything it touches lives in kube-system
# or on the control-plane node. ns_setup still runs so that the lab behaves
# like every other one (same namespace naming, same KEEP=1 contract), and so
# that a future edit that does need a scratch namespace already has one.
#
# What it DOES create outside $NS is a file on a node: the snapshot itself, at
# /var/lib/etcd/sandbox-snapshot.db on the control plane. ns_teardown deletes
# exactly one namespace and would never touch it, so the trap below is replaced
# with one that removes the file as well — armed on EXIT INT TERM rather than
# written as a tidy delete at the bottom of the script, because the failure
# path is the one that most needs cleaning. /var/lib/etcd is etcd's own live
# data directory; leaving litter in it is not something a lab gets to do.
# ---------------------------------------------------------------------------

command -v docker >/dev/null 2>&1 \
  || fail "this lab needs the docker CLI to reach the kind node's filesystem"

SNAP="/var/lib/etcd/sandbox-snapshot.db"

# Both of these are read again — visibly, with run — in step 1. They are
# resolved here first because the cleanup trap has to know which node holds the
# snapshot before anything can go wrong, and the node that matters is the one
# the etcd Pod is actually on, not merely "a control-plane node".
ETCD_POD="$(k -n kube-system get pods -l component=etcd \
  -o jsonpath='{.items[0].metadata.name}')"
[ -n "$ETCD_POD" ] || fail "no Pod labelled component=etcd in kube-system"
CP_NODE="$(k -n kube-system get pod "$ETCD_POD" -o jsonpath='{.spec.nodeName}')"
[ -n "$CP_NODE" ] || fail "could not read the node name for Pod $ETCD_POD"
docker inspect "$CP_NODE" >/dev/null 2>&1 \
  || fail "no docker container named '$CP_NODE' — is this a kind cluster on this host?"

HOST_DIR="$(mktemp -d "${TMPDIR:-/tmp}/sandbox-etcd-backup.XXXXXX")"
HOST_SNAP="$HOST_DIR/$(basename "$SNAP")"

my_cleanup() {
  local code=$?
  # errexit is still armed inside a trap handler, and `(exit $code)` below is
  # deliberately a failing command whenever the lab failed. Without this the
  # handler would abort on it and never reach ns_teardown.
  set +e
  docker exec "$CP_NODE" rm -f "$SNAP" >/dev/null 2>&1
  if [ "${KEEP:-0}" = "1" ]; then
    note "KEEP=1 — the retrieved snapshot is still on this host at:"
    note "  $HOST_SNAP"
    note "Remove it when you are done: rm -rf $HOST_DIR"
    note "The copy on $CP_NODE was deleted either way: /var/lib/etcd is etcd's"
    note "own data directory and nothing but etcd belongs in it."
  else
    rm -rf "$HOST_DIR" >/dev/null 2>&1
  fi
  (exit $code); ns_teardown
}
trap my_cleanup EXIT INT TERM

# --- small helpers ---------------------------------------------------------

# Echo a command the way run() does, then hand back its combined output so it
# can be asserted on. The echo is pushed to stderr so it reaches the terminal
# instead of being swallowed by the caller's command substitution.
cap() { note "\$ $*" >&2; "$@" 2>&1; }

nonempty() { if [ -s "$1" ]; then echo yes; else echo no; fi; }

# ---------------------------------------------------------------------------

step "Find the etcd Pod without hardcoding its name"
note "the name is etcd-<node>, so it differs on every cluster — ask for it by label"
run k -n kube-system get pods -l component=etcd -o wide
note "etcd Pod: $ETCD_POD, on node $CP_NODE"
assert_eventually 120 "Running" "the etcd Pod is Running" \
  k -n kube-system get pod "$ETCD_POD" -o 'jsonpath={.status.phase}'

OWNER="$(k -n kube-system get pod "$ETCD_POD" \
  -o jsonpath='{.metadata.ownerReferences[0].kind}')"
assert_eq "$OWNER" "Node" \
  "its only owner is a Node — this is a mirror Pod for a static Pod, not a controller's Pod"
note "the real definition is a file on the node: /etc/kubernetes/manifests/etcd.yaml"

step "Where the backup command's paths come from"
VOLS="$(k -n kube-system get pod "$ETCD_POD" \
  -o jsonpath='{range .spec.volumes[*]}{.name}{" -> hostPath "}{.hostPath.path}{"\n"}{end}')"
note "$VOLS"
assert_contains "$VOLS" "/etc/kubernetes/pki/etcd" \
  "the Pod mounts the node's etcd PKI directory — that is where --cacert/--cert/--key live"
assert_contains "$VOLS" "/var/lib/etcd" \
  "and the node's /var/lib/etcd, etcd's data directory"

MOUNTS="$(k -n kube-system get pod "$ETCD_POD" \
  -o jsonpath='{range .spec.containers[0].volumeMounts[*]}{.name}{" -> "}{.mountPath}{"\n"}{end}')"
note "$MOUNTS"
assert_contains "$MOUNTS" "/var/lib/etcd" \
  "...mounted at the same path inside the container, so one path names both places"
note "that coincidence is what makes the snapshot retrievable later: a file the"
note "container writes to /var/lib/etcd is a file on the node's /var/lib/etcd"

step "Trap 1 — the etcd image is distroless, so 'sh -c' cannot work"
IMG="$(k -n kube-system get pod "$ETCD_POD" \
  -o jsonpath='{.spec.containers[0].image}')"
note "image: $IMG"
note "the recipe everyone copies is: kubectl exec ... -- sh -c 'ETCDCTL_API=3 etcdctl ...'"
if OUT="$(cap k -n kube-system exec "$ETCD_POD" -- sh -c 'echo hello')"; then
  fail "expected the distroless etcd image to have no shell"
fi
note "$OUT"
assert_contains "$OUT" "executable file not found" \
  "there is no /bin/sh in the image — the wrapper fails before etcdctl is ever reached"
note "so exec the binary directly. The env var the wrapper existed to set is a"
note "v3.3-era relic anyway: v3 has been etcdctl's default since 3.4, and etcd"
note "3.6 dropped ETCDCTL_API entirely."

step "Take the snapshot"
note "flags, not guesswork: --endpoints is etcd's own loopback listener, and the"
note "three cert paths are the ones the manifest already mounts"
if ! SAVE_OUT="$(cap k -n kube-system exec "$ETCD_POD" -- etcdctl \
      --endpoints=https://127.0.0.1:2379 \
      --cacert=/etc/kubernetes/pki/etcd/ca.crt \
      --cert=/etc/kubernetes/pki/etcd/server.crt \
      --key=/etc/kubernetes/pki/etcd/server.key \
      snapshot save "$SNAP")"; then
  note "$SAVE_OUT"
  fail "etcdctl snapshot save did not succeed"
fi
note "$SAVE_OUT"
assert_contains "$SAVE_OUT" "Snapshot saved" \
  "etcdctl wrote a consistent point-in-time copy of the keyspace to $SNAP"
note "snapshot save is a client operation — it talks to a running member over"
note "the network, which is why it is still an etcdctl subcommand"

step "Trap 2 — verify it with etcdutl; etcd 3.6 removed etcdctl's status"
# Note what this does NOT do: check the exit code. etcdctl no longer has a
# `status` subcommand, but it does not treat that as an error — it prints the
# usage text for `snapshot` and exits 0. A script that trusted $? here would
# conclude the snapshot had been verified when nothing was read at all.
OUT="$(cap k -n kube-system exec "$ETCD_POD" -- etcdctl snapshot status "$SNAP" || true)"
note "$OUT"
assert_not_contains "$OUT" "REVISION" \
  "etcdctl cannot read the snapshot back: the subcommand was deprecated in 3.5 and removed in 3.6"
assert_contains "$OUT" "USAGE" \
  "...and it says so only by printing usage — it still exits 0, so \$? would lie to you"

note "the offline half of the toolset moved to etcdutl, which reads data files"
note "directly and needs no endpoint and no certificates at all"
if ! STATUS_OUT="$(cap k -n kube-system exec "$ETCD_POD" -- \
      etcdutl snapshot status "$SNAP" -w table)"; then
  note "$STATUS_OUT"
  fail "etcdutl could not read the snapshot back — the file is not a valid snapshot"
fi
note "$STATUS_OUT"
assert_contains "$STATUS_OUT" "REVISION" \
  "etcdutl parsed the file and reported the revision it was taken at"
assert_contains "$STATUS_OUT" "TOTAL" \
  "...along with the key count and size, which is what separates a backup from an empty file"
note "the revision is the concrete form of 'point in time': everything committed"
note "at or before it is in the file, everything after it is not"

step "Trap 3 — getting the bytes off the node"
note "kubectl cp is the obvious move, and it cannot work here: it shells out to"
note "tar inside the container, and a distroless image has no tar either"
if OUT="$(cap k cp "kube-system/$ETCD_POD:$SNAP" "$HOST_DIR/via-kubectl-cp.db")"; then
  fail "expected kubectl cp to fail against a distroless container"
fi
note "$OUT"
assert_eq "$(nonempty "$HOST_DIR/via-kubectl-cp.db")" "no" \
  "nothing usable arrived on the host — kubectl cp is not an option for etcd"

note "docker cp works instead, but note what it addresses: the NODE container,"
note "not the etcd container. It only finds the file because /var/lib/etcd is a"
note "hostPath, so the snapshot is genuinely sitting on the node's filesystem."
run docker cp "$CP_NODE:$SNAP" "$HOST_DIR/"
assert_eq "$(nonempty "$HOST_SNAP")" "yes" \
  "the snapshot is on this host at $HOST_SNAP and is not empty"
NODE_SIZE="$(docker exec "$CP_NODE" stat -c %s "$SNAP" | tr -d '[:space:]')"
HOST_SIZE="$(wc -c < "$HOST_SNAP" | tr -d '[:space:]')"
assert_eq "$HOST_SIZE" "$NODE_SIZE" \
  "the copy is byte-for-byte the same size as the file on the node ($NODE_SIZE bytes), so it is not truncated"
run ls -l "$HOST_DIR"

note ""
note "the same save aimed at /tmp would print 'Snapshot saved' exactly the same"
note "way, and would be unrecoverable: /tmp is not a hostPath, so the file would"
note "land in the etcd container's own writable layer. docker cp against the"
note "node would not find it, kubectl cp against the Pod cannot work at all, and"
note "the image has no rm to clean it up with — it would sit there consuming"
note "disk until the kubelet next recreated the container. This lab does not"
note "perform that save for precisely that reason. Always save under a hostPath."

step "Restore — described, deliberately not performed"
note "restoring rewrites a data directory, so doing it here would take the"
note "cluster down for every other lab. What can be checked safely is that the"
note "tool and the flag the procedure depends on are really there:"
HELP_OUT="$(k -n kube-system exec "$ETCD_POD" -- etcdutl snapshot restore --help 2>&1 || true)"
assert_contains "$HELP_OUT" "data-dir" \
  "etcdutl snapshot restore exists and takes --data-dir (etcdctl's restore is gone too)"
note ""
note "the procedure, for reference:"
note "  1. stop the API servers (move kube-apiserver.yaml out of /etc/kubernetes/manifests)"
note "  2. etcdutl snapshot restore $SNAP --data-dir /var/lib/etcd-restored"
note "     — the target directory must not already exist"
note "  3. edit /etc/kubernetes/manifests/etcd.yaml so the etcd-data volume's"
note "     hostPath points at /var/lib/etcd-restored"
note "  4. put kube-apiserver.yaml back and restart the other control-plane components"
note "the kubelet notices both manifest edits on its own — there is no kubectl"
note "step, and there could not be one, since the API server is down."

step "What this proves"
note "An etcd backup is one client call — etcdctl snapshot save against a live"
note "member, authenticated with the same CA, cert and key the etcd static Pod"
note "already mounts — and the whole cluster's state comes out in a single file."
note "Every object anyone ever created is in there, which is what makes the"
note "snapshot both the most valuable and the most dangerous file on the node."
note ""
note "Three details decide whether that call actually leaves you with a backup,"
note "and all three are invisible until you hit them:"
note ""
note "The etcd image is distroless. The wrapper form that circulates everywhere,"
note "kubectl exec ... -- sh -c '...', fails with 'executable file not found'"
note "before etcdctl runs at all. Exec the binary directly and drop the env var."
note ""
note "etcdctl and etcdutl split the job. etcdctl talks to a running member over"
note "the network and still owns snapshot save; etcdutl reads data files offline"
note "and now owns snapshot status and snapshot restore, both removed from"
note "etcdctl in 3.6. Verification needs no endpoint and no certificates."
note ""
note "And where you write matters more than whether the write succeeds. Only"
note "paths the manifest mounts as hostPaths are reachable from outside the"
note "container. A snapshot under /var/lib/etcd is a file on the node that"
note "docker cp — or scp, on a real cluster — can collect. A snapshot under"
note "/tmp reports success and is stranded, because kubectl cp needs a tar the"
note "image does not have. A backup you cannot retrieve is not a backup."
