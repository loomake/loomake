# 品質を確認する

開発環境はNode.js 24とpnpmを使う。依存を`pnpm install --frozen-lockfile`で導入し、`pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm build`を実行する。変更の実装前と完了時には、AGENTS.mdに従って対象changeの仕様ゲートと完了ゲートを通す。

不具合修正では、問題を再現するテストが修正前に失敗することを確認する。失敗理由、修正後の成功、関連する既存テストの結果をchangeのtdd.mdへ残す。テストが失敗したときは、期待値を実装へ合わせる前に、差分仕様・出典・失敗理由を確認する。

## 配布物と操作試験

リポジトリのソースを直接読むテストに加え、独立したプロジェクトへ実際のtarballを導入して確認する。

```sh
node scripts/package-smoke.mjs prepare /tmp/loomake-package-trial
node scripts/package-smoke.mjs check /tmp/loomake-package-trial
node scripts/ai-journeys.mjs /tmp/loomake-ai-journeys
```

いずれも新規の保存先を指定する。配布物の試験は公開API・スキーマ・bin・主要コマンドを確認する。AIによる操作試験は初回導入、通常の操作、意図した失敗からの復旧を行い、journeys.jsonに操作・終了コード・所要時間を残す。これはAIが作成して実行するシナリオで、人の利用者による評価や実エンジン・GitHubへの接続試験ではない。実際のClaude Codeで`loomake run`を動かした試用の結果は[real-engine-trials.md](quality/real-engine-trials.md)にある。

## ドメイン判定のmutation試験

次のコマンドは、既存のagreementとcoverage-policyの10テストをコピーし、重要な13条件を1つずつ変更して実行する。通常のテストでも、この検査を別プロセスで実行する。

```sh
node scripts/domain-mutations.mjs .loomake/quality/domain-mutations-trial
```

保存先はリポジトリの`.loomake/quality/`配下の新規ディレクトリにする。既存の保存先を指定すると上書きせず失敗する。ルートのソース・テスト・通常のテストレポートは変更しない。

| 条件 | 意図的な変更 | 検出に使う既存テストの要件 |
|---|---|---|
| M01 | 要件IDの最小桁数を減らす | REQ-147 |
| M02 | 要件IDの終端を検証しない | REQ-147 |
| M03 | 不正な状態を拒否しない | REQ-147 |
| M04 | ブロッキング値の大文字を認めない | REQ-147・REQ-148 |
| M05 | 非ブロッキングの質問も停止条件にする | REQ-148 |
| M06 | 回答済みの質問を停止条件にする | REQ-148 |
| M07 | 確認待ちの判定を逆にする | REQ-148 |
| M08 | 承認の有無の判定を逆にする | REQ-148 |
| M09 | 出典の有無の判定を逆にする | REQ-148 |
| M10 | テスト不足の判定を逆にする | REQ-149 |
| M11 | 対応するファイルを並べ替えない | REQ-149 |
| M12 | 対応するファイル名の代わりに要件IDを返す | REQ-149 |
| M13 | 必要な要件IDの重複を除かない | REQ-149 |

最初に変更のない実装が成功することを確認する。その後、同じ名前と件数のテストを実行し、終了コード1かつAssertionErrorによる失敗がある条件だけを`killed`と記録する。全テストが成功した条件は`survived`、構文エラー・読み込み失敗・タイムアウト・レポートの欠損や矛盾などは`error`になる。各試行の上限は30秒、出力は4MiBとする。

results.jsonには条件の変更内容、元と変更後のハッシュ、失敗したテスト名、終了コード、所要時間、元ファイルの不変性を記録する。試行ごとのreport.jsonとstdout.txt・stderr.txt、変更後のmutation.txtも残す。実行用のコピーと一時設定は試行後に取り除く。

未検出やエラーがあれば検査全体は終了コード1になる。未検出の場合は、その条件の意味と対応する仕様を確認し、必要な正常・異常・境界のテストを追加する。エラーの場合はログを読み、試験の成立条件を直す。対象の文字列が一意に見つからない場合は、コードの変更を確認して条件の一覧を見直す。

この検査は手で選んだ13条件だけを対象にする。全コードのmutation score、全Scenarioの網羅、安全性の保証を示す結果ではない。新しい重要な条件は、仕様とテストの対応をレビューしてから追加する。


doctorの静的診断とAI作成の復旧試験は[doctor.md](guide/2.guides/2.doctor.md)を参照する。scriptの存在と実行成功、AI作成の操作試験と人による利用者試験を分けて記録する。


Scenarioごとの対応は[scenario-audit.md](guide/2.guides/4.scenario-audit.md)の手順で確認する。IDの一致を候補とし、対応するassertionの内容を確認した記録と実行結果を分けて残す。

## 配布物のCLIへ中断の信号を送る

