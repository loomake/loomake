# protect-verify-output

## Why

Issue #65 の完了条件は、秘密値がログ・証跡・レポートに残らないことである（NFR-09）。P1 は共通の置換関数を、P2 は収集モジュールの出力を守った。verify が返す結果、進捗、エラー表示はまだ置換していない。失敗した品質コマンドの出力は、末尾 30 行へ切ってから詳細に入れており、切る前に置換しないと秘密鍵ブロックの BEGIN 行が消えて本文が残る。

P3 は verify 経路（P3a）と trace の保存・表示経路（P3b）に分ける。この change は P3a だけを扱い、trace の record と report は P3b に残す。

## What Changes

- REQ-451：runVerify の戻り値、進捗、品質コマンドと `openspec validate` の失敗出力、formatVerifyResult の出力、verify コマンドのエラー表示を、既知の秘密の形について `***` に置き換える。

## Capabilities

### New Capabilities

なし。

### Modified Capabilities

- `secret-redaction`：Requirement を 1 つ追加する（ADDED）。既存の REQ-447 は変えない。

## Non-goals

- trace record の保存（documents・git のエラー・dirty 一覧・保存前の最終検査）と trace report、旧 Evidence の表示、REQ-070 の変更（P3b：REQ-452・REQ-453）。
- onCommand の通知値の置換。通知の値は名前・終わり方・状態・コード・limit の reason だけで、品質コマンドの出力を含まない（REQ-455・REQ-456 は変えない）。
- runner の表示経路、doctor、置換する形の追加、品質判定の規則、終了コード。

## Impact

kit（verify/run.ts・result.ts・format.ts）と cli（main.ts）の src・test を変える。trace のファイルは変えない。公開 API の型と引数は変えず、ADR 0002 に従い kit・cli は patch とする。
