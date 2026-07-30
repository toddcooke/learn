#!/usr/bin/env bash
LAB="replicaset"
source "$(dirname "$0")/../../cluster/lib.sh"
require_cluster
ns_setup

# Everything this lab creates lives inside $NS, so ns_setup's own trap is a
# complete cleanup — there is nothing cluster-scoped to remove.

OLD_IMAGE="nginx:alpine"
NEW_IMAGE="registry.k8s.io/pause:3.10"

# Newline-separated names of the Pods the ReplicaSet currently owns. The API
# lists objects in name order, so this is stable without sorting — and no
# pipeline means no chance of a SIGPIPE tripping `set -o pipefail`.
pod_names() {
  k -n "$NS" get pods -l app=web -o jsonpath='{range .items[*]}{.metadata.name}{"\n"}{end}'
}

first_pod() {
  k -n "$NS" get pods -l app=web -o jsonpath='{.items[0].metadata.name}'
}

pod_count() {
  local names
  names="$(k -n "$NS" get pods -l app=web -o jsonpath='{.items[*].metadata.name}')"
  printf '%s' "$names" | wc -w | tr -d ' '
}

# Print the first name present in the new list ($2) but not the old one ($1).
new_name() {
  local p
  for p in $2; do
    case "$1" in
      *"$p"*) ;;
      *) printf '%s\n' "$p"; return 0 ;;
    esac
  done
  return 1
}

step "Create a ReplicaSet that asks for 3 replicas"
apply three-replicas.yaml
assert_eventually 180 "3" "the ReplicaSet reports 3 ready replicas" \
  k -n "$NS" get rs web -o jsonpath='{.status.readyReplicas}'
run k -n "$NS" get rs web
run k -n "$NS" get pods -l app=web -o wide
note "you never named these Pods; the controller generated names from the"
note "ReplicaSet's name, and the scheduler placed them independently"

step "Every Pod points back at its owner"
POD="$(first_pod)"
run k -n "$NS" get pod "$POD" -o custom-columns=POD:.metadata.name,OWNER_KIND:.metadata.ownerReferences[0].kind,OWNER:.metadata.ownerReferences[0].name,CONTROLLER:.metadata.ownerReferences[0].controller
assert_eq "$(k -n "$NS" get pod "$POD" -o jsonpath='{.metadata.ownerReferences[0].kind}')" \
  "ReplicaSet" "ownerReferences[0].kind is ReplicaSet"
assert_eq "$(k -n "$NS" get pod "$POD" -o jsonpath='{.metadata.ownerReferences[0].name}')" \
  "web" "ownerReferences[0].name is the ReplicaSet 'web'"
assert_eq "$(k -n "$NS" get pod "$POD" -o jsonpath='{.metadata.ownerReferences[0].controller}')" \
  "true" "controller=true — exactly one controller is responsible for this Pod"
note "this reference is what makes deleting the ReplicaSet delete its Pods:"
note "the garbage collector follows ownerReferences, not naming conventions"

step "Delete a Pod and the ReplicaSet puts it back"
BEFORE="$(pod_names)"
VICTIM="$(first_pod)"
note "deleting $VICTIM by hand"
run k -n "$NS" delete pod "$VICTIM"
assert_eventually 180 "3" "3 Pods match the selector again" pod_count
assert_eventually 180 "3" "readyReplicas is back to 3" \
  k -n "$NS" get rs web -o jsonpath='{.status.readyReplicas}'
AFTER="$(pod_names)"
assert_not_contains "$AFTER" "$VICTIM" "the Pod you deleted is really gone"
REPLACEMENT="$(new_name "$BEFORE" "$AFTER")" || fail "expected a brand-new Pod name, saw only: $AFTER"
ok "the ReplicaSet created $REPLACEMENT to take its place"
note "the replacement is not the old Pod restarted — it is a new object with a"
note "new name, new UID and new IP, quite possibly on a different node"

step "Membership is decided by the selector, not by a list of names"
ORPHAN="$(first_pod)"
assert_eq "$(k -n "$NS" get pod "$ORPHAN" -o jsonpath='{.metadata.ownerReferences[0].kind}')" \
  "ReplicaSet" "before relabelling, $ORPHAN is owned by the ReplicaSet"
