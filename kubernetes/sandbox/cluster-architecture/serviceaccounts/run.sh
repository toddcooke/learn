#!/usr/bin/env bash
LAB="serviceaccounts"
source "$(dirname "$0")/../../cluster/lib.sh"
require_cluster
ns_setup

# ---------------------------------------------------------------------------
# Cleanup. Everything this lab creates -- one ServiceAccount, two Pods, a Role,
# a RoleBinding and a Secret -- is namespaced, so the trap ns_setup installed
# already covers all of it. Nothing cluster-scoped is created on purpose: the
# binding names a Role rather than a ClusterRole, no node is touched, and no
# file is written outside this directory. No extra trap is needed, so none is
# installed.
# ---------------------------------------------------------------------------

SA="api-reader"
POD="caller"
SA_DIR="/var/run/secrets/kubernetes.io/serviceaccount"
LEGACY_SECRET="api-reader-legacy-token"

# --- host-side helpers -----------------------------------------------------

# Decode the payload -- the second dot-separated segment -- of a JWT. JWTs are
# base64URL: '+' and '/' become '-' and '_', and the '=' padding is stripped.
# Both have to be put back before an ordinary base64 decoder will touch it.
jwt_payload() {
  local seg="${1#*.}"; seg="${seg%%.*}"
  seg="$(printf '%s' "$seg" | tr '_-' '/+')"
  case $(( ${#seg} % 4 )) in
    2) seg="${seg}==" ;;
    3) seg="${seg}=" ;;
  esac
  printf '%s' "$seg" | base64 -d 2>/dev/null || true
}

# jwt_number "<decoded payload>" exp -> the integer value, or empty.
# Written without a pipeline into grep because lib.sh sets pipefail and a
# claim that is legitimately absent must not abort the script.
jwt_number() {
  local v
  v="$(printf '%s' "$1" | grep -o "\"$2\":[0-9][0-9]*" || true)"
  v="${v%%$'\n'*}"
  printf '%s' "${v#*:}"
}

jwt_segments() { printf '%s' "$1" | awk -F'[.]' '{print NF}'; }

legacy_token() {
  local b
  b="$(k -n "$NS" get secret "$LEGACY_SECRET" -o jsonpath='{.data.token}' 2>/dev/null || true)"
  [ -n "$b" ] || return 0
  printf '%s' "$b" | base64 -d 2>/dev/null || true
}

# --- in-Pod probes ---------------------------------------------------------
#
# Each of these is a shell snippet handed to `sh -c` INSIDE the Pod, so every $
# below is expanded by the Pod's shell, not this one -- hence the single quotes.
# They read the namespace out of the projected volume rather than being told it,
# which is exactly how a real in-cluster client discovers where it is running.

# The full request as a well-behaved in-cluster client makes it: bearer token
# from the projected file, TLS verified against the projected CA bundle.
API_STATUS_PROBE='
TOKEN="$(cat /var/run/secrets/kubernetes.io/serviceaccount/token)"
POD_NS="$(cat /var/run/secrets/kubernetes.io/serviceaccount/namespace)"
curl -sS -o /dev/null -w "%{http_code}" \
  --cacert /var/run/secrets/kubernetes.io/serviceaccount/ca.crt \
  -H "Authorization: Bearer ${TOKEN}" \
  "https://kubernetes.default.svc/api/v1/namespaces/${POD_NS}/pods"
'

# Same request, but keep the body instead of the status line.
API_BODY_PROBE='
TOKEN="$(cat /var/run/secrets/kubernetes.io/serviceaccount/token)"
POD_NS="$(cat /var/run/secrets/kubernetes.io/serviceaccount/namespace)"
curl -sS \
  --cacert /var/run/secrets/kubernetes.io/serviceaccount/ca.crt \
  -H "Authorization: Bearer ${TOKEN}" \
  "https://kubernetes.default.svc/api/v1/namespaces/${POD_NS}/pods"
'

