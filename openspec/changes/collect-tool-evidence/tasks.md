# Tasks

## 1. 計画

- [x] 1.1 REQ-448〜450 の仕様・trace と Q-P2-01〜08 の決定を記録し、strict と spec-only を通す。

## 2. core の中立変換

- [x] 2.1 中立型・共通読取り・gh parser と REQ-448 試験、gh fixture の出典を追加し、対象試験を通す。
- [x] 2.2 Claude parser と REQ-448 試験、合成 fixture の限界を追加し、対象試験を通す。
- [x] 2.3 Codex parser と REQ-448 試験、fixture の出典を追加し、対象試験を通す。
- [x] 2.4 Biome parser と REQ-448 試験、fixture の出典を追加し、対象試験を通す。
- [ ] 2.5 Playwright parser と REQ-448 試験、fixture の出典を追加し、対象試験と B1 の全差分計測を確認する。

## 3. kit の収集

- [ ] 3.1 collectToolOutput・3 つの引数生成関数と REQ-449 の 5 分類・共有予算・env・入力検査の試験を追加し、対象試験を通す。
- [ ] 3.2 REQ-450 の stdout・stderr・limited・mask 失敗・例外の漏洩試験を追加し、対象試験を通す。

## 4. 統合と検証

- [ ] 4.1 公開型の consumer fixture・kit-layers の collect 検査・README・core/kit patch changeset を追加し、型・依存・文書の検査を通す。
- [ ] 4.2 全 Scenario と要件対応テストを確認し、通常の `pnpm -s verify --change collect-tool-evidence --done --scope local --json` を通して worklog と計測表を残す。 <!-- loomake:gate=done -->

## Workflow follow-up

- 管理役が独立レビュー・必須 CI・ci:all-os を確認し、通常 L3 として受け入れる。
- P3（REQ-451〜453・REQ-070）と親 #65 の完成は後段に残す。
