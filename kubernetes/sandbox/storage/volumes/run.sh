#!/usr/bin/env bash
LAB="volumes"
source "$(dirname "$0")/../../cluster/lib.sh"
require_cluster
ns_setup

# ---------------------------------------------------------------------------
# Cleanup. The hostPath half of this lab writes a file onto a NODE, at
# /tmp/sandbox-volumes-probe. That file lives outside Kubernetes entirely —
# ns_teardown deletes a namespace and has no idea it exists — so the trap
# ns_setup installed is replaced here with one that scrubs the node too, and it
# runs on failure as well as success. A leftover probe file is not merely
# untidy: the next run of this lab, or any lab that inspects /tmp on a node,
# would be reading somebody else's residue.
#
# The scrub happens even under KEEP=1. A kept namespace is a debugging aid; a
# kept file on a node is a booby trap for whoever runs next.
# ---------------------------------------------------------------------------
NODE="cka-sandbox-worker"
NODE2="cka-sandbox-worker2"
PROBE_FILE="/tmp/sandbox-volumes-probe"
TAMPER_FILE="/tmp/sandbox-volumes-tamper"

my_cleanup() {
  local code=$?
  # errexit is still armed inside a trap handler, and every command below is an
  # error when there is nothing to remove — which is exactly the case when the
  # script died early, the run that most needs cleaning up.
  set +e
  docker exec "$NODE" rm -f "$PROBE_FILE" "$TAMPER_FILE" >/dev/null 2>&1
  docker exec "$NODE2" rm -f "$PROBE_FILE" "$TAMPER_FILE" >/dev/null 2>&1
  # ns_teardown reads $? to decide its own exit status, so hand it back the
  # status this handler was entered with.
  (exit "$code"); ns_teardown
}
trap my_cleanup EXIT INT TERM

command -v docker >/dev/null 2>&1 \
  || fail "this lab needs the docker CLI: the hostPath half places a file directly on a node"
docker inspect "$NODE" >/dev/null 2>&1 \
  || fail "no container named $NODE — this lab assumes the 3-node kind cka-sandbox cluster"
docker inspect "$NODE2" >/dev/null 2>&1 \
  || fail "no container named $NODE2 — this lab assumes the 3-node kind cka-sandbox cluster"

# --- small readers, so the assertions below stay one line each -------------
writer_restarts() {
  k -n "$NS" get pod shared -o jsonpath='{.status.containerStatuses[?(@.name=="writer")].restartCount}'
}
reader_restarts() {
  k -n "$NS" get pod shared -o jsonpath='{.status.containerStatuses[?(@.name=="reader")].restartCount}'
}
pod_uid()   { k -n "$NS" get pod "$1" -o jsonpath='{.metadata.uid}'; }
pod_node()  { k -n "$NS" get pod "$1" -o jsonpath='{.spec.nodeName}'; }
waiting_reason() { k -n "$NS" get pod "$1" -o jsonpath='{.status.containerStatuses[0].state.waiting.reason}'; }
# Reads the emptyDir straight off the node. $POD_NODE and $NODE_DIR are filled
# in further down; the function resolves them when it is called, not now.
node_scratch_dir() { docker exec "$POD_NODE" sh -c "ls -A '$NODE_DIR' 2>&1 || true"; }
# Events for one object, as "reason: message" lines.
pod_events() {
  k -n "$NS" get events --field-selector "involvedObject.name=$1" \
    -o jsonpath='{range .items[*]}{.reason}{": "}{.message}{"\n"}{end}'
}

step "One Pod, two containers, two emptyDir volumes"
apply shared-emptydir.yaml
run k -n "$NS" wait --for=condition=Ready pod/shared --timeout=180s
run k -n "$NS" get pod shared -o jsonpath='{range .spec.volumes[*]}{.name}{" -> "}{.emptyDir.medium}{"\n"}{end}'

VOLS="$(k -n "$NS" get pod shared -o jsonpath='{.spec.volumes[*].name}')"
assert_contains "$VOLS" "scratch" "the Pod carries the scratch volume (default medium)"
assert_contains "$VOLS" "cache" "...and the cache volume"
assert_eq "$(k -n "$NS" get pod shared -o jsonpath='{.spec.volumes[?(@.name=="cache")].emptyDir.medium}')" \
  "Memory" "cache asked for medium: Memory"
