# PH-Core And Adapter Boundary Design

Status: Item 25 design only. This page defines ownership and dependency
direction; it does not move code, create a new API or schema, add a package,
change defaults, or implement an adapter.

**Source snapshot:** `16c741026c3b0c6abc6e3022c976c4f6909e9a2d`
(`docs: record quick demo gate flow acceptance`). All source references below
are snapshots at that commit.

## Decision

Persona Harness is organized conceptually into three boundaries:

1. **PH-core** owns deterministic workflow and closure authority.
2. **Language packs** own stack-specific material supplied to that authority.
3. **Adapters** translate a CI, host, or manual methodology context to existing
   PH entry and result surfaces; they do not become gate authority.

The priority for adapter work is **CI, then host, then methodology**. This
orders future investment and containment only. It does not override PH-core:
the existing PH CLI exit code and plaintext finish result remain authoritative.

## Ownership

| Boundary | Conceptual inputs | Conceptual outputs | Owns | Does not own |
| --- | --- | --- | --- | --- |
| PH-core | Prepared profile state, workflow/ticket state, evidence and verification observations, and selected language-pack declarations | Deterministic closure state, gate/finish result, ticket-state transitions or refusals, and host-neutral command results | Closure/gate state, ticket/workflow-state contracts, evidence authority boundaries, profile-derived verification orchestration, and host-neutral entry/finish semantics | Stack-specific conventions, host policy, methodology progress claims, or auto-completion |
| Language pack | Stack profile/catalog choices and language-specific source/fixture material | Stack-specific profile guidance, conventions, fixtures, delivery references, and precision/observation evidence supplied to PH-core | The meaning and scope of a supported stack's material | PH finish authority, generic workflow state, or a host adapter |
| Adapter | Invocation context and PH-core results | Context-appropriate invocation, discovery, artifact retention, or manual guidance | Translation only | Gate truth, workflow/ticket mutation authority outside PH-core, or completion claims |

The dependency direction is:

```text
language pack declarations -> PH-core <- CI adapter
                                  ^        host adapter
                                  ^        methodology driver
```

Adapters may call public PH entry and diagnostic surfaces. They may not
reinterpret a successful methodology step, host event, or CI wrapper action as
a passed PH finish result.

## PH-Core Boundary

PH-core owns these stable responsibilities:

- **Closure and gate state:** it reads workflow status and verification, derives
  blockers in deterministic order, and derives `passed` or `blocked` from that
  state.
- **Ticket and workflow-state contracts:** it owns the backlog/task-card
  structures, current/history locations, state-conflict handling, and archive
  refusal when non-ticket closure blockers remain.
- **Evidence authority:** it distinguishes direct PH verification from
  agent-authored report text and local execution observations. A claim in a
  report is not independently sufficient when the authority boundary requires
  fresh PH verification.
- **Profile-derived verification orchestration:** it reads the ready project
  profile and selects the current supported verification path; it does not let
  a language pack or adapter substitute arbitrary command text as gate truth.
- **Host-neutral entry and finish:** public CLI dispatch, `ph go`, plaintext
  `workflow finish implement`, and the closure JSON companion remain PH-core
  behavior regardless of which adapter initiated them.

`workflow closure next --json` remains a diagnostic companion. It does not
replace the plaintext finish authority or create a `finish --json` contract.

## Language-Pack Boundary

A language pack owns stack-specific inputs to PH-core:

- profile/catalog material that identifies the selected stack;
- conventions and their documented precision/scope;
- fixtures and observation evidence that establish the pack's current claims;
- delivery references used for role/stage-scoped guidance.

The current first pack is Java/Spring. Its current material includes the backend
project profile, `.persona/conventions` declarations, Java reference material,
and scoped rule delivery. Item 21 remains deliberately narrow: I-08
`java.raw-type`, I-09 `java.optional-get`, and I-12 `java.mutable-static` are
high-precision `warn` conventions with `blockAllowed=false`. They are not full
Iron List enforcement and do not establish a general language-pack promotion
rule.

