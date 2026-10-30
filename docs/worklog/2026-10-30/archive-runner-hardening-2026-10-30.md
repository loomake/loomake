# Runner の停止と中断の仕様同期・archive

管理役の前作業として、[PR #163](https://github.com/loomake/loomake/pull/163)（main `57e9f14`）、[PR #158](https://github.com/loomake/loomake/pull/158)（`ac87014`）、[PR #159](https://github.com/loomake/loomake/pull/159)（`d60fd70`）を受入済み。#159 は CI `40999437993` attempt2・全必須チェック成功、同 head の自動 Codex 指摘なし・Opus `c1472b9c` 指摘ゼロ。既存の操作遅延は [Issue #116](https://github.com/loomake/loomake/issues/116#issuecomment-6514633563) に根因未解明として残る。

## stop-command-group-on-sighup（PR #158）

1. 7/7 tasks・全成果物完了を fresh CLI で確認し、包括承認のおすすめ「Sync now」を採用した。REQ-333・334 と 6 Scenario を主仕様へ同期し、既存 Purpose・全未対象要件を保持して `2026-10-30-stop-command-group-on-sighup` へ archive した。
2. 主仕様 29 件の strict 検証が成功。全差分ブロックの一致、成果物の byte 同一性、Scenario 台帳の 6 ID 移管・内容 hash・実 test hash、他レコード不変を確認した。normal verify・full suite は最終 batch が揃ってから実施する。
3. 新たな確認事項なし。Q-02 の保留範囲は [Issue #164](https://github.com/loomake/loomake/issues/164) で追跡し、この archive で解決済みとは扱わない。
4. 次に #159 を同期・archive する。#157 は受入後に同ブランチへ統合し、3 件が揃ってから通常検証・独立レビュー・CI と外部送信を進める。
