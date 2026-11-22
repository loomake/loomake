# fix/effort-read-case-insensitive（L2）

1. やったこと：mac・Windows の quality が effort-read.test.ts の「[REQ-467] 正規名でないファイル・一時ファイル・下位ディレクトリは本文を読まずに無視する」で落ちていた。原因は、非正規名として置く試験用ファイル `20261106T010203Z-AAAAAAAAAAAA.json` が、大文字小文字を区別しないファイルシステムで正規名 `…-aaaaaaaaaaaa.json` と同じファイルになり、有効な記録を「壊れている」で上書きしていた点。非正規名の suffix を `BCDEFBCDEFBC`（大文字で正規名の形を外れ、かつ正規名と衝突しない）に変えた。
2. 検証：`npx vitest run packages/trace/test/effort-read.test.ts` が 13 件通った。mac・Windows での確認は CI に任せる。
3. 確認事項・仮定：実装の正規名判定（小文字 hex 12 桁）は正しく、変えたのは試験の置き方だけ。REQ-467 は主仕様の Source にないため spec-fix 経路は使えず、test/ だけの変更なので L2 の通常経路とした。
4. 次にやること：CI の全チェックを確かめてマージする。その後 #479 を rebase する。
