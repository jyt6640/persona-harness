<!-- <CENTERED SECTION FOR GITHUB DISPLAY> -->

<div align="center">

<img src="img/Persona-Harness-Logo.png" alt="Persona Harness 标志" width="180">

# Persona Harness

**为构建 Java/Spring 后端的 AI 编码智能体提供的完成门禁。**

[![npm version](https://img.shields.io/npm/v/persona-harness?color=369eff&labelColor=black&style=flat-square)](https://www.npmjs.com/package/persona-harness)
[![npm downloads](https://img.shields.io/npm/dt/persona-harness?color=ff6b35&labelColor=black&style=flat-square)](https://www.npmjs.com/package/persona-harness)
[![node](https://img.shields.io/badge/node-%5E20.17.0%20%7C%7C%20%3E%3D22.9.0-c4f042?labelColor=black&style=flat-square)](https://nodejs.org)
[![License](https://img.shields.io/badge/license-Apache--2.0-white?labelColor=black&style=flat-square)](./LICENSE)

[English](README.md) | [한국어](README.ko.md) | [日本語](README.ja.md) | [简体中文](README.zh-cn.md)

**[Start Here](docs/START-HERE.md) · [Quick Demo](docs/QUICK-DEMO.md) · [Measured Claims](docs/MEASURED-CLAIMS.md)**

</div>

<!-- </CENTERED SECTION FOR GITHUB DISPLAY> -->

> AI 智能体总喜欢说"完成了！"—— Persona Harness 让它们拿出证明。这是一个本地 CLI 完成门禁：在所需 report、由 PH 生成的 evidence、真实测试结果落盘之前，阻止任何完成声明。

> [!IMPORTANT]
> **Alpha，gate-first，基于测量。** Stable：`persona-harness@latest=0.6.0`（`next=0.6.0-rc.4`）。runtime injection 在已接受的 10 组配对 fixture 中被测为 **负面**，因此 runtime guidance **默认关闭 / 仅 opt-in**，不是产品中心。见 [`injection-value-status.json`](docs/current/injection-value-status.json)。PH 的主张很窄：**对明确定义的 evidence gate 和确定性违规，阻止未经验证的完成。**

## 已测量的行为 (Measured Behavior)

与大多数智能体 harness 项目不同，PH 公开它实际测量过的东西 —— 包括负面结果。

- **伪造的 TDD evidence** 在 `workflow finish` 前放置 → `finish` 以 **exit 1** 退出，伪造文件被忽略。
- **Green-only 完成**（TDD rail 开启）→ 拦截 **5/5**（关闭时放行 5/5）。
- **runtime injection**，10 组配对 OpenCode run → 成功率相同（都 10/10），但 PH ON 在全部 10 组都增加成本 → 保持 **default-off**。

这些是在受限本地 fixture 上的 completion-integrity 测量 —— *不是* token 节省、应用质量或产品效能的主张。完整边界与依据：**[docs/MEASURED-CLAIMS.md](docs/MEASURED-CLAIMS.md)**。

## 这是什么

为 AI 智能体执行的 Java/Spring 后端工作提供的 workflow + evidence CLI（`ph`），以及可选的 OpenCode 插件。它：

- 把项目想法或 README 拆分为实现 ticket
- 让智能体保持在可重复的后端 workflow 上
- 通过受限命令执行验证
- 以本地 evidence 记录读取、执行、完成了什么
- **缺少必需的 report/evidence 时阻止完成**

它**不是**代码质量保证、token 节省产品、broad linter，也不是生成应用达到 production-ready 的证明。任何比完成门禁更宽的主张都必须先通过测量获得 —— 见 [MEASURED-CLAIMS](docs/MEASURED-CLAIMS.md)。

## 安装

需要 Node.js ^20.17.0 || >=22.9.0（不支持 Node 21）、Java 21+ / Gradle，以及已配置供应商的 OpenCode CLI。

```bash
# OpenCode
curl -fsSL https://opencode.ai/install | bash   # 或：npm install -g opencode-ai
opencode auth login

# Persona Harness
npm install -D persona-harness
npx ph --help && npx ph doctor
```

## 快速开始

对于干净的项目目录，请使用以下路径（不要用 Persona Harness 仓库本身）。

```bash
mkdir -p /tmp/ph-demo && cd /tmp/ph-demo && npm init -y
npm install -D persona-harness

npx ph init                 # 仅创建最小集成文件
npx ph bootstrap backend    # AGENTS.md、profile、plan、report 模板
npx ph workflow check
```

对于已有的 Java/Spring/Gradle 项目，先查看推断出的 draft，再明确接受它：

```bash
npx ph attach
npx ph attach --yes

# 仅用于已识别的弱 Persona Harness 安装，不能用于 ready 安装：
npx ph attach --repair --yes
```

`attach` 会拒绝未识别或已损坏的现有 Persona Harness 文件，而不会覆盖它们。
它也会拒绝修复已经 ready 的安装。成功 attach 会启用 PH-run verification，
同时保持 `runtimeInjection`、`systemConstitution`、`idleContinuation` 和
Ralph loop 为关闭状态。

然后在 OpenCode 中请求智能体实现你的 `README.md`。它应当自行驱动 rail，并以 `npx ph workflow finish implement` 结束。

> [!NOTE]
> 如果 `workflow finish` 失败，智能体必须先修复报告的 blocker，才能声明完成。**这个失败不是 bug，而是产品在正常工作。**

包含示例 Todo API 和想法优先流程的完整指南：**[Quick Demo](docs/QUICK-DEMO.md)**。

## TDD Rail（opt-in）

在 `.persona/harness.jsonc` 中同时启用两个设置：

```json
{ "enforce": { "executeVerification": true, "tdd": true } }
```

之后 `ph workflow test` **只从 PH 直接运行的 Gradle/JUnit 失败中**记录 red evidence —— 绝不接受智能体自行报告的 evidence。随后 `workflow check` / `archive` / `finish` 为同一 ticket/test id 记录 green evidence。这是 red-first 完成门禁；它不做测试脚手架、不证明测试充分性、不运行 coverage/mutation、不认证应用质量。

## 命令

```bash
npx ph attach [--yes]                                  # 已有 Java/Spring/Gradle 项目
npx ph workflow check | implement | finish implement | archive <ticket-id>
npx ph workflow split README.md && npx ph workflow next   # 多 ticket
npx ph bearshell --shell 'gradle test'                    # 受限执行
npx ph evidence summary | metrics --json | ab-report --json | pminus-report --json
npx ph review backend-shape
```

完整列表见 `npx ph --help`。workflow 账本位于 `.persona/workflow/`（`work/`、`history/`、`requirements/`）。

## 可选集成（opt-in preview）

```bash
npx ph bootstrap backend --codegraph-preview          # CodeGraph
npx ph bootstrap backend --lsp-preview                # Java LSP
npx ph bootstrap backend --runtime-injection-preview  # parked 面向模型的 guidance
npx ph bootstrap backend --no-developer-mcp           # 禁用默认 developer MCP
```

preview wrapper 在外部工具缺失时报告 **unavailable** 状态，而不是伪造成功。runtime injection 处于 parked（测为负面），不是推荐路径。

## 平台与主机支持

| 适用面 | 状态 | 证据边界 |
| --- | --- | --- |
| macOS / Linux + OpenCode | 已验证 | 当前 Persona Harness 的主机适配器和产品证据仅限于 macOS/Linux 上的 OpenCode。 |
| Windows | 未验证 | 不主张 Windows 支持。锁 identity 的 device/inode 行为以及 stale-lock/concurrency 结论尚未测量或验证。 |
| Codex 适配器 | 计划中 | 当前没有 Codex 适配器或 Codex 产品证据；它仅是计划中的适配器。 |

## 边界与安全

Evidence 只回答一个问题 —— *"智能体是否看到并遵循了预期的 rail？"* —— 仅此而已。PH **不**承诺应用质量认证、token 节省、Clean Code 保证、broad AST/linter 强制、full TDD 框架、closure 保证，或没有 OpenCode 的完整 workflow。规范列表见 [MEASURED-CLAIMS](docs/MEASURED-CLAIMS.md)。

> [!WARNING]
> `ph bearshell` **不是沙箱**。它限制运行时间和输出大小，但命令仍以你的权限在你的机器上执行。见 [SECURITY](SECURITY.md)。

## 文档

- **新用户** → [Start Here](docs/START-HERE.md) · [Quick Demo](docs/QUICK-DEMO.md) · [Measured Claims](docs/MEASURED-CLAIMS.md)
- **安装 & 后端形态** → [MVP 安装指南](docs/current/java-backend-mvp-install-guide.md)
- **贡献者** → [CONTRIBUTING](CONTRIBUTING.md) · [ROADMAP](ROADMAP.md) · [CODE_OF_CONDUCT](CODE_OF_CONDUCT.md)
- **发布 & 测量** → [v0.6.0 胶囊](docs/releases/v0.6.0/README.md) · [包索引](docs/releases/package-index.md) · [docs/current](docs/current/README.md) · [Changelog](CHANGELOG.md)

## 贡献

欢迎贡献 —— 包括负面的测量结果。PH 只主张有证据支撑的东西，扩大主张的 PR 必须附带相应的测量。请从 [CONTRIBUTING.md](CONTRIBUTING.md) 开始。

## 许可证

Apache-2.0。见 [LICENSE](LICENSE)。
