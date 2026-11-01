# Tasks: define-pillar1-delivery-metrics

仕様ゲート成功後に以下の順で進める。採用設計Bの文書・様式・追加試験・READMEを対象とし、CLIや実測へ広げない。

## 1. 定義文書と様式

- [x] 1.1 `docs/metrics/delivery-metrics.md` に5項目の定義・6属性・4状態・14日観測・Loomakeなしの扱いとFR-50対応表を作る。採用設計との欄の照合で不足がなく、未取得を0にしないことを確認する。
- [x] 1.2 `docs/effort/template.md` の既存全文を保持して、柱1の比較情報・5行の値/単位/状態/取得元/観測期間・理由/終了予定日の節を追記する。基点の全文prefix一致と、既存の5区分・内数説明・固定推定の規則を確認する。

## 2. 文書を読む追加試験

- [x] 2.1 `tests/development-decisions.test.ts` へREQ-364/365の6 Scenario対応の試験を追加する。定義表の行欠落/属性空欄、記録の状態別正例・負例、Loomakeなしの非該当と実記録検査、FR-50対応、旧欄保持を確認し、既存試験を変えず対象試験を成功させる。

## 3. 参照と記録

- [x] 3.1 `docs/metrics/README.md` に定義文書へのリンクを追記し、#68がeffort CLI・効率表を所有する対応を明記する。文書リンク試験と元READMEのprefix保持を確認し、4項目worklogとL3計測表、レビュー用資料を揃える。外部への投稿は管理役が行う。

## 4. 正常完了ゲート

- [ ] 4.1 管理役が他担当の重い実行との重複を避けて開始を調整したあと、省略指定なしの `pnpm -s verify --change define-pillar1-delivery-metrics --done --scope local --json` を1回実行する。lint・型・全件試験をこのdoneへ統合し、実exitを即保存して、6 Scenarioの成功試験と全task、実行時入力から最終source/spec/tasksへの対応を照合する。 <!-- loomake:gate=done -->

## Workflow follow-up

- 管理役がPRを通常L3/対象changeへ設定し、新しい独立Codex/Opus、正常CI done・必須5チェック・3 OSの結果を確認してmainへ採用する。独立レビューやCI/main採用をゲート前taskの完了へ代用しない。
- 正常受入後にsync/archiveし、既存development-decisionsへADDED2件と6 Scenarioを反映する。11月7日以降の実記録はこのchangeの実装と分ける。
- #68へFR-50対応表の参照を管理役が伝える。#273の保留、外部案件の準備、私的ログ・metrics-data・実測値は本changeの対象にしない。
