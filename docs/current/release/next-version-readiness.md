# Next Version Readiness

## Candidate

```text
persona-harness@0.3.2-alpha.2
dist-tag: alpha
date: 2026-06-22
```

## Release Intent

This candidate is a hotfix for installed-package clean runs where generated Java files existed but evidence only showed `README.md` or a small set of touched files. It keeps the Java/Spring backend MVP scope and makes `ph workflow implement` surface generated Java role discovery and representative read follow-up.

## Included Changes

- `ph workflow implement` asks the agent to run Java role discovery after Java files are generated or changed.
- Java role discovery recognizes `npx ph bearshell --shell 'find src/main/java src/test/java -name "*.java" ...'` output.
- Implementation report template includes Java role discovery/read fields.
- Profile-required implementation gate is active before `ph plan` and `ph workflow implement`.
- `ph init` creates a ready default backend profile for alpha smoke convenience.
- `ph intake --default backend` creates the same ready default profile explicitly.
- `ph plan --auto-accept` supports clean-run smoke without a separate manual accept step.

## Verification Commands

| Command | Result |
| --- | --- |
| `npm test -- tests/phase0-java-role-discovery.test.ts tests/persona-harness-workflow-check.test.ts` | pass: 2 files, 26 tests |
| `npm test` | pass: 36 test files, 229 tests |
| `npm run typecheck` | pass |
| `npm run build` | pass |
| `npm run report:rules` | pass: PersonaHarnessRule diagnostics PASS, 0 findings |
| `npm run check:scope:strict` | pass: MVP scope diagnostics PASS, 0 findings, STRICT mode |
| `npm run check:injection-value` | pass: current window 3/3, expected decision `continue-java-mvp` |
| `npm pack --dry-run` | pass: `persona-harness-0.3.2-alpha.2.tgz`, 222 files, 230.8 kB package size, 889.4 kB unpacked size |
| `npm publish --dry-run --tag alpha` | pass: dry-run only for `persona-harness@0.3.2-alpha.2` |
| `npm publish --tag alpha` | pass: `persona-harness@0.3.2-alpha.2` |
| `npm view persona-harness@alpha version` | pass: `0.3.2-alpha.2` |
| `npm dist-tag add persona-harness@0.3.2-alpha.2 latest` | blocked: npm OTP required |

## Clean Install Smoke

Expected smoke:

```bash
tmp_project=$(mktemp -d)
cd "$tmp_project"
npm init -y
npm install -D /absolute/path/to/persona-harness
npx ph init
npx ph policy init
npx ph plan --auto-accept
npx ph workflow implement
```

Expected:

- `ph workflow implement` prints the Java role discovery command.
- A generated Java file listing produces `[Persona Harness Java Role Discovery]`.
- Evidence contains `role-discovery` rows for generated Java files.
- Evidence contains a `<java-role-read-follow-up>` model-input row.

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

## Release Decision

`persona-harness@0.3.2-alpha.2` is published under the `alpha` dist-tag.

Local tarball install smoke passed in a repo-external temporary project:

- installed package version: `0.3.2-alpha.2`
- `npx ph init`: created ready default backend profile
- `npx ph plan --auto-accept`: created accepted workflow plan
- `npx ph workflow implement`: printed Java role discovery command
- `npx ph workflow implement`: printed Java role discovery/read evidence guidance

Registry status after publish:

- `alpha`: `0.3.2-alpha.2`
- `latest`: still `0.3.2-alpha.1`
- `latest` sync is pending OTP authorization.
