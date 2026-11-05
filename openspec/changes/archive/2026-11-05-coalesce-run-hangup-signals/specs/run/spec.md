## MODIFIED Requirements

### Requirement: 2 回目の信号での強制終了
`loomake run` は SIGINT・SIGTERM・SIGHUP を通算し、2 回目を受けたら初回の中断処理（プロセス停止・記録保存）を待たず、その信号の 128+番号（SIGINT=130、SIGTERM=143、SIGHUP=129）で終了する SHALL。ただし、初回が SIGHUP の場合だけ、そのハンドラー実行から 100 ミリ秒未満に扱う SIGHUP は重複配送として数えない SHALL。経過時間は時刻変更に左右されない単調な時計でハンドラー実行時点の間を測り、重複によって期間の始点を延長しない SHALL。100 ミリ秒以上の SIGHUP と異種の信号は 2 回目として扱う SHALL。同期処理中の信号は、処理が終わりハンドラーを実行できるところで扱う SHALL。初回の扱い（REQ-124・REQ-208）は維持する SHALL。強制終了では summary.json の作成、エンジンとその子の停止完了、実行ロックの解放を保証しない。

Source: REQ-427

#### Scenario: 同じ信号を 2 回受ける
- **WHEN** run が SIGINT を受け、中断処理が終わる前にもう一度 SIGINT を受ける
- **THEN** 中断処理の完了を待たず、終了コード 130 で終わる

#### Scenario: 異なる信号を 2 回受ける
- **WHEN** run が SIGTERM のあとに SIGHUP を受ける
- **THEN** 信号を通算し、終了コード 129 で終わる

#### Scenario: SIGHUP の重複配送を受ける
- **WHEN** エンジンの実行中に SIGHUP を受け、そのハンドラーを実行してから 100 ミリ秒未満にもう一度 SIGHUP を受ける
- **THEN** 1 回の中断として扱い、summary.json は interrupted、終了コードは 1 で、エンジンのプロセスは残っていない

#### Scenario: 時間をおいて SIGHUP をもう一度受ける
- **WHEN** 初回 SIGHUP のハンドラーを実行してから 100 ミリ秒以上たち、中断処理が終わる前にもう一度 SIGHUP を受ける
- **THEN** 中断処理の完了を待たず、終了コード 129 で終わる

#### Scenario: 重複配送で期間を延長しない
- **WHEN** 初回 SIGHUP のハンドラーの実行から 99 ミリ秒後と 100 ミリ秒後に SIGHUP を受ける
- **THEN** 99 ミリ秒後は重複配送として数えず、100 ミリ秒後は終了コード 129 で強制終了する
