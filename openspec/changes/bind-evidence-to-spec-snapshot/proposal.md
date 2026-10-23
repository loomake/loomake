# bind-evidence-to-spec-snapshot

## Why
検収レポートは、保存したテストの結果と、作業ツリーにある最新の trace.md・差分仕様を組み合わせて作っている。そのため、証拠を記録したあとで要件の要約を変えると、変えたあとの要約にも古い結果で「合格」が付く。docs/evaluation.md の 2026-10-24 の追加評価で、検収用途では最優先と指摘された。あわせて、自動検査が確かめた範囲（要件 ID を含む成功したテストがあること）をレポートに明記していない。

## What Changes
- trace record は、検証した時点の trace.md と差分仕様の内容・パス・ハッシュを証拠に保存する（REQ-127）
- trace record は、検査の前後で HEAD と作業ツリーを確かめ、途中で変わっていたら記録しない（REQ-128）
- trace report は、証拠に保存した文書から表を作る。記録のあとで変わった文書があれば、そのパスを示す（REQ-070・REQ-129）
- 検証した時点の文書を持たない古い形式の記録では、「仕様との対応は未確認」と示し、合格とだけは表示しない（REQ-130）
- レポートに、自動検査が確かめた範囲と、人のレビューが必要な範囲を書く（REQ-131）

## Non-goals
- 記録した SHA のコミットから文書を復元すること
- 成功したテストの名前をレポートに載せること（verify の結果の形を変える必要があるため、別の change で扱う）
- 空のテストや弱い期待値を機械で判定すること
- 証拠の記録の `schemaVersion` を上げること（項目を足すだけで、古い記録も読めるため）

## Impact
- 影響する capability：trace-record（Requirement の追加）、trace-report（Requirement の変更と追加）
- 影響するコード：`packages/trace/src/record.ts`・`report.ts`、`packages/trace/test/`
- 証拠の記録の JSON に `documents` が増える。レポートの JSON は `schemaVersion` を 2 に上げる