# The right token, no CA bundle. Guarded with || true because curl exits
# non-zero when it refuses the certificate.
API_NOCA_PROBE='
TOKEN="$(cat /var/run/secrets/kubernetes.io/serviceaccount/token)"
POD_NS="$(cat /var/run/secrets/kubernetes.io/serviceaccount/namespace)"
curl -sS -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer ${TOKEN}" \
  "https://kubernetes.default.svc/api/v1/namespaces/${POD_NS}/pods" 2>&1 || true
'

# The second projected token -- same ServiceAccount, different audience.
VAULT_STATUS_PROBE='
TOKEN="$(cat /var/run/secrets/tokens/vault-token)"
POD_NS="$(cat /var/run/secrets/kubernetes.io/serviceaccount/namespace)"
curl -sS -o /dev/null -w "%{http_code}" \
  --cacert /var/run/secrets/kubernetes.io/serviceaccount/ca.crt \
  -H "Authorization: Bearer ${TOKEN}" \
  "https://kubernetes.default.svc/api/v1/namespaces/${POD_NS}/pods"
'

VAULT_BODY_PROBE='
TOKEN="$(cat /var/run/secrets/tokens/vault-token)"
POD_NS="$(cat /var/run/secrets/kubernetes.io/serviceaccount/namespace)"
curl -sS \
  --cacert /var/run/secrets/kubernetes.io/serviceaccount/ca.crt \
  -H "Authorization: Bearer ${TOKEN}" \
  "https://kubernetes.default.svc/api/v1/namespaces/${POD_NS}/pods"
'

api_status()   { k -n "$NS" exec "$POD" -- sh -c "$API_STATUS_PROBE"; }
api_body()     { k -n "$NS" exec "$POD" -- sh -c "$API_BODY_PROBE"; }
vault_status() { k -n "$NS" exec "$POD" -- sh -c "$VAULT_STATUS_PROBE"; }

# `kubectl auth can-i` exits non-zero on a denial, which set -e would treat as a
# script failure, and it appends " - <reason>" to the answer when the authorizer
# supplies one. Normalise both away so the caller sees a bare yes/no.
can_i_list_pods() {
  local out
  out="$(k auth can-i list pods -n "$NS" --as="system:serviceaccount:$NS:$SA" 2>/dev/null || true)"
  case "$out" in
    yes*) printf 'yes' ;;
    no*)  printf 'no'  ;;
    *)    printf '%s' "$out" ;;
  esac
}

# Compare two long strings without dumping both of them into the terminal when
# they differ. cksum's output differs between BSD and GNU, which does not matter
# here: both sides are computed on the same machine.
digest() { printf '%s' "$1" | cksum | awk '{print $1"/"$2}'; }

# ---------------------------------------------------------------------------

step "A ServiceAccount, and a Pod that runs as it"
apply serviceaccount.yaml
apply caller.yaml
run k -n "$NS" wait --for=condition=Ready "pod/$POD" --timeout=180s

assert_eq "$(k -n "$NS" get sa "$SA" -o jsonpath='{.metadata.name}')" "$SA" \
  "the ServiceAccount exists"
assert_eq "$(k -n "$NS" get pod "$POD" -o jsonpath='{.spec.serviceAccountName}')" "$SA" \
  "the Pod's .spec.serviceAccountName is $SA"
note "a ServiceAccount carries no rules and no password. It is a name the"
note "API server can authenticate as and RBAC can grant to, nothing more."

step "What the kubelet projected into the Pod"
run k -n "$NS" exec "$POD" -- ls -l "$SA_DIR"
LISTING="$(k -n "$NS" exec "$POD" -- ls "$SA_DIR")"
assert_contains "$LISTING" "token"     "the projected directory holds a token"
assert_contains "$LISTING" "ca.crt"    "...the cluster CA bundle"
assert_contains "$LISTING" "namespace" "...and the Pod's own namespace"

