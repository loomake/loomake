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

## PR の段階と gate ジョブ

gate ジョブは PR の段階（AGENTS.md 2 章の L1・L2・L3）を先に決め、段階に応じて検査を変える。段階の決め方は monorepo の仕様の「工程の段階の判定」（REQ-342）、段階ごとの動作は「段階ごとの完了ゲートの動作」（REQ-343）にある。判定の実装は `scripts/ci-tier.mjs` で、quality ジョブの docs_only の判定（`scripts/ci-docs-only.mjs`）も同じ関数を使う。「文書だけ」と「段階 L1」は同じ意味になる。

- L1（文書だけ）：lint と `tests/doc-links.test.ts` を実行する。対象の change があれば `verify --change <id> --done` も実行し、なければ `verify` は呼ばない。L1 で、かつ tasks.md に完了した印が 1 つもない change（提案だけの PR）は、`--done` ではなく `--spec-only` で検査する。L2・L3 は完了数によらず常に `--done`。quality ジョブは品質コマンドを飛ばすので、文書を読むテストを実行するのは gate の doc-links だけになる
- L2（試験・CI・開発基盤）：これまでどおり、対象の change があれば `verify --change <id> --done`、なければ `verify`（品質コマンドだけ）を実行する
- L3（製品コードと Requirement の変更）：change が必須。`loomake-change: none` や change を特定できない PR は失敗する

段階は PR 本文の `loomake-tier:` の行で上げる方向にだけ上書きできる。gate は決めた段階と理由を標準出力に `loomake-tier: L2（scripts/ci-gate.mjs）` の形で 1 行書き、ステップの出力 `tier`・`tier_line` にも入れる。この行を PR 本文の証跡ブロックの `tier:` に写す。

Requirement の変更は、`openspec/specs/` と `openspec/changes/<id>/specs/` の `spec.md` で、変更した行が属する節で見る。`git diff -U0` のハンクの行番号から、足した行は HEAD の、消した行はベースのファイルを読み、直前の見出しが `### Requirement:` なら Requirement の変更（L3）とする。`#### Scenario:` の配下や Purpose の文言だけなら、RFC 2119 の語を足しても L1 のまま。archive の PR（`openspec/changes/archive/` にファイルを足すか移す）は Requirement を主仕様に写すが、実装 PR の `--done` で検査済みなので L1 として扱う。

change のない L1 の PR では `verify` を呼ばないため、`tests/doc-links.test.ts` を gate で直接実行している。gate からこの試験を外すときは、文書だけの PR で文書を読むテストを実行する場がなくなることを確かめる。

`ci:all-os` ラベルを L3 の PR で必須にする検査は、3 OS の試験の時間切れが直るまで入れていない。時間切れする試験は、下の「時間切れする試験の隔離」で一時的に外している。

## 開発の台本

- `scripts/clean-merged-worktrees.sh`：ブランチを head にした PR が GitHub で merged になっている clean な worktree を消す（`gh pr list --state merged` で確かめる。gh を使えなければ何も消さない）。detached HEAD、dirty、`.loomake/`・`node_modules/`・`dist/`・`coverage/` 以外の無視ファイルがあるものは残す。`--dry-run` で一覧と判定理由だけを表示し、`--keep <name>` で残すものを指定する。各 worktree の `.loomake/` は `.loomake/archive/worktree-loomake-<日付>/` に退避する。ブランチは消さない
- `scripts/delivery-metrics.sh <出力ディレクトリ>`：配布ワークフロー改善ダッシュボードの指標（PR の段階と所要時間、Issue #121 の投稿量、worklog の量、CI の実行時間）を CSV に集める。段階は `ci-tier.mjs` の `classifyPath` で決める。一時ディレクトリに書いてから移すので、gh に失敗しても前のファイルは残る。gh・git・node・python3 が要る

## まだ仕様にあるもの

