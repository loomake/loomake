# 品質の採点の運用

このフォルダには[採点の規準](../scoring-rubric.md)で付けた各回の記録を置きます。点数の台帳は [scorecard.json](../scorecard.json) です。

## 週 1 回の採点

- 週 1 回（月曜 09:00 JST）、Opus が `origin/main` の head を規準で採点します。
- 採点者は `docs/quality/reviews/YYYY-MM-DD.md` に、指摘、各観点の根拠と残る確認、点数を書きます。書き方は [2026-10-25.md](2026-10-25.md) を例にします。
- 同じ PR で scorecard.json の `rounds` に 1 回ぶんを足します。`round` は前回の次の番号、`head` は採点した SHA、`reviewer` はモデル名、`source` はその回の記録のパスです。規準で採点しなかった観点は `scores` に入れません。読む側が前回の値を持ち越します。
- PR の段階は L2 です（scorecard.json を変えるため gate が L2 と判定する）。管理役が Opus のレビューを 1 回回し、重大ゼロでマージします。
- 点数の根拠が読めない回は、台帳に入れません。記録だけを残します。

## 台帳の読み手

品質のダッシュボードは scorecard.json を読み、回ごとの点数の推移を表示します。台帳の形を変えるときは、ダッシュボードも合わせて直します。

## 過去の記録

2026-10-25 までの 18 回は、git 履歴の [cc5df0f](https://github.com/loomake/loomake/blob/cc5df0f85a29158512f45d5ff5517ff38a0b0aa7/docs/review.md) にあった docs/review.md から台帳へ写しました。各回の `source` がその表の行番号を指します。日付のない回は、見出しのコミット時刻を JST で読んだ日付にしています。採点者はどの回にも書かれていなかったため、`reviewer` は「不明（docs/review.md）」としています。
