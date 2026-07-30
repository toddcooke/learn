#!/usr/bin/env bash
LAB="service-debugging"
source "$(dirname "$0")/../../cluster/lib.sh"
require_cluster
ns_setup

# CLEANUP: every object this lab creates is namespaced — the hostnames
# Deployment and its Pods, the client Pod, the hostnames Service, and the
# EndpointSlice the control plane derives from that Service (which is owned by
# the Service and garbage-collected with it). Deleting $NS removes all of it, so
# the trap ns_setup installed is a complete teardown and this lab installs no
# trap of its own. It creates nothing cluster-scoped, creates no second
# namespace, creates no NetworkPolicy, cordons/taints/labels no node, and writes
# no file onto a node. The only thing it touches outside $NS is a `get` of the
# kube-dns Service in kube-system, to learn the resolver's address so the DNS
# answers below can be read correctly.
#
# No require_addon: the lab never applies a NetworkPolicy, it only asserts that
# none exists, which is true whatever the CNI is doing. Making the lab depend on
# kindnet's health would fail it for a reason unrelated to anything it teaches.

# --- small readers, so the assertions below stay one line each -------------
lines() { printf '%s\n' "$1" | grep -c . || true; }
show()  { printf '%s\n' "$1" | while IFS= read -r _l; do note "$_l"; done; }

pod_names() { k -n "$NS" get pods -l app=hostnames -o jsonpath='{.items[*].metadata.name}' | tr ' ' '\n' | sort; }
pod_ips()   { k -n "$NS" get pods -l app=hostnames -o jsonpath='{.items[*].status.podIP}'   | tr ' ' '\n' | sort; }

# Every EndpointSlice reader goes through the label the control plane stamps on
# the slice. Slice *names* are generated, and one Service may own several.
slice()       { k -n "$NS" get endpointslice -l kubernetes.io/service-name=hostnames "$@"; }
slice_count() { slice -o jsonpath='{.items[*].metadata.name}' | wc -w | tr -d ' '; }
ep_addrs()    { slice -o jsonpath='{.items[*].endpoints[*].addresses[*]}' | tr ' ' '\n' | sort | grep -v '^$' || true; }
ep_total()    { ep_addrs | grep -c . || true; }
ep_ready()    { slice -o jsonpath='{.items[*].endpoints[*].conditions.ready}' | tr ' ' '\n' | grep -c '^true$'  || true; }
ep_unready()  { slice -o jsonpath='{.items[*].endpoints[*].conditions.ready}' | tr ' ' '\n' | grep -c '^false$' || true; }
ep_table()    { slice -o jsonpath='{range .items[*].endpoints[*]}{.addresses[0]}{"  "}{.targetRef.name}{"  ready="}{.conditions.ready}{"\n"}{end}'; }
ep_unready_names() {
  slice -o jsonpath='{range .items[*].endpoints[*]}{.conditions.ready}{" "}{.targetRef.name}{"\n"}{end}' \
    | awk '$1 == "false" { print $2 }' | sort
}

# Rebuild the Service's own selector as a --selector string, straight from the
# object. Reading it back rather than retyping it is the point of the step it
# serves: you want to query with what the Service actually says, typo included.
svc_selector() {
  k -n "$NS" get svc hostnames \
    -o go-template='{{range $k, $v := .spec.selector}}{{$k}}={{$v}},{{end}}' | sed 's/,$//'
}

# Pull every IPv4 literal out of an nslookup answer, minus the resolver's own
# address, which nslookup echoes back in its Server:/Address: header. Exact line
# matching throughout, never substrings: 10.96.0.1 is a substring of 10.96.0.10.
addrs_of() {
  printf '%s\n' "$1" \
    | grep -oE '([0-9]{1,3}\.){3}[0-9]{1,3}' \
    | grep -vxF "${DNS_SVC_IP:-0.0.0.0}" | sort -u || true
}

step "A healthy backend, a client, and a Service that does not work"
apply backend.yaml
apply client.yaml
apply service-broken.yaml
if ! run k -n "$NS" rollout status deployment/hostnames --timeout=300s; then
  fail "the backend Deployment never became ready"
