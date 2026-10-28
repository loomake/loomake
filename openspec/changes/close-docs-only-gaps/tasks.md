# Tasks

## 1. 仕様

- [x] 1.1 proposal・trace と差分仕様（REQ-273・REQ-274）を書き、仕様ゲートを通す

## 2. ファイルの名前（Issue #42 の 1）

- [x] 2.1 `tests/ci-docs-only.test.ts` に、Windows で使えない文字・制御文字・末尾のドットや空白・予約名・UTF-8 として正しくない名前・大文字と小文字だけが違う名前・ツリーを読めないときの試験を足す。直す前のスクリプトで失敗することを確かめ、`tdd.md` に書く（REQ-273）
- [x] 2.2 `scripts/ci-docs-only.mjs` の `isDocumentPath` で 2.1 の名前を文書として扱わないようにし、判定で `git ls-tree -r -z --name-only HEAD` を読んで大文字と小文字だけが違う名前を検出する（REQ-273）

## 3. ファイルの種類（Issue #42 の 2）

- [ ] 3.1 `tests/ci-docs-only.test.ts` に、シンボリックリンク・サブモジュール・モードだけの変更・通常のファイルの文書の試験を足す。直す前のスクリプトで失敗することを確かめ、`tdd.md` に書く（REQ-274）
- [ ] 3.2 `scripts/ci-docs-only.mjs` で差分を `git diff --raw -z -M` で読み、変更前か変更後が通常のファイルでないものを文書として扱わない。既存の試験の偽の git の出力と引数の期待値を、仮定 A-01 の範囲で合わせる（REQ-274）

## 4. 案 E の申し送り（Issue #42 の 4）

- [ ] 4.1 `.github/workflows/ci.yml` の gate ジョブと `scripts/ci-gate.mjs` に、文書だけの PR でテストを実行するのは gate ジョブだけであり、gate でテストを飛ばす変更では REQ-270 を見直すことを、コメントで書く（REQ-270）

## 5. 確認

- [ ] 5.1 Scenario のレビューを、change 側の ID で `docs/quality/scenarios.json` に足す。`tests/ci-docs-only.test.ts` を根拠にする既存のレビューは、試験を読み直してハッシュを更新する。`node scripts/scenario-audit.mjs` で、この change と shorten-ci-wall-clock の Scenario が reviewed になることを確かめる（REQ-273, REQ-274）
- [ ] 5.2 `pnpm -s lint`・`pnpm -s typecheck`・`pnpm -s test` を通す
- [ ] 5.3 `pnpm -s verify --change close-docs-only-gaps --done` を通す <!-- loomake:gate=done -->
