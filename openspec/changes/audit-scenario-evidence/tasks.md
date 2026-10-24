## 1. 対応の根拠

- [x] 1.1 一覧・対応判定・出力をRedからGreenで実装する（REQ-188〜REQ-190）
- [x] 1.2 現行仕様と進行中の全Scenarioを一覧化し、内容を確認した対応と不足を記録する

## 2. 統合検証

- [x] 2.1 更新手順・限界・TDDと監査結果を記録し、既存の製品契約を維持する
- [x] 2.2 `pnpm -s verify --change audit-scenario-evidence --done` を通す <!-- loomake:gate=done -->

## 3. 継続レビュー

- [x] 3.1 verifyとtraceのScenarioの条件・assertionを読み、対応と未確認の理由を記録する
- [x] 3.2 既存仕様に対して不足した検証を、期待値を維持して追加する
- [x] 3.3 対応表と結果を更新し、`pnpm -s verify --change audit-scenario-evidence --done` を通す <!-- loomake:gate=done -->

## 4. runとinitの継続レビュー

- [x] 4.1 run・init・変更検出・PR連携のScenarioとassertionを読み、対応と未確認の理由を記録する
- [x] 4.2 対応表を現在の仕様・試験ソースと照合する
- [x] 4.3 `pnpm -s verify --change audit-scenario-evidence --done` を通し、実行結果と残る不足を記録する <!-- loomake:gate=done -->
