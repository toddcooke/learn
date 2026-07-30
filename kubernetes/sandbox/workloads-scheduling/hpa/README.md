# HorizontalPodAutoscaler

**CKA domain:** Workloads & Scheduling

A HorizontalPodAutoscaler is a control loop with a very short body. Every fifteen
seconds it reads one number out of the Metrics API, divides it by the target,
multiplies by the replica count it sees, rounds up, and writes the result to the
target's `scale` subresource. Everything else — the tolerance band, the two
clamps, the stabilization windows, the conditions in `.status` — exists to decide
whether to act on that number, not to compute a different one.

This lab wires the whole path together: metrics-server serving `metrics.k8s.io`,
`kubectl top` reading it, an HPA reading the same thing and writing a replica
count, and a load generator hot enough to make it move. Then it does the part
that is usually left as a formula on a slide: it captures the controller's own
published `currentReplicas` / `currentMetric` / `desiredReplicas` triple and
rebuilds that decision by hand, arithmetic and clamps included.

## Run it

```
bash run.sh          # the whole walkthrough, then cleans up
KEEP=1 bash run.sh   # leaves the namespace running so you can poke at it
```

It needs metrics-server, so it refuses to run on a `--minimal` cluster. Expect
four to six minutes: nothing about autoscaling is instant, and the run spends
most of its time waiting for a controller that deliberately does not hurry.

## Walkthrough

### 1. The workload, and the request that gives "50%" a meaning

```
kubectl apply -f service.yaml
kubectl apply -f web.yaml
kubectl get deploy web -o jsonpath='{.spec.template.spec.containers[0].resources.requests.cpu}'
```

One replica of `agnhost netexec` behind a ClusterIP Service, with
`resources.requests.cpu: 50m`.

That request is not decoration. CPU *utilization* is a percentage of the
container's request — not of the node, and not of a limit. A 50% target against
a 50m request means 25m of CPU per Pod, so changing the request changes what
"50%" means without touching the HPA at all. A container with no CPU request has
no denominator, and an HPA pointed at it reports `<unknown>` for the metric and
refuses to scale.

Note also what the manifest does *not* set: a CPU limit. A limit throttles the
container at its ceiling, which caps measured usage. A workload that can never
exceed its target utilization can never trigger a scale-up.

### 2. kubectl top reads the same API the HPA reads

```
kubectl top pods
```

metrics-server scrapes every kubelet's summary endpoint on a fifteen-second
cycle and serves the aggregate as the `metrics.k8s.io` API. `kubectl top` and
the HPA controller are two clients of that one API, and neither works without
it — the Metrics API is an add-on, not part of the core control plane.

That shared dependency is the fastest triage step you have. An HPA stuck at
`<unknown>/50%` and a `kubectl top pods` that errors are the same fault, and it
is in metrics-server, not in the autoscaler.

### 3. Create the HorizontalPodAutoscaler

```
kubectl apply -f hpa.yaml
kubectl get hpa web
kubectl get hpa web -o yaml
```

`hpa.yaml` is `autoscaling/v2` — the stable API since 1.23, after the `v2beta1`
and `v2beta2` aliases were removed in 1.25 and 1.26. The imperative equivalent,
which is what you want under exam time pressure, is:

```
kubectl autoscale deployment web --cpu-percent=50 --min=1 --max=4
```

Two fields deserve a closer look. `scaleTargetRef` is a reference the controller
resolves to the target's `scale` subresource; it reads and writes `replicas`
there and never touches the Deployment object directly. That indirection is what
lets one controller drive Deployments, ReplicaSets, StatefulSets and custom
resources alike — and it is exactly why a DaemonSet cannot be autoscaled, since
its Pod count follows the node set and it exposes no scale subresource to write
to.

`metrics[0].resource.target` says `type: Utilization` with
`averageUtilization: 50`. The alternative, `type: AverageValue` with something
like `averageValue: 30m`, sets an absolute per-Pod target and ignores the
request entirely.

