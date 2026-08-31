<!-- <CENTERED SECTION FOR GITHUB DISPLAY> -->

<div align="center">

<img src="../../img/Persona-Harness-Logo.png" alt="Persona Harness ロゴ" width="180">

# Persona Harness

**Java/Spring バックエンドを作る AI コーディングエージェントのための完了ゲート。**

[![npm version](https://img.shields.io/npm/v/persona-harness?color=369eff&labelColor=black&style=flat-square)](https://www.npmjs.com/package/persona-harness)
[![npm downloads](https://img.shields.io/npm/dt/persona-harness?color=ff6b35&labelColor=black&style=flat-square)](https://www.npmjs.com/package/persona-harness)
[![node](https://img.shields.io/badge/node-%5E20.17.0%20%7C%7C%20%3E%3D22.9.0-c4f042?labelColor=black&style=flat-square)](https://nodejs.org)
[![License](https://img.shields.io/badge/license-Apache--2.0-white?labelColor=black&style=flat-square)](../../LICENSE)

[English](https://github.com/jyt6640/persona-harness/blob/main/README.md) | [한국어](https://github.com/jyt6640/persona-harness/blob/main/docs/current/README.ko.md) | [日本語](https://github.com/jyt6640/persona-harness/blob/main/docs/current/README.ja.md) | [简体中文](https://github.com/jyt6640/persona-harness/blob/main/docs/current/README.zh-cn.md)

**[Start Here](../START-HERE.md) · [Quick Demo](../QUICK-DEMO.md) · [Measured Claims](../MEASURED-CLAIMS.md)**

</div>

<!-- </CENTERED SECTION FOR GITHUB DISPLAY> -->

> AI エージェントは「完了しました！」と言いたがります — Persona Harness はそれを証明させます。必要な report、PH が生成した evidence、実際のテスト結果がディスク上に存在するまで完了主張をブロックするローカル CLI 完了ゲートです。

> [!IMPORTANT]
> **Alpha, gate-first, 測定ベース。** ライブの registry チャネル、タグ、GitHub リリース、audit lifecycle の事実は governed registry と audit record に保持されます。source documentation は自身の preparation boundary だけを記録します。runtime injection は **default-off / opt-in** です。[`docs/current/p3-integrity-roadmap.md`](p3-integrity-roadmap.md)、[`docs/MEASURED-CLAIMS.md`](../MEASURED-CLAIMS.md)、[`injection-value-status.json`](injection-value-status.json) を参照してください。

## 測定された動作 (Measured Behavior)

多くのエージェントハーネスプロジェクトと異なり、PH は実際に測定したものを — ネガティブな結果も含めて — 公開します。

- **偽造された TDD evidence** を `workflow finish` の前に仕込む → `finish` が **exit 1**、偽造ファイルは無視。
- **Green-only 完了**（TDD rail on）→ ブロック **5/5**（off では許可 5/5）。
- **runtime injection**、10 ペアの OpenCode run → 成功率は同じ（両方 10/10）だが PH ON は全 10 ペアでコスト増 → **default-off** を維持。

限定されたローカル fixture での completion-integrity 測定です — トークン節約・アプリ品質・プロダクト効能の主張では*ありません*。完全な境界と根拠: **[docs/MEASURED-CLAIMS.md](../MEASURED-CLAIMS.md)**。

## これは何か

AI エージェントが行う Java/Spring バックエンド作業のための workflow + evidence CLI（`ph`）、
および Codex、Claude Code、OpenCode、Antigravity 向けの portable shared-skill adapter です。
OpenCode プラグインは任意の runtime 境界です。行うこと:

- プロジェクトのアイデアや README を実装 ticket に分割
- エージェントを反復可能なバックエンド workflow に乗せ続ける
- 制限されたコマンド実行で検証
- 何を読み、実行し、完了したかをローカル evidence として記録
- **必要な report/evidence がなければ完了をブロック**

コード品質保証、トークン節約プロダクト、broad linter、生成アプリが production-ready である証明では**ありません**。完了ゲートより広いすべての主張は、先に測定によって獲得しなければなりません — [MEASURED-CLAIMS](../MEASURED-CLAIMS.md) を参照。

## インストール

Node.js ^20.17.0 || >=22.9.0（Node 21 は未対応）が必要です。Java/Spring
workflow rail には Java 21+ / Gradle が必要です。利用する coding-agent host は別途
インストールしてください。OpenCode は plugin-only Context delivery が必要な場合だけ
任意です。

```bash
# 対応 host のプロジェクトで
npm install -D persona-harness
npx ph init
npx ph doctor
```

`ph init` は host ごとの discovery ファイルを作成し、Persona 専用の起動コマンドは
追加しません。生成パスと安全な更新方法は [Portable Host
Adapters](portable-host-adapters.md) を参照してください。

## クイックスタート

クリーンなプロジェクトディレクトリでは、次の経路を使ってください（Persona Harness repo 自体は不可）。

```bash
mkdir -p /tmp/ph-demo && cd /tmp/ph-demo && npm init -y
npm install -D persona-harness

npx ph init                 # 最小限の統合ファイルのみ
npx ph bootstrap backend    # AGENTS.md, profile, plan, report テンプレート
npx ph workflow check
```

`ph init` は `.agents/skills`、`.claude/skills`、`.opencode/skills` にも
manifest-owned shared-skill adapter を作成します。これらは host が catalog を
発見できるようにするだけで、実行中の session が skill を選択したことや workflow
authority を得たことを示しません。

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

その後、使う coding-agent host でエージェントにあなたの `README.md` を実装するよう
依頼します。エージェントは自分で rail を回し、`npx ph workflow finish implement` で
終えるはずです。host-native skill の選択と実際の delivery は別の host evidence です。

> [!NOTE]
> `workflow finish` が失敗した場合、エージェントは完了を主張する前に報告された blocker を修正しなければなりません。**その失敗はバグではなく、プロダクトが機能している証拠です。**

サンプル Todo API とアイデア優先フローを含む完全なガイド: **[Quick Demo](../QUICK-DEMO.md)**。

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

## プラットフォームとホストのサポート

### Portable host adapter

`ph init` は同じ Persona shared-skill catalog を各 host の project-local discovery
パスに regular file として作成します。これはインストール済み package が static
adapter を作成した根拠であり、実際の session が skill を選択、load、または従った
根拠ではありません。

| Host | 生成パス |
| --- | --- |
| Codex と Antigravity | `.agents/skills/persona-harness-<skill-id>/SKILL.md` |
| Claude Code | `.claude/skills/persona-harness-claude-<skill-id>/SKILL.md` |
| OpenCode | `.opencode/skills/persona-harness-opencode-<skill-id>/SKILL.md` |

Context と legacy runtime injection は default-off です。Context delivery は依然として
任意の OpenCode adapter の別 runtime 境界です。adapter の所有権、衝突、更新は
[Portable Host Adapters](portable-host-adapters.md) を参照してください。

| CLI/runtime サーフェス | 状態 | 根拠の範囲 |
| --- | --- | --- |
| macOS / Linux CLI/package | 限定的に検証済み | host の live delivery とは別に CLI/package の範囲を確認します。 |
| Windows | 未検証 | Windows のサポートを主張しません。ロック identity の device/inode 動作と stale-lock/concurrency に関する結論は、測定も検証もされていません。 |

## 境界と安全

Evidence は一つの質問にのみ答えます — *「エージェントは期待された rail を見て従ったか？」* — それ以上ではありません。PH はアプリ品質認証、トークン節約、Clean Code 保証、broad AST/linter 強制、full TDD フレームワーク、closure 保証、すべての host で実証された live workflow route を**約束しません**。正規のリストは [MEASURED-CLAIMS](../MEASURED-CLAIMS.md) にあります。

> [!WARNING]
> `ph bearshell` は**サンドボックスではありません**。実行時間と出力サイズを制限しますが、コマンドはあなたのマシン上であなたの権限で実行されます。[SECURITY](../../SECURITY.md) を参照。

## ドキュメント

- **新規ユーザー** → [Start Here](../START-HERE.md) · [Quick Demo](../QUICK-DEMO.md) · [Measured Claims](../MEASURED-CLAIMS.md)
- **Codex · Claude Code · OpenCode · Antigravity** → [Portable Host Adapters](portable-host-adapters.md)
- **インストール & バックエンド形状** → [MVP インストールガイド](java-backend-mvp-install-guide.md)
- **コントリビューター** → [CONTRIBUTING](../../CONTRIBUTING.md) · [ROADMAP](../../ROADMAP.md) · [CODE_OF_CONDUCT](../../CODE_OF_CONDUCT.md)
- **リリース & 測定** → [リリース運用](release/README.md) · [バージョン別リリース文書](../releases/README.md) · [パッケージインデックス](../releases/package-index.md) · [Changelog](../../CHANGELOG.md)

## コントリビュート

コントリビュートを歓迎します — ネガティブな測定結果も含めて。PH は証拠が裏付けるものだけを主張し、主張を広げる PR はその測定を伴わなければなりません。[CONTRIBUTING.md](../../CONTRIBUTING.md) から読んでください。

## ライセンス

Apache-2.0。[LICENSE](../../LICENSE) を参照してください。
