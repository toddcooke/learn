#!/usr/bin/env bash
LAB="service-nodeport-loadbalancer"
source "$(dirname "$0")/../../cluster/lib.sh"
require_cluster
ns_setup

# Cleanup: everything this lab creates is namespaced — one Deployment, one client
# Pod and two Services — so ns_setup's own trap is all that is needed and no
# replacement trap is installed. The one cluster-wide resource a Service consumes
# is a node-port reservation, and the apiserver frees that when the Service is
# deleted with the namespace. Neither Service pins a fixed nodePort, deliberately,
# so even a namespace deliberately kept with KEEP=1 cannot collide with a port a
# later lab wants.

# --- readers ---------------------------------------------------------------
# Every node's name and InternalIP, one "name ip" pair per line.
node_ips()   { k get nodes -o jsonpath='{range .items[*]}{.metadata.name}{" "}{.status.addresses[?(@.type=="InternalIP")].address}{"\n"}{end}'; }
node_port()  { k -n "$NS" get svc "$1" -o jsonpath='{.spec.ports[0].nodePort}'; }
cluster_ip() { k -n "$NS" get svc "$1" -o jsonpath='{.spec.clusterIP}'; }
lb_ingress() { k -n "$NS" get svc web-lb -o jsonpath='{.status.loadBalancer.ingress}'; }
endpoints_of() { k -n "$NS" get endpointslices -l "kubernetes.io/service-name=$1" \
                   -o jsonpath='{.items[*].endpoints[*].targetRef.name}'; }

# One HTTP GET from inside the cluster: prints the serving Pod's hostname on
# success and nothing at all on failure. Written to be fed to assert_eventually,
# because a brand-new node port is not instantaneous — kube-proxy on every node
# has to observe the Service and program its rules first, and polling for that is
# honest where a fixed sleep would be a guess.
hit() { k -n "$NS" exec client -- wget -q -T 5 -O - "http://$1:$2/hostname" 2>/dev/null; }

step "One backend Pod, and a client to probe it from"
apply web.yaml
run k -n "$NS" rollout status deploy/web --timeout=180s
run k -n "$NS" wait --for=condition=Ready pod/client --timeout=180s
REPLICAS="$(k -n "$NS" get pods -l app=web --no-headers | wc -l | tr -d '[:space:]')"
assert_eq "$REPLICAS" "1" "there is exactly one backend Pod"
BACKEND="$(k -n "$NS" get pods -l app=web -o jsonpath='{.items[0].metadata.name}')"
BACKEND_NODE="$(k -n "$NS" get pod "$BACKEND" -o jsonpath='{.spec.nodeName}')"
run k -n "$NS" get pods -o wide
note "the whole application is one Pod, $BACKEND, running on one node, $BACKEND_NODE."
note "keep that in mind: two of this cluster's three nodes host no copy of it."

step "Expose it with a NodePort Service"
apply nodeport-service.yaml
run k -n "$NS" get svc web-nodeport
assert_eventually_contains 90 "$BACKEND" \
  "the Service's EndpointSlice resolved to $BACKEND" endpoints_of web-nodeport

NODEPORT="$(node_port web-nodeport)"
IN_RANGE=no
if [ "$NODEPORT" -ge 30000 ] && [ "$NODEPORT" -le 32767 ]; then IN_RANGE=yes; fi
assert_eq "$IN_RANGE" "yes" \
  "the apiserver allocated nodePort $NODEPORT, numerically inside 30000-32767"

CLUSTER_IP="$(cluster_ip web-nodeport)"
HAS_CIP=no
case "$CLUSTER_IP" in ""|None) ;; *) HAS_CIP=yes ;; esac
assert_eq "$HAS_CIP" "yes" \
  "it was also given a ClusterIP ($CLUSTER_IP) — NodePort is ClusterIP plus a node port"
note "we never wrote a nodePort in the manifest. The number above was chosen for"
note "us, which is the only way to see what the allocator's window actually is."

step "The range is a rule the apiserver enforces, not a number we got lucky with"
# out-of-range.yaml asks for nodePort 39999. Under set -e a failing apply would
# abort the script, so the failure has to be caught and then asserted on.
if OUT="$(k -n "$NS" apply -f "$LAB_DIR/out-of-range.yaml" 2>&1)"; then
  fail "the apiserver accepted nodePort 39999 — expected a validation error"
fi
note "$OUT"
assert_contains "$OUT" "not in the valid range" \
  "the apiserver refused nodePort 39999 outright"
