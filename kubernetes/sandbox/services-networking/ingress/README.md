# Ingress

**CKA domain:** Services & Networking

An Ingress is a routing table stored in the API server: a list of hostnames and
paths, each pointing at a Service. It opens no port and forwards no packet. All
of the work is done by an ingress controller, which watches Ingress objects and
rewrites a proxy's configuration to match. This lab puts two Services behind one
controller, routes to them first by path and then by hostname, and looks at the
nginx configuration the controller generated so that the division of labour is
visible rather than assumed.

## Run it

```
bash run.sh          # the whole walkthrough, then cleans up
KEEP=1 bash run.sh   # leaves the namespace running so you can poke at it
```

The lab needs the `ingress` add-on, which `cluster/up.sh` installs unless you
passed `--minimal`. It refuses to run without it rather than failing halfway.

## Walkthrough

### 1. Find the IngressClass

```
kubectl get ingressclass
kubectl get ingressclass nginx -o jsonpath='{.spec.controller}'
```

The cluster has one IngressClass, `nginx`, whose `spec.controller` is
`k8s.io/ingress-nginx`. That string is not a Service or a Pod name; it is an
identifier a controller compares against at startup to decide which objects are
its responsibility. An Ingress names an IngressClass, the IngressClass names a
controller, and the controller ignores everything not addressed to it.

This IngressClass carries no `ingressclass.kubernetes.io/is-default-class`
annotation, so it is not the cluster default and every Ingress here has to set
`spec.ingressClassName` explicitly. Leaving the field off on a cluster with no
default class is the single most common reason an Ingress never does anything:
no controller adopts it, `ADDRESS` stays empty forever, and nothing in the
object's own status explains the silence.

### 2. Create the two backends

```
kubectl apply -f backends.yaml
kubectl rollout status deployment/foo
kubectl get svc
```

`backends.yaml` creates two Deployments, `foo` and `bar`, each with two replicas
and each fronted by its own ClusterIP Service on port 80. The Pods are stock
`nginx:alpine` with their server block replaced from a ConfigMap so that *any*
path returns one plain-text line naming the backend, the Pod, the Host header it
received and the URI it was asked for.

That last detail is not decoration. An Ingress rule with `path: /foo` forwards
the request path unchanged, so the backend really is asked for `/foo`; a stock
nginx would answer 404 because no such file exists, and the lab would then be
unable to tell "routing failed" from "routing worked and the backend had nothing
to serve". A catch-all `location /` removes the ambiguity: any response at all
identifies which backend produced it.

At this point nothing outside the cluster can reach either Service. A ClusterIP
is reachable from inside the cluster and nowhere else, which is precisely the
gap an Ingress fills.

### 3. Create the path-based Ingress

```
kubectl apply -f ingress-path.yaml
kubectl get ingress demo -o yaml
```

`ingress-path.yaml` declares one rule with no `host:` field and two paths,
`/foo` and `/bar`, each with `pathType: Prefix` and each pointing at the
matching Service on port 80. Two things in that sentence are worth slowing down
for.

The backend is a **Service**, at the **Service's** port — 80 here, not the
container's 8080. The Ingress addresses the Service exactly as any other client
would, which means a healthy Ingress in front of a Service with no ready
endpoints produces a 503 and the fault is one layer further down.

The rule has no host, which makes it a catch-all: it applies to every request
the controller receives, whatever Host header the client sent.

### 4. Wait for an address, then look at what the controller built

```
kubectl get ingress
kubectl -n ingress-nginx exec deploy/ingress-nginx-controller -- cat /etc/nginx/nginx.conf
```

`.status.loadBalancer` is written by the controller, not by the API server, so an
`ADDRESS` appearing is the first hard evidence that some controller has adopted
the object. In this cluster the address is `localhost`, because kind's
controller runs with `--publish-status-address`; on a cloud provider it would be
the load balancer's address instead. Note that the controller's own Service is
type `LoadBalancer` and stays `<pending>` forever here for lack of a cloud
provider — the Ingress address is published independently of that and is not a
symptom of the same thing.

The generated `nginx.conf` is where the abstraction stops being magic. Search it
for the namespace and you will find upstream names of the shape
`<namespace>-<service>-<port>`, one per backend the Ingress referenced. Turning
Ingress objects into proxy configuration is the entire job of an ingress
controller. The Ingress itself proxies nothing.

### 5. Route by path

```
kubectl run probe --rm -i --restart=Never --image=busybox:1.36 --command -- \
  wget -qO- http://ingress-nginx-controller.ingress-nginx.svc.cluster.local/foo
```

`/foo` is answered by the foo backend and `/bar` by the bar backend, from one
address, through one proxy. The requests are made from inside the cluster,
against the controller's own Service, so the lab does not depend on a host port
being free. Because kind maps host ports 80 and 443 into the control-plane node,
`curl http://localhost/foo` from your own shell reaches the same controller and
returns the same thing — try it if port 80 is free on your machine.

The response line includes `uri=/foo`, which confirms the path was forwarded
unchanged. ingress-nginx strips no prefix of its own; the `rewrite-target`
annotation exists precisely because that is often not what a backend wants, and
that annotation is a controller-specific extension rather than part of the
Ingress API.

### 6. An unmatched path falls through

```
wget -qO- http://ingress-nginx-controller.ingress-nginx.svc.cluster.local/nope
```

No rule matches `/nope`, so the controller answers 404 from its own default
backend and the request never leaves the ingress-nginx Pod. The distinction is
worth memorising as a debugging reflex: a 404 through an Ingress is a routing
problem, while a 503 means the route was found and the Service behind it had no
ready endpoints.