assert_eq "$(k -n "$NS" get pod shared -o jsonpath='{.spec.volumes[?(@.name=="scratch")].emptyDir.medium}')" \
  "" "scratch left medium unset, which is the default: a directory on the node"
note "the third volume in that list is not yours: admission injected a projected"
note "kube-api-access-* volume holding the service account token. It is a useful"
note "reminder that .spec.volumes is what the API server ended up with, not what"
note "you wrote."
note "nothing in the manifest says where the storage comes from — no PVC, no"
note "StorageClass, no provisioner. An emptyDir is created by the kubelet at"
note "the moment the Pod is assigned to a node, and that is the whole lifecycle."

step "The volume belongs to the Pod, so both containers see it"
run k -n "$NS" exec shared -c writer -- sh -c 'echo "written by writer" > /scratch/message.txt'
SEEN="$(k -n "$NS" exec shared -c reader -- cat /scratch/message.txt)"
assert_eq "$SEEN" "written by writer" "the reader container read the file the writer wrote"
note "two containers, two root filesystems, one shared directory mounted into"
note "both. The mount paths happen to match here, but nothing requires that:"
note "the volume is identified by its name in the Pod spec, not by where a"
note "container chooses to hang it."

step "Where that directory actually is"
POD_UID="$(pod_uid shared)"
POD_NODE="$(pod_node shared)"
note "Pod UID $POD_UID, scheduled onto $POD_NODE"
NODE_DIR="/var/lib/kubelet/pods/$POD_UID/volumes/kubernetes.io~empty-dir/scratch"
run docker exec "$POD_NODE" sh -c "ls -l '$NODE_DIR' || true"
LISTING="$(docker exec "$POD_NODE" sh -c "ls -A '$NODE_DIR' 2>/dev/null || true")"
assert_contains "$LISTING" "message.txt" \
  "the emptyDir is an ordinary directory under /var/lib/kubelet on $POD_NODE"
note "the kubelet names it after the Pod's UID, which is the first hint about"
note "what happens when the Pod goes away and a new UID takes its place."

step "medium: Memory is a tmpfs, not a directory"
CACHE_MNT="$(k -n "$NS" exec shared -c reader -- sh -c 'grep " /cache " /proc/mounts || true')"
note "$CACHE_MNT"
assert_contains "$CACHE_MNT" "tmpfs" "/cache is mounted as tmpfs — RAM, not disk"
SCRATCH_MNT="$(k -n "$NS" exec shared -c reader -- sh -c 'grep " /scratch " /proc/mounts || true')"
note "$SCRATCH_MNT"
# Check the line exists before checking what it is not: assert_not_contains on
# an empty string would pass while proving nothing.
assert_contains "$SCRATCH_MNT" "/scratch" "/scratch has a mount entry of its own"
assert_not_contains "$SCRATCH_MNT" "tmpfs" \
  "...and it is backed by the node's real filesystem, not a tmpfs"
run docker exec "$POD_NODE" sh -c "grep empty-dir /proc/mounts | grep '$POD_UID' || true"
note "the node agrees: the tmpfs is mounted at the kubelet's path for the cache"
note "volume, and there is no such mount for scratch"

run k -n "$NS" exec shared -c reader -- sh -c 'echo "hot data" > /cache/hot.txt'
assert_eq "$(k -n "$NS" exec shared -c reader -- cat /cache/hot.txt)" "hot data" \
  "a tmpfs is still just a filesystem — ordinary reads and writes"
note "the difference is what it costs. Bytes written here are held in RAM and"
note "count against the memory limit of the container that wrote them, so an"
note "unbounded memory-backed emptyDir is a way to get a container OOM-killed"
note "by writing files. sizeLimit: 32Mi is the cap; leave it off and the volume"
note "is sized to the node's allocatable memory."

