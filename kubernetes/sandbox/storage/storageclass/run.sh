#!/usr/bin/env bash
LAB="storageclass"
source "$(dirname "$0")/../../cluster/lib.sh"
require_cluster
ns_setup

# ---------------------------------------------------------------------------
# Cleanup. Everything this lab creates directly is namespaced: one
# PersistentVolumeClaim and a handful of Pods. The PersistentVolume that shows
# up in step 3 IS cluster-scoped, but it is not ours to delete by hand — it was
# provisioned dynamically, it carries a claimRef into $NS, and the class's
# reclaim policy is Delete. Removing the namespace removes the claim, which
# releases the volume, which the provisioner then deletes. So the trap that
# ns_setup installed is the correct one and this lab does not replace it.
#
# The one thing to know is that under KEEP=1 the volume outlives the run along
# with the namespace, and deleting the namespace later is what finally reclaims
# it. A stray Bound PVC pins a node, so do not leave one lying around.
# ---------------------------------------------------------------------------

# --- helpers ---------------------------------------------------------------

# Every PersistentVolume in the cluster whose claimRef points into this lab's
# namespace, as "<ns>/<claim> -> <pv>". PVs are cluster-scoped and other labs
# may have left their own behind, so "is there a volume for *our* claim" is the
# only question worth asking here.
pvs_for_ns() {
  k get pv -o 'jsonpath={range .items[*]}{.spec.claimRef.namespace}{"/"}{.spec.claimRef.name}{" -> "}{.metadata.name}{"\n"}{end}' 2>/dev/null \
    | grep "^${NS}/" || true
}

stranded_events() {
  k -n "$NS" get events --field-selector involvedObject.name=stranded \
    -o 'jsonpath={range .items[*]}{.reason}{": "}{.message}{"\n"}{end}' 2>/dev/null || true
}

# The scheduler's wording for this particular rejection changed in v1.33: it
# used to read "node(s) had volume node affinity conflict" and now reads
# "node(s) didn't match PersistentVolume's node affinity". Accept either, so
# the assertion is about the behaviour rather than about a release's phrasing.
volume_affinity_rejected() {
  local ev
  ev="$(stranded_events)"
  case "$ev" in
    *"volume node affinity conflict"*|*"PersistentVolume's node affinity"*) echo yes ;;
    *) echo no ;;
  esac
}

# stranded.yaml has to name a node that is only known at run time, so it goes
# through sed rather than through the plain `apply` helper.
render_apply() {
  note "applying $1 with __NODE__=$2"
  sed -e "s|__NODE__|$2|g" "$LAB_DIR/$1" | k -n "$NS" apply -f -
}

# ---------------------------------------------------------------------------

step "The default StorageClass"
run k get sc
SC_LIST="$(k get sc)"
assert_contains "$SC_LIST" "standard (default)" \
  "kubectl marks 'standard' as the cluster's default class"
assert_eq "$(k get sc standard -o jsonpath='{.metadata.annotations.storageclass\.kubernetes\.io/is-default-class}')" "true" \
  "...which is nothing more than the annotation storageclass.kubernetes.io/is-default-class: true"
assert_eq "$(k get sc standard -o jsonpath='{.provisioner}')" "rancher.io/local-path" \
  "its provisioner is rancher.io/local-path — directories on a node's disk, not network storage"
assert_eq "$(k get sc standard -o jsonpath='{.reclaimPolicy}')" "Delete" \
  "reclaimPolicy is Delete, so a volume is destroyed when its claim goes away"
assert_eq "$(k get sc standard -o jsonpath='{.volumeBindingMode}')" "WaitForFirstConsumer" \
  "volumeBindingMode is WaitForFirstConsumer — binding is deferred until a Pod needs the volume"
note "a StorageClass has no .spec: provisioner, reclaimPolicy and"
note "volumeBindingMode all sit at the top level of the object"

step "A claim with no consumer: Pending, and no volume anywhere"
apply pvc.yaml
assert_eq "$(k -n "$NS" get pvc data -o jsonpath='{.spec.storageClassName}')" "standard" \
  "pvc.yaml names no class, and the DefaultStorageClass admission plugin wrote in 'standard'"
assert_eventually 60 "Pending" "the claim is Pending" \
  k -n "$NS" get pvc data -o 'jsonpath={.status.phase}'
assert_eventually_contains 120 "WaitForFirstConsumer" \
  "the claim's own events name the reason: a WaitForFirstConsumer event from persistentvolume-controller" \
  k -n "$NS" describe pvc data
run k -n "$NS" describe pvc data

