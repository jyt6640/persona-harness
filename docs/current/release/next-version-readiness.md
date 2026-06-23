# Next Version Readiness

## Candidate

```text
persona-harness@0.3.5-alpha.0
dist-tag: alpha
date: 2026-06-23
```

## Release Intent

This candidate clarifies the first-run setup path for Persona Harness users and AI agents.

The desired split is:

- human terminal setup uses `npx ph init` and answers the backend profile interview;
- AI/non-TTY setup uses `npx ph bootstrap backend`;
- `ph init` never silently creates a default profile when the interview cannot run.

## Included Changes

- `ph init` starts the backend profile interview only when it runs from an interactive terminal.
- non-TTY `ph init` installs harness/plugin files, returns a clear setup message, and exits before writing `.persona/project-profile.jsonc`.
- The non-TTY message points to `npx ph bootstrap backend` for AI shells and smoke tests.
- Injection guidance now tells agents not to attempt interactive prompts from AI/non-TTY shells.
- README and workflow role docs describe the human interview path and the AI bootstrap path separately.

## Supported Surface

- Java/Spring backend MVP.
- Gradle-first backend workflow.
- Human setup through an interview-based backend profile.
- AI/non-TTY setup through deterministic backend bootstrap.
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
| `npm test -- tests/persona-harness-init.test.ts tests/phase0-hooks.test.ts tests/persona-harness-interactive-intake.test.ts` | pass: 3 files, 25 tests |
| `npm test` | pass: 36 files, 240 tests |
| `npm run typecheck` | pass |
| `npm run build` | pass |
| `npm run report:rules` | pass: PersonaHarnessRule diagnostics PASS, 0 findings |
| `npm run check:scope:strict` | pass: MVP scope diagnostics PASS, 0 findings |
| `npm run check:injection-value` | pass: current window 3/3, expected decision `continue-java-mvp` |
| `bun run packages/shared-skills/skills/programming/scripts/typescript/check-no-excuse-rules.ts src/cli/index.ts src/cli/init-output.ts src/cli/init.ts src/phase0/injection.ts tests/persona-harness-init.test.ts` | pass |
| `npm pack --dry-run` | pass: `persona-harness-0.3.5-alpha.0.tgz`, 237 files, 250.0 kB package size, 966.7 kB unpacked size |
| non-TTY `node dist/cli/index.js init` smoke | pass: exit 1, harness/plugin files created, no profile created, bootstrap guidance printed |
| TTY `node dist/cli/index.js init` smoke | pass: exit 0, backend interview completed, profile status `ready` |
| `node dist/cli/index.js bootstrap backend` smoke | pass: profile, policy, accepted plan, and report templates created |

## Smoke Expectations

Interactive terminal:

```bash
npx ph init
```

Expected:

- `.persona/harness.jsonc` exists;
- `.persona/rules/` exists;
- `.opencode/opencode.json` exists;
- backend profile interview starts;
- `.persona/project-profile.jsonc` is written only after answers are collected.

AI/non-TTY:

```bash
npx ph init
```

Expected:

- harness/plugin files are installed;
- command exits non-zero with a clear message;
- `.persona/project-profile.jsonc` is not created;
- message tells the agent to run `npx ph bootstrap backend`.

## Release Decision

Ready to publish under the `alpha` dist-tag.

## Known Gaps

- OpenCode/Codex TUI shells may not reliably support interactive prompts.
- `ph bootstrap backend` is intentionally the AI/non-TTY fast path, not a replacement for a human interview.
- Generated application quality remains a manual/external-test judgment.
