# ClusterIP and headless Services

**CKA domain:** Services & Networking

Pods are disposable and their IP addresses change every time one is replaced, so
nothing inside a cluster should ever hold a Pod IP for long. A Service is the
answer to that problem, and it solves it in two separable pieces: a label
selector that is continuously turned into a list of live backend addresses, and
a virtual IP that kube-proxy programs into every node so traffic sent to it gets
rewritten to one of those backends. A headless Service keeps the first piece and
throws away the second. This lab builds both Services over the same three Pods
and measures, rather than asserts in prose, exactly what changes when it does.

## Run it

```
bash run.sh          # the whole walkthrough, then cleans up
KEEP=1 bash run.sh   # leaves the namespace running so you can poke at it
```

## Walkthrough

### 1. A three-replica backend and a client to poke it with

```
kubectl apply -f backend.yaml
kubectl apply -f client.yaml
kubectl rollout status deployment/web
```

`backend.yaml` runs three replicas of agnhost's `netexec` HTTP server. The one
feature of it that matters here is that `GET /hostname` returns the container's
hostname, which for a Pod is the Pod's name. Every response is therefore signed
by the replica that produced it, which is what turns "the Service balanced the
load" from a claim into a count.

`client.yaml` is a Pod that does nothing but sleep, so that every request below
originates from inside the cluster the way a real caller would. It carries two
containers because no one image here has both tools the lab needs: `shell`
(busybox) supplies `wget`, which prints the response body, and `dns` (agnhost)
supplies `nslookup`, which is the tool the Kubernetes DNS-debugging task
recommends. Keeping them in one Pod rather than two means they share a network
namespace, so the DNS answers in step 6 are demonstrably the answers the `wget`
client in step 4 was already working from.

The Pod is labelled `app: client` rather than `app: web` on purpose: if it
matched the Services' selector it would become one of their endpoints, and the
endpoint counts asserted later would be wrong.

### 2. Create the ClusterIP Service and read its virtual IP back

```
kubectl apply -f clusterip-service.yaml
kubectl get svc web -o wide
kubectl get svc web -o jsonpath='{.spec.clusterIP}'
```

`clusterip-service.yaml` sets no `type` field at all, and the API server defaults
it to `ClusterIP` — a fact worth internalising, because the exam likes to ask
what a Service with no `type` ends up being. The API server also allocates an
address from the cluster's service CIDR and writes it into `.spec.clusterIP`.

Compare that address against `kubectl get pods -o wide`: it is not any Pod's IP,
and in fact no network interface anywhere in the cluster is configured with it.
It is better understood as the name of a rule than as an address. kube-proxy
watches the Service and programs iptables on every node so that packets aimed at
that IP and port are rewritten to a backend before they ever leave the sending
node — which is also why you cannot ping a clusterIP or `tcpdump` it on a wire.

Notice too that `port: 80` and `targetPort: http` differ. Clients speak to the
Service on 80; the containers listen on 8080, the port they named `http`. Step 7
shows what that distinction is worth.

### 3. The endpoints controller fills an EndpointSlice from the selector

```
kubectl get endpointslice -l kubernetes.io/service-name=web
kubectl get endpointslice -l kubernetes.io/service-name=web -o yaml
```

A Service never stores the Pods it fronts. It stores a selector, and a separate
controller keeps a set of EndpointSlice objects in sync with whatever currently
matches — each endpoint carrying an address and a `conditions.ready` flag. Only
Ready Pods are used as backends, which is why `backend.yaml` bothers to define a
readiness probe: without one, "Ready" would mean no more than "the process
started".

Two details in the slice are worth reading off directly. Its addresses are
exactly the three Pod IPs, and its port is `8080` — the named `targetPort: http`
was resolved to a number here, once, rather than being looked up per packet.
`kubernetes.io/service-name` is the label that ties a slice back to its Service,
and it is the label you filter on when debugging.

### 4. Fifteen requests through the Service reach more than one Pod

```
kubectl exec client -c shell -- sh -c 'for i in 1 2 3; do wget -q -O - http://web/hostname; echo; done'
```

The client resolves the bare name `web` through the namespace's search domain,
connects to the clusterIP on port 80, and reads back the name of whichever Pod
served it. Run it enough times and several different names appear. `run.sh` does
fifteen requests, prints the distribution, and fails unless at least two distinct
hostnames come back; it also checks that every hostname returned is genuinely one
of the Deployment's Pods, so a stale or over-broad selector would be caught.

It then repeats one request against the raw clusterIP rather than the name, which
still works. That is the point: DNS resolves the name to one stable address and
stops there. The spreading happens below DNS, in the packet rewrite.

The granularity is per connection, not per request. Each `wget` opens a fresh TCP
connection and kube-proxy chooses a backend for it; a client that keeps one
HTTP/1.1 keep-alive connection open, or a single HTTP/2 connection, is pinned to
whichever Pod it first landed on. That is the usual explanation when a service
mesh gets adopted for "better load balancing".

### 5. Create the headless Service: the same spec, minus the virtual IP

```
kubectl apply -f headless-service.yaml
kubectl get svc
kubectl patch svc web-headless -p '{"spec":{"clusterIP":"10.96.0.99"}}'
```

