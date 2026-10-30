# Tasks

## 1. 仕様

- [x] 1.1 proposal・trace と差分仕様（REQ-342・REQ-343、MODIFIED 3 件）を書き、仮定 A-01・A-02 と judgment 1・2 の採否を trace.md に記録する（確認：`pnpm -s verify --change tier-ci-gate --spec-only` が exit 0）

## 2. 段階の判定と gate

- [x] 2.1 `scripts/ci-tier.mjs` を足す：`isDocumentPath`（ci-docs-only.mjs から移す）・`classifyPath`・`requirementBodyChanged`・`decideTier`・`formatTierLine`（REQ-342）
- [ ] 2.2 `scripts/ci-gate.mjs`：`--raw -z -M` と spec の `-U0` の差分、段階の分岐、L1 の lint と doc-links、標準出力の tier 行、`GITHUB_OUTPUT`、独自の `isDocument` の削除（REQ-343）
- [ ] 2.3 `scripts/ci-docs-only.mjs`：最終判定を段階 L1 にする。安全側の検査（PR でない・差分を取れない・解釈できない・通常のファイルでない・大文字小文字）は残す（REQ-270・REQ-342）
- [ ] 2.4 `.github/workflows/ci.yml`：gate ステップに `id: gate` を付け、コメントを段階の説明に直す
- [ ] 2.5 `.github/PULL_REQUEST_TEMPLATE.md`・`.agents/skills/delivery/SKILL.md`：証跡ブロックに `tier:` の行を足し、SKILL に worktree の削除の 1 行を足す

## 3. 試験

- [ ] 3.1 `tests/ci-tier.test.ts` を足し、`tests/ci-gate-process.test.ts`・`tests/ci-docs-only.test.ts` に段階の試験を足す。既存の「品質コマンドだけ」の 3 件を lint 前提に書き換える（REQ-342・REQ-343・REQ-270）

## 4. 開発の仕組み

- [ ] 4.1 `scripts/clean-merged-worktrees.sh`（100755）と `scripts/delivery-metrics.sh`（100755）を足す。`clean-merged-worktrees.sh --dry-run` を実機で 1 回流し、結果を作業記録に書く
- [ ] 4.2 `docs/dev/ci.md` の「文書だけの PR でテストを実行するジョブ」を段階の説明に書き換え、2 つの台本に触れる。changeset は不要（公開パッケージを変えない）

## 5. 確認

- [ ] 5.1 `pnpm -s verify --change tier-ci-gate --done` を通し、tasks をすべてチェックする。archive は管理役 <!-- loomake:gate=done -->
