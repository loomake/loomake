# Proposal: close-docs-only-gaps

## Why

CI の quality ジョブは、PR で変えたファイルがすべて文書なら、品質コマンドを飛ばす（REQ-270、change shorten-ci-wall-clock）。PR #31 のレビューでは、文書として通るべきでないファイルが通ることが分かった（[Issue #42](https://github.com/loomake/loomake/issues/42) の 1・2）。

- 1：`scripts/ci-docs-only.mjs` の `isDocumentPath` は、パスの置き場所と拡張子しか見ない。`docs/a:b.md`、改行を含む名前、UTF-8 として正しくない名前を足した PR が `docs_only=true` になる。Windows の予約名（`aux.md` など）や、末尾がドットか空白の名前、大文字と小文字だけが違う名前も同じく通ると考える。これらは Windows で checkout できないか、macOS と Windows で別のファイルと区別できない。文書だけの PR では macOS と Windows の quality ジョブが飛ぶので、壊れるのはマージ後の main への push のときが最初になる。
- 2：差分を `git diff --name-status` で読むので、ファイルのモードが分からない。`.md` で終わる名前のシンボリックリンク、`chmod +x README.md` だけの変更が `docs_only=true` になる。サブモジュールも同じく通ると考える。

Issue #42 の 3（gate の差分のベース）は、change gate-base-remote-ref（PR #44、マージ済み）で直した。

Issue #42 の 4 は change shorten-ci-wall-clock の確認事項 Q-08 の案 E（gate でテストを二重に実行しない）を、将来採るときの注意である。文書だけの PR でテストを実行するのは gate ジョブだけなので、案 E を採ると、文書だけの PR ではどのジョブでもテストが実行されなくなる。

## What Changes

- `isDocumentPath` は、Windows で使えない文字・制御文字・末尾のドットや空白・Windows の予約名・UTF-8 として正しくないバイトを含むパスを、文書として扱わない。
- 判定では PR の先頭のツリーのパスを `git ls-tree` で読む。変えたファイルと大文字小文字の違いだけで同じになる別のパスがあれば、文書だけとしない。
- 差分を `git diff --raw -z -M` で読み、変更前と変更後のモードを判定に使う。通常のファイル（100644）でないもの（シンボリックリンク・サブモジュール・実行できるファイル）は、文書として扱わない。
- Issue #42 の 4 には仕様を変えずに対応する。`.github/workflows/ci.yml` の gate ジョブと `scripts/ci-gate.mjs` に、案 E のような変更では REQ-270 を見直すことをコメントで書く。この Impact にも申し送りを書く。

## Capabilities

### New Capabilities

なし。

### Modified Capabilities

- `monorepo`: 文書として扱わないファイルの名前（REQ-273）と種類（REQ-274）の要件を足す。REQ-270 の Requirement の文は変えない。

## Impact

`scripts/ci-docs-only.mjs`・`tests/ci-docs-only.test.ts`・`.github/workflows/ci.yml`（コメントだけ）・`scripts/ci-gate.mjs`（コメントだけ）を変える。`tests/ci-docs-only.test.ts` の既存の試験は、偽の git が返す差分の形を `--raw` に合わせ、呼び出す git の引数の期待値を変える（仮定 A-01）。確かめる振る舞いは変えない。`docs/quality/scenarios.json` のうち、`tests/ci-docs-only.test.ts` を根拠にするレビューは、試験を読み直してハッシュを更新する。製品のコード、公開 API、依存は変えない。配布するパッケージを変えないので、changeset は空にする。

判定には git の呼び出しが 1 回増える（`git ls-tree -r -z --name-only HEAD`）。

案 E の申し送り：gate ジョブでテストを実行しないようにする change は、文書だけの PR でテストを実行するジョブがなくなることを proposal に書き、REQ-270 との組み合わせを見直す。たとえば、文書だけの PR では gate でテストを実行するか、REQ-270 の文書の範囲を狭める。この change では gate の振る舞いを仕様に書き足さない。change shorten-ci-wall-clock の Q-01 で、「文書だけの PR でも gate で必ず全テストが 1 回走る」とは書かないと決めたためである（確認事項 Q-04）。

archive する PR では、この change の Scenario のレビュー（`docs/quality/scenarios.json` の change 側の ID）を、`openspec/specs/monorepo/spec.md` 側の ID に移す。この change は、change shorten-ci-wall-clock の「文書として扱うファイル」に条件を足すので、shorten-ci-wall-clock を先か同時に archive する。
