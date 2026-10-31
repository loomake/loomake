# validate-engine-json-result / PR #185

1. やったこと：[PR #185](https://github.com/loomake/loomake/pull/185)のtask2.5でguard差分取得を群化し、対象fileの照合・表示とstderr込み予算を保持した。独立設計2件と管理補正に従い、UTF8境界の曖昧な切断を拒否し、constant textconvの合法なM0は旧挙動へ戻した。
2. verify：通常fullはname-status最終補正前に1回で1813成功・失敗0・既存skip8、元1200file回帰はLinuxで1,277msとなり、Gitfixtureは13群/28呼出を実測した。補正後の新55件＋既存guard/recording55件・型lint/spec-onlyも成功し、最終source全体は次の実CIで検証する。
3. 残る事項：19taskのうち13済/6未で、3.5の実3OS、旧4.2〜4.4/5.1/5.2、実4件0/4、P6拒否、doneと最終受入は未達。旧CIのMac timeout/Windows Git失敗が修理後の実OSで解消したとはまだ扱わない。
4. 次：通常fullの結果を管理役へ返し、commit/push後の必須CI/3OSと独立最終受入を確認する。[旧作業記録](https://github.com/loomake/loomake/blob/62c983a15c44e4dc7554096790c112333b82ab35/docs/worklog/2026-10-31/change-validate-engine-json-result-adoption.md)・[採集前の記録](https://github.com/loomake/loomake/blob/62c983a15c44e4dc7554096790c112333b82ab35/docs/worklog/2026-10-31.md)を履歴に残し、合成/Gitfixtureを実CLI採集へ数えない。

| PR | 設計待ち | 実装 | CI待ち | レビュー往復回数 | マージまで |
|---|---|---|---|---|---|
| [#185](https://github.com/loomake/loomake/pull/185) | 未測定 | 進行中（done未達） | 未測定（結果はPR証跡） | 未実施 | 進行中 |
