## 1. 明示オプションと案内

- [x] 1.1 kit の既存ファイル方針と CLI の相互排他を実装し、要件 ID 付き unit・API テスト、ヘルプの基準差分、導入案内と生成リファレンスで確認する（REQ-020・419・420・421）

## 2. 配布物の確認

- [x] 2.1 tarball の実 CLI を非 TTY・パイプ入力で起動し、両方針と無指定中止が入力待ちなく終わることを要件 ID 付きテストで確認する。changeset を追加する（REQ-419・420・421）

## 3. 確認

- [x] 3.1 `pnpm -s verify --change add-init-noninteractive-options --done --scope local` を通し、要件とテスト、全タスクの完了を確認する <!-- loomake:gate=done -->

## Workflow follow-up

- 同じ PR で仕様を同期し archive する。archive 後も完了ゲートを確認する。
- 最終の合格は CI の `--done --scope ci` と必須チェック、3 OS 試験、独立レビューで確認する。
