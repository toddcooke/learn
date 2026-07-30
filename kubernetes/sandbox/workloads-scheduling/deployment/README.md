# Deployment

**CKA domain:** Workloads & Scheduling

A Deployment does not manage Pods. It manages ReplicaSets, and it decides how
fast to scale one up while scaling another down. Once you see the rollout as
arithmetic on two ReplicaSets — bounded above by `maxSurge` and below by
`maxUnavailable` — every `kubectl rollout` subcommand stops being a separate
piece of trivia: history is the drained ReplicaSets that were kept, undo is a
scale-up of one of them, and restart is a one-line edit to the pod template
that happens to change its hash. This lab walks a single Deployment through
all of it and asserts what actually moved.

## Run it

```
bash run.sh          # the whole walkthrough, then cleans up
KEEP=1 bash run.sh   # leaves the namespace running so you can poke at it
```

## Walkthrough

### 1. Create the Deployment

```
kubectl apply -f web.yaml
kubectl rollout status deployment/web
kubectl get rs
```

`web.yaml` asks for three replicas of `agnhost:2.52` with a readiness probe
on `/healthz`, and an update strategy of `maxSurge: 1` / `maxUnavailable: 0`.

Note what `kubectl get rs` shows: a ReplicaSet named `web-<hash>`, which you
never asked for. The Deployment hashed its pod template and created a
ReplicaSet for that hash; the ReplicaSet, in turn, created the Pods. The
hash is stamped on the ReplicaSet, on every Pod it owns, and into the
ReplicaSet's own selector as the `pod-template-hash` label, which is what
keeps two generations of Pods from being claimed by the same controller.

The ReplicaSet also carries `deployment.kubernetes.io/revision: "1"`. That
annotation, not any separate history object, is the revision number you will
see in `rollout history`.

### 2. Read the strategy back

```
kubectl get deploy web -o jsonpath='{.spec.strategy}'
```

`maxSurge: 1` permits one Pod above the desired three during a rollout.
`maxUnavailable: 0` forbids ever having fewer than three available. Together
they force the rollout to be strictly surge-first: create a fourth Pod, wait
for it to be Ready (and to stay Ready for `minReadySeconds`), and only then
delete one of the old ones. That is the setting you want for a server that
must not lose capacity; the cost is that you need headroom for one extra Pod
and that the rollout can never proceed if the cluster cannot schedule it.

Both fields also accept percentages (`25%` is the default for each), which
are resolved against the desired replica count — rounded up for surge, down
for unavailable.

### 3. Trigger a rolling update

```
kubectl set image deployment/web app=registry.k8s.io/e2e-test-images/agnhost:2.53
kubectl annotate deployment/web kubernetes.io/change-cause="upgrade to agnhost 2.53" --overwrite
kubectl rollout status deployment/web
```

`kubectl set image` patches one field of the pod template. Any change to the
pod template starts a rollout; changing `replicas` does not, because
`replicas` is not part of the template.

While the rollout runs, `run.sh` samples `.status.availableReplicas` twice a
second and then asserts that the minimum it ever saw was 3. That is the
`maxUnavailable: 0` promise, checked rather than assumed.

The `annotate` line is how you fill in the CHANGE-CAUSE column now that
kubectl's old `--record` flag has been removed. The Deployment controller
copies the Deployment's annotations onto whichever ReplicaSet is currently
the new one, so annotating immediately after the change labels the revision
that change created. It is a plain annotation with no special powers: it
describes whatever you typed into it, truthfully or not.

### 4. Two ReplicaSets, one of them empty

```
kubectl get rs -o wide
```

There are now two. The new template hash got a new ReplicaSet, scaled to 3;
the original was scaled to 0 but *not* deleted. Its `IMAGES` column still
reads `agnhost:2.52` — it is a complete, parked copy of the previous pod
template, which is precisely what makes a rollback cheap. How many of these
shells are kept is `revisionHistoryLimit` (10 by default, and 10 here); set
it to 0 and you keep no rollback targets at all.

### 5. rollout history

```
kubectl rollout history deployment/web
kubectl rollout history deployment/web --revision=1
```

The table has one row per surviving ReplicaSet, numbered by the
`deployment.kubernetes.io/revision` annotation, with the change-cause
annotation as the second column. `--revision=1` prints that revision's stored
pod template, and you can read the old image straight out of it.

