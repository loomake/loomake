# Tasks

## 1. 仕様

- [x] 1.1 proposal・trace と差分仕様（MODIFIED REQ-188〜190、ADDED REQ-346）を書き、抽出の規則と移行の判定を trace.md の仮定に記録する（確認：`pnpm -s verify --change scenario-audit-scope --spec-only` が exit 0）

## 2. 監査の本体

- [x] 2.1 `scripts/scenario-audit.mjs`：本文ブロックの抽出（`extractTestBlocks`・`blockDigest`）と `hashScope: "block"` の照合、主仕様だけを対象にして change を未着手として数える `inventoryRepository`、JSON と Markdown の未着手の件数（REQ-188・REQ-189・REQ-190）
- [x] 2.2 `scripts/scenario-audit.mjs --migrate [--dry-run]`：`migrateReviews`・`gitHistory`・`migrateRepository`（REQ-346）。台帳には実行しない

## 3. 試験

- [x] 3.1 `tests/scenario-audit-scope.test.ts` を足す（REQ-188・REQ-189・REQ-190・REQ-346・REQ-347）。既存の `tests/scenario-audit.test.ts` は変えずに通す

## 4. CI と文書

- [x] 4.1 `.github/workflows/ci.yml`：quality の ubuntu が保存した全体試験のレポートで監査する警告のジョブ `scenario-audit` を足し、監査のステップを `continue-on-error: true` にして出力を artifact に保存する（quality のステップは REQ-214・REQ-291 の試験が固定しているため別ジョブにする）
- [x] 4.2 `docs/guide/2.guides/4.scenario-audit.md` を更新し、`docs/quality/scenario-audit.md` に古い記録である旨を注記する

## 5. 確認

- [x] 5.1 全体試験を回し、新旧の監査の件数と `--migrate --dry-run` の件数を作業記録と PR に書く。`pnpm -s verify --change scenario-audit-scope --done` を通し、tasks をすべてチェックする。archive は管理役