次の 2 つはいま monorepo の仕様にあり、変えるには change が要る。進行中の change が終わってから、このページに移す候補にしている。

- 3 つの OS での CI（REQ-049）
- CI のテストの分割（REQ-214）

完了ゲート（gate のジョブ）と release ワークフローは、利用者や配布物にかかわるので、仕様に残す。

## 時間切れする試験の隔離

macOS と Windows でだけ時間切れが続く試験ファイルは、`tests/quarantine.json` に書くと、その OS の quality ジョブのシャードから一時的に外せます。決まりは monorepo の仕様の「試験の隔離一覧」（REQ-344）にあります。試験の上限時間を延ばしたり skip したりする代わりに使うものではありません。原因を調べて直すまでの、期限つきの避難です。

```json
{ "entries": [ { "file": "packages/runner/test/pr.test.ts", "tests": ["[REQ-114] …"], "os": ["windows-latest"],
    "issue": 116, "added": "2026-10-31", "expires": "2026-11-14" } ] }
```

- 単位はファイルです。vitest は試験名で除外できず、名前で外すと skip になるためです。`tests` は記録用で、外す範囲には使いません
- `os` には `macos-latest` か `windows-latest` だけを書けます。Ubuntu のジョブは一覧を読まず、すべての試験を実行します
- 各エントリに、原因を追う Issue の番号を書きます。期限は追加日から 14 日以内です
- 期限を過ぎると、macOS・Windows のシャードと `quality-quarantine` の plan ジョブが失敗します。直して一覧から外すか、Issue に理由を書いて期限を見直してください

quality ジョブの macOS・Windows のシャードでは、`scripts/ci-quarantine.mjs --os <OS>` が一覧を検査し、外すファイルを JSON の配列で出力します。テストのステップはそれを環境変数 `LOOMAKE_TEST_QUARANTINE_EXCLUDE` で `vitest.config.ts` に渡し、両方のプロジェクトの `exclude` に足します。テストを実行する `run:` の行は変えていません。

外した試験は別のワークフロー `.github/workflows/quality-quarantine.yml` で流します。main への push・定期実行・`ci:all-os` ラベルの PR・手動実行で動きます。plan ジョブが `ci-quarantine.mjs --matrix` で OS ごとの matrix を作り、`quality-quarantine` ジョブが一覧のファイルだけをシャードに分けずに実行します。このジョブは `continue-on-error: true` なので、失敗しても run の成否には数えません。一覧が空なら、このジョブは飛ばされます。ci.yml の中に置かないのは、ci.yml の既存の試験（`ci:all-os` の式が 1 か所であること、gate が最後のジョブであることなど）を変えないためです。

隔離のジョブでは publication-retry の段階と外部操作の記録（[test-phase-profiling.md](test-phase-profiling.md)）、ai-journeys の区間の記録、心拍を有効にします。それらと vitest の JSON レポートを `quality-quarantine-<run>-<attempt>-<os>-<sample>` の artifact に 7 日保存します。

手動実行では計測のためにだけ次を選べます。既定はどちらも変えません（stabilize-cross-os-tests の Q-03）。

- `samples`：OS ごとのサンプル数（1〜5）
- `temp`：Windows の `TEMP`・`TMP` を `RUNNER_TEMP` に向けるか
- `max_workers`：vitest の並列度を 1 にするか

隔離一覧の期限切れは、macOS・Windows のシャードと `quality-quarantine` の plan ジョブで失敗します。どちらも必須チェックではないので、`ci:all-os` ラベルのない PR は緑のまま通ります。夜間実行の失敗は管理役が毎朝確かめ、期限までに直すか、理由を書いて期限を延ばす PR（L2）を出します。延長は 1 回につき 14 日までです。

手動実行は既定ブランチにあるワークフローだけが対象です。一覧から外すときは、そのファイルが `quality-quarantine` と夜間実行で安定して通ることを確かめてから、エントリを消してください。

## 実行環境の心拍

