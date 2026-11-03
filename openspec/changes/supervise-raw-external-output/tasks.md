# Tasks

## 1. 私的raw入口

- [x] 1.1 `pnpm -s verify --change supervise-raw-external-output --spec-only` のexit 0を再確認してから、REQ-412の4Scenarioに対応する試験を既存process.test.tsへ追加し、旧sourceで意味のあるREDを保存する。共通engine・私的型・raw wrapper・公開wrapperを実装し、元Buffer、capture予約、安全な加算、共有状態、非公開barrelを追加試験と既存process試験で確認する。
- [x] 1.2 `pnpm -s lint`、`pnpm -s typecheck` と影響範囲の関連試験を通す。旧runExternalのfull suiteを同条件で通し、既存assertion・設定・timeout・skipに変更がないことをdiffで確認する。
- [x] 1.3 同じ実装PRへchangesetと作業日のJST日誌を含め、判断・結果・残る確認・次の作業だけを記録する。計画実数を含む追加削除の合計を再計算し、明確な300行超過や試験不足は管理役へ戻す。

## 2. 統合確認

- [x] 2.1 `pnpm -s verify --change supervise-raw-external-output --done --scope local` を省略なしのnormal localで通し、4Scenarioの実試験とtasks全完了を確認する。 <!-- loomake:gate=done -->

## Workflow follow-up

- 同じ実装PRで主仕様へ同期してarchiveする。文書だけの同期・archive後はstrictとspec-only、source/testの木が不変であることを確認する。sourceが変わればnormal local doneを再実行する。X2/X3a/X3bとC3/S1/C001の完了は別に確認する。
- 非作者レビュー重大0を、独立Opus最終レビューの前に同じレビュー依頼で確認する。local doneの成功を未実施レビューの完了と扱わない。
- 最終headで通常のscope ci archiveゲート、必須CI5件、kitの3OS、独立Opus最終レビュー重大0と軽微Issue化を確認する。squash merge直前にheadを照合し、その後にpushがあれば全条件を再確認する。
