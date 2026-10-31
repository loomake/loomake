# E3採集制御の先行分割

1. やったこと：[親PR #185](https://github.com/loomake/loomake/pull/185)から開発用採集制御5moduleと合成試験3fileを切り出し、最新mainを統合した。独立レビューのC1/m2〜m4に従い、製品REQタグ削除、旧合成harnessのlistener回収とerror時停止要求、Git環境の存在拒否、開発文書を加えたため、親原文とは同一でなくなった。
2. verify：旧108件のassertを維持し、追加11件を含む合成119件・型・lint・通常verify（1814成功・失敗0・既存skip8）は成功した。最後にP2否定fixtureを対象Git変数だけへ是正して対象119件・lintを再確認し、全体verifyはその入力是正前の結果として扱う。
3. 残る事項：m1のskip提案は採用せず、3OS CIと残1回の独立再レビューで確認する。実4件0/4・P6拒否・4.2〜4.4/5.1/5.2・done/最終受入は親PR185に残し、本PRの合成結果を実採集や実停止の保証へ数えない。
4. 次：修正をcommit/pushし、管理役へci:all-osと独立再レビューを依頼する。親の同8fileへの同期はpatchで引き渡し、実起動・資格adapter・保存・台帳は追加しない。