step "An emptyDir survives a container restart"
UID_BEFORE="$POD_UID"
assert_eq "$(writer_restarts)" "0" "the writer container has not restarted yet"
note "the writer is blocked waiting for /scratch/restart-me; creating it from"
note "the OTHER container makes the writer exit non-zero, and restartPolicy"
note "Always makes the kubelet start it again"
run k -n "$NS" exec shared -c reader -- touch /scratch/restart-me
assert_eventually 180 "1" "the writer container restarted exactly once" writer_restarts
assert_eq "$(reader_restarts)" "0" \
  "the reader container was untouched — a restart is per-container, not per-Pod"
run k -n "$NS" wait --for=condition=Ready pod/shared --timeout=180s
run k -n "$NS" get pod shared

assert_eq "$(pod_uid shared)" "$UID_BEFORE" \
  "the Pod object never changed: same UID, so this is the same Pod on the same node"
assert_eq "$(pod_node shared)" "$POD_NODE" "...and still on $POD_NODE"
assert_eq "$(k -n "$NS" exec shared -c writer -- cat /scratch/message.txt)" "written by writer" \
  "the brand-new writer container can still read the file"
STARTS="$(k -n "$NS" exec shared -c writer -- sh -c 'wc -l < /scratch/starts.log' | tr -d '[:space:]')"
assert_eq "$STARTS" "2" \
  "starts.log holds two lines — the second container instance is reading what the first one wrote"
assert_eq "$(k -n "$NS" exec shared -c reader -- cat /cache/hot.txt)" "hot data" \
  "the memory-backed volume survived the restart too — it belongs to the Pod, not the container"

step "An emptyDir does not survive the Pod"
run k -n "$NS" delete pod shared --timeout=120s
# The API object goes first and the kubelet's housekeeping loop reclaims the
# directory a moment later, so this is a poll rather than a single look.
assert_eventually_contains 120 "No such file" \
  "the kubelet deleted the directory off $POD_NODE once the Pod left the node" \
  node_scratch_dir

apply shared-emptydir.yaml
run k -n "$NS" wait --for=condition=Ready pod/shared --timeout=180s
NEW_UID="$(pod_uid shared)"
assert_not_contains "$NEW_UID" "$UID_BEFORE" \
  "same name, new object: the recreated Pod has a different UID ($NEW_UID)"

if OUT="$(k -n "$NS" exec shared -c writer -- cat /scratch/message.txt 2>&1)"; then
  fail "expected /scratch/message.txt to be gone from the new Pod's emptyDir"
fi
note "$OUT"
assert_contains "$OUT" "No such file" "the file the previous Pod wrote is gone"
STARTS="$(k -n "$NS" exec shared -c writer -- sh -c 'wc -l < /scratch/starts.log' | tr -d '[:space:]')"
assert_eq "$STARTS" "1" "starts.log is back to a single line — a fresh, empty volume"
assert_eq "$(k -n "$NS" exec shared -c reader -- sh -c 'ls -A /cache')" "" \
  "the memory-backed emptyDir came back empty as well"
note "nothing failed and nothing warned. \"Ephemeral\" is not a caveat on"
note "emptyDir, it is the definition: delete the Pod and the data is gone,"
note "whether you deleted it, a node drained, or an eviction moved it."

step "hostPath: put a file on a node, then read it from a Pod"
run docker exec "$NODE" sh -c "echo hello > $PROBE_FILE"
assert_eq "$(docker exec "$NODE" cat "$PROBE_FILE")" "hello" \
  "the probe file exists on $NODE — and, deliberately, on no other node"
apply hostpath.yaml
run k -n "$NS" wait --for=condition=Ready pod/node-reader --timeout=180s
assert_eq "$(pod_node node-reader)" "$NODE" \
  "node-reader landed on $NODE, because its nodeSelector pinned it by hostname"
assert_eq "$(k -n "$NS" exec node-reader -- cat /node/probe.txt)" "hello" \
  "the Pod read a file that Kubernetes never created, stored, or replicated"
LISTING="$(k -n "$NS" exec node-reader -- ls /node-tmp)"
assert_contains "$LISTING" "sandbox-volumes-probe" \
  "the second mount is a live window onto the node's own /tmp"