Future language packs require separately accepted profile/catalog, fixture,
precision, delivery, and release decisions. This design does not implement a
second language pack.

## Adapter Boundary And Priority

### CI Adapter

CI is the first adapter priority and an agent-independent driver: it can drive
the existing PH CLI without trusting an agent to interpret the ledger. It
records artifacts and propagates the PH exit code; it is not the authority
itself.

The current CI recipe uses plaintext `ph workflow finish implement` and
`ph workflow closure next --json` as a retained diagnostic artifact. Future
Item 19 implementation is the proposed CI re-verification surface. Until that
work is accepted, agent-authored ledger content is not independently trusted
CI proof.

### Host Adapter

Host adapters are second priority. They translate host invocation and discovery
into public PH commands and may render PH results in the host surface. They do
not own workflow state or decide that a gate passed.

The existing runtime-hook implementation is evidence of a host-specific
translation point, not a required architectural dependency. `runtimeInjection`
remains false by default. No hook requirement, plugin guarantee, or host
runtime surface is introduced by this design.

### Methodology Driver

Methodology drivers are third priority. A driver such as Superpowers is a
manual, source-only guide that directs a compatible agent to existing `ph go`,
plaintext finish, and closure-next surfaces. It is never PH authority and
cannot auto-finish work, verify reports, alter gates, or create a host default.

## Current Mapping Snapshot

| Proposed boundary | Current snapshot reference | Current role in the proposed boundary |
| --- | --- | --- |
| PH-core entry | `src/cli/index.ts:runPersonaCli @ 16c741026c3b0c6abc6e3022c976c4f6909e9a2d` | Dispatches host-neutral public CLI commands to their existing implementations. |
| PH-core goal entry | `src/cli/go-command.ts:runGoCommand @ 16c741026c3b0c6abc6e3022c976c4f6909e9a2d` | Executes capture, split, next, and implementation-rail preparation through the existing transaction/lock path. |
| PH-core ticket contract | `src/cli/workflow-ticket-model.ts:BacklogTicket, formatTaskCard, parseBacklog @ 16c741026c3b0c6abc6e3022c976c4f6909e9a2d` | Defines current backlog/task-card state material and schema-versioned text contracts. |
| PH-core workflow mutation | `src/cli/workflow-tickets.ts:writeWorkflowStateSnapshot, archiveBlockingBlockers @ 16c741026c3b0c6abc6e3022c976c4f6909e9a2d` | Applies conflict-aware state writes and consults closure before archive. |
| PH-core closure state | `src/cli/workflow-closure.ts:readWorkflowClosurePayload, closureBlockers @ 16c741026c3b0c6abc6e3022c976c4f6909e9a2d` | Derives the structured closure state and deterministic blockers. |
| PH-core finish | `src/cli/workflow-finish-runner.ts:runWorkflowFinishResult @ 16c741026c3b0c6abc6e3022c976c4f6909e9a2d` | Uses closure reasons to render the existing plaintext pass/block result. |
| PH-core verification authority | `src/cli/workflow-closure-verification.ts:readClosureVerification @ 16c741026c3b0c6abc6e3022c976c4f6909e9a2d`; `src/cli/closure-verification-runner.ts:runDirectClosureVerification @ 16c741026c3b0c6abc6e3022c976c4f6909e9a2d` | Selects direct PH verification when configured and otherwise classifies report/execution evidence without silently treating prose as proof. |
| Language-pack profile | `src/config/project-profile.ts:readBackendProjectProfileState @ 16c741026c3b0c6abc6e3022c976c4f6909e9a2d` | Reads the current supported Java/Spring backend profile state. |
| Language-pack conventions | `src/cli/convention-pack.ts:collectConventionFiles @ 16c741026c3b0c6abc6e3022c976c4f6909e9a2d`; `src/cli/ast-grep-convention-runner.ts:loadAstGrepConventionDefinitions @ 16c741026c3b0c6abc6e3022c976c4f6909e9a2d` | Loads convention declarations and maps their pack metadata into current convention definitions. |
| Language-pack delivery | `src/rules/rule-catalog.ts:loadRuleCatalog @ 16c741026c3b0c6abc6e3022c976c4f6909e9a2d`; `src/rules/rule-delivery.ts:selectRulesForDelivery @ 16c741026c3b0c6abc6e3022c976c4f6909e9a2d` | Loads stack guidance and delivers it narrowly by role/stage while closure/check/finish stay broad. |
| Java/Spring evidence limit | `docs/current/java-precision-warnings-acceptance-record.md:Accepted Contract @ 16c741026c3b0c6abc6e3022c976c4f6909e9a2d` | Records the three current warn-only Java precision rules and their non-promotion boundary. |
| CI adapter | `docs/current/ci-finish-contract.md:GitHub Actions Recipe @ 16c741026c3b0c6abc6e3022c976c4f6909e9a2d`; `docs/current/ci-evidence-reverification-design.md:Decision @ 16c741026c3b0c6abc6e3022c976c4f6909e9a2d` | Documents the existing CLI-driving recipe and the separate future independent-reverification design. |
| Host adapter | `src/runtime/hooks.ts:createPhase0Hooks @ 16c741026c3b0c6abc6e3022c976c4f6909e9a2d` | Current host hook/injection translation point, guarded by the existing runtime-injection configuration. |
| Methodology driver | `packages/shared-skills/skills/advanced/superpowers-driver/SKILL.md:Superpowers Driver @ 16c741026c3b0c6abc6e3022c976c4f6909e9a2d` | Manual source-only driver that explicitly defers authority to PH CLI exit and closure/finish surfaces. |

