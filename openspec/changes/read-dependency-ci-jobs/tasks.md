# Tasks

## 1. 1回の取得

- [ ] 1.1 `pnpm -s verify --change read-dependency-ci-jobs --spec-only` のexit 0を確かめてから、REQ-415の5Scenarioの試験を新規 `packages/kit/test/ci-jobs.test.ts` に書く。module不在の収集エラーをREDとせず、型の合う最小の未実装 `jobDigits`・`fetchJob` を置き、試験の期待との不一致によるREDを `.loomake/read-dependency-ci-jobs/red.txt` に保存する。
- [ ] 1.2 `packages/kit/src/verify/ci-jobs.ts` に `runExternalBytes` を使う取得を実装し、新規試験と既存のprocess・input試験を通す。`pnpm -s lint`・`pnpm -s typecheck` を通し、process.ts・index.ts・既存試験・設定・timeout・skipに差分がないことをdiffで確かめる。
- [ ] 1.3 既存の日別ファイル `docs/worklog/2026-11-04.md` の末尾へ短い4項目を追記し、kitのpatch changesetと同じ実装PRへ含める。日誌は1日約10KBを目安にする。計画の実数を含む追加と削除の合計を再計算し、designの表より明確に多いか試験が足りなければ管理役へ戻す。

## 2. 統合確認

- [ ] 2.1 `pnpm -s verify --change read-dependency-ci-jobs --done --scope local` を省略なしのnormal localで通し、5Scenarioの実試験とtasksの全完了を確かめる。 <!-- loomake:gate=done -->

## Workflow follow-up

- 同じ実装PRで主仕様へ同期してarchiveする。文書だけの同期・archive後はstrictとspec-only、source/testの木が不変であることを確かめる。sourceが変わればnormal local doneをやり直す。候補416・417、REQ-401、両ゲートへの接続、C3aと親285の完了は別に確かめる。
- 非起草者レビュー重大0を、独立Opus最終レビューの前に同じレビュー依頼で確かめる。local doneの成功を未実施のレビューの完了と扱わない。
- 最終headで通常のscope ci archiveゲート、必須CI5件、kitの3OS（`ci:all-os`）、独立Opus最終レビュー重大0と軽微のIssue化を確かめる。squash merge直前にheadを照合し、その後にpushがあれば全条件を確かめ直す。