Diff `headless-service.yaml` against `clusterip-service.yaml`: same selector,
same ports, one extra line — `clusterIP: None`. `kubectl get svc` prints
`None` in the CLUSTER-IP column for it, because no address was ever requested
from the allocator.

Headless does not mean endpoint-less. The Service still has a selector, so the
endpoints controller still builds it an EndpointSlice with the same three ready
endpoints. What is missing is the consumer of that slice: kube-proxy writes no
rules for a Service with no virtual IP, so CoreDNS becomes the only thing reading
it.

The `patch` above is rejected. `spec.clusterIP` is immutable, so headless is a
decision made when the Service is created; converting a Service in either
direction means deleting and recreating it, and any client caching the old
address will notice.

### 6. DNS is where the two Services stop looking alike

```
kubectl exec client -c dns -- nslookup web.<namespace>.svc.cluster.local
kubectl exec client -c dns -- nslookup web-headless.<namespace>.svc.cluster.local
```

Fully-qualified names are used here rather than the bare `web`, so that the
answer cannot depend on how a particular resolver walks the `search` list in
`/etc/resolv.conf`.

The first lookup returns exactly one address, and it is the clusterIP. The
Pods are invisible from DNS: however many there are, however often they are
replaced, the answer does not change.

The second returns three addresses, and they are precisely the three Pod IPs.
CoreDNS reads the EndpointSlice and publishes one A record per ready endpoint,
so the client is handed the backends themselves and picks one with its own
resolver. `run.sh` asserts the exact set, not just the count, and separately
asserts that the other Service's clusterIP appears nowhere in the answer.

One caveat about per-Pod names: a headless Service alone does not give each Pod
its own DNS record. Per-Pod A records require the Pod to set `hostname` and
`subdomain` (with the subdomain matching the headless Service's name), which is
exactly what a StatefulSet does for you. A Deployment behind a headless Service,
as here, gets the set of addresses under the Service name and nothing more.

### 7. Nothing proxies for a headless Service

```
kubectl exec client -c shell -- wget -q -O - http://web-headless:8080/hostname   # works
kubectl exec client -c shell -- wget -q -O - http://web-headless:80/hostname     # refused
```

Both Services declare a byte-for-byte identical ports block, `port: 80` targeting
the container port named `http`. Through the ClusterIP Service, port 80 works,
because kube-proxy rewrites the destination port to 8080 on the way. Through the
headless Service, port 80 is refused with a connection error, because DNS handed
the client a Pod IP and the Pod is listening only on 8080. There is no proxy in
the path, so there is nothing to translate the port.

That is the sharpest available demonstration that the `ports` block on a headless
Service is close to inert. It still populates SRV records and still documents
intent, but it cannot move a connection from one port to another. Clients of a
headless Service must use the real container port.

### 8. The endpoint set follows the selector, live

```
kubectl scale deployment/web --replicas=4
kubectl get endpointslice -l kubernetes.io/service-name=web
kubectl get endpointslice -l kubernetes.io/service-name=web-headless
```

Neither Service is edited, yet both slices grow to four ready endpoints and the
clusterIP is unchanged. The selector is evaluated continuously, so the backend
set tracks reality on its own. DNS answers catch up within the record TTL, 30
seconds in this cluster, which is worth remembering when a scale-up appears not
to have taken effect: check the EndpointSlice before you suspect DNS, because
the slice updates immediately and the cached answer does not.

## What this proves

A ClusterIP Service is two mechanisms bolted together. The first is a label
selector that the endpoints controller keeps turning into an EndpointSlice — a
live list of the addresses of the Ready Pods that match, with the named
`targetPort` already resolved to a number. The second is a virtual IP owned by no
interface anywhere; kube-proxy watches both objects and programs every node so
that a packet sent to that IP and port is rewritten to one endpoint's IP and
port. Load balancing is that rewrite choosing a backend, once per connection,
which is why fifteen separate `wget` calls spread across the replicas and why one
long-lived connection would not.

A headless Service keeps the first mechanism and drops the second. `clusterIP:
None` means no address is allocated and kube-proxy writes no rules, so CoreDNS
answers the Service name with the endpoint IPs themselves and the client connects
to a Pod directly. That is why the identical ports block behaved differently on
the two Services: port 80 worked through the proxy and was refused without it.

The practical rule falls out of the difference. Use a ClusterIP Service when the
caller wants *a* backend and should not care which — the overwhelmingly common
case. Use a headless Service when the caller needs the individual Pods: a
StatefulSet's stable per-Pod names, a database driver that opens a pooled
connection per replica, or a client library that insists on doing its own
balancing and health checking.

## See also

- Study guide → Services and Networking
- Flashcards: `service-clusterip`, `services`, `endpointslices`, `kube-proxy`,
  `coredns`, `service-debugging-workflow`
- Related: `deployment` — the controller producing the interchangeable Pods a
  ClusterIP Service assumes it is fronting
- Related: `statefulset` — the workload that actually wants a headless Service,
  because it sets `hostname` and `subdomain` to earn per-Pod DNS names
- Next: `service-nodeport-loadbalancer` — the two types that build on ClusterIP
  to reach traffic arriving from outside the cluster
