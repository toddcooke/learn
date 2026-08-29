# HashiCorp Terraform Associate (004) — flashcards

184 cards. Exported to Anki by scripts/export-anki.mjs.
<!-- domains: Infrastructure as Code with Terraform | Terraform Fundamentals | Core Terraform Workflow | Terraform Configuration | Terraform Modules | State Management | Maintaining Infrastructure | HCP Terraform -->

## Infrastructure as Code with Terraform

### `what-is-terraform` · Terraform

**What is Terraform, and how does it actually make changes to infrastructure?**

<details><summary>Answer</summary>

An infrastructure as code tool: you describe cloud and on-prem resources in human-readable configuration files that can be versioned, reused, and shared, and Terraform provisions and manages them through one consistent workflow.

It has no built-in knowledge of any platform. Everything it manages, it manages by calling that platform's API through a plugin called a provider — which is why the same tool covers low-level things like compute, storage, and networking and high-level ones like DNS records and SaaS settings.

</details>

### `infrastructure-as-code` · Infrastructure as code

**What does it mean to manage infrastructure as code?**

<details><summary>Answer</summary>

Defining infrastructure in configuration files that live in version control, and provisioning it by running a tool over those files rather than by clicking through a console or running ad-hoc scripts.

The consequence is that infrastructure gets the same practices code already has: diffs, code review, branches, history, rollback, and reproducibility. The file, not the running environment, becomes the description everyone works from.

</details>

### `declarative-configuration` · Declarative configuration

**Terraform configuration is declarative. What does that mean in practice?**

<details><summary>Answer</summary>

You describe the end state you want, not the steps to reach it. There is no ordering to write and no "create if missing, update if present" logic — Terraform works out the difference between the configuration and what exists, and derives the actions itself.

It also derives the order. Terraform builds a dependency graph from the references between resources and creates or modifies independent resources in parallel, so you get correct ordering without hand-writing it.

</details>

### `iac-advantages` · Advantages of IaC

**What are the main advantages of the infrastructure as code pattern?**

<details><summary>Answer</summary>

- Repeatability — the same configuration produces the same environment every time, so dev, staging, and production can be built from one definition
- Versioning and review — infrastructure changes arrive as diffs that can be reviewed, discussed, and reverted
- Visibility before the change — a plan shows what will be created, changed, or destroyed before anything happens
- Automation — configuration can run unattended in CI instead of relying on someone remembering a console sequence
- Reuse and standardization — modules package a known-good design so teams stop reinventing it
- Documentation — the configuration is an accurate description of what exists, which a wiki page never stays

</details>

### `immutable-infrastructure` · Immutable infrastructure

**What does it mean that Terraform takes an immutable approach to infrastructure?**

<details><summary>Answer</summary>

Rather than mutating a running resource in place until it matches the new requirement, Terraform prefers to replace it with a new one built from the new definition. Upgrades and modifications become "build the new thing, then swap", which avoids the drift that accumulates in servers patched repeatedly over years.

Terraform does update in place where the provider's API supports it — immutability is the default posture, not an absolute rule. When an attribute cannot be changed on a live object, the plan shows the resource being destroyed and recreated.

</details>

### `multi-cloud-deployment` · Multi-cloud

**How does Terraform support multi-cloud deployments, and why is that hard without it?**

<details><summary>Answer</summary>

Each cloud has its own interfaces, tools, and workflows, so spreading infrastructure across providers normally multiplies the tooling a team has to know. Terraform puts one workflow and one language in front of all of them, and because everything lands in a single configuration and state, it can handle dependencies that cross a cloud boundary — a record in one provider that needs an address produced by another.

The motivation is usually fault tolerance: an outage at one provider is survivable if the design is not tied to it.

</details>

### `service-agnostic-workflow` · Service-agnostic workflow

**What makes the Terraform workflow service-agnostic?**

<details><summary>Answer</summary>

The workflow — write, plan, apply — and the language are fixed; only the provider changes. Adding a new platform means declaring another provider and learning its resource types, not learning another tool, another state model, and another way to preview changes.

It is also not limited to cloud infrastructure. Anything with an API can have a provider, so the same configuration can manage a Kubernetes cluster, a DNS zone, a GitHub repository, a Datadog monitor, and a database role side by side.

</details>

### `hybrid-cloud` · Hybrid cloud

**How does Terraform handle a hybrid estate that spans a public cloud and on-prem systems?**

<details><summary>Answer</summary>

The same way it handles multiple clouds: on-prem platforms (VMware, OpenStack, F5, Consul, or anything else with an API) have providers too, so on-prem and cloud resources sit in one configuration with one workflow and one dependency graph between them.

The practical payoff is that the boundary stops being a process boundary. A change that spans both sides is one plan and one apply, rather than a cloud pipeline plus a ticket to the datacenter team.

</details>

### `terraform-use-cases` · Use cases

**Name several common Terraform use cases.**

<details><summary>Answer</summary>

- Multi-cloud deployment — one workflow across providers, for fault tolerance
- Multi-tier application infrastructure — Terraform orders the tiers itself, standing up the database tier before the web servers that depend on it
- Self-service clusters — modules that codify an organization's standards so product teams can provision for themselves instead of filing tickets
- Policy compliance and management — policy as code checked automatically before changes are made, instead of a review bottleneck
- PaaS application setup — codifying an app plus its add-ons, DNS, and CDN across several vendors
- Software defined networking — configuring an SDN from code rather than through a ticket queue

</details>

### `self-service-infrastructure` · Self-service infrastructure

**How do modules turn Terraform into a self-service model for a large organization?**

<details><summary>Answer</summary>

A central platform team writes modules that encode the organization's standards for a service — naming, tagging, networking, encryption, logging — and publishes them. Product teams then consume a module with a handful of inputs and get infrastructure that is compliant by construction.

This turns the platform team's role from fulfilling repetitive requests into maintaining the modules everyone builds on, and removes the ticket queue as a bottleneck without giving up the standards it existed to enforce.

</details>

### `policy-as-code` · Policy compliance

**How does Terraform help enforce policy and governance on what teams can provision?**

<details><summary>Answer</summary>

Through policy as code. Sentinel (and OPA) policies run against the plan, after Terraform has decided what it would do but before it does it, so a change that violates a rule — a forbidden instance type, an unencrypted bucket, an untagged resource — is stopped automatically instead of caught in review.

Policy enforcement is a feature of HCP Terraform and Terraform Enterprise, not of the free Community edition CLI. Cost estimation works the same way, letting policies act on the projected cost of a change.

</details>

## Terraform Fundamentals

### `core-and-plugins` · Plugin architecture

**How is Terraform split between core and plugins, and what does each part do?**

<details><summary>Answer</summary>

Terraform Core is the statically compiled Go binary you invoke as terraform. It reads and interpolates configuration, manages state, builds the resource graph, executes plans, and talks to plugins.

Plugins are separate executables that Core launches as child processes and drives over RPC. A provider plugin authenticates against its platform, defines the resource types and data sources it offers, and makes the actual API calls. Core knows nothing about AWS or Kubernetes; the plugin does.

</details>

### `what-providers-do` · Providers

**What does a provider add to Terraform?**

<details><summary>Answer</summary>

A set of resource types and data sources, plus any provider-defined functions. Every resource type is implemented by some provider — without providers Terraform cannot manage anything at all.

Most providers front an infrastructure platform, cloud or self-hosted, but some are pure local utilities: the random provider generates unique names, the tls provider makes keys and certificates, and neither talks to a platform.

</details>

### `required-providers` · required_providers

**How does a module declare which providers it needs?**

<details><summary>Answer</summary>

With a required_providers block nested inside the top-level terraform block. Each entry maps a local name to an object with a source address and a version constraint:

terraform { required_providers { aws = { source = "hashicorp/aws", version = "~> 5.0" } } }

Every module should declare its own requirements, because it is what tells terraform init which plugins to fetch and constrains which versions are acceptable.

</details>

### `provider-source-address` · Provider source address

**What are the parts of a provider source address?**

<details><summary>Answer</summary>

HOSTNAME/NAMESPACE/TYPE, where the hostname is optional. The hostname is the registry distributing the provider and defaults to registry.terraform.io, the public Terraform Registry; the namespace is the publishing organization; and the type is the short name of the platform, usually the provider's preferred local name.

So hashicorp/aws is the display form of registry.terraform.io/hashicorp/aws. Omitting source entirely implies registry.terraform.io/hashicorp/LOCAL_NAME — a backward-compatibility fallback from the 0.13 transition that you should not rely on.

</details>

### `provider-local-name` · Local names

**What is a provider's local name, and how does Terraform use it?**

<details><summary>Answer</summary>

The identifier the module uses for that provider everywhere outside the required_providers block — in provider blocks and in the provider meta-argument. It is assigned by the key in required_providers and must be unique within the module, but users can choose it.

It matters because when a resource does not set the provider meta-argument, Terraform reads the first word of the resource type as a local provider name: aws_instance resolves to the provider whose local name is aws. Using each provider's preferred local name is what lets you omit the meta-argument almost everywhere.

</details>

### `provider-local-name-conflict` · Local name conflicts

**Two providers you need share a preferred local name. What do you do?**

<details><summary>Answer</summary>

Give at least one of them a non-preferred local name, since local names must be unique per module. The recommended convention is a compound name joining namespace and type with a dash — hashicorp-http and mycorp-http.

Anything referring to the renamed provider then has to say so explicitly with the provider meta-argument, because the resource type prefix no longer matches its local name.

</details>

### `provider-block` · provider block

**What does a provider block do, and where should it live?**

<details><summary>Answer</summary>

It configures a provider — region, endpoint, project, credentials, and whatever else that provider defines. required_providers says which plugin to install; the provider block says how it should behave.

It belongs in the root module. Child modules inherit provider configurations from their parent, and defining provider blocks inside a child module is strongly discouraged. If you never write a provider block, Terraform assumes an empty default configuration, which works only if the provider has no required arguments.

</details>

### `provider-config-expressions` · Provider configuration values

**What kinds of values can you use in a provider block's arguments?**

<details><summary>Answer</summary>

Only values Terraform knows before it applies anything: literals, input variables, and locals built from them. You cannot reference a computed attribute of a resource, because the provider has to be configured before the graph that would produce that attribute is walked.

Most providers also read credentials from environment variables or the platform's own config files, which is the usual way to keep secrets out of version-controlled configuration.

</details>

### `provider-alias` · Provider aliases

**How do you use two configurations of the same provider in one configuration?**

<details><summary>Answer</summary>

Write multiple provider blocks with the same name and give every extra one an alias:

provider "aws" { region = "us-east-1" } and provider "aws" { alias = "west", region = "us-west-2" }

The block without an alias is the default configuration. Resources, data sources, and modules select an aliased one with the provider meta-argument, written as NAME.ALIAS — provider = aws.west. This is the standard way to deploy the same resources into several regions or accounts from one configuration.

</details>

### `provider-version-deprecated` · Provider versions

**Where should a provider's version constraint go, and where is it deprecated?**

<details><summary>Answer</summary>

In the required_providers block, as the version argument alongside source.

The provider block also accepts a version argument, but it is deprecated and slated for removal. It also cannot be combined with alias in the same block. Treat required_providers as the only place versions belong.

</details>

### `version-constraint-operators` · Version constraints

**What operators can a version constraint use?**

<details><summary>Answer</summary>

- = or no operator at all — exactly this version, and it cannot be combined with other conditions
- != — exclude one exact version
- Comparison operators >, >=, <, and <= — any version for which the comparison holds
- ~> — the pessimistic constraint operator, allowing only the rightmost component given to increment

Several conditions can be combined with commas, as in ">= 1.2.0, < 2.0.0", and Terraform only proceeds when every applicable constraint is satisfied.

