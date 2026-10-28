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

## quality のテスト診断

quality ジョブの要約には、テストステップの成否と JSON レポートの状態を別々に表示する。レポートの状態は、有効・欠損・不正・空の4つ。テストが未実行なら、そのことも明示する。レポートがないことを、成功の証拠にはしない。

状態別件数は全結果を数え、skip・pending・todo・disabled は成功と分ける。失敗の一覧はファイル名とテストの完全名を最大20件、所要時間の一覧は時間のあるテストを長い順に最大10件表示する。各ファイル名とテスト名は200文字、要約全体は32KiB以内に収め、省略があれば件数や文字の省略を表示する。名前に含まれる Markdown と HTML の記号は文字として表示する。

実行画面の Artifacts から、`ci-tests-<run-id>-<attempt>-<os>-<shard>` をダウンロードできる。シャードの `/` は `-` に置き換え、分割しない実行は `all` とする。次のファイルを参照する。

- `metadata.json`：`schemaVersion: 1`、run の URL・ID・試行番号、実際に checkout した SHA、OS、Node の版、シャード、テストステップの結果、レポートの状態、状態別件数。
- `summary.md`：ジョブ要約と同じ日本語の診断。
- `test-report.json`：元レポートの写し。元レポートがあるときだけ保存する。失敗メッセージの全文や一覧で省略されたテストは、このファイルで確認する。

診断スクリプトは `node scripts/ci-test-diagnostics.mjs` で実行する。`CI_TEST_OS`、`CI_TEST_SHARD`、`CI_TEST_OUTCOME` に実行環境とテストステップの outcome を渡す。run 情報は `GITHUB_*` から、SHA は `git rev-parse HEAD` から取得する。出力先は `$RUNNER_TEMP/loomake-ci-test-diagnostics`。`GITHUB_STEP_SUMMARY` があれば要約を追記し、`GITHUB_OUTPUT` には `artifact-name` と `directory` を書く。
