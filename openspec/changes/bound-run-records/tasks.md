# Tasks

## 1. 記録予算

- [x] 1.1 設定と純粋な予算判定、記録I/Oの境界をRedからGreenで検証する（REQ-177・REQ-178）
- [x] 1.2 runの開始前・途中の超過、巨大なsummary、保存失敗をRedからGreenで検証する（REQ-179）

## 2. 統合検証

- [ ] 2.1 予算と対象外の範囲、停止情報と復旧手順・TDD・changesetを記録する
- [ ] 2.2 `pnpm -s verify --change bound-run-records --done` を通す <!-- loomake:gate=done -->
