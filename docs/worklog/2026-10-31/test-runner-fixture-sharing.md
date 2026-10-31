# runner の試験の準備の共有（T1・T4）

1. やったこと：設計メモ（design-b1-runner-tests）の T1 と T4 を試験だけで行った（L2、change なし）。guards-special-files は runner の変換を beforeAll で種類ごとに 1 回にし、makeRepo は git init と remote add を済ませた雛形を書き出して使う。雛形から作った repo の HEAD・設定・履歴・origin が git init から作った repo と同じことを、helpers-template.test.ts で確かめる。
2. verify の結果：change を持たない PR なので verify は対象外。`pnpm lint`・`pnpm typecheck`・`pnpm test` は通った。makeRepo 1 回は約 26ms から約 14ms に減った（交互に 40 回ずつ測った平均）。ファイル単位の所要時間は、機械の負荷（load average 20〜35）で揺れが大きく、差を読み取れなかった。
3. 残っている確認事項・仮定：従来の作り方を残した試験はない。雛形の書き出しは init 直後と同じ状態を置くだけで、どの試験も意味が変わらないと判断した。期待値・上限値・試験の数は変えていない（雛形の試験 2 件は足した）。
4. 次にやること：CI の artifact で前後の時間を比べる。次は T2（待ちの多い試験のファイル分け）に進む。
