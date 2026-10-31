# Tasks

## 1. 仕様

- [x] 1.1 子changeを作り、親からREQ-040・041・100・311・315を移す。承認事項をtraceに書く

## 2. 書き出しの切替

- [x] 2.1 core：現行のverify結果と `schema/verify-result.schema.json` を2.0.0にし、schema-historyに2.0.0を足す
- [x] 2.2 kit：`runVerify` を2.0.0にし、scopeを受け取る。partialのciにPASSを出さず、localのpartialでは未完了を1以上にする（REQ-040・311）
- [x] 2.3 CLI：`verify --json` を2.0.0にし、終了コードを `verifyExitCode` で決める（REQ-041・311）
- [x] 2.4 trace：recordをEvidence 2で書き出し、reportが読めることを試験する（REQ-315）
- [x] 2.5 runner：完了ゲートと記録をscope:localにする（REQ-100）

## 3. 受入

- [x] 3.1 REQ-050の試験で、レポートの解析を含めて3秒以内を確かめる
- [x] 3.2 配布物の検査とchangesetを足し、`pnpm -s verify --change verify-v2-wiring --done` を通す <!-- loomake:gate=done -->
