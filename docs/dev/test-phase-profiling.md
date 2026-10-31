# 遅い試験の区間計測

`LOOMAKE_TEST_PHASE_PROFILE_DIR` に保存先を指定したときだけ、対象試験の計測イベントをプロセスごとのJSONLへ保存します。指定しなければ計測ファイルは生成しません。記録に失敗しても、元の試験へ例外を返しません。

```sh
LOOMAKE_TEST_PHASE_PROFILE_DIR=/tmp/loomake-phases pnpm exec vitest run tests/ai-journeys.test.ts packages/runner/test/external-budget.test.ts
LOOMAKE_TEST_PHASE_PROFILE_DIR=/tmp/loomake-phases node scripts/test-phase-profile.mjs
```

集計コマンドは保存先へ `profile.json` と `summary.md` を生成します。記録が不完全なら終了コード1を返します。JSONLはプロセスごとに1MiBまで記録し、上限到達を示すイベントを残します。区間の欠損、不正な時刻、重複、読み取り失敗は計測不足として表示し、0秒や成功として補いません。生のJSONLはCIの保存対象に含めません。

対象は配布物操作の `journeys-temp`・`journeys-repo`、期限試験の `deadline-push`・`deadline-create`、共有準備の `shared-package-build` です。期限試験は準備、停止前の処理、停止待ちと停止処理、再実行、後片付けを分けます。配布物操作では準備、npm導入、Git操作、CLI操作、後片付けを分けます。準備に含まれるコマンドを操作時間へ重ねて計上しません。総時間から各区間を引いた残りが「その他」です。欠損や重複があれば残りを推計しません。共有build・packは個別試験へ加算せず、別枠に表示します。

JSONにはrun、試行、`LOOMAKE_TEST_PHASE_SAMPLE`、実際のcheckout SHA、OS、Node、`TEST_PHASE_OUTCOME` を記録します。stdout、stderr、コマンド引数、環境変数全体、利用者のファイル内容は保存しません。日本語要約は表示する文字をエスケープし、32KiB以内に収めます。

計測を有効にした実行には記録の負荷も含まれます。通常CIの所要時間と同一とは扱わず、区間の内訳を比較するために利用してください。

期限試験の準備はテスト開始から最初のrun直前まで、停止前の処理はrun開始から偽CLIの既存の停止時刻まで、停止待ちと停止処理はその時刻から実際のrun終了までです。再実行と後片付けを別々に測り、後片付けまで成功した場合だけ試験の成功を記録します。配布物操作は子プロセスのprepare全体と、その外で実行した既存stepのdurationMsを使います。prepare内のnpmやGit操作はコマンド別集計へ加算しません。fixture作成や後片付けが失敗しても試験の成否と終了を記録し、完了しなかった区間は未計測として扱います。

## Windowsで3サンプルを計測する

`profile-slow-tests` workflowは、計測スクリプト、対象試験、計測用試験、共有準備、説明文書、workflow自身などに変更があるPRで起動します。GitHub Actionsの画面から手動でも起動できます。Windows・Node24の独立したジョブでサンプル1〜3を実行し、配布物操作の2ケースとpush・createの期限試験を同じ条件で測ります。1つのサンプルが失敗しても、残りのサンプルは止めません。

各サンプルはテストステップの成否を記録し、失敗時にも集計と保存を試みます。checkoutやNodeの準備が失敗した場合とキャンセル時には、集計と保存を保証しません。集計が失敗しても、生成済みファイルの保存を試みます。元のテスト失敗はジョブの失敗として残します。

Actionsの各実行から `ci-phases-<run>-<attempt>-<sample>` artifactを開いてください。保存対象は `profile.json` と `summary.md` だけで、保存期間は7日です。生のJSONLや元の `journeys.json` は保存しません。3サンプルの同じ区間について中央値と最小値・最大値を比較し、不足がある区間は0秒として集計しないでください。並列に動く別のマシンの測定なので、ばらつきも観測結果として扱います。

## 初回runの時計診断