</details>

### `pessimistic-constraint` · Pessimistic constraint operator

**What exactly does ~> allow?**

<details><summary>Answer</summary>

Only the rightmost component you wrote may increase. The number of components you specify is therefore the whole meaning of the constraint:

- ~> 1.0.4 allows 1.0.5 and 1.0.10, but not 1.1.0
- ~> 1.1 allows 1.2 and 1.10, but not 2.0

HashiCorp's guidance is that root modules should pin providers with ~> to get both a floor and a ceiling, while reusable modules should constrain only a minimum (>= 1.2.0) so the module's consumer keeps the freedom to upgrade.

</details>

### `required-version` · required_version

**What does required_version constrain, and what happens when it is not met?**

<details><summary>Answer</summary>

The version of Terraform itself. It is set in the terraform block — terraform { required_version = ">= 1.5.0" } — and takes the same constraint syntax as provider and module versions.

Constraints from the root module and every child module are all treated as equal and must all be satisfied. If the running Terraform version does not satisfy them, Terraform refuses to plan, apply, or run state operations at all.

</details>

### `provider-installation` · Provider installation

**When and how does Terraform install providers?**

<details><summary>Answer</summary>

During terraform init. Terraform scans the configuration for direct and indirect provider references, downloads what it needs from the public registry or a third-party registry, and unpacks it under .terraform/providers in the working directory.

Because installation happens at init, a persistent working directory must be re-initialized whenever the configuration's providers change. HCP Terraform and Terraform Enterprise sidestep this by installing providers as part of every run.

</details>

### `plugin-cache-mirror` · Provider installation methods

**What are the alternatives to downloading providers from a registry on every init?**

<details><summary>Answer</summary>

- A plugin cache directory, enabled with plugin_cache_dir in the CLI configuration file, so repeated inits across working directories share one download
- A filesystem mirror or network mirror, configured in the CLI configuration, for air-gapped environments or to vet provider binaries centrally

Installing from a mirror has a catch: Terraform can only record checksums for the platform it ran on, so the lock file will not cover other platforms unless you pre-populate it with terraform providers lock.

</details>

### `dependency-lock-file` · .terraform.lock.hcl

**What is the dependency lock file, and what belongs in it?**

<details><summary>Answer</summary>

.terraform.lock.hcl records the exact provider versions Terraform selected, along with their checksums. Terraform creates or updates it on every terraform init, and it belongs to the configuration as a whole, so it lives in the root module directory. Commit it to version control — dependency changes then arrive as a reviewable diff.

It tracks providers only. Module version selections are not locked, so Terraform always takes the newest module version matching the constraint; pin an exact module version if you need that repeatable.

</details>

### `lock-file-behavior` · Lock file behavior

**How does terraform init treat a provider that is already recorded in the lock file?**

<details><summary>Answer</summary>

It reinstalls exactly that version, even when a newer version would satisfy the constraint. A provider with no recorded selection gets the newest matching version, which is then written to the lock file.

terraform init -upgrade discards the recorded selections and re-selects the newest acceptable version of each provider, rewriting the lock file. That is the intended way to move a provider version forward: widen or bump the constraint, then init -upgrade.

</details>

### `lock-file-checksums` · Checksum verification

**What do the checksums in the lock file protect against?**

<details><summary>Answer</summary>

A provider package that does not match what was installed before. Terraform verifies each downloaded package against the recorded checksums and fails init if none match — a trust-on-first-use model, where you vet a provider once and Terraform then guarantees you keep getting that same artifact.

When a registry serves cryptographically signed checksums, Terraform records the whole signed set, so the lock file covers other platforms too and init reports the fingerprint of the signing key.

</details>

### `provider-registry-tiers` · Registry tiers

**What are the provider tiers in the Terraform Registry?**

<details><summary>Answer</summary>

- Official — owned and maintained by HashiCorp, in namespaces such as hashicorp
- Partner Premier — written by technology partners who meet extra qualification requirements
- Partner — written, maintained, and validated by a third-party company against its own API, under the HashiCorp Technology Partner Program
- Community — published by individual maintainers or community groups, under their own namespace
- Archived — an Official or Partner provider no longer maintained, usually because the API is deprecated or interest was low

The badge tells you who stands behind the code, which is the practical question when choosing between two providers for the same platform.

</details>

### `state-purpose` · Purpose of state

**Why does Terraform need state at all?**

<details><summary>Answer</summary>

- Mapping to the real world — state binds aws_instance.foo in your configuration to the real object i-abcd1234. Tags were tried early on and abandoned: not every resource or platform supports them.
- Metadata — state keeps the last known dependency order, which is the only way Terraform can destroy correctly after you delete a resource from the configuration; the configuration that described the ordering is gone.
- Performance — state caches attribute values, so large configurations can plan without querying every object (-refresh=false), treating the cached state as the record of truth.
- Syncing — a shared remote state is what lets a team operate on the same objects instead of each person's local file.

</details>

### `state-one-to-one` · State bindings

**What one-to-one rule does Terraform assume about state?**

<details><summary>Answer</summary>

Each remote object is bound to exactly one resource instance. Terraform guarantees this when it creates objects itself, because it records the identity as it creates them.

You break the guarantee when you add or remove bindings by other means — importing an object that is already managed elsewhere, or removing an object from state without deleting it. Then it is on you to restore the one-to-one mapping, by deleting the forgotten object or re-importing it to a single resource instance.

</details>

### `state-file-basics` · terraform.tfstate

**Where does state live by default, and what should you not do with it?**

<details><summary>Answer</summary>

In a JSON file named terraform.tfstate in the working directory, with the previous snapshot kept as terraform.tfstate.backup.

Do not hand-edit it — use the terraform state commands, which keep working across format changes that the raw file does not promise. Do not commit it to version control either: version control has no state locking or access control, and state can contain secrets in plain text.

</details>

### `state-refresh-before-plan` · Refresh

**What does Terraform do with state before it plans?**

<details><summary>Answer</summary>

It refreshes: reads the current condition of the real objects recorded in state so the plan compares your configuration against reality, not against a stale snapshot. Drift introduced outside Terraform shows up here.

The refresh can be skipped with -refresh=false, which large configurations use to avoid thousands of API calls (and rate limits) on every plan, at the cost of planning against possibly stale data.

</details>

## Core Terraform Workflow

### `core-workflow` · Core workflow

**What are the three stages of the core Terraform workflow?**

<details><summary>Answer</summary>

1. Write — author the configuration, defining resources that may span several providers
2. Plan — preview the create, update, and destroy actions Terraform would take, given the configuration and the existing state
3. Apply — on approval, execute those actions in dependency order

It is a loop, not a pipeline: the next change starts again at write. The whole point of the plan stage is that the review happens before anything real is touched.

</details>

### `workflow-as-a-team` · Team workflow

**How does the core workflow change when a team collaborates on one configuration?**

<details><summary>Answer</summary>

Each stage gains a step borrowed from how teams already handle application code. Writing moves into branches so people do not collide, and merge conflicts become the way incompatible infrastructure changes get resolved. Plan output becomes review material attached to a pull request, so the team can question a risky change before it happens. Apply moves out of individual laptops into a shared automation environment.

The pressure that drives this is credentials: as the team and infrastructure grow, having every member hold every sensitive input locally becomes both a burden and a security risk.

</details>

### `terraform-init` · terraform init

**What does terraform init do?**

<details><summary>Answer</summary>

Prepares a working directory for use. In one command it:

- Initializes the backend using the configuration's backend settings
- Downloads the source for every module referenced by a module block
- Installs the provider plugins the configuration needs, into .terraform/providers
- Creates or updates the .terraform.lock.hcl dependency lock file

It is the first command to run on a new or freshly cloned configuration, and it is safe to run repeatedly — it never deletes your configuration or state.

</details>

### `init-when-to-rerun` · Re-initializing

**When do you have to run terraform init again?**

<details><summary>Answer</summary>

Whenever the working directory's dependencies or backend change: a provider added or its version constraint moved, a new module block, a changed module source, or any change to the backend configuration. Terraform will tell you to reinitialize when a command needs something init has not installed.

Because init is idempotent and safe to repeat, automation usually just runs it unconditionally before every plan.

</details>

### `init-backend-flags` · init backend options

**What do -reconfigure, -migrate-state, and -backend=false do on terraform init?**

<details><summary>Answer</summary>

They resolve what happens when you re-init a directory whose backend settings changed — Terraform refuses to guess, and requires one of the first two.

- -migrate-state copies the existing state into the new backend, prompting for confirmation (-force-copy answers yes to those prompts and implies -migrate-state)
- -reconfigure ignores the existing backend configuration entirely and starts fresh, migrating nothing
- -backend=false skips backend initialization altogether, useful only in a directory already initialized for its backend — for example when validating in CI

</details>

### `init-partial-backend` · Partial backend configuration

**How do you keep backend settings out of the configuration file?**

<details><summary>Answer</summary>

Omit them from the backend block and supply them at init time with -backend-config, either as key=value pairs or as a file of settings. This is called partial backend configuration.

It exists because backend settings are often dynamic or sensitive — a bucket name that differs per environment, or credentials that must not be committed — and the backend block cannot use variables or most expressions.

</details>

### `init-upgrade-and-from-module` · init options

**What do -upgrade and -from-module do?**

<details><summary>Answer</summary>

-upgrade re-checks the registry for newer acceptable versions of both providers and modules, and updates them, disregarding what the lock file recorded. Without it, init installs already-selected provider versions and leaves already-installed modules alone.

-from-module=SOURCE copies a module from the given source into an empty directory before initializing it — a shorthand for checking out a configuration, or for starting from an example. For routine work, checking out from version control directly is recommended instead.

</details>

### `terraform-validate` · terraform validate

**What does terraform validate check, and what does it not check?**

<details><summary>Answer</summary>

It checks that the configuration is syntactically valid and internally consistent — attribute names that exist, value types that line up, references that resolve. It does this without any variable values and without consulting state.

It does not talk to remote services: no provider APIs, no remote state. So it cannot tell you whether a change is safe, only whether the configuration is coherent. It does need an initialized directory, since it needs the providers' schemas; terraform init -backend=false is enough for that.

</details>

### `validate-in-automation` · Validate in automation

**Where does validate fit in an automated pipeline?**

<details><summary>Answer</summary>

Early and cheaply. It is safe to run automatically — as an editor save hook, or as a CI step for a reusable module — because it never touches infrastructure and needs no credentials. The -json flag makes the results machine-readable, reporting valid, error_count, warning_count, and a diagnostics array.

To check a configuration in the context of a real run — a specific workspace, real variable values, real state — you need terraform plan, which performs an implied validation of its own.

</details>

### `terraform-plan` · terraform plan

**What does terraform plan actually do?**

<details><summary>Answer</summary>

Three things, in order: read the current state of the existing remote objects so state is up to date, compare the configuration against that prior state, and propose the set of actions that would make reality match the configuration.

It never carries them out. Its value is as a checkpoint — confirming the change matches your intent, or handing your team something concrete to review. If nothing differs, it reports that no actions need to be taken.

</details>

### `plan-action-symbols` · Reading a plan

**What do the symbols in plan output mean?**

<details><summary>Answer</summary>

A plus sign means create, a minus sign means destroy, and a tilde means update in place. Two combined symbols mean replacement: -/+ destroys the old object and then creates its replacement, while +/- creates the replacement first and destroys the old one afterwards, which is what create_before_destroy produces.

Terraform prints the legend for the symbols the plan actually uses, then ends with a summary line — "Plan: 4 to add, 0 to change, 0 to destroy." A replacement counts in both the add and destroy totals.

</details>

### `plan-out-file` · Saved plans

**What does terraform plan -out do, and why use it?**

<details><summary>Answer</summary>

