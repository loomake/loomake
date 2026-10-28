# CI のワークフロー

`.github/workflows/ci.yml` の組み方のうち、このリポジトリの開発だけに効くものを書く。

## PR の古い実行の取り消し

- 同じ PR に新しい push があれば、その PR の古い実行を取り消す
- main への push で動いた実行は取り消さない

ワークフローの `concurrency` を 1 か所だけに書き、ジョブごとの `concurrency` で上書きしない。

- `group` には PR の番号を入れる。main への push では `github.run_id` を入れ、実行ごとに分ける。group が同じだと、待機中の実行が次の push の実行に置き換えられて取り消される
- `cancel-in-progress` は、`github.event_name == 'pull_request'` のときだけ true にする

`tests/monorepo.test.ts` の「同じ PR の古い実行を取り消し、main への push の実行は取り消さない」の試験が、group と cancel-in-progress の式を評価して確かめる。

この決まりは以前、monorepo の仕様の Requirement「PR の古い CI 実行の取り消し」（REQ-215）だった。change move-dev-mechanics-to-docs で仕様から外した。

## 文書だけの PR でテストを実行するジョブ

文書だけの PR（REQ-270）では、quality ジョブは品質コマンドを飛ばす。このとき、文書を読むテスト（`tests/doc-links.test.ts` など）を実行するのは、gate ジョブの `verify` だけになる。

gate ジョブでテストを実行しないようにする変更（change shorten-ci-wall-clock の確認事項 Q-08 の案 E など）では、文書だけの PR でテストを実行するジョブがなくなる。その change では、REQ-270 との組み合わせを見直す。たとえば、文書だけの PR では gate でテストを実行するか、REQ-270 の文書の範囲を狭める（Issue #42 の 4、change close-docs-only-gaps）。

## まだ仕様にあるもの

次の 2 つはいま monorepo の仕様にあり、変えるには change が要る。進行中の change が終わってから、このページに移す候補にしている。

- 3 つの OS での CI（REQ-049）
- CI のテストの分割（REQ-214）

完了ゲート（gate のジョブ）と release ワークフローは、利用者や配布物にかかわるので、仕様に残す。
