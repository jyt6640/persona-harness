# Persona Harness

Persona Harness is a local CLI and OpenCode workflow rail for Java/Spring backend projects.

It helps an AI coding agent:

- turn a project idea or README into implementation tickets;
- follow a repeatable backend workflow;
- run verification through bounded commands;
- leave local evidence of what it read, ran, and finished;
- block completion when required reports or evidence are missing.

Persona Harness is not a code-quality guarantee, token-saving product, broad linter, or proof that generated apps are production-ready.

[English](README.md) | [한국어](README.ko.md) | [日本語](README.ja.md) | [简体中文](README.zh-cn.md)

## Install

Requirements:

- Node.js 20+
- npm
- Java 21+
- Gradle
- OpenCode CLI with a configured model/provider

Install OpenCode:

```bash
curl -fsSL https://opencode.ai/install | bash
# or
npm install -g opencode-ai
```

Connect a provider:

```bash
opencode auth login
opencode auth list
```

Install the current preview package in a project:

```bash
npm install -D persona-harness@next
npx ph --help
npx ph init
npx ph doctor
```

Use the stable channel if you need the older stable package:

```bash
npm install -D persona-harness@latest
```

## Start A Java/Spring Backend Project

Use a clean project directory. Do not do your first smoke test inside the Persona Harness repository itself.

```bash
mkdir -p /tmp/persona-harness-demo
cd /tmp/persona-harness-demo
npm init -y
npm install -D persona-harness@next
```

Create a short `README.md` that describes the app and constraints:

```bash
cat > README.md <<'EOF'
# Todo API

Build a Java 21 Spring Boot REST API with Gradle.

## Requirements

- Users can create todos.
- Users can list todos.
- Users can mark a todo completed.
- Missing todos return an appropriate error response.

## Technical Constraints

- Java 21
- Spring Boot 3
- Gradle only
- REST API only
- Start with in-memory persistence if needed.
- Controllers delegate to application services.
- Repository interfaces live in domain.
- Repository implementations live in infrastructure.
- Application services must not own storage state or id sequences.
EOF
```

Initialize Persona Harness:

```bash
npx ph init
npx ph bootstrap backend
npx ph workflow check
```

`ph init` creates only the minimal integration files:

- `.persona/harness.jsonc`
- `.persona/conventions/`
- `.persona/rules/`
- `.opencode/opencode.json`
- `.gitignore` entries

`ph bootstrap backend` prepares the backend workflow for AI implementation:

- `AGENTS.md`
- `.persona/project-profile.jsonc`
- policy overlay files
- an accepted `.persona/workflow/plan.md`
- implementation and review report templates
- OpenCode configuration

## Ask The Agent To Implement

In OpenCode, keep the prompt short:

```bash
opencode run --dir . \
  --model <provider/model> \
  --dangerously-skip-permissions \
  "Read README.md and implement it."
```

Or open the TUI:

```bash
opencode
```

Then type:

```text
Read README.md and implement it.
```

The agent should run the Persona Harness rail itself, including:

```text
npx ph workflow implement
npx ph bearshell ...
npx ph plan --report-filled implementation
npx ph plan --report-filled review
npx ph workflow finish implement
```

If `workflow finish` fails, the agent should fix the reported blocker before claiming completion.

## Start From An Idea Instead Of A README

If you only have an idea, tell the agent the idea:

```text
I want to build a todo web service.
```

The agent should draft requirements first, not start coding:

```text
npx ph workflow draft --stdin
```

Review the generated files:

- `.persona/workflow/requirements/backlog.md`
- `.persona/workflow/requirements/questions.md`
- `.persona/workflow/requirements/assumptions.md`

If the draft is right, tell the agent:

```text
Proceed.
```

The agent should then run:

```text
npx ph workflow approve requirements
npx ph workflow split .persona/workflow/requirements/backlog.md
npx ph workflow next
npx ph workflow implement
```

## Work With Multiple Tickets

For long requirements, split them into tickets:

```bash
npx ph workflow split README.md
npx ph workflow next
```

After a ticket is implemented and reviewed:

```bash
npx ph workflow archive <ticket-id>
npx ph workflow next
```

The workflow ledger lives under `.persona/workflow/`:

- active work: `.persona/workflow/work/`
- completed ticket history: `.persona/workflow/history/`
- requirement sources: `.persona/workflow/requirements/`

## Useful Commands

Setup:

```bash
npx ph init
npx ph bootstrap backend
npx ph doctor
```