DESC="$(k -n "$NS" describe pvc data)"
assert_contains "$DESC" "waiting for first consumer to be created before binding" \
  "...and the message spells it out: waiting for first consumer to be created before binding"
assert_eq "$(k -n "$NS" get pvc data -o jsonpath='{.status.phase}')" "Pending" \
  "the claim is STILL Pending seconds later — this is a steady state, not a slow bind"
assert_eq "$(k -n "$NS" get pvc data -o jsonpath='{.spec.volumeName}')" "" \
  ".spec.volumeName is empty: the claim is bound to nothing"
assert_eq "$(k -n "$NS" get pvc data -o jsonpath='{.metadata.annotations.volume\.kubernetes\.io/selected-node}')" "" \
  "and there is no volume.kubernetes.io/selected-node annotation yet, because no node has been chosen"

run k get pv
# assert_eventually rather than assert_eq, for one specific reason: this lab's
# own previous run reclaims its volume asynchronously. ns_setup waits for the
# namespace to disappear, but the PV only becomes Released once the claim is
# gone and is deleted a few seconds after that, so a back-to-back re-run can
# still see the old one. Waiting for empty tolerates that without weakening the
# claim being made — a WaitForFirstConsumer class that provisioned early would
# produce a volume that never goes away, and this would fail at the timeout.
assert_eventually 60 "" \
  "no PersistentVolume exists anywhere in the cluster for a claim in $NS — nothing was provisioned" \
  pvs_for_ns
note "on an Immediate class a volume would already exist by now, carved out of"
note "whichever node or zone the provisioner happened to pick, with nobody yet"
note "knowing where the Pod that needs it will run"

step "Create the consumer: the claim binds within seconds"
apply consumer.yaml
assert_eventually 90 "Bound" "the claim reached Bound as soon as a Pod needed it" \
  k -n "$NS" get pvc data -o 'jsonpath={.status.phase}'
run k -n "$NS" wait --for=condition=Ready pod/writer --timeout=180s
run k -n "$NS" get pvc

POD_NODE="$(k -n "$NS" get pod writer -o jsonpath='{.spec.nodeName}')"
[ -n "$POD_NODE" ] || fail "could not read the node writer was scheduled onto"
assert_eq "$(k -n "$NS" get pvc data -o jsonpath='{.metadata.annotations.volume\.kubernetes\.io/selected-node}')" "$POD_NODE" \
  "the scheduler stamped volume.kubernetes.io/selected-node=$POD_NODE onto the claim"
note "that annotation is the whole handoff: the scheduler decides the node"
note "first, then the provisioner carves the volume out of that node's disk"

PV="$(k -n "$NS" get pvc data -o jsonpath='{.spec.volumeName}')"
[ -n "$PV" ] || fail "the claim reports Bound but names no volume"
ok "the claim is bound to $PV, a volume that did not exist one step ago"
assert_eq "$(pvs_for_ns)" "${NS}/data -> ${PV}" \
  "exactly one PersistentVolume now exists for a claim in $NS"
assert_eq "$(k get pv "$PV" -o jsonpath='{.spec.storageClassName}')" "standard" \
  "$PV came from the standard class"
assert_eq "$(k get pv "$PV" -o jsonpath='{.spec.persistentVolumeReclaimPolicy}')" "Delete" \
  "...and inherited that class's Delete reclaim policy, so it dies with the claim"
run k -n "$NS" exec writer -- sh -c 'echo "written by the first writer Pod" > /data/id.txt'

step "The provisioned volume is pinned to $POD_NODE"
run k get pv "$PV" -o 'custom-columns=NAME:.metadata.name,CLASS:.spec.storageClassName,RECLAIM:.spec.persistentVolumeReclaimPolicy,AFFINITY-KEY:.spec.nodeAffinity.required.nodeSelectorTerms[0].matchExpressions[0].key,PINNED-TO:.spec.nodeAffinity.required.nodeSelectorTerms[0].matchExpressions[0].values[0]'
note "kubectl get pv $PV -o yaml shows the same thing in its native shape"
AFF="$(k get pv "$PV" -o jsonpath='{.spec.nodeAffinity}')"
[ -n "$AFF" ] || fail "$PV has no .spec.nodeAffinity at all"
ok "$PV carries a non-empty .spec.nodeAffinity"
assert_contains "$AFF" "kubernetes.io/hostname" \
  "the constraint is written against the kubernetes.io/hostname label"
AFF_NODE="$(k get pv "$PV" -o jsonpath='{.spec.nodeAffinity.required.nodeSelectorTerms[0].matchExpressions[0].values[0]}')"
assert_eq "$AFF_NODE" "$POD_NODE" \
  "it names exactly one node, $POD_NODE — the node the Pod was scheduled onto"
