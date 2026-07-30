# NetworkPolicy

**CKA domain:** Services & Networking

Pod networking is flat by default: every Pod can open a connection to every
other Pod in the cluster, and nothing in Kubernetes objects to it. A
NetworkPolicy is how you take that away — selectively, per Pod, per direction.
The API is small enough to read in a minute and subtle enough to get wrong for
years, so this lab does one thing: it measures reachability before and after
every single change, in both directions, and never asks you to take a result on
faith.

## Run it

```
bash run.sh          # the whole walkthrough, then cleans up
KEEP=1 bash run.sh   # leaves the namespace running so you can poke at it
```

## Walkthrough

### 1. One server and two clients

```
kubectl apply -f pods.yaml
kubectl get pods --show-labels
```

`web` runs agnhost's HTTP server on port 8080; `/hostname` returns the Pod's
name, which makes a successful request self-identifying. `frontend` and `batch`
are byte-for-byte identical busybox Pods apart from one label — `tier=frontend`
versus `tier=batch`. Every policy in this lab keys off that label, so any
difference in outcome between the two is attributable to the policy and to
nothing else.

The probes connect straight to the `web` Pod's IP rather than through a
Service. That is deliberate: a NetworkPolicy has no idea Services exist, and
routing DNS out of the request path keeps steps 2 through 5 measuring pod-to-pod
policy and only that.

### 2. With no policy, everything reaches everything

```
kubectl exec frontend -- wget -q -T 5 -O- http://<web-ip>:8080/hostname
kubectl exec batch    -- wget -q -T 5 -O- http://<web-ip>:8080/hostname
```

Both print `web`. A namespace containing zero NetworkPolicies permits
everything, and — more precisely — policy is opt-in per Pod: a Pod remains
unrestricted until some policy selects it.

### 3. A default-deny ingress policy closes the namespace

```
kubectl apply -f 01-default-deny-ingress.yaml
kubectl exec frontend -- wget -q -T 5 -O- http://<web-ip>:8080/hostname   # times out
```

The whole object is three meaningful lines:

```yaml
spec:
  podSelector: {}
  policyTypes:
    - Ingress
```

`podSelector: {}` is an *empty* selector, and an empty selector matches every
Pod in the namespace. Empty means all, not none — that inversion is the single
most common misreading of a NetworkPolicy, and it is worth saying out loud
before it costs you an outage. Add `policyTypes: [Ingress]` with no `ingress:`
rules and the sentence reads: select everything, allow nothing inbound.

Note what the policy does *not* say. It never mentions Egress, so outbound
traffic is completely untouched — `nslookup` from the same Pod still works, and
`run.sh` asserts that it does. Ingress and Egress are two independent switches
that happen to live on one object.

### 4. An allow rule reopens one label, and only that label

```
kubectl apply -f 02-allow-frontend.yaml
kubectl describe netpol allow-frontend
```

Now `frontend` gets through and `batch`, differing in exactly one label, does
not.

The important thing here is what did *not* happen: `default-deny-ingress` was
not edited, overridden, or outranked. There is no deny rule in the
NetworkPolicy API and no rule ordering. Policies only ever add permission, and
what a Pod may receive is the union of every Ingress policy that selects it.
The union of "nothing" and "port 8080 from `tier=frontend`" is the latter.

Three selectors appear in that file and they are easy to conflate:
`spec.podSelector` names the destination being protected, `ingress[].from[]`
names the permitted sources, and `ingress[].ports[]` names the port on the
destination. That last one is the container port, never a Service port.

### 5. Two items in `from:` are ORed; one item holding both selectors is ANDed

```
kubectl delete netpol allow-frontend
kubectl apply -f 03-allow-or.yaml     # batch gets in
kubectl delete netpol allow-or
kubectl apply -f 04-allow-and.yaml    # batch is refused
```

Open `03-allow-or.yaml` and `04-allow-and.yaml` side by side. They contain the
same `namespaceSelector` and the same `podSelector`. They differ by one
character.

```yaml
# 03 — OR: two items in the list
from:
  - namespaceSelector:
      matchLabels:
        kubernetes.io/metadata.name: kube-system
  - podSelector:
      matchLabels:
        tier: batch
```

```yaml
# 04 — AND: one item carrying two selectors
from:
  - namespaceSelector:
      matchLabels:
        kubernetes.io/metadata.name: kube-system
    podSelector:
      matchLabels:
        tier: batch
```

Under 03 a source matching *either* item is admitted, so `batch` gets in on the
`podSelector` alone. Under 04 the two selectors have merged into a single item
and are ANDed, so the admitted source is "a Pod labelled `tier=batch` that lives
in kube-system" — which does not exist, and `batch` is refused despite carrying
the label that was sufficient a moment ago.

(`kubernetes.io/metadata.name` is an immutable label the control plane sets on
every namespace, equal to the namespace name. It has been stable since v1.22
and is the ordinary way to select a namespace you do not otherwise control.)

Note also that each policy is deleted before the next is applied. Leaving both
in place would make the result the union of two policies and would prove
nothing about either.

The AND form is what you almost always mean in production — "the payments Pods
in the checkout namespace" — and the OR form is what people write by accident.
The two failure modes are not symmetric. Write AND when you meant OR and
traffic is denied, which someone notices within the hour. Write OR when you
meant AND and you have quietly admitted an entire namespace, and nothing
anywhere fails to tell you so.

