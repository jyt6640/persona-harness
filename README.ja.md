# Persona Harness

Persona Harness は、Java/Spring backend project 向けの local CLI と OpenCode workflow rail です。

AI coding agent が次を行うための補助をします。

- idea や README を implementation ticket に分割する
- repeatable backend workflow に従う
- bounded command で verification を実行する
- 何を読んだか、実行したか、完了したかを local evidence として残す
- 必要な report/evidence がない場合に completion claim を止める

Persona Harness は code quality guarantee、token-saving product、broad linter、generated app production-ready proof ではありません。

[English](README.md) | [한국어](README.ko.md) | [日本語](README.ja.md) | [简体中文](README.zh-cn.md)

## Install

Requirements:

- Node.js 20+
- npm
- Java 21+
- Gradle
- model/provider configured in OpenCode CLI

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

Install the current preview package:

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

Use a clean project directory.

```bash
mkdir -p /tmp/persona-harness-demo
cd /tmp/persona-harness-demo
npm init -y
npm install -D persona-harness@next
```

Create a short `README.md`:

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
- Controllers delegate to application services.
- Repository interfaces live in domain.
- Repository implementations live in infrastructure.
EOF
```

Initialize the workflow:

```bash
npx ph init
npx ph bootstrap backend
npx ph workflow check
```

`ph init` creates minimal integration files. `ph bootstrap backend` prepares `AGENTS.md`, backend profile, policy files, accepted plan, report templates, and OpenCode configuration.

## Ask The Agent To Implement

Run OpenCode with a short prompt:

```bash
opencode run --dir . \
  --model <provider/model> \
  --dangerously-skip-permissions \
  "Read README.md and implement it."
```

The agent should run the rail:

```text
npx ph workflow implement
npx ph bearshell ...
npx ph plan --report-filled implementation
npx ph plan --report-filled review
npx ph workflow finish implement
```

If `workflow finish` fails, the agent should fix the blocker before claiming completion.

## Start From An Idea

If there is no README yet:

```text
I want to build a todo web service.
```

The agent should draft requirements first:

```text
npx ph workflow draft --stdin
```

Review:

- `.persona/workflow/requirements/backlog.md`
- `.persona/workflow/requirements/questions.md`
- `.persona/workflow/requirements/assumptions.md`

Then tell the agent to proceed. It should run:

```text
npx ph workflow approve requirements
npx ph workflow split .persona/workflow/requirements/backlog.md
npx ph workflow next
npx ph workflow implement
```

## Useful Commands

```bash
npx ph init
npx ph bootstrap backend
npx ph doctor
npx ph workflow check
npx ph workflow implement
npx ph workflow finish implement
npx ph bearshell --shell 'gradle test'
npx ph bearshell --shell 'gradle build'
npx ph evidence summary
npx ph evidence metrics --json
npx ph evidence ab-report --json
npx ph evidence pminus-report --json
npx ph review backend-shape
```

Preview/local-current builds may include:

```bash
npx ph evidence pminus-status --json
```

Explicit A/B evidence recording:

```bash
npx ph evidence ab-run \
  --scenario demo \
  --condition baseline \
  -- ./gradlew test
```

## Optional Integrations

CodeGraph is opt-in:

```bash
npx ph bootstrap backend --codegraph-preview
```

LSP is opt-in:

```bash
npx ph bootstrap backend --lsp-preview
```

Disable developer MCP registration:

```bash
npx ph bootstrap backend --no-developer-mcp
```

## TDD Rail

The TDD rail is opt-in. When `enforce.executeVerification=true` and `enforce.tdd=true`, `ph workflow test` records red evidence only from PH-run Gradle/JUnit failures. `workflow check`, `workflow archive`, and `workflow finish` can later record green evidence for the same ticket/test id.

This is a red-first completion gate. It does not scaffold tests, prove test sufficiency, run coverage, run mutation testing, or certify application quality.

## What Evidence Means

`.persona/evidence` stores local traces such as file reads, injected workflow context, command activity, TDD records, and A/B measurements.

Evidence answers whether the agent saw and followed the expected rail. It does not prove generated app quality, token savings, product efficacy, full TDD coverage, broad reliability, or universal closure success.

## Recommended Backend Shape

- Gradle-first Java/Spring backend
- `presentation`, `application`, `domain`, `infrastructure`, and `global` package boundaries
- Controller delegates to application service
- Application service does not own storage state or id sequences
- Repository interfaces live in `domain`
- Repository implementations live in `infrastructure`
- Domain objects have behavior
- Request/response DTO boundaries are explicit

These are steering targets, not quality guarantees.

## Docs

- [Changelog](CHANGELOG.md)
- [Release notes](docs/current/release/README.md)
- [Acceptance test checklist](docs/current/acceptance-test-checklist.md)
- [Java backend MVP install guide](docs/current/java-backend-mvp-install-guide.md)

## License

Apache-2.0. See [LICENSE](LICENSE).