It writes the generated plan to a file that terraform apply can execute later. This two-step workflow is primarily for automation: the exact set of actions that was reviewed is what runs, with no chance of the plan being regenerated against changed conditions in between.

You inspect a saved plan with terraform show. Note that a saved plan file contains variable values and resource attributes in cleartext, so treat it as sensitive.

</details>

### `speculative-plan` · Speculative plans

**What is a speculative plan?**

<details><summary>Answer</summary>

A plan produced with no intention of applying it — what terraform plan creates when you do not pass -out. It describes the effect a change would have, which is what makes it useful on a pull request: reviewers see the consequences of a change before it merges.

The caveat is that it can go stale. Other changes to the target system in the meantime can make the real effect differ, so the final non-speculative plan is the one to check before applying.

</details>

### `planning-modes` · Planning modes

**What are Terraform's three planning modes?**

<details><summary>Answer</summary>

- Normal mode — the default: change the remote system to match the configuration
- Destroy mode (-destroy) — destroy every remote object being managed, leaving an empty state
- Refresh-only mode (-refresh-only) — update state and root module outputs to match changes made outside Terraform, proposing no infrastructure changes at all

They are mutually exclusive, and all three are available on both plan and apply.

</details>

### `planning-options` · Planning options

**Which options change what a plan contains?**

<details><summary>Answer</summary>

- -var 'NAME=VALUE' and -var-file=FILE set root module input variables
- -refresh=false skips syncing state with remote objects — faster, but it ignores external changes and can produce an incomplete plan
- -replace=ADDRESS forces a resource instance that would otherwise be updated or untouched to be replaced instead, the supported successor to the old terraform taint
- -target=ADDRESS narrows planning to the given instances plus everything they depend on

These work on both plan and apply. -replace cannot be combined with -destroy.

</details>

### `target-caveats` · Resource targeting

**Why is -target meant for exceptional circumstances only?**

<details><summary>Answer</summary>

Because it deliberately applies part of your configuration, leaving the rest unreconciled. That produces drift Terraform has not told you about and confusion over how state relates to configuration. It is a tool for recovering from a mistake or working around a Terraform limitation, not for routine operations.

If you are reaching for -target because a configuration is too large to plan comfortably, the intended fix is to split it into smaller configurations with their own states.

</details>

### `terraform-apply` · terraform apply

**What happens when you run terraform apply with no arguments?**

<details><summary>Answer</summary>

Terraform generates a fresh plan exactly as terraform plan would, displays it, and asks for approval. Only the literal word "yes" is accepted. On approval it performs the actions in dependency order and prints a summary — "Apply complete! Resources: 1 added, 0 changed, 0 destroyed."

Because apply plans first and shows you the result, running plan separately is optional in interactive use; it earns its keep when the plan needs to be saved or reviewed by someone else.

</details>

### `apply-saved-plan` · Applying a saved plan

**How does terraform apply behave when you pass it a saved plan file?**

<details><summary>Answer</summary>

It executes the actions in that file immediately, with no confirmation prompt — passing the file is itself the approval — and it accepts no planning modes or planning options, because every such decision was already baked into the file.

For the same reason -auto-approve is ignored with a saved plan.

</details>

### `apply-auto-approve` · -auto-approve

**What does -auto-approve do, and what is the risk?**

<details><summary>Answer</summary>

It skips the interactive approval, so apply plans and immediately executes. It is how apply runs unattended in a pipeline.

The risk is that nobody sees the plan. HashiCorp's advice is to use it only where nothing can change your infrastructure outside the Terraform workflow, since a drifted resource can turn an intended no-op into a destructive change that no human ever reviewed. The safer automation pattern is plan -out, review, then apply the saved file.

</details>

### `terraform-destroy` · terraform destroy

**What is terraform destroy, and how do you preview one?**

<details><summary>Answer</summary>

A convenience alias for terraform apply -destroy: it deprovisions every object the configuration manages. It accepts most of apply's options but takes no plan file argument, and it forces destroy mode.

Preview it with terraform plan -destroy, which shows the proposed destruction without executing it. You can also aim it at one resource and its dependencies with -target, as in terraform destroy -target aws_instance.example.

</details>

### `terraform-fmt` · terraform fmt

**What does terraform fmt do, and what are its useful flags?**

<details><summary>Answer</summary>

Rewrites configuration files into Terraform's canonical style — indentation, alignment, spacing. It is deliberately opinionated and has no customization options, because its entire purpose is consistency across codebases.

- -check exits non-zero and lists offending files instead of rewriting, which is the CI form
- -diff shows what would change
- -write=false prevents overwriting (implied by -check and by stdin input)
- -recursive also processes subdirectories, which is not the default
- -list=false suppresses the list of changed files

By default it scans the current directory; it also accepts a directory, a single file, or a dash for standard input.

</details>

### `fmt-scope` · Style conventions

**Does terraform fmt enforce the whole Terraform style guide?**

<details><summary>Answer</summary>

No — it applies a subset of the language style conventions plus some minor readability adjustments. Plenty of documented style decisions it does not yet apply automatically, and following those is still recommended.

The canonical format can shift slightly between Terraform versions. HashiCorp does not treat new formatting rules as a breaking change, so running fmt across your modules after an upgrade is a normal part of adopting a new version.

</details>

### `parallelism` · Graph walking

**How much of an apply happens concurrently?**

<details><summary>Answer</summary>

Terraform walks the dependency graph with a depth-first traversal and visits a node as soon as all of its dependencies have been visited, so independent resources are handled in parallel. Concurrency is capped at 10 nodes by default.

The cap is adjustable with -parallelism on plan, apply, and destroy, but it is an advanced knob that normal usage should not need — and not the way to handle provider API rate limits, which providers deal with themselves through backoff and retry.

</details>

## Terraform Configuration

### `resource-block` · resource block

**What does a resource block declare, and what are its parts?**

<details><summary>Answer</summary>

An infrastructure object Terraform should create and manage. The block header carries two labels — the resource type, which determines what is being managed and which provider implements it, and a local name used to refer to it elsewhere in the module:

resource "aws_instance" "web" { ami = "ami-123", instance_type = "t3.micro" }

The body holds provider-defined arguments plus Terraform's own meta-arguments — count, for_each, provider, depends_on, lifecycle — which control how Terraform manages the object rather than what the object is.

</details>

### `apply-actions` · What apply does

**What five things can Terraform do to resources when you apply a configuration?**

<details><summary>Answer</summary>

- Create objects that are in the configuration but have no real object in state
- Destroy objects that are in state but no longer in the configuration
- Update in place where arguments changed and the remote API allows it
- Destroy and re-create where arguments changed but the API cannot update them in place
- Update the state file so configuration, real infrastructure, and state agree

The fourth case is why plan output sometimes shows a replacement for what looks like a small edit: the provider is telling Terraform that the attribute forces a new resource.

</details>

### `resource-vs-data` · Resources vs data sources

**What is the difference between a resource block and a data block?**

<details><summary>Answer</summary>

A resource block manages an object: Terraform creates it, updates it, destroys it, and tracks it in state. A data block only reads. It queries the provider for information about something that already exists — an AMI, a VPC, an availability zone list — and creates nothing.

Because a data source manages nothing, destroying the configuration does not destroy what it read. Data sources are how a configuration consumes infrastructure it does not own, whether that is another team's network or values created outside Terraform.

</details>

### `data-block` · data block

**How do you declare a data source and use its result?**

<details><summary>Answer</summary>

A data block takes the data source type and a local label, with query constraints in the body:

data "aws_ami" "example" { most_recent = true, owners = ["self"] }

Reference the result as data.TYPE.LABEL.ATTRIBUTE — data.aws_ami.example.id. Data blocks also accept expressions and most meta-arguments, including count, for_each, provider, and depends_on.

</details>

### `data-source-timing` · Data source timing

**When does Terraform read a data source?**

<details><summary>Answer</summary>

Normally during the refresh that precedes planning, so the fetched values are real and appear in the diff. That only works when the data block's arguments are all known ahead of time.

If an argument depends on a managed resource that is changing in this plan, or on any value computed during apply, Terraform defers the read to the apply phase. The plan then shows the data source's attributes — and anything referencing them — as known after apply, and it says the read was deferred.

</details>

### `resource-attribute-references` · Resource references

**How do you refer to another resource's attributes?**

<details><summary>Answer</summary>

TYPE.NAME.ATTRIBUTE for a managed resource, and data.TYPE.NAME.ATTRIBUTE for a data source — aws_instance.web.id, data.aws_ami.example.id.

The shape of the reference changes with the instance-count meta-arguments. Without count or for_each, the reference is a single object. With count it is a list of objects, addressed as aws_instance.web[0]. With for_each it is a map of objects, addressed as aws_instance.web["key"].

</details>

### `named-values` · Named values

**What kinds of named values can a Terraform expression reference?**

<details><summary>Answer</summary>

- Managed resources — TYPE.NAME
- Input variables — var.NAME
- Local values — local.NAME
- Child module outputs — module.NAME.OUTPUT
- Data sources — data.TYPE.NAME
- Filesystem and workspace info — path.module, path.root, path.cwd, terraform.workspace
- Block-local symbols — count.index, each.key, each.value, self, and a for expression's temporary symbols

They look like attribute paths but are not real objects: you must write them exactly as shown, and you cannot iterate over a "parent" like aws_instance to enumerate every instance of a type.

</details>

### `path-values` · Path values

**What do path.module, path.root, and path.cwd each refer to?**

<details><summary>Answer</summary>

path.module is the filesystem path of the module where the expression is written; path.root is the path of the configuration's root module; path.cwd is the absolute path of the directory Terraform was originally run from, before any -chdir.

Prefer path.root or path.module over path.cwd, and avoid writing files into path.module — multiple invocations of a local module share one source directory, so writes there can race and overwrite each other.

</details>

### `input-variable-block` · variable block

**What arguments can a variable block take?**

<details><summary>Answer</summary>

- type — a type constraint; without it the variable accepts any type
- default — makes the variable optional, and must be a literal that cannot reference anything else in the configuration
- description — written for the module consumer, not as a maintainer's note
- validation — one or more custom rules with a condition and an error_message
- sensitive — redact the value from CLI and HCP Terraform output
- nullable — whether null is an acceptable value (default true)
- ephemeral — keep the value out of state and plan files (Terraform 1.10+)

The name must be unique in the module and cannot be one of the reserved words: source, version, providers, count, for_each, lifecycle, depends_on, or locals.

</details>

### `variable-assignment` · Assigning variable values

**What are the ways to give a root module variable a value?**

<details><summary>Answer</summary>

- -var 'name=value' on the command line, and -var-file=FILE
- Variable definition files — terraform.tfvars, terraform.tfvars.json, and any *.auto.tfvars or *.auto.tfvars.json, which Terraform loads automatically
- Environment variables named TF_VAR_ plus the variable name, which suits CI where you do not want extra files
- Workspace variables and variable sets in HCP Terraform
- The variable's own default

A variable with no default and no value supplied makes Terraform prompt for it interactively before it plans. Child module variables are different: they get their values as arguments in the module block, and nowhere else.

</details>

### `variable-precedence` · Variable precedence

**In what order do variable values override each other?**

<details><summary>Answer</summary>

Highest to lowest:

1. -var and -var-file on the command line, in the order given, and variables from HCP Terraform
2. Any *.auto.tfvars or *.auto.tfvars.json files, in lexical order
3. terraform.tfvars.json
4. terraform.tfvars
5. TF_VAR_ environment variables
6. The default in the variable block

So the command line and HCP Terraform always win, and the default is the last resort. Within one file you cannot assign the same variable twice.

</details>

### `undeclared-variables` · Undeclared variables

**What happens when you supply a value for a variable that no variable block declares?**

<details><summary>Answer</summary>

