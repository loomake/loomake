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

## publication-retry の Windows 診断（Issue #178）

`profile-publication-retry` は、元の失敗と同じ `pnpm test --shard=1/2` を Windows・Node 24.22.1・pnpm 12.10.1 の独立した3ジョブで実行します。サンプル1〜3は失敗の再試行ではなく、成否をそれぞれ保存する別の実行です。`fail-fast: false` とし、既存の assertion・ケース・60秒制限・skip・retry・通常の `ci.yml` は変更しません。導入は `--frozen-lockfile --ignore-scripts` で行います。

workflow自身、publication-retry試験、共通fixtureのhelperと診断helper、診断用試験、本文が変わったPRで起動し、手動でも起動できます。診断ステップには `LOOMAKE_EXTERNAL_TEST_DIAGNOSTIC_DIR` を渡します。未指定なら、この診断のファイルとpreloadは作りません。既存の `LOOMAKE_TEST_PHASE_PROFILE_DIR` による集計とは別の記録です。

publication-retryの25ケースは、fixture作成前に固有のIDを作り、固定のケース分類とともに `*.phases.jsonl` へ記録します。repo-ready以降の安全なfixture basenameで `*.processes.jsonl` と対応します。phaseはcase-start、repo-ready、run-start/end、破損8ケースのmutate-end/amend-end、cleanup-start/end、case-endです。runの番号・終了コード・初回に想定した作成前失敗の理由を含むかというbooleanを記録します。理由のbooleanは診断であり、元のassertionを置き換えません。

caseごとの閉包とRepoのWeakMapを使うので、timeout後に古いcallbackが残って次のケースと重なっても、同じ「現在のcase」へ記録を混ぜません。監視役と偽claude・ghのentry/exitは、fixture basename・PID・preload起動ごとのUUID sessionを含む一意なファイルへ記録します。PIDが再利用されても、別sessionのentry/exitを同じ組にしません。時刻は全てDate.now()です。固定のevent・操作分類、数値、boolean、安全なbasenameだけを残し、生のstdout/stderr、引数、環境値、認証情報は保存しません。

各ファイルは64KiB以内の完全なJSONLとし、上限では `truncated` を1行だけ残し、以後は短い行も追記せず終端とします。準備・書込みの失敗を元の試験へ返さず、診断だけを欠損させます。truncated、phaseやentry/exitの不足、不正な時刻、途中で切れた実行は計測不足です。0秒や成功へ補いません。case-endのcompletedはcallbackとcleanupが終わったことを表し、Vitestが既にtimeoutと判定したケースを成功へ戻しません。

artifactは `publication-retry-<run>-<attempt>-<sample>` という名前で、診断ディレクトリだけを7日保存します。`always()` でテスト失敗後やキャンセル後もuploadを試みますが、runner停止や準備失敗などでファイルがなければ計測不足です。全3サンプルの失敗も残して管理役が判定し、成功したサンプルだけを選びません。

保存済みreportのファイル開始時刻に先行ケースのdurationを足すと、失敗ケースの時間帯と他ファイルとの重なりを推定できます。ただしhookや隙間の位置、timeout後のcallback終了は観測していません。ファイルの時間帯が重なっても同時のCPU使用や原因を証明しません。新しいphase記録と合わせて判断してください。

この追加は原因を絞るための診断です。Linuxの成功やWindowsでの未再現を修理完了とせず、管理役が全結果を判定するまで[Issue #178](https://github.com/loomake/loomake/issues/178)を開いたままにします。

### 診断artifactとjobログの読み合わせ

環境変数はshard 1/2全体へ渡るため、preloadはpublication-retry以外のmakeRepo利用試験のNode子プロセスにも入ります。既存external-budgetの安全な分類・時刻を持つ `<base>.jsonl` も同じディレクトリへ保存されます。多数の小さなファイルとI/O、WindowsのDefenderによる走査が観測負荷を増やす可能性があります。診断ありの時間を通常CIの時間と同一には扱いません。

1. run・attempt・sample・checkout/headを確認し、成功と失敗を含む3artifactと各jobログを保存します。artifactは診断dirだけなので、Vitestの各ケースの成否とtimeoutはjobログで照合します。case-endがcompletedでも、Vitestのtimeoutを成功へ戻しません。
2. phaseのcase IDと安全なrepo basenameを確認し、同じrepoのprocessをsessionごとに対応させます。entryだけ、exitだけ、truncated、不正時刻は計測不足として残します。別sessionやPID再利用を理由に記録を補いません。
3. phaseの段階時間、supervisorと偽CLIの区間、他repoとの重なりを確認します。他repoのbasenameはテストファイル名を表さず、新artifactにtest-reportはないため、D0のファイル開始/終了時刻による推定を同じ形で再計算できません。別runのreportで代用しません。

操作分類は固定集合です。Windowsの外側の引用符を判定時だけ外し、gh-pr-listとgh-pr-createを分けます。生の値は保存しません。集合にない操作はotherや大分類に残り、claudeの版確認とshell経由の品質コマンドなどを、分類だけでは区別できない場合があります。順序からの推定も確定とは扱いません。

残り予算そのものは保存していません。約30秒の監視役区間だけでは、1操作の期限か共有予算か、起動待ち・保持役・停止処理のどれかを断定できません。phase、操作分類、偽CLI、jobログを合わせても区別できなければ未確定のまま残します。

旧head641b915の3sampleではpnpm/action-setup・Node準備・導入が全て成功し、packageManagerと同じpnpm12.10.1を明示した二重指定による失敗はありませんでした。この結果に基づきworkflowの版指定は維持します。将来の失敗を無視する規則にはしません。
