# Persona Harness

面向 OpenCode 的 AI coding workflow rail + evidence + continuation harness.

[English](README.md) | [한국어](README.ko.md) | [日本語](README.ja.md) | [简体中文](README.zh-cn.md)

Persona Harness 帮助代理从空项目开始，读取 backend 背景，沿着 implementation rail 工作，留下读取/注入/workflow command 的痕迹，继续未完成 ticket，然后再填写 workflow reports 并声明完成。

它不认证 generated app product quality。当前 Java/Spring backend guidance 是 stack steering、workflow observability 和 scoped opt-in closure enforcement surface，不是 Clean Code 保证、广泛 AST/linter 或 general enforcement engine。

> 当前范围: Java/Spring backend workflow rail MVP.
> frontend、infra、desktop app、广泛 AST/linter enforcement、完整 TDD workflow 都是后续方向。
>
> 当前 source/package 候选版本: npm dist-tag `next` 的 `0.4.0-rc.4`

## 环境要求

- Node.js 20+
- npm
- OpenCode terminal CLI
- 已在 OpenCode 中配置的 model/provider

## 快速开始

先安装 OpenCode。OpenCode 官方文档推荐 install script，也可以使用 npm global install。

```bash
curl -fsSL https://opencode.ai/install | bash
```

或者:

```bash
npm install -g opencode-ai
```

确认安装:

```bash
opencode --version
opencode
```

在 OpenCode 中连接 model provider。

```bash
opencode auth login
opencode auth list
```

也可以在 OpenCode TUI 中运行:

```text
/connect
/models
```

Model ID 使用 `provider/model` 格式，例如 `openai/gpt-5.4-mini-fast`.

然后在 Java/Spring backend 项目中安装 Persona Harness。

```bash
npm install -D persona-harness@next
npx ph init
npx ph bootstrap backend
```

如果你正在开发 Persona Harness 本身，请使用 local install。

```bash
npm install -D /absolute/path/to/persona-harness
npx ph init
npx ph bootstrap backend
```

先让 OpenCode 只完成计划:

```bash
opencode run --dir . --model <model> --dangerously-skip-permissions \
  "$(npx ph plan --prompt)"
```

计划足够清楚后接受它:

```bash
npx ph plan --status
npx ph plan --accept
```

然后让 OpenCode 实现:

如果还没有 README，只有一个产品想法，请先生成 requirements draft。

```text
我想做一个 TODO Web 服务
```

这种情况下，代理不应该立刻实现，而应该先运行:

```text
npx ph workflow draft --stdin
```

生成的 draft:

- `.persona/workflow/requirements/backlog.md`
- `.persona/workflow/requirements/questions.md`
- `.persona/workflow/requirements/assumptions.md`

确认内容后，如果方向正确，告诉代理 `继续`。之后代理应运行:

```text
npx ph workflow approve requirements
npx ph workflow split .persona/workflow/requirements/backlog.md
npx ph workflow next
npx ph workflow implement
```

如果 README 已经存在，请使用普通实现请求。

```bash
opencode run --dir . --model <model> --dangerously-skip-permissions \
  "请阅读 README.md, .persona/project-profile.jsonc, .persona/policies, .persona/workflow/plan.md，确认 plan 是 accepted 状态，然后基于 Java/Spring Gradle 实现全部需求。执行命令时尽量使用 npx ph bearshell；实现后运行 npx ph bearshell gradle test, npx ph bearshell gradle build；如果是可运行的 Spring Boot app，运行 npx ph bearshell --shell 'gradle bootRun --args=\"--server.port=<port>\"'；再执行 HTTP happy path 和 failure path smoke。填写 .persona/workflow/implementation-report.md 与 .persona/workflow/review-report.md，并运行 npx ph plan --report-filled implementation 和 npx ph plan --report-filled review。"
```

## 提供内容

- `ph init`: 安装 `.persona/rules`, `.persona/harness.jsonc`, OpenCode plugin config
- `ph bootstrap backend`: 准备 `AGENTS.md`, backend profile, policy overlay, accepted plan, report template
- `ph intake --interactive`: 询问 backend planning 问题并写入 `.persona/project-profile.jsonc`
- `ph policy init`: 创建 company/personal backend policy overlay
- `ph plan`: 创建 `blackbear` planning role 的 `.persona/workflow/plan.md`
- `ph workflow draft --stdin`: 从 vague product idea 创建 requirements draft，并停在 review 阶段
- `ph workflow approve requirements`: 将已 review 的 draft 标记为 accepted
- `ph workflow split [source.md]`: 将 requirements source 拆分成 ticket/backlog
- `ph workflow next`: 输出下一个 pending ticket
- `ph bearshell`: bounded shell command helper
- `ph history`: 将使用过的 workflow artifact 保存到 `.persona/workflow/history/`
- OpenCode injection: 当代理读取相关文件时注入 Java/Spring backend workflow/guidance context

## Evidence 的含义

`.persona/evidence` 记录 file read、被注入的 workflow/rule context、选中的 rail、target file role、workflow command activity 等执行痕迹。它用于确认“代理是否看见并跟随了预期 rail”，不是质量分数，也不能把 evidence count 当成质量提升证明。

## 鼓励的代码结构

- Gradle-first Java/Spring backend
- `presentation`, `application`, `domain`, `infrastructure`, `global` 边界
- Controller 委托给 Service
- Application Service 只编排 use case，不直接持有 storage state 或 id sequence
- Domain 不是 passive record，而是用自己的字段进行判断和行为
- Repository interface 在 domain，具体实现放在 infrastructure
- 明确 request/response DTO boundary

这些是 steering target 和 review cue。它们不证明生成的 app 正确、可维护、安全或 production-ready。

## A/B 与 ON/OFF smoke 的限制

现有 A/B 或 ON/OFF smoke 结果只能视为 stack steering signal。样本很小，常见 `n=1`，non-blind，同一操作者执行，并且依赖 model/version/prompt/timeout/continuation behavior，因此不能作为 product quality 证明。

## 不承诺

- 生成 app 的 product quality 认证
- AST/linter/build failure 级别的 rule enforcement
- Clean Code 质量保证
- 把 evidence count 解读为质量提升的说法
- 测试充分性证明
- frontend, infra, desktop workflow productization
- 最终 TDD workflow
- 没有 OpenCode 的独立 agent workflow

## 文档

- [Changelog](CHANGELOG.md)
- [Release checklist](docs/current/release/release-checklist.md)
- [Release notes template](docs/current/release/release-notes-template.md)
- [Detailed usage notes](docs/current/persona-harness-detailed-usage.md)
- [Alpha publish readiness](docs/current/v0.3.0-alpha-publish-readiness.md)
- [External tester guide](docs/current/v0.3.0-external-tester-guide.md)
- [Java backend MVP install guide](docs/current/java-backend-mvp-install-guide.md)

## 许可证

Apache-2.0. See [LICENSE](LICENSE).
