---
"@loomake/runner": minor
"loomake": minor
---

`@loomake/runner` を足し、`loomake run --change <id>` を追加した。仕様ゲートと未コミットの変更を確かめてから、`loomake/<change-id>` のブランチで tasks.md のタスクを 1 つずつ Claude Code に実装させてコミットし、完了ゲートが通るまで直させる。直しの回数と実行時間の上限、エンジンの質問、中断で止まり、実行の記録を `.loomake/runs/` に秘密情報を隠して保存する。
