## 1. 回帰の再現

- [x] 1.1 pathspec の名前で skip・アサーション削除を見落とす回帰試験と、git 呼び出しの環境の試験を追加し、修正前に失敗することを保存する。既存の特殊文字パス試験にも対象名を加える（REQ-109・REQ-138）

## 2. 修理

- [ ] 2.1 runner の git 呼び出しをリテラルなパスの環境にそろえ、回帰・git 読み取り・証拠配置・既存ガードの試験を成功させる。runner の patch changeset を追加する（REQ-109・REQ-138）

## 3. 確認

- [ ] 3.1 `pnpm -s verify --change fix-literal-git-paths --done --scope local` を通し、全タスクと要件対応テストを確認する <!-- loomake:gate=done -->

## Workflow follow-up

- 同じ PR で主仕様に Scenario を同期し、change を archive する。
- 最終 head の独立レビューと、CI の完了ゲート・必須チェック・3 OS 試験で受入を確認する。
