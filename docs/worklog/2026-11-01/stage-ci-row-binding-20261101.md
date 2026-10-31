# CIの行登録配線を独立に検査する

1. [PR #283](https://github.com/loomake/loomake/pull/283)で、`split-slow-ci-checks` task2.7のR4部分として、独立checkerと正規source/native対照を実装した。D1/D2=Aを記録し、[PR270](https://github.com/loomake/loomake/pull/270)の指定統合受入に基づくtask2.8だけを完了へ進めて7/21とした。
2. 実装前後の`verify --change split-slow-ci-checks --spec-only`、lint、typecheck、限定229件はexit 0。通常テストは156 file成功・2579 passed・既存8 skippedでexit 0となり、新fixtureの11子processのrawをassert前とcleanup前に保存した。
3. D1/D2は利用者（ADR 0006 の包括承認）、仮定は管理役が理由を添えて承認済み。旧11call/16行/EMPTYと旧APIの期待・timeout・空registry・metadata19・設定は保持し、実registry適用0回、task2.7全体・一般oracle・実登録/OS/slow配線・3OS/CI/最終レビューは未達として残す。
4. 管理役の独立確認・Opusレビュー・CI・指定統合受入へ渡す。補助担当はpush・GH操作・Opus起動を行わず、親changeの完了やマージを宣言しない。


## PR #283の初回Opusレビュー後の修理

1. [PR #283](https://github.com/loomake/loomake/pull/283)の初回Opus結果（重大0・軽微4・情報4）のM1〜M3を修理した。非value名の誤拒否を42件の正負例で確かめ、R4-D1/D2と仮定を正式表のQ-117/Q-118/A-03へ移し、通常試験の受領物は自身の一時outputへ戻した。
2. M1は修理前26失敗・235成功から修理後261/261成功となり、matrix単独実行も成功した。spec-only・lint・typecheck・限定271件・通常156 file（2621 passed・既存8 skipped）はexit 0で、作業用の一度きりの手順が11 native process・153824 bytesとmatrix103件を別保存し、通常実行前後の旧作業領域398 fileはbytes・hash・mtime・一覧とも不変だった。
3. 旧assert248呼出し・旧診断表・元call/timeout・旧API・旧153747 bytesのraw・旧matrix・空registry・設定と規約を保持した。M4のpartition系mock/dynamic import/setPart差替えは未採用の追加設計として[Issue #241](https://github.com/loomake/loomake/issues/241#issuecomment-6549607787)で管理役が追跡し、既存A8を変えず、実registry適用0回・親7/21・一般oracle5.1と2.7全体の未達を保つ。
4. 管理役の第1再レビューと最終CI・指定統合受入へ渡す。補助担当はpush・GH・Opus・Goal・他agent操作を行っておらず、修理後のレビューやCIの成功を先取りしない。

## PR #283 の P2 指摘と生成sourceの修理

1. `split-slow-ci-checks` task2.7の部分修理として、クラスのextends式にある実値参照と、export specifierから流出するローカル束縛を拒否した。型だけのextends・implements・型引数は受理し、生成headerのfile引数はJSON.stringifyで単一の文字列値に保つ。既存writerの7d7c030cから別worktreeで作業した。
2. 実装前後のspec-only・lint・typecheckはexit 0。最終回帰16件は元実装で12失敗・4成功、修理後は16成功。既存native対照を含む関連287件と、通常156 file・2637件成功・既存skip8件・失敗0件を確認した。生成文字列はASTで元の値へ復元して照合した。
3. 元のdeclarations試験・rows試験・旧fixture・helper・registry・設定・監査・tasks・traceをbyte単位で保持し、旧wiring試験は新import以外の全文を保持した。親7/21とtask2.7全体・実registry適用0回・一般oracle・OS割当の未達を保つ。CodeQLの修理案はローカル確認済みだが、警告の解消は新headのCodeQL実行で確認する。
4. 本体が修理差分をレビューし、remoteと既存writerのHEADを照合してからPRブランチへ渡す。CI・独立再レビュー・指定統合受入は未実施で、補助担当はpushや親完了の宣言を行っていない。


## CodeQL の生成リテラルの修理

1. やったこと：`split-slow-ci-checks` の task 2.7 内で、生成 source の file・marker・行 ID に、JSON 文字列化後の追加エスケープを共通で適用した。CodeQL の `js/bad-code-sanitization` の指摘に対応し、文字列の実値と元 call 本文・期待値・timeout を保持した。
2. verify の結果：追加 7 件は修理前に 4 成功・3 失敗、修理後は全 7 件成功。既存 native 対照を含む関連 294 件、lint・型・仕様ゲートが成功し、通常の生成 source 12 通りと保護対象 14 ファイル・旧試験 prefix の不変も確認した。全体試験と親の完了ゲートは今回は繰り返していない。
3. 残っている確認事項・仮定：CodeQL のリモート警告解消、新 head の必須 CI・3 OS・独立レビューは未確認。親は 7/21・task 2.7 未完了・実 registry 適用 0 回のままで、今回の修理を親の完成へ代用しない。
4. 次にやること：管理役へ追加差分と検証を引き渡す。依頼資料の外部参照で未実施になったレビューの履歴を保持し、同じ新 head の正式依頼・独立確認・CI と CodeQL の警告状態を照合する。


## 型引数付きの実値参照の修理

1. やったこと：`split-slow-ci-checks` の task 2.7 内で、未実施となったレビューの技術所見にある instantiation expression の参照漏れを修理した。型引数付きの式の expression 側を値として扱い、interface の extends・implements・型引数内の参照は消去される型として保持した。
2. verify の結果：新しい正負 16 件は修理前に型参照 6 成功・実値参照 10 失敗、修理後は全 16 件成功。既存 native 対照を含む関連 310 件、lint・型・仕様ゲートが成功した。TypeScript の実 AST と消去後の出力を観測し、保護 14 ファイルと旧試験 prefix、先行 CodeQL 修理の不変も確認した。全体試験と親の完了ゲートは今回は繰り返していない。
3. 残っている確認事項・仮定：元の試験・期待・timeout は変えていない。新 head の必須 CI・3 OS・CodeQL 警告解消・有効な独立レビューは未確認。親は 7/21・task 2.7 未完了・実 registry 適用 0 回のまま。matrix の旧 API 観測の検査については別の追跡を保持する。
4. 次にやること：管理役へ修理差分と保持・検証結果を渡し、専用 tree 内の資料で正式依頼を更新する。起草者とは別の自己レビュー後、有効な独立再レビューと同じ新 head の CI・CodeQL を照合する。