fi
run k -n "$NS" wait --for=condition=Ready pod/client --timeout=180s
assert_eq "$(lines "$(pod_names)")" "3" "three backend Pods are Running and Ready"
run k -n "$NS" get pods -o wide
note "the backend is three replicas of agnhost netexec on port 9376; GET /hostname"
note "returns the answering Pod's name, so every reply is signed"
note "the client is a separate Pod labelled app=client, so it can never become"
note "an endpoint of the Service it is about to investigate"
note "assume from here that you did not write any of this and were handed only"
note "a ticket: 'http://hostnames is down'"

step "The symptom: a request through the Service fails"
note "\$ kubectl exec client -c shell -- wget -q -O - -T 5 http://hostnames/hostname"
if SYMPTOM="$(k -n "$NS" exec client -c shell -- wget -q -O - -T 5 http://hostnames/hostname 2>&1)"; then
  fail "the request unexpectedly succeeded before anything was fixed: $SYMPTOM"
fi
ok "the request failed, which is the report we are here to explain"
show "$SYMPTOM"
assert_not_contains "$SYMPTOM" "hostnames-" "and no backend hostname came back in the output"
note "note the shape of the failure. A refused connection means something"
note "answered the packet with 'no' — kube-proxy programs an explicit reject for"
note "a clusterIP that has no endpoints. A silent timeout would point somewhere"
note "else entirely: a NetworkPolicy dropping the packet, or a targetPort aimed"
note "at a port nothing is listening on. Read the error before forming a theory."

step "Check 1 — does the Service exist?"
run k -n "$NS" get svc hostnames
CIP="$(k -n "$NS" get svc hostnames -o jsonpath='{.spec.clusterIP}')"
if [ -z "$CIP" ] || [ "$CIP" = "None" ]; then
  fail "the hostnames Service has no clusterIP"
fi
ok "the Service exists and holds clusterIP $CIP"
assert_eq "$(k -n "$NS" get svc hostnames -o jsonpath='{.spec.type}')" "ClusterIP" \
  "it is a ClusterIP Service, so in-cluster callers are the ones it serves"
note "worth the ten seconds: the commonest cause of 'the Service is broken' is"
note "that the caller is in a different namespace from the Service, where the"
note "short name resolves to nothing at all. Same namespace here, so on we go."

step "Check 2 — any NetworkPolicy affecting the target Pods?"
run k -n "$NS" get networkpolicies
NETPOL="$(k -n "$NS" get networkpolicies -o name 2>/dev/null || true)"
assert_eq "$(lines "$NETPOL")" "0" \
  "no NetworkPolicy exists in this namespace, so nothing is filtering traffic to the backends"
note "\$ kubectl get netpol -o custom-columns=NAME:.metadata.name,PODSELECTOR:.spec.podSelector,TYPES:.spec.policyTypes"
note "is how you read the list when it is not empty: a policy matters to this"
note "outage only if its podSelector matches the backend Pods' labels"
note "two directions to check, not one. An Ingress policy in THIS namespace can"
note "block traffic arriving at the backends, and an Egress policy in the"
note "CALLER's namespace can block the request before it ever leaves. Both look"
note "identical from the caller: a connection that hangs and then times out."
note "This check is placed second in the upstream checklist for a good reason —"
note "a policy makes a perfectly correct Service look broken, and nothing in"
note "'kubectl describe svc' hints that one exists."

step "Check 3 — does the Service work by DNS name?"
DNS_SVC_IP="$(k -n kube-system get svc kube-dns -o jsonpath='{.spec.clusterIP}' 2>/dev/null || true)"
if [ -z "$DNS_SVC_IP" ]; then
  fail "no kube-dns Service in kube-system — this cluster has no cluster DNS, so the DNS step would prove nothing"
fi
note "\$ kubectl exec client -c dns -- nslookup hostnames"
LOOKUP="$(k -n "$NS" exec client -c dns -- nslookup hostnames 2>&1 || true)"
show "$LOOKUP"
assert_eq "$(addrs_of "$LOOKUP")" "$CIP" \
  "the name resolves, and to the Service's clusterIP $CIP"
