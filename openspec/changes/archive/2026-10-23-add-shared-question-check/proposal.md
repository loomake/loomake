# add-shared-question-check

## Why
同じ確認事項を 2 つの change の trace.md に載せると、片方だけに回答を書いたり、回答が食い違ったりしても verify は気づかない。verify は change ごとに trace.md を読むためである（docs/review.md「2026-10-23 試験プロジェクトでの kit の試用」の指摘 5）。

## What Changes
- 仕様ゲートに「同じ確認事項の回答」の検査を足す。質問に「<change-id> の Q-xx と同じ質問」と書いた確認事項は、参照先の回答と比べ、違えば不合格にする（REQ-034）

## Non-goals
- 印のない確認事項を、ID だけで照合すること（別の要件書の確認事項と区別できない）
- 質問の文面や選択肢の食い違いを調べること

## Impact
- 影響する capability：verify（Requirement の追加）
- 影響するコード：`packages/kit/src/verify/run.ts`