`tests/package-artifacts.test.ts`は、POSIX環境で配布物のCLIに実際のSIGINT・SIGTERM・SIGHUPを送り、先行コミット・途中の変更・中断の記録と、エンジンのプロセスが残らないことを確認する。SIGTERM・SIGHUPは、準備した利用側のプロジェクトの複製で動かす。`node scripts/run-sigint-smoke.mjs <検証先> SIGTERM`のように、2つ目の引数で信号を選べる。エンジンは試験用の代替コマンドを使う。Windowsでは、この信号試験が対象外であることを確認するだけで、中断動作を検証したとは扱わない。

POSIXで記録を残して個別に試す場合は、開発用Nodeとpnpm・npm・Gitがある環境で、まだ存在しない検証先を指定する。prepareは配布物をビルド・packし、専用のfixtureへインストールする。次のチェックはそのfixtureのタスクを書き換え、コミットしてからCLIを起動する。

```sh
mkdir -p .loomake/quality
node scripts/package-smoke.mjs prepare .loomake/quality/sigint-check-01
node scripts/run-sigint-smoke.mjs .loomake/quality/sigint-check-01
```

結果は検証先の`sigint-results/results.json`、標準出力と標準エラーは同じディレクトリに残る。再実行には新しい検証先を指定する。前の結果を上書きして成功扱いにはしない。

## 下限Nodeと通信拒否下で配布物を使う

開発用Node 24で配布物をprepareし、確認するNodeの実行ファイルを指定してチェックする。Nodeの実行ファイルを取得する場合は、公式の配布物とチェックサムを照合する。以下はLinuxで、Node 22.12.0のbinディレクトリが`/tmp/loomake-runtime-22.12.0/bin`にある場合の例である。

```sh
mkdir -p .loomake/quality
node scripts/package-smoke.mjs prepare .loomake/quality/runtime22-check-01
PATH="/tmp/loomake-runtime-22.12.0/bin:$PATH" python3 scripts/deny-network.py /tmp/loomake-runtime-22.12.0/bin/node scripts/runtime-compatibility.mjs .loomake/quality/runtime22-check-01 .loomake/quality/runtime22-results-01 22.12.0
```

PythonのラッパーはLinux ARM64・x86_64を対象にし、子プロセスだけにno_new_privsとseccompの通信拒否を継承させる。通信を試みてEPERMになることを確認してから、主要コマンドとtrace、runのSIGINT試験を実行する。フィルターを設定できない場合や対照実験が成立しない場合は失敗する。単に通信モジュールを使わないという静的検査では代用しない。今回実際に確認したCPUはARM64で、x86_64のCI成功は未確認である。

結果は新しい保存先のresults.jsonとreport.jsonに残る。Nodeの版、通信拒否の対照、検査の成否、スクリプトと配布物のハッシュを記録する。既存のprepare済みfixtureは、通常のcheckやSIGINT試験で変更されるため、別の検証には新しいfixtureと保存先を使う。

Linuxの配布物テストには、制限なしではこのチェックが成功しない対照と、制限下で成功するケースを含めている。他OSでは対象外であることの確認だけで、通信拒否下の動作が確認できたとは扱わない。Node 20のCIにも専用のfixtureと同じ検証を追加しているが、設定の存在とCIでの実行成功は区別する。

## スキーマの版と配布物の公開型

スキーマの契約は、現行の`packages/core/test/schema.test.ts`を一時コピーで実行して確認する。必須プロパティの削除・改名を、ルートと配列の要素で試す。minor番号だけを変えた削除は拒否され、major番号を変えた削除・改名は許可されることを、実際の検査結果で比較する。試験用の2.0.0はコピー上の値である。

```sh
node scripts/schema-contract-check.mjs .loomake/quality/schema-contract-01
```

検証先は新しいディレクトリを指定する。8ケースのreport.json・標準出力とエラー・候補スキーマと、全体のresults.jsonを残す。読み込み失敗や時間切れを、破壊的変更の検出として数えない。対象は現在の1.0.0の履歴と必須プロパティの契約で、enumや型の変更など、JSON Schema全体の互換性の棚卸しは残っている。

公開型は、packしてインストールした4ライブラリを利用するfixtureをコンパイルする。開発用Nodeと、このリポジトリのTypeScript・Nodeの型定義を使う。結果には両方の版を記録する。

```sh
node scripts/package-smoke.mjs prepare .loomake/quality/public-types-01
node scripts/check-public-types.mjs .loomake/quality/public-types-01 .loomake/quality/public-types-results-01
```

`tests/fixtures/public-api/consumer.ts.txt`を利用側のconsumer.tsへコピーし、NodeNext・strict・noEmit・skipLibCheckなしで検査する。ワークスペース用のsource条件は使わない。fixtureには、パーサ、verify、証拠、report、runの主な型と呼び出しの例を含める。

配布物の回帰試験では、`VerifyResult.ok`の宣言をbooleanからstringに変えるとTS2322になり、元へ戻すと再び成功することも確認する。別の試験では、開発側のsource条件が4ライブラリのsrcを実際に解決することを確認する。選んだ型と署名を保護するfixtureとして維持し、全exportの棚卸しも続ける。
