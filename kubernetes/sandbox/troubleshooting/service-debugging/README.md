# Debugging a broken Service

**CKA domain:** Troubleshooting

A Service that does not work is the most common thing you will be asked to fix,
and it is also the one where guessing costs the most time, because half a dozen
unrelated faults present identically: a name that will not connect. This lab
breaks a Service in the single most common way — one character wrong in the
selector — and then walks the whole documented checklist over it in order,
without skipping to the answer. Most of the checks pass, which is exactly the
point: a checklist earns its keep by eliminating causes, and by the time you
reach the EndpointSlice you know that everything above it is sound. The finding,
when it comes, is unambiguous. An EndpointSlice with zero addresses means the
selector matched no Pod, and nothing else produces it.

The lab closes on the distinction that matters most under pressure. An *empty*
EndpointSlice and an EndpointSlice full of *unready* endpoints are two different
diagnoses that send you to opposite ends of the cluster, and the default
`kubectl` output does a poor job of telling them apart.

## Run it

```
bash run.sh          # the whole walkthrough, then cleans up
KEEP=1 bash run.sh   # leaves the namespace running so you can poke at it
```

## Walkthrough

### 1. A healthy backend, a client, and a Service that does not work

```
kubectl apply -f backend.yaml
kubectl apply -f client.yaml
kubectl apply -f service-broken.yaml
kubectl rollout status deployment/hostnames
kubectl get pods -o wide
```

`backend.yaml` runs three replicas of agnhost's `netexec` HTTP server on port
9376, labelled `app=hostnames`. Two details about it are load-bearing later.
`GET /hostname` returns the container's hostname, which for a Pod is the Pod's
name, so every response is signed by the replica that produced it. And its
readiness probe is an exec probe over `test -s /tmp/ready` — a file the
container writes before starting the server — which means the last step of the
lab can make one Pod unready on demand without stopping the server or waiting
for a real failure.

`client.yaml` is the Pod every probe below is issued from, because the checklist
is about in-cluster traffic and the caller therefore has to live in the cluster.
It carries two containers: `shell` (busybox) for `wget`, which prints the
response body, and `dns` (agnhost) for `nslookup`. They share a network
namespace, so the name the second one resolves is the name the first one is
calling. Its label is `app=client`, deliberately not `app=hostnames`, so it can
never insert itself into the EndpointSlice this lab spends its time counting.

`service-broken.yaml` is the fault. From here on, pretend you wrote none of it
and were handed a one-line ticket: *`http://hostnames` is down.*

### 2. The symptom

```
kubectl exec client -c shell -- wget -q -O - -T 5 http://hostnames/hostname
```

This fails, and the script asserts that it fails — reproducing the report is the
first thing you do, before touching anything, because a bug you cannot reproduce
is a bug you cannot confirm you fixed.

Read the error rather than skimming past it. A **refused** connection means
something on the path answered "no": kube-proxy programs an explicit reject rule
for a clusterIP that has no endpoints, so a Service with an empty EndpointSlice
fails fast and loudly. A **timeout** would point somewhere else entirely — a
NetworkPolicy silently dropping the packet, or a `targetPort` aimed at a port
nothing is listening on. The shape of the failure narrows the search before you
have run a single diagnostic command.

### 3. Check 1 — does the Service exist?

```
kubectl get svc hostnames
```

It sounds too obvious to bother with, and it is the check that most often ends
the investigation early. A Service is namespaced, and by far the commonest cause
of "the Service is broken" is a caller sitting in a different namespace, where
the short name `hostnames` resolves to nothing at all. Here the Service exists,
is of type `ClusterIP`, and holds an allocated clusterIP, so the caller and the
Service are in the same place and the address exists.

### 4. Check 2 — any NetworkPolicy affecting the target Pods?

```
kubectl get networkpolicies
kubectl get netpol -o custom-columns=NAME:.metadata.name,PODSELECTOR:.spec.podSelector,TYPES:.spec.policyTypes
```

This namespace has none, so the script asserts the list is empty and the check
rules a cause out. The reason it sits this high in the upstream checklist is
that a NetworkPolicy makes a completely correct Service look broken, and nothing
in `kubectl describe svc` gives any hint that one exists. If you do not go
looking, you will not find it.

Two directions need checking, not one. An **Ingress** policy in the backends'
namespace can block traffic arriving at the Pods, and an **Egress** policy in
the *caller's* namespace can block the request before it ever leaves. Both look
identical from the caller: a connection that hangs and then times out. A policy
matters to your outage only if its `podSelector` matches the labels of the Pods
in question — an unrelated policy in the same namespace is noise, but a
`podSelector: {}` policy selects every Pod there is.

### 5. Check 3 — does the Service work by DNS name?

```
kubectl exec client -c dns -- nslookup hostnames
kubectl exec client -c dns -- nslookup hostnames.<namespace>.svc.cluster.local
```

