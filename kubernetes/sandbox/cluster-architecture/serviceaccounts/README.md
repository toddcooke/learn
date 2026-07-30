# ServiceAccounts and their tokens

**CKA domain:** Cluster Architecture, Installation & Configuration

Every Pod in a Kubernetes cluster runs as a ServiceAccount, and every Pod that
does not opt out is handed a live API credential for it — a JWT the kubelet
drops into the container filesystem at
`/var/run/secrets/kubernetes.io/serviceaccount/token`. Most people learn this as
a sentence and never look at the file. This lab picks the token apart, uses it
to call the API server from inside the Pod, and watches the answer change from
`403 Forbidden` to `200 OK` when a Role and a RoleBinding appear — the same Pod,
the same token string, no restart. Along the way it shows the two other ways to
get a credential for a ServiceAccount, and why one of them is a relic.

## Run it

```
bash run.sh          # the whole walkthrough, then cleans up
KEEP=1 bash run.sh   # leaves the namespace running so you can poke at it
```

Expect a minute or two. Everything the lab creates is namespaced, so the
namespace delete at the end takes all of it with it.

## Walkthrough

### 1. A ServiceAccount, and a Pod that runs as it

```
kubectl apply -f serviceaccount.yaml
kubectl apply -f caller.yaml
kubectl get pod caller -o jsonpath='{.spec.serviceAccountName}'
```

A ServiceAccount is close to nothing: a name in a namespace and a UID. It holds
no rules, has no password, and grants no access. It exists so that a RoleBinding
has a subject to name, so the audit log has something to record, and so the
kubelet has an identity to mint tokens for.

`caller.yaml` sets `serviceAccountName: api-reader`. Had it not, the
ServiceAccount admission plugin would have written `default` into the field
instead — on a running Pod that field is never empty. The namespace's `default`
ServiceAccount is exactly as powerless as this one, which is why sharing it
across a namespace is a habit worth breaking: the moment somebody grants
`default` a permission, every Pod in the namespace that never asked for one has
it too.

### 2. What the kubelet projected into the Pod

```
kubectl exec caller -- ls -l /var/run/secrets/kubernetes.io/serviceaccount
kubectl get pod caller -o jsonpath='{range .spec.volumes[*]}{.name}{"\t"}{.projected.sources[*].serviceAccountToken.expirationSeconds}{"\n"}{end}'
```

Three files are there — `token`, `ca.crt`, `namespace` — and `caller.yaml` asked
for none of them. The same admission plugin that filled in the ServiceAccount
name also appended a projected volume called `kube-api-access-<random>` to the
Pod, with three sources:

- a `serviceAccountToken` source, which makes the kubelet call the
  **TokenRequest** API and write the result to `token`;
- a `configMap` source reading `ca.crt` out of `kube-root-ca.crt`, the ConfigMap
  the control plane publishes into every namespace so that workloads can verify
  the API server's certificate;
- a `downwardAPI` source writing the Pod's own namespace to `namespace`.

The run asserts that the projected `ca.crt` really is the same certificate as
the one in the `kube-root-ca.crt` ConfigMap, and that the `namespace` file says
what you think it says. That last file is not a nicety: an in-cluster client has
no other way to discover which namespace it is running in, which is why every
Kubernetes client library reads it.

The `ls -l` is worth a look on its own. The entries are symlinks into a hidden
`..data` directory, which is itself a symlink to a timestamped directory. That
is how the kubelet swaps a rotated token in atomically, so a process reading the
file never catches it half-written.

### 3. The token is a JWT bound to this Pod

```
kubectl exec caller -- cat /var/run/secrets/kubernetes.io/serviceaccount/token
```

Three base64url segments separated by dots: header, payload, signature. Decode
the middle one and the interesting claims are these.

`sub` is `system:serviceaccount:<namespace>:<name>`. That string is the
username, and it is how RBAC will refer to this Pod. Namespace and name together
make the identity — `api-reader` in one namespace and `api-reader` in another
are unrelated subjects.

The `kubernetes.io` claim names the Pod and the node. That is what "bound token"
means: the API server checks that the named Pod still exists before accepting
the token, so a token copied out of a container stops working when the Pod goes
away. It is the single biggest reason the pre-v1.22 scheme was replaced.

`exp` is present, so the credential is not open-ended. Do not, however, read
`exp` as the rotation interval. On a default cluster
(`--service-account-extend-token-expiration=true`) the API server pushes `exp`
a year out as a compatibility measure for old clients that cached the token
forever, while recording the real deadline in a `kubernetes.io/warnafter` claim
and counting late requests in the `serviceaccount_stale_tokens_total` metric.
The kubelet rewrites the file at roughly 80% of the *requested* lifetime either
way. The practical consequence for application code: re-read the file, do not
cache the string you saw at startup.

