#!/usr/bin/env bash
LAB="pv-pvc"
source "$(dirname "$0")/../../cluster/lib.sh"
require_cluster
ns_setup

# ---------------------------------------------------------------------------
# Cleanup. Two things this lab creates live outside the namespace, and
# ns_teardown can reach neither of them.
#
#   1. The PersistentVolume is CLUSTER-SCOPED. Deleting the namespace does
#      nothing to it, and a leftover Available PV with no class would sit there
#      waiting to capture the first classless claim any later lab creates.
#   2. hostPath storage is a real directory on a real node. That is the Retain
#      lesson restated as a chore: nothing deletes those bytes but you.
#
# So the trap ns_setup installed is replaced here with one that removes both,
# and it has to run on the failure path too — hence EXIT INT TERM rather than a
# tidy delete at the bottom of the script.
# ---------------------------------------------------------------------------
PV="sandbox-pv-pvc-static"
NODE=""

my_cleanup() {
  local code=$?
  # errexit is still armed inside a trap handler, and `(exit $code)` below is a
  # deliberately failing command on the failure path. Without this the handler
  # would abort on it and never reach ns_teardown — exactly the path that most
  # needs cleaning.
  set +e
  if [ "${KEEP:-0}" = "1" ]; then
    note "KEEP=1 — these things outside the namespace were left behind too:"
    note "  kubectl --context $CONTEXT delete pv $PV"
    note "  docker exec ${NODE:-<node>} rm -rf /mnt/sandbox-pv-pvc"
  else
    # Order matters, and the reason is the lab's own subject matter. The PV
    # carries a kubernetes.io/pv-protection finalizer and will not go away
    # while a claim references it; the claims carry kubernetes.io/pvc-protection
    # and will not go away while a Pod mounts one. So: Pods, then claims, then
    # the volume.
    k -n "$NS" delete pod --all --grace-period=0 --force >/dev/null 2>&1
    k -n "$NS" delete pvc --all --timeout=60s >/dev/null 2>&1
    k delete pv "$PV" --ignore-not-found --timeout=60s >/dev/null 2>&1
    # The path is a literal on purpose: never interpolate a variable into an
    # rm -rf aimed at a node.
    if [ -n "$NODE" ] && command -v docker >/dev/null 2>&1; then
      docker exec "$NODE" rm -rf /mnt/sandbox-pv-pvc >/dev/null 2>&1
    fi
  fi
  (exit $code); ns_teardown
}
trap my_cleanup EXIT INT TERM

# --- small helpers ---------------------------------------------------------

pvc_exists() {
  if k -n "$NS" get pvc "$1" >/dev/null 2>&1; then echo yes; else echo no; fi
}

pv_left_released() {
  local phase
  phase="$(k get pv "$PV" -o jsonpath='{.status.phase}' 2>/dev/null || true)"
  if [ -n "$phase" ] && [ "$phase" != "Released" ]; then echo yes; else echo no; fi
}

pvc_terminating() {
  local dt
  dt="$(k -n "$NS" get pvc "$1" -o jsonpath='{.metadata.deletionTimestamp}' 2>/dev/null || true)"
  if [ -n "$dt" ]; then echo yes; else echo no; fi
}

# Prove that a claim does NOT bind. A negative needs a window rather than a
# wait: there is no condition to poll for, so watch for a while and fail the
# moment the claim leaves Pending.
stays_pending() {
  local pvc="$1" seconds="$2" phase deadline
  deadline=$((SECONDS + seconds))
  while [ $SECONDS -lt $deadline ]; do
    phase="$(k -n "$NS" get pvc "$pvc" -o jsonpath='{.status.phase}' 2>/dev/null || true)"
    [ "$phase" = "Pending" ] || fail "$pvc should not have bound, but its phase is '$phase'"
    sleep 3
  done
  ok "$pvc was still Pending ${seconds}s later"
}

# ---------------------------------------------------------------------------

step "Pick the node the volume will live on"
NODE="$(k get nodes -l '!node-role.kubernetes.io/control-plane' -o jsonpath='{.items[0].metadata.name}')"
[ -n "$NODE" ] || fail "found no worker node to host the volume"
note "this PV is a hostPath — a directory on one node's disk — so it is pinned to $NODE"
note "(the control-plane node is excluded: it is tainted, and no Pod would land there)"

# A previous failed run could have left the volume behind — Released, still
# naming a claim that no longer exists — and left its directory on the node.
# apply would leave that stale status in place, so start from nothing.
k delete pv "$PV" --ignore-not-found --timeout=60s >/dev/null 2>&1 || true
if command -v docker >/dev/null 2>&1; then
  docker exec "$NODE" rm -rf /mnt/sandbox-pv-pvc >/dev/null 2>&1 || true
fi

step "An administrator creates the PersistentVolume"
note "\$ sed 's|__NODE__|$NODE|g' pv.yaml | kubectl apply -f -"
note "no -n on that apply: a PersistentVolume is cluster-scoped"
sed "s|__NODE__|$NODE|g" "$LAB_DIR/pv.yaml" | k apply -f -
run k get pv "$PV"

