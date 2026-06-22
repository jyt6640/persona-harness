# Next Version Readiness

## Verification Commands

| Command | Result |
| --- | --- |
| `git status --short` | pass before context-noise changes; working tree now contains this loop's code/doc updates |
| `git branch --show-current` | pass: `main` |
| `npm test` | pass: scope check PASS, docs taxonomy PASS, 32 test files passed, 190 tests passed |
| `npm run typecheck` | pass |
| `npm run build` | pass |
| `npm run report:rules` | pass: PersonaHarnessRule diagnostics PASS, 0 findings |
| `npm run check:scope` | pass: MVP scope diagnostics PASS, 0 findings, report-only |
| `npm run check:injection-value` | pass: injection value diagnostics PASS, current window 3/3, expected decision `continue-java-mvp` |
| `npm pack --dry-run --json` | pass: `persona-harness-0.3.0-alpha.3.tgz`, 191 files, 198.2 kB package size, 735.1 kB unpacked size |
| `npm publish --dry-run --tag alpha` | pass: dry-run only for `persona-harness@0.3.0-alpha.3` |
| `npm publish --tag alpha` | pass: `persona-harness@0.3.0-alpha.3` published |
| `npm view persona-harness dist-tags --json` | partial: `alpha` points to `0.3.0-alpha.3`; `latest` still points to `0.3.0-alpha.2` until OTP-protected dist-tag sync |

## Productization Review Decision

Source:

- `~/Desktop/blackbear-persona-harness-test/productization-review/final-productization-verdict.md`
- `~/Desktop/blackbear-persona-harness-test/productization-review/01-ab-result-digest.md`
- `~/Desktop/blackbear-persona-harness-test/productization-review/02-java-mvp-readiness.md`
- `~/Desktop/blackbear-persona-harness-test/productization-review/04-release-risk-review.md`
- `~/Desktop/blackbear-persona-harness-test/productization-review/05-next-work-priority.md`

Decision:

```text
freeze-expansion-and-simplify
```

The original A/B evidence for `01-book-loans` was mixed:

- Persona Harness ON completed 4/5 runs and timed out once.
- Persona Harness OFF completed 5/5 runs.
- ON successful runs had better domain repository port placement.
- ON successful runs used application command/result DTO boundaries.
- OFF was more reliable as a generated runnable output baseline.

After context-noise reduction, `01-book-loans/A-persona-on/run-05` was rerun with the local package:

- `ph init` now writes project `.gitignore` entries for `node_modules/`, `.opencode/node_modules/`, `.persona/rules/`, `.persona/evidence/`, `.gradle/`, and `build/`.
- Persona Harness ON run-05 completed without timeout: OpenCode exit 0 in 270013 ms.
- Persona Harness ON run-05 produced Java/Spring code, generated 113 evidence files, and final `gradle test` passed.
- The paired Persona OFF run-05 also passed and completed faster: OpenCode exit 0 in 50085 ms.
- The generated ON code still did not match the target package-flow shape closely enough for the analyzer to treat run-05 as ON-positive.
- The analyzer now distinguishes this as `buildable-package-flow-mismatch`, not a generated-project failure.

## Demo Packaging Decision

proceed-to-demo-packaging

## Evidence

- Repository verification commands are green.
- Rule diagnostics are green.
- Scope diagnostics are green.
- Injection value status remains `continue-java-mvp`.
- The previous external productization review did not permit packaging because the 5-run ON/OFF result remained mixed.
- The rerun reduces the timeout blocker, and analyzer reason codes now separate generated-project failure from buildable-but-wrong-shape output.
- The generated code-shape blocker has fresh positive evidence after package-flow guidance:
  - fresh Persona ON run: `/Users/yongtae/Desktop/blackbear-persona-harness-test/fresh-runs/01-book-loans/A-persona-on/bootjar-guidance-20260622-005742`;
  - generated code used `presentation/application/domain/infrastructure`;
  - domain repository ports stayed in `domain`; in-memory implementations stayed in `infrastructure`;
  - application services did not directly own storage state or ID sequence;
  - `gradle build` passed with `:bootJar UP-TO-DATE`, not `:bootJar SKIPPED`;
  - `gradle bootRun` plus HTTP happy/failure smoke passed independently.

## Risks

- OpenCode/model runtime can still be slower during Persona ON generation.
- ON setup and evidence files can add context noise for the model, though the default `.gitignore` now hides the largest generated paths from normal project context.
- Productization claims could overstate architectural guidance as quality enforcement.
- One requirement domain is not enough to prove release/demo reliability.

## Decision Update

After the fresh package-flow/bootJar ON run, next-version demo packaging can proceed to final package verification.

`persona-harness@0.3.0-alpha.3` is published on the `alpha` dist-tag. The remaining release-close steps are OTP-protected `latest` dist-tag sync, GitHub tag/release creation, and external install smoke after both dist-tags point at the same alpha.