Idle, the TARGETS column settles at roughly `cpu: 2%/50%` and
`.status.desiredReplicas` reads `1`. Not zero: the formula rounds *up*, so any
non-zero usage on one replica still asks for one replica. An HPA cannot take a
workload to zero at all unless the cluster runs with the alpha `HPAScaleToZero`
feature gate, which is why `minReplicas` may not normally be less than 1.

### 4. Point a load generator at the Service

```
kubectl apply -f load.yaml
kubectl exec load -- wget -q -O - "http://web:8080/shell?cmd=hostname"
```

The load generator is one busybox Pod running one `wget` loop against the
Service. Each request asks agnhost for `/shell?cmd=hostname`, which makes the
*server* fork `/bin/sh` and run a command.

That indirection is deliberate. An idle netexec Pod uses about 1m of CPU and
answers a trivial HTTP request in a fraction of a millisecond, so a plain `wget`
flood would have to sustain thousands of requests a second to push a 50m request
past its target — and the client would burn far more CPU than the server it was
supposed to be measuring. Making the server spend milliseconds per request
inverts that ratio, so a single-threaded client is enough. It is the agnhost
equivalent of the CPU-heavy PHP page in the upstream HPA walkthrough, and it is
why the utilization figures in this run come out in the hundreds of percent
rather than hovering near the target.

The loop is closed — the next request goes out only when the last one comes
back — so it never has more than one request in flight and the load it generates
is self-limiting no matter how many replicas appear to serve it.

### 5. Watch the controller decide

```
kubectl get hpa web --watch
kubectl get hpa web -o jsonpath='{.status.currentReplicas} {.status.desiredReplicas} {.status.currentMetrics[0].resource.current.averageUtilization}'
```

`run.sh` polls that one jsonpath once a second, because reading the three
numbers separately would let them come from different reconciles and there would
be nothing to reconcile at all.

Nothing here is instant, and the delay is worth understanding rather than
waiting out: metrics-server's sample is up to fifteen seconds old, and the HPA
controller re-evaluates on its own fifteen-second period. A decision inside the
first minute is normal, and it is why `--horizontal-pod-autoscaler-sync-period`
exists as a kube-controller-manager flag.

When the decision lands, `.status` publishes all of it at once: the replica
count the controller saw, the utilization it measured across those replicas, and
the replica count it wrote back.

### 6. Reconcile the decision with the formula

```
desiredReplicas = ceil(currentReplicas × currentMetricValue / desiredMetricValue)
```

`run.sh` recomputes the captured decision from the published numbers and asserts
the answer matches `.status.desiredReplicas` exactly. Three rules turn the
formula into what the controller actually did:

- **The tolerance band.** If the ratio is within 10% of 1.0 — that is, a measured
  45% to 55% against this 50% target — the controller treats it as noise and
  changes nothing. Without that band an HPA would rewrite the replica count on
  every sample.
- **The clamps.** `minReplicas` and `maxReplicas` bound the answer. Under this
  lab's load the raw formula asks for far more than four; the controller clamps
  to `maxReplicas: 4` and says so in a `ScalingLimited=True` condition with
  reason `TooManyReplicas` rather than quietly under-serving. Reading that
  condition is how you tell "the autoscaler is happy" from "the autoscaler has
  been at its ceiling for an hour".
- **The rate limit.** The default scale-up policy allows +100% or +4 Pods every
  fifteen seconds, whichever is larger. From one replica that permits five, so
  `maxReplicas: 4` binds first and the rate limit never shows here — but on a
  larger workload it is the reason a scale-up arrives in steps.

Two details about the multiplier are worth carrying away. The controller
averages CPU only over Pods that are Ready and whose metric was collected after
they became Ready; Pods still initializing are set aside, so a half-started
replica cannot drag the average down and cancel the scale-up that created it.
And Pods whose metrics are missing entirely are assumed to be using 0% when
scaling up and 100% when scaling down, which biases every uncertain decision
towards doing less.

### 7. The rescale is on the record

```
kubectl get events --field-selector reason=SuccessfulRescale
kubectl describe hpa web
```

The event reads roughly *New size: 4; reason: cpu resource utilization
(percentage of request) above target*. When an HPA has done something surprising
in the past — at 3am, to a workload that is now quiet again — this event and the
conditions on the object are the only account of it you will get.

