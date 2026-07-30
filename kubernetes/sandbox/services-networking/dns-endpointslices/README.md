# Cluster DNS and EndpointSlices

**CKA domain:** Services & Networking

A Service is a name and an address that outlive the Pods behind it, and two
separate mechanisms make that true. Cluster DNS turns the name into an address:
CoreDNS answers `web.my-namespace.svc.cluster.local` with the Service's
clusterIP, and a `/etc/resolv.conf` the kubelet writes into every Pod is what
lets a caller in the same namespace get away with typing just `web`. The
EndpointSlice turns the address into a set of backends: a live list of the Pod
IPs the Service's selector matches, each one carrying conditions that say
whether it is currently fit to receive traffic. This lab reads both, and then
breaks one Pod's readiness to show the detail that trips people up during an
outage — the unready endpoint does not disappear from the slice. It stays
listed, marked `ready: false`, and kube-proxy simply declines to program a rule
for it.

## Run it

```
bash run.sh          # the whole walkthrough, then cleans up
KEEP=1 bash run.sh   # leaves the namespace running so you can poke at it
```

## Walkthrough

### 1. A three-replica backend, a Service in front of it, and a client Pod

```
kubectl apply -f backend.yaml
kubectl apply -f service.yaml
kubectl apply -f client.yaml
kubectl rollout status deployment/web
kubectl get svc web
```

`backend.yaml` runs three replicas of agnhost's `netexec` HTTP server. Two
details about it earn their keep later. The first is that `GET /hostname`
returns the container's hostname, which for a Pod is the Pod's name, so every
response is signed by the replica that produced it. The second is the readiness
probe: rather than an HTTP check, it is an exec probe over
`test -s /tmp/ready` — "the file `/tmp/ready` exists and is not empty". The
container writes that file before exec'ing the server, so a healthy Pod passes
from its first probe onward, and truncating the file from outside is a
deterministic way to make a Pod unready without waiting for a real failure and
without stopping the server. That distinction matters: the process keeps
listening on 8080 throughout, so anything that stops reaching it was stopped by
Kubernetes, not by the application.

`service.yaml` is an ordinary ClusterIP Service publishing port 80 and targeting
the container port by its name, `http`. `client.yaml` is a Pod that sleeps, so
that every lookup and request below originates inside the cluster the way a real
caller would. It holds two containers because no single image here has both
tools the lab needs: `dns` (agnhost) supplies `nslookup`, the tool the
Kubernetes DNS-debugging task uses, and `shell` (busybox) supplies `wget`, which
prints the response body and resolves names through the ordinary C library
resolver. Because containers in a Pod share a network namespace, both read the
identical `/etc/resolv.conf`, so the two sets of results describe one client
rather than two.

The client is deliberately labelled `app: client`. If it matched the Service's
selector it would become one of the Service's endpoints, and every endpoint
count asserted later would be off by one.

### 2. What the kubelet wrote into the client's `/etc/resolv.conf`

```
kubectl exec client -c shell -- cat /etc/resolv.conf
kubectl -n kube-system get svc kube-dns -o jsonpath='{.spec.clusterIP}'
```

The file looks roughly like this:

```
search sandbox-dns-endpointslices.svc.cluster.local svc.cluster.local cluster.local
nameserver 10.96.0.10
options ndots:5
```

Nothing in the Pod spec asked for any of it. `spec.dnsPolicy` defaults to
`ClusterFirst`, and the kubelet synthesises the file from two inputs: the
cluster DNS address it was configured with, and the Pod's own namespace.

Read the three lines in order, because between them they account for everything
people describe as Kubernetes DNS magic:

- **`nameserver`** is the clusterIP of the `kube-dns` Service in `kube-system` —
  the run asserts the equality. Note what that implies. Pod DNS is itself
  resolved through a Service, so name resolution depends on kube-proxy's rules
  for that clusterIP and on the CoreDNS Pods behind it being ready. A cluster
  where DNS "randomly" fails is very often a cluster where a CoreDNS replica is
  unready, which is the same phenomenon this lab creates on purpose in step 6.
  The name `kube-dns` is a historical leftover; the Pods behind it are CoreDNS.
- **`search`** is the list of suffixes the resolver appends to a name that does
  not already end in a dot, and it goes narrowest first: this Pod's own
  namespace, then all Services in the cluster, then the whole cluster domain.