These references describe current placement only. They are not a mandate to
rename, extract, or relocate any listed file in this design tranche.

## Future Implementation Tickets

1. **I25-1 Core-contract extraction assessment:** identify which current
   closure, ticket, evidence, and profile-verification operations can share an
   internal boundary without changing existing CLI, workflow, or evidence
   schemas.
2. **I25-2 Java/Spring pack inventory:** define the accepted Java/Spring
   profile/catalog, convention, fixture, delivery-reference, and precision
   inventory before any new language-pack mechanism or enforcement promotion.
3. **I25-3 CI adapter implementation:** implement the separately accepted Item
   19 re-verification design as a CI driver while retaining PH exit authority
   and the plaintext finish/closure companion distinction.
4. **I25-4 Host adapter inventory:** define supported invocation/discovery
   translations and their test matrix without making runtime injection or a
   hook a default or a requirement.
5. **I25-5 Methodology-driver policy:** specify how source-only manual drivers
   may reference public PH commands without becoming installed authority,
   automatic orchestration, or completion evidence.
6. **I25-6 Additional language-pack decision:** choose a second language only
   after its stack scope, fixtures, precision evidence, distribution, and
   release/default decisions are separately accepted.

## Deferred Decisions

- Whether future internal extraction uses a library boundary, a process
  boundary, or remains internal is unresolved.
- The installation/distribution shape for a future language pack is unresolved.
- The supported host list and any host-specific artifact format are unresolved.
- Item 19's proposed fresh CI verification artifact remains its own design and
  implementation decision.

None of these forks permits a current module move, a new public API, a schema
change, a default change, or a runtime hook.

## Non-Goals And Preserved State

This design does not implement generic methodology, TDD, or orchestration. It
does not auto-finish, certify a generated application, claim token savings,
quality, efficacy, or broad reliability, provide a hostile-workspace security
guarantee, or implement multiple languages.

`runtimeInjection=false`, existing commands and public help, workflow/evidence
schemas, package version, release state, and current package contents remain
unchanged except for packaging this current design record under the established
docs policy.
