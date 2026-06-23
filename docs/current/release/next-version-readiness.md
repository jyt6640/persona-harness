# Next Version Readiness

## Candidate

```text
persona-harness@0.3.6-alpha.0
dist-tag: alpha
date: 2026-06-23
```

## Release Intent

This candidate adds a requirements drafting gate before implementation.

The desired split is:

- vague product idea -> draft requirements;
- user review -> approval;
- accepted requirements -> ticket split;
- first ticket -> implementation rail.

This keeps `TODO 웹 서비스 만들래` from turning into immediate implementation without a reviewable backlog.

## Included Changes

- `ph workflow draft --stdin` creates:
  - `.persona/workflow/requirements/backlog.md`
  - `.persona/workflow/requirements/questions.md`
  - `.persona/workflow/requirements/assumptions.md`
  - `.persona/workflow/requirements/latest.md`
- `ph workflow approve requirements` marks draft artifacts accepted.
- `requirement-drafting` intent routes vague product ideas to the draft workflow.
- `requirement-approval` routes approval phrases such as `진행하자` only when a draft backlog exists.
- README and workflow docs describe idea-first requirements drafting.

## Supported Surface

- Java/Spring backend MVP.
- Gradle-first backend workflow.
- Idea-first requirements drafting.
- File/prompt requirement source ticket splitting.
- Report-only workflow evidence gates.

## Not Supported

- Generated app product-quality certification.
- Rule compliance enforcement.
- AST/linter/build enforcement of rule compliance.
- Frontend/infra/desktop productization.
- Full TDD workflow.

## Verification Commands

| Command | Result |
| --- | --- |
| `npm test -- tests/persona-harness-workflow-ticket.test.ts tests/phase0-hooks.test.ts` | pass: 2 files, 35 tests |
| `npm run typecheck` | pass |
| `npm run build` | pass |
| `npm test` | pass: 37 files, 260 tests |
| `npm run report:rules` | pass: PersonaHarnessRule diagnostics PASS, 0 findings |
| `npm run check:scope:strict` | pass: MVP scope diagnostics PASS, 0 findings |
| `npm run check:injection-value` | pass: current window 3/3, expected decision `continue-java-mvp` |
| `npm pack --dry-run --json` | pass: `persona-harness-0.3.6-alpha.0.tgz`, 263 files, 269.9 kB package size, 1.1 MB unpacked size |
| dist CLI smoke | pass: `draft -> approve -> split -> next` |
| dist runtime transform smoke | pass: draft/approval routing |

## Smoke Expectations

Idea-first TUI:

```text
TODO 웹 서비스 만들래
```

Expected:

- AI runs or follows `npx ph workflow draft --stdin`.
- `.persona/workflow/requirements/backlog.md` is created.
- AI stops and asks the user to review.
- AI does not implement yet.

Approval:

```text
진행하자
```

Expected:

- AI runs or follows `npx ph workflow approve requirements`.
- AI runs or follows `npx ph workflow split .persona/workflow/requirements/backlog.md`.
- AI runs or follows `npx ph workflow next`.
- AI starts `npx ph workflow implement` for the first ticket only.

## Release Decision

Ready to publish under the `alpha` dist-tag after final git commit/push.

## Known Gaps

- OpenCode TUI external smoke still needs to confirm the full idea-first flow.
- Draft requirements are intentionally generic and require user review.
- Generated application quality remains a manual/external-test judgment.