- **`options ndots:5`** says that a name containing fewer than five dots is
  treated as relative and tried against the search list *before* it is tried as
  written.

### 3. The fully qualified name resolves to the Service's clusterIP

```
kubectl exec client -c dns -- nslookup web.sandbox-dns-endpointslices.svc.cluster.local
```

The answer is a single A record holding the Service's clusterIP, and no Pod
address appears anywhere in it. This is the whole contract of a ClusterIP
Service in one lookup: the name resolves to a virtual address that no network
interface owns, and the mapping from that address to a real backend is made
later, in the kernel, by rules kube-proxy installed.

The run then asks the same question with a trailing dot:

```
kubectl exec client -c dns -- nslookup web.sandbox-dns-endpointslices.svc.cluster.local.
```

Same answer, but not the same amount of work. The name has four dots, which is
fewer than `ndots:5`, so the first form is tried as
`web.<ns>.svc.cluster.local.<ns>.svc.cluster.local`, then with the next suffix,
and so on — four useless queries before the resolver finally tries the name as
written. The trailing dot marks the name absolute and asks exactly once. In a
chatty service mesh this is a real and frequently rediscovered source of CoreDNS
load, and it is why some deployments lower `ndots` through
`spec.dnsConfig.options`.

### 4. Short names work because of the search list

```
kubectl exec client -c dns -- nslookup web
kubectl exec client -c dns -- nslookup web.sandbox-dns-endpointslices
kubectl exec client -c shell -- wget -q -O - http://web/hostname
```

All three reach the same Service. `web` is completed by the first search domain,
`web.<ns>` by the second, and the `wget` proves the same thing through the
ordinary resolver rather than through a DNS tool, returning the name of the
backend Pod that answered. Nothing here is a special Kubernetes rule about short
names; it is the standard resolver behaviour applied to a search list the
kubelet happened to write.

The limit of the convenience is worth demonstrating too:

```
kubectl exec client -c dns -- nslookup kubernetes.default.svc.cluster.local   # resolves
kubectl exec client -c dns -- nslookup kubernetes                             # does not
```

The API server's Service lives in namespace `default`. Its fully qualified name
resolves from anywhere, but the bare name `kubernetes` does not resolve from
this namespace, because no search domain completes a name into someone else's
namespace. Cross-namespace, you must qualify: `<service>.<namespace>` is enough,
and `<service>.<namespace>.svc.cluster.local` is unambiguous.

### 5. The EndpointSlice behind the Service

```
kubectl get endpointslices -l kubernetes.io/service-name=web
```

Selecting on the label rather than guessing a name is the habit to build: slice
names are generated (`web-` plus a random suffix), and one Service may own
several, because the control plane splits at 100 endpoints per slice by default
and always uses a separate slice per address family. The label
`kubernetes.io/service-name` is what ties them all back to their Service, and an
`ownerReference` pointing at the Service is what makes them disappear when the
Service does.

Read a little more of the object and three facts fall out:

```
kubectl get endpointslices -l kubernetes.io/service-name=web -o yaml
```

- `addressType: IPv4`, and `endpoints[].addresses` holds exactly the three Pod
  IPs. The Service stores a selector and never a list of Pods; this list is
  derived state that the endpointslice controller recomputes whenever a matching
  Pod appears, changes readiness, or goes away.
- `ports[0].port` is `8080`, not `80`. The Service named its `targetPort` as
  `http`; the controller resolved that name against the Pod spec and wrote the
  number. Ports get translated here, not at lookup time.
- Each endpoint carries `conditions` — `ready`, `serving` and `terminating` —
  plus a `targetRef` naming the Pod it came from. The conditions are the subject
  of the next two steps.

This is also the object that the older `Endpoints` API used to represent, one
resource per Service. `Endpoints` is deprecated in favour of EndpointSlice;
`kubectl get endpoints` may still show you something, but EndpointSlice is what
the control plane maintains and what kube-proxy reads, so it is what you should
inspect.

### 6. Break one Pod's readiness

```
kubectl exec web-xxxxx-yyyyy -- sh -c ': > /tmp/ready'
kubectl get pods -l app=web
```

Truncating the file makes the next two exec probes fail, and within a few
seconds the Pod's `Ready` condition goes `False` and `kubectl get pods` shows it
as `0/1 READY`. The run asserts two things about what did *not* happen: the Pod
is still `Running`, and its container's `restartCount` is still `0`. A failing
readiness probe never restarts a container and never deletes a Pod — it only
withdraws the Pod from Services. Restarting on failure is what a *liveness*
probe does, and confusing the two is one of the most common probe mistakes.

