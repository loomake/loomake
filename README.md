# Loomake

要件書・仕様書から AI 駆動で開発するためのツール群。[OpenSpec](https://github.com/Fission-AI/OpenSpec) の上に「要件書からの入口」と「守らせる仕組み」を足す。

Loomake は、品質駆動開発のツール群として、自社プロダクトと OSS（Loomake 自身を含む）の開発に使う方向に進めている。構想や Issue から仕様を起こし、4 値（PASS / FAIL / INSUFFICIENT_EVIDENCE / NOT_APPLICABLE）の判定が通るまで実装を回し、リリースの根拠をリリース記録に残し、使われた結果を次の仕様に戻す。向かう先の全体像は [docs/guide/4.concepts/2.overview.md](docs/guide/4.concepts/2.overview.md)、設計の正本は [要件定義](docs/requirements/loomake-v0.11.md) と [アーキテクチャ](docs/architecture.md) にある。この README に書いた使い方は、いま動く機能のもの。承認状態を持つリリース記録（`role: release`）と 4 値判定は、まだ実装していない。

- 要件書を、出典つきの OpenSpec change に変える（req-to-openspec Skill）
- AI が従う共通ルールを置く（AGENTS.md）
- 未確定の要件が残る間は実装させず、全要件にテストがあることを機械的に確かめる（`loomake verify`）
- 検査の結果を証拠として記録し、要件ごとの検査結果をまとめたリリースレポートを作る（`loomake trace`）
- tasks を AI に実装させ、完了ゲートが通るまで直させて、PR を出す（`loomake run`）

```sh
npx loomake init                                  # AGENTS.md・設定・Skill を置く
npx loomake doctor                                # 導入状態を調べ、足りない設定と直し方を出す
npx loomake verify --change <id> --spec-only      # 仕様ゲート：実装に入ってよいか
npx loomake verify --change <id> --done --scope local # 完了ゲート（ローカル）：要件ごとのテスト・品質コマンド
npx loomake verify --change <id> --done               # 完了ゲート（最終。既定は --scope ci）
npx loomake run --change <id>                     # 実装から PR までを AI に任せる
npx loomake trace record --change <id>            # 証拠を記録する
npx loomake trace report --change <id>            # リリースレポートを出す
```

`npx loomake --help` でコマンドの一覧を、`npx loomake <コマンド> --help` でそれぞれの使い方を表示する。

`loomake` はまだ npm に公開していない。英語の概要は [README.en.md](README.en.md) にある。

## ドキュメント

| 文書 | 読む人 | 中身 |
|---|---|---|
| [docs/guide/1.getting-started/1.quickstart.md](docs/guide/1.getting-started/1.quickstart.md) | 初めて Loomake を使う人 | 導入から 1 つの change を終えるまでと、ほかの道具との連携を 1 ページにまとめたもの |
| [docs/guide/1.getting-started/2.usage.md](docs/guide/1.getting-started/2.usage.md) | Loomake を使う人 | 導入、1 つの change の進め方、verify と設定のリファレンス（図つき） |
| [docs/guide/4.concepts/1.positioning.md](docs/guide/4.concepts/1.positioning.md) | Loomake を使う人・導入を検討する人 | 一般的な開発の流れ（要件定義から運用まで）の中での、Loomake・OpenSpec・AI エージェント・テストランナー・CI の受け持ち |
| [docs/guide/2.guides/1.for-agents.md](docs/guide/2.guides/1.for-agents.md) | Loomake を入れたプロジェクトで働く AI エージェント | 状況ごとの手順、verify が不合格のときの直し方、終了コードと JSON |
| [AGENTS.md](AGENTS.md) | AI エージェント・開発者 | このリポジトリで AI が従うルール |
| [CONTRIBUTING.md](CONTRIBUTING.md) | このリポジトリに貢献する人 | 開発の環境、change の作り方、PR の出し方 |
| [SECURITY.md](SECURITY.md) | 脆弱性を見つけた人 | 脆弱性の報告のしかたと、`loomake run` を使うときの注意 |
| [docs/flow.md](docs/flow.md) | このリポジトリを開発する人 | Loomake を Loomake で作る流れ |
| [docs/architecture.md](docs/architecture.md) | このリポジトリを開発する人 | 全体の構成、名前、作る順番 |
| [docs/guide/4.concepts/2.overview.md](docs/guide/4.concepts/2.overview.md) | Loomake を使う人・導入を検討する人 | 向かう先の全体像。品質駆動開発としての位置付け、4 値判定、証跡の 3 層、自動化のレベル、段階計画 |
| [docs/requirements/](docs/requirements/) | このリポジトリを開発する人 | 要件定義書。現在の正本は [loomake-v0.11.md](docs/requirements/loomake-v0.11.md)。これまでの正本（core・kit は [mvp-v0.7.md](docs/requirements/mvp-v0.7.md)、trace は [trace-v0.1.md](docs/requirements/trace-v0.1.md)、run は [runner-v0.1.md](docs/requirements/runner-v0.1.md)）は trace.md の出典として残している |
| [GitHub Issues（wbs ラベル）](https://github.com/loomake/loomake/issues?q=label%3Awbs)・[docs/wbs/baseline-v1.4.md](docs/wbs/baseline-v1.4.md)・[docs/requirements-matrix.md](docs/requirements-matrix.md) | このリポジトリを開発する人 | 完成までの作業項目（Issues が正本、WBS は移行時点の固定版）と、要件 ID と作業 ID の対応表 |
| [docs/notes/](docs/notes/) | このリポジトリを開発する人 | 参考資料。SDD ツールの比較、要件モデルの試行、要求・要件のまとめ方 |
| [docs/worklog/](docs/worklog/) | このリポジトリを開発する人 | 作業の記録。2026-10-25 までのレビューの記録（docs/review.md）は git 履歴の [cc5df0f](https://github.com/loomake/loomake/blob/cc5df0f85a29158512f45d5ff5517ff38a0b0aa7/docs/review.md) を参照。採点の正本は [docs/quality/scorecard.json](docs/quality/scorecard.json) |

## パッケージ

| パッケージ | 場所 | 役割 |
|---|---|---|
| `@loomake/core` | `packages/core/` | trace.md・spec.md・tasks.md・テストレポートの読み取りと、verify 結果の JSON スキーマ（外部の実行時依存として許すのは `zod` だけ） |
| `@loomake/kit` | `packages/kit/` | verify・init・doctor の本体、配布するテンプレート（Skill・AGENTS.md・CLAUDE.md・devcontainer） |
| `@loomake/trace` | `packages/trace/` | 証拠の記録（`trace record`）とリリースレポート（`trace report`） |
| `@loomake/runner` | `packages/runner/` | tasks を AI のエンジンに実装させ、完了ゲートが通るまで回して PR を出す（`run`） |
| `loomake` | `packages/cli/` | CLI 本体（`loomake init`・`loomake verify`・`loomake trace`・`loomake run`・`loomake doctor`） |

いまの仕様は `openspec/specs/` に、capability ごとのディレクトリで置いている（24 個。`ls openspec/specs` で一覧できる）。CLI の操作は cli・verify・init・doctor・trace-record・trace-report・trace-agreement、run は run・run-guards・run-pr・run-decision-policy、資源の上限は bounded-input・external-process-budget・run-record-budget にある。証拠の書き出しは evidence-publication、テストが誤りを見つけるかの確かめ方は domain-mutation-check と scenario-evidence-audit にある。

## 開発

開発には Node 24 の devcontainer を標準にしている。VS Code / Cursor で「コンテナーで再度開く」を実行すると、OpenSpec CLI が入る。配布物が動く Node の下限は 22.12 で、開発用ツールを動かす環境とは異なる。

```sh
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

このリポジトリでは、ゲートを `pnpm -s verify` で実行する。ビルドしてから `loomake verify` を実行するスクリプトで、引数はそのまま渡る。

```sh
pnpm -s verify --change <id> --spec-only
pnpm -s verify --change <id> --done --scope local
```

change の進め方は [docs/flow.md](docs/flow.md)、テスト名と完了の決まりは [AGENTS.md](AGENTS.md) にある。

### 構成

```
AGENTS.md                         共通ルールの正本（Claude Code / Codex 共通）
CLAUDE.md                         AGENTS.md を読み込むだけ
loomake.config.json               verify の設定（テストのレポートの場所・品質コマンド）
packages/core/                    @loomake/core（schema/ に verify 結果の JSON スキーマ）
packages/kit/                     @loomake/kit（templates/ に init が置くファイル）
packages/trace/                   @loomake/trace（証拠の記録とリリースレポート）
packages/runner/                  @loomake/runner（loomake run）
packages/cli/                     loomake（CLI 本体）
tests/                            リポジトリ全体のテスト（vitest）
scripts/ci-gate.mjs               CI 用。PR 本文・変えたファイル・ブランチ名から change を決め、--done で verify を実行する
openspec/specs/                   いまの仕様（archive のときだけ更新する）
openspec/changes/<id>/            進行中の change（proposal・specs・design・tasks・trace）
openspec/changes/archive/         完了した change
docs/                             使い方・開発の流れ・構成・要件定義書・記録
.loomake/                         テストのレポートと run の記録（git に入れない）、証拠の記録 evidence/（git に入れる）
.github/workflows/                ci.yml（品質コマンドと完了ゲート）、release.yml（手動の npm 公開）
.changeset/                       changesets の設定と未消化の changeset
.devcontainer/devcontainer.json   開発コンテナ（Node 24・pnpm・OpenSpec・Claude Code・Codex）
.agents/skills/                   Skill の実体（req-to-openspec、npx skills で入れた yomiyasu）
.claude/skills/                   Claude Code 用。自前の Skill は .agents/skills/ へのシンボリックリンク
skills-lock.json                  npx skills で入れたスキルの出所とハッシュ
```

`.agents/skills/req-to-openspec/` は `packages/kit/templates/skills/req-to-openspec/` と同じ内容に保つ（違うのは verify の実行方法だけ）。Skill を直すときは両方を直す。この 2 つがそろっているかは、テストが確かめる。

### CI とリリース

- PR では ubuntu だけで、main への push と毎日 1 回の定期実行では ubuntu・macos・windows の 3 つで、lint・typecheck・test・build を実行する。PR に `ci:all-os` ラベルを付けると、その PR でも 3 つの OS で実行する。macOS か Windows に関わる変更をする PR では、このラベルを付ける。Node 22.12 でも、ビルドした CLI が動くかを確かめる
- gate ジョブは、対象の change ごとに `verify --change <id> --done` を実行する。対象は、PR 本文に `loomake-change: <id>` の行があればその change とし、なければ PR で変えた `openspec/changes/<id>/` の下のファイルと、ブランチ名（`loomake/` で始まるときは、それを除いた名前）から決める（scope は既定の ci。ローカルの結果は合格にしない）
- 対象の change がなく、文書（`.md`、`docs/`・`openspec/`・`.changeset/` の下）だけを変えた PR と archive の PR は、品質コマンドだけを実行する。コードを変える PR で change がないときは、本文に `loomake-change: none` と書く。書かないと gate ジョブは失敗する
- gate ジョブは PR 本文を実行のたびに読む。本文を書き直したら、gate ジョブを再実行する
- archive で反映したあとの仕様の誤りは、change ごとの完了ゲートでは見つからない。そのため gate ジョブは、PR の種類によらず、いまの仕様（`openspec/specs/`）に `openspec validate --specs --strict` も実行する
- npm への公開は GitHub の Actions から release ワークフローを main で手動実行する。事前に `pnpm changeset version` でバージョンを上げた変更を main に入れておく。未消化の changeset が残っていると公開を止める。初回だけリポジトリのシークレットの `NPM_TOKEN` で公開し、そのあと npm の Trusted Publishing（OIDC）に切り替える（[docs/release.md](docs/release.md)）

### devcontainer について

- `~/.claude` と `~/.codex` を名前付きボリュームにしているので、コンテナを作り直しても再ログイン不要
- AI を権限確認なし（`--dangerously-skip-permissions` など）で動かすときは、許可ドメイン以外への通信を止めるファイアウォールを追加すること。Claude Code 公式リポジトリの devcontainer 例が参考になる。runner の段階では必須
- Mac では Docker Desktop より OrbStack のほうが軽い
