# CIの行登録配線を独立に検査する

1. [PR #283](https://github.com/loomake/loomake/pull/283)で、`split-slow-ci-checks` task2.7のR4部分として、独立checkerと正規source/native対照を実装した。D1/D2=Aを記録し、[PR270](https://github.com/loomake/loomake/pull/270)の指定統合受入に基づくtask2.8だけを完了へ進めて7/21とした。
2. 実装前後の`verify --change split-slow-ci-checks --spec-only`、lint、typecheck、限定229件はexit 0。通常テストは156 file成功・2579 passed・既存8 skippedでexit 0となり、新fixtureの11子processのrawをassert前とcleanup前に保存した。
3. D1/D2は利用者（ADR 0006 の包括承認）、仮定は管理役が理由を添えて承認済み。旧11call/16行/EMPTYと旧APIの期待・timeout・空registry・metadata19・設定は保持し、実registry適用0回、task2.7全体・一般oracle・実登録/OS/slow配線・3OS/CI/最終レビューは未達として残す。
4. 管理役の独立確認・Opusレビュー・CI・指定統合受入へ渡す。補助担当はpush・GH操作・Opus起動を行わず、親changeの完了やマージを宣言しない。
