# ConfigMap and Secret

**CKA domain:** Workloads & Scheduling

A ConfigMap holds configuration outside the container image so that one image
can run in dev and in production. That much is easy. What trips people up is
that the *way* you create one decides which keys it ends up with, and the *way*
a Pod consumes one decides whether a later update ever reaches the running
process. This lab creates a ConfigMap three ways, changes it while two Pods are
watching, and measures which consumers noticed — then settles two things
everybody half-knows about the neighbouring object: `immutable: true` really is
a one-way door, and a Secret really is only base64.

## Run it

```
bash run.sh          # the whole walkthrough, then cleans up
KEEP=1 bash run.sh   # leaves the namespace running so you can poke at it
```

Expect two to three minutes. Most of that is a single deliberate wait: proving
that a mounted file eventually catches up means actually waiting out the
kubelet's next sync.

## Walkthrough

### 1. Three ways to fill a ConfigMap

`kubectl create configmap` takes three data sources, and they are not
interchangeable.

```
kubectl create configmap app-literal --from-literal=GREETING=hello-v1 --from-literal=TIER=dev
kubectl create configmap app-file    --from-file=banner.txt
kubectl create configmap app-env     --from-env-file=app.env
```

`--from-literal` is the direct one: you name the key, you give the value.

`--from-file` makes **one key per file**, and the key is the file's basename
with the directory path stripped — hand it `/tmp/xyz/banner.txt` and the key is
`banner.txt`. The value is the file's entire contents, newlines included. Point
it at a directory instead and you get one key per file in that directory. You
can override the key name with `--from-file=<key>=<path>`.

`--from-env-file` does the opposite: it *parses* the file as `KEY=value` lines
and makes one key per line, discarding blank lines and `#` comments. The file
itself never appears as a key.

The run creates `banner.txt` and `app.env` in a `mktemp -d` scratch directory
and deletes it afterwards, so nothing is left on your disk.

The contrast is worth seeing directly, because it is a classic exam trap. The
run feeds the *same* `app.env` through `--from-file`:

```
kubectl create configmap app-env-asfile --from-file=app.env
kubectl get cm app-env-asfile -o yaml
```

That object has exactly one key, `app.env`, whose value is the raw text of the
file. There is no `LOG_LEVEL` key at all, so `configMapKeyRef` for `LOG_LEVEL`
against it would leave the Pod stuck in `CreateContainerConfigError`.

### 2. A Secret is the same shape

```
kubectl create secret generic db-cred --from-literal=username=appuser --from-literal=password='s3cr3t-p@ssw0rd'
kubectl get secret db-cred -o jsonpath='{.type}'
```

Structurally a Secret is a ConfigMap that signals intent. With no `--type` it
comes out as `Opaque`, the catch-all for arbitrary key/value pairs; the built-in
types (`kubernetes.io/tls`, `kubernetes.io/dockerconfigjson`,
`kubernetes.io/basic-auth`) simply require particular keys so that controllers
know what they are looking at. Notice, too, that the password just went through
your shell in cleartext and is now in your history file. Step 9 explains why
that is less of an outlier than it sounds.

### 3. Two Pods consuming the same key three ways

```
kubectl apply -f consumer.yaml
kubectl apply -f pinned.yaml
```

`consumer` takes `app-literal` twice over: `envFrom` injects every key as an
environment variable, and a volume mount surfaces every key as a file under
`/etc/appconfig`. It also pulls a single key out of `app-env` with
`configMapKeyRef`, renaming `LOG_LEVEL` to `APP_LOG_LEVEL` on the way in, and
mounts the `db-cred` Secret at `/etc/dbcred`.

`pinned` is a second, deliberately separate Pod that mounts one key of the same
ConfigMap with `subPath`. It is separate so that whatever it does cannot be
blamed on the first Pod's volume.

### 4. What the containers see at start

```
kubectl exec consumer -- sh -c 'echo "GREETING=$GREETING TIER=$TIER APP_LOG_LEVEL=$APP_LOG_LEVEL"'
kubectl exec consumer -- ls -l /etc/appconfig
kubectl exec consumer -- cat /etc/appconfig/GREETING
kubectl exec pinned   -- cat /etc/pinned/GREETING
```

All three routes report `hello-v1`, which is the point: right now they agree.

The `ls -l` is worth a look. The entries in `/etc/appconfig` are symlinks
pointing into a hidden `..data` directory, which is itself a symlink to a
timestamped directory. That double indirection is how the kubelet swaps an
entire ConfigMap atomically — it writes a fresh timestamped directory and moves
one symlink, so a process reading the directory never sees it half-updated.

### 5. Change the ConfigMap

```
kubectl patch configmap app-literal --type merge -p '{"data":{"GREETING":"hello-v2"}}'
kubectl get cm app-literal -o jsonpath='{.data.GREETING}'
kubectl exec consumer -- sh -c 'printf "%s" "$GREETING"'
```

The stored object says `hello-v2` immediately. `TIER` is untouched, because a
merge patch only replaces the keys it names.

The environment variable inside the running container still says `hello-v1`,
and it always will. This is not a Kubernetes limitation so much as a Unix one:
a process environment is copied in at `exec(2)` and nothing outside the process
can rewrite it afterwards. `envFrom` is a snapshot, not a subscription.

### 6. The mounted file catches up; the env var and the subPath copy never do

