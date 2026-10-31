# C001 の分割 1 本目「契約の形」（verify-v2-shape）

1. やったこと：子 change `verify-v2-shape` のタスク 1.1〜1.10 を実施した。親 `verify-v2-c001` から 17 件の Requirement（REQ-183・274〜276・302〜310・313・314・316・322）を既存 ID のまま移し、REQ-274 の書き出しの版の文は親の REQ-311 へ移した。core に verify 2.0.0・履歴 1.0.0・Evidence 1/2 のスキーマと型、`schema/versions/` の版付き JSON Schema 4 ファイルを足し、kit に `verifyExitCode`・`readQualityFile`・`evaluateQualityConditions`・`qualitySubjectsGuard`・`summarizeVerifyChecks`、trace に `projectEvidence` を足した。書き出しは 1.0.0・Evidence 1 のままで、CLI にはつないでいない。
2. verify の結果：`pnpm -s verify --change verify-v2-shape --spec-only` と `--done` は exit 0（lint・typecheck・全体の test を含む）。親の `pnpm -s verify --change verify-v2-c001 --spec-only` も exit 0。既存の試験は追加だけで、`git diff origin/main...HEAD -- packages/*/test tests` に消した expect・skip・timeout はない。
3. 残っている確認事項・仮定：設計メモの 18 件のうち REQ-073 は、既存試験（report.test.ts の「読めない版」の文言）を変えずに満たせないため親に残した。schema-history への 2.0.0 の追加は、既存の REQ-053 の試験が落ちるため 2 本目に回し、`test/fixtures/schema-versions/` に写しを置いた。REQ-276・302〜305・307 の本文に残る「現行版への切替」の文は 2 本目で満たす。
4. 次にやること：CI・Codex・独立 Opus のレビューを管理役が確かめる。2 本目 `verify-v2-wiring` で書き出しと利用側を 2.0.0 へ切り替え、REQ-073 の期待値の変更を具体差分として扱う。

| PR | 設計待ち | 実装 | CI 待ち | レビュー往復回数 | マージまで |
|---|---|---|---|---|---|
| change/verify-v2-shape | 対象外（設計メモと PR #180 の候補文書で代替） | 約 27 分（branch 作成 10:18 JST から完了ゲート成功 10:45 JST まで） | 未実施 | 未実施 | 未実施 |