POD_YAML="$(k -n "$NS" get pod "$POD" -o yaml)"
assert_contains "$POD_YAML" "kube-api-access" \
  "the Pod object grew a projected volume named kube-api-access-<random> that caller.yaml never asked for"
run k -n "$NS" get pod "$POD" \
  -o jsonpath='{range .spec.volumes[*]}{.name}{"\t"}{.projected.sources[*].serviceAccountToken.expirationSeconds}{"\n"}{end}'
note "the ServiceAccount admission plugin injects that volume. Its three"
note "sources are a serviceAccountToken (from the TokenRequest API), the"
note "kube-root-ca.crt ConfigMap, and the namespace via the downward API."

IN_POD_NS="$(k -n "$NS" exec "$POD" -- cat "$SA_DIR/namespace")"
assert_eq "$IN_POD_NS" "$NS" "the namespace file says $NS"

POD_CA="$(k -n "$NS" exec "$POD" -- cat "$SA_DIR/ca.crt" | tr -d ' \t\r\n')"
CM_CA="$(k -n "$NS" get configmap kube-root-ca.crt -o jsonpath='{.data.ca\.crt}' | tr -d ' \t\r\n')"
assert_contains "$POD_CA" "BEGINCERTIFICATE" "ca.crt is a PEM certificate"
assert_eq "$(digest "$POD_CA")" "$(digest "$CM_CA")" \
  "...and it is the same certificate the kube-root-ca.crt ConfigMap publishes into every namespace"

step "The token is a JWT bound to this Pod"
POD_TOKEN="$(k -n "$NS" exec "$POD" -- cat "$SA_DIR/token")"
assert_eq "$(jwt_segments "$POD_TOKEN")" "3" \
  "the token is a three-segment JWT: header.payload.signature"
POD_PAYLOAD="$(jwt_payload "$POD_TOKEN")"
note "decoded payload:"
note "$POD_PAYLOAD"
assert_contains "$POD_PAYLOAD" "\"sub\":\"system:serviceaccount:$NS:$SA\"" \
  "sub is system:serviceaccount:$NS:$SA — namespace and name together are the username"
assert_contains "$POD_PAYLOAD" "\"pod\"" \
  "the token is bound to a Pod: the kubernetes.io claim names it"
assert_contains "$POD_PAYLOAD" "\"$POD\"" "...specifically this Pod, $POD"
assert_contains "$POD_PAYLOAD" "\"exp\"" "it carries an exp claim, so it is not open-ended"
assert_not_contains "$POD_PAYLOAD" "vault.example.com" \
  "its audience is the API server's, not the other one this Pod also holds"
note "binding is what makes the token safe to leave lying in a container"
note "filesystem: delete the Pod and the API server stops accepting it, so a"
note "token exfiltrated from a Pod dies with the Pod rather than outliving it."
case "$POD_PAYLOAD" in
  *warnafter*)
    note "this cluster runs --service-account-extend-token-expiration=true (the"
    note "default), a compatibility measure: exp is pushed a year out while the"
    note "kubernetes.io/warnafter claim records the real one-hour deadline, and"
    note "requests made past it are counted in serviceaccount_stale_tokens_total."
    note "Do not read exp as the rotation interval — the kubelet rewrites the"
    note "file at ~80% of the requested lifetime regardless."
    ;;
  *)
    note "the kubelet rewrites this file at roughly 80% of its lifetime, so a"
    note "long-running process must re-read it from disk rather than caching"
    note "the string it saw at startup."
    ;;
esac

step "Calling the API from inside the Pod: 403 Forbidden"
note "curl https://kubernetes.default.svc/api/v1/namespaces/$NS/pods"
note "  --cacert $SA_DIR/ca.crt"
note "  -H 'Authorization: Bearer \$(cat $SA_DIR/token)'"
assert_eventually 90 "403" "the API server answered 403 Forbidden" api_status

BODY="$(api_body)"
note "$BODY"
assert_contains "$BODY" "Forbidden" "the Status object's reason is Forbidden"
assert_contains "$BODY" "system:serviceaccount:$NS:$SA" \
  "...and it names the caller, so authentication plainly succeeded"
