# PersonaHarnessRule MVP Schema Validation Policy Decision

## Goal

Decide the MVP policy for PersonaHarnessRule schema validation before implementing validation behavior.

This loop does not implement schema validation, add observers, change rule selection, add packaging/demo work, or integrate OMO rules-engine.

## Current Behavior

Current frontmatter behavior is intentionally tolerant:

- parser reads `id`, `source`, `domain`, `topic`, `globs`, `scenario`, `severity`, `max_bullets`, and `enforcement`.
- `selectedRules` remains a rule path string array.
- `selectedRuleMetadata` records parsed metadata separately.
- malformed frontmatter does not crash the loader.
- malformed or incomplete rules can still fall back to path-based metadata and existing hardcoded selection order.

This behavior is covered by the existing malformed-frontmatter non-crash test.

## Validation Target

MVP validation should check the current `.persona/rules` contract:

- `source`: `clean-code` or `backend-policy`
- `domain`: `common` or `backend`
- `topic`: required non-empty string
- `globs`: required non-empty string array
- `severity`: `must`, `should`, or `prefer`
- `enforcement`: `inject_only`
- `id`: required non-empty string
- `scenario`: optional `step1`, `step2-3`, or `all`
- `max_bullets`: optional positive integer

Validation should report findings for missing required fields, unsupported enum values, malformed frontmatter, and invalid array/scalar shapes.

## Options

### A. Diagnostics-only

Behavior:

- invalid metadata produces validation findings.
- rule loading and selection remain non-crashing.
- existing fallback and compatibility behavior stay intact.
- findings can be included in metadata/evidence or exposed by a validation helper.

Advantages:

- preserves existing Phase 1.1 compatibility behavior.
- avoids breaking rule injection because one rule has imperfect metadata.
- makes validation visible without turning it into enforcement.
- fits the current MVP posture: report and observe before blocking.

Risks:

- invalid rules may still be selected.
- users may ignore validation findings.
- later packaging must decide how loudly to surface diagnostics.

### B. Selection-blocking

Behavior:

- invalid rules are not selected.
- missing required metadata can remove a rule from injection.

Advantages:

- stricter contract.
- prevents invalid rules from silently influencing injection.

Risks:

- can break existing fallback behavior.
- can remove base rules unexpectedly.
- raises the cost of typo/migration mistakes.
- conflicts with current malformed-frontmatter non-crash semantics.

### C. Hybrid

Behavior:

- missing required fields block selection.
- enum mismatches and optional field issues are diagnostics-only.

Advantages:

- stricter than diagnostics-only without blocking every invalidity.

Risks:

- more complex policy surface.
- requires careful per-field classification.
- easy to overfit before packaging/demo usage proves what should block.

## Decision

Choose A: diagnostics-only.

## Why

MVP validation should make rule metadata problems visible without changing selection behavior yet.

The current system is still an injection-path MVP, not a full rule engine. Blocking selection at this point would conflate validation with enforcement and could make a single metadata issue remove important base rules. Diagnostics-only keeps compatibility stable while giving the next loop a concrete validation artifact to test.

## Implementation Criteria For Next Loop

The next implementation loop should add tests first.

Required tests:

- valid current `.persona/rules` metadata returns no validation findings.
- missing `topic` returns a finding but the rule can still be loaded.
- missing or empty `globs` returns a finding but the rule can still be loaded.
- unsupported `source`, `domain`, `severity`, or `enforcement` returns findings.
- malformed frontmatter returns a validation finding and preserves non-crash fallback behavior.
- `selectedRules` path string array shape remains unchanged.
- validation findings are not build/test failure gates.

Implementation boundaries:

- no new dependency.
- no selection-blocking.
- no rule/prompt reinforcement.
- no observer expansion.
- no OMO rules-engine integration.
- no packaging/demo work.

## Open Questions

- Where should validation findings be surfaced first: catalog entry metadata, a separate validation helper, or evidence payload?
- Should every selected rule include validation findings in `selectedRuleMetadata`, or should findings be recorded separately to avoid changing evidence shape too much?

## Next Loop

Implement diagnostics-only PersonaHarnessRule MVP schema validation with tests first.
