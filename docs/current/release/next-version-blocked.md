# Next Version Packaging Blocked

## Decision

`freeze-expansion-and-simplify`

Packaging is blocked for the next version candidate.

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

That removes the immediate timeout-only blocker, but packaging is still blocked because the generated ON run-05 package-flow shape did not match the current Java backend MVP target closely enough. This is useful evidence that Persona Harness can shape backend code, but it is not stable enough to package as a confident demo/release candidate.

The analyzer now records this failure mode as `buildable-package-flow-mismatch`, which separates it from `no-generated-java-project` or `generated-gradle-test-fail`.

## Required Next Work

1. Keep Persona ON context-noise guards in `ph init` and plan prompts.
2. Keep separating timeout reliability from generated code-shape quality in the review.
3. Re-run a narrow package-flow effectiveness check after the guidance change.
4. Reconsider packaging only if ON completes reliably and still preserves the repository/domain and command/result boundary advantages.

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
