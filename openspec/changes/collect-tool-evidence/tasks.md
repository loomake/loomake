# Tasks

## 1. 計画

- [x] 1.1 REQ-448〜450 の仕様・trace と Q-P2-01〜08 の決定を記録し、strict と spec-only を通す。

## 2. core の中立変換

- [x] 2.1 中立型・共通読取り・gh parser と REQ-448 試験、gh fixture の出典を追加し、対象試験を通す。
- [x] 2.2 Claude parser と REQ-448 試験、合成 fixture の限界を追加し、対象試験を通す。
- [x] 2.3 Codex parser と REQ-448 試験、fixture の出典を追加し、対象試験を通す。
- [x] 2.4 Biome parser と REQ-448 試験、fixture の出典を追加し、対象試験を通す。
- [x] 2.5 Playwright parser と REQ-448 試験、fixture の出典を追加し、対象試験と B1 の全差分計測を確認する。

## 3. kit の収集

- [x] 3.1 collectToolOutput・3 つの引数生成関数と REQ-449 の 5 分類・共有予算・env・入力検査の試験を追加し、対象試験を通す。
- [x] 3.2 REQ-450 の stdout・stderr・limited・mask 失敗・例外の漏洩試験を追加し、対象試験を通す。

## 4. 統合と検証

- [x] 4.1 公開型の consumer fixture・kit-layers の collect 検査・README・core/kit patch changeset を追加し、型・依存・文書の検査を通す。
- [x] 4.2 全 Scenario と要件対応テストを確認し、通常の `pnpm -s verify --change collect-tool-evidence --done --scope local --json` を通して worklog と計測表を残す。 <!-- loomake:gate=done -->

## Workflow follow-up

- 管理役が独立レビュー・必須 CI・ci:all-os を確認し、通常 L3 として受け入れる。
- P3（REQ-451〜453・REQ-070）と親 #65 の完成は後段に残す。

## 5. PR #460 の Opus R1 修理

- [x] 5.1 REQ-450 の stderr 切り口で既知の形が現れる回帰試験の失敗を確認し、全文の置換・4096 文字の上限・UTF-16 境界を保って切り出し後も置換する。
- [x] 5.2 公開 consumer の requirementIds・errorLine の非公開検査を別々にし、型・対象試験・pack した配布物を確認する。
- [x] 5.3 通常の `pnpm -s verify --change collect-tool-evidence --done --scope local --json` を clean head で通し、R1 の修理と検証を同じ journal・PR 本文案へ記録する。 <!-- loomake:gate=done -->
- [x] 5.4 PR #460 の試験 fixture を保守し、各ケースを独立した Git リポジトリへコピーする。既存の入力・期待値・制限時間を保ち、後始末に既存の有界再試行を使う。
- [x] 5.5 fixture の独立性・全 94 ケース・REQ-376・型・lint を確認し、clean head で通常の完了ゲートを通す。 <!-- loomake:gate=done -->