### 6. Default-deny egress, and the DNS outage it causes

```
kubectl delete netpol --all
kubectl apply -f 05-default-deny-egress.yaml
kubectl exec frontend -- nslookup kubernetes.default.svc.cluster.local   # fails
```

`05` is the mirror image of `01` — `podSelector: {}` with
`policyTypes: [Egress]` — and it is by far the more dangerous of the two.

A default-deny *ingress* policy fails loudly: something outside cannot reach
your Pod, and whoever owns that something complains. A default-deny *egress*
policy fails from the inside, and the first thing it breaks is name resolution,
because DNS is egress like any other traffic. The Pods stay Ready. Nothing
restarts. `kubectl get pods` is entirely green. Every outbound call in the
application dies on a resolver timeout that surfaces in the logs as a generic
connection error, and nothing in the cluster's state points at the policy you
just applied.

The client Pods in this lab pin `ndots`, `timeout`, and `attempts` via
`dnsConfig` so the denied lookup gives up in about four seconds. With the stock
in-cluster resolver settings the same failure takes the better part of a minute
— which is itself worth knowing, because that is what the outage actually looks
like when it happens to you.

### 7. The companion rule that makes egress survivable

```
kubectl apply -f 06-allow-dns-egress.yaml
kubectl exec frontend -- nslookup kubernetes.default.svc.cluster.local   # resolves
```

```yaml
egress:
  - to:
      - namespaceSelector:
          matchLabels:
            kubernetes.io/metadata.name: kube-system
    ports:
      - protocol: UDP
        port: 53
      - protocol: TCP
        port: 53
```

Two details carry the weight.

**Both protocols.** Nearly every hand-written version of this rule lists UDP
only, and nearly every one of them appears to work, because ordinary answers fit
in a 512-byte datagram. The day an answer does not fit, the server sets the
truncated bit and the resolver retries the identical query over TCP/53. The
failure therefore arrives later, under load, and only for some names — which is
the worst possible time to discover a missing line in a policy.

**The destination is a namespace, not the DNS Service IP.** A Pod resolves
against the kube-dns ClusterIP, but by the time the packet reaches the policy
engine kube-proxy has already DNAT'd it to a real CoreDNS Pod IP in kube-system.
Policy is evaluated against that post-translation address. That is why a
`namespaceSelector` matches here and why an `ipBlock` naming the Service IP
would not.

Reachability to `web` stays blocked throughout, because the allow list opens
port 53 to kube-system and nothing else. In production, tighten it further by
adding `podSelector: {matchLabels: {k8s-app: kube-dns}}` to the same list item —
ANDed, exactly as in step 5 — so the rule opens CoreDNS rather than the whole
of kube-system.

### 8. Three ways this lab could have lied to you

These are the traps that make people believe a policy works when it does not.
All three are guarded against in `run.sh`, and all three are worth checking
before you trust any reachability test you run yourself.

**Do not test from the node.** Running `docker exec cka-sandbox-worker curl
<pod-ip>:8080` succeeds even under `default-deny-ingress`, because
node-originated traffic is accepted regardless of policy. This is not a kind
quirk — CNIs deliberately exempt it so that kubelet's liveness and readiness
probes, which originate on the node, cannot be locked out by a default deny. A
node-side probe therefore tells you nothing at all about your policy. Always
test with `kubectl exec` from inside a Pod that is actually subject to the rule.

**Open a fresh connection.** A NetworkPolicy is applied to new flows;
conntrack keeps an already-established flow alive across a policy change. Hold
a shell open with `nc` or a long-lived HTTP keep-alive connection and it will
keep working long after the policy that should have killed it went in. Every
probe in this lab is a new `wget`, which exits as soon as it is done.

**kindnet fails open.** If the CNI's policy enforcement is not healthy, every
NetworkPolicy in the cluster is silently ignored while `kubectl get netpol`
cheerfully lists them all. A demo run in that state proves the exact opposite of
what it claims. That is why `run.sh` calls `require_addon networkpolicy` before
anything else: it verifies kindnet is fully ready and actually watching
NetworkPolicy objects, and refuses to run rather than teach you something false.
The same reasoning applies to any cluster — before trusting a policy, confirm
your CNI enforces them at all.

## What this proves

NetworkPolicy is a whitelist that switches on per Pod. A Pod that no policy
selects is unrestricted; the moment one policy selects it for a direction, that
direction permits only the union of every rule that selects it. There is no
deny rule, no precedence, and no ordering — only union.

Ingress and Egress are separate switches on one object, and the egress one is
where the damage lives. It breaks DNS first and invisibly, so a default-deny
egress policy is only ever half a change: the DNS companion rule, on UDP and TCP
alike, is the other half, and the two belong in the same commit.

Inside a `from:` or `to:` list, items are ORed and the selectors within a single
item are ANDed. One dash separates "the checkout namespace, or any Pod labelled
payments anywhere" from "the payments Pods in the checkout namespace" — and only
one of those is what you meant.

## See also

- Study guide → Services and Networking
- Flashcards: `networkpolicy`, `networkpolicy-default-deny`,
  `networkpolicy-selectors`, `networkpolicy-egress-dns`, `cluster-dns`
- Related: `service-clusterip` — what a NetworkPolicy deliberately cannot see