# The message is embedded in JSON, so its inner quotes arrive backslash-escaped
# -- match on the unquoted part of the phrase rather than guessing the escaping.
assert_contains "$BODY" "cannot list resource" \
  "the complaint is about the verb and the resource, not about the identity"
note "403 and 401 are two different failures. 401 means the API server could"
note "not work out who you are; 403 means it knows exactly who you are and"
note "has decided you may not do this. A brand-new ServiceAccount is bound"
note "only to system:discovery, so it can read /api and /openapi and nothing else."

assert_eq "$(can_i_list_pods)" "no" \
  "kubectl auth can-i --as=system:serviceaccount:$NS:$SA agrees: no"

step "A Role and a RoleBinding turn the 403 into a 200"
apply rbac.yaml
run k -n "$NS" describe rolebinding api-reader-reads-pods
assert_eq "$(k -n "$NS" get rolebinding api-reader-reads-pods -o jsonpath='{.subjects[0].namespace}')" "$NS" \
  "the binding's ServiceAccount subject points at namespace $NS"
assert_eq "$(k -n "$NS" get rolebinding api-reader-reads-pods -o jsonpath='{.roleRef.kind}')" "Role" \
  "roleRef names a namespaced Role, so the grant stops at this namespace's edge"

assert_eventually 60 "yes" "kubectl auth can-i now answers yes" can_i_list_pods
assert_eventually 90 "200" "the very same call from inside the Pod now returns 200 OK" api_status

BODY="$(api_body)"
# Match the value alone: the API server pretty-prints this response, so the
# compact '"kind":"PodList"' spelling does not appear in it.
assert_contains "$BODY" 'PodList' "the body is a PodList"
assert_contains "$BODY" "\"$POD\"" "...listing this Pod among others"

POD_TOKEN_AFTER="$(k -n "$NS" exec "$POD" -- cat "$SA_DIR/token")"
assert_eq "$POD_TOKEN_AFTER" "$POD_TOKEN" \
  "the Pod is presenting the identical token string it presented for the 403"
assert_eq "$(k -n "$NS" get pod "$POD" -o jsonpath='{.status.containerStatuses[0].restartCount}')" "0" \
  "and the container never restarted — restartCount is still 0"
note "nothing about the Pod changed. Authorization is evaluated per request"
note "against the live RBAC rules, so a binding created seconds ago applies to"
note "the next call a running workload makes. That cuts both ways: deleting"
note "the binding revokes the access just as immediately."

step "The CA bundle is projected for a reason"
NOCA="$(k -n "$NS" exec "$POD" -- sh -c "$API_NOCA_PROBE")"
note "$NOCA"
assert_contains "$NOCA" "certificate" \
  "without --cacert, curl refuses the connection over the certificate"
assert_contains "$NOCA" "000" "...so there is no HTTP status at all, only 000"
note "the API server's serving certificate is signed by the cluster's own CA,"
note "which is in no public trust store. That is why ca.crt travels alongside"
note "the token. Reaching for --insecure here would throw away server"
note "authentication and hand the bearer token to whatever answered."

step "A token minted for another audience gets 401, not 403"
VAULT_TOKEN="$(k -n "$NS" exec "$POD" -- cat /var/run/secrets/tokens/vault-token)"
VAULT_PAYLOAD="$(jwt_payload "$VAULT_TOKEN")"
note "$VAULT_PAYLOAD"
assert_contains "$VAULT_PAYLOAD" '"aud":["vault.example.com"]' \
  "the second projected token is audience-scoped to vault.example.com"
assert_contains "$VAULT_PAYLOAD" "\"sub\":\"system:serviceaccount:$NS:$SA\"" \
  "...for the very same ServiceAccount, which by now is allowed to list pods"
assert_eventually 60 "401" "the API server answers 401 Unauthorized to that token" vault_status

