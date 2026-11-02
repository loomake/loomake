<!-- 対象の change-id を書く。コードを変えるのに change がないときは none と書く（CI の gate ジョブが読む） -->
loomake-change: <change-id>
<!-- 工程の段階（AGENTS.md 2 章）。gate が変更パスから決めた段階を、上げる方向にだけ上書きできる -->
loomake-tier: L1|L2|L3

## 変える問題と結果

## 公開契約と移行

<!-- 書き方は docs/dev/compatibility-changes.md を参照。該当しない項目にはその旨を書く。 -->

- 変更理由・影響する公開契約と利用側：
- パッケージと形式のバージョン・changeset：
- 利用側の移行方法・旧形式を読む範囲と再利用する範囲：
- 維持する旧fixture・追加する新fixture・対応を外す場合の根拠：
- 契約テスト・配布物の検証結果と未確認の範囲：

## 実行したゲートとテスト

- [ ] `pnpm -s verify --change <change-id> --done --scope local` が exit 0（ローカル。change を持つ PR。L3 は change が必須）
- [ ] gate ジョブの完了ゲート（scope ci）と必須チェックが成功（マージ前に確認する）
- [ ] `pnpm lint`・`pnpm typecheck`・`pnpm test`

## 確認事項・仮定と決定の記録

<!-- 該当しなければ「なし」。trace の ID を使い、選択肢・具体案・決定を明確にする。回答の仕方は ADR 0006。確認事項の回答者は「利用者（ADR 0006 の包括承認）」と書く。 -->

| ID | 問い・選択肢 | おすすめと理由 | 回答待ちで止まる作業 | 状態・決定・承認元 |
|---|---|---|---|---|

## 人の判断が必要な項目

<!-- ADR 0006 の 4 項目（npm 公開・public 化・リリース・規則の変更）と、L3 で 2 往復しても重大な指摘が残った場合だけ、Issue #121 にまとめて @rrr-www を呼ぶ。 -->

## 未確認の環境と検証の制約

## 証跡

<!-- マージ対象 head ごとに、この節のブロック 1 つだけを書く。差分を変えたら書き直す。文法の正本は delivery スキル「マージと証跡」。L1 は工程行を書かなくてよい。review は回ごとに 1 行。レビュー前・CI 前は review: 未実施、quality: 未実施とし、未確認の結果を実施済みにしない。<…> を実値に置き換える。 -->

```text
head: <マージ対象の 40 桁 SHA>
tier: <gate の出力行。例 loomake-tier: L2（scripts/ci-gate.mjs）>
route: <normal|hard-bug>（経路を選んだ理由）
survey: 実施済み by=opus session=<36字UUID> model=<実際のモデル識別子>
second-opinion: 対象外
design: 実施済み by=opus session=<36字UUID> model=<実際のモデル識別子>
implement: 実施済み by=codex
review: 実施済み round=1 by=opus session=<36字UUID> model=<実際のモデル識別子> head=<40桁SHA> critical=0 minor=0 info=0
reviewed-head: <Opus が最後にレビューした head の SHA。L1 なら「対象外（L1）」、まだなら「未実施」>
quality: 実施済み verify=<pass|fail|対象外> ci=<必須CIのrun-URL>（verifyが対象外なら理由）
codex-review: <Codex 自動レビューが受領した head の SHA（参考。マージ条件ではない）。なければ「未実施」>
process: self-review=<実施者・重大件数>（ほかの欄にない補足）
```

AI のレビュー・CI の成功・マージ・返答がないことを、利用者の新しい承認とは扱わない。
