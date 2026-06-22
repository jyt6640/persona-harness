# Next Version Packaging Blocked

## Decision

`freeze-expansion-and-simplify` was the previous productization review decision.

Packaging is not automatically unblocked by this document. However, the narrow follow-up requested by this blocker now has fresh positive ON evidence.

## Reason

The latest external productization review does not satisfy the allowed packaging decisions:

- allowed: `proceed-to-demo-packaging`
- allowed: `proceed-after-doc-cleanup`
- current: `freeze-expansion-and-simplify`

The observed `01-book-loans` A/B result remains mixed:

- Persona Harness ON passed `gradle test` in 4/5 runs.
- Persona Harness OFF passed `gradle test` in 5/5 runs.
- ON successful runs produced stronger Java/Spring backend architecture shape for domain repository ports and command/result DTOs.
- ON run-05 timed out and produced no usable generated project.

After the context-noise reduction loop, ON run-05 no longer timed out:

- OpenCode exit 0 in 270013 ms.
- final `gradle test` passed.
- `.persona/evidence/phase0` contained 113 evidence files.
- paired OFF run-05 also passed and completed faster in 50085 ms.

That removed the immediate timeout-only blocker, but packaging stayed blocked because the generated ON run-05 package-flow shape did not match the current Java backend MVP target closely enough.

The analyzer now records this failure mode as `buildable-package-flow-mismatch`, which separates it from `no-generated-java-project` or `generated-gradle-test-fail`.

After package-flow and bootJar guidance tightening, a fresh ON run changed the current evidence:

- Run: `/Users/yongtae/Desktop/blackbear-persona-harness-test/fresh-runs/01-book-loans/A-persona-on/bootjar-guidance-20260622-005742`.
- Package flow: `presentation/application/domain/infrastructure`.
- Repository boundary: domain ports plus infrastructure implementations.
- Service storage/id sequence: not owned by application services.
- Build-line behavior: `gradle build` passed with `:bootJar UP-TO-DATE`; no `bootJar.enabled=false` workaround.
- Runtime smoke: `gradle bootRun` plus HTTP happy/failure smoke passed.

## Required Next Work

1. Keep Persona ON context-noise guards in `ph init` and plan prompts.
2. Keep separating timeout reliability from generated code-shape quality in the review.
3. Treat the narrow package-flow/bootJar follow-up as positive for this fixture.
4. Reconsider packaging through an explicit release/demo decision loop. If one more confidence point is required, use a new small backend domain fresh ON smoke rather than reopening broad A/B.

## Do Not Do

- Do not publish to npm.
- Do not create a release tag.
- Do not push release packaging changes.
- Do not expand to frontend or infra productization.
- Do not start desktop app work.
- Do not add AST/linter/Guard enforcement.
- Do not add new observers.
- Do not claim generated application product quality.
- Do not call the current A/B result ON-positive.
