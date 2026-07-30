#!/usr/bin/env bash
LAB="dns-endpointslices"
source "$(dirname "$0")/../../cluster/lib.sh"
require_cluster
ns_setup

# CLEANUP: every object this lab creates is namespaced — the Deployment and its
# Pods, the client Pod, the Service, and the EndpointSlice the control plane
# derives from that Service. Deleting $NS removes all of it, so the trap that
# ns_setup installed is a complete teardown and no extra trap is needed. The lab
# creates nothing cluster-scoped, creates no second namespace, cordons/taints/
# labels no node, and writes no file onto a node. The only two things it touches
# outside $NS are reads: the kube-dns Service in kube-system and the kubernetes
# Service in default, both `get` only.

# --- small readers, so the assertions below stay one line each -------------
lines()     { printf '%s\n' "$1" | grep -c . || true; }
show()      { printf '%s\n' "$1" | while IFS= read -r _l; do note "$_l"; done; }
pod_names() { k -n "$NS" get pods -l app=web -o jsonpath='{.items[*].metadata.name}' | tr ' ' '\n' | sort; }
pod_ips()   { k -n "$NS" get pods -l app=web -o jsonpath='{.items[*].status.podIP}'   | tr ' ' '\n' | sort; }

# Every EndpointSlice reader goes through the label the control plane puts on
# the slice, because slice *names* are generated and a Service may own several.
slice()      { k -n "$NS" get endpointslice -l kubernetes.io/service-name=web "$@"; }
ep_addrs()   { slice -o jsonpath='{.items[*].endpoints[*].addresses[*]}' | tr ' ' '\n' | sort; }
ep_total()   { ep_addrs | grep -c . || true; }
ep_ready()   { slice -o jsonpath='{.items[*].endpoints[*].conditions.ready}' | tr ' ' '\n' | grep -c '^true$'  || true; }
ep_unready() { slice -o jsonpath='{.items[*].endpoints[*].conditions.ready}' | tr ' ' '\n' | grep -c '^false$' || true; }
ep_table()   { slice -o jsonpath='{range .items[*].endpoints[*]}{.addresses[0]}{"  "}{.targetRef.name}{"  ready="}{.conditions.ready}{"  serving="}{.conditions.serving}{"\n"}{end}'; }
ep_unready_names() {
  slice -o jsonpath='{range .items[*].endpoints[*]}{.conditions.ready}{" "}{.targetRef.name}{"\n"}{end}' \
    | awk '$1 == "false" { print $2 }' | sort
}

# Pull every IPv4 literal out of an nslookup answer, minus the resolver's own
# address, which nslookup echoes back in its "Server:"/"Address:" header. Exact
# line matching everywhere below, never substrings: 10.96.0.1 is a substring of
# 10.96.0.10, and a `case` glob would happily confuse the two.
addrs_of() {
  printf '%s\n' "$1" \
    | grep -oE '([0-9]{1,3}\.){3}[0-9]{1,3}' \
    | grep -vxF "${DNS_SVC_IP:-0.0.0.0}" | sort -u || true
}

step "A three-replica backend, a Service in front of it, and a client Pod"
apply backend.yaml
apply service.yaml
apply client.yaml
if ! run k -n "$NS" rollout status deployment/web --timeout=300s; then
  fail "the backend Deployment never became ready"
fi
run k -n "$NS" wait --for=condition=Ready pod/client --timeout=180s
assert_eq "$(lines "$(pod_names)")" "3" "three backend Pods are Running and Ready"
run k -n "$NS" get svc web
CIP="$(k -n "$NS" get svc web -o jsonpath='{.spec.clusterIP}')"
if [ -z "$CIP" ] || [ "$CIP" = "None" ]; then fail "the web Service was allocated no clusterIP"; fi
ok "the Service was allocated clusterIP $CIP"
note "each backend answers GET /hostname with its own hostname, which for a"
note "Pod is the Pod's name, so every reply below is signed by its server"
note "readiness is an exec probe over 'test -s /tmp/ready' — a file each"
note "container writes at startup and that we can truncate on demand"
note "the client is labelled app=client, so it never becomes an endpoint of"
note "the Service it is about to inspect"

step "What the kubelet wrote into the client's /etc/resolv.conf"
DNS_SVC_IP="$(k -n kube-system get svc kube-dns -o jsonpath='{.spec.clusterIP}' 2>/dev/null || true)"
if [ -z "$DNS_SVC_IP" ]; then
  fail "no kube-dns Service in kube-system — this cluster has no cluster DNS, so the lab would prove nothing"