`scripts/ci-heartbeat.mjs` は実行環境が止まった区間を見つけるための記録です（ci-test-diagnostics の仕様の REQ-345）。quality ジョブの macOS・Windows のシャードと隔離のジョブで、テストの前に `start` で裏で起動し、テストのあとに `stop` で止めます。

- 1 秒ごとに、時刻、前の記録からの間隔、一時ディレクトリと `RUNNER_TEMP` への 4KiB の書き込みと fsync の時間を `heartbeat.jsonl` に書きます
- 10 秒ごとに、`node -e 0` と `git --version` の起動時間も書きます
- 記録は 8MiB で止めます。`stop` は、記録の数、間隔の最大値、5 秒を超えた間隔の回数をジョブの要約と `summary.json` に書きます
- 試験は `LOOMAKE_CI_HEARTBEAT_DIR` があるときだけ、`markPhase` で段階を `phases-<pid>.jsonl` に書けます。いまは package-artifacts の照合の試験と `scripts/package-smoke.mjs` が使っています

心拍も止まっていれば実行環境全体が止まっていた、書き込みだけが遅ければディスク、起動だけが遅ければプロセスの生成、と見分ける手がかりにします。記録の失敗で試験とジョブの成否は変わりません。quality ジョブの記録は `ci-heartbeat-<run>-<attempt>-<os>-<shard>` の artifact に 7 日保存します。

## quality のテスト診断

quality ジョブの要約には、テストステップの成否と JSON レポートの状態を別々に表示する。レポートの状態は、有効・欠損・不正・空の4つ。テストが未実行なら、そのことも明示する。レポートがないことを、成功の証拠にはしない。

状態別件数は全結果を数え、skip・pending・todo・disabled は成功と分ける。失敗の一覧はファイル名とテストの完全名を最大20件、所要時間の一覧は時間のあるテストを長い順に最大10件表示する。各ファイル名とテスト名は200文字、要約全体は32KiB以内に収め、省略があれば件数や文字の省略を表示する。名前に含まれる Markdown と HTML の記号は文字として表示する。

実行画面の Artifacts から、`ci-tests-<run-id>-<attempt>-<os>-<shard>` をダウンロードできる。シャードの `/` は `-` に置き換え、分割しない実行は `all` とする。次のファイルを参照する。

- `metadata.json`：`schemaVersion: 1`、run の URL・ID・試行番号、実際に checkout した SHA、OS、Node の版、シャード、テストステップの結果、レポートの状態、状態別件数。
- `summary.md`：ジョブ要約と同じ日本語の診断。
- `test-report.json`：元レポートの写し。元レポートがあるときだけ保存する。失敗メッセージの全文や一覧で省略されたテストは、このファイルで確認する。

診断スクリプトは `node scripts/ci-test-diagnostics.mjs` で実行する。`CI_TEST_OS`、`CI_TEST_SHARD`、`CI_TEST_OUTCOME` に実行環境とテストステップの outcome を渡す。run 情報は `GITHUB_*` から、SHA は `git rev-parse HEAD` から取得する。出力先は `$RUNNER_TEMP/loomake-ci-test-diagnostics`。`GITHUB_STEP_SUMMARY` があれば要約を追記し、`GITHUB_OUTPUT` には `artifact-name` と `directory` を書く。

artifact の保存期間は7日とする。保存対象は上の3ファイルに限り、ほかの `.loomake` 内のファイルは含めない。レポートが欠損・不正・空でも、その状態を記録する。元レポートが不正な JSON であっても、存在するなら写しを保存する。

テストや、それより前の lint・型検査が失敗したあとも、キャンセルされておらず、checkout と Node の準備が済んでいれば診断を生成する。テストに進まなかった場合は未実行と表示する。生成と upload は別ステップで、生成が失敗しても生成済みのファイルの保存を試みる。保存対象がなければ警告する。診断は品質コマンドの失敗を成功に変えない。