VBODY="$(k -n "$NS" exec "$POD" -- sh -c "$VAULT_BODY_PROBE")"
note "$VBODY"
assert_contains "$VBODY" "Unauthorized" "the reason is Unauthorized, not Forbidden"
assert_not_contains "$VBODY" "cannot list resource" \
  "authorization was never reached — the request failed one step earlier"
note "the API server accepts only tokens whose aud contains its own audience."
note "So the 401 is not an RBAC decision at all: the same identity that just"
note "got a 200 is unrecognised here. That is the whole value of audiences —"
note "a token handed to an external service cannot be replayed against the"
note "Kubernetes API, and vice versa."

step "kubectl create token mints one from outside"
MINTED="$(k -n "$NS" create token "$SA")"
note "kubectl create token $SA -> ${MINTED:0:24}... (${#MINTED} characters)"
assert_eq "$(jwt_segments "$MINTED")" "3" \
  "kubectl create token printed a three-segment JWT"
MINTED_PAYLOAD="$(jwt_payload "$MINTED")"
note "$MINTED_PAYLOAD"
assert_contains "$MINTED_PAYLOAD" "\"sub\":\"system:serviceaccount:$NS:$SA\"" \
  "it is a credential for the same ServiceAccount"
assert_contains "$MINTED_PAYLOAD" "\"exp\"" "it expires"
assert_not_contains "$MINTED_PAYLOAD" "\"pod\"" \
  "but it is bound to no Pod, so no Pod's deletion invalidates it"

SHORT="$(k -n "$NS" create token "$SA" --duration=10m)"
SHORT_EXP="$(jwt_number "$(jwt_payload "$SHORT")" exp)"
DEFAULT_EXP="$(jwt_number "$MINTED_PAYLOAD" exp)"
[ -n "$SHORT_EXP" ] || fail "could not read the exp claim from the --duration=10m token"
[ -n "$DEFAULT_EXP" ] || fail "could not read the exp claim from the default token"
NOW="$(date +%s)"
DELTA=$(( SHORT_EXP - NOW ))
if [ "$DELTA" -ge 300 ] && [ "$DELTA" -le 900 ]; then IN_RANGE=yes; else IN_RANGE=no; fi
assert_eq "$IN_RANGE" "yes" \
  "--duration=10m produced a token valid for ${DELTA}s, inside the 5-15 minute window"
if [ "$DEFAULT_EXP" -gt "$SHORT_EXP" ]; then LONGER=yes; else LONGER=no; fi
assert_eq "$LONGER" "yes" \
  "the default token, minted moments earlier, still expires $(( DEFAULT_EXP - SHORT_EXP ))s later — the default is one hour"

MINT_PROBE="curl -sS -o /dev/null -w '%{http_code}' \
  --cacert $SA_DIR/ca.crt \
  -H 'Authorization: Bearer $MINTED' \
  https://kubernetes.default.svc/api/v1/namespaces/$NS/pods"
assert_eq "$(k -n "$NS" exec "$POD" -- sh -c "$MINT_PROBE")" "200" \
  "that externally minted token is accepted exactly like the projected one"
note "the Pod is only being borrowed as a machine with curl on it here — the"
note "token itself came from the TokenRequest API, over kubectl, from outside"
note "the cluster. This is the standard way to test what a ServiceAccount can"
note "actually do, and the credential expires on its own afterwards."

step "The legacy alternative: a service-account-token Secret"
apply legacy-token-secret.yaml
assert_eq "$(k -n "$NS" get secret "$LEGACY_SECRET" -o jsonpath='{.type}')" \
  "kubernetes.io/service-account-token" "the Secret's type asks for a token"
assert_eventually_contains 120 "eyJ" \
  "the control plane populated .data.token by itself" legacy_token
run k -n "$NS" get secret "$LEGACY_SECRET"
run k -n "$NS" describe secret "$LEGACY_SECRET"

