#!/usr/bin/env bash
LAB="service-clusterip"
source "$(dirname "$0")/../../cluster/lib.sh"
require_cluster
ns_setup

# Everything this lab creates — the Deployment, its Pods, the client Pod, both
# Services, and the EndpointSlices the endpoints controller derives from them —
# is namespaced. Deleting the namespace is therefore a complete cleanup, and the
# trap ns_setup installed is all this lab needs. Nothing cluster-scoped is
# touched, no node is modified, and no file is written onto a node.

# --- small readers, so the assertions below stay one line each -------------
pod_names() { k -n "$NS" get pods -l app=web -o jsonpath='{.items[*].metadata.name}' | tr ' ' '\n' | sort; }
pod_ips()   { k -n "$NS" get pods -l app=web -o jsonpath='{.items[*].status.podIP}'   | tr ' ' '\n' | sort; }
svc_ports() { k -n "$NS" get svc "$1" -o jsonpath='{.spec.ports[0].port}->{.spec.ports[0].targetPort}'; }
ep_addrs()  { k -n "$NS" get endpointslice -l "kubernetes.io/service-name=$1" -o jsonpath='{.items[*].endpoints[*].addresses[*]}' | tr ' ' '\n' | sort; }
ep_ports()  { k -n "$NS" get endpointslice -l "kubernetes.io/service-name=$1" -o jsonpath='{.items[*].ports[*].port}'; }
ep_ready()  { k -n "$NS" get endpointslice -l "kubernetes.io/service-name=$1" -o jsonpath='{.items[*].endpoints[*].conditions.ready}' | tr ' ' '\n' | grep -c '^true$' || true; }
lines()     { printf '%s\n' "$1" | grep -c . || true; }
show()      { printf '%s\n' "$1" | while IFS= read -r _l; do note "$_l"; done; }

step "A three-replica backend and a client to poke it with"
apply backend.yaml
apply client.yaml
if ! run k -n "$NS" rollout status deployment/web --timeout=300s; then
  fail "the backend Deployment never became ready"
fi
run k -n "$NS" wait --for=condition=Ready pod/client --timeout=180s
assert_eq "$(lines "$(pod_names)")" "3" "three backend Pods are Running and Ready"
note "each backend answers GET /hostname with its own hostname, which for a"
note "Pod is the Pod's name — so every reply below is signed by its server"
note "the client Pod holds two toolboxes sharing one network namespace:"
note "container 'shell' (busybox) has wget, container 'dns' (agnhost) has"
note "nslookup, and both read the same /etc/resolv.conf"
note "it is labelled app=client, not app=web, so it never becomes an endpoint"
note "of the Services it is about to test"

step "Create the ClusterIP Service and read its virtual IP back"
apply clusterip-service.yaml
run k -n "$NS" get svc web -o wide
assert_eq "$(k -n "$NS" get svc web -o jsonpath='{.spec.type}')" "ClusterIP" \
  "the manifest set no type, and the API server defaulted it to ClusterIP"
CIP="$(k -n "$NS" get svc web -o jsonpath='{.spec.clusterIP}')"
if [ -z "$CIP" ] || [ "$CIP" = "None" ]; then fail "the Service was allocated no clusterIP"; fi
case "$CIP" in
  [0-9]*.[0-9]*.[0-9]*.[0-9]*) ok "it was allocated a clusterIP: $CIP" ;;
  *) fail "clusterIP '$CIP' does not look like an IPv4 address" ;;
esac
if pod_ips | grep -qxF "$CIP"; then fail "the clusterIP is one of the Pod IPs"; fi
ok "$CIP is not any Pod's IP — no network interface anywhere owns it"
assert_eq "$(svc_ports web)" "80->http" \
  "the Service listens on 80 and targets the container port named http"
note "a clusterIP is a rule rather than an address: kube-proxy watches the"
note "Service and programs every node so that packets addressed to it are"
note "rewritten to a backend before they ever leave the client's node"

step "The endpoints controller fills an EndpointSlice from the selector"
assert_eventually 120 "3" "the EndpointSlice for web lists three ready endpoints" ep_ready web
run k -n "$NS" get endpointslice -l kubernetes.io/service-name=web
assert_eq "$(ep_addrs web | tr '\n' ' ')" "$(pod_ips | tr '\n' ' ')" \
  "its addresses are exactly the three Pod IPs"
assert_eq "$(ep_ports web)" "8080" \
  "its port is 8080: the named targetPort 'http' was resolved to a number"