It depends on how you supplied it. A TF_VAR_ environment variable with no matching declaration is silently ignored — the environment is full of unrelated variables, so this has to be tolerant. In a .tfvars file you get a warning, which is what catches a misspelling. With -var on the command line it is an error.

</details>

### `variable-validation` · Variable validation

**How do you enforce a rule on a variable beyond its type?**

<details><summary>Answer</summary>

A validation block inside the variable, with a condition expression that must evaluate to true and an error_message shown when it does not:

variable "image_id" { type = string, validation { condition = substr(var.image_id, 0, 4) == "ami-", error_message = "..." } }

Terraform evaluates these while creating the plan, and a failure stops the operation. The value is catching a bad input at the boundary with a message you wrote, instead of letting it surface later as a provider API error — and it is also how you enforce house rules like naming conventions, which no provider will check for you.

</details>

### `output-block` · output block

**What is an output block for?**

<details><summary>Answer</summary>

Exposing a value out of a module, like a function's return value. Four uses:

- A child module exposes resource attributes to its parent
- A root module prints values in CLI output at the end of an apply
- Another configuration reads root module outputs through the terraform_remote_state data source
- An automation tool picks values out of a Terraform run

value is the only required argument. Outputs also accept description, sensitive, ephemeral, depends_on, and a precondition block.

</details>

### `output-sensitive` · Sensitive outputs

**What does marking an output sensitive actually do?**

<details><summary>Answer</summary>

It redacts the value in CLI output and in the HCP Terraform UI, so an apply prints "connection_string = (sensitive value)".

That is all it does. The value is still written to state in the clear, and terraform output -json or -raw prints it in plain text on demand. Sensitive is about not leaking values into logs and screens, not about keeping them secret from anyone with state access.

</details>

### `locals-block` · locals block

**What is a locals block, and how does it differ from a variable?**

<details><summary>Answer</summary>

It names an expression so you can reuse it inside the module — closer to a function-scoped constant than to a parameter. A variable is an input from outside; a local is computed inside and cannot be set by the caller.

Locals are declared in locals (plural) blocks and referenced as local.NAME (singular). A module can have several locals blocks and Terraform treats them as one. A local can reference variables, resources, data sources, functions, and other locals, as long as there is no cycle — and it is only visible in the module that defines it.

</details>

### `primitive-types` · Primitive types

**What are Terraform's primitive types, and how do they convert?**

<details><summary>Answer</summary>

string, number, and bool. number covers both whole numbers and fractions.

Terraform converts between them automatically wherever a conversion is unambiguous: true becomes "true" and back, 15 becomes "15" and back, as long as the string really does represent a number or boolean.

</details>

### `collection-types` · Collection types

**What are the three collection types, and how do they differ?**

<details><summary>Answer</summary>

Each groups multiple values of one element type, given as the constructor's argument — list(string) is a different type from list(number).

- list(...) — ordered, indexed by consecutive whole numbers from zero
- map(...) — values identified by string keys
- set(...) — unique values, with no ordering and no index

The bare keywords list and map are shorthands for list(any) and map(any), kept for compatibility; new configurations should write the full form.

</details>

### `structural-types` · Structural types

**What are the structural types, and how do they differ from collections?**

<details><summary>Answer</summary>

They group values of different types, so they need a schema rather than a single element type.

- object({ name = string, age = number }) — named attributes, each with its own type
- tuple([string, number, bool]) — positional elements, each with its own type

A value matching an object type must have all the named attributes; extra attributes are allowed but get discarded in the conversion. A tuple must have exactly the listed number of elements, each matching the type in its position.

</details>

### `builtin-functions` · Built-in functions

**What kinds of built-in functions does Terraform provide, and can you write your own?**

<details><summary>Answer</summary>

Around a hundred, grouped roughly into numeric (min, max, abs, ceil), string (format, join, split, replace, lower, trimspace), collection (length, lookup, merge, concat, contains, keys, values, flatten, distinct, zipmap), encoding (jsonencode, jsondecode, yamlencode, base64encode), filesystem (file, templatefile, fileexists), date and time (timestamp, timeadd, formatdate), hashing and crypto (sha256, bcrypt, uuid), IP network (cidrsubnet, cidrhost), and type conversion (tostring, tonumber, tolist, toset, tomap, try, can).

You cannot define functions in the configuration language. You can get custom functions from a provider, called as provider::LOCAL_NAME::FUNCTION.

</details>

### `terraform-console` · terraform console

**How do you experiment with an expression without applying anything?**

<details><summary>Answer</summary>

terraform console opens an interactive expression evaluator against your configuration and state. Typing max(5, 12, 9) returns 12; you can also evaluate references such as var.foo, local.bar, or a resource attribute to see the real value Terraform holds.

It is the quickest way to settle what a function or a for expression actually returns, instead of discovering it in the middle of a plan.

</details>

### `for-expressions` · for expressions

**What does a for expression do, and what does it return?**

<details><summary>Answer</summary>

Transforms one complex value into another. It iterates over a list, set, tuple, map, or object and builds a new value from an expression applied to each element.

The brackets decide the result type: [for s in var.list : upper(s)] produces a tuple, and { for s in var.list : s => upper(s) } produces an object, where the two result expressions are separated by =>. With two temporary symbols, the first is the key for a map or object and the index for a list.

An optional if clause filters — [for s in var.list : upper(s) if s != ""] — which is the usual way to split one collection into two by some criterion.

</details>

### `splat-expressions` · Splat expressions

**What is a splat expression, and when can you not use one?**

<details><summary>Answer</summary>

Shorthand for a for expression that pulls the same attribute out of every element: var.list[*].id is equivalent to [for o in var.list : o.id]. It chains, so var.list[*].interfaces[0].name works too.

It applies only to lists, sets, and tuples. A resource using for_each appears as a map of objects, so splat does not work on it — use a for expression instead. Applied to a single non-null value, a splat produces a one-element tuple, and applied to null it produces an empty one, which is a handy idiom in a dynamic block's for_each.

</details>

### `conditional-expressions` · Conditional expressions

**What is the syntax and the type rule for a conditional expression?**

<details><summary>Answer</summary>

condition ? true_val : false_val, where the condition is any expression producing a boolean. A common use is supplying a fallback: var.a == "" ? "default-a" : var.a.

Both results must be the same type, so Terraform can know the expression's type without evaluating the condition. If they differ, it looks for a type both can convert to — var.example ? 12 : "hello" is legal and always returns a string. Relying on that is confusing, so convert explicitly with tostring or similar when the types are not obviously the same.

</details>

### `dynamic-blocks` · dynamic blocks

**What problem do dynamic blocks solve?**

<details><summary>Answer</summary>

Repeatable nested blocks. Normally an expression can only be used on the right of name = value, so a nested block like setting or ingress has to be written out literally. A dynamic block generates those nested blocks from a collection instead.

It takes the block type as its label, a for_each collection, an optional iterator name (defaulting to the label), and a content block for the body of each generated block. Inside, the iterator exposes .key and .value.

Dynamic blocks work inside resource, data, provider, and provisioner blocks — but cannot generate meta-argument blocks like lifecycle or provisioner, which Terraform must process before expressions can be evaluated.

</details>

### `count-meta-argument` · count

**How does count work, and what is its main constraint?**

<details><summary>Answer</summary>

Set count to a whole number in a resource, data, ephemeral, or module block and Terraform creates that many instances, each with its own real object, addressed as NAME[0], NAME[1], and so on. Inside the block, count.index gives the instance's index starting at zero.

The constraint is that the count value must be known before any remote operations — it cannot depend on an attribute that only exists after apply. count = var.enabled ? 1 : 0 is also the standard way to make a resource conditional.

</details>

### `for-each-meta-argument` · for_each

**How does for_each work, and what can it iterate over?**

<details><summary>Answer</summary>

It accepts a map or a set of strings and creates one instance per element, keyed by the map key or set value: aws_instance.web["api"]. Inside the block, each.key and each.value refer to the current element. To iterate a list, convert it first with toset.

Like count, every key must be known before any remote operation. Keys also cannot come from impure functions such as uuid, bcrypt, or timestamp, and cannot be sensitive values — Terraform puts instance keys in UI output, so a secret key would leak by design.

</details>

### `count-vs-for-each` · count vs for_each

**When should you choose for_each over count?**

<details><summary>Answer</summary>

Use count for near-identical instances distinguished only by an index. Use for_each when instances need distinct values that do not follow from an integer, and you cannot use both in the same block.

The deeper reason is addressing. Count instances are keyed by position, so removing the middle element of a list shifts every later index and Terraform plans to destroy and recreate those resources. for_each keys instances by a stable string, so removing one member leaves the others untouched.

</details>

### `implicit-dependencies` · Implicit dependencies

**How does Terraform work out the order to create resources?**

<details><summary>Answer</summary>

From the references between them. If aws_instance.web sets subnet_id = aws_subnet.main.id, Terraform knows the subnet must exist first, because the instance's argument cannot be evaluated until the subnet's attribute is known. Every such reference becomes an edge in the dependency graph.

This is the preferred way to express ordering. Because Terraform knows exactly which value the dependency is on, it can avoid planning changes when that particular value has not changed, even if other parts of the upstream object have.

</details>

### `depends-on` · depends_on

**When do you need depends_on, and why is it a last resort?**

<details><summary>Answer</summary>

Only for a hidden dependency — one resource relies on another's behavior but never reads any of its data. The classic case is software on an instance needing an IAM policy to be attached before it boots: nothing in the instance's arguments refers to the policy, so Terraform cannot infer the edge.

It is a last resort because it is coarse. Terraform must wait for every action on the whole upstream object, so more values become "known after apply" and plans get more conservative, replacing more than necessary — an effect that is especially pronounced when depends_on points at a module. It takes a literal list of references, not arbitrary expressions, and works on resource, data, module, output, ephemeral, and check blocks.

</details>

### `create-before-destroy` · create_before_destroy

**What does create_before_destroy change, and why is it opt-in?**

<details><summary>Answer</summary>

It inverts the order of a replacement. By default Terraform destroys the old object and then creates the new one, which means downtime; with create_before_destroy = true in a lifecycle block, the replacement is created first and the old object destroyed afterwards.

It is opt-in because it is not universally safe: many object types have unique name requirements or other constraints that stop the old and new from existing at once. You have to know the resource type's constraints — some offer a random name suffix for exactly this reason. It also suppresses any destroy-time provisioner on the resource.

</details>

### `create-before-destroy-propagation` · create_before_destroy propagation

**What happens to dependencies of a resource that uses create_before_destroy?**

<details><summary>Answer</summary>

They inherit it. If A has create_before_destroy and depends on B, Terraform implicitly enables it on B too and records that in state — otherwise the ordering would form a cycle in the graph.

The consequence is that you cannot then set create_before_destroy = false on B. The behavior spreads outward through the dependency chain whether or not you wrote it there.

</details>

### `prevent-destroy` · prevent_destroy

**What does prevent_destroy do, and what does it not protect against?**

<details><summary>Answer</summary>

With prevent_destroy = true in a lifecycle block, Terraform rejects any plan that would destroy that object and returns an error. It is a guard for things expensive to reproduce, such as a production database.

It does not protect against removing the resource from the configuration — delete the block and the guard goes with it. And while it is in place it makes some changes impossible to apply and stops terraform destroy from working at all, so use it sparingly.

</details>

### `ignore-changes` · ignore_changes

**When would you use ignore_changes, and how does it behave?**

<details><summary>Answer</summary>

When something outside Terraform legitimately modifies an attribute and you want to share management of the object rather than fight over it — tags written by a management agent, or a scaling controller adjusting a desired count.