LEGACY="$(legacy_token)"
LEGACY_PAYLOAD="$(jwt_payload "$LEGACY")"
note "$LEGACY_PAYLOAD"
assert_contains "$LEGACY_PAYLOAD" "\"sub\":\"system:serviceaccount:$NS:$SA\"" \
  "it authenticates as the same ServiceAccount"
assert_contains "$LEGACY_PAYLOAD" "kubernetes.io/serviceaccount/secret.name" \
  "its claims are the old flat ones, naming the Secret it came from"
assert_not_contains "$LEGACY_PAYLOAD" "\"exp\"" \
  "there is no exp claim at all — this credential never expires"
assert_not_contains "$LEGACY_PAYLOAD" "\"pod\"" \
  "and no pod claim — nothing ties it to a workload, a node, or a lifetime"
note "that is the entire objection to it. A projected token is short-lived and"
note "dies with its Pod; this one is a permanent password sitting in etcd, and"
note "revoking it means finding and deleting the Secret. Kubernetes stopped"
note "generating these automatically in v1.24 and you should reach for"
note "TokenRequest instead, but hand-creating one still works for the rare"
note "case of a credential that has to leave the cluster."

step "Opting out with automountServiceAccountToken: false"
apply no-token.yaml
run k -n "$NS" wait --for=condition=Ready pod/no-token --timeout=180s
assert_eq "$(k -n "$NS" get pod no-token -o jsonpath='{.spec.serviceAccountName}')" "$SA" \
  "the Pod still runs as $SA — the identity is unchanged"
assert_eq "$(k -n "$NS" get pod no-token -o jsonpath='{.spec.automountServiceAccountToken}')" "false" \
  "...but it asked not to be given the credential"

NO_TOKEN_YAML="$(k -n "$NS" get pod no-token -o yaml)"
assert_not_contains "$NO_TOKEN_YAML" "kube-api-access" \
  "no kube-api-access volume was injected into this Pod at all"

if OUT="$(k -n "$NS" exec no-token -- cat "$SA_DIR/token" 2>&1)"; then
  fail "expected no token file inside the no-token Pod"
fi
note "$OUT"
assert_contains "$OUT" "No such file" "there is no token file to read"
note "the container can still resolve and reach kubernetes.default.svc — this"
note "removes the credential, not the route — so its requests arrive"
note "unauthenticated. Most workloads never call the API server at all, which"
note "makes this the cheapest hardening step there is. Set it on the"
note "ServiceAccount to cover every Pod using it; the Pod-level field wins"
note "where the two disagree."

step "What this proves"
note "A Pod's identity is a ServiceAccount, and its credential is a JWT the"
note "kubelet fetches from the TokenRequest API and projects into"
note "$SA_DIR alongside the"
note "cluster CA and the namespace. Since v1.22 that token is short-lived,"
note "auto-rotating, and bound to the Pod, so it cannot outlive the workload"
note "it was issued for."
note ""
note "Holding a credential and being allowed to use it are separate questions,"
note "and the HTTP status tells you which one failed. The same token, the same"
note "Pod, and no restart went from 403 to 200 the moment a Role and a"
note "RoleBinding existed: 403 is an authorization answer about a subject the"
note "API server has already identified. The audience-scoped token, by"
note "contrast, drew a 401 even after that grant, because the API server never"
note "got as far as asking what it was allowed to do. Read 401 as 'who are"
note "you?' and 403 as 'not you, not this'."
note ""
note "From outside, kubectl create token <sa> asks the same TokenRequest API"
note "for the same kind of credential and prints it. It is the honest way to"
note "test what a ServiceAccount can do, far better than reading a Secret."
note ""
note "Manually created kubernetes.io/service-account-token Secrets still work"
note "and still get populated by the control plane, but they produce a token"
note "with no exp and no binding: a permanent password in etcd. They are a"
note "legacy escape hatch, not the default, and have not been auto-generated"
note "since v1.24."
note ""
note "Finally, automountServiceAccountToken: false gives a Pod its identity"
note "without its credential. For the large majority of workloads that never"
note "speak to the API server, that is a free reduction in blast radius."