Both lookups succeed and both return the Service's clusterIP, which the script
asserts against the address read from the Service object.

This is the step people over-read, so it is worth being precise about what it
proved. DNS answered perfectly for a Service with no working backends
whatsoever, because the A record of a ClusterIP Service *is* its clusterIP —
allocated when the Service was created, entirely independent of whether any Pod
stands behind it. A successful lookup rules out DNS and rules out nothing else.
Concluding "DNS works, so the Service is fine" is how people end up restarting
CoreDNS during an outage it had no part in.

The exception is worth memorising, because it inverts the reasoning: a
**headless** Service (`clusterIP: None`) has no address of its own, so its DNS
records *are* the endpoint addresses. There, an empty EndpointSlice shows up as
a failed lookup, and "the name does not resolve" and "the selector matches
nothing" are the same finding wearing different clothes.

### 6. Check 4 — does the Service work by IP?

```
kubectl exec client -c shell -- wget -q -O - -T 5 http://<clusterIP>/hostname
```

Dialling the address directly fails the same way the name did, which the script
asserts. That is the useful outcome: bypassing name resolution reproduces the
fault, so the name was never the problem, and the investigation stays on the
Service. Had this *succeeded* where the name failed, everything below would be a
waste of time and the search would turn towards CoreDNS, `/etc/resolv.conf`, and
the caller's search domains instead.

### 7. Check 5 — is the Service defined correctly?

```
kubectl get svc hostnames -o yaml
```

Four questions, from the upstream task, and it is worth asking all four out loud
rather than glancing at the YAML and pronouncing it fine:

- Is `spec.ports[*].port` the port you are actually dialling?
- Is `spec.ports[*].targetPort` the port the Pods are actually listening on?
- If `targetPort` is a *name*, do the Pods really expose a port with that name?
- Is `targetPort` the same kind of thing as `containerPort` — number against
  number, name against name?

Here `port` is 80, `targetPort` is 9376, the protocol is TCP, and the Pods'
`containerPort` is 9376. The script reads both numbers out of the live objects
and asserts they are equal, so the ports are ruled out rather than assumed. A
wrong `targetPort` is a real and common fault, but note what it looks like when
it happens: the EndpointSlice still fills up with addresses, and connections
hang or are refused at the *Pod*. It does not empty the slice. That distinction
is about to matter.

### 8. Check 6 — does the Service have any EndpointSlices?

```
kubectl get endpointslices -l kubernetes.io/service-name=hostnames
kubectl describe svc hostnames
```

Here is the finding. A slice exists, it is owned by the Service, and it carries
**zero addresses** — no ready endpoints and no unready ones either. It is not
partly full; it is empty. `kubectl describe svc` agrees, showing a blank
`Endpoints:` line, which the script asserts by confirming that no backend Pod IP
appears anywhere in the description.

Always select the slice by the `kubernetes.io/service-name` label rather than by
name. Slice names are generated with a random suffix, and a Service with many
endpoints owns several slices; the label is the only stable handle.

The slice existing at all, while empty, is deliberate control-plane behaviour.
The endpointslice controller writes a placeholder slice for every Service that
has a selector, so that kube-proxy and CoreDNS always have an object to watch
and "there are no endpoints" is never confused with "the controller has not run
yet". So the two states you might have expected to distinguish — no slice versus
an empty slice — collapse into one, and it is the address count you read, not
the presence of the object.

An empty EndpointSlice is one of the highest-signal findings in Kubernetes
troubleshooting. It says the selector matched no Pod. It says nothing at all
about whether the Pods are healthy, because unhealthy Pods still appear here —
step 11 shows exactly what that looks like.

### 9. Check 6b — what does the Service's own selector match?

```
kubectl get svc hostnames -o go-template='{{range $k, $v := .spec.selector}}{{$k}}={{$v}},{{end}}'
kubectl get pods --selector=app=hostname
kubectl get pods -l app=hostnames --show-labels
```

The first command rebuilds the Service's selector as a `--selector` string
straight out of the object. Reading it back rather than retyping what you
believe you wrote is the whole discipline of this step: the failure *is* that
the two differ, so any command you type from memory will reproduce your
misconception instead of exposing it.

Queried with the Service's own selector, `kubectl` replies `No resources found`.
Queried with `app=hostnames`, it returns all three Pods. The script asserts both
counts — zero and three. `--show-labels` puts the Pods' real labels on screen
beside the selector, and there is the bug in plain sight: the Pods are labelled
`app=hostnames` and the Service asks for `app=hostname`.

Nothing in Kubernetes was ever going to catch this for you. A selector is not a
reference; the API server does not resolve it and cannot warn you, because a
selector that currently matches nothing is perfectly legitimate — it is what
every Service looks like in the seconds before its Deployment rolls out.

### 10. The fix

