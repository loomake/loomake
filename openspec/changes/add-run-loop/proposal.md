# add-run-loop

## Why
仕様ゲートを通った change の tasks.md を AI のエンジンに実装させ、完了ゲートが通るまで直させる。完了したかどうかの判断は kit の verify に任せ、run は「verify が通るまで回す」ことだけを受け持つ。人がやるのは、確認事項への回答と PR のレビューだけにする。出典：run 要件定義書 v0.1 §1

## What Changes
- `loomake run --change <id>` を追加する。最初に仕様ゲートと未コミットの変更を確かめる（REQ-093、REQ-094）。`--dry-run` で予定だけを表示する（REQ-095）
- `loomake/<change-id>` のブランチで、未完了のタスクをエンジンに渡し、タスクごとにコミットする（REQ-096〜REQ-099。渡し方は確認待ち）
- すべてのタスクを終えたら完了ゲートを実行し、不合格なら直させる（REQ-100）
- `--engine claude-code` で Claude Code の headless 実行を使う（REQ-101。権限確認の扱いは確認待ち）
- 直しの回数・実行時間の上限、エンジンの質問で止まり、止まった理由を報告する（REQ-104〜REQ-107）
- 実行の記録を `.loomake/runs/<実行 ID>/` に、秘密情報を隠して保存する（REQ-117、REQ-118）
- コンテナの外では警告して確認を求める（REQ-120、REQ-122）。中断されても、終えたタスクと記録を残す（REQ-124）

## Non-goals
- REQ-090：仕様を決めることと、確認事項に答えること
- REQ-092：複数の change の並行実行
- 不正な直し方の検出（add-run-guards で扱う）
- trace の証拠の記録と PR（add-run-pr で扱う）
- 後のフェーズ：REQ-102（エンジンの共通のインターフェースの公開）、REQ-103（Codex）、REQ-108（`--resume`）、REQ-119（トークン数と費用の記録）

## Impact
- 影響する capability：run（新規）
- 影響するコード：run のパッケージ（新規）、CLI の run サブコマンド
