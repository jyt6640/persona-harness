# Persona Harness

Persona Harness 是面向 Java/Spring 后端项目的本地 CLI 和 OpenCode workflow rail。

它帮助 AI coding agent：

- 将想法或 README 拆成 implementation tickets；
- 跟随可重复的后端 workflow；
- 通过 bounded commands 执行验证；
- 记录读取、执行、完成过的本地 evidence；
- 在缺少 report/evidence 时阻止完成声明。

Persona Harness 不是代码质量保证、token-saving 产品、broad linter，也不证明 generated app production-ready。

[English](README.md) | [한국어](README.ko.md) | [日本語](README.ja.md) | [简体中文](README.zh-cn.md)

## 安装

Requirements:

- Node.js 20+
- npm
- Java 21+
- Gradle
- 已配置 model/provider 的 OpenCode CLI

安装 OpenCode:

```bash
curl -fsSL https://opencode.ai/install | bash
# or
npm install -g opencode-ai
```

连接 provider:

```bash
opencode auth login
opencode auth list
```

安装当前 preview package:

```bash
npm install -D persona-harness@next
npx ph --help
npx ph init
npx ph doctor
```

如果需要较旧的 stable package，请使用 stable channel:

```bash
npm install -D persona-harness@latest
```

## 启动 Java/Spring 后端项目

使用干净的项目目录。

```bash
mkdir -p /tmp/persona-harness-demo
cd /tmp/persona-harness-demo
npm init -y
npm install -D persona-harness@next
```

创建简短的 `README.md`:

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

初始化 workflow:

```bash
npx ph init
npx ph bootstrap backend
npx ph workflow check
```

`ph init` 只创建最小集成文件。`ph bootstrap backend` 会准备 `AGENTS.md`、backend profile、policy files、accepted plan、report templates 和 OpenCode 配置。

## 让 Agent 实现

用短 prompt 运行 OpenCode:

```bash
opencode run --dir . \
  --model <provider/model> \
  --dangerously-skip-permissions \
  "Read README.md and implement it."
```

Agent 应该自己运行 rail:

```text
npx ph workflow implement
npx ph bearshell ...
npx ph plan --report-filled implementation
npx ph plan --report-filled review
npx ph workflow finish implement
```

如果 `workflow finish` 失败，agent 应先修复 blocker，再声明完成。

## 只有想法、没有 README

如果还没有 README:

```text
I want to build a todo web service.
```

Agent 应先生成 requirements draft:

```text
npx ph workflow draft --stdin
```

Review:

- `.persona/workflow/requirements/backlog.md`
- `.persona/workflow/requirements/questions.md`
- `.persona/workflow/requirements/assumptions.md`

确认后让 agent 继续。它应运行:

```text
npx ph workflow approve requirements
npx ph workflow split .persona/workflow/requirements/backlog.md
npx ph workflow next
npx ph workflow implement
```

## 常用命令

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

显式记录 A/B evidence:

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

TDD rail 是 opt-in。启用 `enforce.executeVerification=true` 和 `enforce.tdd=true` 后，`ph workflow test` 只会从 PH-run Gradle/JUnit failure 记录 red evidence。之后 `workflow check`、`workflow archive`、`workflow finish` 可以为同一个 ticket/test id 记录 green evidence。

这是 red-first completion gate。它不生成测试脚手架，不证明测试充分性，不运行 coverage/mutation testing，也不认证应用质量。

## Evidence 的含义

`.persona/evidence` 保存本地 traces，例如 file reads、injected workflow context、command activity、TDD records 和 A/B measurements。

Evidence 回答的是 agent 是否看见并跟随了 expected rail。它不证明 generated app quality、token savings、product efficacy、full TDD coverage、broad reliability 或 universal closure success。

## 推荐的后端结构

- Gradle-first Java/Spring backend
- `presentation`, `application`, `domain`, `infrastructure`, `global` package boundaries
- Controller delegates to application service
- Application service does not own storage state or id sequences
- Repository interfaces live in `domain`
- Repository implementations live in `infrastructure`
- Domain objects have behavior
- Request/response DTO boundaries are explicit

这些是 steering targets，不是质量保证。

## Docs

- [Changelog](CHANGELOG.md)
- [Release notes](docs/current/release/README.md)
- [Acceptance test checklist](docs/current/acceptance-test-checklist.md)
- [Java backend MVP install guide](docs/current/java-backend-mvp-install-guide.md)

## License

Apache-2.0. See [LICENSE](LICENSE).
