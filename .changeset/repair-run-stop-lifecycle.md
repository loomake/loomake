---
"@loomake/runner": patch
"loomake": patch
---

run の dry-run の例外時に元のブランチへ戻し、想定外の例外を伏せて停止記録に残す。終了後の出力パイプ待ちを制限し、2 回目の中断信号で強制終了できるようにする。