### 6. rollout undo

```
kubectl rollout undo deployment/web
kubectl rollout status deployment/web
kubectl rollout history deployment/web
```

`undo` with no arguments targets the previous revision (`--to-revision=N`
picks a specific one). Under the hood kubectl replaces the Deployment's
`.spec.template` with the one stored on the target ReplicaSet, and replaces
the Deployment's annotations with that ReplicaSet's annotations — which is
why the change-cause reverts along with the image.

The result is worth watching closely. No third ReplicaSet appears: the
restored template hashes to the ReplicaSet that already existed, so the
controller re-uses it and scales it back to 3. But the history now reads 2
and 3, not 1 and 2. Rolling back is itself a change, so the re-used
ReplicaSet is renumbered to the next free revision. Revision numbers travel
with ReplicaSets; they are not fixed labels on moments in time. A second
`undo` would simply toggle you back.

### 7. rollout pause and resume

```
kubectl rollout pause deployment/web
kubectl set image deployment/web app=registry.k8s.io/e2e-test-images/agnhost:2.53
kubectl get deploy web -o jsonpath='{.status.conditions[?(@.type=="Progressing")].reason}'
kubectl rollout resume deployment/web
```

A paused Deployment still accepts spec edits; it just stops acting on them.
The API server records the new image and bumps `.metadata.generation`, the
controller catches up (`.status.observedGeneration` matches, and the
`Progressing` condition flips to `DeploymentPaused`), and yet not one Pod is
touched. That is the point of pause: batch several edits — image, resources,
env — and let them roll out as a single rollout instead of three.

Pause is also a hard block on rollback. `kubectl rollout undo` on a paused
Deployment refuses with *you cannot rollback a paused deployment; resume it
first*, which is a sharp thing to hit under exam time pressure.

`resume` finishes the rollout. Notice there are still only two ReplicaSets:
this exact pod template was seen before, so its ReplicaSet was re-used again
rather than recreated.

### 8. rollout restart

```
kubectl rollout restart deployment/web
kubectl get deploy web -o jsonpath='{.spec.template.metadata.annotations}'
```

`rollout restart` has no special server-side machinery behind it. It writes
`kubectl.kubernetes.io/restartedAt` with the current timestamp into
`.spec.template.metadata.annotations`. That is a change to the pod template,
so the template hash changes, so a third ReplicaSet is created and the
ordinary rolling update replaces all three Pods — one at a time, still
respecting `maxSurge`/`maxUnavailable`. The image is untouched.

This is the correct way to cycle Pods so they pick up a rewritten ConfigMap
or Secret, or to clear out a wedged process, and it is strictly better than
deleting Pods by hand: deleting Pods is not rate-limited by the update
strategy, so it can take your capacity down.

One last look at `kubectl rollout history` shows the same change-cause on all
three rows. The undo in step 6 replaced the Deployment's annotations with
revision 1's, and every revision created since has inherited them. The
CHANGE-CAUSE column is a label you maintain by hand, not an audit log — read
the stored pod templates when you need the truth.

## What this proves

A Deployment is a controller over ReplicaSets, and the pod-template hash is
its primary key. A template it has never seen becomes a new ReplicaSet; a
template it has seen before is re-used, which is why an update, an undo, and
a resume all landed in just two ReplicaSets, and why the restart — which
changed only an annotation — needed a third.

Everything the `rollout` verbs do follows from that one fact. `status` waits
for the two scale counts to finish converging. `history` reads a revision
annotation off the drained ReplicaSets that `revisionHistoryLimit` kept.
`undo` scales one of those shells back up and renumbers it. `pause` stops the
convergence while still accepting spec edits. `restart` stamps the template
so its hash changes. And `maxSurge`/`maxUnavailable` are the only two numbers
that decide whether all of this is a zero-downtime upgrade or an outage — the
run asserted that `availableReplicas` never fell below 3 while every Pod in
the Deployment was replaced.

## See also

- Study guide → Workloads and Scheduling
- Flashcards: `deployment`, `deployment-rolling-update`, `kubectl-rollout`,
  `replicaset`
- Related: `replicaset` — the thing a Deployment actually manages
- Next: `daemonset` — the same rollout machinery, one Pod per node
