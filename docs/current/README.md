# Current Docs

> **New to Persona Harness?** Start with [`START-HERE`](../START-HERE.md),
> [`QUICK-DEMO`](../QUICK-DEMO.md), and
> [`MEASURED-CLAIMS`](../MEASURED-CLAIMS.md). This directory is for operators
> and maintainers, not a first-run tutorial.

`docs/current/` contains active decisions, maintenance inputs, and retained
history. Its location alone does not make a document current.

## Selection Rule

Use a record as current only when this page or
[`canonical-docs-index.md`](canonical-docs-index.md) selects it. Retained
versioned snapshots, beta evidence, and old readiness decisions remain useful
history but do not become a current product or release claim.

## Choose By Task

| I need to... | Start here |
| --- | --- |
| Install or understand the product | [Detailed usage](persona-harness-detailed-usage.md) and [workflow lifecycle](workflow-closure-state-machine-design.md) |
| Use the portable shared-skill or product-discovery guidance | [Persona Shared Skills Core](persona-shared-skills-core.md) |
| Maintain a local personalization profile | [Personalization Profile V1](personalization-profile-v1.md) |
| Follow the Context Personalization program | [Context Personalization Program Status](context-program-status.md) |
| Define safe project-shareable team conventions | [Team Profile V2](context-team-profile-v2.md) |
| Understand claims and measurement limits | [Measurement scorecard](measurement-scorecard.md) |
| Review Finish or external authority boundaries | [Consumer Authority V1 decision](consumer-authority-v1-decision.md); the repository-only external-attested walkthrough supplies the full procedure |
| Ship or audit a release | [Release operations](release/README.md) and [versioned release docs](../releases/README.md) |
| Find a retained design, report, or version record | [Full inventory](docs-inventory.md) |
| Explore dormant or repository-only work | Use the source checkout's advanced surface index. |

## Current Operating Inputs

- `workflow-closure-state-machine-design.md` is the current
  `workflow-lifecycle.1` fail-closed projection for workflow status, closure
  JSON, loop-state checks, and Finish guidance.
- `workflow-state-concurrency.md` defines writer ownership and the read-only
  handling of absent, malformed, stale, or unsafe state.
- `consumer-authority-v1-decision.md` defines the only enabled cooperative
  route. `workflow finish implement --assurance cooperative` is valid only in
  that same Finish invocation and is
  non-persistent: status, fetch, and later closure cannot reuse it, and the
  default/external boundaries remain blocked.
- `external-environment-verification.md` and
  `external-attested-finish-walkthrough.md` record scoped observer procedures,
  not a broad support or quality claim.

## Release And Package Records

The release row above leads to the compact operator entrypoint and durable
package chronology. The current source release input and the latest published
release record are intentionally separate: read the release operations table
and package index for recorded facts, then re-read live registry and protected
workflow state before a new release decision. Historical Consumer Authority
records live under `release/`; their past PASS, NO-GO, or staging result does
not provide current Finish authority, promotion, or channel permission.

## Deep Reference And History

- The canonical index names the small set of current decision inputs and routes
  every other record to history or inventory.
- The inventory classifies every retained file. It is a maintenance map, not a
  first-reading path.
- Repository-only archive, phase, and evidence-review records preserve prior
  work without competing with current operating guidance.

## Claim Boundary

Persona Harness is a gate-first workflow rail and completion-evidence harness.
It does not claim token saving, generated-app quality, product efficacy,
autonomous completion, deterministic role enforcement, or production-ready
delegation. Read the Measured Claims record above before turning an operational
record into a product claim.
