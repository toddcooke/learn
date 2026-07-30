# ResourceQuota and LimitRange

**CKA domain:** Cluster Architecture, Installation and Configuration

A ResourceQuota budgets a namespace and a LimitRange fills in what individual
containers forget to declare, and the two are almost always deployed together
because each one creates a problem the other solves. The detail that catches
people out is where the enforcement lands: a quota is checked against **Pods**,
so a Deployment whose Pod template cannot possibly fit is still written to etcd
without a murmur, and the refusal shows up minutes later on an object nobody
was looking at. This lab creates exactly that situation, finds the error where
it actually lives, fixes it, and then shows how a LimitRange rescues manifests
that the quota has quietly made illegal.

## Run it

```
bash run.sh          # the whole walkthrough, then cleans up
KEEP=1 bash run.sh   # leaves the namespace running so you can poke at it
```

## Walkthrough

### 1. Budget the namespace

```
kubectl apply -f quota.yaml
kubectl describe quota compute-budget
```

`compute-budget` caps `requests.cpu` at `500m` and `requests.memory` at
`512Mi`. Those are namespace-wide totals summed across every non-terminal Pod,
not per-Pod ceilings — the quota does not care how you divide the budget up.
`describe` prints a Used/Hard table that starts at zero and is the single most
useful command in this lab.

Note that `cpu` and `memory` are accepted as quota resource names too, and mean
exactly `requests.cpu` and `requests.memory`. Spelling out `requests.` is worth
the extra characters: it makes it obvious to the next reader that limits are
unbudgeted here.

### 2. Create a Deployment that cannot possibly fit

```
kubectl apply -f deployment-bulky.yaml
kubectl get deploy bulky
```

`bulky` asks for two replicas at `900m` of cpu each. The budget is `500m`, so
not even one replica fits. The `apply` **succeeds**. So does the ReplicaSet the
Deployment controller creates a moment later. Zero Pods exist.

This is the point of the whole lab. ResourceQuota is enforced by an admission
plugin that runs on Pod creation, and a Deployment is not a Pod — it is a
record of intent. Nothing in the API server's admission chain evaluates a Pod
template against a quota, so every workload controller in Kubernetes
(Deployment, ReplicaSet, StatefulSet, DaemonSet, Job, CronJob) can be created
with a template that will never be admitted. The upstream documentation says
this plainly: creating the Deployment succeeds, but it may not be able to get
all of the Pods it manages to exist.

### 3. Find the error, which is not where you looked

```
kubectl describe deployment bulky      # says nothing about a quota
kubectl describe rs -l app=bulky       # "exceeded quota: compute-budget, ..."
```

The ReplicaSet controller is the thing that actually calls `create pod`, so it
is the thing that receives the `403 Forbidden`. It records a `FailedCreate`
Warning event whose message is the full quota arithmetic:

```
Error creating: pods "bulky-…" is forbidden: exceeded quota: compute-budget,
requested: requests.cpu=900m, used: requests.cpu=0, limited: requests.cpu=500m
```

The Deployment is not entirely silent — it inherits a `ReplicaFailure`
condition from its ReplicaSet, and that condition's `message` field does carry
the quota error. But `kubectl describe deployment` prints conditions as
Type/Status/Reason and drops the message column, so what you are shown is:

```
Conditions:
  Type            Status  Reason
  Available       False   MinimumReplicasUnavailable
  ReplicaFailure  True    FailedCreate
```

`FailedCreate` with no explanation. The two ways to get the sentence back are
to describe the ReplicaSet, or to read the condition directly:

```
kubectl get deploy bulky -o jsonpath='{.status.conditions[?(@.type=="ReplicaFailure")].message}'
```

Build the habit now. "Deployment is stuck at 0/2" is one of the most common
things you will be handed in an exam or an incident, and quota exhaustion looks
identical to an unschedulable Pod until you go one object deeper — except that
with a quota failure there is no Pending Pod to describe at all, because the
Pod was never created.

### 4. Fix the Pod template, not the Deployment

```
kubectl set resources deploy/bulky --requests=cpu=150m,memory=64Mi
kubectl rollout status deploy/bulky
kubectl describe quota compute-budget
```

Two replicas at `150m` come to `300m`, comfortably inside the budget, and the
rollout completes. Nothing about the Deployment *as an object* was wrong and
nothing about it changed except the numbers inside `spec.template`. Quota
arithmetic is done on Pods, so the Pod template is the only place a quota fix
can go — scaling replicas down is the other lever on the same equation.

