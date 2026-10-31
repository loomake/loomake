# Tasks

## 1. 仕様

- [x] 1.1 子changeを作り、親の差分仕様からREQ-319を既存IDのまま移す。親のtasks 3.1・3.3とtraceに移したことを書く。`verify --change verify-v2-quality --spec-only` が0

## 2. adapter（純関数）

- [ ] 2.1 core：`parseTestReport` を足し、テストごとのstatus・要件ID・`startTime` を返す。`extractTestRequirements` の結果は変えない（REQ-319）
- [ ] 2.2 kit：`observeTestReport` を足す。producerと版・対象SHA・基準と証跡のhash・同じ実行の鮮度を照合し、`ci.test_report` の `required_subjects_with_failed_tests` の観測を返す。I/O・環境・時計を読まない（REQ-319）

## 3. 接続

- [ ] 3.1 `runVerify` がquality.yamlを読む。`qualitySchema` と `loadVerifyQualitySchema()` を足し、不正はconfig 2、不在・読取不能はruntime 3、権限はpermission 3のabortedを結果で返す。CLI・runner・trace recordからスキーマを渡す（REQ-319）
- [ ] 3.2 doneのciで、品質コマンドの前後にHEAD・基準のhash・レポートを集めてadapterに渡し、`quality:subjects` と `quality:<ID>` をchecksに足す。既存試験の準備にquality.yaml・git・producerを足し、期待値は変えない（REQ-319）

## 4. 試験

- [ ] 4.1 REQ-319：正常PASS/0、不正aborted 2・3、不足1、置き残した古い結果の拒否を、gitの一時リポジトリと実際のVitestでCLIとAPIから確かめる

## 5. 受入

- [ ] 5.1 lint・typecheck・全体試験、changeset（core・kit minor、cli・trace・runner patch）。`pnpm -s verify --change verify-v2-quality --done` を通す <!-- loomake:gate=done -->
