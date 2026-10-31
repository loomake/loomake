# Proposal: scenario-audit-scope

## Why

Scenario 監査（`scripts/scenario-audit.mjs`、REQ-188〜190）の台帳 `docs/quality/scenarios.json` は、対応する試験をテストファイル全体の sha256 で記録している。同じファイルの別の試験を足したり直したりしただけで、対応が無効になる。2026-10-31 の main で全体試験を回して監査すると、無効 252 件のうち 206 件が「試験のソースが変更されたか存在しません」だった。

監査は、archive していない change の差分仕様も一覧に入れる。実装中の change のScenarioはまだ試験がないため、未確認に数えられる（main では 173 件）。そのため、主仕様だけを見ても exit 0 にならない。

さらに、監査は CI のどこからも呼ばれておらず、exit 1 でも誰も気づかない。

設計の正本は `.loomake/handoff/design-step6-scenario-audit-2026-10-31.md` の 3.1 章。台帳の再確認（3.2 章）は別の PR で行う。

## What Changes

- 試験のハッシュを、`contains` で選んだ試験の本文ブロック（`it(`・`test(` から対応する閉じ括弧まで）の sha256 に変える。新しい形式の選択条件には `hashScope: "block"` を付ける。`hashScope` のない旧形式は、従来どおりファイル全体のハッシュで照合する。本文ブロックを特定できないときは無効にする（REQ-189）。
- 監査の対象を主仕様（`openspec/specs/`）に限る。archive していない change の Scenario は「未着手」として change ごとに件数だけを出し、終了コードに含めない。未着手の Scenario へのレビューは、未知の参照として扱わない（REQ-188・REQ-190）。
- `node scripts/scenario-audit.mjs --migrate [--dry-run]` を足す。旧形式の選択条件のうち、本文ブロックが記録時から変わっていないと git の履歴で確かめられたものだけを、ブロックのハッシュに書き換える（REQ-346）。この PR では台帳の移行を実行しない（3.2 章の PR-A で行う）。
- `.github/workflows/ci.yml` に警告のジョブ `scenario-audit` を足す。quality の ubuntu が保存した全体試験のレポートを受け取って監査し、監査のステップは `continue-on-error: true` にする。出力は artifact に保存する。設計メモは quality の test のあとに置く案だったが、quality のステップの並びと条件は既存の試験（REQ-144・REQ-214・REQ-289〜291）が固定しているため、別のジョブにした。
- 手順書 `docs/guide/2.guides/4.scenario-audit.md` を新しい対象とハッシュに合わせ、古い一覧 `docs/quality/scenario-audit.md` に「490 件時点の記録」と注記する。

## Capabilities

### New Capabilities

なし。

### Modified Capabilities

- `scenario-evidence-audit`：「Scenarioの一覧と同一性」（REQ-188）、「対応のレビューと成功の根拠」（REQ-189）、「不足と更新の報告」（REQ-190）を変える。「旧形式の対応の移行」（REQ-346）を足す。

## Impact

`scripts/scenario-audit.mjs`・`.github/workflows/ci.yml`・`docs/guide/2.guides/4.scenario-audit.md`・`docs/quality/scenario-audit.md` と、新しい試験 `tests/scenario-audit-scope.test.ts` を変える。既存の `tests/scenario-audit.test.ts` は変えない（旧形式の照合は残す）。製品のコード、公開 API、配布するパッケージは変えないので、changeset は足さない。台帳 `docs/quality/scenarios.json` は変えない。