You list the attribute names to ignore, or the keyword all. Terraform still uses those arguments when planning a create; it only ignores them when planning an update. With all, Terraform will create and destroy the object but never propose an update to it. Only attributes defined by the resource type can be listed — not meta-arguments.

</details>

### `replace-triggered-by` · replace_triggered_by

**What does replace_triggered_by do?**

<details><summary>Answer</summary>

Forces the resource to be replaced when a referenced resource, instance, or attribute changes. You give a list of references to managed resources — a plan to update or replace the referenced object, or any change to a referenced attribute, triggers replacement.

It only accepts managed resource addresses, because the decision is based on planned actions and a local value or variable has none. To get the same effect from a plain value, wire it through a terraform_data resource.

</details>

### `preconditions` · Preconditions

**What is a precondition, and where can it go?**

<details><summary>Answer</summary>

An assumption checked before Terraform creates the object it guards. It lives in a lifecycle block on a resource or data source, or directly in an output block, with a condition and an error_message.

Terraform evaluates preconditions while planning, and takes precedence over provider argument errors, so a failed precondition stops the operation with your message instead of a provider's. A typical use is asserting that a looked-up AMI has the CPU architecture the instance expects; on an output, it validates a value before it is exposed or stored in state.

</details>

### `postconditions` · Postconditions

**What is a postcondition, and when does it run?**

<details><summary>Answer</summary>

A guarantee checked after the fact. Terraform evaluates postconditions after planning and applying changes to a resource, or after reading a data source, and a failure errors out with your message.

Postconditions can reference self to talk about the object being checked — for example, asserting that a looked-up AMI carries the tag your configuration assumes. Because they run before dependent resources are built, they can stop a wrong value from cascading into the rest of the configuration.

</details>

### `precondition-vs-postcondition` · Choosing a custom condition

**How do you decide between a precondition and a postcondition?**

<details><summary>Answer</summary>

Ask whether the rule is an assumption you are making or a guarantee you are offering. Preconditions state what must be true for this object to be created and belong with the object that depends on the value. Postconditions state what must be true about what was produced, and belong with the object that produces it.

Either can often express the same rule. Beyond correctness, the choice is about which block reports the failure most clearly to whoever hits it, and what a future maintainer learns from reading it.

</details>

### `check-blocks` · check blocks

**What is a check block, and how does it differ from every other kind of validation?**

<details><summary>Answer</summary>

A top-level block that validates infrastructure outside the resource lifecycle. It runs as the last step of a plan or apply, after everything else, and it is the only validation that does not block: a failed assertion is a warning, and the operation continues.

A check contains one or more assert blocks, each with a condition and an error_message, and may contain its own scoped data block — fetched at the end of the operation, visible only inside that check, and with any provider errors downgraded to warnings. Typical use: assert that the site actually answers with a 200 after the apply.

</details>

### `validation-methods` · Validation methods compared

**What are Terraform's four ways to validate a configuration, and when does each run?**

<details><summary>Answer</summary>

- Input variable validation (0.13+) — checks a parameter at plan time; blocks
- Preconditions (1.2+) — checks assumptions before creating a resource, data source, or output; blocks
- Postconditions (1.2+) — checks guarantees after creating or reading; blocks
- Check blocks (1.5+) — checks broader behavior at the end of the operation; warns only

The choice comes down to two questions: should a failure stop the operation, and at what stage should the rule be evaluated. Only checks answer "no" to the first.

</details>

### `continuous-validation` · Continuous validation

**How can check blocks keep running after the apply is over?**

<details><summary>Answer</summary>

By enabling health checks on an HCP Terraform workspace. HCP Terraform then evaluates that workspace's check blocks continuously on its own schedule, not just when someone runs a plan, and reports the workspace as unhealthy when an assertion fails.

That turns a check from a one-time assertion into ongoing monitoring of an assumption — a certificate still valid, an endpoint still answering — expressed in the same configuration that built the thing.

</details>

### `sensitive-argument` · sensitive

**What does sensitive = true do on a variable or output?**

<details><summary>Answer</summary>

Redacts the value in Terraform CLI logs and in the HCP Terraform UI, showing (sensitive value) in plan and apply output instead.

The marking propagates: Terraform treats any expression that references a sensitive value as sensitive too, so a resource argument built from a sensitive variable is redacted as well. Available from Terraform 0.15 onward.

</details>

### `secrets-in-state` · Secrets in state

**Why is marking a value sensitive not enough to keep it secret?**

<details><summary>Answer</summary>

Because sensitive only affects display. The value is still written to state and plan files in the clear, so anyone who can read state can read the secret — and terraform output -json or -raw prints it in plain text on request.

That makes state itself the thing to protect: keep it out of version control, store it remotely where it is encrypted at rest and in transit, and restrict who can read it. Plan files deserve the same treatment, since they contain the same values.

</details>

### `ephemeral-values` · Ephemeral values

**What are ephemeral values, and what are the three ways to create one?**

<details><summary>Answer</summary>

Values available during a run but which Terraform never writes to state or plan files. Where sensitive hides a value, ephemeral means it was never stored at all.

- The ephemeral argument on an input variable or a child module output (1.10+)
- The ephemeral block, which declares an ephemeral resource (1.10+)
- A write-only argument on a managed resource (1.11+)

Because nothing is stored, a generated ephemeral value is gone after the run unless you deliberately capture it somewhere. You can combine ephemeral and sensitive on a variable to get both redaction and non-persistence.

</details>

### `ephemeral-contexts` · Ephemeral contexts

**Where can you reference an ephemeral value?**

<details><summary>Answer</summary>

Only in places that cannot leak it into state:

- A locals block
- A variable or child module output that is itself marked ephemeral
- A write-only argument on a managed resource
- Another ephemeral block
- A provider block
- A provisioner or connection block

The root module cannot have ephemeral outputs at all, since root outputs are stored in state.

</details>

### `ephemeral-resources` · ephemeral block

**What is an ephemeral resource?**

<details><summary>Answer</summary>

A resource declared with an ephemeral block instead of a resource block, whose result exists only for the duration of the operation — a generated password, a short-lived token, an opened connection to another system. Terraform records nothing about it in state or plan files, and re-derives it on each run.

Its result is referenced as ephemeral.TYPE.NAME.ATTRIBUTE, typically feeding a provider configuration or a write-only argument. Which ephemeral resources exist is up to each provider.

</details>

### `write-only-arguments` · Write-only arguments

**What is a write-only argument?**

<details><summary>Answer</summary>

An argument on an ordinary managed resource that Terraform passes to the provider and then discards, storing it in neither state nor the plan. Providers name them with a _wo suffix — aws_db_instance has password_wo — and mark them in the registry documentation.

Unlike other ephemeral constructs, a write-only argument accepts both ephemeral and non-ephemeral values, though the point is to feed it an ephemeral one. It is the answer to the old problem of a database password living forever in state.

</details>

### `write-only-version` · Write-only version arguments

**If Terraform does not store a write-only value, how does it know when the value changed?**

<details><summary>Answer</summary>

It does not — and that is why providers pair each write-only argument with a version argument, such as password_wo_version. The version is stored in state and is the thing Terraform can diff.

Terraform sends the write-only value to the provider on every operation, but the provider only acts on it when the version argument changes. To rotate a password you set the new value and increment the version; leaving the version alone means the new value is ignored.

</details>

### `vault-provider` · Vault provider

**How does the Vault provider help with secrets in Terraform?**

<details><summary>Answer</summary>

It lets a configuration read secrets from Vault at run time rather than hard-coding them, and — more usefully — generate dynamic, short-lived credentials. A data source such as vault_aws_access_credentials mints temporary cloud credentials for the run, which the aws provider is then configured with, so no long-lived key exists in the configuration at all.

The caveat is the general one: anything Terraform reads through a normal data source lands in state and plan files. Short-lived credentials limit the damage, and ephemeral resources and write-only arguments are the language features that avoid the persistence entirely.

</details>

### `credentials-out-of-config` · Keeping credentials out of configuration

**What are the standard practices for keeping secrets out of a Terraform configuration?**

<details><summary>Answer</summary>

- Configure provider credentials through the provider's own environment variables or credentials files, not in provider blocks
- Pass secrets in as variables marked sensitive, and ephemeral where the version supports it, rather than writing literals in .tf files
- Keep .tfvars files with real values out of version control
- Prefer values fetched at run time — Vault, a cloud secrets manager, dynamic credentials — over stored ones
- Treat state and plan files as secret material: remote, encrypted, access-controlled

</details>

## Terraform Modules

### `what-is-a-module` · Modules

**What is a Terraform module, and what is the root module?**

<details><summary>Answer</summary>

Any directory of .tf files is a module: a collection of resources managed together, with input variables as its parameters and output values as its results.

The root module is the directory Terraform runs in. Every configuration has one, so even a single main.tf is already a module. A module called from another with a module block is a child module. Modules exist so a working design can be packaged, versioned, and reused instead of copied.

</details>

### `module-block` · module block

**What arguments does a module block take?**

<details><summary>Answer</summary>

- source — required, where the module's code comes from
- version — a version constraint, available only for modules from a registry
- Whatever input variables the module declares, some possibly required
- count or for_each — mutually exclusive, to create several instances of the module
- providers — a map wiring the parent's provider configurations to the names the child expects
- depends_on — explicit ordering against other objects

The block's label is the module's local name, used to reference its outputs as module.LABEL.OUTPUT.

</details>

### `module-sources` · Module sources

**Where can a module's source come from?**

<details><summary>Answer</summary>

- Local paths beginning with ./ or ../
- The public Terraform Registry, written as NAMESPACE/NAME/PROVIDER
- A private registry — HCP Terraform, Terraform Enterprise, or your own service implementing the registry protocol — as HOSTNAME/NAMESPACE/NAME/PROVIDER
- Git repositories, including GitHub and Bitbucket shorthands, over HTTPS or SSH
- HTTP URLs serving an archive, and object storage such as S3 or GCS buckets

source must be a literal string — no variables, no expressions, no interpolation — because Terraform has to resolve it during init, before any expression evaluation.

</details>

### `module-subdirectory` · Module subdirectories

**How do you source a module that lives in a subdirectory of a repository?**

<details><summary>Answer</summary>

Put a double slash before the subdirectory path: git::https://example.com/network.git//modules/vpc. Terraform calls the whole repository or archive a package, downloads all of it, and reads the module from the subdirectory you named. Query parameters such as ref go after the subdirectory segment.

Because the entire package is on disk, a module in a subdirectory can reference a sibling module in the same package by relative local path.

</details>

### `module-versions` · Module versions

**How do you pin a module version, and how does that differ by source?**

<details><summary>Answer</summary>

Registry modules support the version argument with the usual constraint syntax — version = "~> 6.0" — and registry modules are required to use semantic versioning.

Other sources have no version argument. For Git sources you pin with a ref query parameter naming a tag, branch, or commit SHA: source = "git::https://example.com/vpc.git?ref=v1.2.0". With neither, Terraform clones whatever the default branch points at, which is not reproducible.

</details>

### `module-versions-not-locked` · Modules and the lock file

**Why does pinning module versions matter more than pinning providers?**

<details><summary>Answer</summary>

Because the dependency lock file does not cover modules — it records provider selections only. Terraform re-resolves module version constraints on every init and takes the newest version that satisfies them.

So a loose module constraint means a future init can silently pull in a different module version. If you need reproducibility, an exact version constraint (or a pinned Git ref) is the only thing that provides it.

</details>

### `module-input-variables` · Module inputs

**How does a child module receive values, and what can it not see?**

<details><summary>Answer</summary>

Only through the arguments in its module block, which set the input variables the module declares. That is the module's entire interface for values coming in.

A child module cannot see the caller's variables, locals, or resources. There is no global scope in the Terraform language: var, local, and resource names are visible only inside the module that declares them, which is what makes a module a self-contained unit you can move between configurations.

