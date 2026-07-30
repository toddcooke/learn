#!/usr/bin/env bash
LAB="rbac"
source "$(dirname "$0")/../../cluster/lib.sh"
require_cluster
ns_setup

# ---------------------------------------------------------------------------
# Cleanup. Everything this lab creates is namespaced and lives in $NS: two
# ServiceAccounts, one Pod, five Roles and four RoleBindings. It reads the
# built-in `view` and `admin` ClusterRoles but never writes to them, and
# --as= impersonation creates no object at all — it only changes the name a
# request arrives under. Deleting $NS therefore removes the entire lab, so the
# trap ns_setup installed is a complete teardown and no replacement is needed.
# ---------------------------------------------------------------------------

APP="system:serviceaccount:$NS:app"
HELPER="system:serviceaccount:$NS:helper"

# --- helpers ---------------------------------------------------------------

# `kubectl auth can-i` prints "yes", or "no" optionally followed by
# " - <reason>", and it exits 1 whenever the answer is no — which errexit
# would treat as the script itself failing. Swallow the status and keep only
# the first word, so every caller can compare against a plain yes or no.
#   can_i <username> <arguments to kubectl auth can-i...>
can_i() {
  local user="$1"; shift
  local out
  out="$(k auth can-i "$@" --as="$user" 2>/dev/null || true)"
  echo "${out%% *}"
}

# ---------------------------------------------------------------------------

step "A ServiceAccount is an identity, and identities start empty"
assert_eq "$NS" "sandbox-rbac" \
  "the namespace is sandbox-rbac, the literal string the manifests' subjects[].namespace fields carry"
apply sa.yaml
run k -n "$NS" wait --for=condition=Ready pod/target --timeout=180s
run k -n "$NS" get serviceaccounts
assert_eq "$(k -n "$NS" get sa app -o jsonpath='{.metadata.name}')" "app" \
  "the app ServiceAccount exists"
assert_eq "$(k -n "$NS" get pod target -o jsonpath='{.spec.serviceAccountName}')" "app" \
  "the target Pod runs as it, rather than as the namespace's default ServiceAccount"
VOLS="$(k -n "$NS" get pod target -o jsonpath='{.spec.volumes}')"
assert_contains "$VOLS" "serviceAccountToken" \
  "the kubelet projected a serviceAccountToken volume into that Pod"
note "a process inside target would present that token and be authenticated as"
note "the user name $APP. Everything below asks about"
note "the same name using --as=, and that is not an approximation: kubectl sends"
note "an Impersonate-User header, the apiserver recognises the"
note "system:serviceaccount:<ns>:<name> form, and rebuilds the identical identity"
note "— same user name, same group memberships — that the token would produce."

step "Before any grant, the answer is no — and the API agrees with the answer"
assert_eq "$(can_i "$APP" list pods -n "$NS")" "no" \
  "auth can-i list pods --as=<app> -n $NS  ->  no"
assert_eq "$(can_i "$APP" get pods -n "$NS")" "no" \
  "...get pods is no as well: nothing has been granted, so nothing is permitted"
assert_eq "$(can_i "$APP" list secrets -n "$NS")" "no" \
  "...and list secrets, which is the one that would matter most, is no"
assert_eq "$(can_i "$HELPER" list pods -n "$NS")" "no" \
  "the helper ServiceAccount is exactly as powerless — this is the default state"

if OUT="$(k -n "$NS" --as="$APP" get pods 2>&1)"; then
  fail "the apiserver served a Pod list to a ServiceAccount with no bindings"
fi
note "$OUT"
assert_contains "$OUT" "forbidden" \
  "a real LIST — not a review — came back Forbidden"
assert_contains "$OUT" 'cannot list resource "pods"' \
  "the message names the verb and the resource that were refused"
assert_contains "$OUT" "in the namespace \"$NS\"" \
  "...and the namespace the decision was made in"
note "auth can-i issues a SelfSubjectAccessReview: the same authorizer, asked"
note "instead of obeyed. That is why it is safe to probe with — asking never"
note "performs the action — but its answer is only worth anything if it matches"
note "what the API really does, so both are checked at every turn below."

