# 2026-10-28 の作業記録（fix/ci-docs-only-gaps）

## 文書だけの判定の抜けを直す（Issue #42 の 1・2・4）（19:35）

- やったこと：change close-docs-only-gaps のタスク 1.1〜5.3。Issue #42 の 3 は change gate-base-remote-ref（PR #44、マージ済み）で直してあった。change gate-base-remote-ref と shorten-ci-wall-clock はどちらもマージ済みで、archive はまだなので、main の上に新しい change を作った。REQ-270 の Requirement の文は変えず、ADDED の Requirement「文書として扱わないファイルの名前」（REQ-273）と「文書として扱わないファイルの種類」（REQ-274）を足した。
  - 1（REQ-273）：`isDocumentPath` で、Windows で使えない文字（`<>:"|?*`）・制御文字・末尾のドットや空白・Windows の予約名・UTF-8 として正しくないバイト（U+FFFD）を含むパスを、文書として扱わないようにした。判定では `git ls-tree -r -z --name-only HEAD` を読み、大文字と小文字だけが違う別のパスがあれば文書だけとしない。読めなければ、文書だけとしない。
  - 2（REQ-274）：差分を `git diff --raw -z -M` で読むようにした。変更前か変更後のモードが 100644 でも 000000 でもないもの（シンボリックリンク・サブモジュール・実行できるファイル・モードだけの変更）は、文書として扱わない。Issue で試していなかったサブモジュールも、直す前は文書として通ることを確かめた。
  - 4：仕様は変えず、`.github/workflows/ci.yml` の gate ジョブと `scripts/ci-gate.mjs` に、文書だけの PR でテストを実行するのは gate だけであり、gate でテストを飛ばす変更では REQ-270 を見直すことをコメントで書いた。proposal.md の Impact にも申し送りを書いた。shorten-ci-wall-clock の Q-01 で「文書だけの PR でも gate で必ず全テストが 1 回走る」とは書かないと決めていたので、Requirement にはしなかった（Q-04）。
  - 試験：`tests/ci-docs-only.test.ts` に REQ-273 の試験 11 件と REQ-274 の試験 5 件を足し、直す前のスクリプトで失敗することを確かめた（`tdd.md`）。名前の試験と種類の試験は、索引に直接項目を足す方法で、OS によらず同じ形で作る。既存の試験は、偽の git の差分を `--raw` の形にし、git の引数の期待値を変えた（仮定 A-01）。判定の結果の期待値は変えていない。
  - `docs/quality/scenarios.json` に、この change の Scenario 9 件のレビューを足し、`tests/ci-docs-only.test.ts` を根拠にする既存のレビュー 26 件のハッシュを更新した。
- verify の結果：`pnpm -s verify --change close-docs-only-gaps --spec-only` と `--done` は合格（exit 0）。警告は「仮定の承認」（A-01 が未承認）だけ。`pnpm -s lint`・`pnpm -s typecheck`・`pnpm -s test`（1099 件が成功、8 件が skip）も通った。1 回目の `--done` では、`packages/cli/test/cli.test.ts` の [REQ-050]（3 秒以内に終わる性能の試験）が 3.59 秒で失敗した。この change とは関係がなく、再実行で通った。`node scripts/scenario-audit.mjs` では、この change と shorten-ci-wall-clock の Scenario はすべて reviewed になった。gate-base-remote-ref の Scenario「同じ名前のタグやブランチがある」は、main で `tests/ci-gate-process.test.ts` が変わったため、main と同じく invalid のまま（この change では触っていない）。
- 残っている確認事項・仮定：A-01（既存の試験の入力の形と git の引数の期待値を変えること）は、AGENTS.md 4 章により利用者本人の承認が要る。Q-01〜Q-04 は、利用者の方針「おすすめで」によりおすすめで答えた（利用者本人の承認ではない）。
- 次にやること：PR の CI を見届け、A-01 の承認をもらう。
