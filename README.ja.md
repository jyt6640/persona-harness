<!-- <CENTERED SECTION FOR GITHUB DISPLAY> -->

<div align="center">

# Persona Harness

**Java/Spring バックエンドを作る AI コーディングエージェントのための完了ゲート。**

[![npm version](https://img.shields.io/npm/v/persona-harness?color=369eff&labelColor=black&style=flat-square)](https://www.npmjs.com/package/persona-harness)
[![npm downloads](https://img.shields.io/npm/dt/persona-harness?color=ff6b35&labelColor=black&style=flat-square)](https://www.npmjs.com/package/persona-harness)
[![node](https://img.shields.io/badge/node-%3E%3D20-c4f042?labelColor=black&style=flat-square)](https://nodejs.org)
[![License](https://img.shields.io/badge/license-Apache--2.0-white?labelColor=black&style=flat-square)](./LICENSE)

[English](README.md) | [한국어](README.ko.md) | [日本語](README.ja.md) | [简体中文](README.zh-cn.md)

</div>

<!-- </CENTERED SECTION FOR GITHUB DISPLAY> -->

> AI エージェントは「完了しました！」と言いたがります — Persona Harness はそれを証明させます。必要な report、PH が生成した evidence、実際のテスト結果がディスク上に存在するまで完了主張をブロックする、ローカル CLI + OpenCode workflow rail です。

> [!IMPORTANT]
> **プロジェクト状態: alpha experiment。**
> 注入（injection）効果は測定済みで、**証明されていません**。ON/OFF eval プログラムは停止中です。凍結された集計と停止理由は [`docs/current/injection-value-status.json`](docs/current/injection-value-status.json) を参照してください。
> PH が実際に主張すること — そして証拠を持つこと — はより狭い範囲です: **明示的に定義された evidence gate と決定論的違反に対して、未検証の完了をブロックする。**

## 測定された動作

多くのエージェントハーネスプロジェクトと異なり、PH は実際に測定したものを — ネガティブな結果も含めて — 公開します。

| シナリオ | 結果 | 根拠 |
| :--- | :--- | :--- |
| **偽造された TDD evidence** — 手書きの `red-forged.json` を `workflow finish` の前に仕込む | `finish` が **exit 1** — 偽造ファイルは無視 | P0 実 Gradle run アーカイブ |
| **Green-only 完了**（テスト+実装を同時、red-first なし）— 各 5 回反復 | TDD OFF: 許可 **5/5** · TDD ON: ブロック **5/5** | P1 completion-integrity A/B |
| **コンパイルエラーを「red」と偽る** | `workflow test` が **exit 1**、evidence 未生成 | P0 実 Gradle run アーカイブ |
| 注入レイヤーのトークン/品質効果 | **未証明** — そのまま報告 | 凍結された eval status |

これは限定されたローカル fixture での completion-integrity 測定です。トークン節約、アプリ品質、プロダクト効能の主張では*ありません*。

## TL;DR

> Q. これは何？

AI エージェントが行う Java/Spring バックエンド作業のための workflow rail + evidence システム + 完了ガードです。ローカル CLI（`ph`）と OpenCode プラグインとして提供されます。

> Q. 実際に何をする？

- プロジェクトのアイデアや README を実装 ticket に分割
- エージェントを反復可能なバックエンド workflow に乗せ続ける
- 制限されたコマンド実行で検証を行う
- 何を読み、実行し、完了したかをローカル evidence として記録
- **必要な report/evidence がなければ完了をブロック**

> Q. コード品質保証、トークン節約、linter の代替になる？

いいえ。コード品質保証、トークン節約プロダクト、broad linter、生成アプリが production-ready である証明ではありません。完了ゲートより広いすべての主張は、先に測定によって獲得しなければならない — このルール自体がプロジェクトの一部です。

## インストール

必要なもの:

- Node.js 20+, npm
- Java 21+, Gradle
- モデル/プロバイダーが設定済みの OpenCode CLI

```bash
# OpenCode
curl -fsSL https://opencode.ai/install | bash   # または: npm install -g opencode-ai
opencode auth login

# Persona Harness (preview チャンネル)
npm install -D persona-harness@next
npx ph --help
npx ph init
npx ph doctor
```

以前の stable パッケージが必要な場合は `persona-harness@latest` を使ってください。

## クイックスタート — Java/Spring バックエンド

クリーンなプロジェクトディレクトリを使ってください。Persona Harness リポジトリ自体で最初のスモークテストをしないでください。

```bash
mkdir -p /tmp/persona-harness-demo && cd /tmp/persona-harness-demo
npm init -y
npm install -D persona-harness@next
```

アプリと制約を記述した短い `README.md` を作成します:

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

初期化:

```bash
npx ph init
npx ph bootstrap backend
npx ph workflow check
```

`ph init` は最小限の統合ファイルのみを作成します（`.persona/harness.jsonc`、`.persona/conventions/`、`.persona/rules/`、`.opencode/opencode.json`、`.gitignore` エントリ）。`ph bootstrap backend` はバックエンド workflow 全体を準備します: `AGENTS.md`、`.persona/project-profile.jsonc`、policy overlay、承認済み plan、report テンプレート、OpenCode 設定。

その後、OpenCode でエージェントに短く依頼します:

```text
Read README.md and implement it.
```

エージェントは自分で rail を実行するはずです:

```text
npx ph workflow implement
npx ph bearshell ...
npx ph plan --report-filled implementation
npx ph plan --report-filled review
npx ph workflow finish implement
```

> [!NOTE]
> `workflow finish` が失敗した場合、エージェントは完了を主張する前に報告された blocker を修正しなければなりません。その失敗はバグではなく、プロダクトが機能している証拠です。

## README の代わりにアイデアから始める

エージェントにアイデアを伝えます:

```text
todo ウェブサービスを作りたい。
```

エージェントはコーディングを始めず、まず要件のドラフトを作るはずです:

```text
npx ph workflow draft --stdin
```

`.persona/workflow/requirements/` の成果物（`backlog.md`、`questions.md`、`assumptions.md`）をレビューし、`進めて。`と伝えると、エージェントが実行します:

```text
npx ph workflow approve requirements
npx ph workflow split .persona/workflow/requirements/backlog.md
npx ph workflow next
npx ph workflow implement
```

## 複数の Ticket で作業する

```bash
npx ph workflow split README.md
npx ph workflow next
# ... 実装 & レビュー ...
npx ph workflow archive <ticket-id>
npx ph workflow next
```

workflow 台帳は `.persona/workflow/` にあります: 進行中の作業は `work/`、完了履歴は `history/`、要件ソースは `requirements/`。

## TDD Rail (opt-in)

両方の設定を有効にすると動作します:

```json
{
  "enforce": {
    "executeVerification": true,
    "tdd": true
  }
}
```

有効時、`ph workflow test` は **PH が直接実行した Gradle/JUnit の失敗からのみ** red evidence を記録します — エージェントが報告した evidence は決して受け付けません。その後 `workflow check` / `archive` / `finish` が同じ ticket/test id に対する green evidence を記録します。

これは red-first 完了ゲートです。テスト scaffolding、テスト十分性の証明、coverage、mutation testing、アプリ品質の認証は行いません。

## 便利なコマンド

```bash
# セットアップ
npx ph init && npx ph bootstrap backend && npx ph doctor

# Workflow
npx ph workflow check
npx ph workflow implement
npx ph workflow finish implement
npx ph workflow archive <ticket-id>

# 制限されたコマンド実行
npx ph bearshell --shell 'gradle test'

# Evidence と report
npx ph evidence summary
npx ph evidence metrics --json
npx ph evidence ab-report --json
npx ph evidence pminus-report --json
npx ph review backend-shape

# 明示的なローカル A/B evidence 記録
npx ph evidence ab-run --scenario demo --condition baseline -- ./gradlew test
```

Preview/local-current ビルドには `npx ph evidence pminus-status --json` が追加で含まれる場合があります。

## オプション統合

デフォルトの backend bootstrap はリモート developer MCP ツール `grep_app` と `context7` を登録します。

```bash
npx ph bootstrap backend --codegraph-preview   # CodeGraph, opt-in
npx ph bootstrap backend --lsp-preview         # LSP, opt-in
npx ph bootstrap backend --no-developer-mcp    # developer MCP を無効化
```

> [!NOTE]
> 両方の wrapper は preview 表面です。必要な外部ツールがない場合、成功を偽装せず **unavailable** 状態を報告します。

## Evidence の意味

`.persona/evidence` はローカルの痕跡を保存します: ファイル読み取り、注入された workflow コンテキスト、コマンド活動、TDD 記録、A/B 測定。

Evidence は一つの質問に答えます: **「エージェントは期待された rail を見て従ったか？」**

Evidence が証明**しない**もの: 生成アプリの品質、トークン節約、プロダクト効能、full TDD coverage、broad reliability、すべてのケースでの成功的な closure。

## 推奨バックエンド形状

Persona Harness は Java/Spring プロジェクトを次の方向に導きます:

- Gradle-first の Java/Spring バックエンド
- `presentation` / `application` / `domain` / `infrastructure` / `global` パッケージ境界
- Controller は application service に委譲
- Application service は storage 状態や id sequence を直接所有せずユースケースを調整
- Repository インターフェースは `domain` に、実装は `infrastructure` に
- 振る舞いを持つドメインオブジェクト
- 明示的な request/response DTO 境界

これらは誘導目標とレビューの手がかりであり、品質保証ではありません。

## トラブルシューティング

```bash
npm view persona-harness dist-tags --json
opencode --version
```

`ph workflow check` が警告を報告したら、列挙された blocker を確認してください。実装前は template report の警告が正常です。実装後によくある blocker は、evidence の欠落、未記入の report、rail を迂回した検証です。

エージェントが workflow を無視する場合、より厳格なプロンプトを貼り付けてください:

```text
Read README.md, .persona/project-profile.jsonc, .persona/policies, and .persona/workflow/plan.md.
Before implementing, run `npx ph workflow implement`.
Use `npx ph bearshell` for verification commands where possible.
After implementation, fill `.persona/workflow/implementation-report.md` and `.persona/workflow/review-report.md`.
Run `npx ph plan --report-filled implementation`, `npx ph plan --report-filled review`, and `npx ph workflow finish implement`.
If finish fails, do not claim completion. Fix the reported blocker first.
```

## Persona Harness が約束しないもの

- 生成アプリケーションの品質認証
- トークン節約
- プロダクト効能や navigation-benefit の証明
- Clean Code の保証
- broad AST/linter の強制
- full TDD フレームワーク、テスト scaffolding、coverage、mutation testing
- frontend、infrastructure、desktop workflow のプロダクト化
- OpenCode なしの完全な workflow

> [!WARNING]
> `ph bearshell` はサンドボックスではありません。実行時間と出力サイズを制限しますが、コマンドはあなたのマシン上で実行されます。

## ドキュメント

- [Changelog](CHANGELOG.md)
- [Release notes](docs/current/release/README.md)
- [受け入れテストチェックリスト](docs/current/acceptance-test-checklist.md)
- [Java backend MVP インストールガイド](docs/current/java-backend-mvp-install-guide.md)

## ライセンス

Apache-2.0。[LICENSE](LICENSE) を参照してください。