文書だけと判定されたジョブでは診断を生成しない。キャンセルされた実行や、checkout・Node の準備に失敗した実行では、診断の生成と保存を保証しない。artifact がないことを成功と解釈せず、ジョブの状態とログを確認する。

## 依存予算と判定ディレクトリの補助検査（W0-3）

`pnpm test` は `tests/ci-policy-boundaries.test.ts` で、5パッケージの実行時依存を許可集合と照合する。coreはzod、kitはcoreとyaml、traceはcoreとkit、runnerはcore・kit・trace、CLIはcore・kit・trace・runnerだけを許可する。これは上限の検査であり、まだ使っていない依存を追加するものではない。

`dependencies` のほか、`optionalDependencies`・`peerDependencies`・`bundledDependencies`・`bundleDependencies` も照合する。npmの別名は参照先のパッケージ名も照合する。外部ツールのSDKは許可集合にないため、これらへ追加するとCIが失敗する。開発時だけに使う `devDependencies` と、Actions経由で別プロセスとして使うSDKはこの実行時予算の対象外とする。

`pnpm lint` は `packages/kit/src/verify/policy/**/*.ts` に次のESLint規則を適用する。

- `no-restricted-imports`：`node:` 付きと裸の名前のNode組み込みモジュールへの値のimport・再exportを禁止する。型だけのimportは許可する。
- `no-restricted-globals`：`Date`・`process`・通信・時計・タイマー・ログ・動的コード実行などのグローバル参照を禁止する。`globalThis`・`global`・`window`・`self` 自体の参照も禁止し、そこから同じ入口を参照する書き方も検出する。
- `no-restricted-properties`：`Math.random` と `Math['random']` を禁止する。
- `no-restricted-syntax`：動的なimportと `import = require` を禁止する。

判定に使う時刻や環境値は呼び出し側から引数で渡す。収集・実行を担当するモジュールには、このディレクトリ限定の制限を掛けない。試験では実際のESLint設定へ違反例を渡し、拒否されることと、型のimportや引数で渡すデータが許可されることを確かめる。

補助検査の試験は、対象ファイルで有効な4規則と同じTypeScriptパーサーをESLintの設定から読み、型情報を作らずに実行する。これらの規則は構文とスコープを使うため、TypeScriptのプロジェクト全体を初期化する必要はない。通常の `pnpm lint` の型情報を使う検査は維持する。

これらは外部状態への直接参照を見つける補助検査であり、純粋性を保証するものではない。依存先の副作用、引数の変更、別名で渡された関数などはレビューと「同じ入力なら同じ出力」の動作試験で確認する。既存の `tests/kit-layers.test.ts` による層の向きの検査と、判定関数の動作試験も引き続き実行する。

Schemaの再生成一致は、既存の `packages/core/test/json-schema.test.ts` が `renderJsonSchemas()` の結果と保存済みファイルを照合する。Schemaの互換性検査も既存の試験を維持する。

## split-slow-ci-checksの移管保存

次の2契約は、ADR0005と利用者の2026-10-30の1-1に基づき、change `split-slow-ci-checks` で開発運用へ移す。ここは正式起案時点の原文保存で、実装・主仕様への同期・archiveはまだ行っていない。上の「まだ仕様にあるもの」は、その移行が完了するまで有効である。

採用予定の運用では、quality/gate/ci:all-os/シャードと診断profilerを含む全PR経路でslowを実行せず、mainへのpushと定期実行では全件を実行する。ローカルtest/doneと、既存releaseの手動品質ゲートも全件を維持する。診断profiler2本のPR/手動起動は撤去し、companionを含む対象をpush/scheduleで測る。releaseのmanual dispatchを縮小する意味ではない。

同headの3OS各3sampleをマージ前に得る測定専用workflowは、`ci/measure-*`へのpushだけを対象とする。PRへslowを戻すenvや必須検査の追加には使わない。node20ジョブと同名必須contextだけを外すが、node22・quality・gate・CodeQL、Node22.12下限と3OS Node24を保つ。規則の変更は、人が具体案と受入を確認して行う。

