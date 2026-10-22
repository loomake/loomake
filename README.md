# Loomake

要件書・仕様書から AI 駆動で開発するためのツール群。OpenSpec の上に「要件書からの入口」と「守らせる仕組み」を足す。

このリポジトリは pnpm workspaces のモノレポで、Loomake 自身も Loomake の流れ（要件書 → OpenSpec change → 仕様ゲート → 実装 → 完了ゲート）で作っている。全体の構成と方針は [docs/architecture.md](docs/architecture.md)、日々の進め方は [docs/flow.md](docs/flow.md) を参照。

最新の要件定義書は [mvp-v0.6.md](docs/requirements/mvp-v0.6.md)。各 change の出典と合意内容は `trace.md` にある。過去の要件書は出典の記録として残している。

## パッケージ

| パッケージ | 場所 | 実装予定の役割 |
|---|---|---|
| `@loomake/core` | `packages/core/` | trace.md・spec・verify 結果の読み書きと JSON スキーマ（実行時依存ゼロ） |
| `@loomake/kit` | `packages/kit/` | req-to-openspec Skill・AGENTS.md・verify・init |
| `loomake` | `packages/cli/` | CLI 本体（`loomake init`・`loomake verify`） |

中身は change（`openspec/changes/`）ごとに作る。ゲートは `loomake verify` で通す。このリポジトリでは `pnpm -s verify` が、ビルドしてから `loomake verify` を実行する。

## 構成

```
AGENTS.md                         共通ルールの正本（Claude Code / Codex 共通）
CLAUDE.md                         AGENTS.md を読み込むだけ
loomake.config.json               テストのレポートの場所・品質コマンド
packages/                         core・kit・cli
tests/                            リポジトリ全体のテスト（vitest）
scripts/ci-gate.mjs               CI 用。ブランチ名が change-id なら --done で verify を実行する
openspec/changes/<id>/            進行中の change（proposal・specs・design・tasks・trace）
openspec/specs/                   いまの仕様（archive のときだけ更新する）
docs/requirements/                要件定義書（trace.md の出典）
.github/workflows/                ci.yml（品質コマンドと完了ゲート）、release.yml（手動の npm 公開）
.changeset/                       changesets の設定と未消化の changeset
.devcontainer/devcontainer.json   開発コンテナ（Node 24・pnpm・OpenSpec・Claude Code・Codex）
.agents/skills/                   Skill の実体（req-to-openspec、npx skills で入れた yomiyasu）
.claude/skills/                   Claude Code 用。自前の Skill は .agents/skills/ へのシンボリックリンク
skills-lock.json                  npx skills で入れたスキルの出所とハッシュ
```

## 開発の始め方

開発には Node 24 の devcontainer を標準にしている。VS Code / Cursor で「コンテナーで再度開く」を実行すると、OpenSpec CLI が入る。配布物の実行環境の下限（Node 20.19）と、開発用ツールを動かす環境は異なる。

```sh
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## ゲート

```sh
pnpm -s verify --change <id> --spec-only   # 仕様ゲート：実装に入ってよいか
pnpm -s verify --change <id> --done        # 完了ゲート：タスク・要件ごとのテスト・品質コマンド
pnpm -s verify --change <id> --done --json # 機械が読む用
```

完了ゲートが実行する品質コマンドは `loomake.config.json` の lint・typecheck・test。要件ごとのテストは、test コマンド（Vitest）が `.loomake/test-report.json` に書き出す JSON レポートの、成功したテストの名前で判定する。build は別途 `pnpm build` で確認し、CI の quality ジョブでも実行する。

テスト名には要件 ID を入れる（`it('[REQ-012] …', …)`）。詳しい決まりは [AGENTS.md](AGENTS.md) にある。

## CI とリリース

- PR と main への push で、ubuntu・macos・windows の 3 つで lint・typecheck・test・build を実行する。Node 20.19 でも、ビルドした CLI が動くかを確かめる
- PR のブランチ名が change-id（例：`setup-monorepo`）と一致し、`openspec/changes/<id>/` があれば、`verify --change <id> --done` も実行する。一致しない場合とブランチ名が `archive` の場合は、gate ジョブでは品質コマンドだけを実行する
- npm への公開は GitHub の Actions から release ワークフローを手動で実行する。main を選んで実行する。事前に `pnpm changeset version` でバージョンを上げた変更を main に入れておく。未消化の changeset が残っている場合は公開を止める

## devcontainer について

- `~/.claude` と `~/.codex` を名前付きボリュームにしているので、コンテナを作り直しても再ログイン不要
- AI を権限確認なし（`--dangerously-skip-permissions` など）で動かすときは、許可ドメイン以外への通信を止めるファイアウォールを追加すること。Claude Code 公式リポジトリの devcontainer 例が参考になる。runner の段階では必須
- Mac では Docker Desktop より OrbStack のほうが軽い
