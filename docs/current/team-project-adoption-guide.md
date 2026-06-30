# Team Project Adoption Guide

This guide is for trying Persona Harness in a personal or team Java/Spring
backend repository.

Use the current candidate from the `next` channel:

```bash
npm install -D persona-harness@next
npx ph doctor
```

As of 2026-06-30, the observed registry channels are:

- `next=0.4.0-rc.2`
- `alpha=0.3.9-alpha.8`
- `latest=0.3.9-alpha.8`

Verify current channels before onboarding a team:

```bash
npm dist-tag ls persona-harness
npm view persona-harness@next version gitHead dist.shasum --json
```

## Positioning

Persona Harness is a local AI coding workflow harness. It gives the AI agent a
repeatable workflow rail, evidence trail, closure checks, and scoped convention
feedback for Java/Spring backend work.

It does not certify generated code quality. It does not replace tests, code
review, security review, or human judgment. `workflow finish` passing means the
workflow closure gate passed for the configured checks; it is not generated-app
quality certification.

Evidence is an audit log, not a quality score.

`bearshell` is bounded command execution and evidence capture. It is not a
sandbox. Commands still run on your machine with your project permissions.

Do not use `--dangerously-skip-permissions` in normal team repositories. Keep it
for clean temporary experiments where destructive access is acceptable.

## Basic Team Flow

Use the smallest team-facing flow first:

```bash
npx ph bootstrap backend
npx ph workflow implement
npx ph workflow check
npx ph workflow finish implement
```

Optional inspection commands:

```bash
npx ph evidence summary
npx ph review backend-shape
```

Advanced commands exist for diagnosis and release/eval work, but they should not
be the front door for team onboarding.

## GUARD Boundary

The current GUARD surface is a scoped opt-in enforcement candidate:

- Phase 0: opt-in `.persona/harness.jsonc`
  `enforce.executeVerification: true` runs direct verification for the
  supported Java/Spring/Gradle slice. PH-run `gradlew test` / JUnit evidence is
  authoritative under this opt-in path, and it may cost time/toolchain setup.
- Phase 1: convention levels are `report`, `warn`, and `block`.
  `controller.repository-dependency` can hard-block when clear typed
  Java/Spring service-layer evidence names the Controller, Repository, source
  file, and direct dependency.
- Phase 2: write guard is warning-only because the current hook result type
  does not support deny/rewrite. Do not treat it as hard enforcement.
- Phase 3: the convention registry centralizes convention ids, default levels,
  blocker ids, step ids, fix paths, block eligibility, and precision metadata.
  `controller.repository-dependency` is still the first/default block-capable
  convention. BYO `.persona/conventions/*.yml` ast-grep convention preview is
  implemented for simple YAML metadata; the default included ast-grep convention
  is `controller.persistence-import`, so the current registry has 2 conventions
  including 1 ast-grep convention. Unsafe or low-precision rules must not become
  hard blockers, and missing `sg`/`ast-grep` skips with a warning instead of
  faking a pass. Current-tarball smoke on `1c304e4` passed BYO observe, check,
  closure, continue, finish, and archive alignment, including `observe --json`
  ast-grep findings for `controller.persistence-import`; this is not registry
  `@next` evidence until those commits are published.

Valid claim: Persona Harness can provide scoped opt-in closure enforcement for
selected Java/Spring workflow checks.

Do not claim PH superiority, eval proof, generated app certification, broad
architecture correctness, general reliability, or a closure guarantee.
