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
