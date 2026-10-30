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

`profile-publication-retry` は、元と同じコマンド `pnpm test --shard=1/2` を Windows・Node 24.22.1・pnpm 12.10.1 の独立した3ジョブで実行します。試験ファイルの増減でshardの割当は変わるため、元と同じファイル構成や負荷は保証しません。サンプル1〜3は失敗の再試行ではなく、成否をそれぞれ保存する別の実行です。`fail-fast: false` とし、既存の assertion・ケース・60秒制限・skip・retry・通常の `ci.yml` は変更しません。導入は `--frozen-lockfile --ignore-scripts` で行います。

workflow自身、publication-retry試験、共通fixtureと診断のhelper、監視役・Windowsの保持役、core・kit・trace・runner・CLIの実装、shard構成の設定、診断用試験、本文が変わったPRで起動し、手動でも起動できます。診断ステップには `LOOMAKE_EXTERNAL_TEST_DIAGNOSTIC_DIR` を渡します。指定値はテストworkerのcwdを基準に絶対パスへ解決し、子プロセスにも同じ保存先を渡します。未指定なら、この診断のファイルとpreloadは作りません。既存の `LOOMAKE_TEST_PHASE_PROFILE_DIR` による集計とは別の記録です。

自動起動の対象は次のパスです。

- `.github/workflows/profile-publication-retry.yml`
- `packages/runner/test/publication-retry.test.ts`
- `packages/runner/test/process-diagnostics.ts`
- `packages/runner/test/helpers.ts`
- `packages/kit/supervisor/**`
- `packages/**/src/**`
- `packages/kit/test/project.ts`
- `vitest.config.ts`
- `tests/publication-retry-diagnostics*.test.ts`
- `docs/dev/test-phase-profiling.md`

publication-retryの25ケースは、fixture作成前に固有のIDを作り、固定のケース分類とともに `*.phases.jsonl` へ記録します。repo-ready以降の安全なfixture basenameで `*.processes.jsonl` と対応します。phaseはcase-start、repo-ready、run-start/end、破損8ケースのmutate-end/amend-end、cleanup-start/end、case-endです。runの番号・終了コード・「作成前に失敗」を含むかというexpectedReasonのbooleanを全runで記録します。作成前失敗の判定として解釈するのはFAKE_GH_CREATE=beforeの初回で、他のrunのfalseを異常と決めません。lookupの不正7種類は固定ラベルで分け、元の入力やURLは保存しません。理由のbooleanは診断であり、元のassertionを置き換えません。

caseごとの閉包とRepoのWeakMapを使うので、timeout後に古いcallbackが残って次のケースと重なっても、同じ「現在のcase」へ記録を混ぜません。監視役と偽claude・ghのentry/exitは、fixture basename・PID・preload起動ごとのUUID sessionを含む一意なファイルへ記録します。PIDが再利用されても、別sessionのentry/exitを同じ組にしません。時刻は全てDate.now()です。固定のevent・操作分類、UUID、有限の数値、boolean、安全なbasenameだけを残し、生のstdout/stderr、引数、環境値、認証情報は保存しません。

新しい `*.phases.jsonl` と `*.processes.jsonl` は、正常に書けた行を64KiB以内の完全なJSONLとして保存し、上限では `truncated` を1行だけ残し、以後は短い行も追記せず終端とします。準備・書込みの失敗を元の試験へ返さず、診断だけを欠損させます。I/O失敗ではtruncatedの印を残せない場合や、途中で切れたJSONL行が残る場合があり、プロセス停止との区別が付かなければ未確定とします。truncated、phaseやentry/exitの不足、不正な時刻、途中で切れた実行は計測不足です。0秒や成功へ補いません。case-endのcompletedはcallbackとcleanupが終わったことを表し、Vitestが既にtimeoutと判定したケースを成功へ戻しません。

artifactは `publication-retry-<run>-<attempt>-<sample>` という名前で、診断ディレクトリだけを7日保存します。`always()` でテスト失敗後やキャンセル後もuploadを試みますが、runner停止や準備失敗などでファイルがなければ計測不足です。全3サンプルの失敗も残して管理役が判定し、成功したサンプルだけを選びません。

