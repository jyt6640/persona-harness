# PersonaHarnessRule Diagnostics-only Validation Result

## Goal

Implement minimal diagnostics-only schema validation for PersonaHarnessRule frontmatter.

## Result

Implemented.

The rule loader now records frontmatter diagnostics while preserving tolerant rule loading and selection behavior.

## Changed Behavior

- Valid current rule frontmatter records no diagnostics.
- Missing required metadata records diagnostics.
- Unsupported enum values record diagnostics.
- Malformed frontmatter records diagnostics and keeps the loader non-crashing.
- Catalog loading continues when a rule has diagnostics.
- Existing `selectedRules` path array and selected rule metadata evidence shape remain unchanged.

## Diagnostics-only Policy

Diagnostics are metadata/report findings only.

Invalid metadata does not block rule loading, rule catalog creation, rule selection, hook execution, build, typecheck, or test commands.

## Diagnostic Codes

- `missing_required_field`
- `invalid_enum_value`
- `malformed_frontmatter`

## MVP Validation Fields

Required fields:

- `id`
- `source`
- `domain`
- `topic`
- `globs`
- `severity`
- `enforcement`

Enum-like fields:

- `source`: `clean-code`, `backend-policy`
- `domain`: `common`, `backend`
- `scenario`: `step1`, `step2-3`, `all`
- `severity`: `must`, `should`, `prefer`
- `enforcement`: `inject_only`

## Tests Added

- valid canonical rule metadata has no diagnostics.
- missing `topic` and `globs` records diagnostics without stopping catalog loading.
- unsupported enum values record diagnostics without stopping catalog loading.
- malformed frontmatter records a diagnostic and preserves non-crash fallback behavior.
- existing #1/#2-3 rule selection tests continue to pass.

## Non-Goals

- selection-blocking validation.
- full schema engine.
- OMO rules-engine reuse.
- packaging/demo changes.
- observer expansion.
- build/test failure gate.
- product-quality guarantee.

## Verification

Passed in this loop:

- `npm test`: 13 files, 73 tests passed.
- `npm run typecheck`: passed.
- `npm run build`: passed.

## Next Loop

Decide the next productization path now that Phase 1.2 observation is closed and PersonaHarnessRule diagnostics-only validation is implemented.
