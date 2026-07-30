#!/usr/bin/env bash
LAB="ingress"
source "$(dirname "$0")/../../cluster/lib.sh"
require_cluster
require_addon ingress
ns_setup

# Cleanup note: every object this lab creates is namespaced — two ConfigMaps,
# two Deployments, two Services, two Ingresses and a series of throwaway probe
# Pods, all in $NS — so ns_setup's own trap is sufficient and no extra trap is
# installed. The one thing touched outside $NS is a read-only `kubectl exec`
# into the shared ingress-nginx controller to read the config it generated,
# which creates nothing and changes nothing. Probe Pods carry --rm and delete
# themselves; any that outlive a failed run go with the namespace.

# The controller's own Service. Requests are aimed here rather than at
# http://localhost/ so the lab does not depend on host port 80 being free on
# the machine running it: kind maps 80 and 443 into the control-plane node, but
# something else on the host may already own them.
CTRL="ingress-nginx-controller.ingress-nginx.svc.cluster.local"
FOO_HOST="foo.sandbox.example"
BAR_HOST="bar.sandbox.example"

# --- small readers, so the assertions below stay one line each -------------

# Backing addresses for a Service, counted from its EndpointSlices. This
# cluster is single-stack IPv4, so every endpoint contributes exactly one
# address and counting addresses counts endpoints.
svc_endpoints() {
  k -n "$NS" get endpointslices -l "kubernetes.io/service-name=$1" \
    -o jsonpath='{.items[*].endpoints[*].addresses[*]}' | wc -w | tr -d '[:space:]'
}
# An Ingress reports its front door in .status. The field is ip or hostname
# depending on what the controller publishes, so read both and concatenate.
ing_address()   { k -n "$NS" get ingress "$1" -o jsonpath='{.status.loadBalancer.ingress[0].ip}{.status.loadBalancer.ingress[0].hostname}'; }
ing_addressed() { if [ -n "$(ing_address "$1")" ]; then echo yes; else echo no; fi; }
# The nginx.conf the controller generated from the Ingress objects it owns.
ctrl_conf()     { k -n ingress-nginx exec deploy/ingress-nginx-controller -- cat /etc/nginx/nginx.conf 2>&1; }

# One HTTP GET from inside the cluster, through the ingress controller's
# Service:   ingress_get <path> [host-header]
#
# A throwaway Pod per request keeps each probe independent, and the random name
# means a retry can never collide with a Pod a previous attempt left behind.
# Failure is swallowed deliberately: a 404 makes wget exit non-zero, and under
# set -e that would kill the script before any assertion could read the body.
# The assertion wrapping the call is what decides pass or fail.
ingress_get() {
  local path="$1" host="${2:-}" name="probe-$RANDOM$RANDOM"
  if [ -n "$host" ]; then
    k -n "$NS" run "$name" --rm -i --quiet --restart=Never --image=busybox:1.36 \
      --command -- wget -qO- --header "Host: $host" "http://${CTRL}${path}" </dev/null 2>&1 || true
  else
    k -n "$NS" run "$name" --rm -i --quiet --restart=Never --image=busybox:1.36 \
      --command -- wget -qO- "http://${CTRL}${path}" </dev/null 2>&1 || true
  fi
}

step "The IngressClass is the contract between an Ingress and a controller"
run k get ingressclass
CLASS_CTRL="$(k get ingressclass nginx -o jsonpath='{.spec.controller}' 2>/dev/null || true)"
assert_eq "$CLASS_CTRL" "k8s.io/ingress-nginx" \
  "IngressClass/nginx names the controller k8s.io/ingress-nginx"
DEFAULTED="$(k get ingressclass nginx -o jsonpath='{.metadata.annotations.ingressclass\.kubernetes\.io/is-default-class}' 2>/dev/null || true)"
assert_eq "$DEFAULTED" "" "it is NOT annotated as the cluster default"
note "so every Ingress here has to name it explicitly in spec.ingressClassName."
note "An Ingress object is inert data; the IngressClass is how one controller"
note "among possibly several decides that the object belongs to it."

step "Two backends, each behind its own ClusterIP Service"
apply backends.yaml
run k -n "$NS" rollout status deployment/foo --timeout=240s
run k -n "$NS" rollout status deployment/bar --timeout=240s
run k -n "$NS" get svc
assert_eventually 60 "2" "Service foo has 2 backing endpoints" svc_endpoints foo
assert_eventually 60 "2" "Service bar has 2 backing endpoints" svc_endpoints bar
note "no Ingress exists yet, and nothing outside the cluster can reach either"
note "Service: a ClusterIP is reachable from inside the cluster and nowhere else"