assert_contains "$OUT" "30000-32767" \
  "...and named the exact range it will allocate from"
note "39999 is a perfectly legal TCP port, so nothing was malformed. The refusal"
note "came from the node-port allocator, which owns a fixed window and hands out"
note "reservations from it. Widening that window is an apiserver flag,"
note "--service-node-port-range, not something a Service manifest may ask for."

step "Every node answers on that port — including the ones running nothing"
TESTED=0
OFF_BACKEND=0
OTHER_NODE=""; OTHER_IP=""
while read -r NAME IP; do
  [ -n "$IP" ] || continue
  assert_eventually 120 "$BACKEND" \
    "$NAME ($IP:$NODEPORT) served the request, and $BACKEND answered it" \
    hit "$IP" "$NODEPORT"
  TESTED=$((TESTED + 1))
  if [ "$NAME" != "$BACKEND_NODE" ]; then
    OFF_BACKEND=$((OFF_BACKEND + 1))
    if [ -z "$OTHER_IP" ]; then OTHER_NODE="$NAME"; OTHER_IP="$IP"; fi
  fi
done <<< "$(node_ips)"

ENOUGH=no
if [ "$TESTED" -ge 2 ]; then ENOUGH=yes; fi
assert_eq "$ENOUGH" "yes" "$TESTED distinct node IPs were probed, and every one of them worked"
SPREAD=no
if [ "$OFF_BACKEND" -ge 1 ]; then SPREAD=yes; fi
assert_eq "$SPREAD" "yes" \
  "$OFF_BACKEND of them ($OTHER_NODE among them) host no backend Pod at all"

if ! SHOWN="$(k -n "$NS" exec client -- wget -q -T 5 -O - "http://$OTHER_IP:$NODEPORT/hostname" 2>&1)"; then
  fail "a repeat request to $OTHER_IP:$NODEPORT failed: $SHOWN"
fi
note "\$ wget -q -O - http://$OTHER_IP:$NODEPORT/hostname   ->  $SHOWN"
note "$OTHER_NODE received that request and forwarded it to $BACKEND_NODE. A node"
note "port is opened by kube-proxy on every node in the cluster, whether or not"
note "that node has an endpoint locally; when it does not, it DNATs the packet to"
note "a node that does. That is what makes a NodePort a stable address: you may"
note "aim at any node, and rescheduling the Pod does not change where you aim."

step "The same Service is still an ordinary ClusterIP Service"
assert_eventually 60 "$BACKEND" \
  "$CLUSTER_IP:80 answers from inside the cluster too" hit "$CLUSTER_IP" 80
note "NodePort did not replace the ClusterIP, it added to it. In-cluster callers"
note "keep using the ClusterIP (and the DNS name); the node port exists only for"
note "traffic that starts outside."

step "Now a LoadBalancer Service over the very same Pods"
apply lb-service.yaml
run k -n "$NS" get svc web-lb
TYPE="$(k -n "$NS" get svc web-lb -o jsonpath='{.spec.type}')"
assert_eq "$TYPE" "LoadBalancer" "web-lb was accepted as type LoadBalancer"

LB_NODEPORT="$(node_port web-lb)"
LB_IN_RANGE=no
if [ "$LB_NODEPORT" -ge 30000 ] && [ "$LB_NODEPORT" -le 32767 ]; then LB_IN_RANGE=yes; fi
assert_eq "$LB_IN_RANGE" "yes" \
  "it was allocated a node port of its own, $LB_NODEPORT, from the same range"
DISTINCT=no
if [ "$LB_NODEPORT" != "$NODEPORT" ]; then DISTINCT=yes; fi
assert_eq "$DISTINCT" "yes" \
  "and it differs from web-nodeport's $NODEPORT — a node port is exclusive cluster-wide"
LB_CIP="$(cluster_ip web-lb)"
note "type LoadBalancer is a superset of type NodePort, which is itself a superset"
note "of ClusterIP. web-lb therefore already has all three: ClusterIP $LB_CIP,"
note "node port $LB_NODEPORT, and a request for an external address."

step "The external address never arrives"
GET="$(k -n "$NS" get svc web-lb)"
assert_contains "$GET" "<pending>" "the EXTERNAL-IP column reads <pending>"
note "watching .status.loadBalancer.ingress for 30 seconds — this is the one"
note "assertion in the lab that can only be made by waiting, because what is"
note "being proved is that nothing happens..."
DEADLINE=$((SECONDS + 30))
while [ "$SECONDS" -lt "$DEADLINE" ]; do
  CUR="$(lb_ingress)"
  if [ -n "$CUR" ]; then
    fail "an ingress address appeared ('$CUR') — something is reconciling LoadBalancer Services on this cluster, which a plain kind cluster does not do"
  fi
  sleep 3
