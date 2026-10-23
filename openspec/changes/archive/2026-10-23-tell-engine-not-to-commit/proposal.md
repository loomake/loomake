# tell-engine-not-to-commit

## Why
harden-run-engine-boundary で、エンジンが自分でコミットするかブランチを切り替えたら、`loomake run` は止まるようにした（REQ-126）。ところが、エンジンへの指示の決まりには、コミットしないことが書かれていない。init が配る AGENTS.md は「1タスクごとに小さくコミット」と指示しているので、`--skip-permissions` で動かすと、エンジンはタスクのたびにコミットし、run はそのたびに止まる。

## What Changes
- エンジンへの指示の決まりに、git でコミットしたりブランチを切り替えたりせず、変更を作業ツリーに残して終えること（コミットは loomake run が行うこと）を足す（REQ-098）

## Non-goals
- init が配る AGENTS.md の書き換え（人や run を使わないエージェントは、これまでどおりタスクごとにコミットする）

## Impact
- 影響する capability：run（Requirement の変更）
- 影響するコード：`packages/runner/src/run.ts`、`packages/runner/test/run.test.ts`