</details>

### `module-outputs` · Module outputs

**How does a value get out of a child module?**

<details><summary>Answer</summary>

Through an output block in the child, read as module.NAME.OUTPUT in the caller. Resources inside a module are not addressable from outside it, so an output is the only way to expose an attribute.

That makes a module's outputs its public API in the same way its variables are: exposing an attribute is a deliberate act by the module author, not something the caller can reach for.

</details>

### `module-scope-summary` · Variable scope in modules

**Summarize how values flow through a module tree.**

<details><summary>Answer</summary>

Down through input variables, up through outputs, and no other way. The parent sets a child's variables in the module block; the child returns values through outputs; the parent references them as module.NAME.OUTPUT and can pass them on to another module.

Providers are the exception to the strict boundary: a child module inherits its parent's provider configurations by default, and takes a non-default one through the providers map argument. Provider blocks belong in the root module, not in child modules.

</details>

### `module-composition` · Module composition

**What is module composition, and what shape should a module tree have?**

<details><summary>Answer</summary>

Keeping the tree flat — one level of child modules under the root — and wiring modules together with expressions, exactly as you would wire resources: module.network.vpc_id passed into module.consul_cluster.

The alternative, where each module creates its own dependencies, produces deep trees and modules that cannot coexist with anything else. Composition instead builds a system out of small building blocks the root module can connect in different ways.

</details>

### `dependency-inversion` · Dependency inversion

**Why should a module take its dependencies as inputs instead of creating them?**

<details><summary>Answer</summary>

Because it makes the module usable in situations its author did not foresee. A cluster module that accepts vpc_id and subnet_ids can run in a network Terraform built, a network another team owns, or a network read from a data source — and the module neither knows nor cares which.

The same principle answers "this object exists in production but must be created in dev": rather than a module that detects and conditionally creates, accept the object as an input and let each caller supply it.

</details>

### `module-count-for-each` · Multiple module instances

**How do you provision several copies of the same module?**

<details><summary>Answer</summary>

With count or for_each on the module block — the same meta-arguments resources use, and equally mutually exclusive. count gives identical instances addressed as module.NAME[0]; for_each gives one instance per map key or set member, addressed as module.NAME["key"].

The alternative is repeating the module block with different labels, which is what you want when the copies differ in more than one input.

</details>

### `module-registry-usage` · Terraform Registry modules

**How do you find and use a module from the Terraform Registry?**

<details><summary>Answer</summary>

Search the registry by what you need ("vpc", "vault", "database"), optionally filtering to partner modules, which HashiCorp reviews for stability and compatibility. Each module page shows copy-pasteable usage with its source and version, plus its inputs and outputs.

Add the module block and run terraform init, which downloads and caches the module under the working directory. Private registry modules use the same syntax with a hostname prefix, such as app.terraform.io/example_corp/vpc/aws.

</details>

### `module-refactoring` · Moving resources into modules

**What happens to existing resources when you refactor them into a module, and how do you avoid it?**

<details><summary>Answer</summary>

Their addresses change — aws_instance.web becomes module.app.aws_instance.web — and to Terraform a changed address means the old resource is gone and a new one should be created. Left alone, the plan destroys and recreates working infrastructure.

The fix is a moved block recording the old address and the new one, so Terraform updates state instead of replacing anything. It is configuration, so the rename travels with the code and applies for everyone, unlike a one-off terraform state mv.

</details>

## State Management

### `backends` · Backends

**What is a backend, and what does it decide?**

<details><summary>Answer</summary>

The component that determines where Terraform stores state and, in some cases, where operations run. Terraform 1.12 ships with a fixed set of built-in backend types — local, s3, azurerm, gcs, oci, oss, cos, consul, kubernetes, pg, http, and remote — and you cannot add more as plugins.

Backends also provide the API for state locking, though locking is optional and not every backend supports it. Each backend's documentation says whether it does.

</details>

### `local-backend` · local backend

**What does the local backend do?**

<details><summary>Answer</summary>

It is the default, used whenever a configuration declares no backend. It stores state as a JSON file on the local filesystem — terraform.tfstate next to your configuration, with terraform.tfstate.backup as the previous snapshot — locks that file using system APIs, and runs operations on your own machine.

Its optional arguments are path, which overrides the state file location, and workspace_dir, which sets where non-default workspace states go. It is fine for learning and solo work, and unsuitable for a team: no shared access, no access control, and the state is lost if the machine is.

</details>

### `backend-block` · backend block

**How is a backend configured, and what are the limits on that block?**

<details><summary>Answer</summary>

A backend block nested inside the top-level terraform block, labelled with the backend type, with type-specific arguments in its body:

terraform { backend "s3" { bucket = "my-state", key = "prod/terraform.tfstate", region = "us-east-1" } }

The limits matter. A configuration may declare only one backend block. It cannot reference named values — no variables, no locals, no data sources — because the backend must be resolved before any of that exists. And nothing else in the configuration can reference values declared inside it.

</details>

### `backend-init-required` · Initializing a backend

**What must you do after changing backend configuration?**

<details><summary>Answer</summary>

Run terraform init again — no plan, apply, or state operation will run until you do. Because the change is ambiguous, init requires you to say which you meant: -migrate-state to copy existing state into the new backend, or -reconfigure to start fresh without migrating.

The current backend configuration is cached in .terraform/terraform.tfstate, which is a different file from the terraform.tfstate holding your infrastructure state.

</details>

### `backend-credentials` · Backend credentials

**How should credentials for a backend be supplied?**

<details><summary>Answer</summary>

Through the environment variables or credentials files the target system already uses — leave the credential arguments unset in the backend block.

The reason is leakage. Terraform writes the backend configuration in plain text into .terraform/terraform.tfstate, and every saved plan file captures that same information. Hardcoding credentials in the block or passing them with -backend-config puts them in both places. Keep the .terraform directory out of version control for the same reason.

</details>

### `remote-state-benefits` · Remote state

**What do you gain by moving state off the local disk?**

<details><summary>Answer</summary>

- Collaboration — everyone operates on the same state instead of trading files
- Locking — a backend that supports it prevents two people from writing at once
- Durability and access control — state lives in a system with backups and permissions rather than on one laptop
- Secrecy — with a non-local backend, Terraform holds state only in memory and never writes it to disk, except when a write to the backend fails and it saves a local copy to avoid data loss

That last case leaves you to push the state to the backend yourself once the problem is fixed.

</details>

### `state-locking` · State locking

**How does state locking work?**

<details><summary>Answer</summary>

Automatically, on every operation that could write state, if the backend supports it. You normally see nothing — a message appears only if acquiring the lock is taking a while. If the lock cannot be acquired, Terraform stops rather than proceeding.

The point is to prevent two concurrent runs from writing state at once and corrupting it. Most commands accept -lock=false to skip locking, and -lock-timeout=DURATION to wait rather than fail immediately; disabling locking is not recommended.

</details>

### `force-unlock` · force-unlock

**When would you use terraform force-unlock, and what protects you?**

<details><summary>Answer</summary>

Only when an unlock genuinely failed and left a stale lock behind — a crashed run, a killed process.

The safeguard is that the command requires the specific lock ID, which Terraform prints when it fails to acquire the lock. That ID acts as a nonce, so you cannot blindly break whatever lock happens to be there. Breaking someone else's live lock allows two concurrent writers, which is exactly what locking exists to prevent.

</details>

### `state-pull-push` · state pull and push

**What do terraform state pull and terraform state push do, and what guards the push?**

<details><summary>Answer</summary>

pull fetches remote state and writes it to stdout, which is the safe way to take a backup or inspect the raw file. push overwrites remote state with a local file, which is dangerous and reserved for manual repair.

Two checks guard a push: lineage, the unique ID assigned when a state was created, must match, and Terraform refuses a push whose serial is lower than the destination's, since a higher serial means changes happened after the state you are writing. Both can be overridden with -force, and even then pulling a backup first is the advice.

</details>

### `terraform-remote-state` · terraform_remote_state

**How does one configuration read values from another's state?**

<details><summary>Answer</summary>

With the terraform_remote_state data source, pointing at the other configuration's backend and reading its root module outputs — only its outputs, not arbitrary resource attributes.

It is the general mechanism, but it requires access to the whole state file of the other configuration. Where a provider-specific data source can look the same value up from the platform's own API, that is the preferred choice, since it does not couple the two configurations or hand over their state.

</details>

### `resource-drift` · Resource drift

**What is drift, and how does Terraform surface it?**

<details><summary>Answer</summary>

A difference between what state records and what actually exists, caused by something changing infrastructure outside Terraform — an emergency console fix, another tool, a platform's own automation.

Terraform finds it during the refresh that precedes every plan, and reports what changed outside Terraform separately from the changes it proposes. Then, because the configuration is the desired state, a normal apply reverts the drift by making reality match the configuration again.

</details>

### `refresh-only-mode` · Refresh-only mode

**What is refresh-only mode for?**

<details><summary>Answer</summary>

Reconciling state with reality without changing infrastructure. terraform plan -refresh-only shows what has drifted; terraform apply -refresh-only updates state and root module outputs to match, and proposes no resource changes at all.

Use it when a change made outside Terraform was intentional and should be accepted rather than reverted. Note that -refresh=false cannot be combined with it, since that would disable the entire point of the operation.

</details>

### `terraform-refresh-deprecated` · terraform refresh

**Why is the terraform refresh command deprecated?**

<details><summary>Answer</summary>

Because it is an alias for terraform apply -refresh-only -auto-approve — it commits whatever it detects to state with no review.

That is risky: misconfigured provider credentials can make Terraform believe every managed object has been deleted, and it will then drop all of them from state without asking. The replacement is terraform apply -refresh-only, which shows the detected changes and prompts before writing them.

</details>

### `moved-block` · moved block

**What does a moved block do?**

<details><summary>Answer</summary>

Tells Terraform that a resource's address changed so it renames the object in state instead of destroying and recreating it:

moved { from = aws_instance.a, to = aws_instance.b }

Before planning for the new address, Terraform looks for an existing object at the old one and renames it. The syntax covers resources, modules, and resources inside child modules, which is what makes it the tool for refactoring configuration into modules.

</details>

### `moved-vs-state-mv` · moved block vs terraform state mv

**Why prefer a moved block over terraform state mv?**

<details><summary>Answer</summary>

Because the moved block is configuration. It is committed alongside the rename, reviewed with it, and applied automatically for every person and every automated pipeline running the configuration.

terraform state mv is a one-off command against one state file. Whoever runs it has to remember to, and anyone else with their own state — another workspace, another environment — has to be told. The moved block scales; the command does not.

</details>

### `removed-block` · removed block

**What does a removed block do, and what is its required argument?**

<details><summary>Answer</summary>

Removes a resource from state. It takes from, the address of the resource, and a required lifecycle block whose destroy argument decides the outcome: destroy = false removes it from state and leaves the real object alone, destroy = true removes it and destroys the object.

Handing an object off to another team or tool is the case for destroy = false. Like moved, it lives in the configuration, so the intent is reviewed and applied for everyone rather than typed once as terraform state rm.

</details>

### `state-splitting` · Splitting state

**When should a configuration be split into several, and how do you group the resources?**

<details><summary>Answer</summary>

When applies have become slow and a single plan touches too much — a monolithic state makes every change riskier and every run longer. Split by:

- Volatility — compute scaled several times a day does not belong with networking that changes twice a year
- Stateful versus stateless — keeping databases apart from instances limits the blast radius of anything that re-provisions
- Ownership — one workspace per team keeps changes in the hands of people who know that infrastructure

Then wire the pieces together with data sources or remote state outputs, not hardcoded IDs, so a change on one side does not require hand-editing the other.

</details>

### `cli-workspaces` · CLI workspaces

