# guard-test-weakening

## Why
2026-10-23 の実装全体の評価（作業記録 2026-10-23 の 42 節）で、run のガードがテストの弱め方を見逃すことが分かった。`expect(add(1,2)).toBe(3)` を `expect(true).toBe(true)` に書き換えても、同じファイルの中のテストを消しても、run は止まらない。いまのガードが見るのは、テストファイルの削除と skip・todo の追加だけだからだ。AGENTS.md 4 章は「期待値を実装に合わせて書き換える」ことを禁じているが、run はそれを止められない。

## What Changes
- HEAD にあったテストファイルから、アサーション（`expect`・`assert`）かテストの宣言（`it`・`test`・`describe`）を含む行を消すか書き換えたら、run は変更をコミットせずに止まる（REQ-109）
- 消した行と同じ内容の行を同じファイルに足していれば、行を移しただけとみなして止まらない
- テストの追加では、これまでどおり止まらない

## Non-goals
- アサーションの意味の比較（`toBe(3)` を `toBe(4)` にするのが正しい直しかどうかの判断）。止まったあとに人が差分を見て決める（REQ-112）
- テストファイルの外にある、テストの補助ファイル（fixtures など）の変更の検出

## Impact
- 影響する capability：run-guards（REQ-109 を出典とする Requirement の追加）
- 影響するコード：`packages/runner/src/guards.ts`