### 7. The unready endpoint stays in the slice, marked `ready: false`

```
kubectl get endpointslices -l kubernetes.io/service-name=web
kubectl get endpointslices -l kubernetes.io/service-name=web \
  -o jsonpath='{range .items[*].endpoints[*]}{.addresses[0]}{"  "}{.targetRef.name}{"  ready="}{.conditions.ready}{"\n"}{end}'
```

This is the point of the lab, and the assertions are precise about it: the slice
still lists **three** addresses, including the broken Pod's, and **exactly one**
of them now has `conditions.ready == false`. Readiness does not remove an
address from the slice. It flips a condition on an entry that stays exactly
where it was, and the `ENDPOINTS` column of the default `kubectl get` output
still shows all three IPs.

The condition names are worth learning as a set. `serving` tracks the Pod's
`Ready` condition; `terminating` says the Pod has a deletion timestamp but has
not finished shutting down; and `ready` is the shorthand for "serving and not
terminating", which is the one kube-proxy uses. The split exists so that proxies
can keep sending traffic to a terminating-but-still-serving Pod when every other
endpoint is terminating too, rather than dropping traffic in the middle of a
rollout.

Then the behaviour that follows from the condition:

```
kubectl exec client -c shell -- sh -c 'for i in $(seq 12); do wget -q -O - http://web/hostname; echo; done'
```

Twelve requests through the Service, none of which reach the unready Pod. The
run asserts that its hostname is absent and that all twelve still succeeded. The
unready Pod is still listening on 8080 and would answer happily if you dialled
its Pod IP directly; kube-proxy simply wrote no rule pointing at it.

### 8. Restore the file and the endpoint comes back

```
kubectl exec web-xxxxx-yyyyy -- sh -c 'echo ok > /tmp/ready'
```

The probe passes again, the condition flips back to `ready: true`, traffic
returns to that backend, and the total number of addresses in the slice — three
— never changed at any point. Nor did the Service's clusterIP, and nor did the
DNS answer, both of which the run re-checks at the end. No object was edited by
hand to make any of this happen; a file changed inside one container and the
control plane did the rest.

## What this proves

Cluster DNS is a file plus a Service. The kubelet gives every Pod an
`/etc/resolv.conf` whose only `nameserver` is the kube-dns Service's clusterIP
and whose `search` list is `<namespace>.svc.cluster.local`, `svc.cluster.local`,
`cluster.local`, with `options ndots:5`. Everything that looks like special
behaviour follows from those three lines: a short name works inside its own
namespace because the first search domain completes it, a name in another
namespace must be qualified because no search domain will do it for you, and
even a fully qualified name costs several wasted queries unless it ends in a
dot. A Service's A record answers with the clusterIP and nothing else, which is
precisely why the name survives every backend being replaced underneath it.

The EndpointSlice is where the backends actually live, and it is derived state:
a label selector turned into addresses, each carrying `ready`, `serving` and
`terminating` conditions and a `targetRef` back to its Pod, owned by the Service
and labelled `kubernetes.io/service-name` so you can find it. Readiness is a
condition on an entry, not membership in the list. Breaking one Pod's probe left
three addresses in the slice with one marked `ready: false`; kube-proxy
programmed rules for the other two, twelve requests confirmed it, and restoring
the file put the endpoint back.

That last point is the debugging lesson to keep. "The Service has endpoints" and
"the Service has *ready* endpoints" are different claims, and the default
`kubectl get endpointslices` output shows you the first while the outage you are
chasing is caused by the second. When a Service is half-working, ask for the
conditions explicitly — and remember that the same trap applies to CoreDNS
itself, since Pod DNS is resolved through a Service like any other.

## See also

- Study guide → Services and Networking
- Flashcards: `coredns`, `dns-for-services-and-pods`, `ndots-and-search-domains`,
  `endpointslices`, `endpoint-conditions`, `readiness-probe`, `kube-proxy`,
  `service-debugging-workflow`
- Related: `service-clusterip` — where the clusterIP and the proxying that turns
  it into a backend connection are taken apart in detail
- Related: `pod` — why two containers in one Pod necessarily share this
  `/etc/resolv.conf`
- Next: `networkpolicy` — the other reason a Pod that resolves a name perfectly
  well still cannot reach it
