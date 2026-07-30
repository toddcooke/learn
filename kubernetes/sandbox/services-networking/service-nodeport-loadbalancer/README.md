# NodePort and LoadBalancer Services

**CKA domain:** Services & Networking

The three Service types are usually taught as a list, which makes them look like
three alternatives you pick between. They are not alternatives; they are layers,
each one adding something to the type below it. This lab builds the top two on a
single Pod so you can watch the layers accumulate: a NodePort Service opens one
port on *every* node in the cluster, including the two nodes that host no copy of
the application, and a LoadBalancer Service adds a request for an external
address that this cluster will never be able to satisfy — and is therefore the
clearest possible place to see what the request actually is.

## Run it

```
bash run.sh          # the whole walkthrough, then cleans up
KEEP=1 bash run.sh   # leaves the namespace running so you can poke at it
```

## Walkthrough

### 1. One backend Pod, and a client to probe it from

```
kubectl apply -f web.yaml
kubectl get pods -o wide
```

`web.yaml` creates a Deployment with **one** replica of an `agnhost netexec`
server on port 8080, plus a `client` Pod that is nothing but a shell with `wget`
in it.

The single replica is the design of the lab, not an economy. With one Pod on one
node, the claim "a NodePort answers on every node" acquires a sharp edge: two of
this cluster's three nodes run no copy of the application at all, and they must
still serve the port. Ask for three replicas instead and every request could have
been handled locally by the node that received it, proving nothing.

Note the node the Pod landed on. Everything below is measured against it.

### 2. Expose it with a NodePort Service

```
kubectl apply -f nodeport-service.yaml
kubectl get svc web-nodeport
```

Three port numbers live in a NodePort Service and they are three different
things:

| Field | Value here | What it is |
| --- | --- | --- |
| `nodePort` | allocated | the port opened on every node's IP |
| `port` | 80 | the port the Service's ClusterIP listens on |
| `targetPort` | 8080 | the port the container is actually bound to |

`nodePort` is deliberately absent from the manifest. The apiserver allocates one,
and a number we did not choose is the only kind of number that can honestly show
what the allocation window is. It will land somewhere in **30000–32767**.

The `get` output also shows a `CLUSTER-IP`. That is the first layer: `NodePort`
did not replace `ClusterIP`, it was added on top of one.

### 3. The range is a rule, not a coincidence

```
kubectl apply -f out-of-range.yaml
```

`out-of-range.yaml` is identical to the working Service except that it asks for
`nodePort: 39999`. The apiserver refuses it:

```
The Service "web-badport" is invalid: spec.ports[0].nodePort: Invalid value: 39999:
provided port is not in the valid range. The range of valid ports is 30000-32767
```

Nothing about 39999 is malformed — it is a perfectly legal TCP port, and no
client-side schema check objects to it. The refusal comes from the apiserver's
node-port allocator, which owns a fixed window and hands out reservations from
it. That window exists so that node ports sit above the ephemeral port range a
node's kernel hands to outgoing connections, which is why it starts high.

Widening it is `--service-node-port-range` on the kube-apiserver — a cluster-level
decision made in `/etc/kubernetes/manifests/kube-apiserver.yaml` on a kubeadm
cluster. A Service manifest may pick a port inside the window; it may never move
the window.

The reservation is also cluster-wide and exclusive. Two Services cannot hold the
same node port, and asking for one that is taken produces the sibling error,
`provided port is already allocated`.

### 4. Every node answers, including the ones running nothing

```
kubectl exec client -- wget -q -O - http://<node internal IP>:<nodePort>/hostname
```

The run script does this against **every** node's `InternalIP` in turn and
asserts that all of them return the name of the one backend Pod. The node hosting
the Pod is the unremarkable case. The interesting responses come from the other
two — including the control plane, which carries a `NoSchedule` taint and could
not run this application even if you asked it to.

The mechanism is kube-proxy. It runs on every node, watches every Service, and
for a NodePort Service programs a rule that catches traffic arriving at *that
node's own address* on the reserved port and DNATs it to a Pod endpoint —
anywhere in the cluster. A node with no local endpoint forwards to a node that
has one.

This is why the address is stable and worth having. Delete the Pod, let the
Deployment recreate it on a different node, and the port keeps answering on all
three addresses without anything being reconfigured. It is also why the port has
to be exclusive: the rule is keyed on the port number alone, so a second Service
holding the same one would be ambiguous.

On kind these node IPs are Docker-bridge addresses (`172.18.x.x`), which is why
the lab issues its requests from a Pod inside the cluster rather than from your
laptop. On a real cluster you would aim a browser or an external load balancer at
exactly the same `<nodeIP>:<nodePort>` pair.

### 5. A LoadBalancer Service over the same Pods

```
kubectl apply -f lb-service.yaml
kubectl get svc web-lb
```

`lb-service.yaml` has the same selector and the same ports as `web-nodeport`. The
only difference in the entire manifest is the word `LoadBalancer` in `spec.type`
— which is worth pausing on, because it means the manifest contains no
description of a load balancer at all. No size, no algorithm, no certificate, no
subnet. Everything about the resulting appliance is supplied by an implementation
outside the cluster.

Watch what the Service already has: a ClusterIP, and a node port of its own,
different from `web-nodeport`'s. The types nest all the way up.