`LOOMAKE_TEST_PHASE_PROFILE_DIR` と `LOOMAKE_TEST_BUDGET_CLOCK=1` を指定すると、push・createの初回runについて追加の時計を保存します。単調時計の実時間と、同じrunの前後で採取した保持役の準備待ちの差分から、予算上の経過時間を求めます。既存の予算と猶予も表示します。時計は区間の総時間へ加算しません。

追加診断を指定した集計では、`profile.json` の `budgetClocks` に2ケースの結果を保存します。欠損、重複、負値、非有限数、実時間を超える待ち、正でない予算は不足または不整合として示し、そのケースの数値をnullにします。元の区間が途中で欠けても、得られた時計は独立して確認できます。時計が不足した集計は非ゼロで終了します。追加診断を指定しなければ、従来の出力と判定を維持します。

予算上の経過時間だけで元の試験を成功へ読み替えません。実時間、保持役の待ち、予算上の時間、元の試験の成否を合わせて、計時基準の差と停止処理の影響を判断してください。

## publication-retry の段階と外部操作の記録（Issue #178）

PR #179 の診断を取り込んだものです。`LOOMAKE_EXTERNAL_TEST_DIAGNOSTIC_DIR` を指定したときだけ動きます。未指定なら、記録のファイルも preload も作りません。CI では `quality-quarantine` ワークフロー（[ci.md](ci.md) の「時間切れする試験の隔離」）が、隔離中の試験を流すときに指定します。専用のワークフローは作っていません。相対パスを指定した場合は、テストのワーカーの cwd を基準に絶対パスにします。

publication-retry の 25 ケースは、それぞれ固有の ID と固定のラベルで `*.phases.jsonl` に段階を記録します。段階は case-start、repo-ready、run-start・run-end、証拠を壊す 8 ケースの mutate-end・amend-end、cleanup-start・cleanup-end、case-end です。run-end には run の番号、終了コード、出力に「作成前に失敗」を含むかどうかを残します。検索結果の不正 7 種類は元の入力を保存せず、固定のラベル（`lookup-broken-json` など）に分けます。

「作成前に失敗する 1 回目の run」が同じ形の 10 ケース（`create-before`、`new-source`、証拠を壊す 8 ケース）は、1 回目の run を `shared-first-run` のラベルの記録で 1 回だけ流します。10 ケースの記録には 1 回目の run-start・run-end がなく、2 回目の run だけを n=2 で残します。repo-ready は、保存した 1 回目の結果を作業ディレクトリへ戻し終えた時点です。

`makeRepo` は preload を `repo.env.NODE_OPTIONS` に足します。preload は `argv[1]` のファイル名が `supervisor.cjs`・`claude`・`gh` の Node プロセスだけについて、entry と exit を `*.processes.jsonl` に記録します。ファイル名にはリポジトリの basename、PID、preload の起動ごとの UUID を入れます。PID が再利用されても、別の起動の記録を混ぜません。監視役の行には操作の分類（`git-commit`・`gh-pr-create` など）と、期限までの残り時間 `remainingMs` を残します。

記録は 1 ファイル 64KiB を上限とし、上限に達したら `truncated` の行を 1 つ残して止まります。記録の準備や書き込みに失敗しても、元の試験には例外を返さず、記録が欠けるだけです。生の stdout・stderr、引数、環境変数の値、認証情報は保存しません。

読むときは次の点に注意してください。

- entry だけ・exit だけの区間、`truncated`、不正な時刻は計測不足として扱います。0 秒で補ったり、成功とみなしたりしません
- case-end の `completed` は callback と後片付けが終わったことを表します。vitest がすでに時間切れと判定したケースを、成功に戻すものではありません
- Windows ではテストのプロセスごとに、最初の外部操作の前に保持役の準備を最大 10 秒待ちます。この待ちは preload の記録にも `remainingMs` にも現れません
- 記録のファイルが多いと、I/O や Windows Defender の走査で負荷が増えることがあります。診断ありの時間を、ふだんの CI の時間と同じには扱いません

心拍の記録（`scripts/ci-heartbeat.mjs`）と並べて読むと、試験の段階が止まった時刻に実行環境全体も止まっていたかを確かめられます。
