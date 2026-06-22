# Next Version Readiness

## Candidate

```text
persona-harness@0.3.2-alpha.1
dist-tag: alpha
date: 2026-06-22
```

## Release Intent

This candidate is a hotfix for `0.3.2-alpha.0`. It keeps the single implementation rail and fixes README read coverage parsing after fresh install smoke showed that `## README ranges read` heading-style reports were not accepted.

## Included Changes

- `ph workflow implement` single AI-facing implementation rail.
- README chunk-read instructions using `ph bearshell` and 220-line ranges.
- README read coverage diagnostics in `ph workflow check`.
- `ph workflow finish implement` failure when `README.md` exists but `README ranges read` is empty.
- README range coverage recognition for heading-style implementation reports.
- Injection, prompt, next/resume, root README, and Korean README guidance updated to prefer `npx ph workflow implement`.
- Direct `.persona/rules` read remains a non-blocking note; raw final verification remains blocking.

## Verification Commands

| Command | Result |
| --- | --- |
| `npm test` | pass: 36 test files, 224 tests |
| `npm run typecheck` | pass |
| `npm run build` | pass |
| `npm run report:rules` | pass: PersonaHarnessRule diagnostics PASS, 0 findings |
| `npm run check:scope:strict` | pass: MVP scope diagnostics PASS, 0 findings, STRICT mode |
| `npm run check:injection-value` | pass: current window 3/3, expected decision `continue-java-mvp` |
| `npm test -- tests/persona-harness-workflow-check.test.ts` | pass: 20 tests, includes heading-style README range coverage regression |
| `npm pack --dry-run` | pass after sequential build: `persona-harness-0.3.2-alpha.1.tgz`, 221 files, 226.5 kB package size, 868.4 kB unpacked size |
| `npm publish --dry-run --tag alpha` | pass: dry-run only for `persona-harness@0.3.2-alpha.1` |

## Manual CLI Smoke

Expected release-loop smoke:

```bash
tmp_project=$(mktemp -d)
cd "$tmp_project"
npm init -y
npm install -D persona-harness@alpha
npx ph init
npx ph plan
npx ph plan --accept
npx ph workflow implement
```

Expected:

- `ph workflow implement` prints README chunk-read commands.
- `ph workflow finish implement` fails when README ranges are empty.
- `ph workflow finish implement` passes after `README ranges read` is recorded and normal workflow evidence exists.

## Supported Surface

- Java/Spring backend MVP.
- Gradle-first backend workflow.
- AI-facing workflow discipline for OpenCode/Codex-style TUI use.
- Report-only diagnostics and workflow evidence gates.

## Not Supported

- Generated app product-quality certification.
- AST/linter/build enforcement of rule compliance.
- Frontend/infra/desktop productization.
- Full TDD workflow.
- `ph bearshell` sandboxing.

## Pre-Publish Release Decision

`persona-harness@0.3.2-alpha.1` is published.

Post-publish smoke installed `persona-harness@alpha` in `/tmp/persona-v032-alpha1-smoke-xaV5nw` and confirmed:

- installed version: `0.3.2-alpha.1`
- `npx ph workflow implement`: PASS output with README chunk-read rail
- heading-style `## README ranges read` plus `- 1-220`: accepted
- `npx ph workflow check`: PASS
- `npx ph workflow finish implement`: PASS
- npm dist-tags: `alpha` and `latest` both point to `0.3.2-alpha.1`

Next handoff: external testers can retry short TUI requests against `persona-harness@alpha`.
