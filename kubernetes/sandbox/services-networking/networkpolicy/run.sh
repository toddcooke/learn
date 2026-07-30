#!/usr/bin/env bash
LAB="networkpolicy"
source "$(dirname "$0")/../../cluster/lib.sh"
require_cluster
require_addon networkpolicy
ns_setup

# Everything this lab creates -- three Pods and six NetworkPolicies -- is
# namespaced, so ns_teardown removes all of it. No cluster-scoped object, no
# namespace label, no node change; the trap installed by ns_setup is enough.

# ---------------------------------------------------------------------------
# Two probes, used throughout.
#
# Both deliberately open a BRAND NEW connection on every call. A NetworkPolicy
# is applied to new flows; conntrack keeps an already-established flow alive
# across a policy change, so reusing one long-lived connection would keep
# working and would hide the exact thing being measured.
# ---------------------------------------------------------------------------

# probe <client-pod> -> the server's hostname on success, "BLOCKED" otherwise.
# We connect straight to the Pod IP so that no Service and no DNS lookup sits
# in the path: whatever happens is pod-to-pod policy and nothing else.
probe() {
  if OUT="$(k -n "$NS" exec "$1" -- wget -q -T 5 -O- "http://${WEB_IP}:8080/hostname" 2>/dev/null)"; then
    printf '%s' "$OUT"
  else
    printf 'BLOCKED'
  fi
}

# dns_probe <client-pod> -> "RESOLVED" or "FAILED". The client Pods pin
# ndots/timeout/attempts (see pods.yaml) so a denied lookup gives up in about
# four seconds instead of stalling for most of a minute.
dns_probe() {
  if k -n "$NS" exec "$1" -- nslookup kubernetes.default.svc.cluster.local >/dev/null 2>&1; then
    printf 'RESOLVED'
  else
    printf 'FAILED'
  fi
}

# The API server accepting a NetworkPolicy and the CNI having programmed it
# are two different moments. There is no condition to wait on -- a policy has
# no status -- so this is the one place a fixed pause is the honest tool.
settle() { note "waiting 5s for the CNI to program the policy"; sleep 5; }

step "One server, two clients that differ by a single label"
apply pods.yaml
run k -n "$NS" wait --for=condition=Ready pod --all --timeout=120s
WEB_IP="$(k -n "$NS" get pod web -o jsonpath='{.status.podIP}')"
run k -n "$NS" get pods --show-labels
note "web Pod IP: $WEB_IP"
note "the clients are identical except for tier=frontend vs tier=batch, so"
note "every difference in outcome below is attributable to policy alone"

step "With no policy, the namespace is wide open"
# The first probe polls rather than asserting once: the Pod is Ready as soon as
# its container starts, which is a moment before agnhost has bound :8080. Every
# later probe is a single shot, because by then the server is demonstrably up
# and a failure can only mean policy.
assert_eventually 60 "web" "frontend reached web:8080" probe frontend
assert_eq "$(probe batch)" "web" "batch reached web:8080"
note "a namespace holding zero NetworkPolicies permits everything. Policy is"
note "opt-in per Pod: a Pod is unrestricted until some policy selects it."

step "A default-deny ingress policy closes it"
apply 01-default-deny-ingress.yaml
settle
assert_eq "$(probe frontend)" "BLOCKED" "frontend can no longer reach web"
assert_eq "$(probe batch)" "BLOCKED" "neither can batch"
note "podSelector: {} is an EMPTY selector, which matches every Pod in the"
note "namespace -- empty means all, not none. Combined with policyTypes"
note "[Ingress] and no ingress rules, that reads: select everything, allow"
note "nothing inbound."
assert_eq "$(dns_probe frontend)" "RESOLVED" "DNS still works under an Ingress-only policy"
note "the two directions are wholly independent. This object never mentions"
note "Egress, so outbound traffic -- including DNS -- is untouched."

