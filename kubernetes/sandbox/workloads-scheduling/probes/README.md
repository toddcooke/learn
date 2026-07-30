# Probes

**CKA domain:** Workloads & Scheduling

A probe is one thing: a check the kubelet runs against a container on a
schedule and reads an exit code from. What makes probes confusing is that the
same check means three completely different things depending on which field
you write it under. This lab runs the *identical* command — `test -s` against
a file the container wrote — as a liveness probe, then as a readiness probe,
then as a startup probe, and shows that the kubelet's response differs
entirely while the check never changes. Health is toggled by hand rather than
by a timer, so every effect happens exactly when it is caused.

## Run it

```
bash run.sh          # the whole walkthrough, then cleans up
KEEP=1 bash run.sh   # leaves the namespace running so you can poke at it
```

## Walkthrough

### 1. A Pod whose health is a file

```
kubectl apply -f liveness.yaml
kubectl get pod liveness -o jsonpath='{.spec.containers[0].livenessProbe}'
```

The container starts with `echo ok > /tmp/healthy; exec /agnhost netexec
--http-port=8080`, and its liveness probe is `sh -c 'test -s /tmp/healthy'`.
`test -s` succeeds only when the file exists and is non-empty, which means
the lab can turn health off with a shell redirection and back on with an
`echo` — no waiting for a timer, no asserting against a stopwatch.

A probe declares a *mechanism* and a *schedule*. There are four mechanisms:

| Mechanism | Succeeds when |
| --- | --- |
| `exec` | the command exits 0 (any non-zero exit is a failure) |
| `httpGet` | the response status is >= 200 and < 400 |
| `tcpSocket` | the port accepts a connection |
| `grpc` | the standard gRPC health service answers `SERVING` |

And five scheduling fields, whose defaults are worth memorising because most
manifests set only one or two of them:

| Field | Default | Meaning |
| --- | --- | --- |
| `initialDelaySeconds` | 0 | wait this long after the container starts before the first probe |
| `periodSeconds` | 10 | how often to probe |
| `timeoutSeconds` | 1 | a probe that has not answered by now counts as failed |
| `failureThreshold` | 3 | consecutive failures before the kubelet acts |
| `successThreshold` | 1 | consecutive successes before the container counts as healthy again; must be 1 for liveness and startup probes |

The default `timeoutSeconds: 1` catches people out: a health endpoint that
does real work — checking a database, taking a lock — can easily exceed one
second on a loaded node and be recorded as a failure while it is in fact fine.
This lab sets a deliberately impatient `periodSeconds: 2` with
`failureThreshold: 2` so the demonstration finishes in seconds. Do not copy
those numbers into anything real.

### 2. Empty the file, and the kubelet restarts the container

```
kubectl exec liveness -- sh -c ': > /tmp/healthy'
kubectl describe pod liveness      # look at the Events
kubectl get pod liveness
```

`: >` truncates the file without deleting it, so `test -s` starts exiting 1.
Two consecutive failures later the kubelet emits an `Unhealthy` event reading
`Liveness probe failed:`, kills the container, and starts a new one. The
`RESTARTS` column — `.status.containerStatuses[0].restartCount` — goes to 1,
and `.status.containerStatuses[0].lastState.terminated` now holds the record
of the instance that was killed, which is where you look when a container has
already been replaced by the time you arrive.

That is the entire contract of a liveness probe: *if this check fails, the
container is beyond saving; restart it.* The kubelet does not consult a
controller, does not ask the scheduler, and does not care what the container
does for a living.

### 3. A restart is a new container inside the same Pod

```
kubectl get pod liveness -o jsonpath='{.metadata.uid}{" "}{.status.podIP}'
```

The uid and the Pod IP are unchanged from before the restart. Nothing was
rescheduled and nothing was replaced at the Pod level — the Pod object, its
node assignment, and its network sandbox all survived; only the container
inside it was recreated from the image. This is why a liveness probe cannot
rescue a Pod from a sick node, and why `RESTARTS` in `kubectl get pods` is a
count of container restarts rather than of Pods.

It also explains why the Pod recovers here instead of crash-looping. The
replacement container runs the same command, so it writes `/tmp/healthy`
again. A restart always starts from the image, and everything the previous
container wrote into its writable layer is gone. Had `/tmp` been an `emptyDir`
volume, the truncated file would have outlived the container, the probe would
have failed again immediately, and the Pod would sit in `CrashLoopBackOff` —
with the delay between attempts growing exponentially toward a five-minute
ceiling. State that survives a restart is exactly the state a liveness probe
cannot fix.

### 4. The same check, filed under `readinessProbe`

```
kubectl apply -f readiness.yaml
kubectl get endpointslice -l kubernetes.io/service-name=web
kubectl exec client -- curl -sS http://web/hostname
```

`readiness.yaml` builds the same Pod — same image, same file-as-health-signal
— but writes the check under `readinessProbe`, and puts a Service in front of
it plus a `client` Pod to call it from. While the probe passes, the Service's
EndpointSlice carries the Pod's address with `conditions.ready: true`, and a
request through the Service is answered by `web`.

Note what the check itself does *not* say. Nothing in `test -s /tmp/ready`
declares "restart me" or "stop routing to me". The field name is the whole
declaration.