fi
note "\$ cat /etc/resolv.conf"
RESOLV="$(k -n "$NS" exec client -c shell -- cat /etc/resolv.conf)"
show "$RESOLV"
NAMESERVER="$(printf '%s\n' "$RESOLV" | awk '/^nameserver/ { print $2; exit }')"
assert_eq "$NAMESERVER" "$DNS_SVC_IP" \
  "the Pod's nameserver is the clusterIP of the kube-dns Service in kube-system"
assert_eq "$(printf '%s\n' "$RESOLV" | grep -c '^nameserver' || true)" "1" \
  "there is exactly one nameserver line: all of this Pod's DNS goes to CoreDNS"
assert_eq "$(printf '%s\n' "$RESOLV" | awk '/^search/ { print $2, $3, $4; exit }')" \
          "$NS.svc.cluster.local svc.cluster.local cluster.local" \
  "the search list starts with the three cluster domains, narrowest first"
assert_contains "$RESOLV" "ndots:5" \
  "options ndots:5 — a name with fewer than five dots is tried against the search list before being tried as-is"
RESOLV_DNS="$(k -n "$NS" exec client -c dns -- cat /etc/resolv.conf)"
assert_eq "$RESOLV_DNS" "$RESOLV" \
  "the other container in the Pod reads a byte-identical file: resolv.conf is per Pod, not per container"
note "nothing in the Pod spec asked for any of this. dnsPolicy defaults to"
note "ClusterFirst, and the kubelet synthesises this file from the cluster DNS"
note "Service address and the Pod's own namespace"

step "The fully qualified name resolves to the Service's clusterIP"
FQDN="web.$NS.svc.cluster.local"
note "\$ nslookup $FQDN"
LOOKUP_FQDN="$(k -n "$NS" exec client -c dns -- nslookup "$FQDN" 2>&1 || true)"
show "$LOOKUP_FQDN"
FQDN_ADDRS="$(addrs_of "$LOOKUP_FQDN")"
assert_eq "$(lines "$FQDN_ADDRS")" "1" "the name resolves to exactly one address"
assert_eq "$FQDN_ADDRS" "$CIP" "and it is the Service's clusterIP, not any Pod's"
if pod_ips | grep -qxF "$CIP"; then fail "the clusterIP is one of the Pod IPs"; fi
ok "no backend address appears in the answer — the record names the Service"
LOOKUP_ABS="$(k -n "$NS" exec client -c dns -- nslookup "$FQDN." 2>&1 || true)"
assert_eq "$(addrs_of "$LOOKUP_ABS")" "$CIP" "the same name with a trailing dot gives the same answer"
note "the trailing dot is not decoration: $FQDN has four"
note "dots, fewer than ndots:5, so the resolver first tries it with each search"
note "domain appended and only then as written — four wasted queries. Ending"
note "the name with a dot marks it absolute and asks exactly once"

step "Short names work because of the search list"
note "\$ nslookup web"
LOOKUP_SHORT="$(k -n "$NS" exec client -c dns -- nslookup web 2>&1 || true)"
show "$LOOKUP_SHORT"
assert_eq "$(addrs_of "$LOOKUP_SHORT")" "$CIP" \
  "the bare name 'web' resolves to the same clusterIP, completed by search domain $NS.svc.cluster.local"
LOOKUP_NSFORM="$(k -n "$NS" exec client -c dns -- nslookup "web.$NS" 2>&1 || true)"
assert_eq "$(addrs_of "$LOOKUP_NSFORM")" "$CIP" \
  "so does 'web.$NS' — the second search domain completes that one"
assert_eventually_contains 90 "web-" "wget http://web/hostname resolves and answers" \
  k -n "$NS" exec client -c shell -- wget -q -O - -T 5 http://web/hostname
HOST="$(k -n "$NS" exec client -c shell -- wget -q -O - -T 5 http://web/hostname 2>&1 || true)"
if ! pod_names | grep -qxF "$HOST"; then
  fail "http://web/hostname did not return a backend Pod name, got: $HOST"
fi
ok "backend $HOST answered, reached through the short name and the Service's port 80"
K8S_CIP="$(k -n default get svc kubernetes -o jsonpath='{.spec.clusterIP}')"
LOOKUP_API="$(k -n "$NS" exec client -c dns -- nslookup kubernetes.default.svc.cluster.local 2>&1 || true)"
API_ADDRS="$(addrs_of "$LOOKUP_API")"
if ! printf '%s\n' "$API_ADDRS" | grep -qxF "$K8S_CIP"; then
  fail "kubernetes.default.svc.cluster.local did not resolve to $K8S_CIP; answer was: $LOOKUP_API"
