# Trace: windows-owned-cleanup-phases

## 入力文書

| 文書 | 版 | 日付 |
|---|---|---|
| [CI不安定さ #275](https://github.com/loomake/loomake/issues/275) | 診断対象。原因の断定ではない | 2026-11-01 |
| [Q-S1](https://github.com/loomake/loomake/issues/121#issuecomment-6543715081) | 独立main向けL3の根拠。親E3段階受入とは別 | 2026-11-01 |
| [REQ-363予約](https://github.com/loomake/loomake/issues/121#issuecomment-6551433080) | 中央予約済み。新規の利用者承認と同一視しない | 2026-11-01 |
| [設計採用記録](https://github.com/loomake/loomake/issues/275#issuecomment-6552443335) | 管理役が公開記録。包括承認による回答と仮定、適用範囲 | 2026-11-01 |
| 採用Opus設計0666055f・aa7c533e、8fの解析/PS印継承箇所 | ignoredの各result.md原本を全文確認。管理役が本セッションで採用 | 2026-11-01 |
| Node v24.21.0公式fs一次原本7件 | 固定commit 955266bf、blob完全一致。AsyncDestCall after付きDispatchも補完 | 2026-11-01 |
| latest mainと旧設計基点の比較 | 3a54614e→5f1b4d73。対象6fileに差分なし、FFしてignored原本再利用 | 2026-11-01 |

## 要件台帳

| ID | 出典 | 種別 | 要約（原文に忠実に） | 状態 | 反映先 |
|---|---|---|---|---|---|
| REQ-363 | 採用設計066第4章、aa7第3章と中央予約 | 機能 | 固定区間・原点分離・解析・非同期待機なし・保存の完全性と欠測、元成否と秘密情報禁止を保持 | 反映済 | specs/ci-test-diagnostics/spec.mdのADDED |
| REQ-345 | 主仕様ci-test-diagnostics | 関連 | 既存の心拍・markPhase・失敗で元の成否を変えない条件は原文保持 | 既存仕様で充足 | 主仕様と既存ci-heartbeat.test.ts。変更しない |
| REQ-291 | 主仕様ci-test-diagnostics | 範囲外 | 品質の期待値・期限・skip・再試行・実行条件を変えない | 既存仕様で充足 | 主仕様と既存workflow。変更しない |

## 確認事項

| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 | 回答者 | 回答日 |
|---|---|---|---|---|---|---|---|---|
| Q275-01 | REQ-363 | 診断仕様をどこへ置くか | A: REQ-363をADDED / B: REQ-345を書換 | A。既存仕様の原文を保持する | yes | A。既存capabilityへ予約済みREQ-363だけを追加する | 利用者（ADR 0006 の包括承認） | 2026-11-01 |
| Q275-02 | REQ-363 | PowerShell内の区間をどう測るか | A: stdoutの固定印 / B: raw出力を保存 | A。固定数値だけを解析する | yes | A。LOOMAKE-PSの4印だけを解析しrawは保存しない | 利用者（ADR 0006 の包括承認） | 2026-11-01 |
| Q275-03 | REQ-363 | 起動から最初の命令の値をどう測るか | A: StartTimeとの差 / B: spawn全体と差引 | A。原点を分ける | yes | A。bootは壁時計のStartTimeとの差で、F/Nとは差引かない | 利用者（ADR 0006 の包括承認） | 2026-11-01 |
| Q-ORIGIN | REQ-363 | 原点と不整合をどう扱うか | A: S/F/N別々 / B: 値を横断比較 | A。異なる原点の比較は誤る | yes | A。bootは省略可、8f解析表の順で不正・clock・欠測を分ける | 利用者（ADR 0006 の包括承認） | 2026-11-01 |
| Q-RETURN | REQ-363 | 停止の成否と解析をどう分けるか | A: ps-returnとps-parseを分離 / B: 印で成否変更 | A。診断欠測で成否を変えない | yes | A。元resultだけで停止結果を分類し、stdoutは解析分類だけへ使う | 利用者（ADR 0006 の包括承認） | 2026-11-01 |
| Q-MARKS | REQ-363 | 印と成功終了をどう置くか | A: 4印・判定後・exit 0 / B: taskkillと判定の間へ挿入 | A。元の判定順を保つ | yes | A。LOOMAKE-PS、try/Flush、taskkill直後のLASTEXITCODE判定後に印、最後exit 0 | 利用者（ADR 0006 の包括承認） | 2026-11-01 |
| Q-WRITER | REQ-363 | 書出し方式をどうするか | C: 非同期callback fsの鎖 / A: detached子 / B: Worker | C。追加プロセスなしで成功通知を数える | yes | C。F1補完済み。同時1要求・待たない・例外を外へ出さない。旧Aとhook同期flushは採らない | 利用者（ADR 0006 の包括承認） | 2026-11-01 |
| Q-POOL | REQ-363 | 同時要求数をどうするか | A: 同時1要求 / B: 並列要求や設定変更 | A。固着時に占有するスレッドを増やさない | yes | A。同時1要求としpool設定は変えない。共有poolの性能影響ゼロは主張しない | 利用者（ADR 0006 の包括承認） | 2026-11-01 |
| Q-SELFPID | REQ-363 | PID禁止の主語をどう合わせるか | A: 停止対象PIDは禁止・自己PIDのみ許可 / B: 自己PIDも除外 | A。REQ-345と同じ形にする | yes | A。process.pidだけを行のpidとファイル名に使う。本文は指定fallbackの1文だけ削除し、ほかは縮小しない | 利用者（ADR 0006 の包括承認） | 2026-11-01 |
| Q-END | REQ-363 | 終わりをどこで出すか | A: cleanupのclosed後 / B: hook追加 | A。hook期限への経路を作らない | yes | A。cleanup-closedのあとendを1回だけ呼び、test-endとhookは加えない | 利用者（ADR 0006 の包括承認） | 2026-11-01 |
| Q-COMPLETE | REQ-363 | 完全の意味をどうするか | A: 保存の全成功通知 / B: 送信や受信だけ | A。保存の失敗を隠さない | yes | A。end先頭時のsaved=rows・failed=0・dropped=0だけcomplete、終わりなしは欠測。fsync耐久性は含まない | 利用者（ADR 0006 の包括承認） | 2026-11-01 |
| Q-WAIT | REQ-363 | 保存完了を待つか | A: 待たない / B: hookやtimerで待つ | A。記録が元の試験を待たせない | yes | A。callback未通知なら後続/endなしで欠測とし、呼出は同期で戻る | 利用者（ADR 0006 の包括承認） | 2026-11-01 |
| Q-FILE | REQ-363 | 保存先をどう分けるか | A: owned-cleanup-自己pid.jsonl / B: markPhaseへ混在 | A。同期追記と64KiB予算から分ける | yes | A。同じartifact directory内の別ファイルとしworkflowを変えない | 利用者（ADR 0006 の包括承認） | 2026-11-01 |
| Q275-07 | REQ-363 | PowerShell probeを足すか | A: 足さない / B: 新probe | A。既存2case artifactで観測する | yes | A。新規試験は全OSでPowerShellを起動せず、native探索もしない | 利用者（ADR 0006 の包括承認） | 2026-11-01 |
| Q275-08 | REQ-363 | 受入先と工程をどうするか | A: 独立main向けL3一本 / B: 親E3段階受入 | A。Q-S1と採用設計に従う | yes | A。通常CI・3 OS・独立レビュー・ci doneを満たす。E3親の受入とは混同しない | 利用者（ADR 0006 の包括承認） | 2026-11-01 |

上表は管理役が採用済みのおすすめをADR 0006に従って回答として記録したもので、新しい人の明示承認を捏造しない。採用日時は2026-11-01本セッションとし、未知の分秒は記録しない。旧Q275-05/Q-TIMINGは事象ごとの非同期記録とQ-ENDへ、旧Q-PROBEのwriter子起動は案Cの追加プロセスなしへ置き換わる。旧A3/A4のpipe容量とmodule収集期限の推測は採用前提にしない。

## 仮定

| ID | 関連 | 仮定の内容 | 理由 | 承認 | 承認者 | 承認日 |
|---|---|---|---|---|---|---|
| A1 | REQ-363 | Windowsで期限切れ時の途中stdoutとFlush行が残るかは未観測 | 実artifactでだけ観測し欠測を保持する | yes | 管理役Codex | 2026-11-01 |
| A2 | REQ-363 | Vitest 5.0.5既定forksの停止順を前提とし、threadsは対象外 | installed原文と設定を確認しpool設定は変えない | yes | 管理役Codex | 2026-11-01 |
| A3' | REQ-363 | callback fsは呼んだスレッドがディスク完了を待たずpoolへ渡す。初期化・mutex・GCの時間は保証しない | 固定公式7原本とafter付きDispatchでF1を補完 | yes | 管理役Codex | 2026-11-01 |
| A5 | REQ-363 | カーネル内I/O固着がプロセス終了を妨げるかは未観測 | 必ず止まるとは主張しない | yes | 管理役Codex | 2026-11-01 |
| A6 | REQ-363 | 後続試験中に鎖が追いつく見込みはあるが保証しない | 追いつかず終わりがなければ欠測 | yes | 管理役Codex | 2026-11-01 |
| A7 | REQ-363 | 固着でshared pool1本を占有し、同forkの他APIが遅れうる。影響ゼロは未証明 | 案Cが新しく加える負荷を隠さず、実Windows artifactで観測する | yes | 管理役Codex | 2026-11-01 |

## 採用と保全

正式本文はaa7の510 UTF-16文字から指定の最終1文だけを外した472文字で、停止対象PID禁止と9 Scenarioを保持する。自己PID許可はdesignとQ-SELFPIDに記録した。SourceはADDED REQ-363だけとする。REQ-345、元13PS行、taskkill直後のexit判定、元assert・文言・3000/5000/10000ms・skip・workflow・設定は変えない。新しい解釈や本文縮小が必要なら管理役へ戻す。