### 8. Why spec.replicas has to come out of the manifest

This is the part that bites in production, and `run.sh` proves it in three
applies.

```
kubectl apply -f web.yaml -o jsonpath='{.spec.replicas}'
```

`web.yaml` still says `replicas: 1`. Re-applying that unchanged file while the
HPA holds the Deployment at four resets it to one, with no error and no warning:
apply sent `replicas: 1` because that is what the file says, and three Pods were
terminated for it. Nothing about being managed by an HPA makes a workload's own
spec read-only. The autoscaler notices within a sync period and scales back out,
so the damage is a capacity dip rather than an outage — which is precisely why
this goes unnoticed until the day the dip lands during peak traffic.

The fix is to delete the field, which is what `web-autoscaled.yaml` is:

```
diff web.yaml web-autoscaled.yaml
kubectl apply -f web-autoscaled.yaml -o jsonpath='{.spec.replicas}'
```

The *first* apply of the field-free manifest still drops the count to one, and
that surprises everybody once. Removing a field from a file is not the same as
declining to manage it. `kubectl apply` diffs the new file against the
`kubectl.kubernetes.io/last-applied-configuration` annotation, sees a field that
used to be managed and is now absent, and sends `replicas: null` — which the API
server promptly defaults back to 1.

Apply the same file a second time and the count does not move. `replicas` is
gone from the last-applied annotation as well now, so apply has nothing to say
about it and the autoscaler's number survives every future deploy. That one-time
dip is the whole cost of the migration, and it is a good argument for doing the
removal in a maintenance window rather than in the middle of an incident.

### 9. What scale-down would look like

The lab asserts the way up and only describes the way down, because the way down
is slow by design. Delete the load generator under `KEEP=1` and watch:

```
kubectl delete pod load
kubectl get hpa web --watch
```

Utilization collapses within a minute, and the replica count does not move for
five more. The default `behavior.scaleDown.stabilizationWindowSeconds` is 300:
the controller keeps every recommendation it has made over that window and acts
on the *largest* of them, so a workload sheds replicas only once it has been
quiet for the whole window. Scale-up has no such window (`0` by default) and is
governed only by the rate limit. That asymmetry is the entire flapping defence —
an autoscaler that reacted to a lull as fast as it reacts to a spike would spend
its day starting and stopping Pods.

## What this proves

An HPA is arithmetic plus guard rails. The arithmetic —
`ceil(currentReplicas × currentMetric ÷ target)` — was not taken on faith here:
the run captured the controller's own published triple and reproduced the
`desiredReplicas` it wrote from the `currentReplicas` and utilization it
reported, clamps and all.

Everything the loop depends on is visible from the outside, which is what makes
a broken HPA diagnosable. The metric comes from the Metrics API, so
`kubectl top` failing and the HPA reading `<unknown>` are one fault, not two.
The percentage is measured against the CPU *request*, so the request is not
merely a scheduling hint — it is the denominator, and a workload without one
cannot be autoscaled on utilization at all. The write goes through the target's
`scale` subresource, which is why the same controller drives Deployments and
StatefulSets and why it cannot drive a DaemonSet.

And the replica count now has exactly one owner. Leaving `spec.replicas` in a
manifest that an HPA manages means every apply — every CI deploy, every GitOps
sync — silently overwrites the autoscaler's decision with a number somebody
typed months ago, and the first apply after you finally delete the field costs
you one more dip to 1.

## See also

- Study guide → Workloads and Scheduling
- Flashcards: `hpa`, `hpa-scaling-formula`, `hpa-spec-replicas-removal`,
  `hpa-daemonset-exception`, `metrics-server`
- Related: `resources-qos` — where the CPU request that anchors "50%" comes from,
  and what a CPU limit would do to the measurement
- Related: `deployment` — the object whose `scale` subresource the HPA writes to,
  and the rollout machinery that replaces the Pods it adds
- Related: `probes` — readiness is what decides whether a new replica's CPU
  counts towards the average yet