LOOKUP_FQDN="$(k -n "$NS" exec client -c dns -- nslookup "hostnames.$NS.svc.cluster.local" 2>&1 || true)"
assert_eq "$(addrs_of "$LOOKUP_FQDN")" "$CIP" \
  "so does the fully qualified hostnames.$NS.svc.cluster.local"
note "this is the step people over-read. DNS answered perfectly for a Service"
note "with no working backends at all, because the A record of a ClusterIP"
note "Service is its clusterIP, and the clusterIP was allocated at creation and"
note "has nothing to do with whether any Pod is behind it. A successful lookup"
note "rules out DNS and rules out nothing else."
note "the exception is a headless Service (clusterIP: None), whose records ARE"
note "the endpoint addresses — there, an empty EndpointSlice does show up as"
note "NXDOMAIN, and the lookup failing is the same finding as an empty slice."

step "Check 4 — does the Service work by IP?"
note "\$ kubectl exec client -c shell -- wget -q -O - -T 5 http://$CIP/hostname"
if BYIP="$(k -n "$NS" exec client -c shell -- wget -q -O - -T 5 "http://$CIP/hostname" 2>&1)"; then
  fail "the request to the clusterIP unexpectedly succeeded: $BYIP"
fi
ok "the clusterIP fails the same way the name did"
show "$BYIP"
assert_not_contains "$BYIP" "hostnames-" "no backend answered on the address either"
note "bypassing the name reproduces the fault, so the name was never the"
note "problem. If this had SUCCEEDED where the name failed, the whole"
note "investigation would turn towards CoreDNS and /etc/resolv.conf instead."

step "Check 5 — is the Service defined correctly?"
run k -n "$NS" get svc hostnames \
  -o custom-columns='NAME:.metadata.name,TYPE:.spec.type,CLUSTER-IP:.spec.clusterIP,PORT:.spec.ports[0].port,TARGETPORT:.spec.ports[0].targetPort,PROTO:.spec.ports[0].protocol,SELECTOR-APP:.spec.selector.app'
note "'kubectl get svc hostnames -o yaml' is the fuller form; the columns above"
note "are just the fields this check is about, pulled out to be read side by side"
SVC_PORT="$(k -n "$NS" get svc hostnames -o jsonpath='{.spec.ports[0].port}')"
SVC_TARGET="$(k -n "$NS" get svc hostnames -o jsonpath='{.spec.ports[0].targetPort}')"
SVC_PROTO="$(k -n "$NS" get svc hostnames -o jsonpath='{.spec.ports[0].protocol}')"
POD_PORT="$(k -n "$NS" get pods -l app=hostnames -o jsonpath='{.items[0].spec.containers[0].ports[0].containerPort}')"
assert_eq "$SVC_PORT" "80" "spec.ports[0].port is 80 — the port callers dial, and the port we dialled"
assert_eq "$SVC_PROTO" "TCP" "the protocol is TCP, matching an HTTP client"
assert_eq "$SVC_TARGET" "$POD_PORT" \
  "spec.ports[0].targetPort ($SVC_TARGET) equals the Pods' containerPort ($POD_PORT)"
note "targetPort is a number here and containerPort is a number, so they compare"
note "directly. Had targetPort been the string 'http', the check would instead be"
note "whether the Pods expose a port with that NAME — and a name that resolves to"
note "nothing is a genuinely nasty bug, because the Service still looks tidy."
note "so the ports are right. Five checks in and every cause we have tested has"
note "come back clean. That is not wasted work: each pass deleted a hypothesis,"
note "which is the whole job of a checklist."

