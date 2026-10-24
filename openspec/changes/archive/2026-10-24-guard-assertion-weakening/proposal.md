# テストの検査を弱める変更を見つける

## Why

不正な直し方の検出（REQ-109〜REQ-111）は、テストの削除・skip・設定の変更を見つける。一方で、既存のテストの `expect` を消す変更や、`expect(add(1, 2)).toBe(3)` を `expect(true).toBe(true)` に変える変更は見つけない。2026-10-24 の品質評価で、この抜けが残った。

## What Changes

- 既存のテストファイルで、検査の行（`expect(`・`assert`）を足した数より消した数が多いときは、不正な直し方として止まる
- テストファイルに、同じ値どうしを比べる検査（`expect(true).toBe(true)` など）を足したときも止まる

## Capabilities

### New Capabilities

なし。

### Modified Capabilities

- `run-guards`: テストの検査を弱める変更の検出。

## Impact

runner のガードとテストを変える。テストを足すだけの変更と、検査を書き換えて数が変わらない変更は、これまでどおり止めない。