測定workflowはファイルや名前を指定せず、`pnpm test`で全件を実行する。新しく加わった試験も対象にし、元15fileは最低限の包含確認に残す。保存する測定用metadataは`schemaVersion: 2`・`selection: all`で、`requiredFiles`に元15file、`files`に保存したraw reportの実suite一覧を持つ。同じsuite名の重複は残し、`missingRequiredFiles`で元対象の欠落を示す。reportがなければ`collectionState: missing`、読めないかrepo外のsuiteを含めば`invalid`とし、どちらも一覧を`null`にする。`recorded`は一覧を読めた状態で、全件成功や包含済みを意味しない。旧schemaVersion 1の15file測定は履歴として保持し、最新headの全件測定に流用しない。

REQ-297の元4case、19.5秒/39.5秒の下限と上限、保持役の待ちだけを引く時計、retry、全assertは変えない。REQ-161の元全体試験も残し、本当の13条件を確かめるfastを追加する。caseのfast+slowの和集合、元名・parameter・assert・timeout、coverage94/89/96/97を維持する。未設計10file、PR179統合後の実測と新fastを未完了として扱う。

次の原文にあるnode20とPR全testの表現は、移管元の歴史をそのまま保存したもので、新運用への反対の約束ではない。差分は利用者が明示した1-1と管理役のQ01〜Q10/N1〜N5、release適用範囲の採用としてchangeのtraceへ記録する。Source270の他の文書PR契約とagents-rulesのSource273は消さない。CI側273の使用をやめても衝突履歴の解消とは呼ばず、B1へ引き継ぐ。

### 移管元の原文：3 つの OS での CI

取得：`openspec/specs/monorepo/spec.md:34-62` @ `085a82686dc1c14506fbdbad88b5b9b3961f522e`。raw SHA-256：`3b1fd4b81c8e88b9903db3ca9eed3fa68aea9bcfca1f07233f6c0f4b3f629410`。全Sourceと全Scenarioを保持する。

````markdown
### Requirement: 3 つの OS での CI
CI の quality ジョブは、main への push と、毎日 1 回の定期実行（schedule）では、ubuntu-latest・macos-latest・windows-latest の 3 つで実行し、`pnpm test` を実行する SHALL。pull_request では、quality ジョブを ubuntu-latest だけで実行する SHALL。ただし、PR に `ci:all-os` ラベルが付いているときは、pull_request でも 3 つの OS で実行する SHALL。PR にラベルを付けたとき（labeled）にも、CI を起動する MUST。node20・node22・gate のジョブは、この OS の切り替えの影響を受けない MUST。「文書だけの PR の品質ジョブ」に当てはまる PR では、quality ジョブで `pnpm test` を実行しなくてよい。

Source: REQ-049, REQ-270, REQ-273

#### Scenario: ワークフローが 3 OS を指定している
- **WHEN** `.github/workflows/ci.yml` を読む
- **THEN** quality ジョブのマトリクスの OS を決める式に、ubuntu-latest・macos-latest・windows-latest が含まれる

#### Scenario: ラベルのない PR は ubuntu だけで実行する
- **WHEN** `ci:all-os` ラベルのない PR で CI が動く
- **THEN** quality ジョブは ubuntu-latest の 1 つだけで動き、lint・typecheck・`pnpm test --coverage`・build・配布物の検査を実行する。macos-latest と windows-latest の quality ジョブは動かない

#### Scenario: main への push と定期実行は 3 つの OS で実行する
- **WHEN** main への push か、毎日 1 回の定期実行（schedule）で CI が動く
- **THEN** quality ジョブは ubuntu-latest・macos-latest・windows-latest の 3 つで動き、macOS と Windows ではシャード `1/2` と `2/2` で `pnpm test` を実行する

