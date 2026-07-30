# Job and CronJob

**CKA domain:** Workloads & Scheduling

Every controller you meet before this one is built to keep Pods running. A Job
is built to let them stop: it counts successful exits, and when it has enough
it is finished. That inversion drives everything else about the API — why the
restart policy is constrained, why there are two separate ways to give up, and
why a CronJob does not schedule Pods at all but manufactures Jobs that do. This
lab exercises each of those pieces on a real cluster and asserts the outcome.

## Run it

```
bash run.sh          # the whole walkthrough, then cleans up
KEEP=1 bash run.sh   # leaves the namespace running so you can poke at it
```

It takes roughly two and a half minutes, most of it spent waiting for a
deliberately doomed Job to exhaust its retry backoff.

## Walkthrough

### 1. A Job runs Pods to completion

```
kubectl apply -f parallel-job.yaml
kubectl get job parallel-demo -o jsonpath='{.status.succeeded}'
kubectl get pods -l batch.kubernetes.io/job-name=parallel-demo -o wide
```

`parallel-job.yaml` sets two fields that people routinely conflate:

- `completions: 3` is a **quota**. Three Pods must exit zero before the Job is
  Complete.
- `parallelism: 2` is a **width limit**. At most two Pods may exist at once.

Neither implies the other. Here the Job runs in two waves — two Pods, then one
— so the run asserts both that `.status.active` reaches 2 at some point and
that `.status.succeeded` eventually reaches 3. When the quota is met the Job
stops creating Pods and never recreates the ones that exited. That is the whole
difference from a Deployment, which would treat those same exits as crashes and
restart them forever.

If you omit both fields you get the common case: `completions: 1`,
`parallelism: 1`, one Pod, run once.

### 2. A Job Pod may not have restartPolicy: Always

```
kubectl apply -f bad-restart-policy.yaml
# The Job "always-restart" is invalid: spec.template.spec.restartPolicy:
# Unsupported value: "Always": supported values: "OnFailure", "Never"
```

`Always` means "restart this container whenever it exits, for any reason",
which would make a successful exit indistinguishable from a crash. A Job that
cannot recognise success can never complete, so the API server rejects the
object at validation time rather than creating something permanently stuck. The
only legal values in a Job's Pod template are `Never` and `OnFailure`.

The choice between the two changes what failure looks like. With `Never` each
retry is a brand-new Pod, so failed attempts accumulate as objects you can list
and read logs from. With `OnFailure` the kubelet restarts the container inside
the existing Pod, and the retries show up as a restart count instead. `Never`
is better for anything you will need to debug; `OnFailure` is lighter for
cheap, high-frequency work.

### 3. Indexed completion mode

```
kubectl apply -f indexed-job.yaml
kubectl wait --for=condition=Complete job/indexed-demo --timeout=180s
kubectl logs -l batch.kubernetes.io/job-name=indexed-demo --tail=-1
kubectl logs -l batch.kubernetes.io/job-completion-index=1
```

The default `completionMode: NonIndexed` makes every Pod interchangeable, which
is fine when the Pods pull work off a queue and useless when the work is a
fixed list that has to be divided up front. `completionMode: Indexed` assigns
each Pod a distinct index in `0..completions-1` and delivers it three ways:

- the `JOB_COMPLETION_INDEX` environment variable, set automatically in every
  container of the Pod;
- the annotation `batch.kubernetes.io/job-completion-index`;
- the label `batch.kubernetes.io/job-completion-index`.

The environment variable is what the workload reads — "I am shard 2 of 3, so I
process this third of the input". The label is what you read afterwards: it
makes a single shard selectable, which is why the run asserts that the Pod
labelled index `1` is the same Pod whose log line says `index=1`. If a shard
fails, its replacement is created with the same index, so the assignment is
stable across retries.

### 4. backoffLimit bounds the number of retries

```
kubectl apply -f failing-job.yaml
kubectl get job backoff-demo -o jsonpath='{.status.conditions[?(@.type=="Failed")].reason}'
kubectl get pods -l batch.kubernetes.io/job-name=backoff-demo
```

`backoff-demo` runs a container that prints one line and exits 1, and it will
never do anything else. `backoffLimit: 2` counts **retries, not attempts**, so
the Job creates three Pods in total: the first try plus two more. Between
attempts the Job controller backs off exponentially — ten seconds, then twenty,
doubling up to a six-minute cap — which is why watching a doomed Job die takes
the better part of a minute rather than an instant.

When the retries are exhausted the Job gets a condition of type `Failed` with
status `True` and reason `BackoffLimitExceeded`, and `.status.failed` settles at
3. The run waits on that condition rather than sleeping, then asserts the reason
and the count. Because `restartPolicy` is `Never`, all three failed Pods are
still listed in `Error` state and their logs are still readable — the retry
history is inspectable, not just a number.

### 5. activeDeadlineSeconds outranks backoffLimit

```
kubectl apply -f deadline-job.yaml
kubectl get job deadline-demo -o jsonpath='{.status.conditions[?(@.type=="Failed")].reason}'
# DeadlineExceeded
```

