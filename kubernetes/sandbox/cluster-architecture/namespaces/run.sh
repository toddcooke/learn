#!/usr/bin/env bash
LAB="namespaces"
source "$(dirname "$0")/../../cluster/lib.sh"
require_cluster
ns_setup

# ---------------------------------------------------------------------------
# Cleanup. This lab needs a SECOND namespace, because "the same name in two
# namespaces" cannot be shown inside one. A Namespace is cluster-scoped, so
# ns_teardown — which deletes exactly $NS — would leave it behind, and a
# leftover namespace full of Pods distorts every scheduling lab that runs
# afterwards. So the trap ns_setup installed is replaced here with one that
# removes both, and it is armed on EXIT INT TERM rather than written as a
# tidy delete at the bottom of the script, because the failure path is the
# one that most needs cleaning.
# ---------------------------------------------------------------------------
NS_B="sandbox-namespaces-b"
AS_USER="namespace-lab-reader"

my_cleanup() {
  local code=$?
  # errexit is still armed inside a trap handler, and `(exit $code)` below is
  # deliberately a failing command whenever the lab failed. Without this the
  # handler would abort on it and never reach ns_teardown.
  set +e
  if [ "${KEEP:-0}" = "1" ]; then
    if k get ns "$NS_B" >/dev/null 2>&1; then
      note "KEEP=1 — the run stopped before deleting the second namespace. Remove it with:"
      note "  kubectl --context $CONTEXT delete ns $NS_B"
    fi
  else
    k delete ns "$NS_B" --ignore-not-found --wait=false >/dev/null 2>&1 || true
  fi
  (exit $code); ns_teardown
}
trap my_cleanup EXIT INT TERM

# --- small helpers ---------------------------------------------------------

ns_b_exists() {
  if k get ns "$NS_B" >/dev/null 2>&1; then echo yes; else echo no; fi
}

# `kubectl auth can-i` answers "yes", or "no" possibly followed by " - <reason>".
# Keeping only the first word makes the assertions insensitive to the reason.
can_i() {
  local out
  out="$(k auth can-i "$@" --as="$AS_USER" 2>/dev/null || true)"
  echo "${out%% *}"
}

# ---------------------------------------------------------------------------

step "Two namespaces"
note "ns_setup already created $NS; this lab needs a second one to compare it to"
k delete ns "$NS_B" --ignore-not-found --wait=true >/dev/null 2>&1 || true
run k create ns "$NS_B"
run k get ns "$NS" "$NS_B"
assert_eq "$(k get ns "$NS" -o jsonpath='{.metadata.name}')" "$NS" "namespace $NS exists"
assert_eq "$(k get ns "$NS_B" -o jsonpath='{.metadata.name}')" "$NS_B" "namespace $NS_B exists"
assert_eq "$(k get ns "$NS_B" -o jsonpath='{.status.phase}')" "Active" "$NS_B is Active"

step "The same Deployment name in both namespaces"
note "one file, applied twice — web.yaml names no namespace, so -n decides"
apply web.yaml
run k -n "$NS_B" apply -f "$LAB_DIR/web.yaml"
run k -n "$NS" rollout status deploy/web --timeout=180s
run k -n "$NS_B" rollout status deploy/web --timeout=180s
run k get deploy --all-namespaces -l app=web

assert_eq "$(k -n "$NS" get deploy web -o jsonpath='{.metadata.name}')" "web" \
  "$NS has a Deployment named web"
assert_eq "$(k -n "$NS_B" get deploy web -o jsonpath='{.metadata.name}')" "web" \
  "$NS_B also has a Deployment named web — the name did not collide"

UID_A="$(k -n "$NS" get deploy web -o jsonpath='{.metadata.uid}')"
UID_B="$(k -n "$NS_B" get deploy web -o jsonpath='{.metadata.uid}')"
[ -n "$UID_A" ] && [ -n "$UID_B" ] || fail "could not read both Deployment UIDs"
if [ "$UID_A" = "$UID_B" ]; then SAMENESS="same"; else SAMENESS="different"; fi
assert_eq "$SAMENESS" "different" \
  "they are two unrelated objects, not one object seen twice (different UIDs)"
note "$NS/web  uid $UID_A"
note "$NS_B/web uid $UID_B"

note "so they scale independently, too"
run k -n "$NS_B" scale deploy/web --replicas=2
assert_eventually 180 "2" "$NS_B/web scaled to 2 ready replicas" \
  k -n "$NS_B" get deploy web -o jsonpath='{.status.readyReplicas}'