### 7. `pathType: Prefix` matches path elements, not characters

```
wget -qO- http://ingress-nginx-controller.ingress-nginx.svc.cluster.local/foobar
```

The Ingress API defines `Prefix` as an element-wise match on `/` boundaries: a
path of `/foo` matches `/foo` and `/foo/deep/path`, and explicitly does *not*
match `/foobar`, because matching happens element by element rather than
character by character.

This returns **404**, so ingress-nginx honours the specification here. `/foo/bar`
would have matched, because `bar` is a new path element; `/foobar` only shares a
character prefix.

It is still worth asserting rather than assuming, for two reasons. A rule you
believe is scoped to `/foo` quietly swallowing every `/foobar…` request is the
kind of routing bug that surfaces in production rather than in review. And
`pathType` is a required field in `v1` precisely because this used to vary: the
beta API left prefix-versus-exact matching to the controller, so identical YAML
routed differently on different clusters. Behaviour a controller merely happens
to get right today is worth a test.

### 8. Route by hostname

```
kubectl apply -f ingress-host.yaml
wget -qO- --header 'Host: foo.sandbox.example' \
  http://ingress-nginx-controller.ingress-nginx.svc.cluster.local/
```

`ingress-host.yaml` declares two rules that differ only in `host:` — one for
`foo.sandbox.example`, one for `bar.sandbox.example` — each exposing `/` and
each pointing at a different Service. The same path now reaches two different
backends depending on nothing but a header.

Neither name resolves in DNS anywhere, and that is the point. Host-based routing
is decided by the Host header the client sends, so a header is all a test needs.
It is also why an Ingress does nothing useful on its own: real clients only send
that header because DNS pointed them at the controller in the first place, and
wiring up DNS is a step the Ingress object knows nothing about.

The response echoes `host=bar.sandbox.example`, confirming that ingress-nginx
forwards the original Host rather than rewriting it to the backend's name.

### 9. Host is matched first, then path within that host

```
wget -qO- --header 'Host: foo.sandbox.example' \
  http://ingress-nginx-controller.ingress-nginx.svc.cluster.local/bar
```

This returns the **foo** backend, which surprises people the first time. The two
Ingresses are not flattened into one list of paths. Rules are grouped by host
first — in nginx terms, one `server` block per hostname — and
`foo.sandbox.example` declares exactly one path, `/`, which matches `/bar` as a
prefix. The `/foo` and `/bar` rules belong to the hostless rule, which is a
different server block, and a request naming a known host never reaches them.

The same grouping explains the reverse case, which the walkthrough also checks:
a request for `/foo` carrying an unrecognised Host falls back to the catch-all
server and routes normally, because a rule with no host serves every name no
other rule has claimed.

### 10. `pathType` is required

```
kubectl apply -f bad-ingress.yaml
```

`bad-ingress.yaml` omits `pathType`, and the API server rejects it with
`spec.rules[0].http.paths[0].pathType: Required value`. Nothing is persisted.
This validation lives in the API server ahead of any admission webhook, so it
fails the same way on a cluster with no ingress controller installed at all —
which makes it a useful first check when an Ingress manifest is refused: if the
message comes from the API server it is a schema problem, and if it comes from a
webhook it is the controller objecting to something it cannot express.

## What this proves

An Ingress is data. It stores hostnames, paths and Service references in etcd,
and every request in this lab was served by the ingress-nginx Pod, which watched
those objects and rewrote its own `nginx.conf`. Three consequences follow, and
each is a classic way to lose an afternoon. `ingressClassName` is what binds the
object to a controller, so a missing or wrong class means nothing adopts it and
the object's status never says why. The backend is a Service at the Service's
port, so an Ingress can be perfectly correct and still return 503 because the
Service beneath it has no endpoints. And matching is host first, path second,
which is why `Host: foo.sandbox.example` reached foo even when the path said
`/bar`.

Layer 7 is the whole point of the object. A Service load-balances TCP to one set
of Pods; an Ingress reads the request line and the Host header, so many Services
can sit behind one address and one certificate. That is also its ceiling. The
portable API covers hosts, paths and TLS and very little else, so rewrites,
timeouts, authentication, canary splits and session affinity all became
vendor-specific annotations — untyped strings the API server cannot validate,
that another controller will silently ignore.

That ceiling is why the Ingress API is effectively frozen and why **ingress-nginx
itself has been retired upstream**: the Kubernetes project announced its
retirement in November 2025, ended maintenance in March 2026, and archived the
repository, so there will be no further releases and no fixes for newly
discovered vulnerabilities. (This sandbox installs kind's frozen copy precisely
because it is pinned and will not move.) The designated successor is **Gateway
API**, which promotes routing behaviour into typed, portable, role-separated
objects — GatewayClass, Gateway and HTTPRoute — instead of annotations, and
splits the cluster operator's concerns from the application owner's. Ingress
remains on the CKA exam and remains ubiquitous in existing clusters, so learn it
as you would any load-bearing legacy: thoroughly, and knowing what replaces it.

## See also

- Study guide → Services and Networking
- Flashcards: `ingress`, `ingress-class`, `ingress-path-type`, `gateway-api`
- Related labs: `service-clusterip` — the layer this one routes to;
  `service-nodeport-loadbalancer` — the other ways traffic gets in
- [Ingress NGINX retirement](https://kubernetes.io/blog/2025/11/11/ingress-nginx-retirement/)
  and [Ingress2Gateway](https://kubernetes.io/blog/2026/03/20/ingress2gateway-1-0-release/),
  the migration tool
