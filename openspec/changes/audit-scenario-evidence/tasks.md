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

## 5. 未確認の停止条件

- [x] 5.1 未追跡ファイルの表示とカスタムopenspecDirでのrun全体の停止を試験する
- [x] 5.2 実際のCLIへSIGINTを送り、コミット・未完了の変更・記録を確認する
- [x] 5.3 対応表を更新し、`pnpm -s verify --change audit-scenario-evidence --done` を通す <!-- loomake:gate=done -->

## 6. 下限Nodeとオフライン

- [x] 6.1 公式のNode 20.19.0と配布物で実行する検証経路を用意する
- [x] 6.2 通信拒否の対照実験を行い、同じ制限下でtraceとCLIの動作を確認する
- [x] 6.3 実行結果・対応表・評価を更新し、`pnpm -s verify --change audit-scenario-evidence --done` を通す <!-- loomake:gate=done -->

## 7. スキーマと配布物の型の契約

- [x] 7.1 スキーマの削除・改名・版変更を一時コピーで試し、既存の検査が拒否・許可する結果を確認する
- [x] 7.2 配布物の型を利用するTypeScriptのfixtureをコンパイルし、型を壊す対照も確認する
- [x] 7.3 対応表・結果・手順を更新し、`pnpm -s verify --change audit-scenario-evidence --done` を通す <!-- loomake:gate=done -->

## 8. 資源制限と診断の対応

- [x] 8.1 出力・診断・記録予算のScenarioとassertionを読み、対応と不足を整理する
- [x] 8.2 stdout・stderrの上限超過で実際のエンジンと子が停止する試験を補う
- [x] 8.3 対応表と結果を更新し、`pnpm -s verify --change audit-scenario-evidence --done` を通す <!-- loomake:gate=done -->

## 9. 実行判断と重要条件の直接試験

- [x] 9.1 実行判断、既存のドメイン変異試験、テストの弱体化検出のScenarioとassertionを照合する
- [x] 9.2 archive後の対応を照合し、実行結果と評価を更新する
- [x] 9.3 `pnpm -s verify --change audit-scenario-evidence --done` を通す <!-- loomake:gate=done -->

## 10. 削除指示を含む差分仕様の監査

- [x] 10.1 削除と追加・変更の混在、削除指示のみ、通常要件のScenario欠落を回帰テストにし、修正前の失敗を確認する（REQ-188）
- [ ] 10.2 削除指示を一覧の対象外にし、通常要件の検査と既存のID・内容ハッシュを維持する（REQ-188）
- [ ] 10.3 対応表を再照合し、全体監査の結果と不足を記録して `pnpm -s verify --change audit-scenario-evidence --done` を通す <!-- loomake:gate=done -->
