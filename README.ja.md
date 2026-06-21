# Persona Harness

OpenCode 向け Java/Spring backend Clean Code workflow pilot.

[English](README.md) | [한국어](README.ko.md) | [日本語](README.ja.md) | [简体中文](README.zh-cn.md)

Persona Harness は、エージェントが空のプロジェクトから始め、backend の前提を確認し、実装前に architecture plan を残し、一貫した Java/Spring 構造でコードを生成するためのワークフローです。

> 現在の範囲: Java/Spring backend MVP.
> frontend、infra、desktop app、AST/linter enforcement、完全な TDD workflow は今後の対象です。

## Requirements

- Node.js 20+
- npm
- OpenCode terminal CLI
- OpenCode に設定済みの model/provider

## Quick Start

まず OpenCode をインストールします。OpenCode 公式ドキュメントでは install script または npm global install が案内されています。

```bash
curl -fsSL https://opencode.ai/install | bash
```

または:

```bash
npm install -g opencode-ai
```

確認:

```bash
opencode --version
opencode
```

OpenCode に model provider を接続します。

```bash
opencode auth login
opencode auth list
```

または OpenCode TUI で実行します。

```text
/connect
/models
```

Model ID は `provider/model` 形式です。例: `openai/gpt-5.4-mini-fast`.

次に Java/Spring backend project で Persona Harness をインストールします。

```bash
npm install -D persona-harness@alpha
npx ph init
npx ph intake --interactive
npx ph policy init
npx ph plan
```

Persona Harness 自体を開発する場合は local install を使います。

```bash
npm install -D /absolute/path/to/persona-harness
npx ph init
npx ph intake --interactive
npx ph policy init
npx ph plan
```

まず OpenCode に plan だけを作らせます。

```bash
opencode run --dir . --model <model> --dangerously-skip-permissions \
  "$(npx ph plan --prompt)"
```

plan が十分なら accept します。

```bash
npx ph plan --status
npx ph plan --accept
```

その後、実装を依頼します。

```bash
opencode run --dir . --model <model> --dangerously-skip-permissions \
  "README.md, .persona/project-profile.jsonc, .persona/policies, .persona/workflow/plan.mdを読み、plan が accepted であることを確認してから Java/Spring Gradle ベースで要求全体を実装してください。コマンド実行は可能なら npx ph bearshell を使い、実装後に npx ph bearshell gradle test, npx ph bearshell gradle build, 実行可能な Spring Boot app なら npx ph bearshell --shell 'gradle bootRun --args=\"--server.port=<port>\"', HTTP happy path と failure path smoke を実行してください。.persona/workflow/implementation-report.md と .persona/workflow/review-report.md を記入し、npx ph plan --report-filled implementation と npx ph plan --report-filled review を実行してください。"
```

## 提供するもの

- `ph init`: `.persona/rules`, `.persona/harness.jsonc`, OpenCode plugin config を作成
- `ph intake --interactive`: backend planning 質問を行い `.persona/project-profile.jsonc` を作成
- `ph policy init`: company/personal backend policy overlay を作成
- `ph plan`: `blackbear` planning role 用 `.persona/workflow/plan.md` を作成
- `ph bearshell`: bounded shell command helper
- `ph history`: 使用済み workflow artifact を `.persona/workflow/history/` に保存
- OpenCode injection: 関連ファイルを読むと Java/Spring backend Clean Code context を注入

## 推奨するコード構造

- Gradle-first Java/Spring backend
- `presentation`, `application`, `domain`, `infrastructure`, `global` の境界
- Controller は Service に委譲
- Application Service は use case の流れを扱い、storage state や id sequence を直接保持しない
- Domain は passive record ではなく、自身のフィールドで判断と振る舞いを持つ
- Repository interface は domain、実装は infrastructure
- Request/response DTO boundary を明確にする

## 保証しないこと

- 生成された app の product quality 認証
- AST/linter/build failure による rule enforcement
- test sufficiency の証明
- frontend, infra, desktop workflow の productization
- 最終的な TDD workflow
- OpenCode なしの独立 agent workflow

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
