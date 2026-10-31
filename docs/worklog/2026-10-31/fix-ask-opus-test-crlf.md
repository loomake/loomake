# ask-opus のテンプレート試験を Windows の CRLF に対応させる

1. やったこと：#212 で足した試験「review-request.mdテンプレートの差分欄は区切り行1組で囲まれている」が、Windows の CI で失敗した。Windows の checkout ではテンプレートの行末が CRLF になり、取り出した差分欄に `\r\n` が残るのが原因だった。試験だけを直し、取り出した差分欄の CRLF を LF にそろえてから比べるようにした。行末を CRLF に変えたテンプレートからも同じ差分欄を取り出せることを確かめる期待値を 1 つ足した。ask-opus.mjs の挙動、生のバイト数で数える処理、既存の CR の試験、`.gitattributes` は変えていない。
2. verify の結果：change を伴わない L2 の修正のため、verify は対象外。`pnpm -s lint`、`pnpm -s typecheck`、`pnpm -s test` は手元の Linux ですべて通った。PR には `ci:all-os` ラベルを付け、Windows の 2 shard を含めて CI で確かめる。
3. 残っている確認事項・仮定：なし。
4. 次にやること：Windows を含む CI の結果を確かめ、管理役に報告する。