```
ClusterIP     → a virtual IP, reachable inside the cluster
NodePort      → ClusterIP + a port on every node
LoadBalancer  → NodePort + a request for an external address
```

### 6. The external address never arrives

```
kubectl get svc web-lb
kubectl get svc web-lb -o jsonpath='{.status.loadBalancer.ingress}'
```

`EXTERNAL-IP` reads `<pending>`, and `.status.loadBalancer.ingress` is empty — not
zero-valued, not error-valued, *empty*. The run script polls it for a full thirty
seconds and asserts it is still empty at the end, which is the one assertion here
that can only be made by waiting, because what is being proved is that nothing
happens.

**This is the correct result on kind, and it is exactly what the flashcard
claims.** A LoadBalancer Service on a cluster with no cloud provider stays
`<pending>` forever. It is not a misconfiguration, not a race you can wait out,
and not something the sandbox failed to install. It is the observable shape of a
request that nobody is on the other end of.

### 7. Why: read the events, and find none

```
kubectl describe svc web-lb
```

Two things are absent from the output and both of them are the evidence.

There is no `LoadBalancer Ingress:` line, because `kubectl describe` prints that
line only when the status field it reads is populated. And the `Events:` section
is empty — the run script asserts that not one event has ever been recorded
against this Service.

That silence is the diagnosis. On a cloud, a service controller would have posted
`EnsuringLoadBalancer` within a second or two of the Service being created, then
`EnsuredLoadBalancer` when the appliance came up, or `SyncLoadBalancerFailed` if
it could not. Here there is nothing at all, because the controller that emits
those events lives in a **cloud-controller-manager**, and this cluster has no
such Pod. The lab asserts that too.

This is the practical version of the lesson, and it transfers straight to a real
cluster. A pending LoadBalancer Service *with* `SyncLoadBalancerFailed` events is
a quota, subnet, or permissions problem in the cloud account. A pending
LoadBalancer Service with *no* events at all means nobody is listening — an
absent or crash-looping cloud-controller-manager, or a bare-metal cluster where
one was never expected.

`LoadBalancer` is the one Service type Kubernetes cannot implement by itself.
ClusterIP and NodePort are kube-proxy rules on machines Kubernetes already owns;
an external load balancer is a machine somebody else has to build. So the API
records the request faithfully and waits.

#### Why this sandbox does not install cloud-provider-kind

There is a project, `cloud-provider-kind`, that supplies the missing controller
and will hand kind Services a real external IP. This sandbox deliberately does
not use it, for two reasons.

The first is scope. `cloud-provider-kind` has no cluster selector: it watches the
Docker daemon and adopts **every** kind cluster on the machine, including ones
belonging to other work that happen to be running at the same time. It also
installs Gateway API CRDs into each cluster it adopts. Cluster-scoped CRDs
appearing in someone else's unrelated cluster is not a side effect a teaching
sandbox is entitled to cause.

The second is pedagogy. `<pending>` is the behaviour the CKA expects you to
recognise and explain. Papering over it would remove the exact thing this lab
exists to show.

### 8. `<pending>` is not broken

```
kubectl exec client -- wget -q -O - http://<node internal IP>:<web-lb nodePort>/hostname
kubectl exec client -- wget -q -O - http://<web-lb ClusterIP>/hostname
```

Both succeed, and the run script asserts both. This is the part that is easy to
get wrong under exam pressure: a LoadBalancer Service sitting at `<pending>` is
fully functional on the two layers underneath it. Its ClusterIP works, its node
port works on every node. Only the top layer — the external address — is missing.

## What this proves

A NodePort Service reserves one port from the apiserver's
`--service-node-port-range`, which defaults to 30000–32767, and kube-proxy opens
it on every node in the cluster rather than on the node running the Pod. The lab
demonstrated this with a single replica and every node's IP answering
identically, most of them hosting nothing. A node without a local endpoint DNATs
the request onward, which is what makes `<nodeIP>:<nodePort>` a stable address
that survives rescheduling, and what forces the port to be exclusive cluster-wide.

The range is enforced, not advised: the apiserver rejected `nodePort: 39999` and
quoted `30000-32767` back. Moving that window is an apiserver flag, never a
Service field.

The three types nest rather than compete. `web-lb` had a ClusterIP, a node port,
and an unfulfilled external-address request simultaneously — which is why it kept
serving traffic the whole time its `EXTERNAL-IP` read `<pending>`.

And that top layer is the only one Kubernetes cannot build for itself. With no
cloud-controller-manager, `.status.loadBalancer.ingress` stays empty and
`kubectl describe` shows no events whatsoever — not a failure event, none at all.
On kind that is the correct outcome. In the field, the presence or absence of
those events is the fastest split in the diagnosis: events that report failure
point at the cloud account, and total silence points at a missing controller.

## See also

- Study guide → Services and Networking
- Flashcards: `service-nodeport`, `service-loadbalancer`, `service-types`,
  `service-node-port-range`, `kube-proxy`
- Related: `service-clusterip` — the layer underneath both of these, and where
  Service DNS names and EndpointSlices are covered properly
- Related: `ingress` — the usual answer to "one load balancer, many services",
  and the reason a cluster rarely wants thirty LoadBalancer Services