Workflow:

```bash
npx ph workflow check
npx ph workflow implement
npx ph workflow finish implement
npx ph workflow archive <ticket-id>
```

Bounded command execution:

```bash
npx ph bearshell --shell 'gradle test'
npx ph bearshell --shell 'gradle build'
```

Evidence and reports:

```bash
npx ph evidence summary
npx ph evidence metrics --json
npx ph evidence ab-report --json
npx ph evidence pminus-report --json
npx ph review backend-shape
```

Preview/local-current builds may also include:

```bash
npx ph evidence pminus-status --json
```

Explicit local A/B evidence recording:

```bash
npx ph evidence ab-run \
  --scenario demo \
  --condition baseline \
  -- ./gradlew test
```

## Optional Integrations

The default backend bootstrap registers the remote developer MCP tools `grep_app` and `context7`.

CodeGraph is opt-in:

```bash
npx ph bootstrap backend --codegraph-preview
```

LSP is opt-in:

```bash
npx ph bootstrap backend --lsp-preview
```

Both wrappers are preview surfaces. If required external tools are missing, they should report an unavailable status rather than fake successful results.

Disable developer MCP registration:

```bash
npx ph bootstrap backend --no-developer-mcp
```

## TDD Rail

The TDD rail is opt-in. It only runs when both settings are enabled:

```json
{
  "enforce": {
    "executeVerification": true,
    "tdd": true
  }
}
```

When enabled, `ph workflow test` records red evidence only from PH-run Gradle/JUnit failures. Later `workflow check`, `workflow archive`, or `workflow finish` can record green evidence for the same ticket/test id.

This is a red-first completion gate. It does not scaffold tests, prove test sufficiency, run coverage, run mutation testing, or certify application quality.

## What Evidence Means

`.persona/evidence` stores local traces such as file reads, injected workflow context, command activity, TDD records, and A/B measurements.

Evidence answers: "Did the agent see and follow the expected rail?"

Evidence does not prove:

- generated app quality;
- token savings;
- product efficacy;
- full TDD coverage;
- broad reliability;
- successful closure in all cases.

## Recommended Backend Shape

Persona Harness steers Java/Spring projects toward:

- Gradle-first Java/Spring backend;
- `presentation`, `application`, `domain`, `infrastructure`, and `global` package boundaries;
- controllers delegating to application services;
- application services orchestrating use cases without owning storage state or id sequences;
- repository interfaces in `domain`;
- repository implementations in `infrastructure`;
- domain objects with behavior;
- explicit request/response DTO boundaries.

These are steering targets and review cues, not quality guarantees.

## Troubleshooting

Check installed versions:

```bash
npm view persona-harness dist-tags --json
npm view persona-harness@latest version
npm view persona-harness@next version
```

If `opencode` is missing:

```bash
curl -fsSL https://opencode.ai/install | bash
opencode --version
opencode auth login
```

If `ph workflow check` reports warnings, inspect the listed blockers. Before implementation, warnings about template reports are normal. After implementation, common blockers are missing evidence, unfilled reports, or verification that was not run through the expected rail.

If the agent ignores the workflow, paste a stricter prompt:

```text
Read README.md, .persona/project-profile.jsonc, .persona/policies, and .persona/workflow/plan.md.
Before implementing, run `npx ph workflow implement`.
Use `npx ph bearshell` for verification commands where possible.
After implementation, fill `.persona/workflow/implementation-report.md` and `.persona/workflow/review-report.md`.
Run `npx ph plan --report-filled implementation`, `npx ph plan --report-filled review`, and `npx ph workflow finish implement`.
If finish fails, do not claim completion. Fix the reported blocker first.
```

## What Persona Harness Does Not Promise

- generated application quality certification;
- token savings;
- product-efficacy or navigation-benefit proof;
- Clean Code guarantees;
- broad AST/linter enforcement;
- full TDD framework, test scaffolding, coverage, or mutation testing;
- frontend, infrastructure, or desktop workflow productization;
- a complete workflow without OpenCode.

`ph bearshell` is not a sandbox. It limits runtime and output size, but commands still run on your machine.

## Docs

- [Changelog](CHANGELOG.md)
- [Release notes](docs/current/release/README.md)
- [Acceptance test checklist](docs/current/acceptance-test-checklist.md)
- [Java backend MVP install guide](docs/current/java-backend-mvp-install-guide.md)

## License

Apache-2.0. See [LICENSE](LICENSE).
