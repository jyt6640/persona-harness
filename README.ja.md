<!-- <CENTERED SECTION FOR GITHUB DISPLAY> -->

<div align="center">

<img src="img/Persona-Harness-Logo.png" alt="Persona Harness ロゴ" width="180">

# Persona Harness

**Java/Spring バックエンドを作る AI コーディングエージェントのための完了ゲート。**

[![npm version](https://img.shields.io/npm/v/persona-harness?color=369eff&labelColor=black&style=flat-square)](https://www.npmjs.com/package/persona-harness)
[![npm downloads](https://img.shields.io/npm/dt/persona-harness?color=ff6b35&labelColor=black&style=flat-square)](https://www.npmjs.com/package/persona-harness)
[![node](https://img.shields.io/badge/node-%3E%3D20-c4f042?labelColor=black&style=flat-square)](https://nodejs.org)
[![License](https://img.shields.io/badge/license-Apache--2.0-white?labelColor=black&style=flat-square)](./LICENSE)

[English](README.md) | [한국어](README.ko.md) | [日本語](README.ja.md) | [简体中文](README.zh-cn.md)

**[Start Here](docs/START-HERE.md) · [Quick Demo](docs/QUICK-DEMO.md) · [Measured Claims](docs/MEASURED-CLAIMS.md)**

</div>

<!-- </CENTERED SECTION FOR GITHUB DISPLAY> -->

> AI エージェントは「完了しました！」と言いたがります — Persona Harness はそれを証明させます。必要な report、PH が生成した evidence、実際のテスト結果がディスク上に存在するまで完了主張をブロックするローカル CLI 完了ゲートです。

> [!IMPORTANT]
> **Alpha, gate-first, 測定ベース。** Stable: `persona-harness@latest=0.6.0`（`next=0.6.0-rc.4`）。runtime injection は accepted 10-pair fixture で **negative** と測定されたため、runtime guidance は **default-off / opt-in** であり、プロダクトの中心ではありません。[`injection-value-status.json`](docs/current/injection-value-status.json) を参照。PH の主張は狭い範囲です: **明示的に定義された evidence gate と決定論的違反に対して、未検証の完了をブロックする。**

## 測定された動作 (Measured Behavior)

多くのエージェントハーネスプロジェクトと異なり、PH は実際に測定したものを — ネガティブな結果も含めて — 公開します。

- **偽造された TDD evidence** を `workflow finish` の前に仕込む → `finish` が **exit 1**、偽造ファイルは無視。
- **Green-only 完了**（TDD rail on）→ ブロック **5/5**（off では許可 5/5）。
- **runtime injection**、10 ペアの OpenCode run → 成功率は同じ（両方 10/10）だが PH ON は全 10 ペアでコスト増 → **default-off** を維持。

限定されたローカル fixture での completion-integrity 測定です — トークン節約・アプリ品質・プロダクト効能の主張では*ありません*。完全な境界と根拠: **[docs/MEASURED-CLAIMS.md](docs/MEASURED-CLAIMS.md)**。

## これは何か

AI エージェントが行う Java/Spring バックエンド作業のための workflow + evidence CLI（`ph`）と、任意の OpenCode プラグインです。行うこと:

- プロジェクトのアイデアや README を実装 ticket に分割
- エージェントを反復可能なバックエンド workflow に乗せ続ける
- 制限されたコマンド実行で検証
- 何を読み、実行し、完了したかをローカル evidence として記録
- **必要な report/evidence がなければ完了をブロック**

コード品質保証、トークン節約プロダクト、broad linter、生成アプリが production-ready である証明では**ありません**。完了ゲートより広いすべての主張は、先に測定によって獲得しなければなりません — [MEASURED-CLAIMS](docs/MEASURED-CLAIMS.md) を参照。

## インストール

Node.js 20+、Java 21+ / Gradle、そしてプロバイダーが設定済みの OpenCode CLI が必要です。

```bash
# OpenCode
curl -fsSL https://opencode.ai/install | bash   # または: npm install -g opencode-ai
opencode auth login

# Persona Harness
npm install -D persona-harness
npx ph --help && npx ph doctor
```

## クイックスタート

クリーンなプロジェクトディレクトリでは、次の経路を使ってください（Persona Harness repo 自体は不可）。

```bash
mkdir -p /tmp/ph-demo && cd /tmp/ph-demo && npm init -y
npm install -D persona-harness

npx ph init                 # 最小限の統合ファイルのみ
npx ph bootstrap backend    # AGENTS.md, profile, plan, report テンプレート
npx ph workflow check
```

既存の Java/Spring/Gradle プロジェクトでは、まず推論された draft を確認してから
明示的に受け入れます。

```bash
npx ph attach
npx ph attach --yes

# 認識済みの弱い Persona Harness インストールにのみ使用し、ready なものには使用しない:
npx ph attach --repair --yes
```

`attach` は、認識できない、または壊れた既存 Persona Harness ファイルを上書きせず
拒否し、すでに ready なインストールに対する repair も拒否します。attach が成功すると
PH-run verification を有効にしますが、`runtimeInjection`、`systemConstitution`、
`idleContinuation`、Ralph loop は off のままです。

その後、OpenCode でエージェントにあなたの `README.md` を実装するよう依頼します。エージェントは自分で rail を回し、`npx ph workflow finish implement` で終えるはずです。

> [!NOTE]
> `workflow finish` が失敗した場合、エージェントは完了を主張する前に報告された blocker を修正しなければなりません。**その失敗はバグではなく、プロダクトが機能している証拠です。**

サンプル Todo API とアイデア優先フローを含む完全なガイド: **[Quick Demo](docs/QUICK-DEMO.md)**。

## TDD Rail (opt-in)

`.persona/harness.jsonc` で両方の設定を有効にします:

```json
{ "enforce": { "executeVerification": true, "tdd": true } }
```

すると `ph workflow test` は **PH が直接実行した Gradle/JUnit の失敗からのみ** red evidence を記録します — エージェントが報告した evidence は決して受け付けません。その後 `workflow check` / `archive` / `finish` が同じ ticket/test id の green evidence を記録します。red-first 完了ゲートであり、テスト scaffolding・十分性の証明・coverage/mutation・アプリ品質の認証は行いません。

## コマンド

```bash
npx ph attach [--yes]                                  # 既存 Java/Spring/Gradle プロジェクト
npx ph workflow check | implement | finish implement | archive <ticket-id>
npx ph workflow split README.md && npx ph workflow next   # マルチ ticket
npx ph bearshell --shell 'gradle test'                    # 制限された実行
npx ph evidence summary | metrics --json | ab-report --json | pminus-report --json
npx ph review backend-shape
```

全リストは `npx ph --help`。workflow 台帳は `.persona/workflow/`（`work/`, `history/`, `requirements/`）にあります。

## オプション統合 (opt-in preview)

```bash
npx ph bootstrap backend --codegraph-preview          # CodeGraph
npx ph bootstrap backend --lsp-preview                # Java LSP
npx ph bootstrap backend --runtime-injection-preview  # parked model-facing guidance
npx ph bootstrap backend --no-developer-mcp           # 既定の developer MCP を無効化
```

preview wrapper は外部ツールがない場合、成功を偽装せず **unavailable** 状態を報告します。runtime injection は parked（negative 測定）であり、推奨パスではありません。

## 境界と安全

Evidence は一つの質問にのみ答えます — *「エージェントは期待された rail を見て従ったか？」* — それ以上ではありません。PH はアプリ品質認証、トークン節約、Clean Code 保証、broad AST/linter 強制、full TDD フレームワーク、closure 保証、OpenCode なしの完全な workflow を**約束しません**。正規のリストは [MEASURED-CLAIMS](docs/MEASURED-CLAIMS.md) にあります。

> [!WARNING]
> `ph bearshell` は**サンドボックスではありません**。実行時間と出力サイズを制限しますが、コマンドはあなたのマシン上であなたの権限で実行されます。[SECURITY](SECURITY.md) を参照。

## ドキュメント

- **新規ユーザー** → [Start Here](docs/START-HERE.md) · [Quick Demo](docs/QUICK-DEMO.md) · [Measured Claims](docs/MEASURED-CLAIMS.md)
- **インストール & バックエンド形状** → [MVP インストールガイド](docs/current/java-backend-mvp-install-guide.md)
- **コントリビューター** → [CONTRIBUTING](CONTRIBUTING.md) · [ROADMAP](ROADMAP.md) · [CODE_OF_CONDUCT](CODE_OF_CONDUCT.md)
- **リリース & 測定** → [v0.6.0 カプセル](docs/releases/v0.6.0/README.md) · [パッケージインデックス](docs/releases/package-index.md) · [docs/current](docs/current/README.md) · [Changelog](CHANGELOG.md)

## コントリビュート

コントリビュートを歓迎します — ネガティブな測定結果も含めて。PH は証拠が裏付けるものだけを主張し、主張を広げる PR はその測定を伴わなければなりません。[CONTRIBUTING.md](CONTRIBUTING.md) から読んでください。

## ライセンス

Apache-2.0。[LICENSE](LICENSE) を参照してください。
