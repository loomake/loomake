# Proposal: verify-v2-gates

## Why

C-001（親change `verify-v2-c001`）を分けた3/6。2b-1/6でverifyは2.0.0を書き出したが、warn・skip・未承認・確認待ちの扱いはまだ旧verifyのままである。doneの確認待ちはFAILで、要判断（decision）は組み立てておらず、OpenSpec CLIが無いlocalはPASSの案内のままで、NOT_APPLICABLEにする経路もない。この子changeで、R-C001-08のB案（2026-10-30承認、PR #139）どおりに分類を揃える。出典は要件定義7.3、設計メモ（design-step8b、3.4の未済4点）。

## What Changes

- spec-only：未承認の仮定と確認待ちの要件は、PASSの案内（reason）に残す。pending・要判断にせず、終了コードは0（REQ-036）
- done：未承認の仮定と確認待ちの要件は、INSUFFICIENT_EVIDENCEと `decision.required`（APPROVAL_REQUIRED）にして、終了コードは1（REQ-036・038）
- openspec validate：auto設定でCLIが無いとき、scope:localは理由と確認者つきのNOT_APPLICABLE、scope:ciは不足にする。明示trueは従来どおり不合格（REQ-037）
- 未知キーは全モードで理由つきPASS、`--skip-commands` は不足で1（REQ-039・191。振る舞いは変えず、試験で固定する）
- 仮定の承認後は、spec-onlyの案内とdoneの不足・要判断理由からその仮定が消える（REQ-203）
- spec-onlyでは品質項目（quality:）を数えない（R-C001-10 A）。今のverifyが品質項目を持たないので、試験で固定するだけである

## Non-goals

- `--scope` のCLIフラグ、help、5.cli.md、基準差分（4/6）
- quality.yaml の接続と `ci.test_report`（5/6）
- 規約・雛形の更新（5b/6）

## Capabilities

### Modified Capabilities

- `verify`（REQ-036・037・038・039・191）
- `trace-agreement`（REQ-203）

## Impact

既存試験の期待値は、doneの確認待ち（fail→不足）、OpenSpec CLI不在（案内→NOT_APPLICABLE）、仮定承認の試験の語（警告→案内）だけを変える。変えた箇所はPR本文の表に載せる。docs/guide の warn の説明も合わせる。archiveは6/6のあとに行う。
