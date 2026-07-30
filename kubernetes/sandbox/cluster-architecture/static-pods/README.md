# Static Pods

**CKA domain:** Cluster Architecture, Installation and Configuration

Almost every Pod in a cluster arrives the same way: you send a manifest to the
API server, a controller may own it, the scheduler picks a node, and the kubelet
on that node is told what to run. A static Pod skips all of it. You drop a
manifest into a directory on one machine, and the kubelet there runs it because
the file exists — no API server involved, and no way to stop it from the API
server either. This lab creates one on `cka-sandbox-worker`, tries and fails to
delete it with `kubectl`, deletes it properly by removing the file, and then
shows that the cluster's own control plane is four Pods of exactly this kind.

## Run it

```
bash run.sh          # the whole walkthrough, then cleans up
KEEP=1 bash run.sh   # leaves the namespace running so you can poke at it
```

The manifest written onto the node is removed on the way out even under
`KEEP=1`, and even if the run fails part-way. A static Pod left behind cannot be
deleted with `kubectl`, so it would keep running on that worker until somebody
went back to the node and moved the file.

## Walkthrough

### 1. Where the kubelet looks

```
docker exec cka-sandbox-worker grep staticPodPath /var/lib/kubelet/config.yaml
docker exec cka-sandbox-worker ls -A /etc/kubernetes/manifests
```

The kubelet's own configuration file names a directory it watches:
`staticPodPath: /etc/kubernetes/manifests`. (The older equivalent is the
`--pod-manifest-path` command-line flag, which you will still meet on clusters
that predate the kubelet config file.) Every node in this cluster has that
setting, workers included — the worker's directory is simply empty. That is the
first thing to absorb: a worker node is one file away from running a Pod the API
server was never asked about.

Note also which namespace we are about to work in. The lab's own sandbox
namespace goes almost unused, because a static Pod manifest that omits
`metadata.namespace` lands in `default`. The kubelet, not your kubeconfig,
decides that.

### 2. Write a manifest onto the node

```
docker exec -i cka-sandbox-worker sh -c 'cat > /etc/kubernetes/manifests/sandbox-static.yaml'
```

fed with:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: sandbox-static-web
  labels:
    app: sandbox-static
spec:
  containers:
    - name: web
      image: registry.k8s.io/e2e-test-images/agnhost:2.53
      command: ["/agnhost", "netexec", "--http-port=8080"]
      ports:
        - containerPort: 8080