assert_eq "$(k -n "$NS" get deploy web -o jsonpath='{.status.readyReplicas}')" "1" \
  "...while $NS/web is still at 1 — scaling one did not touch the other"
run k get pods --all-namespaces -l app=web -o wide

step "A manifest may name its own namespace instead"
note "pinned.yaml hard-codes metadata.namespace: $NS_B, so it needs no -n at all"
run k apply -f "$LAB_DIR/pinned.yaml"
assert_eq "$(k -n "$NS_B" get cm pinned -o jsonpath='{.metadata.namespace}')" "$NS_B" \
  "the ConfigMap landed in $NS_B without the command mentioning a namespace"

note "the cost of pinning it: that file can no longer be applied anywhere else"
if OUT="$(k -n "$NS" apply -f "$LAB_DIR/pinned.yaml" 2>&1)"; then
  fail "expected kubectl to refuse -n $NS for an object pinned to $NS_B"
fi
note "$OUT"
assert_contains "$OUT" "does not match the namespace" \
  "kubectl refused rather than silently moving the object"
OUT2="$(k -n "$NS" get cm pinned 2>&1 || true)"
assert_contains "$OUT2" "not found" "...and nothing named pinned was created in $NS"

step "What is not in a namespace at all"
NSFALSE="$(k api-resources --namespaced=false -o name 2>/dev/null || true)"
NSTRUE="$(k api-resources --namespaced=true -o name 2>/dev/null || true)"
[ -n "$NSFALSE" ] && [ -n "$NSTRUE" ] || fail "kubectl api-resources returned nothing"
# `|| true` because api-resources exits non-zero if any aggregated API is
# unreachable, and it still prints the built-in groups when that happens.
run k api-resources --namespaced=false || true

assert_contains "$NSFALSE" "nodes" "Nodes are cluster-scoped"
assert_contains "$NSFALSE" "persistentvolumes" "PersistentVolumes are cluster-scoped"
assert_contains "$NSFALSE" "storageclasses.storage.k8s.io" "StorageClasses are cluster-scoped"
assert_contains "$NSFALSE" "clusterroles.rbac.authorization.k8s.io" "ClusterRoles are cluster-scoped"
assert_contains "$NSFALSE" "namespaces" "a Namespace is itself a cluster-scoped object"
assert_not_contains "$NSFALSE" "deployments" "Deployments are not on that list"
assert_not_contains "$NSFALSE" "resourcequotas" "neither are ResourceQuotas"

assert_contains "$NSTRUE" "deployments.apps" "Deployments show up on the --namespaced=true side"
assert_contains "$NSTRUE" "resourcequotas" "so do ResourceQuotas"
assert_contains "$NSTRUE" "rolebindings.rbac.authorization.k8s.io" "and RoleBindings"
assert_contains "$NSTRUE" "persistentvolumeclaims" \
  "and PersistentVolumeClaims — the claim is namespaced even though the volume is not"
assert_not_contains "$NSTRUE" "persistentvolumes" "...while the PersistentVolume itself is not on that side"

note "for a cluster-scoped kind, -n is not an error — it is simply ignored"
run k get nodes -n "$NS"
NODES_PLAIN="$(k get nodes --no-headers | wc -l | tr -d '[:space:]')"
NODES_SCOPED="$(k get nodes -n "$NS" --no-headers | wc -l | tr -d '[:space:]')"
[ "$NODES_PLAIN" -ge 1 ] || fail "the cluster reported no nodes at all"
assert_eq "$NODES_SCOPED" "$NODES_PLAIN" \
  "-n $NS returned the same $NODES_PLAIN nodes as no flag at all"

step "The namespace is the boundary a ResourceQuota applies to"
apply quota.yaml
assert_eventually 60 "1" "the quota controller counted the one Pod already in $NS" \
  k -n "$NS" get resourcequota pod-budget -o jsonpath='{.status.used.pods}'
run k -n "$NS" get resourcequota pod-budget
run k describe ns "$NS"

note "the budget is spent, so a second Pod in $NS is refused at admission"
if OUT="$(k -n "$NS" apply -f "$LAB_DIR/probe.yaml" 2>&1)"; then
  fail "expected the ResourceQuota in $NS to reject a second Pod"
fi
note "$OUT"
assert_contains "$OUT" "exceeded quota" "the API server refused the Pod"

note "the identical Pod in $NS_B is admitted — the quota does not reach across"
run k -n "$NS_B" apply -f "$LAB_DIR/probe.yaml"
run k -n "$NS_B" wait --for=condition=Ready pod/probe --timeout=180s
assert_eq "$(k -n "$NS_B" get pod probe -o jsonpath='{.status.phase}')" "Running" \
  "probe is Running in $NS_B"
