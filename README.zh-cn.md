# Persona Harness

面向 OpenCode 的 Java/Spring backend Clean Code workflow pilot.

[English](README.md) | [한국어](README.ko.md) | [日本語](README.ja.md) | [简体中文](README.zh-cn.md)

Persona Harness 帮助代理从空项目开始，先收集 backend 背景，生成 architecture plan，再基于计划生成更一致的 Java/Spring 代码结构。

> 当前范围: Java/Spring backend MVP.
> frontend、infra、desktop app、AST/linter enforcement、完整 TDD workflow 都是后续方向。

## 快速开始

npm alpha publish 之后:

```bash
npm install -D persona-harness@alpha
npx ph init
npx ph intake --interactive
npx ph policy init
npx ph plan
```

public publish 之前的本地流程:

```bash
npm install -D /absolute/path/to/persona-harness
npx ph init
npx ph intake --interactive
npx ph policy init
npx ph plan
```

先让 OpenCode 只完成计划:

```bash
opencode run --dir . --model <model> --dangerously-skip-permissions \
  "请阅读 README.md, .persona/project-profile.jsonc, .persona/policies, .persona/workflow/plan.md，不要实现代码，只完成 architecture/technology plan。"
```

计划足够清楚后接受它:

```bash
npx ph plan --status
npx ph plan --accept
```

然后让 OpenCode 实现:

```bash
opencode run --dir . --model <model> --dangerously-skip-permissions \
  "请阅读 README.md, .persona/project-profile.jsonc, .persona/policies, .persona/workflow/plan.md，确认 plan 是 accepted 状态，然后基于 Java/Spring Gradle 实现全部需求。实现后运行 gradle test, gradle build, gradle bootRun, HTTP happy path 和 failure path smoke，并填写 .persona/workflow/implementation-report.md 与 .persona/workflow/review-report.md。"
```

## 提供内容

- `ph init`: 安装 `.persona/rules`, `.persona/harness.jsonc`, OpenCode plugin config
- `ph intake --interactive`: 询问 backend planning 问题并写入 `.persona/project-profile.jsonc`
- `ph policy init`: 创建 company/personal backend policy overlay
- `ph plan`: 创建 `blackbear` planning role 的 `.persona/workflow/plan.md`
- `ph bearshell`: bounded shell command helper
- `ph history`: 将使用过的 workflow artifact 保存到 `.persona/workflow/history/`
- OpenCode injection: 当代理读取相关文件时注入 Java/Spring backend Clean Code context

## 鼓励的代码结构

- Gradle-first Java/Spring backend
- `presentation`, `application`, `domain`, `infrastructure`, `global` 边界
- Controller 委托给 Service
- Application Service 只编排 use case，不直接持有 storage state 或 id sequence
- Domain 不是 passive record，而是用自己的字段进行判断和行为
- Repository interface 在 domain，具体实现放在 infrastructure
- 明确 request/response DTO boundary

## 不承诺

- 生成 app 的 product quality 认证
- AST/linter/build failure 级别的 rule enforcement
- 测试充分性证明
- frontend, infra, desktop workflow productization
- 最终 TDD workflow

## Docs

- [Changelog](CHANGELOG.md)
- [Release checklist](docs/current/release/release-checklist.md)
- [Release notes template](docs/current/release/release-notes-template.md)
- [Detailed usage notes](docs/current/persona-harness-detailed-usage.md)
- [Alpha publish readiness](docs/current/v0.3.0-alpha-publish-readiness.md)
- [External tester guide](docs/current/v0.3.0-external-tester-guide.md)
- [Java backend MVP install guide](docs/current/java-backend-mvp-install-guide.md)

## License

Apache-2.0. See [LICENSE](LICENSE).