step "An allow rule reopens one label, and only that label"
apply 02-allow-frontend.yaml
settle
run k -n "$NS" describe netpol allow-frontend
assert_eq "$(probe frontend)" "web" "frontend is allowed again"
assert_eq "$(probe batch)" "BLOCKED" "batch, differing only in one label, stays blocked"
note "there is no deny rule in the API. Policies only ever add permission, and"
note "what a Pod may receive is the union of every Ingress policy selecting"
note "it. default-deny-ingress was not edited or overridden -- it still allows"
note "nothing, and nothing unioned with this rule is this rule."

step "Two items in from: are ORed"
run k -n "$NS" delete netpol allow-frontend
apply 03-allow-or.yaml
settle
assert_eq "$(probe batch)" "web" "batch got in on the second from: item alone"
assert_eq "$(probe frontend)" "BLOCKED" "frontend matches neither item, so it stays out"
note "the from: list has two items -- a namespaceSelector for kube-system and"
note "a podSelector for tier=batch -- and a source matching EITHER is admitted."
note "allow-frontend was deleted first on purpose: leaving it would have made"
note "the result the union of two policies and proved nothing about this one."

step "One item holding both selectors is ANDed"
run k -n "$NS" delete netpol allow-or
apply 04-allow-and.yaml
settle
assert_eq "$(probe batch)" "BLOCKED" "batch is refused: right label, wrong namespace"
assert_eq "$(probe frontend)" "BLOCKED" "and frontend was never in scope"
note "same two selectors as the previous policy. The only difference in the"
note "YAML is one deleted dash, which merged them into a single from: item --"
note "and selectors inside one item are ANDed. The admitted source is now a"
note "tier=batch Pod IN kube-system, which does not exist."
note "Get this backwards in the OR direction and you have silently admitted an"
note "entire namespace, with nothing failing to tell you so."

step "Now the other direction: default-deny egress"
run k -n "$NS" delete netpol --all
settle
assert_eq "$(probe frontend)" "web" "clean slate: pod-to-pod works again"
assert_eq "$(dns_probe frontend)" "RESOLVED" "and so does DNS"
apply 05-default-deny-egress.yaml
settle
assert_eq "$(dns_probe frontend)" "FAILED" "nslookup now fails"
assert_eq "$(probe frontend)" "BLOCKED" "and so does the direct connection to web"
note "nothing visible changed: the Pods are still Ready, nothing restarted,"
note "kubectl get pods is entirely green. DNS is egress like any other"
note "traffic, so the first casualty of a default-deny egress policy is name"
note "resolution -- and the symptom the application reports is a resolver"
note "timeout, not a permission error."

step "Allow egress to kube-system on port 53, UDP and TCP"
apply 06-allow-dns-egress.yaml
settle
assert_eq "$(dns_probe frontend)" "RESOLVED" "DNS resolves again"
assert_eq "$(probe frontend)" "BLOCKED" "everything else is still denied, as intended"
run k -n "$NS" get netpol
note "the destination is matched by namespace, not by the kube-dns ClusterIP:"
note "kube-proxy has already DNAT'd the packet to a real CoreDNS Pod IP by the"
note "time policy is evaluated, so a namespaceSelector matches and an ipBlock"
note "naming the Service IP would not."
note "both protocols are listed because a truncated answer makes the resolver"
note "retry the same query over TCP/53. A UDP-only rule works until it does"
note "not, then fails for large answers only, under load."

step "What this proves"
note "NetworkPolicy is a whitelist that switches on per Pod. A Pod no policy"
note "selects is unrestricted; the moment one selects it for a direction, that"
note "direction allows only the union of every rule that selects it, and there"
note "is no way to write a deny."
note ""
note "Ingress and Egress are separate switches on the same object, and the"
note "egress one is the one that hurts: it breaks DNS first, invisibly, so a"
note "default-deny egress policy is only ever half a change -- the DNS"
note "companion rule, on UDP and TCP alike, is the other half."
note ""
note "In a from: or to: list, items are ORed and the selectors inside one item"
note "are ANDed. One dash separates 'the checkout namespace or any payments"
note "Pod' from 'the payments Pods in the checkout namespace'."
note ""
note "Test policies with kubectl exec from inside a Pod. Probing a Pod IP from"
note "the node with docker exec proves nothing: node-originated traffic is"
note "accepted regardless of policy, so that test passes even under a"
note "default deny."