assert_eventually 60 "Available" "the PV is Available — it exists, and nobody has claimed it" \
  k get pv "$PV" -o jsonpath='{.status.phase}'
assert_eq "$(k get pv "$PV" -o jsonpath='{.spec.claimRef.name}')" "" \
  ".spec.claimRef is empty — the volume is not pointed at any claim yet"
assert_eq "$(k get pv "$PV" -o jsonpath='{.spec.persistentVolumeReclaimPolicy}')" "Retain" \
  "its reclaim policy is Retain, not the Delete a dynamically provisioned volume would have got"
assert_eq "$(k get pv "$PV" -o jsonpath='{.spec.capacity.storage}')" "1Gi" \
  "it offers 1Gi of capacity"
assert_eq "$(k get pv "$PV" -o jsonpath='{.spec.accessModes[0]}')" "ReadWriteOnce" \
  "and exactly one access mode, ReadWriteOnce"
note "no StorageClass and no provisioner were involved. Static provisioning means"
note "the storage already exists and the PV is merely the API object describing it."

step "A claim that asks for the wrong access mode never matches"
apply pvc-wrong-mode.yaml
note "wide asks for ReadWriteMany; the volume offers only ReadWriteOnce"
stays_pending wide 20
assert_eq "$(k get pv "$PV" -o jsonpath='{.status.phase}')" "Available" \
  "...while the PV sat there Available the whole time — the binder never paired them"
assert_eq "$(k -n "$NS" get pvc wide -o jsonpath='{.spec.volumeName}')" "" \
  "wide has an empty .spec.volumeName: no volume was ever assigned to it"
assert_eventually_contains 90 "FailedBinding" "the claim carries a FailedBinding event" \
  k -n "$NS" get events --field-selector involvedObject.name=wide
run k -n "$NS" get events --field-selector involvedObject.name=wide
note "access modes are matching criteria for binding, not permissions on the disk"

step "A matching claim binds to it"
apply pvc-data.yaml
assert_eventually 120 "Bound" "the claim data reached Bound" \
  k -n "$NS" get pvc data -o jsonpath='{.status.phase}'
run k -n "$NS" get pvc data
run k get pv "$PV"

assert_eq "$(k -n "$NS" get pvc data -o jsonpath='{.spec.volumeName}')" "$PV" \
  "the claim's .spec.volumeName names $PV"
assert_eventually 60 "Bound" "the PV reached Bound too — the binding is recorded on both objects" \
  k get pv "$PV" -o jsonpath='{.status.phase}'
assert_eq "$(k get pv "$PV" -o jsonpath='{.spec.claimRef.name}')" "data" \
  ".spec.claimRef.name on the PV is 'data'"
assert_eq "$(k get pv "$PV" -o jsonpath='{.spec.claimRef.namespace}')" "$NS" \
  "...in namespace $NS — a claim is namespaced, so the reference has to say which one"
PVC_UID="$(k -n "$NS" get pvc data -o jsonpath='{.metadata.uid}')"
[ -n "$PVC_UID" ] || fail "could not read the claim's UID"
assert_eq "$(k get pv "$PV" -o jsonpath='{.spec.claimRef.uid}')" "$PVC_UID" \
  "...and it pins that exact object by UID, so a later claim reusing the name is not the same claim"

step "A second identical claim has nothing left to bind to"
apply pvc-second.yaml
note "data-2 is byte-for-byte the same spec as data: same class, same size, same"
note "access mode, same selector. The only thing it lacks is a free volume."
stays_pending data-2 30
assert_eq "$(k -n "$NS" get pvc data-2 -o jsonpath='{.spec.volumeName}')" "" \
  "...with an empty .spec.volumeName"
assert_eq "$(k get pv "$PV" -o jsonpath='{.spec.claimRef.name}')" "data" \
  "and the PV still points at data — binding is exclusive, one PV to one PVC"
run k -n "$NS" get pvc

step "A Pod mounts the claim, and the claim cannot be deleted out from under it"
apply writer.yaml
run k -n "$NS" wait --for=condition=Ready pod/writer --timeout=180s
assert_eq "$(k -n "$NS" get pod writer -o jsonpath='{.spec.nodeName}')" "$NODE" \
  "the scheduler put writer on $NODE — the PV's nodeAffinity left it nowhere else to go"
run k -n "$NS" exec writer -- sh -c 'echo "written through claim data" > /data/hello.txt'
SEEN="$(k -n "$NS" exec writer -- cat /data/hello.txt)"
assert_eq "$SEEN" "written through claim data" "the Pod read back the file it wrote to the volume"

note "now delete the claim while the Pod is still using it"
run k -n "$NS" delete pvc data --wait=false
assert_eventually 60 "yes" "the claim has a deletionTimestamp — kubectl describe would say Terminating" \
  pvc_terminating data
assert_contains "$(k -n "$NS" get pvc data -o jsonpath='{.metadata.finalizers}')" \
  "kubernetes.io/pvc-protection" \
  "...but a kubernetes.io/pvc-protection finalizer is holding the object in the API"