```
kubectl apply -f service-fixed.yaml
kubectl get endpointslices -l kubernetes.io/service-name=hostnames
kubectl exec client -c shell -- wget -q -O - -T 5 http://hostnames/hostname
```

One character. The script asserts that the selector is now `app=hostnames`, that
the clusterIP is unchanged — repairing a Service in place does not re-address
it, so its DNS record and every config file that names it survive the repair —
and then waits for the EndpointSlice to report **three ready endpoints**, whose
addresses it checks against the three backend Pod IPs. The request that failed
in step 2 now returns a backend Pod name.

`kubectl patch svc hostnames -p '{"spec":{"selector":{"app":"hostnames"}}}'` is
the same fix as a one-liner and is what you would reach for under exam time
pressure. Know what it does, though: a strategic merge patch merges the selector
map key by key. Here both versions use the key `app`, so the merge overwrites it
and the result is correct. Had the typo been in the *key* — `ap: hostnames` —
the merge would have left you with both keys and a selector matching even less
than before. Applying a full manifest has no such trap.

Notice what the fix did *not* involve. No Pod was restarted, rescheduled, or
edited. The backends were healthy throughout; only the sentence describing them
was wrong.

### 11. Empty is not the same as unready

```
kubectl exec <pod> -- sh -c ': > /tmp/ready'
kubectl get endpointslices -l kubernetes.io/service-name=hostnames -o yaml
```

Truncating `/tmp/ready` makes one Pod's readiness probe fail. The server keeps
running and keeps listening, so anything that changes was changed by Kubernetes
rather than by the application. Within a few seconds the Pod's `Ready` condition
flips to `False` — and the script asserts what happens to the slice:

- it still lists **three** addresses; the unready endpoint did not vanish;
- exactly one of them has `conditions.ready: false`, and it is the Pod whose
  probe we broke;
- the other two are ready.

Set that against the slice in step 8 and the contrast is the lesson. Both
describe a Service that is not fully serving, and they look nothing alike. A
selector mismatch **empties** the slice. A failing probe **leaves every address
in place** and flips a condition on one entry, which kube-proxy honours by
programming no rule for it.

The trap is that the default `kubectl get endpointslices` output shows you
neither clearly: the `ENDPOINTS` column prints addresses without their
conditions, so a slice with one dead backend and a slice with three live ones
look much the same at a glance. Ask for the conditions explicitly — `-o yaml`,
or a jsonpath over `endpoints[*].conditions.ready` — whenever a Service is
half-working rather than fully down.

Restoring the file brings the endpoint back to ready with no object edited by
hand, which is the last small proof that endpoints are derived state and not
something you manage.

## What this proves

A Service is a selector, a port mapping, and an address. Debugging one is
walking down those three in a fixed order and refusing to skip ahead: does the
Service exist; is a NetworkPolicy filtering the target Pods; does the name
resolve; does the clusterIP behave the same way the name does; are `port` and
`targetPort` what you think they are; and does the EndpointSlice have anything
in it. Two rungs remain below that — are the Pods actually serving on the
`targetPort`, and is kube-proxy healthy on the node the caller sits on — and you
earn the right to look at them only when everything above has come back clean.

Most of the checks passed here, and that is the result rather than the filler.
The Service existed, no policy was in the way, DNS answered with the correct
clusterIP, and port 80 mapped correctly onto containerPort 9376. Each pass
deleted a hypothesis. The one check that failed then told us everything: an
EndpointSlice with zero addresses means the selector matched no Pod, and
`kubectl get pods --selector=<the Service's own selector>` converts that
inference into the two labels that differ.

The closing distinction is the one to carry into an exam or an outage. An
**empty** slice is a labelling bug — a typo, a Deployment whose template labels
drifted away from the Service's selector, a Service pointed at the wrong
namespace — and you fix it by editing text. An **unready** endpoint is an
application or probe problem — the address is sitting right there in the slice
marked `ready: false`, and kube-proxy is declining to send it traffic on purpose
— and you fix it by looking at logs and probe definitions. "The Service has no
endpoints" and "the Service has no *ready* endpoints" are different sentences,
and confusing them costs you the first twenty minutes of an incident.

## See also

- Study guide → Troubleshooting; Services and Networking
- Flashcards: `service-debugging-workflow`, `endpointslices`,
  `endpoint-conditions`, `labels-and-selectors`, `kube-proxy`,
  `dns-for-services-and-pods`, `readiness-probe`, `networkpolicy`
- Related: `services-networking/dns-endpointslices` — the same slice taken apart
  in far more detail, including what kube-proxy does with each condition
- Related: `services-networking/service-clusterip` — where the clusterIP and the
  proxying behind it are examined on their own
- Related: `services-networking/networkpolicy` — the check that comes second in
  this list, demonstrated properly
- Next: `troubleshooting/pod-failure-states` — the rung below this one, for when
  the endpoints are present and the Pods themselves are the problem
