# Init containers and native sidecars

**CKA domain:** Workloads & Scheduling

A Pod's containers do not all start at once. Everything listed in
`.spec.initContainers` runs first, one at a time, in order, and each one must
exit successfully before the next begins — only when the last has finished are
the regular containers started. A native sidecar reuses that machinery with one
field changed: an init container carrying `restartPolicy: Always` still starts
in init position, ahead of every regular container, but the kubelet stops
waiting for it to exit and keeps it alive for the life of the Pod. This lab
watches both orderings happen and then shows the difference that motivated the
feature: in a Job, a sidecar lets the Pod finish and an ordinary container does
not.

## Run it

```
bash run.sh          # the whole walkthrough, then cleans up
KEEP=1 bash run.sh   # leaves the namespace running so you can poke at it
```

## Walkthrough

### 1. Two init containers, run one at a time

```
kubectl apply -f init-order.yaml
kubectl get pod init-order -w
```

`init-order.yaml` declares two init containers — `fetch-config` and
`warm-cache` — followed by one regular container, `app`. Each init container
sleeps twelve seconds, which is long enough to watch the status column move:

```
NAME         READY   STATUS     RESTARTS   AGE
init-order   0/1     Init:0/2   0          5s
init-order   0/1     Init:1/2   0          19s
init-order   1/1     Running    0          31s
```

Read `Init:1/2` as "one of the two has completed", not "one of the two is
running". Only ever one init container is running at a time; the number is a
completion count, which is why it never reaches `2/2` — as soon as the second
one exits, the Pod has left initialization entirely and the column switches to
`Running`.

While all this is happening the regular container has a status of its own:

```
kubectl get pod init-order -o jsonpath='{.status.containerStatuses[*].state.waiting.reason}'
```

It reports `PodInitializing`. The app container is not slow, not unscheduled,
and not failing — it has simply not been started yet, and Kubernetes gives that
situation its own name so you can tell it apart from an image pull or a crash
loop.

### 2. The timestamps say the same thing, precisely

```
kubectl get pod init-order -o jsonpath='{.status.initContainerStatuses[*].state.terminated.exitCode}'
kubectl get pod init-order \
  -o jsonpath='{.status.initContainerStatuses[?(@.name=="warm-cache")].state.terminated.finishedAt}'
kubectl get pod init-order \
  -o jsonpath='{.status.containerStatuses[?(@.name=="app")].state.running.startedAt}'
```

Both init containers end in `state.terminated` with exit code `0`, and the app
container is in `state.running`. Those are different state shapes, and that is
the point: a finished init container is a corpse with an exit code, while a
regular container is a live process with a start time.

Comparing the two is easy because Kubernetes serialises every timestamp as RFC
3339 in UTC, always the same width — `2026-07-30T18:22:53Z`. Fixed-width UTC
strings sort lexicographically in the same order as the instants they name, so
a plain string comparison is a valid time comparison, with no date parsing
anywhere. The run script asserts that the app container's
`state.running.startedAt` is later than `fetch-config`'s
`state.terminated.finishedAt`, and not earlier than `warm-cache`'s.

That second assertion is deliberately the weaker one. These timestamps have
one-second resolution, and the kubelet routinely starts the app container
inside the same second the final init container exited, so demanding *strictly*
later would be a flaky test of a real guarantee. The ordering holds; the clock
is just too coarse to display it.

### 3. The init containers' work is waiting for the app container

```
kubectl exec init-order -c app -- sh -c 'cat /work/config /work/cache'
kubectl logs init-order -c warm-cache
```

The three containers share an `emptyDir` at `/work`. `fetch-config` writes
`/work/config`, `warm-cache` reads it and then writes `/work/cache`, and `app`
reads both. Note that `kubectl logs` takes `-c` for an init container exactly
as it does for a regular one — a finished init container's logs are the first
place to look when a Pod is wedged in `Init:0/2`.

This makes the ordering structural rather than merely observed. `warm-cache`
exits 1 if `/work/config` is missing and `app` exits 1 if either file is
missing, so a Kubernetes that ran these concurrently would produce a Pod that
never becomes Ready, not a Pod that passes the test by luck. Handing work
forward through a shared volume is also the ordinary reason to reach for an
init container: fetch a secret, render a config file, run a schema migration,
wait for a dependency — all with tools and credentials that then vanish before
the application container ever starts.

### 4. A native sidecar: the same list, one extra field

```
kubectl apply -f sidecar-pod.yaml
kubectl get pod sidecar -o jsonpath='{.spec.initContainers[?(@.name=="log-shipper")].restartPolicy}'
```

`sidecar-pod.yaml` puts `log-shipper` in `.spec.initContainers` and gives it
`restartPolicy: Always`. That single field is the whole feature. It does not
mean "restart this if it crashes" in the way the Pod-level field does; on an
init container it means "this one is a companion, not a step" — do not wait for
it to exit, and keep it running as long as the Pod lives.

The status column reflects the change immediately: the Pod reads `Running`
rather than `Init:0/1`, because `kubectl` stops counting a restartable init
container as initialization in progress once it has started.

A sidecar also gets something a plain init container is forbidden: probes. The
API server rejects `livenessProbe`, `readinessProbe` and `startupProbe` on an
ordinary init container, since a container that is about to exit has no steady
state worth probing — but a sidecar accepts all three. `log-shipper` uses a
`startupProbe`, and step 6 shows that the probe is load-bearing.

