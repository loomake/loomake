# 2026-10-28 の作業記録（move-dev-mechanics-to-docs）

## 開発の仕組みを製品の仕様から外す（19:40 ごろ）

- やったこと：change move-dev-mechanics-to-docs のタスク 1.1〜3.2 を済ませ、archive した（[PR #114](https://github.com/loomake/loomake/pull/114)）。monorepo の 4 個の Requirement（devcontainer、PR の古い CI 実行の取り消し、OS によらないテストの前提、外部操作の期限の試験の偽の CLI）を外し、docs/dev/ と ADR 0005 に移した。試験 17 か所の名前から、外した要件 ID だけを外した。PR #108 との競合を避けるため、ci.yml は直していない
- verify の結果：`--spec-only` は合格。`--done` も合格（test は 1083 件成功、8 件 skip）
- 残っている確認事項：Q-01〜Q-04 と A-03（どれもブロッキングではない）。REQ-049・REQ-214・REQ-270・REQ-273 は、後続の change で外す候補にした。ci.yml のコメントに残る REQ-215 も後続で直す
