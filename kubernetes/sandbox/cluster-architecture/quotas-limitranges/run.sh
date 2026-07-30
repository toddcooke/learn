#!/usr/bin/env bash
LAB="quotas-limitranges"
source "$(dirname "$0")/../../cluster/lib.sh"
require_cluster
ns_setup

# Everything this lab creates -- a ResourceQuota, a LimitRange, a Deployment
# and two Pods -- is namespaced, so the trap ns_setup installed removes all of
# it. No cluster-scoped object, no node change, no file written onto a node;
# there is nothing extra to clean up and no custom trap is needed.

# ---------------------------------------------------------------------------
# Small readers, used more than once below.
# ---------------------------------------------------------------------------

# .status.availableReplicas is ABSENT, not 0, while a Deployment has no
# available Pods, and jsonpath renders an absent field as the empty string.
# Normalising here keeps the assertion honest instead of asserting on "".
avail() {
  local v
  v="$(k -n "$NS" get deploy bulky -o jsonpath='{.status.availableReplicas}' 2>/dev/null || true)"
  printf '%s' "${v:-0}"
}

# The quota controller republishes .status.used as Pods come and go. The
# backslash escapes the dot inside the resource name so jsonpath reads
# "requests.cpu" as one key rather than two.
used_cpu() { k -n "$NS" get quota compute-budget -o jsonpath='{.status.used.requests\.cpu}'; }
used_mem() { k -n "$NS" get quota compute-budget -o jsonpath='{.status.used.requests\.memory}'; }

step "A ResourceQuota over the namespace's compute requests"
apply quota.yaml
# Creating the object and having the quota controller acknowledge it are two
# different moments, and admission consults the controller's published status.
# Waiting for status.hard removes the race before anything depends on it.
assert_eventually 60 "500m" "the quota is live: status.hard.requests.cpu is published" \
  k -n "$NS" get quota compute-budget -o jsonpath='{.status.hard.requests\.cpu}'
run k -n "$NS" describe quota compute-budget
assert_eq "$(used_cpu)" "0" "nothing is running yet, so used requests.cpu is 0"
note "the budget is 500m of cpu requests and 512Mi of memory requests for the"
note "whole namespace -- not per Pod, per Deployment or per node."

step "A Deployment that cannot fit is created anyway"
apply deployment-bulky.yaml
assert_eq "$(k -n "$NS" get deploy bulky -o jsonpath='{.metadata.name}')" "bulky" \
  "the Deployment object was accepted by the API server"
note "each replica asks for 900m against a 500m budget, so not even one of"
note "them fits -- and yet the write succeeded without a warning."
assert_eventually_contains 60 "bulky-" "the ReplicaSet was created too, also without complaint" \
  k -n "$NS" get rs -l app=bulky -o name
RS="$(k -n "$NS" get rs -l app=bulky -o jsonpath='{.items[0].metadata.name}')"
note "ReplicaSet: $RS"
assert_eq "$(k -n "$NS" get pods -l app=bulky --no-headers 2>/dev/null | wc -l | tr -d ' ')" "0" \
  "zero Pods exist"
note "ResourceQuota is a Pod-level admission check. A Deployment and a"
note "ReplicaSet are just records of intent, so nothing rejects them; the"
note "rejection happens later, when a controller tries to turn that intent"
note "into Pods."

step "The error is on the ReplicaSet, not on the Deployment"
assert_eventually_contains 120 "exceeded quota" "the ReplicaSet's events name the quota that blocked its Pods" \
  k -n "$NS" describe rs "$RS"
run k -n "$NS" get rs "$RS" -o jsonpath='{.status.conditions[?(@.type=="ReplicaFailure")].message}{"\n"}'
assert_eq "$(avail)" "0" "availableReplicas is still 0"
DEPLOY_DESC="$(k -n "$NS" describe deploy bulky)"
assert_not_contains "$DEPLOY_DESC" "exceeded quota" \
  "kubectl describe deployment never says the word quota"
note "this is the trap. The thing you deployed looks merely 'not ready'; the"
note "sentence explaining why is one object further down, on the ReplicaSet."
assert_eventually 60 "FailedCreate" "the Deployment does carry a ReplicaFailure condition" \
  k -n "$NS" get deploy bulky -o jsonpath='{.status.conditions[?(@.type=="ReplicaFailure")].reason}'
COND_MSG="$(k -n "$NS" get deploy bulky -o jsonpath='{.status.conditions[?(@.type=="ReplicaFailure")].message}')"
assert_contains "$COND_MSG" "exceeded quota" "and its message does carry the quota error"
note "the message is in the API object, but kubectl describe prints a"
note "Deployment's conditions as Type/Status/Reason only -- the message column"
note "is dropped. 'ReplicaFailure True FailedCreate' is all you are shown, so"
note "the habit worth building is: describe the ReplicaSet, or read the"
note "condition with -o jsonpath."

