# Design: verify-v2-shape

## Context

親 `verify-v2-c001` の設計（design.md・design-candidate-a.md）を前提にする。この子changeは3つのPRの1本目で、追加だけを行う。マージ後のmainは「coreが2.0.0の形を公開するが、書き出しは1.0.0のまま」という中間状態になる。npm公開は人の操作なので、中間状態は配布されない。

## Goals / Non-Goals

- Goals：2.0.0の形・履歴の形・版付きJSON Schema・終了コードの純関数・quality.yamlの読取・条件判定・件数の集約・Report 2への投影を、既存の振る舞いを変えずに追加する
- Non-Goals：書き出しの切替、CLI・runVerify・trace record・runner・ci-gateへの接続、trace reportのCLIでEvidence 2を受け付けること（REQ-073）

## Decisions

### 1. 名前と版の定数

既存の `VerifyResult`・`verifyResultSchema`・`Evidence`・`evidenceSchema`・`VERIFY_RESULT_SCHEMA_VERSION`（1.0.0）・`EVIDENCE_SCHEMA_VERSION`（1）は、いまの書き出しの型として残す。2本目でこれらを2.0.0とEvidence 2へ切り替える。

| 追加する名前 | 中身 |
|---|---|
| `VERIFY_RESULT_V2_SCHEMA_VERSION`・`verifyResultV2Schema`・`VerifyResultV2` など | 2.0.0の形 |
| `LEGACY_VERIFY_RESULT_SCHEMA_VERSION`・`legacyVerifyResultSchema`・`LegacyVerifyResult` | 1.0.0の形。切替のあとも同じ名前で残る |
| `EVIDENCE_V2_SCHEMA_VERSION`・`evidenceV2Schema`・`EvidenceV2` | verify 2.0.0を埋め込むEvidence 2 |
| `LEGACY_EVIDENCE_SCHEMA_VERSION`・`legacyEvidenceSchema`・`LegacyEvidence` | verify 1.0.0を埋め込むEvidence 1 |

スキーマは既存の遅延loader（`loadVerifyResultSchemas`・`loadTraceSchemas`）から読む。coreの入口からzodを静的に読まない。

### 2. 2.0.0の形

要件定義7.3に従い、ci・localのcompleted/partialとabortedを `z.union` で分ける。`run.errors` の各要素は `kind`（usage・config・permission・tool・network・runtime）・`target`・`message`・`next` を持つ。completedの `run.errors` は空、partialとabortedは1件以上とする。checksは `id`・`result`（共有4値）・`reason`・`evidence`（文字列の配列）を持つ。decisionの `code` は7.3の4種類から始める。既知の禁止キー（localのverdict、abortedのscope・checks・summary・decision・verdict・coverage）は値の型を `never` にして拒否する。未知のキーはREQ-307の経路で保持する。

### 3. 版付きJSON Schema

`packages/core/schema/versions/` に `verify-result-1.0.0`・`verify-result-2.0.0`・`evidence-1`・`evidence-2` の4ファイルを置き、exportsに足す。`$id` は版付きのURLにし、既存のファイルと同じregistryに登録しても衝突しないようにする。既存の8ファイルと `renderJsonSchemas()` の一覧は変えない。

`test/fixtures/schema-history/` には2.0.0を足さない。いまの版付きでないファイルは1.0.0のままで、2.0.0を足すと既存のREQ-053の試験（現在の版が履歴の最大の版以上）が落ちるため。2.0.0の固定には `test/fixtures/schema-versions/` を使い、`scripts/schema-contract-check.mjs` は既存の8試行を `trials` に残したまま、版付きファイルへの試行を `versionTrials` に加える。schema-historyへの2.0.0の追加は、切替を行う2本目に回す。

### 4. quality.yamlの読取

kitは同期のまま、YAMLの解析に `yaml` を使い、Zodスキーマは呼び出し側から受け取る。kitはzodを依存に持たないため、引数の型は `safeParse` を持つ最小の形にする。呼び出し側は `loadQualitySchema()` で得たスキーマを渡す。不在はENOENT、権限はEACCES・EPERMで見分ける。予算を超えたときやシンボリックリンクなど、ほかの読取の失敗はruntimeにする。

### 5. 条件判定と集約

`evaluateQualityConditions(quality, observations)` は対象（UQ・PQ）ごとに `quality:<ID>` のcheckを返す。観測は対象・source・metricで結び付け、状態（measured・incomplete・not_run・unavailable・ineligible・stale・unverified）と値・サンプル数を持つ。measuredで有限の値があり、サンプル数が足りるときだけ比較する。同じ指標の観測が複数あるときは照合できないとして不足にする。`qualitySubjectsGuard` は対象0・全NA・合格証拠の定義なしを不足にする。`summarizeVerifyChecks` はchecksから件数を数え、ciでは `aggregateCiVerdict` でverdictを返し、localではpendingを返してverdictを返さない。

### 6. Report 2への投影

trace reportのCLIはまだEvidence 1だけを受け付ける。既存の試験（REQ-073）が、Evidence 2を「読めない版」として拒否する文言をそのまま確かめているため。この子changeでは版ごとの投影を純関数 `projectEvidence` として追加し、`buildReport` のEvidence 1の経路もこの関数を通す（出力は変えない）。履歴閲覧専用の警告は書き出しの版より古い証拠にだけ付ける。いまの書き出しは1なので、Evidence 1の出力は変わらない。v2のok:trueは「ci・PASS・要判断なし」に限る。failedChecksはFAILと不足のcheckのIDを順に写し、abortedでは空にする。

## Risks / Trade-offs

- REQ-276・302〜305・307の本文には、書き出しやパスを現行版へ切り替える文が残る。これらは2本目で満たし、archiveは3本目のあとなので、主仕様に入るのは切替のあとになる
- REQ-316の「旧fixtureに履歴閲覧専用の警告を加える」は、書き出しを切り替えるまでCLIでは現れない。純関数の試験で確かめる

## Migration Plan

追加だけなので、利用側の移行は要らない。戻すときは追加した名前・ファイル・exportsを消せばよい。