done
assert_eq "$(lb_ingress)" "" "after 30s .status.loadBalancer.ingress is still entirely empty"
note "empty, not zero-valued and not error-valued. No controller has written to"
note "this Service's status at all."

step "Why: nothing in this cluster is listening for that request"
run k -n "$NS" describe svc web-lb
DESC="$(k -n "$NS" describe svc web-lb)"
assert_contains "$DESC" "Type:" "describe prints the Service's type line"
assert_not_contains "$DESC" "LoadBalancer Ingress" \
  "there is no 'LoadBalancer Ingress:' line, because the status field it prints is empty"
assert_contains "$DESC" "NodePort:" \
  "describe does list a NodePort — the LoadBalancer type is built on top of it"

EVENTS="$(k -n "$NS" get events --field-selector involvedObject.name=web-lb \
  -o jsonpath='{range .items[*]}{.reason}{"\n"}{end}')"
assert_eq "$EVENTS" "" "not one event has ever been recorded against web-lb"
assert_not_contains "$DESC" "EnsuringLoadBalancer" \
  "in particular there is no EnsuringLoadBalancer event"
note "on a cloud, a service controller would have posted EnsuringLoadBalancer"
note "within a second or two, then EnsuredLoadBalancer when the appliance came up."
note "Silence is the diagnosis: no controller ever claimed this object."

CCM="$(k -n kube-system get pods --no-headers -o custom-columns=NAME:.metadata.name 2>/dev/null \
  | grep -c cloud-controller-manager || true)"
assert_eq "$CCM" "0" "and there is no cloud-controller-manager Pod in kube-system to be that controller"
note "the LoadBalancer type is the one Service type Kubernetes cannot implement by"
note "itself. ClusterIP and NodePort are kube-proxy rules on nodes Kubernetes"
note "already owns; an external load balancer is a machine somebody else has to"
note "build, so the API can only record the request and wait."

step "<pending> is not broken — the Service routes traffic right now"
assert_eventually 120 "$BACKEND" \
  "web-lb's own node port answers on $OTHER_NODE ($OTHER_IP:$LB_NODEPORT)" \
  hit "$OTHER_IP" "$LB_NODEPORT"
assert_eventually 60 "$BACKEND" \
  "and its ClusterIP $LB_CIP:80 answers from inside the cluster" hit "$LB_CIP" 80
note "this is the part that is easy to get wrong under exam pressure: a"
note "LoadBalancer Service stuck at <pending> is fully functional on both of the"
note "layers below it. Only the external address is missing."

step "What this proves"
note "A NodePort Service reserves one port, from the apiserver's"
note "--service-node-port-range (30000-32767 by default), and opens it on every"
note "node in the cluster. Not on the node running the Pod — on every node. This"
note "run proved that with a single replica on $BACKEND_NODE and $TESTED node IPs"
note "answering identically, $OFF_BACKEND of them hosting nothing whatsoever. The"
note "node that receives the packet forwards it to one that has an endpoint, which"
note "is why the address survives rescheduling and why the port has to be"
note "cluster-wide and exclusive: web-lb could not reuse $NODEPORT."
note ""
note "The range is not advice. The apiserver refused nodePort 39999 and quoted"
note "30000-32767 back at us. It is a window chosen to sit above the ephemeral"
note "port range on a typical node, and it is an apiserver flag — a Service"
note "manifest may pick a port inside it, never move it."
note ""
note "The three Service types nest. ClusterIP gets a virtual IP; NodePort adds a"
note "port on every node; LoadBalancer adds a request for an external address on"
note "top of that. web-lb demonstrated all three layers at once, and this is why"
note "the LoadBalancer entry stayed usable while its top layer never materialised."
note ""
note "That top layer is the only one Kubernetes cannot build for itself. On kind"
note "there is no cloud-controller-manager, so EXTERNAL-IP is <pending>, status is"
note "empty, and describe shows no events at all — not a failure event, none. That"
note "is the correct and expected outcome here, not a broken cluster. Diagnose the"
note "real version of this in the field the same way: check whether a cloud"
note "controller exists, then read the Service's events. A pending Service with"
note "SyncLoadBalancerFailed events is a quota or subnet problem; a pending Service"
note "with no events at all means nobody is listening."
