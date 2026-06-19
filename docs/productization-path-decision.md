# Productization Path Decision

## Goal

Close the next MVP productization step by combining three previously separate concerns:

- diagnostics surface
- packaging/demo readiness
- productization path decision

## Decision

Choose a diagnostics-first productization path.

The next user-visible MVP surface is a rule diagnostics report command that writes ignored metadata-only output. Packaging/demo readiness should document that command as part of the reproducible MVP path.

## Why

Rule frontmatter validation is already implemented internally, but diagnostics are only visible to code that reads catalog metadata. That is not enough for a usable MVP.

A small report surface gives users a concrete way to see invalid or malformed rule metadata without turning validation into enforcement. It also creates a stable step for packaging/demo instructions:

1. install dependencies
2. build
3. run tests/typecheck/build
4. run rule diagnostics report
5. connect the built OpenCode plugin to a Java/Spring project

## Productization Scope

This loop should add:

- `npm run report:rules`
- an ignored markdown report under `.persona/evidence/phase-next/`
- tests for valid and invalid diagnostics report output
- README instructions for the MVP verification and OpenCode demo path

## Non-Goals

- full CLI framework
- selection-blocking validation
- build/test failure gate
- product-quality certification
- OpenCode marketplace packaging
- desktop app work
- OMO rules-engine reuse
- new report-only observer

## Expected Behavior

The report should:

- show `PASS` when no rule diagnostics exist
- show `WARN` when rule diagnostics exist
- list rule path, diagnostic code, field, and message
- keep rule loading non-blocking
- write only ignored output by default

## Implemented Surface

- `npm run report:rules`
- `.persona/evidence/phase-next/rule-diagnostics-report.md`
- `docs/productization-path-decision.md`
- README MVP reproduction path

The package file list includes `scripts/report-rule-diagnostics.mjs` so the report command is not omitted from a packaged artifact.

## Next Loop

After the diagnostics report surface lands, the next decision is no longer release/demo first.

The current direction is to clarify backend product-code uniformity before packaging:

- Gradle is the canonical Java/Spring build tool.
- Maven evidence is discarded for future primary decisions.
- `example/src` is a style reference answer, not a universal roomescape/step fixture template.
- The default target is Clean Code based backend product code flow.
- Personal/team/project philosophy is optional and belongs to a later philosophy/intake harness.
- Test style remains a later dedicated policy track.

Next loop candidate:

```text
Run a Gradle canonical generated-run validation with the reinforced baseline:
Gradle fixed plus Service storage ownership prohibition.
```