step "Check 6 — does the Service have any EndpointSlices?"
assert_eventually 60 "1" "one EndpointSlice exists for the Service" slice_count
run k -n "$NS" get endpointslices -l kubernetes.io/service-name=hostnames
FIRST_POD_IP="$(k -n "$NS" get pods -l app=hostnames -o jsonpath='{.items[0].status.podIP}')"
# An empty needle would make assert_not_contains match everything and fail the
# lab for the wrong reason, so refuse to run the check without a real address.
if [ -z "$FIRST_POD_IP" ]; then fail "a backend Pod has no podIP, so this check cannot be made"; fi
DESC="$(k -n "$NS" describe svc hostnames)"
show "$DESC"
assert_not_contains "$DESC" "$FIRST_POD_IP" \
  "'describe svc' lists no backend address either — its Endpoints line is blank"
assert_eq "$(ep_total)" "0" "and the slice carries ZERO addresses — this is the finding"
assert_eq "$(ep_ready)" "0" "no ready endpoints"
assert_eq "$(ep_unready)" "0" "and no unready ones either: the slice is not partly full, it is empty"
assert_eq "$(slice -o jsonpath='{.items[0].metadata.ownerReferences[0].kind}/{.items[0].metadata.ownerReferences[0].name}')" \
          "Service/hostnames" \
  "the slice is owned by the Service, which is why it exists at all"
note "the slice being present but empty is deliberate control-plane behaviour."
note "The endpointslice controller writes a placeholder slice for every selector"
note "Service so that kube-proxy and CoreDNS always have an object to watch, and"
note "'no endpoints yet' is never confused with 'the controller has not run'."
note "an empty EndpointSlice is one of the highest-signal findings in Kubernetes"
note "troubleshooting. It says the selector matched no Pod. It does not say the"
note "Pods are unhealthy, because unhealthy Pods still appear here — see the"
note "last step."

step "Check 6b — what does the Service's own selector actually match?"
SEL="$(svc_selector)"
assert_eq "$SEL" "app=hostname" "the Service selects on $SEL"
note "\$ kubectl get pods --selector=$SEL"
MATCHED="$(k -n "$NS" get pods --selector="$SEL" 2>&1 || true)"
show "$MATCHED"
assert_contains "$MATCHED" "No resources found" "kubectl says so in as many words"
assert_eq "$(lines "$(k -n "$NS" get pods --selector="$SEL" -o name 2>/dev/null || true)")" "0" \
  "the Service's selector matches zero Pods in this namespace"
assert_eq "$(lines "$(k -n "$NS" get pods --selector=app=hostnames -o name 2>/dev/null || true)")" "3" \
  "while app=hostnames — one letter longer — matches all three"
run k -n "$NS" get pods -l app=hostnames --show-labels
note "there is the bug, in plain sight: the Pods are labelled app=hostnames and"
note "the Service asks for app=hostname. Querying with the selector read back"
note "OUT of the Service, rather than the one you believe you wrote, is what"
note "makes this step reliable — the whole failure is that the two differ."

step "The fix: correct the selector"
apply service-fixed.yaml
assert_eq "$(svc_selector)" "app=hostnames" "the Service now selects on app=hostnames"
assert_eq "$(k -n "$NS" get svc hostnames -o jsonpath='{.spec.clusterIP}')" "$CIP" \
  "and the clusterIP is still $CIP — repairing a Service in place does not re-address it"
assert_eventually 120 "3" "the EndpointSlice now reports three ready endpoints" ep_ready
run k -n "$NS" get endpointslices -l kubernetes.io/service-name=hostnames
assert_eq "$(ep_total)" "3" "three addresses in the slice"
assert_eq "$(ep_addrs | tr '\n' ' ')" "$(pod_ips | tr '\n' ' ')" "and they are exactly the three backend Pod IPs"
show "$(ep_table)"
assert_eventually_contains 90 "hostnames-" "a request through the Service now returns a backend hostname" \
  k -n "$NS" exec client -c shell -- wget -q -O - -T 5 http://hostnames/hostname
HOST="$(k -n "$NS" exec client -c shell -- wget -q -O - -T 5 http://hostnames/hostname 2>&1 || true)"
# grep -q against an already-captured string, never against a live pipeline:
# -q exits at the first match and would SIGPIPE the still-streaming producer,
# which pipefail then reports as a spurious failure.
NAMES_NOW="$(pod_names)"
if ! printf '%s\n' "$NAMES_NOW" | grep -qxF "$HOST"; then
  fail "http://hostnames/hostname did not return a backend Pod name, got: $HOST"