step "Fix the Pod template and the same Deployment succeeds"
run k -n "$NS" set resources deploy/bulky --requests=cpu=150m,memory=64Mi
run k -n "$NS" rollout status deploy/bulky --timeout=180s
assert_eq "$(avail)" "2" "both replicas are now available"
assert_eventually 60 "300m" "used requests.cpu is 2 x 150m" used_cpu
run k -n "$NS" describe quota compute-budget
note "the Deployment was never the problem and was never edited as such --"
note "only the numbers in its Pod template changed. Quota arithmetic is done"
note "on Pods, so the Pod template is the only place a quota fix can go."

step "With a quota on cpu, a Pod that requests nothing is refused"
if OUT="$(k -n "$NS" apply -f "$LAB_DIR/pod-no-resources.yaml" 2>&1)"; then
  fail "expected the requestless Pod to be rejected, but it was created"
fi
note "$OUT"
assert_contains "$OUT" "must specify" "the API server refused a Pod with no resource requests"
assert_contains "$OUT" "requests.cpu" "and named requests.cpu as the missing declaration"
assert_eq "$(k -n "$NS" get pod no-resources --ignore-not-found -o name)" "" "no Pod was created"
note "this is a side effect of the quota that nobody asks for: budget a"
note "resource and you have simultaneously made declaring it mandatory."
note "Declaring only limits.cpu would also satisfy it, because the API server"
note "copies a missing request down from the limit."

step "A LimitRange supplies the missing requests"
apply limitrange.yaml
run k -n "$NS" describe limitrange default-requests
apply pod-no-resources.yaml
run k -n "$NS" wait --for=condition=Ready pod/no-resources --timeout=120s
note "the same file, byte for byte, that was rejected one step ago"
run k -n "$NS" get pod no-resources -o jsonpath='{.spec.containers[0].resources}{"\n"}'
assert_eq "$(k -n "$NS" get pod no-resources -o jsonpath='{.spec.containers[0].resources.requests.cpu}')" \
  "100m" "requests.cpu=100m was injected from defaultRequest"
assert_eq "$(k -n "$NS" get pod no-resources -o jsonpath='{.spec.containers[0].resources.requests.memory}')" \
  "64Mi" "requests.memory=64Mi was injected from defaultRequest"
assert_eq "$(k -n "$NS" get pod no-resources -o jsonpath='{.spec.containers[0].resources.limits.cpu}')" \
  "200m" "limits.cpu=200m was injected from default"
note "LimitRanger is a MUTATING admission plugin and it runs before the"
note "ResourceQuota plugin, so the Pod the quota evaluates is not the Pod that"
note "was submitted -- it already has requests by then."
note "Defaults are stamped in at admission only. Existing Pods are untouched"
note "by a new LimitRange, which is why the bulky Pods still carry the numbers"
note "they were created with."

step "The injected request is real: it spends the same budget"
assert_eventually 60 "400m" "used requests.cpu climbed to 400m (2 x 150m + the injected 100m)" used_cpu
note "used requests.memory: $(used_mem)"
if OUT="$(k -n "$NS" apply -f "$LAB_DIR/pod-too-big.yaml" 2>&1)"; then
  fail "expected the 300m Pod to be rejected, but it was created"
fi
note "$OUT"
assert_contains "$OUT" "exceeded quota" "a 300m Pod on top of 400m used is refused outright"
assert_eq "$(k -n "$NS" get pod too-big --ignore-not-found -o name)" "" "and no Pod was created"
note "identical arithmetic to the Deployment's failure, and an entirely"
note "different experience: a bare Pod fails in your terminal, where you"
note "cannot miss it. Everything created by a controller fails somewhere you"
note "have to go and look."

step "What this proves"
note "A ResourceQuota is enforced by an admission controller, and the object"
note "it admits is the Pod. Deployments, ReplicaSets, StatefulSets, Jobs and"
note "CronJobs are never checked against a quota, so 'kubectl apply' on a"
note "workload whose template cannot possibly fit still returns success."
note ""
note "When that happens the diagnosis is one level down. The ReplicaSet gets"
note "a FailedCreate event reading 'exceeded quota', and both the ReplicaSet"
note "and the Deployment get a ReplicaFailure condition -- but describe prints"
note "a Deployment's conditions without their messages, so the Deployment"
note "looks merely stalled. describe the ReplicaSet."
note ""
note "Budgeting cpu or memory silently makes that resource mandatory: every"
note "new Pod in the namespace must declare a request (or a limit, which the"
note "request is copied from), or admission refuses it. This is how a quota"
note "added for accounting reasons breaks manifests that used to work."
note ""
note "A LimitRange is the fix for that. Its defaultRequest and default values"
note "are stamped onto containers that omit them, by a mutating plugin that"
note "runs before the quota is evaluated -- so requestless manifests keep"
note "working, and the defaults they receive are charged to the budget like"
note "any other request. Quota and LimitRange are a pair: the quota caps the"
note "namespace, the LimitRange makes individual Pods well-formed enough to"
note "be counted."