### 5. Budgeting a resource makes declaring it mandatory

```
kubectl apply -f pod-no-resources.yaml
# Error from server (Forbidden): pods "no-resources" is forbidden:
# failed quota: compute-budget: must specify requests.cpu,requests.memory
```

`pod-no-resources.yaml` is an ordinary Pod with no `resources:` block at all —
the shape of most manifests written before their author has met a quota. It is
refused, and the refusal is a different failure from step 2: this Pod does not
exceed anything, it simply declines to say what it wants, and a quota system
cannot count what has not been declared.

This is the side effect nobody asks for. Adding a quota for accounting reasons
instantly breaks every requestless manifest in the namespace. Declaring only
`limits.cpu` would satisfy it too, because the API server copies a missing
request down from the limit — but "declare something" is now compulsory.

### 6. A LimitRange supplies the missing declaration

```
kubectl apply -f limitrange.yaml
kubectl apply -f pod-no-resources.yaml     # the same file, now accepted
kubectl get pod no-resources -o jsonpath='{.spec.containers[0].resources}'
```

The Pod is created, and the stored object comes back carrying requests and
limits that the submitted YAML never contained: `requests.cpu=100m` and
`requests.memory=64Mi` from `defaultRequest`, `limits.cpu=200m` and
`limits.memory=128Mi` from `default`.

The ordering is what makes this work. LimitRanger is a *mutating* admission
plugin and it runs **before** the ResourceQuota plugin, so the Pod the quota
evaluates is not the Pod that was submitted — it already has requests by the
time the quota looks at it, and the "must specify" rejection never fires.

Two caveats worth carrying away. Defaults are stamped in at admission and only
at admission: adding a LimitRange does not retroactively touch running Pods,
which is why the `bulky` Pods keep the numbers they were created with. And a
LimitRange does more than defaulting — `min`, `max` and `maxLimitRequestRatio`
on the same object reject Pods outright rather than mutating them. This lab
exercises only the defaulting half.

### 7. Injected requests are real requests

```
kubectl describe quota compute-budget      # used requests.cpu: 400m
kubectl apply -f pod-too-big.yaml
# Error from server (Forbidden): pods "too-big" is forbidden: exceeded quota:
# compute-budget, requested: requests.cpu=300m, used: requests.cpu=400m,
# limited: requests.cpu=500m
```

Usage has climbed to `400m`: two Deployment Pods at `150m` plus the `100m` the
LimitRange handed to `no-resources`. A default is not a discount — it is
charged to the budget exactly like a request the author typed.

So `pod-too-big.yaml`, which asks for a well-formed and quite modest `300m`, is
refused because `400m + 300m > 500m`. The arithmetic is identical to the
Deployment's failure in step 2. The experience is not: a bare Pod fails in your
terminal where you cannot miss it, while anything created by a controller fails
somewhere you have to go and look.

## What this proves

ResourceQuota is a Pod-level admission check. Workload objects are never
evaluated against it, so `kubectl apply` on a Deployment, StatefulSet or Job
whose template cannot fit returns success and leaves you with a workload that
reports 0 available replicas and no Pending Pod to blame. The error exists, but
it is a `FailedCreate` event on the ReplicaSet, and although the Deployment
inherits a `ReplicaFailure` condition, `describe deployment` hides that
condition's message. Diagnosis means describing the ReplicaSet or reading the
condition with `-o jsonpath`.

Budgeting `cpu` or `memory` in a namespace silently makes that resource
mandatory: every new Pod must declare a request (or a limit, from which the
request is copied) or admission refuses it with `must specify`. A LimitRange is
the standard answer — its `defaultRequest` and `default` values are injected by
a mutating plugin that runs ahead of the quota check, so requestless manifests
keep working and the values they receive count against the budget like any
other. The quota caps the namespace; the LimitRange makes individual Pods
well-formed enough to be counted. Deploy one without the other and you get
either an unenforceable budget or a namespace where half the team's manifests
stop applying.

## See also

- Study guide → Cluster Architecture, Installation and Configuration
- Flashcards: `resourcequota`, `limitrange`, `resource-requests`,
  `resource-limits`, `admission-controllers`
- Related: `cluster-architecture/namespaces` — the boundary a quota attaches to
- Related: `workloads-scheduling/requests-limits` — what the scheduler and the
  kubelet do with the numbers a quota is counting