note "no PersistentVolume, no PersistentVolumeClaim, no provisioner. hostPath"
note "is the container runtime's bind mount, exposed as a Kubernetes volume."

if OUT="$(k -n "$NS" exec node-reader -- sh -c "echo tampered > /node-tmp/sandbox-volumes-tamper" 2>&1)"; then
  fail "expected the readOnly hostPath mount to reject a write to the node"
fi
note "$OUT"
assert_contains "$OUT" "Read-only file system" \
  "readOnly: true stopped the Pod writing into the node's filesystem"
note "that flag is the only thing that stopped it. Without readOnly, this Pod"
note "could rewrite anything under /tmp on $NODE, and a hostPath of / would"
note "give it the node's root filesystem — kubelet credentials, container"
note "runtime socket and all. That is why hostPath is restricted by policy"
note "(the Baseline Pod Security Standard forbids it outright) rather than"
note "merely discouraged."

step "hostPath ties the Pod to one specific node"
note "apply the same volume with the nodeSelector changed to $NODE2, where the"
note "probe file was never created"
apply elsewhere.yaml
assert_eventually_contains 180 "FailedMount" \
  "the Pod on $NODE2 cannot mount the volume" pod_events elsewhere
run k -n "$NS" get events --field-selector involvedObject.name=elsewhere
assert_eq "$(pod_node elsewhere)" "$NODE2" \
  "it was scheduled: the scheduler had no reason to object, because it does not check hostPaths"
assert_eventually 60 "ContainerCreating" \
  "...but the kubelet never got as far as starting the container" waiting_reason elsewhere
assert_eq "$(k -n "$NS" exec node-reader -- cat /node/probe.txt)" "hello" \
  "meanwhile the identical manifest on $NODE is still perfectly happy"
note "type: File is what turned a silent difference into a loud one. With the"
note "type left empty the kubelet performs no check at all, and you get a"
note "different failure — or, with DirectoryOrCreate, a brand new empty"
note "directory quietly conjured on the wrong node."
run k -n "$NS" delete pod elsewhere --timeout=60s

step "What this proves"
note "A Pod's volumes are named in the Pod spec and mounted per container, so"
note "the volume outlives any one container and is shared by all of them. That"
note "is the whole of what emptyDir offers: the writer container was replaced"
note "under the same Pod UID and its successor read a file its predecessor had"
note "written, while the reader container beside it never noticed."
note ""
note "The boundary is the Pod, not the container and not the node. Deleting the"
note "Pod deleted the directory under /var/lib/kubelet, and the replacement Pod"
note "— same name, new UID — got an empty one. Nothing warns you about this,"
note "so an emptyDir is right for scratch space, caches, and handoffs between"
note "containers, and wrong for anything you would miss."
note ""
note "medium: Memory swaps the backing store without changing the interface. It"
note "is a tmpfs: fast, never written to disk, wiped on node reboot, and paid"
note "for out of the writing container's memory limit. Use it for secrets you"
note "do not want landing on disk and for small hot data; do not use it as a"
note "free performance upgrade, because the bytes are real memory."
note ""
note "hostPath is the opposite trade. The data does outlive the Pod, because"
note "Kubernetes is not managing it at all — it is a bind mount of the node's"
note "filesystem, and node filesystems are not interchangeable. That is why the"
note "identical manifest ran on $NODE and hung on $NODE2, and why every hostPath"
note "Pod needs a nodeSelector, a node affinity, or a DaemonSet to keep it where"
note "its data is. It is also a direct route out of the container: readOnly and"
note "a path scoped to a single file are the minimum, and a policy that blocks"
note "hostPath entirely is the real answer for shared clusters."
note ""
note "Legitimate uses do exist, and they are all node-level: a log shipper"
note "reading /var/log, a monitoring agent reading /proc, the static Pod"
note "manifests the control plane itself mounts. And on a single-node practice"
note "cluster a hostPath is what backs a hand-written PersistentVolume — which"
note "is exactly why a manual PV built that way must never be trusted on a"
note "multi-node cluster without nodeAffinity to pin it down."
