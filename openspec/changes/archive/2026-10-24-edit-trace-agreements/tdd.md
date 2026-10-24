# TDD実行記録

## 1.1 表の行の書き換え

回答・回答者・回答日の書き込み、`|` の書き方、すでに値がある列・ない ID・改行の拒否、列のない古い表、仮定の行の 5 件のテストを足し、関数がないので失敗することを確かめた。core に setTraceCells を足して、core の 46 件が成功した。

## 2.1・2.2 コマンド

`trace answer` の 5 件と `trace approve` の 1 件の CLI のテストを足し、現行の実装で 5 件が失敗することを確かめた（ID がない・日付の形・--by がない場合は、知らないサブコマンドとして終了コード 2 になるので成功した）。2 つのコマンドは同じ処理を使うので、1 回の変更で行った。trace に runAgreement を、CLI に answer と approve を足して、CLI の 87 件が成功した。

## 3.1 文書

for-agents.md に、人の回答を受け取ったときの書き方を足した。利用者が編集中の usage.md にも使い方の節を足した（コミットしていない）。changeset を足した。

## 完了ゲート

`pnpm -s verify --change edit-trace-agreements --done` は exit 0。lint・型検査・764 件のテストと全 REQ の対応が成功した。
