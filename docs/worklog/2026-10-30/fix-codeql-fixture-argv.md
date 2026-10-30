# 子プロセス試験のパスを引数として渡す

[PR #173](https://github.com/loomake/loomake/pull/173)。本文作成時点の記録で、以後のhead別結果はPRを参照する。

1. やったこと：Issue167のfixture修理（ADR0005、製品changeなし）。Opus設計と補足設計に従い、3ファイル各2行でleafコードを定数にし、パスを区切り付きの引数へ移した。既存のassert・期限・対象外・品質設定を維持した。
2. verify：コミット前の実装ツリーで対象3ファイル70試験が成功した。初回固定headの通常verifyは容量不足と空changeset不足で不合格。対処後の新headでの通常verify・CI・CodeQL再解析・自動Codex・独立Opusはこれから。製品spec-only・doneは対象外で、詳細はPR本文に残す。
3. 確認事項・仮定：追加なし。mainのalert15・16・17はopenで、PR側の結果をmainのfixedとは扱わない。Node22.12のfixture実機、相対TMPDIRでの試験全体は未確認。
4. 次にやること：同じheadの通常verify・全OS CI・自動Codex・独立Opusを確認し、既存管理役へ受入を引き継ぐ。マージ後のmain解析までIssue167の解消済みとは報告しない。
