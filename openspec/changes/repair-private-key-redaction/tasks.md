# Tasks

## 1. 秘密鍵の伏せ字

- [x] 1.1 PGP と END なしの入力について REQ-199 付きの回帰テストで修正前の失敗を保存し、両経路の修理後に同じテストが成功することを確認する。公開鍵・JSON・全チャンク境界と既存のヘッダ上限も確認し、runner の patch changeset を追加する（REQ-199）。

## 2. 全体の確認

- [ ] 2.1 `pnpm -s verify --change repair-private-key-redaction --done --scope local` を終了 0 にし、要件とテストの対応と全タスクの完了を確認する <!-- loomake:gate=done -->

## Workflow follow-up

- 同じ PR に仕様同期・archive を含める。
- 最終 head の CI 完了ゲート（scope ci）・必須 5 チェック・3 OS 試験・独立レビューで最終受入を確認する。
