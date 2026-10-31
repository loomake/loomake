# Tasks

## 1. 仕様

- [x] 1.1 子changeを作り、親からREQ-073・324を移す。承認事項をtraceに書く

## 2. Evidenceの現行の名前

- [x] 2.1 core：`Evidence`・`evidenceSchema`・`EVIDENCE_SCHEMA_VERSION`・`schema/evidence.schema.json` をEvidence 2にし、利用側（trace・runner・配布物の検査・公開型の利用例）を合わせる
- [x] 2.2 trace report：未対応の版・版の混在・状態別の必須欄の欠けを、ファイルと不正な箇所を示して拒否する。record → reportの往復を試験する（REQ-073）

## 3. CLIのhelpと文書

- [x] 3.1 `--skip-commands` のhelpをREQ-040の動きに合わせ、基準の差分を承認元つきで記録する。CLIリファレンスを再生成する（REQ-324）
- [x] 3.2 互換性の文書とroot `quality.yaml` を置く

## 4. 受入

- [x] 4.1 lint・typecheck・全体試験と `pnpm -s verify --change verify-v2-evidence --done` を通す <!-- loomake:gate=done -->