step "One Role plus one RoleBinding turns that no into a yes"
apply pod-reader.yaml
run k -n "$NS" describe rolebinding app-pod-reader
assert_eventually 60 "yes" \
  "auth can-i list pods --as=<app> -n $NS  ->  yes" \
  can_i "$APP" list pods -n "$NS"
assert_eq "$(can_i "$APP" get pods -n "$NS")" "yes" \
  "get pods is allowed too, because get is in the rule's verb list"
assert_eq "$(can_i "$APP" delete pods -n "$NS")" "no" \
  "delete pods is still no: verbs are enumerated one by one, never implied by get"
assert_eq "$(can_i "$APP" list secrets -n "$NS")" "no" \
  "list secrets is still no: resources are enumerated the same way"
assert_eq "$(can_i "$HELPER" list pods -n "$NS")" "no" \
  "and helper is still no, because it is not named in the binding's subjects"
assert_eventually_contains 60 "target" \
  "a real LIST as the app ServiceAccount now returns the target Pod" \
  k -n "$NS" --as="$APP" get pods
if OUT="$(k -n "$NS" --as="$APP" get secrets 2>&1)"; then
  fail "the pod-reader Role somehow produced access to Secrets"
fi
assert_contains "$OUT" 'cannot list resource "secrets"' \
  "...while a real LIST of Secrets in the same namespace is still Forbidden"
note "note how the two objects divide the work. The Role carries rules and names"
note "nobody; the RoleBinding names subjects and carries no rules. Neither is a"
note "grant on its own — the permission exists only where they meet."

step "The grant stops at the edge of the namespace"
assert_eq "$(can_i "$APP" list pods --all-namespaces)" "no" \
  "auth can-i list pods --all-namespaces  ->  no"
assert_eq "$(can_i "$APP" list pods -n default)" "no" \
  "...and the same question aimed at the default namespace is no as well"
if OUT="$(k --as="$APP" get pods --all-namespaces 2>&1)"; then
  fail "a namespaced RoleBinding produced a cluster-wide Pod list"
fi
note "$OUT"
assert_contains "$OUT" "at the cluster scope" \
  "a real cluster-wide LIST is refused, and the refusal says 'at the cluster scope'"
if OUT="$(k -n default --as="$APP" get pods 2>&1)"; then
  fail "a RoleBinding in $NS produced access in the default namespace"
fi
assert_contains "$OUT" 'in the namespace "default"' \
  "and a LIST aimed at default is refused there too"
note "this is the whole point of the namespaced pair. --all-namespaces is not a"
note "loop over namespaces the caller can reach; it is a single request whose"
note "namespace field is empty, which RBAC evaluates at cluster scope where no"
note "RoleBinding applies. Cluster-wide read needs a ClusterRoleBinding."

step "A RoleBinding may point at a ClusterRole, and is still confined"
VIEW_RULES="$(k get clusterrole view -o jsonpath='{.rules}')"
assert_contains "$VIEW_RULES" "configmaps" \
  "the built-in view ClusterRole carries a read rule for configmaps"
assert_contains "$VIEW_RULES" "namespaces" \
  "...and one for namespaces, a cluster-scoped resource — remember that"
apply view-binding.yaml
run k -n "$NS" get rolebinding app-view -o jsonpath='{.roleRef.kind}{"/"}{.roleRef.name}{"\n"}'
assert_eventually 60 "yes" \
  "auth can-i list configmaps -n $NS  ->  yes, via a ClusterRole's rules" \
  can_i "$APP" list configmaps -n "$NS"
assert_eq "$(can_i "$APP" list configmaps --all-namespaces)" "no" \
  "but --all-namespaces is still no: the binding's kind decided the scope"
assert_eq "$(can_i "$APP" list configmaps -n default)" "no" \
  "...and so is the default namespace"
assert_eq "$(can_i "$APP" list secrets -n "$NS")" "no" \
  "view withholds Secrets by design, so even here Secrets stay out of reach"
