# TDD実行記録

## 1.1 品質コマンドを省いたことの表示

`--skip-commands` の完了ゲートの結果に「品質コマンド」の skip の項目と最後の行の表示を求めるテストを足し、現行の実装で 1 件が失敗することを確かめた。verify が省いたことを skip の項目として記録し、表示の最後の行に書くようにして、kit・CLI・入力の境界のテスト 73 件が成功した。

## 1.2 実行時の失敗の終了コード

制限による停止が `RuntimeFailure` であることと、run の準備中に git が時間の上限で止まったときに終了コード 3 を返すことを求めるテストを足した。REQ-182 の既存テストの期待値（UsageError）は、MODIFIED の仕様に合わせて RuntimeFailure に変えた。現行の実装で 3 件が失敗し、CLI のテストは終了コード 2 を返した。`RuntimeFailure` を足して `ProcessLimitError` の親にし、CLI・run・doctor の捕捉を合わせて、全 642 件が成功した。

## 1.3 壊れた設定ファイル

`{bad` の設定ファイルで run を実行するテストを足し、現行の実装が SyntaxError で落ちることを確かめた。run の設定を読む前に verify と同じ設定の読み込みを通すようにして、runner の 197 件が成功した。

## 2.1・2.2 CLI の引数

`--change=<id>`・`--format=json`・空の値と、サブコマンドとオプションの打ち間違いのテストを足し、現行の実装で 5 件が失敗することを確かめた（REQ-191 の JSON のテストは 1.1 の実装で成功した）。2 つのタスクは同じ引数の解析を書き直すので、1 回の変更で行った。引数の解析を `args.ts` にまとめ、`--name=value` と編集距離 2 以下の候補を扱うようにして、全テストが成功した。

## 3.1 文書

for-agents.md の終了コードの表に 3 と `--skip-commands` の説明を足し、compatibility.md と run-recovery.md の終了コードの記述を変えた。利用者が編集中の usage.md・positioning.md・quickstart.md は変えていない。

## 完了ゲート

`pnpm -s verify --change close-cli-gaps --done` は exit 0。lint・型検査・650 件のテストと全 REQ の対応が成功した。
