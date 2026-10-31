# runner の試験の準備の共有（T1・T4）

1. やったこと：設計メモ（design-b1-runner-tests）の T1 と T4 を試験だけで行った（L2、change なし）。guards-special-files は runner の変換を beforeAll で種類ごとに 1 回にし、makeRepo は git init と remote add を済ませた雛形を書き出して使う。雛形から作った repo の HEAD・設定・履歴・origin が git init から作った repo と同じことを、helpers-template.test.ts で確かめる。
2. verify の結果：change を持たない PR なので verify は対象外。`pnpm lint`・`pnpm typecheck`・`pnpm test` は通った。makeRepo 1 回は約 26ms から約 14ms に減った（交互に 40 回ずつ測った平均）。ファイル単位の所要時間は、機械の負荷（load average 20〜35）で揺れが大きく、差を読み取れなかった。
3. 残っている確認事項・仮定：従来の作り方を残した試験はない。雛形の書き出しは init 直後と同じ状態を置くだけで、どの試験も意味が変わらないと判断した。期待値・上限値・試験の数は変えていない（雛形の試験 2 件は足した）。
4. 次にやること：CI の artifact で前後の時間を比べる。次は T2（待ちの多い試験のファイル分け）に進む。

## 自己レビューへの対応（PR #220）

1. やったこと：自己レビューの軽微な指摘 3 件を直した。addOrigin は `git init --bare` の失敗で止まる。makeRepo は雛形の書き出しに失敗したら作りかけの一時ディレクトリを消す。雛形の試験は、`.git` と origin の木（パスと mode、objects・logs・index・COMMIT_EDITMSG を除く）も比べる。
2. verify の結果：change を持たない PR なので verify は対象外。`pnpm lint`・`pnpm typecheck` と雛形の試験は通った。`ci:all-os` のラベルを付け、Windows と macOS の CI でも流す。
3. 残っている確認事項・仮定：なし。
4. 次にやること：Windows と macOS の CI の結果を確かめ、Opus の独立レビューに出す。

## Windows の CI での失敗への対応（PR #220）

1. やったこと：Windows で雛形の試験 2 件が落ちた原因は、試験の比べ方にあった。write-report.mjs の中のパスは JSON で 2 回逃がしてあり、Windows では区切りの形が変わるので、そのままの形のパスを伏せるだけでは伏せきれなかった。逃がした形のパスも伏せるように直し、比べるキーは外していない。origin/main（#225 を含む）を取り込んだ。
2. verify の結果：change を持たない PR なので verify は対象外。手元で `pnpm lint`・`pnpm typecheck` と雛形の試験は通った。Windows と macOS は CI で確かめる。
3. 残っている確認事項・仮定：なし。
4. 次にやること：全 OS の CI の結果を確かめ、Opus の独立レビューに出す。