### 5. Both containers are running at the same instant

```
kubectl get pod sidecar \
  -o jsonpath='{.status.initContainerStatuses[*].state}|{.status.containerStatuses[*].state}'
```

One API read returns both states, so this is a genuine simultaneity check
rather than two reads that might have caught different moments:

```
{"running":{"startedAt":"2026-07-30T18:22:53Z"}}|{"running":{"startedAt":"2026-07-30T18:23:02Z"}}
```

The init container is `running`, not `terminated`, at the same instant the
regular container is running. That is the sentence a plain init container can
never produce, and it is worth noticing where the sidecar's status lives:
`log-shipper` is reported under `.status.initContainerStatuses`, not
`.status.containerStatuses`, however long it stays up. Scripts and dashboards
that scrape only `containerStatuses` will not see your sidecars at all.

### 6. The sidecar still went first

```
kubectl get pod sidecar \
  -o jsonpath='{.status.initContainerStatuses[?(@.name=="log-shipper")].state.running.startedAt}'
kubectl get pod sidecar \
  -o jsonpath='{.status.containerStatuses[?(@.name=="app")].restartCount}'
```

The sidecar's `startedAt` precedes the app container's, and here the comparison
can be strict, because the ordering has been forced wide enough to see. The
sidecar waits eight seconds before creating `/shared/shipper-up`, and its
`startupProbe` tests for that file; the kubelet does not start the app container
until the sidecar's `started` status is true, which for a container with a
startup probe means the probe has passed.

`restartCount: 0` on the app container is the real proof. Its command exits 1
if `/shared/shipper-up` is missing, so had it been started first it would have
failed and been restarted at least once. A Ready Pod with a restart count of
zero means the kubelet genuinely held the application back until its companion
was up — the guarantee that makes sidecars usable for proxies and agents an
application cannot start without.

```
kubectl exec sidecar -c app -- /agnhost connect --timeout=5s 127.0.0.1:9090
```

And the sidecar is not merely alive in the status object: the app container
connects to the port it is serving, over localhost, in the Pod's shared network
namespace.

### 7. The payoff: a Job that can actually finish

```
kubectl apply -f sidecar-job.yaml
kubectl apply -f blocking-job.yaml
kubectl wait --for=condition=Complete job/with-sidecar --timeout=180s
kubectl get jobs
```

These two Jobs are identical apart from one thing: `with-sidecar` declares
`log-shipper` in `initContainers` with `restartPolicy: Always`, and
`no-sidecar` declares the same image, command and container name in
`containers`. Both main containers do five seconds of work and exit 0.

`with-sidecar` completes. When its main container exited, the kubelet tore the
sidecar down on its behalf — sidecars are terminated after the main containers,
in reverse declaration order — and the Pod reached `Succeeded`.

`no-sidecar` never completes, and the run script shows exactly where it is
stuck:

```
kubectl get pod <no-sidecar pod> -o jsonpath='{.status.phase}'
kubectl get pod <no-sidecar pod> \
  -o jsonpath='{.status.containerStatuses[?(@.name=="main")].state}'
```

The Pod's phase is still `Running` even though `main` is `terminated` with exit
code 0, because a Pod reaches `Succeeded` only when *every* regular container
has terminated, and the log shipper has no intention of stopping. The Job's
`.status.succeeded` stays empty and its `.status.active` stays at 1 — forever,
with no error anywhere to explain it.

This is the failure mode the feature was built for. Before sidecars, the
workarounds were all application-level: have the main container call a shutdown
endpoint on its companion, or share a volume and poll for a sentinel file, or
give up and run the companion as a separate Deployment. Moving one container
between two lists replaces all of that.

## What this proves

Init containers are a Pod's serialised prologue. They run one at a time in
declaration order, each to a successful exit, and no regular container starts
until the last of them is done — visible in the status column as `Init:0/2` then
`Init:1/2`, and provable in the API by comparing the app container's
`state.running.startedAt` against every init container's
`state.terminated.finishedAt`.

A native sidecar keeps that starting position and drops the requirement to
finish. It is still an entry in `.spec.initContainers`, so it is still
guaranteed to start before every regular container, but `restartPolicy: Always`
tells the kubelet not to wait for it to exit and to keep it running for the
lifetime of the Pod. Two consequences follow that a plain init container cannot
give you: the sidecar and the application report `state.running` in the same API
read, and the sidecar may carry probes, so a `startupProbe` becomes a real gate
on when the application is allowed to start.

The clearest way to feel the difference is a Job. A Pod is `Succeeded` only when
every regular container has terminated, so a companion process declared as an
ordinary container pins a batch Pod in `Running` and the Job never records a
completion. The identical container declared as a sidecar is shut down by the
kubelet as soon as the main container exits, and the Job completes. Sidecars
have been stable since Kubernetes 1.33 and enabled by default since 1.29, so on
any current cluster this is simply the right way to run a log shipper, a service
mesh proxy or a credential agent alongside batch work.

## See also

- Study guide → Workloads and Scheduling
- Flashcards: `init-containers`, `sidecar-containers`, `pod-lifecycle`,
  `container-restart-policy`, `job-completion`
- Related: `pod` — why containers in a Pod share an address and a filesystem
- Related: `job-cronjob` — completions, backoff, and what "finished" means to a Job
