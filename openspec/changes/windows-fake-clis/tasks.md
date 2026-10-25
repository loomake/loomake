# Tasks

## 1. 仕様

- [x] 1.1 proposal・design・trace と差分仕様（REQ-240）を書き、仕様ゲートを通す

## 2. 偽の CLI と印の検査

- [x] 2.1 Windows でも動く偽の CLI を作る `fakeCli` と、狙った段階に届いた印を確かめる `expectStalled` を `packages/runner/test/helpers.ts` に置く（REQ-240）
- [ ] 2.2 `external-budget.test.ts` の `shim()` を `fakeCli` に置き換え、期限の検査の前に印の検査を置く。git の戻し方を POSIX 専用の処理から `restore()` に変える（REQ-182・REQ-183・REQ-192・REQ-240）
- [ ] 2.3 予算を延ばす試験に、1 操作の期限・共有の期限より長く待ったことと、期限に猶予を足した時間のうちに止まったことの検査を足す（REQ-182・REQ-240）

## 3. 確認

- [ ] 3.1 Windows の CI で対象の試験を 2 回以上流し、回数と結果を記録する。失敗が残れば、試験ごとに直近の main の run と照合する
- [ ] 3.2 `pnpm -s verify --change windows-fake-clis --done` を通す <!-- loomake:gate=done -->