assert_eq "$(k -n "$NS" get pvc data -o jsonpath='{.status.phase}')" "Bound" \
  "it is still Bound, and the Pod still has its filesystem"
assert_eq "$(k get pv "$PV" -o jsonpath='{.status.phase}')" "Bound" \
  "and the PV is still Bound — nothing has been released"

step "Retain: deleting the claim releases the volume instead of destroying it"
run k -n "$NS" delete pod writer
assert_eventually 120 "no" "the claim finished deleting the moment no Pod referenced it" \
  pvc_exists data
assert_eventually 120 "Released" "the PV moved to Released — the object survived its claim" \
  k get pv "$PV" -o jsonpath='{.status.phase}'
run k get pv "$PV"
assert_eq "$(k get pv "$PV" -o jsonpath='{.spec.claimRef.name}')" "data" \
  ".spec.claimRef still names a claim that no longer exists"
note "that stale reference is not a leak, it is the lock: a Released volume is"
note "offered to nobody, because the last tenant's bytes are still sitting on it"
assert_eq "$(k -n "$NS" get pvc data-2 -o jsonpath='{.status.phase}')" "Pending" \
  "data-2 is still Pending — Released is not the same thing as Available"
note "had the policy been Delete, the PV object and its backing storage would both"
note "be gone by now and there would be nothing here to release"

step "Manual reclamation: clearing the claimRef puts the volume back in service"
run k patch pv "$PV" -p '{"spec":{"claimRef":null}}'
assert_eq "$(k get pv "$PV" -o jsonpath='{.spec.claimRef.name}')" "" \
  ".spec.claimRef is gone — the lock is off"
# Deliberately not asserting on the Available phase. The volume really does
# pass through it, but the claim binder's resync can hand it to data-2 inside a
# single poll interval, so an assertion on Available would fail intermittently
# and teach nothing. Assert instead what is actually being claimed: the volume
# left Released, and the waiting claim got it.
assert_eventually 120 "yes" "the volume is out of Released — it is back in the pool" \
  pv_left_released
note "watch it closely and you can catch it sitting in Available in between"
assert_eventually 180 "Bound" "and data-2, Pending all this time, bound to it at last" \
  k -n "$NS" get pvc data-2 -o jsonpath='{.status.phase}'
assert_eq "$(k get pv "$PV" -o jsonpath='{.spec.claimRef.name}')" "data-2" \
  "the PV's claimRef now names data-2"
run k get pv "$PV"

apply reader.yaml
run k -n "$NS" wait --for=condition=Ready pod/reader --timeout=180s
STILL="$(k -n "$NS" exec reader -- cat /data/hello.txt)"
assert_eq "$STILL" "written through claim data" \
  "the new tenant read the previous tenant's file — Retain kept the bytes, and clearing a field did not wipe them"

assert_eq "$(k -n "$NS" get pvc wide -o jsonpath='{.status.phase}')" "Pending" \
  "wide is Pending even now: ReadWriteMany never matches a ReadWriteOnce volume, whatever else changes"
run k -n "$NS" get pvc

step "What this proves"
note "Static provisioning is two objects written by two different people. An"
note "administrator writes the PersistentVolume, which says 'this storage exists,"
note "here is how to reach it, here is what it can do'. A user writes the"
note "PersistentVolumeClaim, which says 'I need storage that can do these things'"
note "and names no volume at all. A controller in the control plane reads both"
note "and marries them."
note ""
note "The marriage is one-to-one and it is recorded on both sides. The claim gets"
note ".spec.volumeName; the volume gets .spec.claimRef, complete with the claim's"
note "namespace and UID. That is why data-2 — an identical claim in every"
note "respect — sat Pending: the volume was spoken for, and a PV is never shared"
note "between claims."
note ""
note "Everything the claim asks for is a matching criterion: the class, the"
note "capacity, the label selector, and the access modes. The wide claim proves"
note "the last one. It never bound, not even while the volume was idle, because"
note "ReadWriteMany is not in the volume's mode list. But matching is all access"
note "modes do here. They are not permissions: nothing stopped two Pods on the"
note "same node from writing through one ReadWriteOnce claim, and nothing would."
note "ReadWriteOncePod is the single mode the kubelet actually enforces at mount"
note "time."
note ""
note "Deleting a claim does not delete data, and it does not necessarily delete"
note "the volume either. kubernetes.io/pvc-protection held the claim in the API"
note "for as long as a Pod mounted it. Once the Pod was gone the claim went, and"
note "because the reclaim policy was Retain the PV stayed behind in Released,"
note "still naming its dead claim. Released is a dead end on purpose: an"
note "administrator must intervene. When one did — by clearing claimRef — the"
note "volume went back into the pool with the old data still on it, and the next"
note "claim inherited a stranger's files. Retain protects data; it does not"
note "sanitise it. That is why the documented route is to delete the PV, wipe the"
note "backing storage, and publish a fresh one."
