# CI共通partition基盤

1. やったこと：L2・changeなしで空の実一覧と共通routingを作り、Vitestと隔離plannerへ接続した。root共有build/packと実Vitestの非空fixtureで選択・注入・cleanup・watchを検証した。[PR #204](https://github.com/loomake/loomake/pull/204)で先行受入を進める。
2. verifyの結果：初回の実Windows CIは既存caseの失敗0、新基盤24件のうち5件がfixtureへの隔離env継承で失敗した。修正後の関連40件に加え、競合したmainの統合後も同じ隔離envとCI設定で関連42件・build・型・lintが成功した。main追加の配布物利用テストをpackage分類と独立した期待一覧に残し、全ファイル照合・元のassert・timeout・skipを保持した。統合前の通常verify・coverageの記録とは区別した。
3. 残っている確認事項・仮定：修正後の全体CI・実3OSと独立再レビューは未実施。実caseの割当と移動、Node20削除、PRのslow除外を含む速度対策1-1の受入はPR184に残す。
4. 次にやること：管理役の差分確認後に、必須CIと実3OSの結果をそろえ、別担当の同じ依頼文・チェックリストによる自己レビューを経て、残る1回の独立再レビューへ渡す。合成fixtureの成功を実caseの独立性や親の完了へ数えない。
