# Loomake 開発の流れ

Oct 22, 2026 · @r

## 全体像

1 つの change は「答える → 実装を任せる → ゲートを通す → PR → archive」の順に回し、人がやるのは確認事項への回答と PR のレビューだけを目標にする。CLI（`loomake`）ができるまでは、試作の `node scripts/verify.mjs` で代用する。

1. 要件書を置く
2. 要件書を OpenSpec change にする（AI）
3. 確認事項に答えて、仕様ゲートを通す（人）
4. tasks.md を実装する（AI）
5. 完了ゲートを通して PR を出す（AI → 人がレビュー）
6. マージ後に archive して、仕様に取り込む
7. 次の change へ

| 段階 | 人 | AI |
| --- | --- | --- |
| change 化 | 分割案を確認する | 台帳・確認事項・change を作る |
| 仕様ゲート | 確認事項に回答し、仮定を承認する | 指摘に沿って spec.md を直す |
| 実装 | 仕様外の質問に答える | タスクごとに実装・コミットする |
| 完了ゲート・PR | PR をレビューしてマージする | ゲートが通るまで直す |

## 0. 最初に 1 回だけ：準備

リポジトリを作り、試作キットを置いて、devcontainer の中で OpenSpec を初期化する。ここまでを最初のコミットにする。この節は、このリポジトリを立ち上げたときの記録である。いまの構成（`packages/cli` など）は setup-monorepo で作った。

```sh
gh repo create loomake/loomake --public --clone
cd loomake
pnpm init
mkdir -p packages/{core,kit} docs/requirements
```

1. `pnpm-workspace.yaml` に `packages: ["packages/*"]` と書く
2. 試作キット（loomake-kit.zip の中身）をルートに置く
3. VS Code / Cursor で「コンテナーで再度開く」を実行する
4. コンテナの中で次を実行する

```sh
openspec init   # 対話で Claude Code と Codex を選ぶ
claude          # 初回だけログイン（以後はボリュームに残る）
```

## 1–2. 要件書を置き、change にする

要件書は Markdown でリポジトリに置いて版管理し、Claude Code または Codex の req-to-openspec Skill で change に変換する。

1. 要件定義書を Markdown でエクスポートし、`docs/requirements/mvp-v0.6.md` のように版を含む名前でコミットする（trace.md の出典と突き合わせるため）
2. AI エージェントに次のように頼む

```
req-to-openspec スキルで docs/requirements/mvp-v0.6.md を change にして
```

3. AI が出す change の分割案を確認する
4. 作業の最後に報告されるブロッキング確認事項を確認する。要件書に未決事項があれば、回答済みかどうかを各 change の `trace.md` で確認する

## 3. 仕様ゲートを通す

仕様ゲートに合格するまで実装には進まない。

1. 各 change の `trace.md` を開き、確認事項の「回答」欄と、仮定の「承認」欄を埋める
2. 仕様ゲートを実行する

```sh
node scripts/verify.mjs --change setup-monorepo --spec-only
```

3. 不合格なら、未回答のブロッキング確認事項に答え、回答を `trace.md` と差分仕様に反映する。Source・台帳・Scenario などの不備も直し、もう一度ゲートを通す

未承認の仮定と確認待ちの要件は警告として表示されるだけで、仕様ゲートは止まらない。完了ゲートでは確認待ちの要件があると不合格になる。

## 4–5. 実装して PR を出す

change ごとにブランチを切り、実装を Claude Code に任せ、完了ゲートが通ったら PR を出す。

```sh
git switch -c setup-monorepo
claude
```

Claude Code への依頼文：

```
openspec/changes/setup-monorepo の tasks.md を順に実装して。
AGENTS.md に従って、タスクごとにコミット。
```

仕様に無い判断が必要になると、AI は止まって質問してくる（AGENTS.md の規則）。答えるか、仕様を直すかを選ぶ。実装が終わったら次を実行する。

```sh
node scripts/verify.mjs --change setup-monorepo --done
gh pr create --fill
```

GitHub Actions の gate ジョブは、PR のブランチ名と同じ change-id のディレクトリがあるときに完了ゲートを実行する（例：ブランチ `setup-monorepo` → `openspec/changes/setup-monorepo/`）。一致しない場合とブランチ名が `archive` の場合は品質コマンドだけを実行する。設定は `setup-monorepo` で導入済み。マージを止めるための必須チェックの設定は、人が GitHub 上で行う（setup-monorepo の仮定 A-03）。

## 6. マージ後：仕様に取り込む

PR をマージしたら archive し、差分仕様を `openspec/specs/`（いまの仕様）に統合する。archive は `openspec/specs/` と `openspec/changes/archive/` に新しいファイルを作るので、`git add -A openspec` で追加してからコミットする。

```sh
git switch main && git pull
openspec archive setup-monorepo
git add -A openspec
git commit -m "archive: setup-monorepo" && git push
```

## 7. 次の change と自作 CLI への乗り換え

MVP は次の 5 つの change で進め、`add-verify-cli` が終わった時点で試作の verify.mjs を自作 CLI に置き換える。この 5 分割は作成済み。`setup-monorepo` のタスクはチェック済みで、残り 4 つの change は未実装。

| 順 | change | 内容 |
| --- | --- | --- |
| 1 | `setup-monorepo` | モノレポの雛形・devcontainer・CI（完了ゲート） |
| 2 | `add-core-parsers` | core の解析処理と verify 結果の JSON スキーマ |
| 3 | `add-verify-cli` | `loomake verify` |
| 4 | `add-kit-assets` | req-to-openspec Skill と AGENTS.md を kit のテンプレートとして整える |
| 5 | `add-init-cli` | `loomake init` |

乗り換え後は、作った道具で次の change を検査する。ルートは `loomake` パッケージに依存していないので、ビルドしたものをリポジトリのルートで `node` から直接動かす。

```sh
pnpm build
node packages/cli/dist/cli.js verify --change add-init-cli --done
```
