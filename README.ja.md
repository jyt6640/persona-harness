# Persona Harness

OpenCode 向け AI coding workflow rail + evidence + continuation harness.

[English](README.md) | [한국어](README.ko.md) | [日本語](README.ja.md) | [简体中文](README.zh-cn.md)

Persona Harness は、エージェントが空のプロジェクトから始め、backend の前提を読み、実装 rail を辿り、何を読んだか・何が注入されたか・どの workflow command を実行したかを記録し、未完了 ticket を継続してから完了を報告するための harness です。

生成された app の product quality は認証しません。現在の Java/Spring backend guidance は stack steering と workflow observability のための surface であり、Clean Code 保証、AST/linter、enforcement engine ではありません。

> 現在の範囲: Java/Spring backend workflow rail MVP.
> frontend、infra、desktop app、AST/linter enforcement、完全な TDD workflow は今後の対象です。
>
> 現在の source/package 候補: `0.3.9-alpha.3`

## 必要条件

- Node.js 20+
- npm
- OpenCode terminal CLI
- OpenCode に設定済みの model/provider

## クイックスタート

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
npx ph bootstrap backend
```

Persona Harness 自体を開発する場合は local install を使います。

```bash
npm install -D /absolute/path/to/persona-harness
npx ph init
npx ph bootstrap backend
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

README がまだなく、アイデアだけがある場合は、先に requirements draft を作ります。

```text
TODO Web サービスを作りたい
```

この場合、エージェントはすぐ実装せず、次を実行します。

```text
npx ph workflow draft --stdin
```

生成される draft:

- `.persona/workflow/requirements/backlog.md`
- `.persona/workflow/requirements/questions.md`
- `.persona/workflow/requirements/assumptions.md`

内容を確認し、よければ `進めてください` と伝えます。その後、エージェントは次を実行します。

```text
npx ph workflow approve requirements
npx ph workflow split .persona/workflow/requirements/backlog.md
npx ph workflow next
npx ph workflow implement
```

README が既にある場合は、通常の実装依頼を使います。

```bash
opencode run --dir . --model <model> --dangerously-skip-permissions \
  "README.md, .persona/project-profile.jsonc, .persona/policies, .persona/workflow/plan.mdを読み、plan が accepted であることを確認してから Java/Spring Gradle ベースで要求全体を実装してください。コマンド実行は可能なら npx ph bearshell を使い、実装後に npx ph bearshell gradle test, npx ph bearshell gradle build, 実行可能な Spring Boot app なら npx ph bearshell --shell 'gradle bootRun --args=\"--server.port=<port>\"', HTTP happy path と failure path smoke を実行してください。.persona/workflow/implementation-report.md と .persona/workflow/review-report.md を記入し、npx ph plan --report-filled implementation と npx ph plan --report-filled review を実行してください。"
```

## 提供するもの

- `ph init`: `.persona/rules`, `.persona/harness.jsonc`, OpenCode plugin config を作成
- `ph bootstrap backend`: `AGENTS.md`, backend profile, policy overlay, accepted plan, report template を準備
- `ph intake --interactive`: backend planning 質問を行い `.persona/project-profile.jsonc` を作成
- `ph policy init`: company/personal backend policy overlay を作成
- `ph plan`: `blackbear` planning role 用 `.persona/workflow/plan.md` を作成
- `ph workflow draft --stdin`: vague product idea から requirements draft を作成し、review で止める
- `ph workflow approve requirements`: review 済み draft を accepted にする
- `ph workflow split [source.md]`: requirements source を ticket/backlog に分割
- `ph workflow next`: 次の pending ticket を表示
- `ph bearshell`: bounded shell command helper
- `ph history`: 使用済み workflow artifact を `.persona/workflow/history/` に保存
- OpenCode injection: 関連ファイルを読むと Java/Spring backend workflow/guidance context を注入

## Evidence の意味

`.persona/evidence` は file read、注入された workflow/rule context、選択された rail、target file role、workflow command activity などの実行痕跡です。これは「agent が意図した rail を見て従ったか」を確認するための記録であり、品質スコアでも品質向上の証明でもありません。

## 推奨するコード構造

- Gradle-first Java/Spring backend
- `presentation`, `application`, `domain`, `infrastructure`, `global` の境界
- Controller は Service に委譲
- Application Service は use case の流れを扱い、storage state や id sequence を直接保持しない
- Domain は passive record ではなく、自身のフィールドで判断と振る舞いを持つ
- Repository interface は domain、実装は infrastructure
- Request/response DTO boundary を明確にする

これらは steering target と review cue です。生成された app が正しい、保守しやすい、安全、production-ready であることは証明しません。

## A/B と ON/OFF smoke の限界

既存の A/B または ON/OFF smoke 結果は stack steering signal として扱います。多くは小さい sample、場合によっては `n=1`、non-blind、same operator であり、model/version/prompt/timeout/continuation behavior に依存するため、product quality の証明ではありません。

## 保証しないこと

- 生成された app の product quality 認証
- AST/linter/build failure による rule enforcement
- Clean Code 品質保証
- evidence count を品質向上として扱う主張
- test sufficiency の証明
- frontend, infra, desktop workflow の productization
- 最終的な TDD workflow
- OpenCode なしの独立 agent workflow

## ドキュメント

- [Changelog](CHANGELOG.md)
- [Release checklist](docs/current/release/release-checklist.md)
- [Release notes template](docs/current/release/release-notes-template.md)
- [Detailed usage notes](docs/current/persona-harness-detailed-usage.md)
- [Alpha publish readiness](docs/current/v0.3.0-alpha-publish-readiness.md)
- [External tester guide](docs/current/v0.3.0-external-tester-guide.md)
- [Java backend MVP install guide](docs/current/java-backend-mvp-install-guide.md)

## ライセンス

Apache-2.0. See [LICENSE](LICENSE).
