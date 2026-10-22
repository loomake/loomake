# Loomake

要件書・仕様書から AI 駆動で開発するためのツール群。[OpenSpec](https://github.com/Fission-AI/OpenSpec) の上に「要件書からの入口」と「守らせる仕組み」を足す。

- 要件書を、出典つきの OpenSpec change に変える（req-to-openspec Skill）
- AI が従う共通ルールを置く（AGENTS.md）
- 未確定の要件が残る間は実装させず、全要件にテストがあることを機械的に確かめる（`loomake verify`）

```sh
npx loomake init                                  # AGENTS.md・設定・Skill を置く
npx loomake verify --change <id> --spec-only      # 仕様ゲート：実装に入ってよいか
npx loomake verify --change <id> --done           # 完了ゲート：要件ごとのテスト・品質コマンド
```

`loomake` はまだ npm に公開していない。

## ドキュメント

| 文書 | 読む人 | 中身 |
|---|---|---|
| [docs/usage.md](docs/usage.md) | Loomake を使う人 | 導入、1 つの change の進め方、verify と設定のリファレンス（図つき） |
| [docs/positioning.md](docs/positioning.md) | Loomake を使う人・導入を検討する人 | OpenSpec・AI エージェント・テストランナー・CI との分担と、開発の流れの中での位置付け |
| [docs/for-agents.md](docs/for-agents.md) | Loomake を入れたプロジェクトで働く AI エージェント | 状況ごとの手順、verify が不合格のときの直し方、終了コードと JSON |
| [AGENTS.md](AGENTS.md) | AI エージェント・開発者 | このリポジトリで AI が従うルール |
| [docs/flow.md](docs/flow.md) | このリポジトリを開発する人 | Loomake を Loomake で作る流れ |
| [docs/architecture.md](docs/architecture.md) | このリポジトリを開発する人 | 全体の構成、名前、作る順番 |
| [docs/requirements/](docs/requirements/) | このリポジトリを開発する人 | 要件定義書。最新は [mvp-v0.7.md](docs/requirements/mvp-v0.7.md)。過去の版は trace.md の出典として残している |
| [docs/review.md](docs/review.md)・[docs/worklog/](docs/worklog/) | このリポジトリを開発する人 | レビューと作業の記録 |

## パッケージ

| パッケージ | 場所 | 役割 |
|---|---|---|
| `@loomake/core` | `packages/core/` | trace.md・spec.md・tasks.md・テストレポートの読み取りと、verify 結果の JSON スキーマ（実行時依存ゼロ） |
| `@loomake/kit` | `packages/kit/` | verify と init の本体、配布するテンプレート（Skill・AGENTS.md・CLAUDE.md・devcontainer） |
| `loomake` | `packages/cli/` | CLI 本体（`loomake init`・`loomake verify`） |

いまの仕様は `openspec/specs/`（monorepo・core-parsers・verify・init・req-to-openspec-skill・agents-rules）にある。

## 開発

開発には Node 24 の devcontainer を標準にしている。VS Code / Cursor で「コンテナーで再度開く」を実行すると、OpenSpec CLI が入る。配布物が動く Node の下限は 20.19 で、開発用ツールを動かす環境とは異なる。

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
pnpm -s verify --change <id> --done
```

change の進め方は [docs/flow.md](docs/flow.md)、テスト名と完了の決まりは [AGENTS.md](AGENTS.md) にある。

### 構成

```
AGENTS.md                         共通ルールの正本（Claude Code / Codex 共通）
CLAUDE.md                         AGENTS.md を読み込むだけ
loomake.config.json               verify の設定（テストのレポートの場所・品質コマンド）
packages/core/                    @loomake/core（schema/ に verify 結果の JSON スキーマ）
packages/kit/                     @loomake/kit（templates/ に init が置くファイル）
packages/cli/                     loomake（CLI 本体）
tests/                            リポジトリ全体のテスト（vitest）
scripts/ci-gate.mjs               CI 用。ブランチ名が change-id なら --done で verify を実行する
openspec/specs/                   いまの仕様（archive のときだけ更新する）
openspec/changes/<id>/            進行中の change（proposal・specs・design・tasks・trace）
openspec/changes/archive/         完了した change
docs/                             使い方・開発の流れ・構成・要件定義書・記録
.loomake/                         テストのレポート（git に入れない）
.github/workflows/                ci.yml（品質コマンドと完了ゲート）、release.yml（手動の npm 公開）
.changeset/                       changesets の設定と未消化の changeset
.devcontainer/devcontainer.json   開発コンテナ（Node 24・pnpm・OpenSpec・Claude Code・Codex）
.agents/skills/                   Skill の実体（req-to-openspec、npx skills で入れた yomiyasu）
.claude/skills/                   Claude Code 用。自前の Skill は .agents/skills/ へのシンボリックリンク
skills-lock.json                  npx skills で入れたスキルの出所とハッシュ
```

`.agents/skills/req-to-openspec/` は `packages/kit/templates/skills/req-to-openspec/` と同じ内容に保つ（違うのは verify の実行方法だけ）。Skill を直すときは両方を直す。この 2 つがそろっているかは、テストが確かめる。

### CI とリリース

- PR と main への push で、ubuntu・macos・windows の 3 つで lint・typecheck・test・build を実行する。Node 20.19 でも、ビルドした CLI が動くかを確かめる
- PR のブランチ名が change-id と一致し、`openspec/changes/<id>/` があれば、gate ジョブで `verify --change <id> --done` も実行する。一致しない場合とブランチ名が `archive` の場合は、品質コマンドだけを実行する
- npm への公開は GitHub の Actions から release ワークフローを main で手動実行する。事前に `pnpm changeset version` でバージョンを上げた変更を main に入れておく。未消化の changeset が残っていると公開を止める。リポジトリのシークレットに `NPM_TOKEN` が要る

### devcontainer について

- `~/.claude` と `~/.codex` を名前付きボリュームにしているので、コンテナを作り直しても再ログイン不要
- AI を権限確認なし（`--dangerously-skip-permissions` など）で動かすときは、許可ドメイン以外への通信を止めるファイアウォールを追加すること。Claude Code 公式リポジトリの devcontainer 例が参考になる。runner の段階では必須
- Mac では Docker Desktop より OrbStack のほうが軽い