step "Create the path-based Ingress: /foo and /bar in one hostless rule"
apply ingress-path.yaml
assert_eq "$(k -n "$NS" get ingress demo -o jsonpath='{.spec.ingressClassName}')" \
  "nginx" "ingress/demo claims ingressClassName: nginx"
assert_eq "$(k -n "$NS" get ingress demo -o jsonpath='{.spec.rules[0].http.paths[*].path}')" \
  "/foo /bar" "it declares exactly two paths"
assert_eq "$(k -n "$NS" get ingress demo -o jsonpath='{.spec.rules[0].http.paths[*].pathType}')" \
  "Prefix Prefix" "both are pathType: Prefix"
assert_eq "$(k -n "$NS" get ingress demo -o jsonpath='{.spec.rules[0].host}')" \
  "" "and the rule carries no host, so it answers for any Host header"

step "Wait for the controller to adopt it and publish an address"
# .status.loadBalancer is written by the controller, not by the API server. An
# Ingress that no controller claims sits with an empty ADDRESS forever, and
# that is the usual symptom of a wrong or missing ingressClassName.
assert_eventually 180 "yes" "ingress/demo has an address in .status" ing_addressed demo
run k -n "$NS" get ingress
note "address: $(ing_address demo) — kind's controller runs with"
note "--publish-status-address, so it advertises the host's front door rather"
note "than a cloud load balancer's IP. Its own Service stays <pending> forever"
note "for lack of a cloud provider; the Ingress address is set independently."

# Proof that the object reached the data plane, not just etcd.
assert_eventually_contains 120 "$NS" \
  "the controller ingested it: its generated nginx.conf names $NS" ctrl_conf
CONF="$(ctrl_conf || true)"
assert_contains "$CONF" "${NS}-foo" "the config carries an upstream for Service foo"
assert_contains "$CONF" "${NS}-bar" "and another for Service bar"
UPSTREAMS="$(printf '%s\n' "$CONF" | grep -oE "${NS}-[a-z]+-[0-9]+" | sort -u | tr '\n' ' ' || true)"
note "upstream names generated from the Ingress: ${UPSTREAMS:-<none matched>}"
note "the shape is <namespace>-<service>-<port>. Turning Ingress objects into"
note "proxy configuration is the entire job of an ingress controller: it watches"
note "the API and rewrites nginx.conf. The Ingress itself proxies nothing."

step "A request to /foo reaches foo, and /bar reaches bar"
note "each probe is a throwaway Pod running, from inside the cluster:"
note "  wget -qO- http://${CTRL}/foo"
assert_eventually_contains 180 "backend=foo" \
  "GET /foo through the controller was answered by the foo backend" ingress_get /foo
BAR_BODY="$(ingress_get /bar)"
assert_contains "$BAR_BODY" "backend=bar" "GET /bar was answered by the bar backend"
assert_not_contains "$BAR_BODY" "backend=foo" "foo had nothing to do with it"
assert_contains "$BAR_BODY" "uri=/bar" "and the backend was asked for the original path /bar"
note "the path was forwarded unchanged. ingress-nginx strips no prefix of its"
note "own, which is why the rewrite-target annotation exists — and that is a"
note "controller-specific extension, not part of the Ingress API."

step "An unmatched path falls through to the controller's default backend"
NOPE="$(ingress_get /nope)"
assert_contains "$NOPE" "404" "GET /nope returned 404"
note "no rule matched, so the request never left the ingress-nginx Pod. A 404"
note "here means routing; a 503 would mean the route was found and the Service"
note "behind it had no ready endpoints."

step "pathType: Prefix matches on / boundaries, not on characters"
FOOBAR="$(ingress_get /foobar)"
note "the Ingress API defines Prefix as an element-wise match on / boundaries,"
note "so the rule for /foo must NOT match a request for /foobar."
assert_contains "$FOOBAR" "404" "/foobar is not matched by the /foo Prefix rule"
note "ingress-nginx honours that: /foo/bar would match, because 'bar' is a new"
note "path element, but /foobar merely shares a character prefix and does not."
note "This is worth testing rather than assuming. pathType became a required"
note "field precisely because controllers once differed here, and a rule you"
note "believe is scoped to /foo silently swallowing /foobar-anything is the"
note "kind of routing bug that only shows up in production."