#### Scenario: ci:all-os ラベルの付いた PR は 3 つの OS で実行する
- **WHEN** `ci:all-os` ラベルの付いた PR で CI が動く
- **THEN** quality ジョブは main への push と同じく、ubuntu-latest・macos-latest・windows-latest の 3 つで動く

#### Scenario: ラベルを付けると CI が起動する
- **WHEN** `.github/workflows/ci.yml` を読む
- **THEN** pull_request の起動の種類に、既定の opened・synchronize・reopened に加えて labeled があり、schedule に 1 日 1 回の cron がある

#### Scenario: ほかのジョブは OS の切り替えの影響を受けない
- **WHEN** `.github/workflows/ci.yml` を読む
- **THEN** node20・node22・gate のジョブは ubuntu-latest で動き、OS を切り替える式を使わない。gate は今までどおり pull_request のときだけ動く

````

### 移管元の原文：CI のテストの分割

取得：`openspec/specs/monorepo/spec.md:304-316` @ `085a82686dc1c14506fbdbad88b5b9b3961f522e`。raw SHA-256：`c4718c090ddaac10ea73811fd1cca4d053e77c80070efab87a9c05e8f6394393`。全Sourceと全Scenarioを保持する。

````markdown
### Requirement: CI のテストの分割
CI の quality ジョブは、macOS と Windows では `pnpm test` を `--shard` で 2 つのシャードに分け、別々のジョブで実行する SHALL。2 つのシャードを合わせて、すべてのテストを実行する MUST。ubuntu では `pnpm test` を 1 回だけ、カバレッジ付き（`--coverage`）で実行し、カバレッジが閾値を下回ったらジョブを失敗させる SHALL。どのジョブでも、lint・typecheck・build・配布物の検査を実行する MUST。ただし、「文書だけの PR の品質ジョブ」に当てはまる PR では、これらのステップを実行しなくてよい。

Source: REQ-214, REQ-270

#### Scenario: macOS と Windows のシャード
- **WHEN** `.github/workflows/ci.yml` を読む
- **THEN** quality ジョブのマトリクスで、macos-latest と windows-latest のそれぞれにシャード `1/2` と `2/2` があり、`pnpm test --shard=` にシャードを渡すステップがある

#### Scenario: ubuntu ではカバレッジ付きで 1 回だけ実行する
- **WHEN** `.github/workflows/ci.yml` を読む
- **THEN** ubuntu-latest にはシャードがなく、`pnpm test --coverage` のステップがあり、ほかにすべてのテストを実行するステップ（`pnpm test:coverage` など）はない

````

### 移管前のSourceと試験名の対応

以下は基点085aの対応であり、テストの削除を指示する一覧ではない。実装後の新名・タグとの対応は同じPRで追記する。Source270の別契約と、agents-rulesに対応するSource273の別契約・試験は残す。

