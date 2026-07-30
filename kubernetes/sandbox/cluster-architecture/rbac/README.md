# RBAC

**CKA domain:** Cluster Architecture, Installation and Configuration

RBAC is additive and starts from nothing: an identity may do only what some
rule explicitly allows it to do, and a brand-new ServiceAccount is allowed
nothing at all. This lab takes one such ServiceAccount from that empty state
to a working grant one object at a time, and then pushes on the three edges
that are easy to get wrong under exam pressure — where a namespaced grant
stops, why a binding cannot be repointed at a different role, and why holding
"create roles" does not quietly mean holding everything.

## Run it

```
bash run.sh          # the whole walkthrough, then cleans up
KEEP=1 bash run.sh   # leaves the namespace running so you can poke at it
```

## Walkthrough

Throughout, `$APP` stands for the ServiceAccount's user name:

```
APP=system:serviceaccount:sandbox-rbac:app
```

### 1. A ServiceAccount is an identity, and identities start empty

```
kubectl apply -f sa.yaml
kubectl get pod target -o jsonpath='{.spec.serviceAccountName}'
```

`sa.yaml` creates two ServiceAccounts, `app` and `helper`, and a Pod that runs
as `app`. Creating a ServiceAccount grants nothing whatsoever — it produces a
name the apiserver will recognise on an incoming request, written
`system:serviceaccount:<namespace>:<name>`, and nothing else. Every namespace
already contains one of these, called `default`, and it is exactly this
powerless.

The Pod is there to make the point that this is a workload identity rather
than a kubectl convenience: the kubelet projects a short-lived token for `app`
into it, and a process inside would reach the apiserver under that same user
name. Asking about the identity with `--as=` is not an approximation of that.
kubectl sends an `Impersonate-User` header, the apiserver recognises the
`system:serviceaccount:` form, and rebuilds the identical identity — same user
name, same group memberships — that the projected token would have produced.

### 2. Before any grant, the answer is no

```
kubectl auth can-i list pods --as=$APP
kubectl get pods --as=$APP
```

The first prints `no`. The second is refused outright:

```
Error from server (Forbidden): pods is forbidden: User
"system:serviceaccount:sandbox-rbac:app" cannot list resource "pods"
in API group "" in the namespace "sandbox-rbac"
```

Those two commands are not the same kind of thing, and the difference is worth
holding onto. `kubectl auth can-i` creates a SelfSubjectAccessReview: it puts
the question to the same authorizer that guards every real request, but asking
never performs the action, which is what makes it safe to probe with. The
second command is the action. The lab checks both at every turn, because a
review is only worth trusting if it agrees with what the API actually does.

Nothing here is denied by a rule. It is denied because no rule allows it —
RBAC has no concept of a deny rule at all.

### 3. One Role plus one RoleBinding turns that no into a yes

```
kubectl apply -f pod-reader.yaml
kubectl describe rolebinding app-pod-reader
kubectl auth can-i list pods --as=$APP
```

`pod-reader.yaml` holds the two halves of a grant. The Role is a list of rules,
and a rule is a product — these `apiGroups`, times these `resources`, times
these `verbs`. It names no subject anywhere. The RoleBinding is the opposite:
it carries no rules, only a `roleRef` pointing at the Role and a `subjects`
list naming identities. Neither object is a grant on its own; the permission
exists only where they meet.

`can-i list pods` now answers `yes` and a real `get pods` returns the Pod. Note
what did not come along with it:

```
kubectl auth can-i delete pods --as=$APP    # no
kubectl auth can-i list secrets --as=$APP   # no
```

Verbs and resources are enumerated one at a time. `get` never implies `delete`,
and `pods` never implies anything else. The `helper` ServiceAccount is also
still `no`, because it is not named in the binding's subjects.

### 4. The grant stops at the edge of the namespace

```
kubectl auth can-i list pods --as=$APP --all-namespaces   # no
kubectl auth can-i list pods --as=$APP -n default         # no
kubectl get pods --as=$APP --all-namespaces
```

Both halves of the grant are namespaced objects, so the permission is
namespaced with them. The real cluster-wide list fails with a different tail
than before:

```
... cannot list resource "pods" in API group "" at the cluster scope
```

That phrase explains the `--all-namespaces` result exactly. `--all-namespaces`
is not a loop over the namespaces a caller can reach; it is a single request
whose namespace field is empty, which RBAC evaluates at cluster scope — and at
cluster scope no RoleBinding applies. Reading Pods everywhere needs a
ClusterRole attached with a ClusterRoleBinding.

### 5. A RoleBinding may point at a ClusterRole, and is still confined

```
kubectl get clusterrole view -o jsonpath='{.rules}'
kubectl apply -f view-binding.yaml
kubectl auth can-i list configmaps --as=$APP                   # yes
kubectl auth can-i list configmaps --as=$APP --all-namespaces  # no
```

`view-binding.yaml` is a RoleBinding whose `roleRef` names the built-in `view`
ClusterRole. This is the ordinary way to reuse one curated rule set across many
namespaces without maintaining a duplicate Role in each of them, and it is a
favourite exam trap: the grant is still confined to the RoleBinding's own
namespace. The kind of the *binding* decides the scope; the `roleRef` only
decides the content.

The sharpest version of that is a rule inside `view` that cannot be reached
through this binding at all:

```
kubectl get namespaces --as=$APP
... cannot list resource "namespaces" in API group "" at the cluster scope
```

