# 仕様の不備 2 件の修正（scenario-audit-scope の archive と Scenario「明示を優先する」）

1. やったこと：scenario-audit-scope の 500 字を超えた REQ-189 を、意味を変えずに REQ-189（対応のレビューと根拠の条件）と REQ-347（試験の本文ブロックのハッシュ）に分け、本文ブロックの試験 11 件の名前の ID を [REQ-347] に直して archive した。change `spec-fixups-1031`（タスク 1.1〜3.1）で Scenario「明示を優先する」と「変えたファイルとブランチ名を合わせる」の文言を実装・試験（REQ-343 どおり）に合わせて直し、#194 後の台帳を土台に 5 行を試験を読み直して reviewed にした。
2. verify の結果：`pnpm -s verify --change spec-fixups-1031 --done` は exit 0（全体の test は 1661 件成功・8 件 skip）で、`openspec validate --specs --strict` は 30/30。
3. 残っている確認事項・仮定：SCN-d31a4872・SCN-711b5333・SCN-2f7149cc の THEN は tier-ci-gate の archive ですでに試験と一致していたため、仕様は変えず台帳だけを reviewed に戻した。SCN-149eab9b・SCN-366e01b5 は archive 後のハッシュで記録したため、spec-fixups-1031 の archive までは無効のまま残る。archive で本文が変わった REQ-188〜190 の Scenario 6 件は再確認し、終了コード 1 を確かめる試験がない「未確認が残る」だけを unreviewed に戻した。
4. 次にやること：管理役が CI とレビューを確かめ、spec-fixups-1031 を archive する。REQ-347 は管理役が Issue #121 で予約する。

計測（このブランチの全体試験レポートで `node scripts/scenario-audit.mjs` を実行。main は同じレポートの試験名を main の名前に戻して計測）：

| 状態 | 前（origin/main 7359d89） | 後（このブランチ） | 参考：spec-fixups-1031 を archive した場合 |
|---|---|---|---|
| 確認済み | 449 | 451 | 453 |
| 未確認 | 233 | 240 | 240 |
| 無効 | 13 | 12 | 10 |
| 未知参照 | 0 | 0 | 0 |
| 全件（監査の対象） | 695 | 703 | 703 |
| 未着手（終了コードに含めない） | 143 | 131 | 129 |

main の無効 13 件は tier-ci-gate の archive で変わった Scenario（monorepo 11・agents-rules 2）。後の無効 12 件は、monorepo 10（archive 待ちの 2 件を含む）と agents-rules 2。REQ-188〜190 の 6 件は再確認し、5 件が reviewed、「未確認が残る」が unreviewed。全件が 8 件増えたのは、scenario-evidence-audit の Scenario が 7 件から 15 件になったため。

| PR | 設計待ち | 実装 | CI 待ち | レビュー往復回数 | マージまで |
|---|---|---|---|---|---|
| [#196](https://github.com/loomake/loomake/pull/196) | 対象外（依頼で方針を受領） | 約 10 分（worktree 作成 11:31 JST から完了ゲート成功 11:40 JST まで。rebase と追加の Scenario は別に約 15 分） | 進行中 | 0 | 進行中 |