| Sourceを含む旧試験 | 出典 |
|---|---|
| `it('[REQ-270] 直下・docs/・openspec/ の .md、change の spec-gate.txt、changeset の本文は文書として扱う', () => {` | `tests/ci-docs-only.test.ts:27` |
| `it('[REQ-270] コードと配布する Markdown は文書として扱わない', () => {` | `tests/ci-docs-only.test.ts:42` |
| `it('[REQ-270] 設定と実行用のファイルは、文書の置き場所にあっても文書として扱わない', () => {` | `tests/ci-docs-only.test.ts:46` |
| `it('[REQ-270] tests/ の下の試験用データは、.md でも文書として扱わない', () => {` | `tests/ci-docs-only.test.ts:63` |
| `it('[REQ-270] 読めないパスは文書として扱わない', () => {` | `tests/ci-docs-only.test.ts:68` |
| `it('[REQ-270] 変えたファイルがすべて文書なら、文書だけと判定する', () => {` | `tests/ci-docs-only.test.ts:93` |
| `it('[REQ-270] コード・配布する Markdown・設定・試験用データを 1 つでも含めば、文書だけと判定しない', () => {` | `tests/ci-docs-only.test.ts:102` |
| `it('[REQ-270] 名前を変えたファイルは、変更前のパスも判定する', () => {` | `tests/ci-docs-only.test.ts:110` |
| `it('[REQ-270] 差分を取れないときは、文書だけと判定しない', () => {` | `tests/ci-docs-only.test.ts:117` |
| `it('[REQ-270] 差分を解釈できないときは、文書だけと判定しない', () => {` | `tests/ci-docs-only.test.ts:124` |
| `it('[REQ-270] 判定のスクリプトとワークフローを変えた PR は、文書だけと判定しない', () => {` | `tests/ci-docs-only.test.ts:137` |
| `it('[REQ-270] コードのファイルを消した PR は、文書だけと判定しない', () => {` | `tests/ci-docs-only.test.ts:147` |
| `it('[REQ-270] PR のマージ先が main でないときは、差分によらず文書だけと判定しない', () => {` | `tests/ci-docs-only.test.ts:206` |
| `it('[REQ-270] main への push では、差分によらず文書だけと判定しない', () => {` | `tests/ci-docs-only.test.ts:214` |
| `it('[REQ-270] 文書だけの PR では docs_only=true を書く', () => {` | `tests/ci-docs-only.test.ts:291` |
| `it('[REQ-270] 前のコミットでコードを変えた PR では、最後のコミットが文書だけでも docs_only=false を書く', () => {` | `tests/ci-docs-only.test.ts:298` |
| `it.each(['refs/tags/origin/main', 'refs/heads/origin/main'])('[REQ-270] ベースと同じ名前の参照 %s が PR のコミットの途中を指していても、ベースとの差分で判定して docs_only=false を書く', (name) => {` | `tests/ci-docs-only.test.ts:308` |
| `it('[REQ-270] 名前を変えたファイルは、変更前のパスが文書でなければ docs_only=false を書く', () => {` | `tests/ci-docs-only.test.ts:319` |
| `it('[REQ-270] 差分を取れないときは、失敗にせず docs_only=false を書く', () => {` | `tests/ci-docs-only.test.ts:328` |
| `it('[REQ-270] main が進んだあとのマージコミットでは、PR の変更分だけで判定する', () => {` | `tests/ci-docs-only.test.ts:339` |
| `it('[REQ-270] コードのファイルを消した PR では docs_only=false を書く', () => {` | `tests/ci-docs-only.test.ts:355` |
| `it('[REQ-270] マージ先が main でない PR では docs_only=false を書く', () => {` | `tests/ci-docs-only.test.ts:365` |
| `it('[REQ-270] main への push では docs_only=false を書く', () => {` | `tests/ci-docs-only.test.ts:424` |
| `it('[REQ-273] 報告の形の節に、作業したブランチごとのファイルに記録し、/ を - に置き換え、あれば追記すると書いてある', () => {` | `tests/kit-assets.test.ts:85` |
| `it('[REQ-273] 報告の形の節に、作業記録は作業の PR に含め、マージ後の記録は次の作業のブランチのファイルに書くと書いてある', () => {` | `tests/kit-assets.test.ts:95` |
| `it('[REQ-049] ラベルのない PR では、quality ジョブを ubuntu-latest の 1 つだけで実行する', () => {` | `tests/monorepo.test.ts:171` |
| `it('[REQ-049] main への push と定期実行では、quality ジョブを ubuntu・macos・windows の 3 つで実行し、macOS と Windows では 2 つのシャードに分ける', () => {` | `tests/monorepo.test.ts:182` |
| `it('[REQ-273] ci:all-os ラベルの付いた PR では、quality ジョブを 3 つの OS で実行する', () => {` | `tests/monorepo.test.ts:191` |
| `it('[REQ-049][REQ-273] PR にラベルを付けたときにも起動し、毎日 1 回、定期実行する', () => {` | `tests/monorepo.test.ts:196` |
| `it('[REQ-273] node20・node22・gate のジョブは、OS の切り替えの影響を受けない', () => {` | `tests/monorepo.test.ts:209` |
| `it('[REQ-214] macOS と Windows ではテストを 2 つのシャードに分け、ubuntu ではカバレッジ付きで 1 回だけ実行する', () => {` | `tests/monorepo.test.ts:230` |
| `it('[REQ-270] 文書だけかの判定は、paths フィルタではなく quality ジョブの中のステップで行う', () => {` | `tests/monorepo.test.ts:275` |
| `it('[REQ-270] main への push では、判定が docs_only=false になり、すべてのステップを実行する', () => {` | `tests/monorepo.test.ts:301` |
| `it('[REQ-144] 3OSの品質ジョブとNode下限ジョブで配布物を検査する', () => {` | `tests/package-workflows.test.ts:8` |