run k -n "$NS" label pod "$ORPHAN" app=web-orphan --overwrite
assert_eventually 60 "" "the ReplicaSet released $ORPHAN: its ownerReferences are gone" \
  k -n "$NS" get pod "$ORPHAN" -o jsonpath='{.metadata.ownerReferences[*].kind}'
assert_eq "$(k -n "$NS" get pod "$ORPHAN" -o jsonpath='{.status.phase}')" \
  "Running" "the released Pod is still running — it was disowned, not killed"
assert_eventually 180 "3" "a replacement appeared, so 3 Pods still match app=web" pod_count
note "this is the trick for pulling a misbehaving Pod out of service without"
note "losing it: relabel it, and the controller both forgets it and backfills"

step "Change the Pod template's image"
NAMES_AT_PATCH="$(pod_names)"
PATCH="$(printf '{"spec":{"template":{"spec":{"containers":[{"name":"web","image":"%s"}]}}}}' "$NEW_IMAGE")"
run k -n "$NS" patch rs web -p "$PATCH"
assert_eq "$(k -n "$NS" get rs web -o jsonpath='{.spec.template.spec.containers[0].image}')" \
  "$NEW_IMAGE" "the ReplicaSet's template now names $NEW_IMAGE"
RUNNING_IMAGES="$(k -n "$NS" get pods -l app=web -o jsonpath='{range .items[*]}{.spec.containers[0].image}{"\n"}{end}' | sort -u)"
assert_eq "$RUNNING_IMAGES" "$OLD_IMAGE" "every running Pod still reports $OLD_IMAGE"
assert_eq "$(pod_names)" "$NAMES_AT_PATCH" "not one Pod was restarted or replaced"
note "the template describes how to build the NEXT Pod. The ReplicaSet's"
note "count is already satisfied, so it has no reason to do anything at all."

step "Only Pods created after the change carry it"
BEFORE2="$(pod_names)"
VICTIM2="$(first_pod)"
note "deleting $VICTIM2 to force the ReplicaSet to build one more Pod"
run k -n "$NS" delete pod "$VICTIM2"
assert_eventually 180 "3" "3 Pods match the selector again" pod_count
assert_eventually 180 "3" "readyReplicas is back to 3" \
  k -n "$NS" get rs web -o jsonpath='{.status.readyReplicas}'
AFTER2="$(pod_names)"
REPLACEMENT2="$(new_name "$BEFORE2" "$AFTER2")" || fail "expected a replacement Pod, saw only: $AFTER2"
assert_eq "$(k -n "$NS" get pod "$REPLACEMENT2" -o jsonpath='{.spec.containers[0].image}')" \
  "$NEW_IMAGE" "the replacement Pod $REPLACEMENT2 runs $NEW_IMAGE"
run k -n "$NS" get pods -l app=web -o custom-columns=POD:.metadata.name,IMAGE:.spec.containers[0].image
MIXED="$(k -n "$NS" get pods -l app=web -o jsonpath='{range .items[*]}{.spec.containers[0].image}{"\n"}{end}' | sort -u | tr '\n' ' ')"
assert_contains "$MIXED" "$OLD_IMAGE" "some Pods are still on the old image"
assert_contains "$MIXED" "$NEW_IMAGE" "one Pod is on the new image"
note "the ReplicaSet is now running two versions side by side, by accident,"
note "and nothing in it will ever converge them"

step "What this proves"
note "A ReplicaSet is a counter over a label selector. It owns the Pods that"
note "match — the ownerReference records that claim — and it recreates any"
note "that vanish, which is where self-healing actually comes from."
note ""
note "What it does not do is roll anything out. Editing the template changes"
note "only the blueprint for future Pods; the ones already running keep the"
note "spec they were born with, so a fleet drifts into a mix of versions."
note "That gap is precisely why Deployments exist: a Deployment reacts to a"
note "template change by creating a SECOND ReplicaSet and shifting replicas"
note "from the old one to the new one under a controlled surge/unavailable"
note "budget — which also gives you pause, resume and rollback for free."