QUOTA_B="$(k -n "$NS_B" get resourcequota --no-headers 2>&1 || true)"
assert_contains "$QUOTA_B" "No resources found" "$NS_B has no ResourceQuota of its own"

step "...and the boundary an RBAC RoleBinding applies to"
apply rbac.yaml
run k -n "$NS" get role,rolebinding
assert_eventually 60 "yes" "$AS_USER may list Pods in $NS" can_i list pods -n "$NS"

CAN_B="$(can_i list pods -n "$NS_B")"
assert_eq "$CAN_B" "no" \
  "...and may not in $NS_B — same user, same verb, different namespace"
CAN_NODES="$(can_i list nodes)"
assert_eq "$CAN_NODES" "no" \
  "...and may not list Nodes anywhere: a RoleBinding cannot reach a cluster-scoped kind"
note "granting that would take a ClusterRole bound by a ClusterRoleBinding,"
note "neither of which lives in a namespace"

step "Deleting a namespace deletes everything in it"
run k -n "$NS_B" get deploy,pod,cm
assert_eq "$(k get ns "$NS_B" -o jsonpath='{.spec.finalizers[0]}')" "kubernetes" \
  "$NS_B carries the 'kubernetes' finalizer — deletion is a background sweep, not an instant drop"

run k delete ns "$NS_B" --wait=false
note "the namespace controller now walks every namespaced kind and removes what"
note "it finds; the Namespace object survives as Terminating until that is done"
assert_eventually 240 "no" "$NS_B is gone" ns_b_exists
assert_not_contains "$(k get ns -o name)" "namespace/$NS_B" "it is off the namespace list"

GONE_DEPLOY="$(k -n "$NS_B" get deploy web 2>&1 || true)"
assert_contains "$GONE_DEPLOY" "not found" "the Deployment named web in $NS_B is gone"
GONE_POD="$(k -n "$NS_B" get pod probe 2>&1 || true)"
assert_contains "$GONE_POD" "not found" "so is the probe Pod"
GONE_CM="$(k -n "$NS_B" get cm pinned 2>&1 || true)"
assert_contains "$GONE_CM" "not found" "so is the pinned ConfigMap"
note "nothing was deleted by name — one delete of the container took all of it"

assert_eq "$(k -n "$NS" get deploy web -o jsonpath='{.metadata.name}')" "web" \
  "the identically named Deployment in $NS is untouched"
assert_eq "$(k -n "$NS" get deploy web -o jsonpath='{.status.readyReplicas}')" "1" \
  "...and still has its replica Ready"
NODES_AFTER="$(k get nodes --no-headers | wc -l | tr -d '[:space:]')"
assert_eq "$NODES_AFTER" "$NODES_PLAIN" \
  "all $NODES_PLAIN nodes are still here — cluster-scoped objects are outside the blast radius"
run k get deploy --all-namespaces -l app=web

step "What this proves"
note "A Namespace is a scope for names and a boundary for policy, and it is not"
note "much else. Two Deployments called web existed at the same time with"
note "different UIDs, different replica counts and different Pods, because the"
note "identity of an object is (namespace, kind, name) rather than name alone."
note "That is what makes a namespace a usable unit of tenancy: teams can pick"
note "obvious names like web, db and cache without negotiating with each other."
note ""
note "The scope is also where policy attaches. The ResourceQuota capped Pods in"
note "$NS and did nothing at all to $NS_B, and the RoleBinding let a user list"
note "Pods in $NS and nowhere else. Both objects are namespaced themselves, so"
note "the thing being limited and the limit travel together."
note ""
note "What a namespace does not scope is anything on the --namespaced=false"
note "list: Nodes, PersistentVolumes, StorageClasses, ClusterRoles, IngressClasses"
note "and Namespaces themselves. Passing -n to a query for one of them is not an"
note "error and not a filter — it is ignored. The practical consequences: names"
note "of those kinds are cluster-unique, a RoleBinding can never grant access to"
note "them, and a namespace delete never removes them."
note ""
note "Finally, deleting a Namespace is the bluntest cleanup Kubernetes offers."
note "The Deployment, its ReplicaSet, its Pods and a ConfigMap all disappeared"
note "from a single command that named none of them. That is why every lab in"
note "this sandbox works inside its own namespace — and also why 'just delete"
note "the namespace' is a genuinely dangerous instruction in a shared cluster."
