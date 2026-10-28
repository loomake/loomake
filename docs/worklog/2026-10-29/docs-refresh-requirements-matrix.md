# docs/refresh-requirements-matrix

## W0-1：要件対応表の棚卸し（Issue #52）

1. やったこと：要件定義 v0.11.2・アーキテクチャ v2.5.4・WBS v1.4 を基準 commit `56bd4252b1c582849f3b9f0f16beedbb83465a45` と実ファイルの SHA-256 で固定した。FR 50 件・NFR 12 件・ID のない必須事項 26 件を照合し、衝突する現行 REQ・実装状態・根拠と残作業を追記した。change-id は対象外。PR は未作成。
2. verify の結果：製品コード・仕様の変更がないため change の verify は未実行。全 88 行の列数・WBS・検証方法・証跡・段階・状態の記載と、FR/NFR の欠落・重複ゼロを確認。`git diff --check` 成功。yomiyasu の lint・diff・資料照合を実施し、最終稿のハッシュ一致を確認。親担当の `pnpm exec vitest run tests/doc-links.test.ts` は 1 file・40 tests 成功、exit 0（2026-10-29 07:02 ごろ JST、Linux・Node 24）。spec-only・done は未実行。
3. 残っている確認事項・仮定：実装状態は基準 commit の実装・テストの存在に基づく棚卸しで、受入検証の成功や WBS 完了を示さない。J01〜J08 は決定済みとして扱い、O03・O04・O11・O14 などの未決事項は維持した。未マージの品質スキーマ・CI 診断は除外した。取り込み前の調整事項として、`core-quality-yaml-schema` と `record-ci-test-diagnostics` が REQ-283〜285 を重複して使用している（親担当の調査）。今回、main と各 change は書き換えていない。
4. 次にやること：親担当の差分レビューと文書リンク検査を経て、文書更新のコミット・PR を作る。Issue #52 の受入判断と close は別途行う。
