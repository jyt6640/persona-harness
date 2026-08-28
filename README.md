<!-- <CENTERED SECTION FOR GITHUB DISPLAY> -->

<div align="center">

<img src="img/Persona-Harness-Logo.png" alt="Persona Harness logo" width="180">

# Persona Harness

**Evidence-first completion gates for AI coding agents building Java/Spring backends.**

[![npm version](https://img.shields.io/npm/v/persona-harness?color=369eff&labelColor=black&style=flat-square)](https://www.npmjs.com/package/persona-harness)
[![npm downloads](https://img.shields.io/npm/dt/persona-harness?color=ff6b35&labelColor=black&style=flat-square)](https://www.npmjs.com/package/persona-harness)
[![node](https://img.shields.io/badge/node-%5E20.17.0%20%7C%7C%20%3E%3D22.9.0-c4f042?labelColor=black&style=flat-square)](https://nodejs.org)
[![License](https://img.shields.io/badge/license-Apache--2.0-white?labelColor=black&style=flat-square)](./LICENSE)

[English](https://github.com/jyt6640/persona-harness/blob/main/README.md) | [한국어](https://github.com/jyt6640/persona-harness/blob/main/docs/current/README.ko.md) | [日本語](https://github.com/jyt6640/persona-harness/blob/main/docs/current/README.ja.md) | [简体中文](https://github.com/jyt6640/persona-harness/blob/main/docs/current/README.zh-cn.md)

**[Start Here](docs/START-HERE.md) · [Quick Demo](docs/QUICK-DEMO.md) · [Measured Claims](docs/MEASURED-CLAIMS.md)**

</div>

<!-- </CENTERED SECTION FOR GITHUB DISPLAY> -->

## See it in 30 seconds

**The problem:** an AI coding agent says "Done!" after a Java/Spring change,
but the test, build, and review evidence behind that claim is missing or stale.

**Install from a project directory:**

```bash
npm install -D persona-harness && npx ph init && npx ph bootstrap backend
```

**Give the agent one concrete backend goal, then ask the gate to verify it:**

```bash
npx ph go "Add a task creation endpoint."
npx ph workflow finish implement
```

**What has actually been observed:** a simple forged-evidence fixture is
ignored and `finish` exits `1`; the opt-in TDD rail blocked green-only
completion in 5/5 measured runs. Runtime injection did not improve the paired
OpenCode measurements and added cost, so it remains default-off.

**Built for:** Java/Spring/Gradle projects using OpenCode, with explicit
workflow gates and evidence checks.

**Not a promise of:** automatic implementation, generated-app quality,
production readiness, token savings, or broad security guarantees.

**Start with:** [Quick Demo](docs/QUICK-DEMO.md) · [Measured Claims](docs/MEASURED-CLAIMS.md) · [Install guide](docs/START-HERE.md)

> [!IMPORTANT]
> **Alpha, gate-first, measured.** Live registry channels, tags, GitHub releases,
> and audit lifecycle facts are maintained by governed workflows and release
> records; source release notes are inputs, not standalone proof. Runtime
> injection remains **default-off / opt-in**. See
> [`docs/current/p3-integrity-roadmap.md`](docs/current/p3-integrity-roadmap.md),
> [`docs/MEASURED-CLAIMS.md`](docs/MEASURED-CLAIMS.md), and
> [`injection-value-status.json`](docs/current/injection-value-status.json).

## Measured Behavior

Unlike most agent-harness projects, PH publishes what it has actually measured — including negatives.

- **Simple forged TDD evidence fixture** planted before `workflow finish` → `finish` exits **1**, forged file ignored.
- **Green-only completion** with the TDD rail on → blocked **5/5** (vs allowed 5/5 off). Measured against the pre-authority gate; `finish` now also requires external authority in every configuration, so the "allowed" arm is no longer reproducible as written.
- **Runtime injection**, 10 paired OpenCode runs → equal success (10/10 both), but PH ON cost more on every pair → kept **default-off**.
- **Observer findings surfaced to the agent**, 10 paired OpenCode runs → remaining violations did not drop (3.50 off vs 3.80 on) → kept **default-off**.

Completion-integrity measurements are bounded local fixtures. They are *not*
token-saving, app-quality, product-efficacy, security, GA, or broad
anti-forgery claims. Full boundary and P3 hold:
**[docs/MEASURED-CLAIMS.md](docs/MEASURED-CLAIMS.md)** and
**[docs/current/p3-integrity-roadmap.md](docs/current/p3-integrity-roadmap.md)**.

## What it is

A workflow + evidence CLI (`ph`) with an optional OpenCode plugin, for Java/Spring backend work done by AI agents. It:

- turns a project idea or README into implementation tickets;
- keeps the agent on a repeatable backend workflow;
- runs verification through bounded commands;
- records local evidence of what was read, run, and finished;
- can block completion when required reports or evidence for defined gates are
  missing.

Persona Harness exposes two deliberately separate tracks:

- **Workflow Integrity** is the existing evidence and completion-gate product.
- **Context Personalization (Experimental)** is a local, default-off path for
  targeted convention guidance. When enabled in a project that has the
  OpenCode plugin registered, it delivers one bounded Context block only after
  a safe observed file target. It grants no completion authority.

Context configuration is separate from legacy runtime guidance switches. A
missing block stays disabled. An explicit `context.enabled` setting controls
only the targeted Context adapter; it does not enable legacy runtime guidance,
write configuration, or create workflow/evidence/authority state:

```jsonc
{
  "context": {
    "enabled": false,
    "mode": "targeted",
    "maxCapsules": 8,
    "maxChars": 1600
  }
}
```

Only `targeted` is accepted. Invalid or unknown Context fields leave Context
disabled with a bounded diagnostic; they do not inherit enablement from
`features.runtimeInjection` or `features.projectPhilosophyInjection`.

`ph context status` is available as a read-only local inspection of that
configuration and an optional safe Team Profile. `ph context preview
<target-file>` accepts a safe project-relative path without opening the target,
then renders a deterministic local Context Envelope from product invariants,
starter defaults, and any available Team or personal rules. It remains an
inspection surface: it neither enables Context nor delivers to a host.
`ph context explain <target-file>` renders the envelope's bounded selection,
shadowing, resolution, budget, and digest metadata without exposing rule text.
Both inspection commands are read-only: they do not enable Context, activate a
host adapter, or create state. Bare `ph context init` remains a no-write
preview. `ph context init --enable` creates only the minimal Context config in
a fresh safe project; it refuses to overwrite an existing harness config and
does not change legacy feature flags. `ph context doctor` reports the actual
local configuration and Team Profile state, including the bundled OpenCode 1.x
adapter. It cannot prove that a particular OpenCode session has loaded the
project plugin.

With Context enabled, the OpenCode adapter accepts only a safe observed
project-relative target from a read or edit tool. It resolves the local
envelope, rejects invalid/unsafe/budget-exceeding input without delivery, and
prepends the selected bounded capsule content to the next user message for the
same session. It suppresses the same digest until that session is compacted or
deleted. It does not infer a target from the prompt, inject a full skill
catalog, access the network, execute shell commands, or write workflow,
evidence, or authority records. The adapter's actual behavior in a live
OpenCode release remains a separate host-observation boundary.

The optional runtime adapter also registers the bundled portable Persona-owned
shared-skill catalog with OpenCode. Product ideas start with a one-question
interview and explicit brief approval; adapters advise only and never create
workflow state or invoke host agents automatically. See [Persona Shared Skills
Core](docs/current/persona-shared-skills-core.md).

It is **not** a code-quality guarantee, a token-saving product, a broad linter,
proof that generated apps are production-ready, or a strong completion-integrity
guarantee before P3 closes. Every claim broader than the measured gates must be
earned by measurement first — see [MEASURED-CLAIMS](docs/MEASURED-CLAIMS.md).

## Install

Requires Node.js ^20.17.0 || >=22.9.0 (Node 21 is unsupported), Java 21+ / Gradle, and the OpenCode CLI with a configured provider.

```bash
# OpenCode
curl -fsSL https://opencode.ai/install | bash   # or: npm install -g opencode-ai
opencode auth login

# Persona Harness
npm install -D persona-harness
npx ph --help && npx ph doctor
```

## Quick Start

For a clean project directory (not the Persona Harness repo itself):

```bash
mkdir -p /tmp/ph-demo && cd /tmp/ph-demo && npm init -y
npm install -D persona-harness

npx ph init                 # minimal integration files only
npx ph bootstrap backend    # AGENTS.md, profile, plan, report templates
npx ph go "Add a task creation endpoint."
```

For an existing Java/Spring/Gradle project, inspect the inferred draft first,
then accept it explicitly:

```bash
npx ph attach
npx ph attach --yes

# Only for a recognized weak Persona Harness installation, never a ready one:
npx ph attach --repair --yes
```

`attach` refuses unrecognized or corrupt existing Persona Harness files rather
than overwriting them, and it rejects repair for an already-ready attachment.
A successful attach enables PH-run verification and the narrow
`projectPhilosophyInjection` default: when a ready project profile has one safe
`philosophy.project` convention, it is available automatically as project-local
guidance. It does not enable the broader `runtimeInjection`,
`systemConstitution`, `idleContinuation`, or Ralph loop rails, which remain off.

`ph go` is the host-neutral single entry for one concrete implementation
requirement after bootstrap and plan acceptance. It captures the requirement,
creates and selects the ticket, and prints the existing implementation rail;
it does not require a runtime hook or enable runtime injection. The agent should
follow that rail and end with `npx ph workflow finish implement`. Its workflow
conflict preservation applies to cooperative local PH/user writers and does not
address hostile same-user filesystem path replacement.

### Opt-in project updates

Project-local updates are off by default. In an intact Persona Harness project,
opt in with:

```bash
npx ph update enable --yes
npx ph update status --json
```

On a later OpenCode session, Persona Harness makes one bounded npm `latest`
check in the background. If a newer stable version exists, it updates only the
active exact `persona-harness@<version>` plugin pin and its owned init manifest;
the already-running session, rules, profile, workflow files, and other plugins
are left alone. The new pin is picked up by the following session. Disable it
with `npx ph update disable --yes`.

Older projects attached through a disposable staging directory can have a
valid-looking manifest that still binds that temporary path. If `ph update
enable --yes` reports `ownership-unavailable`, run the explicit recovery once:

```bash
npx ph update repair --yes
npx ph update enable --yes
```

Recovery recognizes only that bounded legacy attach shape. It replaces the
legacy absolute Persona Harness plugin entry with the installed versioned npm
specifier and rebinds the manifest to the current project. It preserves other
OpenCode configuration and never overwrites changed rules, profiles, workflow
state, or `.gitignore`; malformed, symlinked, foreign, or ordinary projects are
left unchanged.

> [!NOTE]
> If `workflow finish` fails, the agent must fix the reported blocker before claiming completion. **That failure is the product working, not a bug.**

> [!IMPORTANT]
> `workflow finish` cannot reach a trusted PASS from a purely local checkout. Clearing every content gate still leaves `trusted-authority-required`, because only a verified external attestation from an enrolled repository grants finish authority. Enrol one with `npx ph authority`, and run `npx ph doctor` to see the current `Finish authority` and `Consumer authority` state before you rely on the gate.

Three-beat setup, gate, and goal-entry walkthrough: **[Quick Demo](docs/QUICK-DEMO.md)**. Repository maintainers and reviewers can run the separate exact-package Gradle/JUnit contract: **[Full cooperative verification demo](docs/QUICK-DEMO.md#full-cooperative-verification-demo)**.

## Maintainer verification

From a source checkout, the commands have deliberately different scopes:

```bash
npm test                    # source checkout: fast tests; installed tarball: CLI smoke
npm run test:unit           # focused pure resolver/config/adapter tests
npm run test:integration    # focused profile/runtime/package-policy integration
npm run test:smoke          # build plus packaged CLI help smoke
npm run test:package        # fresh tarball and installed-package contract
npm run test:full           # complete repository/release contract
npm run test:repository:parallel           # parallel-safe Vitest project
npm run test:repository:resource-sensitive # isolated fixture-heavy Vitest project
npm run test:repository:fast               # both PR test projects, sequentially for local use
npm run test:repository     # full repository contract for release: policy, docs, all tests, and clean-package checks
node scripts/verify-cooperative-finish-demo.mjs # exact packed-package Java/Spring Gradle/JUnit demo
```

The required `Verify repository` aggregate waits for policy, typecheck, build,
and both Vitest projects on pull requests. On `main` pushes it additionally
requires the authoritative clean-package boundary, Linux source and installed
package surfaces, and the exact cooperative demo. Release and publish workflows
retain the full `test:repository` contract. These commands establish their
named contracts; they do not certify generated application quality or external
Finish authority.

For the measured CI decision and operational failure modes, see [CI fast
feedback troubleshooting](docs/troubleshooting/ci-fast-feedback.md).

## TDD Rail (opt-in)

Enable both settings in `.persona/harness.jsonc`:

```json
{ "enforce": { "executeVerification": true, "tdd": true } }
```

`ph workflow test` is intended to record red evidence from PH-run Gradle/JUnit
failures, and `workflow check` / `archive` / `finish` record green evidence for
the same ticket/test id. Current P3 work is strengthening the authority model so
unsigned project-local artifacts cannot satisfy finish authority by themselves.
It is a red-first completion gate; it does not scaffold tests, prove test
sufficiency, run coverage/mutation, or certify app quality.

## Commands

```bash
npx ph attach [--yes]                                  # existing Java/Spring/Gradle project
npx ph go "Add a task creation endpoint."                 # concrete single entry
npx ph workflow check | implement | finish implement | archive <ticket-id>
npx ph workflow split README.md && npx ph workflow next   # multi-ticket
npx ph bearshell --shell 'gradle test'                    # bounded execution
npx ph evidence summary | metrics --json | ab-report --json | pminus-report --json
npx ph authority status | enroll github <owner/repository> --workflow <path> | fetch github [owner/repository]
npx ph feedback                                      # project-local tester feedback template
npx ph feedback dogfood source-read-runtime-unavailable # private bounded owner dogfooding event
npx ph observe src/main/java                              # Java/Spring observer findings
npx ph review backend-shape
```

Run `npx ph --help` for the full list. The workflow ledger lives under `.persona/workflow/` (`work/`, `history/`, `requirements/`).

`ph feedback dogfood <code>` is intentionally separate from the project
feedback template. It records only a fixed diagnostic code and timestamp in
`events.jsonl` inside the private owner state directory
`~/.local/state/persona-harness/owner-dogfood-feedback`. Set
`PH_OWNER_DOGFOOD_FEEDBACK_ROOT` only to an absolute replacement state
directory; the command appends `events.jsonl` inside it. It does not capture
project files or conversation text, and it cannot grant workflow, release,
authority, or external-observation permission.

## Advanced surfaces

Preview integrations, shared-skill source material, Role Checklist Relay, and
developer MCP details are intentionally outside the Quick Start. Repository
contributors can use `docs/current/advanced-surface-index.md`; these surfaces
do not change the P0-3 root CLI discovery contract.

## Platform And Host Support

### Node runtime floor

The packaged CLI and its product-owned Sigstore authority verifiers require
Node.js ^20.17.0 || >=22.9.0. `ph doctor` reports this range without reflecting
unsafe runtime input; a lower or malformed runtime blocks CLI authority work
before verification. Repository source tests use a stricter Vite toolchain
floor (Node 20.19.0 or Node 22.12.0+), which is distinct from the published
package engine.

On a supported runtime, `ph doctor` makes fixed, read-only npm registry
readbacks for this installed package version's deprecation field and the
`latest`, `next`, `staging`, and legacy (`legacy`/`alpha`) channels. Missing,
malformed, oversized, or unsafe registry data becomes a bounded diagnostic.
Registry channels never grant Finish authority. External assurance readiness is
a separate non-consuming inspection and does not move registry or trust state.
For a public enrolled project, `ph authority enroll github ...` requires an
interactive confirmation, and `ph authority fetch github` retrieves only a
matching original public artifact through fixed GitHub policy. `GH_TOKEN` (or
`GITHUB_TOKEN`) is an in-memory credential with Actions read access only: it
authenticates fixed GitHub API requests and cannot supply repository, workflow,
source, digest, or redirect identity. An independent observer obtains its
ephemeral `GH_TOKEN` from an already authenticated host only immediately before
the read-only authority command, keeps the consumer `HOME` isolated, and never
logs or persists that credential. Persona Harness does not read a host keychain
or provide a credential fallback. When more than one repository is enrolled,
pass the selected enrolled `owner/repository` to `fetch github`. Neither
command publishes a package, moves a channel, or consumes Finish authority.

| Surface | Status | Evidence boundary |
| --- | --- | --- |
| Linux + OpenCode | Product: Node ^20.17.0 || >=22.9.0; source checks: Node 20.19.0 | Required Verify repository aggregates PR fast feedback and main package integration. Pull requests run policy, typecheck, build, and the two Vitest projects; main pushes additionally run Linux Node 20.19.0 source-built, packed-tarball, and fresh local-tarball installed checks. The dispatch-only support matrix retains exact product-floor Linux Node 20.17.0 and 22.9.0 imports plus latest Linux Node 20, 22, and 24 on demand. |
| macOS + OpenCode | Manual limited smoke | The dispatch-only support matrix retains macOS Node 22 smoke only; this is not a promise of macOS Node 20/24 coverage. |
| Windows | Unverified / nonblocking | No Windows matrix job or support claim. Lock identity device/inode behavior and stale-lock/concurrency conclusions are not measured or verified. |
| Codex adapter | Planned | No current Codex adapter or Codex product evidence; this is a planned adapter only. |

Automatic CI boundary: Verify repository is the required PR/main aggregate. Pull requests require only the fast feedback lanes; main pushes also require Linux Node 20.19.0 package integration. The dispatch-only support matrix is deferred multi-runtime evidence, not a required PR/main gate. It is distinct from the canonical clean-CI builder's main-push signed evidence and the ordinary path-filtered diagnostic selftest.

## Boundaries & safety

Evidence answers one bounded question — *"What did this PH workflow observe for
this defined gate?"* — and nothing more. PH does **not** promise app-quality
certification, token savings, Clean Code guarantees, broad AST/linter
enforcement, a full TDD framework, closure guarantees, strong anti-forgery
integrity before P3, or a complete workflow without OpenCode. The canonical list
is in [MEASURED-CLAIMS](docs/MEASURED-CLAIMS.md).

> [!WARNING]
> `ph bearshell` is **not a sandbox**. It limits runtime and output size, but commands still run on your machine with your permissions. See [SECURITY](SECURITY.md).

## Docs

- **New users** → [Start Here](docs/START-HERE.md) · [Quick Demo](docs/QUICK-DEMO.md) · [Measured Claims](docs/MEASURED-CLAIMS.md)
- **Agent not following the rail?** → [Troubleshooting](docs/troubleshooting/README.md)
- **Install & backend shape** → [MVP install guide](docs/current/java-backend-mvp-install-guide.md)
- **Contributors** → [CONTRIBUTING](CONTRIBUTING.md) · [ROADMAP](ROADMAP.md) · [CODE_OF_CONDUCT](CODE_OF_CONDUCT.md)
- **Release & measurement** → [release operations](docs/current/release/README.md) · [versioned release docs](docs/releases/README.md) · [package index](docs/releases/package-index.md) · [Changelog](CHANGELOG.md)
- **Advanced repository surfaces** → `docs/current/advanced-surface-index.md`

## Contributing

Contributions are welcome — including negative measurement results. PH only asserts what its evidence supports, and PRs that expand a claim must bring the measurement. Start with [CONTRIBUTING.md](CONTRIBUTING.md).

## License

Apache-2.0. See [LICENSE](LICENSE).
