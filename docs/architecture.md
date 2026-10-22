# Loomake アーキテクチャ

最終更新：2026-10-22

## 1. 一言でいうと

| 担当 | 役割 |
|---|---|
| OpenSpec（外部 OSS） | **何を作るか**：仕様の正 |
| `@loomake/kit` | **どう作らせ、どう確かめるか**：要件書の取り込み・共通ルール・検証ゲート |
| `@loomake/runner` | **作る**：仕様から PR まで実装を回す（AI エンジンは選べる） |
| `@loomake/trace` | **作ったと証明する**：合意・検収の証拠をまとめる |
| `@loomake/core` | 上の 3 つをつなぐ**契約**（trace.md・spec・verify 結果の読み書きと JSON スキーマ） |

仕様の書式は自作せず OpenSpec を使う。Loomake が担うのは、OpenSpec が持っていない「要件書からの入口」と「守らせる仕組み」と「検収の証拠」。

この表は将来の構成を含む。現在のリポジトリには core・kit・CLI 本体（`loomake verify`）があり、trace・runner は MVP の範囲外。MVP の範囲は [要件定義書 v0.7](requirements/mvp-v0.7.md) を参照。

## 2. 流れ

```
要件書・仕様書（顧客）
   │  kit: req-to-openspec Skill
   ▼
OpenSpec change（proposal / specs / tasks + trace.md）
   │  kit: verify --spec-only（ブロッキング確認事項があれば止まる）
   ▼
runner: tasks を実装 → kit: verify --done が通るまで回す → PR
   │  kit: verify --done --json
   ▼
trace: 要件台帳 × 検証結果 → 検収レポート
   ▼
顧客の検収・納品
```

## 3. 名前

ブランドは **Loomake ひとつ**に統一する（旧称：Loomkit → kit、Imploom → runner、Traspec → trace）。

| 種類 | 名前 |
|---|---|
| リポジトリ | `loomake/loomake`（モノレポ）、`loomake/site`（Docus） |
| npm | `@loomake/core` `@loomake/kit` `@loomake/trace` `@loomake/runner` |
| CLI | `loomake init` / `loomake verify` / `loomake trace` / `loomake run` |
| サイト | loomake.dev |

CLI は本体パッケージ `loomake`（`packages/cli`）を 1 つ作り、各サブコマンドを束ねる（`npx loomake init` で導入する計画。setup-monorepo の Q-01 で決定。`init` は未実装）。

## 4. リポジトリ構成

以下は将来の構成を含む。`packages/trace/` と `packages/runner/` はまだ作っていない。

```
loomake/loomake            pnpm workspaces + changesets
├── .devcontainer/
├── packages/
│   ├── core/              @loomake/core
│   ├── kit/               @loomake/kit
│   ├── cli/               loomake（CLI 本体）
│   ├── trace/             @loomake/trace
│   └── runner/            @loomake/runner
└── openspec/              Loomake 自身の仕様（kit で自分を作る）
```

- **モノレポにする理由**：3 つのツールは契約（trace.md の書式・verify の JSON）でつながっており、初期は契約が頻繁に変わる。1 つの PR でまとめて直せるようにする。1 人開発なので分けるメリットがまだない
- npm は changesets でパッケージごとに別バージョンで出す
- **分けるタイミング**：外部コントリビューターが付いたとき、またはリリース周期が大きくずれたとき
- 既存の `traspec` は `git subtree add` で `packages/trace` に取り込む
- Nuxtart は Loomake とは別枠なので別リポジトリ
- 外部依存はなるべく減らす。特に `core` は依存ゼロを保つ

## 5. 作る順番

| 順 | 対象 | やること | 理由 |
|---|---|---|---|
| 0 | core | `verify.mjs` の解析処理を切り出し、verify 結果の JSON スキーマに `schemaVersion` を付ける | 3 ツールすべてが依存するので最初に固める |
| 1 | kit | `npx loomake init` で導入可能にし、実際の要件書を 1〜2 本流して直す | ここが甘いと後ろが全部ぶれる |
| 2 | trace | trace.md と verify JSON から検収レポートを出す | 実装が人手でも価値が出る。kit と合わせて「要件 → 実装 → 証拠」が一周する |
| 3 | runner | Claude Code の headless 実行だけに対応し、1 つの change を PR まで持っていく MVP | 最も難しい。完了判定と証拠の出力先が先にあれば「verify が通るまで回す」に絞れる |

## 6. 開発環境

devcontainer を標準にする（Node 24・pnpm・OpenSpec CLI・Claude Code・Codex・gh）。

- ログイン情報（`~/.claude`・`~/.codex`）は名前付きボリュームに置く
- AI を権限確認なしで動かす場合はネットワークを許可ドメインに絞る。runner の実行環境はこの devcontainer を土台にする