```

`docker exec` is standing in for an ssh session here; on a real cluster you
would be logged into the node. What matters is that no `kubectl` ran, so at this
instant the API server has no idea the file exists.

Look at what the manifest does *not* say. There is no namespace, no `nodeName`,
no `nodeSelector` — the namespace defaults to `default`, and the node is decided
entirely by which machine's disk the file happens to be sitting on. Only a Pod
can be written here: the kubelet reads Pods and nothing else, so a Deployment or
a DaemonSet in this directory is ignored.

One habit worth carrying to production: write the file somewhere else and `mv`
it into the watched directory. The kubelet reacts to filesystem events, and a
move is atomic where a slow write is not.

### 3. The mirror Pod appears

```
kubectl get pod sandbox-static-web-cka-sandbox-worker -o wide
```

Within seconds the Pod exists in the `default` namespace — before the image has
finished pulling, because the object reports the kubelet's intent rather than a
result. The kubelet created a **mirror Pod**: an API object that represents the
static Pod so that it is visible to everyone else. It goes `Running` once the
image is down and the container has started, exactly like any other Pod on that
node. The name is the manifest's name with the node
name appended, which is not decoration: it is what stops the same manifest,
copied to two nodes, from colliding on a single API object. Ask for
`sandbox-static-web` without the suffix and you get `NotFound`.

`.spec.nodeName` is already `cka-sandbox-worker`, and `kubectl exec` into the
mirror works exactly as it would for any other Pod, which is worth proving
rather than assuming — the mirror is a full participant in `exec` and `logs`,
not a stub.

### 4. What marks it as a mirror

```
kubectl get pod sandbox-static-web-cka-sandbox-worker -o jsonpath='{.metadata.annotations}'
kubectl get pod sandbox-static-web-cka-sandbox-worker -o jsonpath='{.metadata.ownerReferences}'
kubectl get events --field-selector involvedObject.name=sandbox-static-web-cka-sandbox-worker
```

Three fingerprints, each of which you can spot on a strange cluster in seconds:

- **Annotations.** `kubernetes.io/config.source: file` says where the kubelet
  read this Pod from, and `kubernetes.io/config.mirror` carries the same hash as
  `kubernetes.io/config.hash` — the object is the shadow of that specific file.
- **Owner reference.** The owner is a `Node`, not a ReplicaSet, Job or
  DaemonSet. No workload controller is involved anywhere. (Deleting the Node
  object is therefore what garbage-collects the mirror.)
- **No `Scheduled` event.** The events are all from the kubelet — `Pulled`,
  `Created`, `Started`. The scheduler never saw this Pod, even though
  `.spec.schedulerName` still reads `default-scheduler`, a field that in this
  case nobody ever consulted.

There is a fourth marking with real operational consequences: the kubelet gives
every file-sourced Pod a blanket toleration for the `NoExecute` effect. Taints
cannot evict a static Pod. Neither can a drain, and cordoning the node is
meaningless because nothing was ever scheduled onto it.

### 5. `kubectl delete` does not delete it

```
kubectl delete pod sandbox-static-web-cka-sandbox-worker
kubectl get pod sandbox-static-web-cka-sandbox-worker
```

The delete is accepted, the object disappears — and then it is back, under the
same name, with a **different UID**. The new UID is the proof that this is a
genuinely new object rather than a slow deletion: the kubelet noticed its mirror
was missing and created another one. The manifest file on the node was never
touched, because `kubectl` had no way to touch it.

This is the whole idea in one observation. The API object is a read-only
projection of a file. Deleting the projection changes nothing about the thing
being projected, so the kubelet simply draws it again.

### 6. Removing the file is the only real delete

```
docker exec cka-sandbox-worker rm -f /etc/kubernetes/manifests/sandbox-static.yaml
kubectl get pod sandbox-static-web-cka-sandbox-worker
```

Now it is gone, and it stays gone. The kubelet is watching the directory, so
this is about as quick as an ordinary Pod delete. The entire lifecycle ran
through the filesystem: the file created the Pod, and the file destroyed it.

### 7. The control plane is four static Pods

```
docker exec cka-sandbox-control-plane ls -A /etc/kubernetes/manifests
kubectl -n kube-system get pod kube-apiserver-cka-sandbox-control-plane \
  -o jsonpath='{.metadata.annotations}'
```

The control-plane node's directory holds `etcd.yaml`, `kube-apiserver.yaml`,
`kube-controller-manager.yaml` and `kube-scheduler.yaml`, and each has a mirror
Pod in `kube-system` with the same `-cka-sandbox-control-plane` suffix and the
same `config.source: file` annotation your Pod had. These four set
`metadata.namespace: kube-system` explicitly, which is the only reason they are
not in `default` alongside the Pod you just built.

The reason kubeadm bootstraps this way follows from the dependency chain: a
Deployment needs a controller manager, which needs an API server, which needs
etcd. None of them can be scheduled before the thing that schedules them exists.
A kubelet reading files off local disk is the one mechanism that works on an
empty machine, so that is what starts the control plane — and it is also what
restarts it, which is why editing `kube-apiserver.yaml` on the node is the
normal way to change an API server flag.

## What this proves

A static Pod is a Pod the kubelet owns outright. You create one by putting a
manifest in the directory named by `staticPodPath` on one specific node, and you
delete one by removing that file. Nothing else — not `kubectl`, not a
controller, not the scheduler — has a vote.

The mirror Pod is the seam between that world and the API. It exists so the Pod
is visible: it appears in `kubectl get pods`, it accepts `exec` and `logs`, and
its status is kept current by the kubelet. But it is a projection, not the Pod
itself, which is why deleting it produced a brand-new object under the same name
a moment later while the container carried on running.

Recognising one matters more than creating one. The name ends in `-<node name>`;
the annotations carry `kubernetes.io/config.source: file` and a `config.mirror`
hash; the `ownerReference` points at a `Node`; and there is no `Scheduled`
event, because `.spec.nodeName` came from the file's location rather than from a
scheduling decision. That last point is why static Pods ignore taints, cordons
and drains — useful when it is the control plane, and a genuine hazard when it
is somebody's forgotten debug Pod that no amount of API access can remove.

## See also

- Study guide → Cluster Architecture, Installation and Configuration
- Flashcards: `static-pod`, `mirror-pod`, `kubelet`, `kubeadm-control-plane`,
  `staticPodPath`
- Related: `cluster-architecture/namespaces` — why the mirror Pod landed in
  `default` and what a namespace does and does not scope
- Related: `workloads-scheduling/daemonset` — the right way to run one Pod per
  node once a control plane exists to do it for you