fi
ok "backend $HOST answered — the same URL that failed in step 2"
note "not one Pod was restarted, rescheduled or edited. The backends were"
note "healthy the entire time; only the sentence describing them was wrong."

step "Empty is not the same as unready"
BROKEN="$(k -n "$NS" get pods -l app=hostnames -o jsonpath='{.items[0].metadata.name}')"
BROKEN_IP="$(k -n "$NS" get pod "$BROKEN" -o jsonpath='{.status.podIP}')"
note "\$ kubectl exec $BROKEN -- sh -c ': > /tmp/ready'"
k -n "$NS" exec "$BROKEN" -- sh -c ': > /tmp/ready'
pod_ready() { k -n "$NS" get pod "$BROKEN" -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}'; }
assert_eventually 120 "False" "$BROKEN's readiness probe now fails, so its Ready condition is False" pod_ready
assert_eventually 120 "1" "the slice reports exactly one endpoint with conditions.ready == false" ep_unready
assert_eq "$(ep_total)" "3" "the slice still lists three addresses — the unready endpoint did not vanish"
assert_eq "$(ep_ready)" "2" "two of the three are ready"
ADDRS_NOW="$(ep_addrs)"
if ! printf '%s\n' "$ADDRS_NOW" | grep -qxF "$BROKEN_IP"; then
  fail "$BROKEN's address $BROKEN_IP disappeared from the slice"
fi
ok "$BROKEN_IP is still listed"
assert_eq "$(ep_unready_names)" "$BROKEN" "and the not-ready entry is exactly the Pod whose probe we broke"
show "$(ep_table)"
note "compare this slice with the one in check 6. Both describe a Service that"
note "is not fully serving, and they look nothing alike: a selector mismatch"
note "empties the slice, while a failing probe leaves every address in place and"
note "flips a condition. Two different diagnoses, and reading only the ENDPOINTS"
note "column of 'kubectl get endpointslices' shows you neither — it prints"
note "addresses without their conditions."
note "\$ kubectl exec $BROKEN -- sh -c 'echo ok > /tmp/ready'"
k -n "$NS" exec "$BROKEN" -- sh -c 'echo ok > /tmp/ready'
assert_eventually 120 "3" "restoring the file brings the endpoint back to ready, with no object edited" ep_ready
assert_eq "$(ep_unready)" "0" "and none are left marked ready:false"

step "What this proves"
note "A Service is a selector, a port mapping and an address. Debugging one is"
note "walking down those three in a fixed order and refusing to skip ahead:"
note "does the Service exist; is a NetworkPolicy filtering the target Pods;"
note "does the name resolve; does the clusterIP behave the same way the name"
note "does; are port and targetPort what you think; and does the EndpointSlice"
note "have anything in it. Two rungs remain below that — are the Pods actually"
note "serving on the targetPort, and is kube-proxy healthy — and you reach them"
note "only when everything above has come back clean."
note ""
note "Most of those checks passed here, and that is the lesson rather than the"
note "filler. The Service existed, no policy was in the way, DNS answered with"
note "the right clusterIP, and port 80 mapped correctly onto containerPort 9376."
note "A checklist earns its keep by ruling things out; the one that did not pass"
note "told us everything. An EndpointSlice with zero addresses means the"
note "selector matched no Pod — nothing else produces it — and"
note "'kubectl get pods --selector=<the Service's own selector>' turns that"
note "inference into the two labels that differ."
note ""
note "The last step is the distinction to carry into an exam or an outage. An"
note "EMPTY slice is a labelling bug: a typo, a Deployment whose template labels"
note "drifted from the Service, a Service pointed at the wrong namespace. An"
note "UNREADY endpoint is an application or probe problem: the address is right"
note "there in the slice, marked ready:false, and kube-proxy is declining to"
note "send it traffic on purpose. 'The Service has no endpoints' and 'the"
note "Service has no READY endpoints' are different sentences, and they send you"
note "to opposite ends of the cluster."