保存済みreportのファイル開始時刻に先行ケースのdurationを足すと、失敗ケースの時間帯と他ファイルとの重なりを推定できます。ただしhookや隙間の位置、timeout後のcallback終了は観測していません。ファイルの時間帯が重なっても同時のCPU使用や原因を証明しません。新しいphase記録と合わせて判断してください。

この追加は原因を絞るための診断です。Linuxの成功やWindowsでの未再現を修理完了とせず、管理役が全結果を判定するまで[Issue #178](https://github.com/loomake/loomake/issues/178)を開いたままにします。

### 診断artifactとjobログの読み合わせ

環境変数はshard 1/2全体へ渡ります。ただしpreloadはmakeRepoのrepo.env.NODE_OPTIONSへ追加するため、記録されるのはそのenvを渡すrunnerのgit・gh・claudeと、それらからenvを引き継ぐNode子プロセスです。publication-retry以外のmakeRepo利用試験にもこの範囲で入ります。既存external-budgetの分類・時刻を持つ `<base>.jsonl` も同じディレクトリへ保存されます。この既存形式は上限で末尾の行が途中で切れる場合があり、truncatedの印も保証しません。新しいphase/processの完全行の説明とは分けて読み、切断やI/O欠測は計測不足として残します。多数の小さなファイルとI/O、WindowsのDefenderによる走査が観測負荷を増やす可能性があります。診断ありの時間を通常CIの時間と同一には扱いません。

1. run・attempt・sample・checkout/headを確認し、成功と失敗を含む3artifactと各jobログを保存します。毎sampleのjobログでpublication-retry.test.tsの実行と25ケースを確かめ、対応するphaseファイル25件の分類・IDを照合します。0件や不足なら、対象が別shardへ移った可能性を含む計測不足とし、元症状の未再現とは扱いません。artifactは診断dirだけなので、Vitestの各ケースの成否とtimeoutはjobログで照合します。case-endがcompletedでも、Vitestのtimeoutを成功へ戻しません。
2. phaseのcase IDと安全なrepo basenameを確認し、同じrepoのprocessをsessionごとに対応させます。entryだけ、exitだけ、truncated、不正時刻は計測不足として残します。別sessionやPID再利用を理由に記録を補いません。
3. phaseの段階時間、supervisorと偽CLIの区間、他repoとの重なりを確認します。他repoのbasenameはテストファイル名を表さず、新artifactにtest-reportはないため、D0のファイル開始/終了時刻による推定を同じ形で再計算できません。別runのreportで代用しません。

期待する25ラベルと、`publication-retry.test.ts` のケースの対応は次のとおりです。`it.each` の行は、その引数で識別します。各ラベルを1件ずつ確認し、代替値の `publication-retry`・`lookup-invalid` が出た場合や、重複・不足がある場合は計測不足とします。

| ラベル | Vitestのケース名またはit.eachの引数 |
|---|---|
| `create-before` | 作成の%sで失敗した後も同じ証拠とコミットを使う：`before` |
| `create-after` | 同上：`after` |
| `push-retry` | push失敗後に同じ証拠を再利用して送信する |
| `repeat` | 完了後も再実行で証拠・コミット・PRを増やさない |
| `new-source` | 証拠の後に実装を変えたら新しい対象SHAの証拠を作る |
| `json` | %sの証拠は消さず増やさず停止する：`json` |
| `sha` | 同上：`sha` |
| `change` | 同上：`change` |
| `failed` | 同上：`failed` |
| `fail-result` | 同上：`fail-result` |
| `hash` | 同上：`hash` |
| `snapshot` | 同上：`snapshot` |
| `legacy` | 同上：`legacy` |
| `lookup-fail` | 検索結果 %s で停止して証拠を残す：`fail` |
| `lookup-broken-json` | 同上：`broken` |
| `lookup-object` | 同上：`{}` |
| `lookup-bad-url` | 同上：URLがjavascriptスキームの1件配列 |
| `lookup-credentials` | 同上：URLに認証情報がある1件配列 |
| `lookup-wrong-head` | 同上：headRefNameがotherの1件配列 |
| `lookup-cross-repo` | 同上：isCrossRepositoryがtrueの1件配列 |
| `lookup-multiple` | 同上：同じrowが2件の配列 |
| `verify-fail` | 今回の検証に不合格なら過去の証拠を代用しない |
| `verify-head` | 検証が%sを変えたら取り消さず外部操作を止める：`HEAD` |
| `verify-branch` | 同上：`ブランチ` |
| `verify-dirty` | 検証が作業ファイルを変えたら、その変更を残して停止する |

操作分類は固定集合です。Windowsの外側の引用符を判定時だけ外し、gh-pr-listとgh-pr-createを分けます。生の値は保存しません。集合にない操作はotherや大分類に残り、claudeの版確認などの詳細を分類だけでは区別できない場合があります。順序からの推定も確定とは扱いません。

監視役のentry/exitでは、実runExternalが渡すdeadlineとhrtimeの差を有限数値のremainingMsとして残します。無い値・非数値・非有限値は保存せず、期限を過ぎた負値はそのまま記録します。偽CLIの行にはこの欄はありません。操作分類と残り時間は1操作と共有予算を区別する手がかりですが、起動待ち・保持役・停止処理の内訳や停止原因を単独で断定しません。

workflowのpnpm版はpackageManagerと同じ値を明示します。実setupと導入の成否、版指定を維持した判断は[PR179](https://github.com/loomake/loomake/pull/179)に記録します。過去の成功で将来の失敗を無視しません。

publication-retryのfixtureでは、repo.envを渡さないrunVerify・品質コマンドとtrace recordのverify・gitに、このpreloadは入りません。このfixtureは `openspecValidate: false` なので、仕様ゲートは外部プロセスを起動せず、プロセス内の処理だけを行います。一方、既存external-budgetのuseRepoEnvなどはrepo.envのNODE_OPTIONSをworkerのprocess.envへ一時的に移します。その間にverify・trace・仕様ゲートが外部操作を起動すれば、その監視役も記録される場合があります。今回の変更ではworker全体のNODE_OPTIONSの扱いを変えません。

run区間から、同じrepoの完全なentry/exitがそろった監視役と偽CLIの区間の和集合を引いた残りを「未分類時間」とします。直接起動されるengineの偽CLIも含め、各区間をrunの開始・終了内へ切り詰めてから集計します。同じrepoの監視役と重なる偽CLIは集計上の入れ子として扱い、重なる部分を二重に加算しません。

未分類時間には、publication fixtureの未観測verify・品質・trace、仕様ゲートのプロセス内処理、観測済み操作の監視役がentryを記録する前やexit後に親へ戻るまでの時間、JSの処理、待ち、記録負荷も含まれます。品質処理の時間やCPU時間と決めません。entry/exit欠落・truncated・I/O切断などで必要な区間が不明なら、完全な和集合や未分類時間は確定できません。観測できた区間だけを残し、欠測を0秒として引き算を完成させません。記録がないことを外部操作がない証拠にしません。

Windowsでは、各テストプロセスの最初の外部操作の前に、保持役の準備を最大10秒待ちます。この待ちはpreloadの記録とremainingMsには現れず、操作の期限と共有予算からは除かれますが、Vitestの制限時間には含まれます。また、監視役が結果を書かずに終わったあとの子孫停止確認は、監視役のexit後に親で最大10秒かかります。この後片付けも期限を延ばさず共有予算から除かれないまま、未分類時間へ入ります。最初のrunと後続のrunを同じ条件として比較せず、これらの待ちを品質処理や未観測verifyの時間と断定しません。

旧headの計測も失敗を含めて保存するため、この診断workflowには新pushで旧実行を取り消すconcurrencyを設定しません。新旧が並行する負荷の違いも残し、headとrunを混ぜず判定します。実測の数値、未解決の[Issue178](https://github.com/loomake/loomake/issues/178)・[Issue181](https://github.com/loomake/loomake/issues/181)・[Issue183](https://github.com/loomake/loomake/issues/183)と対応は[PR179](https://github.com/loomake/loomake/pull/179)へ記録し、診断だけで修理完了や全検査成功とはしません。