fi
ok "kubernetes.default.svc.cluster.local resolves to $K8S_CIP, a Service in another namespace"
LOOKUP_BARE="$(k -n "$NS" exec client -c dns -- nslookup kubernetes 2>&1 || true)"
BARE_ADDRS="$(addrs_of "$LOOKUP_BARE")"
if printf '%s\n' "$BARE_ADDRS" | grep -qxF "$K8S_CIP"; then
  fail "the bare name 'kubernetes' unexpectedly resolved to $K8S_CIP"
fi
ok "the bare name 'kubernetes' does not reach it: no search domain completes it to namespace default"
note "short names are a namespace-local convenience, nothing more. Cross"
note "namespace you must qualify — <svc>.<ns>, or the full <svc>.<ns>.svc.cluster.local"

step "The EndpointSlice behind the Service"
assert_eventually 120 "3" "the slice reports three ready endpoints" ep_ready
run k -n "$NS" get endpointslices -l kubernetes.io/service-name=web
SLICE_NAMES="$(slice -o jsonpath='{.items[*].metadata.name}')"
assert_eq "$(printf '%s' "$SLICE_NAMES" | wc -w | tr -d ' ')" "1" \
  "one slice covers this Service — the control plane splits at 100 endpoints per slice"
case "$SLICE_NAMES" in
  web-*) ok "its name, $SLICE_NAMES, is generated from the Service name plus a random suffix" ;;
  *)     fail "expected a slice name beginning 'web-', got '$SLICE_NAMES'" ;;
esac
assert_eq "$(slice -o jsonpath='{.items[0].addressType}')" "IPv4" \
  "its addressType is IPv4 — one slice carries one address family"
assert_eq "$(slice -o jsonpath='{.items[0].ports[0].port}')" "8080" \
  "its port is 8080: the Service's named targetPort 'http' was resolved to a number"
assert_eq "$(slice -o jsonpath='{.items[0].metadata.ownerReferences[0].kind}/{.items[0].metadata.ownerReferences[0].name}')" \
          "Service/web" \
  "it is owned by the Service, so deleting the Service garbage-collects the slice"
assert_eq "$(ep_total)" "3" "it lists three addresses"
assert_eq "$(ep_addrs | tr '\n' ' ')" "$(pod_ips | tr '\n' ' ')" "and they are exactly the three Pod IPs"
show "$(ep_table)"
note "the Service object stores a selector and never a list of Pods. This slice"
note "is derived state: the endpointslice controller rewrites it whenever a"
note "matching Pod appears, changes readiness, or goes away, and kube-proxy on"
note "every node watches it to decide where packets to $CIP may go"

step "Break one Pod's readiness"
BROKEN="$(pod_names | head -1)"
BROKEN_IP="$(k -n "$NS" get pod "$BROKEN" -o jsonpath='{.status.podIP}')"
note "truncating /tmp/ready inside $BROKEN ($BROKEN_IP), which is what its"
note "readiness probe tests. The HTTP server itself keeps running untouched."
# Not `run`, because run echoes its arguments unquoted and the redirect inside
# the remote shell would read as a redirect of kubectl's own output.
note "\$ kubectl exec $BROKEN -- sh -c ': > /tmp/ready'"
k -n "$NS" exec "$BROKEN" -- sh -c ': > /tmp/ready'
pod_ready() { k -n "$NS" get pod "$BROKEN" -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}'; }
assert_eventually 120 "False" "$BROKEN's Ready condition flipped to False" pod_ready
run k -n "$NS" get pods -l app=web
assert_eq "$(k -n "$NS" get pod "$BROKEN" -o jsonpath='{.status.phase}')" "Running" \
  "the Pod is still Running: it was never evicted, deleted, or rescheduled"
assert_eq "$(k -n "$NS" get pod "$BROKEN" -o jsonpath='{.status.containerStatuses[0].restartCount}')" "0" \
  "and its container was not restarted — a failing readiness probe never restarts anything, only a liveness probe does"

step "The unready endpoint stays in the slice, marked ready:false"
assert_eventually 120 "1" "the slice reports exactly one endpoint with conditions.ready == false" ep_unready
assert_eq "$(ep_total)" "3" "the slice still lists three addresses — the unready endpoint did not vanish"
assert_eq "$(ep_ready)" "2" "two of the three are ready"
if ! ep_addrs | grep -qxF "$BROKEN_IP"; then
  fail "$BROKEN's address $BROKEN_IP disappeared from the slice"