`view` genuinely contains a read rule for `namespaces` — the jsonpath above
shows it — but `namespaces` is a cluster-scoped resource, so a real request for
it carries no namespace, and a RoleBinding can never satisfy it.

One more thing `view` will not give you is Secrets, deliberately. A Secret can
hold a ServiceAccount token, so reading one would let the reader act as that
ServiceAccount — which is why the read-only role stops short of them while
`edit` and `admin` do not.

### 6. roleRef is immutable; the subjects list is not

```
kubectl patch rolebinding app-pod-reader --type=merge \
  -p '{"roleRef":{"apiGroup":"rbac.authorization.k8s.io","kind":"ClusterRole","name":"admin"}}'
```

This is rejected, and by validation rather than by authorization — the patch
above is run as cluster-admin and still fails:

```
The RoleBinding "app-pod-reader" is invalid: roleRef: Invalid value: ...:
cannot change roleRef
```

The subjects list, by contrast, takes an edit happily:

```
kubectl patch rolebinding app-pod-reader --type=json \
  -p '[{"op":"add","path":"/subjects/-","value":{"kind":"ServiceAccount","name":"helper","namespace":"sandbox-rbac"}}]'
```

and `helper` can immediately list Pods through that same binding. So a binding
is a permanent statement about *which rules* and a revisable statement about
*which subjects*. To point one somewhere else you delete it and create a
replacement. Be glad of the rule: if `roleRef` were editable, anyone holding
`patch` on a binding could swap `view` for `cluster-admin` underneath a subject
list somebody else had already reviewed and approved.

### 7. A subject cannot grant permissions it does not itself hold

```
kubectl apply -f role-author.yaml
kubectl create role pods-echo --verb=get --verb=list --resource=pods --as=$APP
kubectl create role secret-reader --verb=get --resource=secrets --as=$APP
```

`role-author.yaml` gives `app` `create` on `roles` and `rolebindings` — Roles
and RoleBindings are ordinary namespaced API resources, so that grant is
written exactly like a grant over ConfigMaps. The obvious question follows: can
`app` now simply write itself a Role over Secrets?

The first create succeeds, because `app` already holds `get` and `list` on
Pods. The second is refused:

```
roles.rbac.authorization.k8s.io "secret-reader" is forbidden: user
"system:serviceaccount:sandbox-rbac:app" (groups=[...]) is attempting to grant
RBAC permissions not currently held:
{APIGroups:[""], Resources:["secrets"], Verbs:["get"]}
```

Binding to a role you do not hold is blocked the same way, with the same
message:

```
kubectl create rolebinding esc --clusterrole=admin \
  --serviceaccount=sandbox-rbac:app --as=$APP
```

These are two separate gates enforced in two separate registries. Creating or
updating a Role is checked against the author's own permissions in that
namespace. Creating or updating a binding is checked against the permissions of
the role being referenced. Without them, "may create roles" would silently mean
"may have anything".

### 8. escalate and bind are the deliberate exemptions

```
kubectl apply -f escalate.yaml
kubectl auth can-i escalate roles.rbac.authorization.k8s.io --as=$APP  # yes
kubectl create role secret-reader --verb=get --resource=secrets --as=$APP
```

`escalate` is not a verb the apiserver ever performs — no request has verb
`escalate`. It exists only so RBAC can say "this subject is trusted to write
rules broader than its own access", and the Role registry consults it before
refusing a create. With it granted, the identical create from step 7 now
succeeds.

Two things stay true anyway. `app` still cannot read a Secret, because a Role
with no binding authorizes nobody. And it still cannot attach the Role it just
wrote:

```
kubectl create rolebinding sr --role=secret-reader \
  --serviceaccount=sandbox-rbac:app --as=$APP
... is attempting to grant RBAC permissions not currently held
```

`escalate` waives the author-side check on roles and clusterroles; the
binding-side check wants the `bind` verb on the specific role being referenced.
Neither verb is granted by default and neither implies the other, which is what
lets you delegate namespace RBAC administration without handing the delegate
the cluster.

## What this proves

RBAC is additive, and every permission in a cluster is the meeting point of two
objects: rules that name no subject, and a binding that names subjects and
carries no rules. Both halves being namespaced is what makes a Role plus
RoleBinding grant inside one namespace and nowhere else — proved here in both
directions, by review and by real request, with `--all-namespaces` and another
namespace both staying `no`.

Referencing a ClusterRole from a RoleBinding changes which rules apply, never
how far they reach. That is the single most useful thing to have straight: the
binding's kind sets the scope, and rules for cluster-scoped resources sitting
inside the referenced ClusterRole simply cannot be reached that way.

A binding's `roleRef` is immutable while its `subjects` list is not, so
retargeting means delete and recreate. And the escalation guards mean authority
over RBAC objects is not the same as authority over what they grant: you may
only write or bind rules you already hold, unless someone has explicitly given
you `escalate` on the role resource or `bind` on the specific role.

## See also

- Study guide → Cluster Architecture, Installation and Configuration
- Flashcards: `role`, `rolebinding`, `clusterrole`, `clusterrolebinding`,
  `default-clusterroles`, `rbac-escalation-guards`, `serviceaccount`,
  `serviceaccount-tokens`
- Related: `cluster-architecture/namespaces` — the same namespace boundary seen
  from the other side, as a scope for names and quotas