### 5. Empty its file: the address leaves the Service, the container does not restart

```
kubectl exec web -- sh -c ': > /tmp/ready'
kubectl get pod web                      # Running, 0 restarts, READY 0/1
kubectl get endpointslice -l kubernetes.io/service-name=web -o yaml
```

Within a few seconds the Pod's `Ready` condition flips to `False` and the
Service stops carrying its address as a ready endpoint. The run script asserts
that count going from 1 to 0, and asserts in the same breath that
`restartCount` is still 0. Same failing command, opposite consequence.

Look closely at the EndpointSlice rather than trusting the summary. The entry
is generally still there; the endpoint controller sets its `conditions.ready`
(and `serving`) to `false` instead of deleting it, so that consumers can tell
"this backend exists but is not serving" apart from "this backend is gone".
kube-proxy programs only the ready ones, which is why the count that matters
is the count of `ready: true` — and why, once it reaches zero, a connection to
the ClusterIP is refused outright rather than hanging. The server process is
alive and listening the entire time; Kubernetes has simply stopped sending it
work.

### 6. Readiness is reversible, and reversing it costs nothing

```
kubectl exec web -- sh -c 'echo ok > /tmp/ready'
```

`successThreshold` is 1, so the very next passing probe puts the address back
into rotation. No restart, no rescheduling, no lost process state — the Pod
merely stopped and started being a valid destination.

This is the practical lesson of the pair. Anything *temporary* belongs in a
readiness probe: a cold cache, a full work queue, a dependency that is briefly
down. Put a dependency check in a liveness probe instead and a five-minute
database outage becomes a cluster-wide crash loop, because every replica fails
its probe at once and restarting none of them can bring the database back.
The rule of thumb: a liveness probe should only fail for something a restart
would plausibly fix — a deadlock, a wedged event loop, a leaked file
descriptor table.

### 7. A startup probe buys a slow starter time

```
kubectl apply -f startup.yaml
kubectl get pod slow-guarded -o jsonpath='{.status.containerStatuses[0].started}'
kubectl get pods -w
```

`startup.yaml` is a controlled experiment. Both Pods run a container that
sleeps 25 seconds before its server exists, and both carry the same brutal
liveness probe — `failureThreshold: 1`, `periodSeconds: 3`, no initial delay.
The only difference is that `slow-guarded` also declares a `startupProbe` with
`failureThreshold: 20` and `periodSeconds: 3`.

While a startup probe is configured and has not yet succeeded, the kubelet
runs neither the liveness nor the readiness probe, and reports `started:
false` for the container. So `slow-guarded` boots undisturbed, the startup
probe succeeds at around 27 seconds, `started` becomes `true`, the liveness
probe arms itself against a container that is now genuinely healthy, and the
Pod reaches `Ready` with `restartCount` still 0.

`slow-unguarded` has no such protection. Its liveness probe fires about three
seconds in, finds no `/tmp/healthy`, and kills a container that was doing
nothing wrong except being slow. It never survives long enough to reach the
25-second mark, so it restarts forever, each attempt delayed longer than the
last. The run script asserts exactly this contrast: `slow-unguarded`'s
`restartCount` rises above 0 while `slow-guarded`'s stays at 0.

The startup probe's total allowance is `failureThreshold × periodSeconds`
(plus `initialDelaySeconds`) — here 60 seconds. Spend the budget on
`failureThreshold` rather than on a long `initialDelaySeconds`: a large
threshold tolerates a slow start without also penalising a fast one, because
the probe succeeds the moment the container is actually up.

## What this proves

The kubelet ran the same command in all three cases and got the same exit
code. What it did with that answer was decided entirely by the field the check
was written under.

`livenessProbe` answers *is this container beyond saving?* Its remedy is a
restart in place: same Pod, same uid, same IP, a new container built from the
image. That makes it the dangerous one, because its failure mode is
self-inflicted downtime — a probe that fails for a reason a restart cannot fix
turns a degraded service into a crash loop across every replica simultaneously.

`readinessProbe` answers *should traffic go here right now?* Its remedy is to
drop the Pod's address from the ready endpoints of every matching Service.
Nothing restarts, nothing reschedules, and the address returns on the first
passing probe. It is a routing decision, not a lifecycle decision, and it is
the correct home for every transient condition.

`startupProbe` answers *has this thing finished booting?* It has no remedy of
its own beyond killing a container that never starts; its purpose is to
suspend the other two probes while it runs. It exists so that a tight liveness
probe suited to steady-state operation does not have to be loosened — or worse,
replaced by a long `initialDelaySeconds` guess — just to survive startup.

Finally: probes are the kubelet's job, not a controller's. That is why they
keep working when the API server is unreachable, why a liveness restart leaves
no trace in any controller's status, and why the only durable evidence a
restart ever happened is `restartCount` and `lastState.terminated` on the Pod
itself.

## See also

- Study guide → Workloads and Scheduling
- Flashcards: `liveness-probe`, `readiness-probe`, `startup-probe`,
  `probe-mechanisms`, `container-restart-policy`
- Related: `pod` — what a container restart does and does not replace
- Next: `deployment` — where readiness decides whether a rollout may proceed