assert_eq "$(k get node "$AFF_NODE" -o jsonpath='{.metadata.name}')" "$AFF_NODE" \
  "$AFF_NODE is a real node in this cluster, not a label that matches nothing"
note "the field is .required, not .preferred — a hard constraint the scheduler"
note "cannot trade away, because the bytes genuinely are on that one disk"

step "What the pinning costs: a Pod that cannot follow its volume"
WORKERS="$(k get nodes -l '!node-role.kubernetes.io/control-plane' \
  -o 'jsonpath={range .items[*]}{.metadata.name}{"\n"}{end}')"
OTHER=""
while IFS= read -r n; do
  [ -n "$n" ] || continue
  if [ "$n" != "$POD_NODE" ]; then OTHER="$n"; break; fi
done <<< "$WORKERS"
[ -n "$OTHER" ] || fail "found no second worker node to move the Pod to"
note "the volume lives on $POD_NODE; the other worker is $OTHER"

run k -n "$NS" delete pod writer
render_apply stranded.yaml "$OTHER"
assert_eventually 90 "Pending" "the replacement Pod, which asked for $OTHER, is Pending" \
  k -n "$NS" get pod stranded -o 'jsonpath={.status.phase}'
assert_eventually 180 "yes" \
  "the scheduler rejected $OTHER on the PersistentVolume's node affinity" \
  volume_affinity_rejected
run k -n "$NS" get events --field-selector involvedObject.name=stranded
assert_eq "$(k -n "$NS" get pod stranded -o jsonpath='{.spec.nodeName}')" "" \
  "stranded was never assigned a node at all — it is stuck in the scheduling queue"
assert_eq "$(k -n "$NS" get pvc data -o jsonpath='{.status.phase}')" "Bound" \
  "the claim is still Bound to $PV: the data is fine, it is simply not reachable from $OTHER"
note "this is precisely what a drain of $POD_NODE would produce. The eviction"
note "succeeds, the Pod is recreated, and there is nowhere for it to go — see"
note "the troubleshooting/node-maintenance lab for the drain itself."
run k -n "$NS" delete pod stranded

step "Let the scheduler choose and it follows the volume instead"
apply consumer.yaml
run k -n "$NS" wait --for=condition=Ready pod/writer --timeout=180s
assert_eq "$(k -n "$NS" get pod writer -o jsonpath='{.spec.nodeName}')" "$POD_NODE" \
  "writer came back on $POD_NODE — with no nodeSelector, the volume chose the node"
assert_eq "$(k -n "$NS" get pvc data -o jsonpath='{.spec.volumeName}')" "$PV" \
  "it reattached to the same volume, $PV — binding happens once, not once per Pod"
SEEN="$(k -n "$NS" exec writer -- cat /data/id.txt || true)"
assert_eq "$SEEN" "written by the first writer Pod" \
  "and read back the file its predecessor wrote"
run k -n "$NS" get pods -o wide

step "What this proves"
note "A StorageClass is a named recipe for making storage on demand: a"
note "provisioner, its parameters, a reclaim policy, and — the part that changes"
note "how scheduling works — a volumeBindingMode. This cluster's default class,"
note "standard, uses WaitForFirstConsumer, and the two halves of this lab show"
note "both sides of that setting."
note ""
note "A claim on its own does nothing. It sat at Pending with a"
note "WaitForFirstConsumer event and no PersistentVolume anywhere in the"
note "cluster. Nothing was broken; the system was declining to guess."
note ""
note "Creating a Pod supplied the missing information. The scheduler picked a"
note "node for the Pod, wrote that choice onto the claim as"
note "volume.kubernetes.io/selected-node, and the provisioner then created the"
note "volume on that node. Binding took seconds, and the order matters: node"
note "first, volume second."
note ""
note "That order is the entire point. Immediate binding provisions the volume"
note "before anyone knows where the Pod will run, so on zone- or node-local"
note "storage the volume can land somewhere the Pod cannot be scheduled, and"
note "the Pod is then unschedulable forever through no fault of its own."
note "WaitForFirstConsumer removes that failure mode by refusing to decide"
note "until the decision can be made correctly."
note ""
note "What it cannot remove is the pinning itself. The provisioned volume"
note "carries a required nodeAffinity naming $POD_NODE, and this lab watched a"
note "Pod that wanted $OTHER sit Pending because of it. Deferred binding buys a"
note "good first placement; it does not make node-local storage movable. Every"
note "later scheduling decision for anything that mounts that claim is already"
note "made — which is why draining $POD_NODE would strand this workload, and"
note "why node-local storage and routine node maintenance are in tension."