```
kubectl exec consumer -- cat /etc/appconfig/GREETING   # eventually hello-v2
kubectl exec consumer -- sh -c 'printf "%s" "$GREETING"'  # still hello-v1
kubectl exec pinned   -- cat /etc/pinned/GREETING      # still hello-v1
```

The mounted file does change, but not instantly. The kubelet re-checks mounted
ConfigMaps on its periodic sync and reads them from its own local cache, so the
worst-case lag is the kubelet sync period plus the cache propagation delay
(which is the watch propagation delay by default, the cache TTL if the kubelet
is configured for TTL caching, and zero if it is configured to hit the API
server directly). The lab allows 150 seconds, which is generous for a default
kubelet. If your application needs the new value the moment it lands, you have
to watch the file yourself or ask to be restarted — Kubernetes will not signal
you.

Meanwhile the `subPath` mount stays at `hello-v1`. `subPath` resolves to a
single path once, at mount time, and bind-mounts it into the container. The
atomic symlink swap above happens *behind* that bind mount, so the container
keeps looking at the file it resolved at startup. This is the trap the lab
exists for: `subPath` reads like a volume mount in the manifest and behaves
like an environment variable at runtime. The run also asserts both containers'
`restartCount` is still `0`, so none of this can be explained away by a restart
having quietly reloaded something.

### 7. Only a restart refreshes the environment

```
kubectl delete pod consumer
kubectl apply -f consumer.yaml
kubectl exec consumer -- sh -c 'printf "%s" "$GREETING"'   # now hello-v2
```

A new container reads the ConfigMap again and gets the current value. For a
bare Pod that means recreating it; for a Deployment the one-liner is
`kubectl rollout restart deployment/<name>`, which does it as a normal rolling
update. A common production pattern is to put a hash of the ConfigMap into a
Pod template annotation, so that changing the config changes the template and
triggers the rollout automatically.

### 8. `immutable: true` is a one-way door

```
kubectl apply -f immutable.yaml
kubectl patch configmap app-frozen --type merge -p '{"data":{"GREETING":"try-me"}}'
kubectl patch configmap app-frozen --type merge -p '{"immutable":false}'
```

Both patches are rejected, each with ``field is immutable when `immutable` is
set``. The second rejection is the interesting one: you cannot clear the flag, so
there is genuinely no route back. Delete and recreate is the only way to change
the contents, and any Pod already consuming the old object needs recreating too
— it holds a mount to a ConfigMap that no longer exists.

The recreated object carries no `immutable` field, which makes the point that
immutability is a property of the object, not of the name.

Immutability is not only a safety rail against fat-fingered edits. The kubelet
stops watching immutable ConfigMaps and Secrets altogether, which measurably
reduces API server load on clusters where thousands of Pods mount the same
config. The usual pattern is a versioned name — `app-config-v7` — swapped in by
a new Deployment revision.

### 9. A Secret is encoded, not encrypted

```
kubectl describe secret db-cred
kubectl get secret db-cred -o jsonpath='{.data.password}'
kubectl get secret db-cred -o jsonpath='{.data.password}' | base64 -d
kubectl get secret db-cred -o go-template='{{.data.password | base64decode}}'
kubectl exec consumer -- cat /etc/dbcred/password
```

`kubectl describe` is polite about it: it lists the key names and the size of
each value, and prints none of the values. That politeness is the whole of the
protection at the CLI layer. `kubectl get -o jsonpath` hands over
`czNjcjN0LXBAc3N3MHJk`, and a single `base64 -d` turns it back into
`s3cr3t-p@ssw0rd`. `kubectl` will even do the decoding for you — `base64decode`
is a built-in go-template function precisely because the operation is routine.
Inside the Pod, `/etc/dbcred/password` is an ordinary file containing the
password.

base64 is there so binary values survive a JSON round trip, not to protect
anything. Kubernetes stores Secrets unencrypted in etcd by default, so anyone
who can `get` the Secret, and anyone who can read etcd, has the value. Worse,
anyone who can create a Pod in the namespace can mount any Secret in it and
read it out — which includes anyone who can create a Deployment. Actual
protection comes from RBAC that restricts `get` on secrets, encryption at rest
configured on the API server, and ideally an external secret store.

## What this proves

How a ConfigMap is created decides its shape. `--from-literal` gives you the
key you named, `--from-file` gives you one key per file named for the file's
basename, and `--from-env-file` parses the file into one key per line. The last
two can be handed the identical file and produce completely different objects,
so "I made a ConfigMap from that file" is never a precise enough statement.

How a ConfigMap is consumed decides whether an update ever reaches the
workload, and this is the part worth memorising cold:

| Consumption | Updates after the ConfigMap changes? |
| --- | --- |
| `envFrom` / `env` + `valueFrom` | Never — needs a Pod restart |
| Volume mount | Yes, after the kubelet sync period + cache propagation delay |
| Volume mount with `subPath` | Never — frozen for the life of the container |

`immutable: true` sidesteps the question by making the object unchangeable,
including the flag itself, in exchange for a delete-and-recreate workflow and
a real reduction in kubelet watch load.

And a Secret is a ConfigMap with a warning label on it. It signals intent, it
gets slightly better handling from tooling, and it is base64-encoded — which is
an encoding, not a protection. Treat "it's in a Secret" as the beginning of a
security argument, never the end of one.

## See also

- Study guide → Workloads and Scheduling
- Flashcards: `configmap`, `configmap-create-consume`, `secret`
- Previous: `pod` — the volume and namespace sharing these mounts sit on top of
- Next: `init-sidecar` — the other reason a container starts with data it did
  not fetch itself
