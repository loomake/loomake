# delivery-metrics のページ送りをクラウドの中継に合わせる

1. やったこと：PR #210 で REST に移した `scripts/delivery-metrics.sh` を、クラウドの中継が断る呼び出しを使わない形に直した。14:26 に手動で動かした routine のログで、中継が `--paginate` の次のページの URL（`repositories/<数字>/…`）と検索 API を 403 で断ることが分かったため。その回は routine が自前の包みで CSV を作った。
   - `ghall` という関数を足し、`repos/loomake/loomake/…` に `page=` を付けて 100 件より少ないページまで送る。PR ごとの Python の取得も同じく `page=` で送る。
   - `gh run list` は workflow runs の REST（最大 10 ページ）に、検索 API は Issue の全件から題名で絞る形に置き換えた。
   - ページを送るあいだに新しい項目が増えると境目の項目が 2 回出るので、CI の実行は id、PR は番号で重複を除く。
2. verify の結果：change はないので verify は対象外。中継と同じく `--paginate`・検索 API・`gh run list`・`gh pr`・`gh issue` を断る偽の gh で台本を流し、終了コード 0 で 6 つの CSV が出ることを確かめた。直す前の台本の出力と比べた違いは、2 回の実行のあいだに起きた変化だけだった。重複を除く前は 10/27 の CI の実行が 1 件多く数えられ、除いたあとは直す前と同じ数になった。Issue #121 の取得を失敗させる偽の gh では、終了コード 1 で止まり、出力先の前のファイルが変わらないことも確かめた。
3. 残っている確認事項・仮定：クラウドでの確認はマージ後の毎時の routine になる。pricing に `claude-haiku-5-5` の単価が無く、routine は Haiku の費用を計算から除いている。pricing は手元で更新するデータで、この PR では変えていない。
4. 次にやること：独立 Opus のレビューを受けてマージし、次の毎時の routine のログで、包みなしで台本が通ることを確かめる。