**What are Terraform CLI workspaces, and what are they not for?**

<details><summary>Answer</summary>

Multiple named states behind one backend and one configuration, so you can stand up several instances of the same infrastructure without a second backend or new credentials. Terraform always starts with a workspace named default, which cannot be deleted, and a plan in one workspace cannot see resources in another.

They are not the tool for system decomposition, and not for deployments needing separate credentials or access controls — a production workspace sharing a backend and credentials with a dev workspace gives you no isolation where it counts. Note also that CLI workspaces are a different concept from HCP Terraform workspaces.

</details>

### `workspace-commands` · terraform workspace

**Which workspace subcommands exist, and how does configuration see the current one?**

<details><summary>Answer</summary>

terraform workspace new, select, list, show, and delete. Not every backend supports multiple workspaces — local, s3, gcs, azurerm, consul, cos, kubernetes, oss, pg, and remote are the ones that do.

Configuration reads the current workspace as terraform.workspace, which is typically used to vary sizing or naming: count = terraform.workspace == "default" ? 5 : 1, or a Name tag built from the workspace name.

</details>

## Maintaining Infrastructure

### `terraform-import-command` · terraform import

**How does the terraform import command work?**

<details><summary>Answer</summary>

terraform import ADDRESS ID takes a resource address and the provider's own ID for an existing object, and records the binding in state. The workflow is two steps: write a resource block for the object first — the body can be left empty and filled in afterwards — then run the import.

It imports one object per invocation; there is no bulk import of, say, an entire VPC. The ID format is entirely provider-specific: an EC2 instance takes i-abcd1234, a Route 53 zone takes its zone ID, and some resources take a name. Check the resource's registry documentation.

</details>

### `import-block` · import block

**What does the import block offer that the import command does not?**

<details><summary>Answer</summary>

Imports as configuration, applied through the normal plan and apply workflow, so they can be reviewed, run in a pipeline, and done in bulk:

import { to = aws_s3_bucket.this, id = "example-bucket" }

It takes to, the target address, plus either id or identity (a map of identifying attributes) — never both. It also accepts for_each, which is how you import many similar objects from one block, and provider to choose a provider configuration. Available from Terraform 1.5.

</details>

### `import-generate-config` · Generating configuration on import

**How can Terraform write the configuration for a resource you are importing?**

<details><summary>Answer</summary>

terraform plan -generate-config-out=generated.tf. With import blocks present, Terraform generates HCL for any imported resource that has no resource block yet and writes it to that file, which must not already exist.

The generated code is a starting point, not a result: you review it, fold it into your configuration, commit it, and plan again. Applying a plan that contains generated configuration directly is an error. HCP Terraform enables generation by default for runs started from the UI or a VCS webhook.

</details>

### `import-after` · After an import

**What should you do immediately after importing a resource?**

<details><summary>Answer</summary>

Run terraform plan and read it. The plan compares your configuration against the object as it really is, so any argument you have not written yet — or written differently — shows up as a proposed change. Adjust until the plan is clean, unless the difference is one you actually want applied.

Watch for complex imports too: importing one object can pull in secondary resources, such as a network ACL bringing in a rule per entry. Any secondary resource without a block of its own will be planned for destruction on the next run.

</details>

### `import-one-to-one` · Import safety

**What is the main hazard when importing?**

<details><summary>Answer</summary>

Binding the same remote object to more than one resource address. Terraform assumes a strict one-to-one mapping and normally guarantees it by creating everything itself; importing is where you can break it, and the resulting behavior is undefined and unpleasant.

Import each object to exactly one address, and check whether another configuration or workspace already manages it before importing.

</details>

### `resource-addressing` · Resource addresses

**What is the syntax of a resource address?**

<details><summary>Answer</summary>

An optional module path followed by a resource spec: module.NAME[index].TYPE.NAME[index].

- module.foo addresses everything in that module, and module.foo[0] one instance of a multi-instance module call; nesting repeats the keyword, as in module.foo[0].module.bar["a"]
- [N] indexes a count instance, ["KEY"] a for_each instance
- Omitting the index addresses every instance of that resource
- With no module path, the address refers to the root module only

The same syntax drives -target, -replace, import, the state subcommands, and moved and removed blocks.

</details>

### `terraform-state-list` · terraform state list

**What does terraform state list show?**

<details><summary>Answer</summary>

Every resource address in state, sorted by module depth and then alphabetically, so root-module resources come first and deeply nested ones last.

Given an address pattern it filters — terraform state list aws_instance.bar lists that resource's instances, module.elb lists everything in that module and its children. The -id flag filters by the remote object's ID, which is how you answer "which resource in my configuration is this thing in the console?"

</details>

### `terraform-state-show` · terraform state show

**What does terraform state show do, and what should you not use it for?**

<details><summary>Answer</summary>

Prints the attributes Terraform has recorded for one resource instance, in a readable resource-block-like form. The address must identify exactly one instance, so count and for_each instances need their index or key — and a key containing quotes needs shell quoting.

The output is for humans, not for scripts. To feed state into other software use terraform show -json and decode the documented structure instead.

</details>

### `terraform-show` · terraform show

**What can terraform show display?**

<details><summary>Answer</summary>

Human-readable output from either a state file or a saved plan file. With no argument it shows the latest state snapshot; given a plan file it shows the planned operations, which is how you review a saved plan before applying it.

-json produces machine-readable output: a JSON representation of the state, or for a plan file the plan, the configuration, and the current state. Note that -json prints sensitive values in plain text.

</details>

### `terraform-output-command` · terraform output

**How do you read output values from the CLI?**

<details><summary>Answer</summary>

terraform output prints all root module outputs; add a name to print one. -json emits a JSON object suitable for piping into jq, and -raw prints a single value as a bare string for shell scripts, supporting only string, number, and boolean.

Two behaviors to remember: sensitive outputs are shown as `<sensitive>` in the full listing but printed in the clear when you name one specifically or use -json or -raw, and ephemeral values are omitted entirely because they were never stored.

</details>

### `state-mv-rm` · terraform state mv and rm

**What do terraform state mv and terraform state rm do?**

<details><summary>Answer</summary>

mv re-binds an existing remote object to a different address, which is how you keep an object after renaming a resource or moving it into a module. Source and destination must be the same kind of object and, for resources, the same resource type.

rm drops the binding without destroying anything: the object keeps existing and Terraform stops tracking it. The next plan will therefore propose creating a replacement, which can fail on name collisions with the object you just forgot. -dry-run reports what would be forgotten.

Both are superseded for refactoring purposes by moved and removed blocks, which go through review and apply for everyone.

</details>

### `state-command-backups` · State command safety

**What safety net do the terraform state subcommands provide?**

<details><summary>Answer</summary>

Every subcommand that modifies state writes a backup file first, and that cannot be turned off — only its path changed with -backup. Read-only subcommands like list write nothing.

The commands work identically against remote state, just more slowly, since each read and write is a network round trip. And in a shared environment, a state mv done for refactoring needs coordination: a coworker planning between your config change and your command will see a destroy-and-create.

</details>

### `terraform-graph` · terraform graph

**What does terraform graph produce?**

<details><summary>Answer</summary>

A description of the dependency graph in the DOT language, which you render with Graphviz — terraform graph -type=plan | dot -Tpng > graph.png — or paste into an online renderer.

By default it emits a simplified graph of just the resource and data blocks' dependency ordering. -type= selects a fuller graph for plan, plan-refresh-only, plan-destroy, or apply, and -draw-cycles highlights cycles in color, which is the practical way to find the source of a cycle error.

</details>

### `tf-log` · TF_LOG

**How do you turn on verbose Terraform logging?**

<details><summary>Answer</summary>

Set the TF_LOG environment variable; any value enables detailed logs on stderr. Set it to a level to control verbosity — TRACE, DEBUG, INFO, WARN, ERROR, in decreasing order — or to JSON for TRACE-level output in a parseable encoding (whose format is explicitly not a stable interface).

Logs go to stderr, so they interleave with normal output unless you redirect them.

</details>

### `tf-log-targets` · Scoped and persisted logs

**How do you log only part of Terraform, or send logs to a file?**

<details><summary>Answer</summary>

TF_LOG_CORE and TF_LOG_PROVIDER take the same levels as TF_LOG but activate only Terraform core or only the provider plugins — useful when you are trying to tell which side of the RPC boundary a problem is on.

TF_LOG_PATH appends the log to a file. It does nothing on its own: TF_LOG must also be set for any logging to happen at all. A saved log is what HashiCorp asks for on a bug report.

</details>

### `when-to-use-logging` · When to enable logging

**When is verbose logging the right tool?**

<details><summary>Answer</summary>

When the failure is not explained by the error message: a provider call failing for an unclear reason, an authentication problem, a hang, a crash, or behavior you want to report as a bug. TRACE-level logs show the API requests and responses behind each operation.

It is not a normal-operations setting. The output is enormous, it slows runs down, and it can contain credentials and other sensitive data from request bodies — so treat a saved log file as sensitive and scrub it before sharing.

</details>

### `plan-exit-codes` · Detailed exit codes

**What do terraform plan's detailed exit codes mean?**

<details><summary>Answer</summary>

With -detailed-exitcode: 0 means success with an empty diff (no changes), 1 means error, and 2 means success with changes present.

This is what lets automation branch on whether a plan found anything — a drift-detection job that alerts only on exit code 2, or a pipeline that skips the apply stage when there is nothing to do. Without the flag, plan returns 0 whether or not there are changes.

</details>

## HCP Terraform

### `what-is-hcp-terraform` · HCP Terraform

**What is HCP Terraform, and how does it differ from a general CI system?**

<details><summary>Answer</summary>

A platform that runs Terraform to provision and manage infrastructure, on demand or in response to events. You could approximate parts of it with a generic CI pipeline; what you cannot approximate is the integration — it understands runs, plans, state, and workspaces as first-class objects rather than as the output of a shell command.

That is what makes features like policy checks against a plan, cost estimation, drift detection, and a state-aware UI possible at all. It comes in Free, Essentials, Standard, and Premium plans, billed per managed resource, with the free tier capped at 500 managed resources.

</details>

### `remote-operations` · Remote operations

**What is a remote operation, and what depends on it?**

<details><summary>Answer</summary>

A Terraform run executed on HCP Terraform's own disposable virtual machines rather than on your workstation. Runs can be started by a VCS webhook, the UI, the API, or the CLI — and when started from the CLI, the output streams back to your terminal so it feels local.

Many features exist only because execution is remote: Sentinel policy enforcement, cost estimation, notifications, and run tasks. Set a workspace to local execution and you lose all of them; the workspace becomes purely a state backend.

</details>

### `execution-modes` · Execution modes

**What are HCP Terraform's execution modes?**

<details><summary>Answer</summary>

- Remote — plans and applies run on HCP Terraform's infrastructure. The default, and the one that enables the platform's features.
- Local — operations run on your own machines and HCP Terraform only stores and synchronizes state.
- Agent — operations run on an agent you host, managed by HCP Terraform.

The mode is set at the organization level and can be overridden per project and per workspace, with new workspaces inheriting their project's default.

</details>

### `hcp-agents` · HCP Terraform agents

**What problem do HCP Terraform agents solve?**

<details><summary>Answer</summary>

Reaching infrastructure that HCP Terraform cannot: private, isolated, or on-premises environments. The agent runs inside your network and polls HCP Terraform for work, so changes execute locally and you never have to open inbound access to your resources.

Agents are a paid feature. They can also run custom programs called hooks at points during a run — to pull down a tool the run needs, or to notify an external system.

</details>

### `hcp-workspaces` · HCP Terraform workspaces

**What is an HCP Terraform workspace, and what does it hold?**

<details><summary>Answer</summary>