step "Host-based routing: the same backends, selected by Host header"
apply ingress-host.yaml
assert_eventually 180 "yes" "ingress/hosts has an address in .status" ing_addressed hosts
run k -n "$NS" get ingress
note "each probe now runs:"
note "  wget -qO- --header 'Host: $FOO_HOST' http://${CTRL}/"
assert_eventually_contains 180 "backend=foo" \
  "Host: $FOO_HOST with path / reached the foo backend" ingress_get / "$FOO_HOST"
BAR_HOST_BODY="$(ingress_get / "$BAR_HOST")"
assert_contains "$BAR_HOST_BODY" "backend=bar" \
  "Host: $BAR_HOST with the identical path / reached bar instead"
assert_not_contains "$BAR_HOST_BODY" "backend=foo" "the header alone decided it"
assert_contains "$BAR_HOST_BODY" "host=$BAR_HOST" \
  "and the backend saw the Host header the client sent"
note "neither name resolves in DNS anywhere, which is the point: routing is"
note "decided by the header the client sends, so a header is all a test needs."
note "It is also why an Ingress is useless on its own — real clients only send"
note "that header because DNS pointed them at the controller."

step "Host is matched first, then path within that host"
# ingress/hosts declares only `/` under $FOO_HOST. The /foo and /bar paths
# belong to the hostless rule, which is a separate nginx server block.
MIXED="$(ingress_get /bar "$FOO_HOST")"
assert_contains "$MIXED" "backend=foo" "Host: $FOO_HOST with path /bar still reached foo"
assert_not_contains "$MIXED" "backend=bar" "the /bar path rule did not apply at all"
assert_contains "$MIXED" "uri=/bar" "foo really was asked for /bar"
note "the two Ingresses are not flattened into one table of paths. Rules are"
note "grouped by host first, and $FOO_HOST has exactly one path"
note "(/), which matches /bar as a prefix. The /foo and /bar rules live under"
note "the hostless rule, and a request naming a known host never reaches them."
CATCHALL="$(ingress_get /foo nobody.sandbox.example)"
assert_contains "$CATCHALL" "backend=foo" \
  "an unknown Host falls back to the hostless rule, where /foo routes normally"
note "that is the other half of the same rule: a rule with no host is the"
note "catch-all, serving every name no other rule has claimed"

step "The API rejects a path with no pathType"
note "\$ kubectl apply -f bad-ingress.yaml"
if OUT="$(k -n "$NS" apply -f "$LAB_DIR/bad-ingress.yaml" 2>&1)"; then
  fail "expected the API server to reject an Ingress whose path has no pathType"
fi
assert_contains "$OUT" "pathType" "rejected, and the message names pathType"
assert_eq "$(k -n "$NS" get ingress no-path-type --ignore-not-found -o name)" \
  "" "nothing was persisted"
note "networking.k8s.io/v1 made pathType required because the beta API left"
note "prefix-versus-exact matching entirely to the controller, so one manifest"
note "routed differently on different clusters. This validation lives in the"
note "API server ahead of any admission webhook, so it fails identically on a"
note "cluster with no ingress controller installed at all."

step "What this proves"
note "An Ingress is a routing table and nothing else. It stores hostnames,"
note "paths and Service references in etcd; it opens no port, proxies no"
note "traffic and has no behaviour of its own. Every request in this lab was"
note "served by the ingress-nginx Pod, which watched these objects and rewrote"
note "its own nginx.conf — you saw the upstreams it generated from them."
note ""
note "Three consequences follow, and each is a classic way to lose an afternoon."
note "First, ingressClassName is what binds the object to a controller: with no"
note "matching IngressClass and no default annotation, nothing claims the"
note "Ingress, ADDRESS stays empty forever, and the object's own status never"
note "says why. Second, the backend is a Service at the Service's port, so a"
note "perfectly healthy Ingress in front of a Service with no ready endpoints"
note "is a 503 and the fault is one layer down. Third, matching is host first"
note "and path second, which is why Host: $FOO_HOST was routed"
note "to foo even when the path said /bar."
note ""
note "Layer 7 is the whole point. A Service load-balances TCP to one set of"
note "Pods; an Ingress reads the request line and the Host header, so many"
note "Services can sit behind one address and one certificate. That is also its"
note "ceiling. The portable API covers hosts, paths and TLS and very little"
note "else, so rewrites, timeouts, auth, canaries and session affinity all become"
note "vendor-specific annotations — untyped strings the API server cannot"
note "validate and another controller will ignore. Gateway API is the successor"
note "precisely because it promotes that behaviour into typed, portable objects."
