## 1. 共通境界

- [x] 1.1 同期外部操作の監視と共有予算をRedからGreenで実装する（REQ-180・REQ-181）
- [x] 1.2 runner・trace・verifyへ接続し、停止と再実行をRedからGreenで検証する（REQ-182・REQ-183）

## 2. 統合検証

- [x] 2.1 資源・復旧・互換性・TDDとchangesetを記録する
- [ ] 2.2 `pnpm -s verify --change bound-external-operations --done` を通す <!-- loomake:gate=done -->