fi
ok "$BROKEN_IP is still listed"
assert_eq "$(ep_unready_names)" "$BROKEN" "the not-ready endpoint is exactly the Pod whose probe we broke"
show "$(ep_table)"
run k -n "$NS" get endpointslices -l kubernetes.io/service-name=web
note "this is the point of the lab. Readiness does not remove an address from"
note "the slice; it flips a condition on an entry that stays where it was."
note "The ENDPOINTS column above still shows three IPs, and 'get endpointslice'"
note "with no -o flag will not tell you which of them are usable. Reading"
note "conditions.ready is the difference between 'the Service has endpoints'"
note "and 'the Service has endpoints that will be sent traffic'."

step "kube-proxy skips it"
probe12() {
  k -n "$NS" exec client -c shell -- sh -c '
for i in 1 2 3 4 5 6 7 8 9 10 11 12; do
  wget -q -O - -T 5 http://web/hostname || printf REQUEST-FAILED
  echo
done'
}
# grep -c, never grep -q, on this pipeline: -q exits at the first match and
# would SIGPIPE the still-streaming kubectl, which pipefail turns into a
# spurious failure.
broken_hits() { probe12 | grep -cxF "$BROKEN" || true; }
assert_eventually 90 "0" "twelve requests through the Service and none reached $BROKEN" broken_hits
REQS="$(probe12)"
assert_eq "$(lines "$REQS")" "12" "all twelve requests returned a body"
assert_not_contains "$REQS" "REQUEST-FAILED" "none of them failed"
note "which backend served each request:"
printf '%s\n' "$REQS" | sort | uniq -c | while read -r _n _h; do note "  $_n x $_h"; done
note "the unready Pod is still listening on 8080 and would have answered"
note "happily; kube-proxy simply wrote no rule pointing at it"

step "Restore the file and the endpoint comes back"
note "\$ kubectl exec $BROKEN -- sh -c 'echo ok > /tmp/ready'"
k -n "$NS" exec "$BROKEN" -- sh -c 'echo ok > /tmp/ready'
assert_eventually 120 "True" "$BROKEN is Ready again" pod_ready
assert_eventually 120 "3" "the slice reports three ready endpoints again" ep_ready
assert_eq "$(ep_unready)" "0" "and none with ready:false"
assert_eq "$(ep_total)" "3" "still three addresses — the count never changed through any of this"
reached_broken() {
  local n; n="$(probe12 | grep -cxF "$BROKEN" || true)"
  if [ "$n" -gt 0 ]; then echo yes; else echo no; fi
}
assert_eventually 90 "yes" "traffic reaches $BROKEN again" reached_broken
assert_eq "$(k -n "$NS" get svc web -o jsonpath='{.spec.clusterIP}')" "$CIP" \
  "the Service's clusterIP never moved"
LOOKUP_END="$(k -n "$NS" exec client -c dns -- nslookup "$FQDN" 2>&1 || true)"
assert_eq "$(addrs_of "$LOOKUP_END")" "$CIP" \
  "and the DNS answer is unchanged: backends came and went without the name moving"

step "What this proves"
note "Cluster DNS is a file plus a Service. The kubelet gives every Pod a"
note "/etc/resolv.conf whose single nameserver is the kube-dns Service's"
note "clusterIP and whose search list is <ns>.svc.cluster.local,"
note "svc.cluster.local, cluster.local, with ndots:5. Everything people call"
note "'Kubernetes DNS magic' falls out of those three lines: a short name works"
note "inside its own namespace because the first search domain completes it, a"
note "name from another namespace needs qualifying because no search domain"
note "does, and a fully qualified name still costs several queries unless you"
note "end it with a dot. A Service's A record answers with the clusterIP and"
note "nothing else, which is why the name survives every backend churning"
note "underneath it."
note ""
note "The EndpointSlice is where the backends actually live, and it is derived"
note "state: a label selector turned into addresses, each carrying ready,"
note "serving and terminating conditions, owned by the Service and labelled"
note "kubernetes.io/service-name so you can find it. Readiness is a condition"
note "on an entry, not membership in the list. Breaking one Pod's probe left"
note "three addresses in the slice with one marked ready:false; kube-proxy"
note "programmed rules for the other two and twelve requests confirmed it, and"
note "restoring the file put the endpoint back with no object edited by hand."
note ""
note "That is the debugging lesson worth keeping. 'The Service has endpoints'"
note "is not the same claim as 'the Service has ready endpoints', and the"
note "default kubectl output shows you the first while the outage is caused by"
note "the second."
