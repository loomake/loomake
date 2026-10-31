# validate-engine-json-result / PR #185

1. やったこと：[PR #185](https://github.com/loomake/loomake/pull/185)で結果分類・guard後の停止と採集前の限定検証を実装した。今回はレビュー規則を改訂ADRへ合わせ、collector試験の一時rootを既存paths試験と同じrealpathで正規化した。
2. verify：修正前の通常verifyは1763成功・失敗0・既存skip8、修正後の対象60件・型・lint・strict・spec-only15検査も成功した。Linuxの自作parent symlinkで早期拒否を再現し、正規化後は読取・不正JSON・サイズ超過の各検査へ届き、末端symlinkの拒否を維持した。
3. 残る事項：実4件0/4、P6拒否、4.2〜4.4/5.1/5.2とdoneは未完了。3OSは完走したが、大量違反1200ファイル試験のMac87秒/60秒timeoutとWindowsのGit失敗理由による期待不一致は未解決で、Mac祖先link自体も未直接観測である。
4. 次：残る大量違反試験と採集前提を調べ、実観測・L3の必須CI/3OS・独立最終受入をそろえる。[旧作業記録](https://github.com/loomake/loomake/blob/62c983a15c44e4dc7554096790c112333b82ab35/docs/worklog/2026-10-31/change-validate-engine-json-result-adoption.md)と[採集前の記録](https://github.com/loomake/loomake/blob/62c983a15c44e4dc7554096790c112333b82ab35/docs/worklog/2026-10-31.md)は履歴として保持し、合成結果を実採集や実OS停止の証明へ数えない。

| PR | 設計待ち | 実装 | CI待ち | レビュー往復回数 | マージまで |
|---|---|---|---|---|---|
| [#185](https://github.com/loomake/loomake/pull/185) | 未測定 | 進行中（done未達） | 未測定（結果はPR証跡） | 未実施 | 進行中 |
