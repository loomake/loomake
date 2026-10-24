## ADDED Requirements

### Requirement: 終了の信号での中断
`loomake run` は、SIGTERM と SIGHUP を受けたときも、SIGINT と同じく中断として扱う SHALL。エンジンとその子のプロセスを止め、REQ-124 と同じ記録（中断した旨の summary.json、終えたタスクのコミット、途中の変更の作業ツリー）を残してから、終了コード 1 で終わる SHALL。loomake が終わったあとに、エンジンのプロセスを残さない SHALL。品質コマンドや git のような同期の処理のあいだに届いた中断は、その処理が終わったところで扱い、証拠の記録・push・PR の作成に進まない SHALL。

Source: REQ-208

#### Scenario: SIGTERM で中断する
- **WHEN** 1 つ目のタスクを終えたあと、2 つ目のタスクのエンジンの実行中に、配布物の CLI が SIGTERM を受ける
- **THEN** 終了コードは 1 で、summary.json の状態は interrupted、終えたタスクは 1.1 だけで、エンジンのプロセスは残っていない

#### Scenario: SIGHUP で中断する
- **WHEN** 同じ状況で、配布物の CLI が SIGHUP を受ける
- **THEN** SIGTERM のときと同じく中断として記録し、エンジンのプロセスは残っていない

#### Scenario: 品質コマンドのあいだに中断する
- **WHEN** 完了ゲートの品質コマンドの実行中に、CLI が SIGTERM を受ける
- **THEN** 品質コマンドが終わったところで中断として止まり、終了コードは 1 で、push も PR の作成もしない
