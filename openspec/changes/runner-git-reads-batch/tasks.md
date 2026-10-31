# Tasks

## 1. 仕様

- [x] 1.1 proposal・design（呼び出し元と境目の一覧、回数の見込み）・差分仕様（REQ-348）・trace を書く（確認：`pnpm -s verify --change runner-git-reads-batch --spec-only` が exit 0）

## 2. 実装

- [x] 2.1 `packages/runner/src/git.ts` に、HEAD の SHA・ブランチ名と、必要なら `--git-path config`・`--git-path hooks` を 1 回の `git rev-parse` で読む補助を足す。1 回の呼び出しが 0 以外で終わるか行の数が合わないときは、今と同じ別々の呼び出しに戻す。期限や出力の上限による例外はそのまま渡す。単体試験を足す：通常・detached・unborn・`HEAD` という名前のファイルがある場合に、今の `headState`・`gitPath` と同じ値を返すこと（`[REQ-348][REQ-126][REQ-198]`）。まとめた呼び出しが期限に達したら、項目ごとの呼び出しを起動せずに止まる試験も足す（`[REQ-348][REQ-180]`）
- [x] 2.2 `packages/runner/src/guards.ts` の `headState`・`gitInternals` を 2.1 の補助で読み、`callEngine` のエンジンの前の読み取りを `rev-parse` 1 回と `config --list` 1 回に、後の読み取りを `rev-parse` 1 回と `config --list` 1 回にする。試験を足す：エンジンの前後でそれぞれ `rev-parse` と `config --list` が 1 回ずつであること、HEAD の変化・ブランチの切り替え・設定とフックの変更を今と同じく見つけること（`[REQ-348][REQ-126][REQ-198][REQ-204]`）。guards.test.ts・guards-special-files.test.ts の既存の試験は期待値を変えずに通す
- [x] 2.3 `packages/runner/src/run/phases.ts` の完了ゲートの前後の読み取りを `rev-parse` 1 回ずつにする。境目をまたいで値を使い回さないことを確かめる試験を足す：検証のあいだに HEAD かブランチが変わったら今と同じく止まること、直しのエンジンの前で HEAD を読み直すこと（`[REQ-348][REQ-205][REQ-126]`）。run.test.ts・pr.test.ts・publication-retry.test.ts・external-budget.test.ts の既存の試験は期待値を変えずに通す

## 3. 計測と確認

- [x] 3.1 `LOOMAKE_EXTERNAL_TEST_DIAGNOSTIC_DIR` の診断の記録と `GIT_TRACE` で、run.test.ts・guards.test.ts・publication-retry.test.ts・pr.test.ts・external-budget.test.ts の監視つき操作の数と `git rev-parse` の数を、変更の前後で数え、design.md の見込み（合計 5,129 回から約 867 回減る）と比べて PR 本文に書く。見込みと 10% 以上ずれたら理由を design.md に書き足す
- [x] 3.2 試験の上限時間・assertion・skip の数が変わっていないことを `git diff origin/main -- packages/*/test tests` で確かめる。changeset（`@loomake/runner` の patch）を足す
- [ ] 3.3 `pnpm -s lint`・`pnpm -s typecheck`・runner の試験を通し、`pnpm -s verify --change runner-git-reads-batch --done` を通す <!-- loomake:gate=done -->
