# loomake

要件書・仕様書から AI 駆動で開発するための CLI。[OpenSpec](https://github.com/Fission-AI/OpenSpec) の上に、要件書からの入口と、AI に守らせる検査を足す。

- 要件書を出典つきの OpenSpec change に変える Skill と、AI が従う共通ルール（AGENTS.md）を置く（`loomake init`）
- 未確定の要件が残るあいだは実装に進ませず、すべての要件にテストがあることを確かめる（`loomake verify`）
- 検査の結果を証拠として記録し、要件ごとの検査結果をまとめたリリースレポートを作る（`loomake trace`）
- change のタスクを AI に実装させ、完了ゲートが通るまで直させて、PR を作る（`loomake run`）
- 導入の状態を調べ、足りない設定と直し方を表示する（`loomake doctor`）

```sh
npx loomake init                                  # AGENTS.md・設定・Skill を置く
npx loomake doctor                                # 導入の状態を調べる
npx loomake verify --change <id> --spec-only      # 仕様ゲート：実装に入ってよいか
npx loomake verify --change <id> --done           # 完了ゲート：要件ごとのテストと品質コマンド
npx loomake run --change <id>                     # 実装から PR までを AI に任せる
npx loomake trace record --change <id>            # 証拠を記録する
npx loomake trace report --change <id>            # リリースレポートを出す
```

各コマンドの使い方は `npx loomake <コマンド> --help` で表示する。

## 必要なもの

- Node.js 22.12 以上
- 実行時に使う外部コマンド
  - `openspec`（[OpenSpec CLI](https://github.com/Fission-AI/OpenSpec)。`npm install -g @fission-ai/openspec`）
  - `loomake run` では、`gh`（[GitHub CLI](https://cli.github.com/)）と `claude`（Claude Code）

`loomake run --skip-permissions` は、AI を権限確認なしで動かす。通信を npm・GitHub・エンジンの API に絞った環境で、`LOOMAKE_SANDBOX=1` を設定したときだけ使う。

## ドキュメント

使い方・設定・AI エージェント向けの手順は、[GitHub のリポジトリ](https://github.com/loomake/loomake)の [docs/usage.md](https://github.com/loomake/loomake/blob/main/docs/usage.md) と [docs/for-agents.md](https://github.com/loomake/loomake/blob/main/docs/for-agents.md) にある。

## ライセンス

MIT
