# Tasks

## 1. 仕様

- [x] 1.1 proposal・trace と差分仕様（MODIFIED「完了ゲートの対象の決め方」、Scenario「明示を優先する」の THEN と「変えたファイルとブランチ名を合わせる」の WHEN・THEN）を書く（確認：`pnpm -s verify --change spec-fixups-1031 --spec-only` が exit 0）

## 2. レビュー表

- [x] 2.1 `docs/quality/scenarios.json` の SCN-149eab9b・SCN-d31a4872・SCN-711b5333・SCN-2f7149cc と「変えたファイルとブランチ名を合わせる」の行を、試験の assertion を 1 件ずつ読み直して本文ブロックのハッシュで記録し直す

## 3. 確認

- [x] 3.1 `openspec validate --specs --strict` と `node scripts/scenario-audit.mjs` の前後の件数を作業記録と PR に書き、`pnpm -s verify --change spec-fixups-1031 --done` を通す