### 4. Calling the API from inside the Pod: 403 Forbidden

```
kubectl exec caller -- sh -c '
  curl -s -o /dev/null -w "%{http_code}" \
    --cacert /var/run/secrets/kubernetes.io/serviceaccount/ca.crt \
    -H "Authorization: Bearer $(cat /var/run/secrets/kubernetes.io/serviceaccount/token)" \
    https://kubernetes.default.svc/api/v1/namespaces/$(cat /var/run/secrets/kubernetes.io/serviceaccount/namespace)/pods'
```

That is, in three lines, everything an in-cluster client does: the token as a
bearer credential, the projected CA to verify the server, and
`kubernetes.default.svc` — the ClusterIP Service that fronts the API server in
every cluster.

The answer is `403`, and the body is the informative part:

```
pods is forbidden: User "system:serviceaccount:sandbox-serviceaccounts:api-reader"
cannot list resource "pods" in API group "" in the namespace "sandbox-serviceaccounts"
```

Read that carefully, because it says authentication *succeeded*. The API server
knows precisely who is calling — it quotes the username back — and has decided
that this subject may not perform this verb on this resource. A fresh
ServiceAccount is bound to `system:discovery` and essentially nothing else, so
it can read `/api` and `/openapi` and go no further.

Keep the two failures apart:

| Status | Meaning |
| --- | --- |
| `401 Unauthorized` | The API server could not establish who you are. |
| `403 Forbidden` | It knows exactly who you are, and the answer is no. |

`kubectl auth can-i list pods --as=system:serviceaccount:sandbox-serviceaccounts:api-reader`
answers `no` and corroborates it from the outside, without a Pod in the picture
at all.

### 5. A Role and a RoleBinding turn the 403 into a 200

```
kubectl apply -f rbac.yaml
kubectl describe rolebinding api-reader-reads-pods
```

The Role is three lines of allow rules — `get`, `list`, `watch` on `pods` in the
core API group, which is written as the empty string `""` and not as `core`. The
RoleBinding attaches it to the ServiceAccount subject. Both halves are required:
a Role nobody is bound to grants nothing, and a binding can never be more
powerful than the Role it points at. There is no deny verb anywhere in RBAC.

Re-run the identical `curl` and it returns `200`, with a `PodList` body. Three
things did *not* happen in between, and the run asserts each of them:

- the Pod was not restarted (`restartCount` is still `0`);
- the token file was not rewritten (the string is byte-for-byte the one that got
  the 403);
- nothing was re-mounted or re-issued.

Authorization is evaluated per request against the live RBAC rules, so a binding
created a second ago governs the next call a long-running workload makes. That
symmetry matters operationally: deleting the binding revokes the access just as
immediately, with no restart and no token rotation to wait for.

### 6. The CA bundle is projected for a reason

```
kubectl exec caller -- sh -c 'curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $(cat /var/run/secrets/kubernetes.io/serviceaccount/token)" \
  https://kubernetes.default.svc/api/v1/namespaces/default/pods'
```

Drop `--cacert` and curl refuses the connection outright — `SSL certificate
problem: unable to get local issuer certificate`, and `%{http_code}` reports
`000` because no HTTP exchange ever happened. The API server's serving
certificate is signed by the cluster's own CA, which appears in no public trust
store.

The tempting fix is `--insecure` (or `InsecureSkipVerify: true`, or
`kubectl --insecure-skip-tls-verify`). Resist it: that throws away server
authentication and hands a live bearer token to whatever happened to answer on
that address. The CA is projected next to the token precisely so you never need
to.

### 7. A token minted for another audience gets 401, not 403

`caller.yaml` also mounts a *second* projected token for the same
ServiceAccount, scoped to a different audience:

```yaml
- serviceAccountToken:
    path: vault-token
    audience: vault.example.com
    expirationSeconds: 3600
```

```
kubectl exec caller -- cat /var/run/secrets/tokens/vault-token
```

Its `sub` is identical — the same ServiceAccount that, by this point in the lab,
is allowed to list pods. Its `aud` is `["vault.example.com"]`. Present it to the
API server and the answer is `401 Unauthorized`, with `Unauthorized` as the
reason and no mention of verbs or resources anywhere in the body.

That is the whole point of audiences. The API server accepts only tokens whose
`aud` contains its own audience, so authentication fails one step before
authorization is ever consulted. A token you hand to an external service — a
vault, an object store, a partner API — cannot be replayed against the
Kubernetes API, and a token from the API server's audience is useless to them.
Requesting an audience-scoped token is a projected-volume field, or the
`--audience` flag on `kubectl create token`.