`deadline-demo` runs the same hopeless container, but with `backoffLimit: 6`
and `activeDeadlineSeconds: 20`. Six retries at exponential backoff would be
roughly ten minutes of dying; the twenty-second deadline, measured from
`.status.startTime`, ends it long before that. The Job is marked `Failed` with
reason `DeadlineExceeded`, any live Pod is terminated, and the remaining
retries are simply never taken.

That is the point worth memorising: the two limits are independent, and
whichever is reached first ends the Job. `backoffLimit` bounds how many times
the work may fail; `activeDeadlineSeconds` bounds how long the whole Job may
take, including time spent waiting between retries. When you are reading a
failed Job in a postmortem, the reason string is what distinguishes "ran out of
tries" from "ran out of time".

### 6. A CronJob is a factory for Jobs

```
kubectl apply -f cronjob.yaml
kubectl get cronjob heartbeat
kubectl patch cronjob heartbeat -p '{"spec":{"suspend":true}}'
```

A CronJob schedules nothing directly. When the clock fires, its controller
stamps out one Job from `.spec.jobTemplate`, and that Job creates the Pods —
three objects and three controllers in a chain: CronJob to Job to Pod. Almost
every CronJob problem is really a Job problem one level down, which is why
`kubectl get jobs` is the first place to look when a schedule "does not work".

`schedule: "*/1 * * * *"` is standard five-field cron: minute, hour, day of
month, month, day of week. `concurrencyPolicy: Forbid` decides what happens
when the next slot arrives while the previous Job is still running:

- `Allow` (the default) starts the new run regardless, so two are active;
- `Forbid` skips the new run and lets the straggler finish;
- `Replace` kills the running Job and starts the new one.

`Forbid` is the right choice for anything touching shared state — a report that
occasionally takes seventy seconds should not end up with two copies writing
the same rows. The run asserts the schedule, the policy and the templated
Pod's `restartPolicy` straight off the object; it deliberately does not wait a
minute for the schedule to fire, because nothing is learned from the wait.

Finally, `.spec.suspend` is patched to `true`. Suspending is the safe way to
silence a CronJob during an incident: the object and its Job history survive,
already-running Jobs are left alone, and only future runs stop. Deleting the
CronJob would take the history with it.

### 7. Trigger a CronJob by hand

```
kubectl create job heartbeat-manual --from=cronjob/heartbeat
kubectl wait --for=condition=Complete job/heartbeat-manual --timeout=180s
kubectl logs -l batch.kubernetes.io/job-name=heartbeat-manual
```

`--from` copies a CronJob's job template into a Job that starts immediately,
which is how you test a schedule's payload without waiting for the schedule —
including, as here, while the CronJob is suspended.

The copy is not as standalone as it looks, and the details are worth knowing
because they cut both ways. kubectl adds a
`cronjob.kubernetes.io/instantiate: manual` annotation **and** an
`ownerReference` back to the CronJob with `controller: true`. The run asserts
both, and then asserts something that sits oddly beside them: the CronJob's
`.status.active` never lists this Job.

That split is the real lesson. Ownership is what the garbage collector and the
history limits look at, so deleting the CronJob **does** cascade-delete this
Job, and the Job **does** count against `successfulJobsHistoryLimit` — it can
push a genuinely scheduled run out of the retained history. But
`concurrencyPolicy` is evaluated purely against `.status.active`, which the
manual Job never enters. So a `Forbid` CronJob will start its scheduled run on
time even while your manual Job is still running, which is exactly the
collision `Forbid` looks like it should prevent. You will also see the
controller log an `UnexpectedJob` warning event against the CronJob — "Saw a
job that the controller did not create or forgot".

This shape has changed repeatedly across releases (kubectl has variously set no
controller flag, or set `blockOwnerDeletion` and broken RBAC for it), so it is
worth checking against the version in front of you rather than trusting an
older write-up. The behavior described here is what this cluster actually does.

## What this proves

A Job is the controller for work that ends, and its API is shaped by that one
fact. `completions` is a quota of successful exits and `parallelism` is a cap on
how many Pods may chase that quota at once; the two are independent numbers, and
`completionMode: Indexed` adds stable numbering on top so each Pod can own a
fixed slice of the work. Because a Job must be able to recognise success, its
Pods are restricted to `restartPolicy: Never` or `OnFailure` — a constraint the
API server enforces rather than leaving you to discover. Giving up is bounded
twice and independently: `backoffLimit` caps retries and reports
`BackoffLimitExceeded`, `activeDeadlineSeconds` caps elapsed time and reports
`DeadlineExceeded`, and whichever is reached first is the one that ends the Job.
A CronJob layers only a clock on all of that, delegating the actual work to the
Jobs it creates, which is why debugging one always means following the chain
down to the Job and then to the Pod.

## See also

- Study guide → Workloads and Scheduling
- Flashcards: `job`, `job-backoff-limit`, `job-active-deadline`, `indexed-job`,
  `cronjob`, `cronjob-concurrency-policy`
- Related: `pod` — the restart policy semantics a Job constrains
- Next: `deployment` — the opposite contract, where exiting is always failure