if OUT="$(k --as="$APP" get namespaces 2>&1)"; then
  fail "a RoleBinding granted a cluster-scoped resource"
fi
note "$OUT"
assert_contains "$OUT" "at the cluster scope" \
  "and the namespaces rule inside view is unreachable through a RoleBinding"
note "the ClusterRole supplied the rules and the RoleBinding supplied the scope."
note "That split is what makes the four default ClusterRoles — view, edit, admin,"
note "cluster-admin — reusable: bind view with a RoleBinding for read access to"
note "one namespace, or with a ClusterRoleBinding for read access to the cluster."
note "view deliberately omits Secrets, because a Secret can hold a ServiceAccount"
note "token, and reading one would let the reader act as that ServiceAccount."

step "roleRef is immutable; the subjects list is not"
if OUT="$(k -n "$NS" patch rolebinding app-pod-reader --type=merge \
    -p '{"roleRef":{"apiGroup":"rbac.authorization.k8s.io","kind":"ClusterRole","name":"admin"}}' 2>&1)"; then
  fail "the apiserver accepted a roleRef change — a binding must not be repointable"
fi
note "$OUT"
assert_contains "$OUT" "is invalid" \
  "the patch was rejected by validation, not by authorization — we are cluster-admin here"
assert_contains "$OUT" "roleRef" "the error names the roleRef field"
assert_contains "$OUT" "cannot change roleRef" \
  "...and says in so many words that the field cannot change"
assert_eq "$(k -n "$NS" get rolebinding app-pod-reader -o jsonpath='{.roleRef.kind}/{.roleRef.name}')" \
  "Role/pod-reader" "the binding still refers to exactly what it always did"

run k -n "$NS" patch rolebinding app-pod-reader --type=json \
  -p "[{\"op\":\"add\",\"path\":\"/subjects/-\",\"value\":{\"kind\":\"ServiceAccount\",\"name\":\"helper\",\"namespace\":\"$NS\"}}]"
assert_eq "$(k -n "$NS" get rolebinding app-pod-reader -o jsonpath='{.subjects[1].name}')" "helper" \
  "adding helper to subjects was accepted — that half of the object is editable"
assert_eventually 60 "yes" \
  "and helper can now list pods in $NS, through the very same binding" \
  can_i "$HELPER" list pods -n "$NS"
note "so a binding is a permanent statement about which rules, and a revisable"
note "statement about which subjects. Retargeting one means deleting it and"
note "creating a replacement. The reason is the attack it forecloses: if roleRef"
note "were editable, anyone holding patch on a binding could swap view for"
note "cluster-admin under a subject list somebody else had already approved."

step "A subject cannot grant permissions it does not itself hold"
apply role-author.yaml
assert_eventually 60 "yes" \
  "app may now create Roles in $NS — an ordinary namespaced resource, granted the ordinary way" \
  can_i "$APP" create roles.rbac.authorization.k8s.io -n "$NS"
assert_eq "$(can_i "$APP" create rolebindings.rbac.authorization.k8s.io -n "$NS")" "yes" \
  "...and RoleBindings as well"

if ! OUT="$(k -n "$NS" --as="$APP" create role pods-echo --verb=get --verb=list --resource=pods 2>&1)"; then
  fail "app could not write a Role for permissions it already holds: $OUT"
fi
note "$OUT"
assert_eq "$(k -n "$NS" get role pods-echo -o jsonpath='{.rules[0].resources[0]}')" "pods" \
  "a Role over pods was accepted, because app already holds get and list on pods"

if OUT="$(k -n "$NS" --as="$APP" create role secret-reader --verb=get --resource=secrets 2>&1)"; then
  fail "an unprivileged ServiceAccount wrote itself a Role over Secrets"
fi
note "$OUT"
assert_contains "$OUT" "forbidden" "a Role over Secrets was refused"
assert_contains "$OUT" "attempting to grant RBAC permissions not currently held" \
  "the apiserver named the reason: app does not hold what the Role would grant"
assert_contains "$OUT" 'Resources:["secrets"]' \
  "...and printed back the exact rule it would not let app write"

