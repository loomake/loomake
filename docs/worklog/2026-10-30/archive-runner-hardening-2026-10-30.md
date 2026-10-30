# Runner の停止と中断の仕様同期・archive

管理役の前作業として、[PR #163](https://github.com/loomake/loomake/pull/163)（main `57e9f14`）、[PR #158](https://github.com/loomake/loomake/pull/158)（`ac87014`）、[PR #159](https://github.com/loomake/loomake/pull/159)（`d60fd70`）を受入済み。#159 は CI `40999437993` attempt2・全必須チェック成功、同 head の自動 Codex 指摘なし・Opus `c1472b9c` 指摘ゼロ。既存の操作遅延は [Issue #116](https://github.com/loomake/loomake/issues/116#issuecomment-6514633563) に根因未解明として残る。

## stop-command-group-on-sighup（PR #158）

1. 7/7 tasks・全成果物完了を fresh CLI で確認し、包括承認のおすすめ「Sync now」を採用した。REQ-333・334 と 6 Scenario を主仕様へ同期し、既存 Purpose・全未対象要件を保持して `2026-10-30-stop-command-group-on-sighup` へ archive した。
2. 主仕様 29 件の strict 検証が成功。全差分ブロックの一致、成果物の byte 同一性、Scenario 台帳の 6 ID 移管・内容 hash・実 test hash、他レコード不変を確認した。normal verify・full suite は最終 batch が揃ってから実施する。
3. 新たな確認事項なし。Q-02 の保留範囲は [Issue #164](https://github.com/loomake/loomake/issues/164) で追跡し、この archive で解決済みとは扱わない。
4. 次に #159 を同期・archive する。#157 は受入後に同ブランチへ統合し、3 件が揃ってから通常検証・独立レビュー・CI と外部送信を進める。

## bound-engine-timer-and-interrupt（PR #159）

1. fresh CLI で 14/14 tasks・全成果物完了を確認し、「Sync now」を採用した。REQ-336・337 と 7 Scenario を run の主仕様へ同期し、`2026-10-30-bound-engine-timer-and-interrupt` へ archive した。
2. 主仕様 29 件の strict 検証が成功。既存 Purpose・全未対象ブロック、全 delta の一致、台帳の 7 ID 移管・内容 hash・実 test hash、他レコード不変、全成果物の byte 同一性を確認した。製品コードと検証設定は変更していない。
3. 新たな確認事項なし。#159 の修正前 Windows 受領ファイル不在と macOS 操作遅延の根因は未解明のまま保持する。archive ブランチの normal verify・full suite・独立最終レビュー・CI は未実施である。
4. #157 の受入後に main を統合し、同じブランチで追加 archive する。3 件が揃ってから batch の全体検証と独立レビューへ進む。現時点では外部 push・PR 作成・Opus 送信を行っていない。

## stop-on-empty-engine-diff（PR #157）と最終 batch の準備

管理役が [PR #157](https://github.com/loomake/loomake/pull/157) を main `8fe1145` で受入した。head `8322682` は done で 1509 成功・既存対象外 8 件、29 tasks・24 Scenario、全 OS CI `41003130800`・CodeQL `41003130787` 成功、同 head の自動 Codex 指摘なし、Opus `95da74f1` は全重大度で指摘ゼロ。

1. 受入 main を統合し、最新の台帳 504 件と top-level metadata を起点に、先行 13 ID を再移管した。#159 の 7 対応で更新された test hash を実ファイルと照合して保持した。#157 は fresh CLI の全成果物・29/29 tasks を確認し、Sync now で 5 ADDED・2 MODIFIED Requirement と全 24 Scenario を同期・archive した。
2. 既存 Purpose、未対象ブロック、旧 Scenario・Source を保持し、全 delta 一致と主仕様 29 件の strict 検証が成功。24 change ID を削除して main ID へ移し、重複する旧 main 側 7 ID を置換したため、台帳は 497 件となった。未対象レコードと全 top-level metadata は保持した。
3. 新たな仕様判断なし。既存の run-decision-policy の Purpose は書き換えていない。archive の全 17 Markdown ファイルを調べ、#157 trace の ADR 0006 への href だけ `../../../docs/adr/…` から `../../../../docs/adr/…` に補正した。移動前後の実 target が同じこと、全相対リンクとアンカーの解決、その他の bytes が同一であることを確認した。管理役の指示による意味を保つ階層補正である。
4. 3 件が揃った head をコミットし、既存設定の normal verify・lint・typecheck・full suite を実行する。archived change ID への done は行わず、元の受入証拠を保持する。資料完成後に新規 Opus 最終レビューを指摘ゼロまで往復し、外部 push・PR は管理役と結果を照合してから進める。
