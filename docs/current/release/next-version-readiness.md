# Next Version Readiness

Status: historical v0.3.6-alpha.1 readiness snapshot. It is retained for
version-era context only and must not be selected as current release readiness,
publish authorization, or workflow lifecycle guidance. Use the current docs
pointer and
[`../workflow-closure-state-machine-design.md`](../workflow-closure-state-machine-design.md).

## Candidate

```text
persona-harness@0.3.6-alpha.1
dist-tag: alpha
date: 2026-06-23
```

## Release Intent

This candidate tightens the AI-facing intent routing story after the requirements drafting gate.

The desired split is still:

- vague product idea -> draft requirements;
- user review -> approval;
- accepted requirements -> ticket split;
- first ticket -> implementation rail.

This release also documents the next top-level intent router so Persona Harness can classify user language before defaulting to direct implementation.

## Included Changes

- PH-style intent preamble in requirements workflow guidance:
  - `의도 감지`;
  - `근거`;
  - `다음 행동`.
- `docs/current/top-level-intent-router-design.md` defines routing priorities for:
  - requirements;
  - debug;
  - review;
  - refactor;
  - git;
  - programming.
- Progress board and current docs index point to `v0.3.x` AI-facing workflow routing as the next active direction.

## Supported Surface

- Java/Spring backend MVP.
- Gradle-first backend workflow.
- Idea-first requirements drafting.
- File/prompt requirement source ticket splitting.
- AI-facing intent classification design.
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
| `npm test` | pass: 37 files, 261 tests |
| `npm run typecheck` | pass |
| `npm run build` | pass |
| `npm run check:docs` | pass |
| `npm run report:rules` | pass: PersonaHarnessRule diagnostics PASS, 0 findings |
| `npm run check:scope:strict` | pass: MVP scope diagnostics PASS, 0 findings |
| `npm run check:injection-value` | pass: current window 3/3, expected decision `continue-java-mvp` |
| `npm pack --dry-run --json` | pass: `persona-harness-0.3.6-alpha.1.tgz`, 264 files, 270.7 kB package size, 1.1 MB unpacked size |

## Smoke Expectations

Intent-preamble TUI:

```text
README 보고 구현해줘
```

Expected:

- AI sees the PH intent preamble in the workflow guidance.
- Primary routing remains requirements workflow, not direct programming.
- Implementation still starts through the workflow rail.

Top-level router design:

- `README 보고 구현해줘` -> requirements primary, programming secondary.
- `왜 테스트 실패해?` -> debug primary.
- `리뷰해줘` -> review primary.
- `리팩터링해줘` -> refactor primary.
- `커밋하고 푸쉬해` -> git primary.

## Historical Release Decision

At the time of this snapshot, the recorded decision was to publish under the
`alpha` dist-tag after a final git commit/push. It does not authorize any
current publication, tag, registry movement, or release action.

## Known Gaps

- `src/runtime/top-level-intent-router.ts` is not implemented yet.
- Debug/review/refactor/git rails remain inactive references.
- Generated application quality remains a manual/external-test judgment.