### 8. `kubectl create token` mints one from outside

```
kubectl create token api-reader
kubectl create token api-reader --duration=10m
```

This calls the same TokenRequest API the kubelet does and prints the JWT. The
default lifetime is one hour; `--duration` shortens or lengthens it, with a
ten-minute floor. Decode the result and `sub` is the same username, `exp` is
present — and there is no `pod` claim, because this token is bound to no object.
That is the difference between the two: the Pod's token dies with the Pod, this
one simply expires.

It is the correct way to answer "what can this ServiceAccount actually do?".
Reach for it instead of hunting for a Secret to read, and prefer it to
`--as=` impersonation when you want to exercise the real credential path rather
than the authorizer alone. `--bound-object-kind` / `--bound-object-name` will
tie a minted token to a specific Pod or Secret if you need the shorter leash.

### 9. The legacy alternative: a service-account-token Secret

```
kubectl apply -f legacy-token-secret.yaml
kubectl describe secret api-reader-legacy-token
```

A Secret of type `kubernetes.io/service-account-token` carrying the annotation
`kubernetes.io/service-account.name: api-reader` is a request, and the control
plane fills in `token`, `ca.crt` and `namespace` for you. It still works in
current Kubernetes; it is simply not what you should reach for.

Decode that token and the contrast is stark. The claims are the old flat ones
(`kubernetes.io/serviceaccount/secret.name` and friends). There is **no `exp`**
and **no `pod`**: it is a permanent password, tied to no workload, sitting in
etcd until somebody deletes the Secret. Revoking it means finding it first.
Kubernetes stopped generating these automatically in v1.24 — which is why
`kubectl get sa` no longer shows a Secret next to every ServiceAccount, and why
so much older tooling broke on that upgrade. Create one by hand only when a
credential genuinely has to leave the cluster and TokenRequest cannot be used.

### 10. Opting out with `automountServiceAccountToken: false`

```
kubectl apply -f no-token.yaml
kubectl exec no-token -- cat /var/run/secrets/kubernetes.io/serviceaccount/token
```

The Pod still runs as `api-reader` — the identity is on the object either way —
but there is no `kube-api-access` volume on it at all and no file to read. The
field can be set on the ServiceAccount, covering every Pod that uses it, or on
the Pod; the Pod's setting wins where the two disagree.

Note what this does *not* do: the container can still resolve and reach
`kubernetes.default.svc`. This removes the credential, not the route, so
requests from that Pod arrive unauthenticated. Since the large majority of
workloads never call the Kubernetes API at all, turning the automount off
removes a live credential from the container filesystem for free, and it is
about the cheapest hardening step available.

## What this proves

A Pod's identity is a ServiceAccount and its credential is a JWT, and the two
are separate things. Since v1.22 the kubelet obtains that JWT from the
TokenRequest API and projects it — with the cluster CA and the Pod's namespace —
into `/var/run/secrets/kubernetes.io/serviceaccount/`. The token is short-lived,
rotated in place, and bound to the Pod, so it cannot outlive the workload it was
issued for.

Holding a credential and being allowed to use it are different questions, and
the HTTP status tells you which one failed. The same Pod, the same token string,
and no restart went from `403` to `200` the instant a Role and a RoleBinding
existed, because `403` is an authorization verdict about a subject the API
server has already identified. The audience-scoped token drew a `401` even after
that grant, because the API server never got as far as asking what it was
allowed to do. `401` is "who are you?"; `403` is "not you, not this".

The three ways to obtain a credential line up like this:

| Route | Expires | Bound to a Pod | Use it? |
| --- | --- | --- | --- |
| Projected volume (automount) | Yes, rotated by the kubelet | Yes | Yes — the default for workloads |
| `kubectl create token <sa>` | Yes, `--duration`, default 1h | Only with `--bound-object-*` | Yes — for humans and scripts |
| `kubernetes.io/service-account-token` Secret | **No** | No | Only as a last resort |

And the cheapest control of all is the one that issues no credential:
`automountServiceAccountToken: false` on every workload that has no business
talking to the API server.

## See also

- Study guide → Cluster Architecture, Installation & Configuration
- Flashcards: `serviceaccount`, `serviceaccount-tokens`, `role`, `rolebinding`
- Related: `rbac` — the rules side of the same story, including ClusterRoles,
  aggregation, and the escalation guards on creating bindings
- Related: `configmap-secret` — why "it's in a Secret" is the start of a
  security argument rather than the end of one