note "the Service object stores a selector and never a list of Pods; this"
note "slice is derived state, recomputed whenever a matching Pod appears,"
note "becomes Ready, or goes away"

step "Fifteen requests through the Service reach more than one Pod"
assert_eventually_contains 90 "web-" "DNS resolves the name 'web' and the first request came back" \
  k -n "$NS" exec client -c shell -- wget -q -O - -T 5 http://web/hostname
REQS="$(k -n "$NS" exec client -c shell -- sh -c '
for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
  wget -q -O - -T 5 http://web/hostname || printf REQUEST-FAILED
  echo
done')"
assert_eq "$(lines "$REQS")" "15" "all fifteen requests returned a body"
assert_not_contains "$REQS" "REQUEST-FAILED" "none of them failed"
note "which backend served each request:"
printf '%s\n' "$REQS" | sort | uniq -c | while read -r _n _h; do note "  $_n x $_h"; done
DISTINCT="$(lines "$(printf '%s\n' "$REQS" | sort -u)")"
if [ "$DISTINCT" -lt 2 ]; then
  fail "all fifteen replies came from one Pod — no load balancing happened"
fi
ok "$DISTINCT distinct backend hostnames across fifteen requests"
for _h in $(printf '%s\n' "$REQS" | sort -u); do
  if ! pod_names | grep -qxF "$_h"; then fail "'$_h' is not a Pod of the web Deployment"; fi
done
ok "every hostname returned belongs to a Pod the Service selects"
RAW="$(k -n "$NS" exec client -c shell -- wget -q -O - -T 5 "http://$CIP:80/hostname" 2>&1 || true)"
if ! pod_names | grep -qxF "$RAW"; then
  fail "the bare clusterIP did not serve a backend, got: $RAW"
fi
ok "the bare clusterIP $CIP:80 works too — $RAW answered, with no DNS involved"
note "each wget opens a fresh TCP connection and kube-proxy picks a backend"
note "per connection, so this is per-connection balancing, not per-request:"
note "a client that holds one keep-alive connection open stays on one Pod"

step "Create the headless Service: the same spec, minus the virtual IP"
apply headless-service.yaml
run k -n "$NS" get svc
assert_eq "$(k -n "$NS" get svc web-headless -o jsonpath='{.spec.clusterIP}')" "None" \
  "web-headless reports clusterIP None — the allocator was never asked"
assert_eq "$(k -n "$NS" get svc web-headless -o jsonpath='{.spec.selector.app}')" \
          "$(k -n "$NS" get svc web -o jsonpath='{.spec.selector.app}')" \
  "it selects exactly the same Pods as the ClusterIP Service"
assert_eq "$(svc_ports web-headless)" "$(svc_ports web)" \
  "and declares exactly the same ports, 80->http"
assert_eventually 120 "3" "it still gets an EndpointSlice, with three ready endpoints" ep_ready web-headless
note "headless does not mean endpoint-less: the slice is what CoreDNS reads"
if PATCHED="$(k -n "$NS" patch svc web-headless -p '{"spec":{"clusterIP":"10.96.0.99"}}' 2>&1)"; then
  fail "expected the API server to refuse a clusterIP on a headless Service, but the patch succeeded"
fi
ok "the API server rejected an attempt to give it a clusterIP after the fact"
show "$PATCHED"
assert_eq "$(k -n "$NS" get svc web-headless -o jsonpath='{.spec.clusterIP}')" "None" \
  "it is still headless"
note "spec.clusterIP is immutable, so headless is a decision made at creation"
note "time: converting a Service either way means deleting and recreating it"

step "DNS is where the two Services stop looking alike"
DNS_IP="$(k -n "$NS" exec client -c shell -- cat /etc/resolv.conf 2>/dev/null | awk '/^nameserver/ {print $2; exit}' || true)"
if [ -z "$DNS_IP" ]; then fail "could not read the client's nameserver from /etc/resolv.conf"; fi
note "the client's resolver is CoreDNS at $DNS_IP"
# Pull every IPv4 literal out of an nslookup answer, minus the resolver's own
# address, which nslookup echoes back in its "Server:"/"Address:" header.
addrs_of() { printf '%s\n' "$1" | grep -oE '([0-9]{1,3}\.){3}[0-9]{1,3}' | grep -vxF "$DNS_IP" | sort -u || true; }

