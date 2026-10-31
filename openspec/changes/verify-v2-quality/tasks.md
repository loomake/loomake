# Tasks

## 1. 仕様

- [x] 1.1 子changeを作り、親の差分仕様からREQ-319を既存IDのまま移す。親のtasks 3.1・3.3とtraceに移したことを書く。`verify --change verify-v2-quality --spec-only` が0

## 2. adapter（純関数）

- [x] 2.1 core：`parseTestReport` を足し、テストごとのstatus・要件ID、ファイル単位のstatus・message・テスト数、`startTime` を返す。`extractTestRequirements` の結果は変えない（REQ-319）
- [x] 2.2 kit：`observeTestReport` を足す。producerと版・対象SHA・基準のhashの前後・レポートの本文とsha256・同じ実行の鮮度・ファイル単位の失敗（テスト0件のfailed）を照合し、`ci.test_report` の `required_subjects_with_failed_tests` の観測を返す。I/O・環境・時計を読まない（REQ-319）

## 3. 受入（1本目）

- [x] 3.1 lint・typecheck・全体試験、changeset（core・kit minor）。`pnpm -s verify --change verify-v2-quality --done` を通す <!-- loomake:gate=done -->

## 4. 接続（2本目）

- [x] 4.1 kit：`runVerify` に `qualitySchema` を足し、changeがあるとき品質コマンドとopenspec validateより前にquality.yamlを読む。doneのciでは必須（不在はaborted 3、誤りは2、権限は3）、ほかのゲートではあれば形だけを確かめる。`loadVerifyQualitySchema()` を公開する（REQ-319）
- [x] 4.2 kit：doneのciで、品質コマンドの前に対象SHAと基準のhashを取り、レポートを消してから実行し、producerと版・前後のSHAとhash・レポートの本文とsha256（`verify/hash.ts` の `sha256Hex`）・実行の時刻・品質コマンドの終了コードをreceiptにまとめ、終了コードが非 0 なら未照合にする（Q-09 A）。`--skip-commands` ではreceiptを作らない。`quality:subjects` と `quality:<ID>` のcheckを足す（REQ-319）
- [x] 4.3 cli・runner・trace：`verify`・`loomake run`・`trace record` からquality.yamlのスキーマを渡す（REQ-319）
- [x] 4.4 既存試験：期待値を変えず、doneのciを使う試験の準備にquality.yaml・git・producer（実際のVitest）・`startTime` 付きのレポートを足す。配布物の試験とAIシナリオ試験の利用先にも足す

## 5. 受入（2本目）

- [x] 5.1 API/CLI統合試験：gitの一時リポジトリで実際のVitestを動かし、正常PASS/0、quality.yamlの誤り2・不在3・権限3、不足1、対象SHAと必須仕様を変えたあとの置き残した結果の拒否、品質コマンドが0以外で終わったときにPASSを返さないことを確かめる（REQ-319）
- [x] 5.2 ルートのquality.yamlの説明を接続後の内容にする。changeset（kit・trace・cli minor、runner patch）
- [x] 5.3 lint・typecheck・全体試験。`pnpm -s verify --change verify-v2-quality --done` を通す <!-- loomake:gate=done -->
