# E3採集制御の先行分割

1. やったこと：[親PR #185](https://github.com/loomake/loomake/pull/185)から開発用採集制御5moduleと合成試験3fileを原文のまま切り出した。ADR0005とAGENTS2章に従うL2/change不要の開発仕組みで、既採用設計を再利用する。
2. verify：静的import closureはNode組込み・vitest・同じ8file内だけで、製品変更へ依存しない。型・lint・合成108件と通常verify（1718成功・失敗0・既存skip8）は成功した。
3. 残る事項：本PRの独立最終レビュー・必須CI・受入は未実施。親の実4件0/4・P6拒否・4.2〜4.4/5.1/5.2・done/最終受入はPR185に残し、先行分割を親完成へ数えない。
4. 次：依存セットと共有storeを確認して対象/全体検証を行い、管理役のレビューへ引き渡す。commit/push/PR作成とL2独立最終レビューは管理役が行う。
