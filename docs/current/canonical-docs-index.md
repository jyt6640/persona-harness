# Canonical Docs Index

This is the deep-reference map for active Persona Harness records. It is not a
release ledger and it does not turn a retained file into a current claim.
Start with [Current Docs](README.md) unless you need a specific decision.

## Canonical Current Records

| Topic | Canonical file | Use it for |
| --- | --- | --- |
| Current documentation entrypoint | `docs/current/README.md` | Audience-based navigation and current operating inputs. |
| Workflow lifecycle projection | `docs/current/workflow-closure-state-machine-design.md` | The current fail-closed `workflow-lifecycle.1` state model. |
| Workflow state concurrency | `docs/current/workflow-state-concurrency.md` | Writer ownership and safe state handling. |
| Public product boundary | `docs/MEASURED-CLAIMS.md` | What Persona Harness may and may not claim. |
| Install and usage | `docs/current/persona-harness-detailed-usage.md` | Detailed local install and maintenance-oriented usage. |
| Portable shared-skill and product-discovery contract | `docs/current/persona-shared-skills-core.md` | Catalog ownership, interview approval, explicit handoffs, host boundary, and packaged surface. |
| Personalization profile store | `docs/current/personalization-profile-v1.md` | Versioned local profile records, append-only lifecycle, privacy, and fail-closed storage. |
| Context Personalization program | `docs/current/context-program-status.md` | Canonical P0 audit, isolated OpenCode delivery boundary, separation invariants, and claim status. |
| Context contributor map | `docs/current/context-contributor-map.json` | Machine-checked current source ownership, credential-free local checks, and boundaries that stay separate from Context work. |
| Context external-validation protocol | `docs/current/context-external-validation.md` | Strict preregistration and finite result-status contract; default state is no observations and `INCONCLUSIVE`. |
| Team Profile V2 boundary | `docs/current/context-team-profile-v2.md` | Read-only project-shareable v2 Team Profile schema, v1 separation, shared-text safety, and pure resolver bridge. |
| External environment procedure | `docs/current/external-environment-verification.md` | A bounded packaged-install check on a separate machine. |
| External-attested Finish walkthrough | `docs/current/external-attested-finish-walkthrough.md` | Source-checkout-only enrolled/fetch/Finish/replay procedure and its limits. |
| Consumer Authority V1 decision | `docs/current/consumer-authority-v1-decision.md` | The explicit cooperative assurance boundary. |
| Release operations | `docs/current/release/README.md` | Current release checklist, runbooks, tag policy, and the separation of source inputs from recorded published state. |
| Version/package chronology | `docs/releases/package-index.md` | Durable version history and release-note links. |
| Advanced repository surfaces | `docs/current/advanced-surface-index.md` | Source-checkout-only dormant, preview, and repository work. |
| Full retained-file catalog | `docs/current/docs-inventory.md` | Exhaustive classification when the map above is insufficient. |

### Cooperative Finish Boundary

The only enabled cooperative route is `workflow finish implement --assurance cooperative`.
It is valid in the same Finish invocation after fixed local verification and is
non-persistent: status/fetch/later closure cannot
reuse it. Default/external boundaries remain blocked. This is a narrow
same-invocation result, not a receipt, registry fact, or durable finish
authority.

## Release And Historical Records

- [Release operations history](release/history.md) retains historic release
  readiness decisions, Consumer Authority beta records, and the full release
  note index. Historical PASS or NO-GO evidence is not current authority.
- [Consumer Authority Beta lifecycle](release/consumer-authority-beta.md)
  defines the tag-bound staging and current-artifact boundary. Its versioned
  acceptance JSON files are retained machine-readable records, not a license to
  promote a channel or consume Finish authority.
- [Versioned release docs](../releases/README.md) hold durable capsules. Use
  them instead of old files under `current/` when the question is about a
  published version.
- Source-checkout archive, phase, and evidence-review records keep historical
  work discoverable without competing with current instructions.

## Generated And Maintenance Records

`docs/current/docs-inventory.md` is the inventory for every retained
documentation file. `npm run check:docs` checks the root taxonomy and the
current lifecycle selection; it does not certify that historical content is a
live release state. Keep package-visible current documents linked from an
entrypoint and preserve historical records by a summary or pointer before any
move.

## Boundaries

This index is navigation only. It does not add release evidence, approve a
tag, move a registry channel, certify generated application quality, or claim
token saving, product efficacy, autonomous completion, deterministic role
enforcement, or production-ready delegation.