note "\$ nslookup web.$NS.svc.cluster.local"
LOOKUP_SVC="$(k -n "$NS" exec client -c dns -- nslookup "web.$NS.svc.cluster.local" 2>&1 || true)"
show "$LOOKUP_SVC"
SVC_ADDRS="$(addrs_of "$LOOKUP_SVC")"
assert_eq "$(lines "$SVC_ADDRS")" "1" "the ClusterIP Service name resolves to exactly one address"
assert_eq "$SVC_ADDRS" "$CIP" "and that address is its clusterIP, not any Pod's"

note "\$ nslookup web-headless.$NS.svc.cluster.local"
LOOKUP_HL="$(k -n "$NS" exec client -c dns -- nslookup "web-headless.$NS.svc.cluster.local" 2>&1 || true)"
show "$LOOKUP_HL"
HL_ADDRS="$(addrs_of "$LOOKUP_HL")"
assert_eq "$(lines "$HL_ADDRS")" "3" "the headless Service name resolves to three addresses"
assert_eq "$(printf '%s\n' "$HL_ADDRS" | tr '\n' ' ')" "$(pod_ips | tr '\n' ' ')" \
  "and they are exactly the three Pod IPs"
if printf '%s\n' "$HL_ADDRS" | grep -qxF "$CIP"; then
  fail "the headless answer contained the other Service's clusterIP"
fi
ok "no virtual IP appears anywhere in the headless answer"
note "one naming scheme, two very different answers: a stable address that"
note "hides the Pods, or the Pods themselves with nothing standing in front"

step "Nothing proxies for a headless Service"
HL="$(k -n "$NS" exec client -c shell -- wget -q -O - -T 5 http://web-headless:8080/hostname 2>&1 || true)"
if ! pod_names | grep -qxF "$HL"; then
  fail "expected a Pod hostname from web-headless:8080, got: $HL"
fi
ok "web-headless:8080 answered from Pod $HL — the client dialled a Pod IP directly"
if BAD="$(k -n "$NS" exec client -c shell -- wget -q -O - -T 5 http://web-headless:80/hostname 2>&1)"; then
  fail "expected web-headless:80 to be refused, but it returned: $BAD"
fi
ok "web-headless:80 is refused, even though the Service declares port 80"
show "$BAD"
assert_eq "$(svc_ports web-headless)" "80->http" "the headless Service really does declare 80->http"
note "the ClusterIP Service, with a byte-for-byte identical ports block,"
note "answered on 80 in step 4. The difference is that kube-proxy was there to"
note "rewrite 80 into 8080. With no proxy in the path, the ports block cannot"
note "translate anything, and the client lands on a Pod listening only on 8080"

step "The endpoint set follows the selector, live"
run k -n "$NS" scale deployment/web --replicas=4
if ! run k -n "$NS" rollout status deployment/web --timeout=300s; then
  fail "scaling the Deployment to four replicas never completed"
fi
assert_eventually 120 "4" "the ClusterIP Service's EndpointSlice now lists four ready endpoints" ep_ready web
assert_eventually 120 "4" "and so does the headless Service's" ep_ready web-headless
assert_eq "$(k -n "$NS" get svc web -o jsonpath='{.spec.clusterIP}')" "$CIP" \
  "the clusterIP is unchanged at $CIP"
note "neither Service was edited. A new Pod matching the selector was enough,"
note "which is the entire point: clients keep one name and one address while"
note "the Pods behind it are created, replaced, and destroyed"
note "the DNS answers catch up within the record TTL, 30 seconds here"

step "What this proves"
note "A ClusterIP Service is two mechanisms bolted together. The first is a"
note "label selector that the endpoints controller keeps turning into an"
note "EndpointSlice: a live list of the addresses of the Ready Pods that match,"
note "with the named targetPort already resolved to a number. The second is a"
note "virtual IP that belongs to no interface anywhere. kube-proxy watches both"
note "objects and programs every node so that a packet sent to that IP and port"
note "is rewritten to one endpoint's IP and port. Load balancing is that"
note "rewrite choosing a backend, once per connection — which is why fifteen"
note "separate wget calls spread themselves across the replicas, and why one"
note "long-lived connection would not."
note ""
note "A headless Service keeps the first mechanism and drops the second."
note "clusterIP: None means no address is allocated and kube-proxy writes no"
note "rules, so CoreDNS answers the Service name with the endpoint IPs"
note "themselves and the client connects to a Pod directly. That is why an"
note "identical ports block behaved differently on the two Services: port 80"
note "worked through the proxy and was refused without it. Reach for headless"
note "when the client needs the individual Pods rather than one of them — a"
note "StatefulSet's stable per-Pod DNS names, a driver that pools a connection"
note "per replica, or a client that wants to do its own balancing."
