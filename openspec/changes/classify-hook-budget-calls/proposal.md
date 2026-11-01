# Proposal: classify-hook-budget-calls

## Why

Issue #116 の単独診断では先行する中断と自callの結果欠損、共有期限と1操作上限を区別し、公開する診断の限界を示す必要がある。PR #276 の診断コードを先に実装してchangeなしとした手順の欠落を訂正し、自己変化するtimeout設定の誤観測を、正規の仕様ゲートと正常doneを通す独立changeで修理する。

## What Changes

- REQ-350：試験用の観測を元関数前の不活性な設定snapshotへ直す。timeout有無・mode・cwdはgetterやProxyを追加評価せず求め、元の引数・同期1回・返値・throwを保持する。
- REQ-351：起動前中断・spawn後の結果欠損・共有期限・1操作上限の既存分類を規範化する。時計窓と1msの許容差を保持し、窓内の明示timeout不明は共有期限と同時上限の可能性、窓より前は条件に応じた未確定とする。
- REQ-352：版2、旧rawのnull投影、匿名の固定4ファイル、閉じた公開schemaと各保存上限・7日保存を保持する。
- 既存の試験名・本文・期待値を保ち、予約済みREQ-350〜352に対応する新しいitを追加する。過去のnone判断は履歴を残して訂正する。

## Capabilities

### New Capabilities

- `ci-external-call-diagnostics`: 外部操作の試験用観測、停止の分類、安全な公開診断を定める。

### Modified Capabilities

なし。製品の `external-process-budget`（REQ-180・182・257）と既存の `ci-budget-clock-diagnostics`（REQ-295・296）は変更しない。

## Impact

対象は `packages/runner/test/process-diagnostics.ts` と対応試験、`tests/external-call-diagnostics.test.ts`・`tests/hook-budget-diagnostics-workflow.test.ts` への追加試験、`docs/dev/testing-across-os.md` と作業記録。既存classifier本体は採用済みの時計窓・版2を保持し、主仕様、製品src、元hook、workflow、設定・予算を変更しない。

Requirementの追加を含むため通常L3で進める。仕様ゲートの成功後に修理へ入り、全19 Scenarioの対応、正常done、3 OS、必須5チェック、作者と設計担当とは別のOpus最終を満たしてから受け入れる。#260の段階受入例外は適用しない。Issue #116の原因解明・修理完了・closeはこのchangeの成果に含めない。

正式化後、M1の修理とID付き追加試験を実施した。正常local doneはexit0となった。最終CI/レビューは未完了。
