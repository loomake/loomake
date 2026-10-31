# Tasks

## 1. 仕様

- [x] 1.1 子changeを作り、親の差分仕様からREQ-319を既存IDのまま移す。親のtasks 3.1・3.3とtraceに移したことを書く。`verify --change verify-v2-quality --spec-only` が0

## 2. adapter（純関数）

- [x] 2.1 core：`parseTestReport` を足し、テストごとのstatus・要件ID、ファイル単位のstatus・message・テスト数、`startTime` を返す。`extractTestRequirements` の結果は変えない（REQ-319）
- [x] 2.2 kit：`observeTestReport` を足す。producerと版・対象SHA・基準のhashの前後・レポートの本文とsha256・同じ実行の鮮度・ファイル単位の失敗（テスト0件のfailed）を照合し、`ci.test_report` の `required_subjects_with_failed_tests` の観測を返す。I/O・環境・時計を読まない（REQ-319）

## 3. 受入（1本目）

接続（quality.yamlの読取とrunVerifyへの接続、CLI/runner/traceへのschema渡し、統合試験）は、2本目のPRでtask 3.x・4.x・5.xとして足す。

- [x] 3.1 lint・typecheck・全体試験、changeset（core・kit minor）。`pnpm -s verify --change verify-v2-quality --done` を通す <!-- loomake:gate=done -->
