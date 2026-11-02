# Proposal: verify-answer-guidance

## Why

仕様ゲートの確認待ちに対応するQが表示されず、回答後に要件や差分仕様の直し漏れが残っても気づきにくい。Issue #285の採用済み設計に沿って案内を追加し、工程分担の試行1/7（版1）として進める。

## What Changes

- REQ-360：確認待ちの要件に関連Qを対応付け、回答済みQに関連する確認待ちと、差分仕様に残る回答済みQ参照をspec-onlyの案内つき合格として示す。
- REQ-361：人向け表示に回答欄と承認欄の書き方を追加し、JSONの結果・既存検査の詳細・分類・終了コードを保つ。
- 既存capability verifyに2 ADDEDを置く。未同期C001が所有するREQ-036/038などはMODIFIEDにしない。
- 採用478設計からこの環境で正式文書と試験を再構成する。未取得のMac成果を回収・再現したとは扱わない。
- 試行の集計表を作り、未取得の時間・費用を推測で埋めない。

## Capabilities

### New Capabilities

なし。

### Modified Capabilities

- `verify`：回答の反映漏れと回答/承認の書き方の案内を2要件として追加する。既存Requirementの本文は変更しない。

## Impact

`packages/kit/src/verify/run.ts` と `format.ts`、再利用するcoreのsplitLines/fenceMaskの公開export、新しいID付きkit/CLI試験、changeset、試行記録が対象。✔・✖・!、既存blocking詳細、doneの不足/要判断、v2 JSON構造・終了コード・旧試験のassert・期待値・期限・設定は保つ。

通常L3・specgate・意味のあるRED/GREEN・正常local done・3 OS/正常CI・独立レビューへ進む。設計採用とMac停止/再構成は承認済みだが、最終マージは試行の確認点として別途人に確認する。#282製品実装はこのPRのマージ後とし、同時に実装する通常試行は1件を保持する。
