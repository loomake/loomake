# Proposal: verify-v2-shape

## Why

C-001（親change `verify-v2-c001`）を3つのPRに分ける。この1本目ではverify 2.0.0の契約の形と、それを読む純関数を追加だけで用意する。書き出しと利用側の切替（2本目 `verify-v2-wiring`）と正常PASSの受入（3本目、親）は、この形を前提に進める。出典は要件定義7.1・7.3、固定WBS v1.4のJ01〜J04と5章C-001。

## What Changes

- core：verify 2.0.0のZodスキーマと導出型を追加する。ci/local×completed/partialとabortedを区別し、`run.errors`、禁止キー、未知キーの保持を扱う。履歴用の `LegacyVerifyResult`・`LegacyEvidence` と、Evidence 2のスキーマ・型も別名で公開する
- core：版付きのJSON Schema（verify 1.0.0・2.0.0、Evidence 1・2）を追加のパスとexportsで公開する。`scripts/schema-contract-check.mjs` に、版付きパスへの変更の検出を加える
- kit：終了コードを選ぶ純関数 `verifyExitCode`、root `quality.yaml` の予算付き読取、限定した品質条件の判定 `evaluateQualityConditions`、checksの件数集約を追加する
- trace：Evidence 1とEvidence 2を版ごとに既存のReport 2へ投影する純関数を追加する

## Non-goals

- 書き出しの切替。`VERIFY_RESULT_SCHEMA_VERSION` は1.0.0、Evidenceの書き出しは1のまま。版付きでないJSON Schemaのパスも1.0.0のまま
- CLI・runVerify・trace record・runner・ci-gateへの接続（`verify-v2-wiring`）
- trace reportのCLIでEvidence 2を受け付けること（REQ-073。親に残す）
- 正常PASSの最小接続、`--scope` のCLIフラグ、文書の移行（親）

## Capabilities

### Modified Capabilities

- `core-parsers`：verify 2.0.0と履歴1.0.0、Evidence 2と履歴Evidence 1のスキーマ・型・版付きJSON Schemaを分けて公開する（REQ-274〜276・302〜305・307〜309）
- `external-process-budget`：予算だけを変える変更と、形式の版を上げる変更を区別する（REQ-183）
- `reference-docs`：quality生成/check単独の不変範囲を限定する（REQ-322）
- `trace-report`：新旧の証拠を版ごとに既存Report 2へ投影する（REQ-316）
- `verification-policy`：限定した条件判定と件数の集約を追加する（REQ-306・313・314）
- `verify`：quality.yamlの最小読取を追加する（REQ-310）

## Impact

対象は `packages/core`・`packages/kit`・`packages/trace` と `scripts/schema-contract-check.mjs`。kitの実行時依存に `yaml` を加える（REQ-047の許容範囲）。既存の公開名・JSON Schemaの内容・旧fixture・既存試験の期待値は変えない。changesetはcore minor・kit minor・trace patchで、いずれも追加だけ。

Requirementは親から既存IDのまま移した。新しいREQ-IDは作らない。archiveは3本目のPRのあとに行う。
