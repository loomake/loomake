# TDD実行記録

## 2.1・2.2 ファイルの名前（REQ-273）

直す前のスクリプトで、足した試験 11 件がすべて失敗した（`pnpm -s vitest run tests/ci-docs-only.test.ts`、11 failed・24 passed）。失敗の理由は、どれも判定が「文書だけ」（`isDocumentPath` が true、または `docs_only=true`）になったことで、試験の準備の失敗ではない。

- 文字と制御文字：`"docs/a:b.md": expected true to be false`
- 末尾のドットや空白と予約名：`"docs/notes./a.md": expected true to be false`
- UTF-8 として正しくない名前：`expected true to be false`
- 大文字と小文字だけが違う名前、ツリーを読めない：`docsOnly` が true
- 一時的な git リポジトリの試験 6 件（`docs/a:b.md`、改行を含む名前、0xFF を含む名前、`docs/aux.md`、`docs/notes /a.md`、`docs/notes.md` があるところへの `docs/Notes.md`）：出力が `docs_only=true`

直したあと、`[REQ-270] 変えたファイルがすべて文書なら、文書だけと判定する` が、呼び出す git の引数の期待値で失敗した（`ls-tree` の呼び出しが増えたため）。仮定 A-01 の範囲で、期待値に `['ls-tree', '-r', '-z', '--name-only', 'HEAD']` を足した。判定の結果の期待値は変えていない。そのあと `tests/ci-docs-only.test.ts` と `tests/monorepo.test.ts` は 80 件すべて通った。

## 3.1・3.2 ファイルの種類（REQ-274）

直す前のスクリプト（`--name-status` で差分を読む版）で、一時的な git リポジトリの試験 4 件のうち 3 件が失敗した（3 failed・36 passed）。`docs/link.md`（`../packages/kit/src/a.ts` を指すシンボリックリンク）、`docs/sub.md`（サブモジュール）、`README.md` のモードだけを 100755 にした PR は、どれも `docs_only=true` になった。Issue #42 で試していなかったサブモジュールも、文書として通ることを確かめた。通常のファイルの文書を足し、変え、消した PR の試験は、直す前から通る（直したあとも文書だけと判定することを確かめる試験）。

直したあと、差分を `--raw` で読むので、偽の git の差分を使う既存の試験は、仮定 A-01 の範囲で入力の形を合わせた。試験の中の `nameStatus` は、[状態, パス...] から通常のファイルの `--raw` の差分を作るようにした。呼び出す git の引数の期待値を `--raw` にし、`parseNameStatus` を呼ぶ 2 か所を `parseRawDiff` にした。解釈できない差分の例のうち、変更後のパスがない名前の変更は、`--raw` の行の形に直した。モードのない `--name-status` の形の出力も、解釈できない差分の例に足した。判定の結果の期待値は変えていない。そのあと `tests/ci-docs-only.test.ts` と `tests/monorepo.test.ts` は 85 件すべて通った。
