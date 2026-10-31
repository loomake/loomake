## ADDED Requirements

### Requirement: macOS と Windows の実行環境の記録

quality の macOS・Windows のシャードと隔離のジョブは、テストの前に心拍の記録を裏で起動する SHALL。心拍は 1 秒ごとに時刻・間隔・一時ディレクトリと `RUNNER_TEMP` への 4KiB の書き込みと fsync の時間を、10 秒ごとに `node -e 0` と `git --version` の起動時間を記録し、8MiB で止める SHALL。停止時に記録の数・間隔の最大値・5 秒を超えた間隔の回数を要約に出す SHALL。試験は `LOOMAKE_CI_HEARTBEAT_DIR` があるときだけ、固定のラベルの段階を同じ場所に記録してよい。記録の失敗で試験とジョブの成否を変えず、生の出力・引数・環境値を記録しない MUST。記録はキャンセルされていなければ成否によらず 7 日保存する SHALL。

Source: REQ-345

#### Scenario: 心拍の記録
- **WHEN** 心拍を短い間隔で数回動かす
- **THEN** 各行に時刻・間隔・2 つの書き込み時間があり、決めた回ごとに node と git の起動時間がある

#### Scenario: 止まった区間の要約
- **WHEN** 間隔が 1 秒・7 秒・1 秒・12 秒の記録を要約する
- **THEN** 記録は 4 件、間隔の最大値は 12 秒、5 秒を超えた間隔は 2 回と表示する

#### Scenario: 記録の失敗
- **WHEN** 記録先がファイルで、ディレクトリを作れない
- **THEN** 心拍の開始と停止と段階の記録は例外を投げず、終了コード 0 で終わる

#### Scenario: CI での保存
- **WHEN** `.github/workflows/ci.yml` と `.github/workflows/quality-quarantine.yml` を読む
- **THEN** シャードのあるジョブと隔離のジョブで、テストの前に心拍を起動し、テストのあとにキャンセルされていなければ停止と 7 日の保存を行う。ubuntu のジョブでは起動しない
