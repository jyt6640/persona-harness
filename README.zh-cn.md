<!-- <CENTERED SECTION FOR GITHUB DISPLAY> -->

<div align="center">

<img src="img/Persona-Harness-Logo.png" alt="Persona Harness 标志" width="180">

# Persona Harness

**为构建 Java/Spring 后端的 AI 编码智能体提供的完成门禁。**

[![npm version](https://img.shields.io/npm/v/persona-harness?color=369eff&labelColor=black&style=flat-square)](https://www.npmjs.com/package/persona-harness)
[![npm downloads](https://img.shields.io/npm/dt/persona-harness?color=ff6b35&labelColor=black&style=flat-square)](https://www.npmjs.com/package/persona-harness)
[![node](https://img.shields.io/badge/node-%3E%3D20-c4f042?labelColor=black&style=flat-square)](https://nodejs.org)
[![License](https://img.shields.io/badge/license-Apache--2.0-white?labelColor=black&style=flat-square)](./LICENSE)

[English](README.md) | [한국어](README.ko.md) | [日本語](README.ja.md) | [简体中文](README.zh-cn.md)

</div>

<!-- </CENTERED SECTION FOR GITHUB DISPLAY> -->

> AI 智能体总喜欢说"完成了！"—— Persona Harness 让它们拿出证明。这是一个本地 CLI completion gate：在所需 report、由 PH 生成的 evidence、真实测试结果落盘之前，阻止任何完成声明。OpenCode runtime guidance 是可选 preview，不是产品中心。

> [!IMPORTANT]
> **项目状态：gate-first measured release。**
> runtime injection 效果已经测量，**在已接受的 10 组 local-current OpenCode fixture 中为负面**。依据见 [`docs/current/injection-value-status.json`](docs/current/injection-value-status.json)。因此 runtime guidance 默认关闭，只能显式 opt-in preview；这是该 fixture 范围内的测量，不是通用 product-efficacy 主张。
> PH 实际主张的 —— 也是有证据支撑的 —— 范围更窄：**对明确定义的 evidence gate 和确定性违规，阻止未经验证的完成。**

## 已测量的行为

与大多数智能体 harness 项目不同，PH 公开它实际测量过的东西 —— 包括负面结果。

| 场景 | 结果 | 依据 |
| :--- | :--- | :--- |
| **伪造的 TDD evidence** —— 在 `workflow finish` 前手工放置 `red-forged.json` | `finish` 以 **exit 1** 退出 —— 伪造文件被忽略 | P0 真实 Gradle run 归档 |
| **Green-only 完成**（测试+实现同时提交，无 red-first）—— 各重复 5 次 | TDD OFF：放行 **5/5** · TDD ON：拦截 **5/5** | P1 completion-integrity A/B |
| **将编译错误冒充为 "red"** | `workflow test` 以 **exit 1** 退出，不生成 evidence | P0 真实 Gradle run 归档 |
| Runtime injection PH OFF/ON app-generation — 10 paired OpenCode runs | PH ON **10/10**、PH OFF **10/10** 成功。但 PH ON 在所有 10 组配对中都增加了 provider-token total、read chars、tool calls 和 elapsed time | accepted local-current A/B archive |

以上是在受限本地 fixture 上的 completion-integrity 测量。它们*不是* token 节省、应用质量或产品效能的主张。

## TL;DR

> Q. 这是什么？

为 AI 智能体执行的 Java/Spring 后端工作提供的 workflow/evidence CLI + completion guard，以本地 CLI（`ph`）和可选 runtime guidance/measurement hook 的 OpenCode 插件形式提供。

> Q. 它实际做什么？

- 把项目想法或 README 拆分为实现 ticket
- 让智能体保持在可重复的后端 workflow 上
- 通过受限命令执行验证
- 以本地 evidence 记录读取、执行、完成了什么
- **缺少必需的 report/evidence 时阻止完成**

> Q. 它能保证代码质量、节省 token、替代 linter 吗？

不能。它不是代码质量保证、token 节省产品、broad linter，也不是生成应用达到 production-ready 的证明。任何比完成门禁更宽的主张都必须先通过测量获得 —— 这条规则本身就是项目的一部分。

## 安装

要求：

- Node.js 20+、npm
- Java 21+、Gradle
- 已配置模型/供应商的 OpenCode CLI

```bash
# OpenCode
curl -fsSL https://opencode.ai/install | bash   # 或：npm install -g opencode-ai
opencode auth login

# Persona Harness
npm install -D persona-harness
npx ph --help
npx ph init
npx ph doctor
```

## 快速开始 —— Java/Spring 后端

请使用干净的项目目录。不要在 Persona Harness 仓库本身做第一次冒烟测试。

```bash
mkdir -p /tmp/persona-harness-demo && cd /tmp/persona-harness-demo
npm init -y
npm install -D persona-harness
```

创建一个描述应用与约束的简短 `README.md`：

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
- Java 21, Spring Boot 3, Gradle only, REST API only
- Start with in-memory persistence if needed.
- Controllers delegate to application services.
- Repository interfaces live in domain; implementations in infrastructure.
- Application services must not own storage state or id sequences.
EOF
```

初始化：

```bash
npx ph init
npx ph bootstrap backend
npx ph workflow check
```

`ph init` 只创建最小集成文件（`.persona/harness.jsonc`、`.persona/conventions/`、`.persona/rules/`、`.opencode/opencode.json`、`.gitignore` 条目）。`ph bootstrap backend` 准备完整的后端 workflow：`AGENTS.md`、`.persona/project-profile.jsonc`、policy overlay、已接受的 plan、report 模板、OpenCode 配置。新的 setup 是 gate-first：model-facing runtime guidance 在显式启用前保持关闭。

然后在 OpenCode 中用简短提示词请求智能体：

```text
Read README.md and implement it.
```

智能体应当自行运行 rail：

```text
npx ph workflow implement
npx ph bearshell ...
npx ph plan --report-filled implementation
npx ph plan --report-filled review
npx ph workflow finish implement
```

> [!NOTE]
> 如果 `workflow finish` 失败，智能体必须先修复报告的 blocker，才能声明完成。这个失败不是 bug，而是产品在正常工作。

## 从想法而不是 README 开始

把想法告诉智能体：

```text
我想做一个 todo 网络服务。
```

智能体应当先起草需求，而不是直接写代码：

```text
npx ph workflow draft --stdin
```

审阅 `.persona/workflow/requirements/` 下的产物（`backlog.md`、`questions.md`、`assumptions.md`），然后说 `继续。`，智能体会执行：

```text
npx ph workflow approve requirements
npx ph workflow split .persona/workflow/requirements/backlog.md
npx ph workflow next
npx ph workflow implement
```

## 处理多个 Ticket

```bash
npx ph workflow split README.md
npx ph workflow next
# ... 实现 & 审查 ...
npx ph workflow archive <ticket-id>
npx ph workflow next
```

workflow 账本位于 `.persona/workflow/`：进行中的工作在 `work/`，完成历史在 `history/`，需求来源在 `requirements/`。

## TDD Rail（opt-in）

同时启用两个设置才会生效：

```json
{
  "enforce": {
    "executeVerification": true,
    "tdd": true
  }
}
```

启用后，`ph workflow test` **只从 PH 直接运行的 Gradle/JUnit 失败中**记录 red evidence —— 绝不接受智能体自行报告的 evidence。之后 `workflow check` / `archive` / `finish` 为同一 ticket/test id 记录 green evidence。

这是一个 red-first 完成门禁。它不做测试脚手架、不证明测试充分性、不运行 coverage 或 mutation testing、不认证应用质量。

## 常用命令

```bash
# 设置
npx ph init && npx ph bootstrap backend && npx ph doctor

# Workflow
npx ph workflow check
npx ph workflow implement
npx ph workflow finish implement
npx ph workflow archive <ticket-id>

# 受限命令执行
npx ph bearshell --shell 'gradle test'

# Evidence 与 report
npx ph evidence summary
npx ph evidence metrics --json
npx ph evidence ab-report --json
npx ph evidence pminus-report --json
npx ph review backend-shape

# 显式记录本地 A/B evidence
npx ph evidence ab-run --scenario demo --condition baseline -- ./gradlew test
```

Stable builds also include `npx ph evidence pminus-status --json` for read-only surface decision summaries.

## 可选集成

默认的 backend bootstrap 会注册远程 developer MCP 工具 `grep_app` 和 `context7`。

```bash
npx ph bootstrap backend --codegraph-preview   # CodeGraph，opt-in
npx ph bootstrap backend --lsp-preview         # LSP，opt-in
npx ph bootstrap backend --no-developer-mcp    # 禁用 developer MCP
```

> [!NOTE]
> 两个 wrapper 都是 preview 表面。如果所需外部工具缺失，它们会报告 **unavailable** 状态，而不是伪造成功结果。

## Evidence 的含义

`.persona/evidence` 存储本地痕迹：文件读取、注入的 workflow 上下文、命令活动、TDD 记录、A/B 测量。

Evidence 回答一个问题：**"智能体是否看到并遵循了预期的 rail？"**

Evidence **不**证明：生成应用的质量、token 节省、产品效能、full TDD coverage、broad reliability、所有情况下的成功 closure。

## 推荐的后端形态

Persona Harness 引导 Java/Spring 项目朝以下方向发展：

- Gradle-first 的 Java/Spring 后端
- `presentation` / `application` / `domain` / `infrastructure` / `global` 包边界
- Controller 委托给 application service
- Application service 编排用例，不直接持有存储状态或 id 序列
- Repository 接口在 `domain`，实现在 `infrastructure`
- 具有行为的领域对象
- 显式的 request/response DTO 边界

这些是引导目标和审查线索，不是质量保证。

## 故障排查

```bash
npm view persona-harness dist-tags --json
opencode --version
```

如果 `ph workflow check` 报告警告，请检查列出的 blocker。实现前，template report 警告是正常的。实现后常见的 blocker 是缺失的 evidence、未填写的 report、或绕过 rail 的验证。

如果智能体忽略 workflow，请粘贴更严格的提示词：

```text
Read README.md, .persona/project-profile.jsonc, .persona/policies, and .persona/workflow/plan.md.
Before implementing, run `npx ph workflow implement`.
Use `npx ph bearshell` for verification commands where possible.
After implementation, fill `.persona/workflow/implementation-report.md` and `.persona/workflow/review-report.md`.
Run `npx ph plan --report-filled implementation`, `npx ph plan --report-filled review`, and `npx ph workflow finish implement`.
If finish fails, do not claim completion. Fix the reported blocker first.
```

## Persona Harness 不承诺的事

- 生成应用的质量认证
- token 节省
- 产品效能或 navigation-benefit 证明
- Clean Code 保证
- broad AST/linter 强制
- full TDD 框架、测试脚手架、coverage、mutation testing
- frontend、infrastructure、desktop workflow 产品化
- 没有 OpenCode 的完整 workflow

> [!WARNING]
> `ph bearshell` 不是沙箱。它限制运行时间和输出大小，但命令仍在你的机器上执行。

## 文档

- [Changelog](CHANGELOG.md)
- [Release notes](docs/current/release/README.md)
- [验收测试清单](docs/current/acceptance-test-checklist.md)
- [Java backend MVP 安装指南](docs/current/java-backend-mvp-install-guide.md)

## 许可证

Apache-2.0。见 [LICENSE](LICENSE)。
