# Phase 1.1 Frontmatter Worktree Settlement

## Goal

Review the Phase 1.1/frontmatter/config dirty worktree, classify what can be committed, what should stay deferred, what should not be reverted, and choose one next implementation candidate.

This loop does not add a new feature, observer, schema validation implementation, packaging/demo implementation, or OMO rules-engine integration.

## Dirty Worktree Reviewed

Reviewed dirty scope:

- `.persona/harness.jsonc`
- `README.md`
- `docs/phase1-rule-loader-design.md`
- `src/phase0/evidence.ts`
- `src/phase0/hooks.ts`
- `src/phase0/injection.ts`
- `src/phase0/rule-catalog.ts`
- `src/phase0/rule-frontmatter.ts`
- `src/phase0/rule-loader.ts`
- `src/phase0/types.ts`
- `src/phase0/harness-config.ts`
- `tests/helpers/rule-fixtures.ts`
- `tests/phase0-harness-config.test.ts`
- `tests/phase0-rule-frontmatter.test.ts`

These changes are one coherent Phase 1.1 settlement group:

- config keys in `.persona/harness.jsonc` are read at runtime.
- rule metadata parsing matches the current `.persona/rules` frontmatter shape.
- `selectedRules` remains a path string array.
- `selectedRuleMetadata` records path/id/source/domain/topic/severity separately.
- `applies_to` and `priority` are removed from the runtime metadata model because current rules do not use them.
- malformed frontmatter still uses the non-crash fallback behavior.

## Commit-Ready Changes

Commit-ready:

- `harness-config.ts` minimal config reader:
  - `enabled`
  - `rulesDir`
  - `evidenceDir`
  - `maxRulesPerInjection`
  - `evidenceMode`
  - `enabledDomains`
  - `scenario`
- runtime wiring:
  - hooks skip injection when disabled or backend is not enabled.
  - rule catalog and fallback loader use configured `rulesDir`.
  - evidence writer uses configured `evidenceDir`.
  - injection uses configured `maxRulesPerInjection`.
- frontmatter alignment:
  - parse `id`, `source`, `domain`, `topic`, `globs`, `scenario`, `severity`, `max_bullets`, `enforcement`.
  - keep `source/domain/topic/severity` as evidence metadata, not selection priority.
  - remove unused `description`, `applies_to`, and `priority` from the Phase 1.1 runtime model.
- tests:
  - harness config tests for `rulesDir`, `maxRulesPerInjection`, disabled harness, and enabled domains.
  - canonical metadata parsing test.
  - selected rule metadata evidence test.
- docs:
  - README and Phase 1 rule-loader design now match the actual runtime behavior.

## Deferred Changes

Deferred:

- PersonaHarnessRule MVP schema validation.
- OMO rules-engine reuse path.
- packaging/demo work.
- product-quality validation.
- Guard/AST/linter.
- frontend/infra/profile-aware expansion.

## Do Not Revert

Do not revert the commit-ready Phase 1.1 settlement group.

Reasons:

- Reverting config wiring would make `.persona/harness.jsonc` keys appear documented but unused again.
- Reverting frontmatter alignment would reintroduce the old mismatch between current `.persona/rules` metadata and parser-supported fields.
- Reverting selected metadata evidence would weaken the Phase 1.1 claim that metadata is observed without changing `selectedRules` path shape.
- Reverting README/design updates would make docs less accurate than runtime.

## Needs Separate Loop

Separate loops:

- Schema validation:
  - define validation findings for malformed or invalid rule metadata.
  - decide whether invalid metadata blocks selection, falls back, or emits diagnostics only.
- OMO rules-engine reuse:
  - decide whether to keep the local minimal glob layer or replace/reuse an external rules-engine path.
- Packaging/demo:
  - decide install/run/demo path after core state is clean.

## Decision

Choose A: commit the current dirty Phase 1.1/frontmatter/config changes after verification.

## Why

The dirty worktree matches the already documented Phase 1.1 closure claim better than `HEAD` did. It is tested, scoped to rule-loader/frontmatter/config settlement, and does not implement schema validation, new observers, packaging/demo, or OMO rules-engine reuse.

Choosing B now would layer schema validation on top of an unsettled core state. Choosing C now would move to demo/package work while config/frontmatter runtime behavior is still uncommitted.

## Verification

Verification passed before commit:

- `npm test`
- `npm run typecheck`
- `npm run build`

## Next Candidate

Choose B next: PersonaHarnessRule MVP schema validation.

Reason:

- after this settlement, core Phase 1.1/frontmatter/config behavior is clean enough to define validation behavior explicitly.
- schema validation is still a known MVP gap.
- packaging/demo should wait until the rule metadata contract is not ambiguous.