### Node20追加ジョブの削除

配布物のengines.nodeは`>=22.12.0`であるため、宣言範囲より古いNode20の追加ジョブを削除した。下限はNode22.12.0のnode22ジョブで確認し、準備はNode24で行う。3OSのNode24品質ジョブ、node22・gate・CodeQLは維持した。main rulesetのnode20 required contextはまだ変更しておらず、ready時に人へ具体差分を渡す。slow分離と最新headの3OS計測は後続taskであり、この削除だけを1-1の完成としない。

### main取り込み時の移管元原文：CI のテストの分割

PR #195のarchive後、REQ-214は隔離のジョブを含む本文と3つのScenarioになった。上の085aの2つのScenarioは当時の原文として残し、移管対象の現行全文・Source・全3Scenarioを次に保存する。REQ-049の全文・Source・全6Scenarioは085aから変更がない。

取得：`openspec/specs/monorepo/spec.md` @ `7359d89dad5d0ec05d649cdad1f261bc059f4439`（2026-10-31）。

````markdown
### Requirement: CI のテストの分割
CI の quality ジョブは、macOS と Windows では `pnpm test` を `--shard` で 2 つのシャードに分け、別々のジョブで実行する SHALL。2 つのシャードと、隔離のジョブ（「試験の隔離一覧」）を合わせて、すべてのテストを実行する MUST。macOS と Windows のシャードは、隔離一覧でその OS に指定したファイルだけを除く SHALL。ubuntu では隔離一覧を読まず、`pnpm test` を 1 回だけ、カバレッジ付き（`--coverage`）で実行し、カバレッジが閾値を下回ったらジョブを失敗させる SHALL。どのジョブでも、lint・typecheck・build・配布物の検査を実行する MUST。ただし、「文書だけの PR の品質ジョブ」に当てはまる PR では、これらのステップを実行しなくてよい。

Source: REQ-214, REQ-270

#### Scenario: macOS と Windows のシャード
- **WHEN** `.github/workflows/ci.yml` を読む
- **THEN** quality ジョブのマトリクスで、macos-latest と windows-latest のそれぞれにシャード `1/2` と `2/2` があり、`pnpm test --shard=` にシャードを渡すステップがある

#### Scenario: ubuntu ではカバレッジ付きで 1 回だけ実行する
- **WHEN** `.github/workflows/ci.yml` を読む
- **THEN** ubuntu-latest にはシャードがなく、`pnpm test --coverage` のステップがあり、ほかにすべてのテストを実行するステップ（`pnpm test:coverage` など）はない

#### Scenario: macOS と Windows のシャードから隔離一覧のファイルを除く
- **WHEN** `.github/workflows/ci.yml` を読む
- **THEN** シャードのあるジョブだけに、`scripts/ci-quarantine.mjs` に OS を渡して一覧を検査するステップがあり、その出力をシャードのテストのステップに渡している。ubuntu のテストのステップには渡していない
````