if OUT="$(k -n "$NS" --as="$APP" create rolebinding esc --clusterrole=admin --serviceaccount="$NS:app" 2>&1)"; then
  fail "an unprivileged ServiceAccount bound itself to the admin ClusterRole"
fi
note "$OUT"
assert_contains "$OUT" "attempting to grant RBAC permissions not currently held" \
  "and binding to the admin ClusterRole was refused for the same reason"
note "two separate gates, in two separate registries. Writing a Role is checked"
note "against the author's own permissions in that namespace; creating a binding"
note "is checked against the permissions of the role being referenced. Without"
note "them, 'may create roles' would silently mean 'may have anything'."

step "escalate and bind are the deliberate exemptions, and they are separate"
apply escalate.yaml
assert_eventually 60 "yes" \
  "app now holds the escalate verb on roles in $NS" \
  can_i "$APP" escalate roles.rbac.authorization.k8s.io -n "$NS"
if ! OUT="$(k -n "$NS" --as="$APP" create role secret-reader --verb=get --resource=secrets 2>&1)"; then
  fail "escalate was granted but the same create was still refused: $OUT"
fi
note "$OUT"
assert_eq "$(k -n "$NS" get role secret-reader -o jsonpath='{.rules[0].resources[0]}')" "secrets" \
  "the identical create now succeeds — escalate waives the author-side check"
assert_eq "$(can_i "$APP" get secrets -n "$NS")" "no" \
  "writing that Role granted app nothing: a Role with no binding authorizes nobody"
if OUT="$(k -n "$NS" --as="$APP" create rolebinding sr --role=secret-reader --serviceaccount="$NS:app" 2>&1)"; then
  fail "escalate on roles also permitted binding the Role it wrote"
fi
note "$OUT"
assert_contains "$OUT" "attempting to grant RBAC permissions not currently held" \
  "and attaching it is refused: escalate covers roles, the binding gate wants bind"
note "escalate lets you write the rule; bind lets you attach it to somebody."
note "Neither is granted by default and neither implies the other, which is what"
note "keeps a delegated namespace administrator from quietly promoting itself."

step "What this proves"
note "RBAC is additive and starts from nothing. A ServiceAccount is a name, not"
note "a permission: app began the run unable to list a single Pod, and so does"
note "every namespace's default ServiceAccount. Nothing is denied by a rule —"
note "things are denied because no rule allows them."
note ""
note "A grant is two objects. The Role holds rules and names no subject; the"
note "RoleBinding names subjects and holds no rules. Both are namespaced, so the"
note "permission is namespaced with them: app could list Pods in $NS,"
note "and the identical question with --all-namespaces or -n default stayed no,"
note "for reviews and for real requests alike. --all-namespaces is one request"
note "with an empty namespace, evaluated at cluster scope, where no RoleBinding"
note "can reach it."
note ""
note "A RoleBinding may reference a ClusterRole, and that changes which rules"
note "apply, never how far they reach. Bound this way, view gave app read access"
note "to ConfigMaps in one namespace only — and its rule for namespaces, a"
note "cluster-scoped resource, remained unreachable. The binding's kind decides"
note "scope; the roleRef only decides content."
note ""
note "roleRef is immutable. The apiserver rejected the patch with 'cannot change"
note "roleRef' while the subjects list took an edit in the same breath. Point a"
note "binding somewhere else by deleting it and creating a replacement — and be"
note "glad of the rule, because an editable roleRef would let anyone with patch"
note "on a binding swap the role out from under an approved set of subjects."
note ""
note "Finally, the escalation guards. Holding create on roles did not let app"
note "write a Role over Secrets, and holding create on rolebindings did not let"
note "it bind itself to admin: both attempts came back 'attempting to grant RBAC"
note "permissions not currently held'. The escape hatches are explicit and"
note "narrow — the escalate verb on roles/clusterroles for authoring, the bind"
note "verb on the referenced role for attaching. Granting escalate let app write"
note "the Secrets Role and still left it unable to bind it, which is exactly the"
note "separation that makes delegating RBAC administration survivable."