The equivalent of a persistent working directory: everything Terraform needs for one collection of infrastructure. Where local Terraform keeps configuration on disk, values in .tfvars, state in a file, and credentials in your shell, a workspace holds the configuration (from a linked VCS repo or uploaded), the variables, the state, and any secrets as sensitive variables.

It also keeps things a directory does not: a history of state versions for recovery and comparison, and a full run history with logs, the change that triggered each run, and user comments.

</details>

### `hcp-vs-cli-workspaces` · Workspaces compared

**How do HCP Terraform workspaces differ from Terraform CLI workspaces?**

<details><summary>Answer</summary>

They share a name and little else. HCP Terraform workspaces are mandatory — you cannot manage anything without at least one — and each represents a distinct collection of infrastructure with its own configuration, variables, and state. They are also the unit of role-based access control, which is what makes them a governance tool.

CLI workspaces are optional, tied to a single working directory, and only isolate several state files behind one configuration and one set of credentials.

</details>

### `configuration-versions` · Configuration versions

**How does a workspace get its configuration?**

<details><summary>Answer</summary>

As a series of configuration versions. Most commonly the workspace is linked to a VCS repository and each version corresponds to a commit on the tracked branch, which is what lets a merge trigger a run.

Workspaces not linked to a repository receive configuration versions uploaded through the CLI or the API — the CLI-driven and API-driven workflows.

</details>

### `run-queue` · Run queue and locking

**How does HCP Terraform order runs within a workspace?**

<details><summary>Answer</summary>

Strictly, one at a time. Each workspace has its own queue; a new run goes to the end and stays pending until the current one finishes completely — it is not even planned early, because the run in progress could change what it would do. A run in progress locks the workspace, and a user or team can also lock one deliberately for maintenance.

Plan-only runs are the exception: they neither block the queue nor respect the lock, since they change nothing. Once a run starts, it is pinned to a specific configuration version and set of variable values, so later edits affect only later runs.

</details>

### `organizing-workspaces` · Organizing workspaces

**How should infrastructure be divided across workspaces?**

<details><summary>Answer</summary>

By breaking a monolithic configuration into smaller ones and giving each its own workspace and its own owners — networking-prod, app1-prod, monitoring-prod, each assigned to the team responsible for it.

HCP Terraform will manage a monolith perfectly well, but smaller components are what make its delegation and governance features useful: permissions can be granted per workspace, teams can work in parallel without colliding in one queue, and the same configuration can be reused for another environment.

</details>

### `projects` · Projects

**What are projects in HCP Terraform?**

<details><summary>Answer</summary>

Groups of workspaces that also act as a permissions boundary. A project carries its own permission set, so a team can be granted access to every workspace in it at once — more granular than organization-wide permissions, broader than one workspace at a time.

Every workspace belongs to exactly one project; without a choice it lands in the organization's Default Project, which can be renamed but not deleted. Projects also carry a default execution mode that their workspaces inherit. Structure them around the groups that need distinct access rules — business units, departments, or technical teams.

</details>

### `run-triggers` · Run triggers

**What is a run trigger?**

<details><summary>Answer</summary>

A connection that queues a run in your workspace automatically whenever a run in a source workspace applies successfully. A workspace can have up to 20 source workspaces, and configuring triggers requires admin access to the target workspace plus permission to read runs in the source.

They exist to make a cross-workspace dependency explicit: if your configuration reads values another workspace produces, a trigger says so, rather than leaving you to notice the change. Triggered runs do not auto-apply unless you enable the separate "auto-apply run triggers" setting.

</details>

### `cross-workspace-state` · Sharing data between workspaces

**How does one workspace read another's outputs?**

<details><summary>Answer</summary>

Traditionally with the terraform_remote_state data source, reading the source workspace's root-level outputs. The source workspace must be configured to allow that access first.

HashiCorp now recommends the tfe_outputs data source from the HCP Terraform provider instead, because terraform_remote_state requires access to the entire state of the other workspace, while tfe_outputs fetches only the outputs.

</details>

### `hcp-variables` · Workspace variables

**What kinds of variables can a workspace hold?**

<details><summary>Answer</summary>

Two categories. Terraform variables supply values for the configuration's input variables; environment variables are exported into the run environment, which is how provider credentials are usually supplied.

Either can be marked sensitive, which write-protects the value — it can be updated but never read back through the UI or API. Terraform variables can also be marked as HCL, so the value is parsed as an expression rather than a plain string, which is how you set a list or a map. Note that the Variables page does nothing in a workspace set to local execution.

</details>

### `variable-sets` · Variable sets

**What is a variable set?**

<details><summary>Answer</summary>

A named collection of variables applied to many workspaces at once, so a shared value — a cloud region, a set of credentials, a common tag — is defined once instead of copied into every workspace.

A set can be applied globally to every workspace in the organization, or scoped to particular projects and workspaces. Managing organization-owned sets requires the owners team or a team with Manage all projects or Manage all workspaces.

</details>

### `hcp-variable-precedence` · Variable precedence in HCP Terraform

**Which wins when a variable is set in several places?**

<details><summary>Answer</summary>

Run-specific values set on the command line — -var and -var-file, or TF_VAR_ environment variables in the CLI workflow — overwrite both workspace-specific variables and variable set values with the same key. That behavior requires Terraform 1.1 or later.

Between the other two, a workspace-specific variable overrides a value from a variable set, and a more specifically scoped variable set overrides a broader one.

</details>

### `private-registry` · Private registry

**What is the HCP Terraform private registry for?**

<details><summary>Answer</summary>

Sharing providers and modules inside an organization, with the same versioning and searchable browsing as the public registry. Private modules and providers are visible only to the organization; public ones from the Terraform Registry can be synchronized into it as well, which is how you signal which public modules are the recommended ones.

Policies can then govern its use — requiring that every non-root module come from your own registry, or that modules be on a recent version.

</details>

### `policy-enforcement` · Policy enforcement

**How does policy enforcement work in HCP Terraform?**

<details><summary>Answer</summary>

Policies are grouped into policy sets, which are checked against the Terraform plan on every run in the workspaces they apply to — after Terraform decides what it would do, before it does it. A policy set can be applied globally or scoped to specific projects and workspaces.

Three frameworks are supported: Sentinel, HashiCorp's policy-as-code language; OPA, using Rego; and a newer native HCL-based Terraform policy framework. One policy set uses one framework, but a workspace can have sets from more than one. The recommended workflow stores policies in a VCS repository rather than authoring them in the UI. Free organizations get one set of up to five policies; connecting a set to a VCS repo requires Standard or Premium.

</details>

### `cost-estimation` · Cost estimation

**What does cost estimation add to a run?**

<details><summary>Answer</summary>

An estimate of the monthly cost of the resources in a plan, and of how the change alters that cost, shown alongside the plan before anyone applies it.

Because it runs as part of the run, policies can act on it — refusing a change that pushes a workspace past a spending threshold, for example. It is available in the Standard and Premium editions.

</details>

### `health-assessments` · Health assessments

**What are health assessments, and what do they cover?**

<details><summary>Answer</summary>

Periodic checks HCP Terraform runs against a workspace on its own schedule, without anyone starting a run. They cover two things:

- Drift detection — does the real infrastructure still match the configuration
- Continuous validation — do the workspace's check blocks still pass after provisioning

Requirements: remote or agent execution mode, at least one successful apply in the workspace, and Terraform 0.15.4+ for drift detection or 1.3.0+ for both. Assessments pause if the latest run errored, was cancelled, or was discarded. The feature is available in Standard and Premium.

</details>

### `explorer` · Explorer

**What is the explorer for workspace visibility?**

<details><summary>Answer</summary>

A query interface over an entire organization's data, for the point where you have too many workspaces to inspect one at a time. It covers four types — workspaces, modules, providers, and Terraform versions — plus prepared views for common questions: drifted workspaces, workspaces with failed checks, workspaces without VCS, top module and provider versions, runs by status.

A query builder allows custom filter conditions, and results can be saved as a view. Using it requires organization owner or at least View all workspaces.

</details>

### `change-requests` · Change requests

**What are change requests?**

<details><summary>Answer</summary>

Action items recorded directly on the workspaces that need them, forming a backlog an administrator can hand to the owning teams — upgrade a deprecated module version, apply a security fix, resolve a compliance gap.

The usual flow starts in the explorer: find the affected workspaces with a query, create a change request across them with a message, and let team notifications tell the owners. Whoever completes the work archives the request. Available in Standard and Premium.

</details>

### `teams-and-permissions` · Teams

**How does HCP Terraform structure access control?**

<details><summary>Answer</summary>

Around teams — groups of users within an organization. Belonging to at least one team in an organization is what makes someone a member of it, and permissions are granted to teams rather than individuals: starting runs, managing variables, reading and writing state, and so on, per workspace or per project.

Every organization has an owners team whose first member is its creator; it cannot be deleted or emptied, and is capped at five members in free organizations. Teams can also hold API tokens of their own, not tied to any user, which is what automation should authenticate with.

</details>

### `cloud-block` · cloud block

**How does a working directory connect to HCP Terraform?**

<details><summary>Answer</summary>

With a cloud block inside the terraform block, naming the organization and which workspaces to use:

terraform { cloud { organization = "my-org", workspaces { tags = ["networking"] } } }

Inside workspaces you give either name, for one specific workspace, or tags, which links the directory to every matching workspace in the organization and offers to create one if none match; project narrows it further. A configuration cannot have both a cloud block and a backend block — HCP Terraform manages the state itself. The CLI integration requires Terraform 1.1 or later; older versions use the remote backend.

</details>

### `terraform-login` · terraform login

**What does terraform login do, and where does the token go?**

<details><summary>Answer</summary>

Obtains an API token for HCP Terraform, Terraform Enterprise, or any host implementing the login protocol, defaulting to app.terraform.io when you give no hostname. It launches a browser on the same machine, so it only works interactively.

The token is saved in plain text in a local CLI configuration file, credentials.tfrc.json, and the command tells you exactly where before writing it. For unattended automation, configure credentials in the CLI configuration file instead, or use a credentials helper that fetches them from a secrets manager.

</details>

### `cli-driven-workflow` · CLI-driven workflow

**What changes about terraform plan and apply once a cloud block is present?**

<details><summary>Answer</summary>

They execute remotely by default, in HCP Terraform's run environment, with the log streamed back to your terminal. The commands feel the same, but the run now gets workspace variables encrypted at rest, cost estimation, and policy checks — and appears in the workspace's run history like any other run.

If the workspace is set to local execution, this reverses: HCP Terraform just stores state and behaves like an ordinary remote backend.

</details>

### `state-migration-to-hcp` · Migrating state to HCP Terraform

**How do you move an existing configuration's state into HCP Terraform?**

<details><summary>Answer</summary>

Add the cloud block naming the organization and destination workspace, then run terraform init. Terraform detects the backend change, offers to copy the existing state up, and creates the target workspaces if they do not exist.

Before doing it, stop all Terraform operations against that state — pause CI jobs, restrict backend access, tell the other people who use it — and migrate only into workspaces that have never had a run, so nothing is overwritten.

</details>

### `dynamic-credentials` · Dynamic provider credentials

**How do dynamic provider credentials work, and why prefer them to stored ones?**

<details><summary>Answer</summary>

You establish a trust relationship between the cloud platform and HCP Terraform. For each plan and apply, HCP Terraform mints an OIDC-compliant workload identity token carrying the organization, workspace, and run phase; the platform verifies it with HCP Terraform's public signing key and returns fresh temporary credentials, which live only for that run and are discarded when the run environment is torn down.

Static credentials in a workspace are a standing risk no matter how often you rotate them. Dynamic ones remove the secret entirely, and let the platform scope permissions on the token's metadata — so a plan can be given less access than an apply.

</details>

