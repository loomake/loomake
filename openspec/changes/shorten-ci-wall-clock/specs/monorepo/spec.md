## MODIFIED Requirements

### Requirement: 3 つの OS での CI
CI は ubuntu-latest・macos-latest・windows-latest の 3 つで `pnpm test` を実行する SHALL。ただし、「文書だけの PR の品質ジョブ」に当てはまる PR では、3 つの OS の quality ジョブで `pnpm test` を実行しなくてよい。

Source: REQ-049, REQ-270

#### Scenario: ワークフローが 3 OS を指定している
- **WHEN** `.github/workflows/ci.yml` を読む
- **THEN** ジョブのマトリクスに ubuntu-latest・macos-latest・windows-latest が含まれる

### Requirement: CI のテストの分割
CI の quality ジョブは、macOS と Windows では `pnpm test` を `--shard` で 2 つのシャードに分け、別々のジョブで実行する SHALL。2 つのシャードを合わせて、すべてのテストを実行する MUST。ubuntu では `pnpm test` を 1 回だけ、カバレッジ付き（`--coverage`）で実行し、カバレッジが閾値を下回ったらジョブを失敗させる SHALL。どのジョブでも、lint・typecheck・build・配布物の検査を実行する MUST。ただし、「文書だけの PR の品質ジョブ」に当てはまる PR では、これらのステップを実行しなくてよい。

Source: REQ-214, REQ-270

#### Scenario: macOS と Windows のシャード
- **WHEN** `.github/workflows/ci.yml` を読む
- **THEN** quality ジョブのマトリクスで、macos-latest と windows-latest のそれぞれにシャード `1/2` と `2/2` があり、`pnpm test --shard=` にシャードを渡すステップがある

#### Scenario: ubuntu ではカバレッジ付きで 1 回だけ実行する
- **WHEN** `.github/workflows/ci.yml` を読む
- **THEN** ubuntu-latest にはシャードがなく、`pnpm test --coverage` のステップがあり、ほかにすべてのテストを実行するステップ（`pnpm test:coverage` など）はない

## ADDED Requirements

### Requirement: 文書だけの PR の品質ジョブ
CI の quality ジョブは、PR で変えたファイルがすべて文書のとき、lint・typecheck・test・build・配布物の検査を実行せずに成功する SHALL。文書とは、`packages/` の外にあり、拡張子が `.md` のファイルか、`docs/`・`openspec/`・`.changeset/` の下のファイルをいう。判定はジョブの中のステップで行い、ワークフローの `paths`・`paths-ignore` やジョブの `if` では行わない MUST（必須チェックのジョブが、同じ名前で結果を報告するようにするため）。main への push では、判定によらず、すべてのステップを実行する MUST。変えたファイルを調べられなかったときは、文書だけではないとみなす MUST。

Source: REQ-270

#### Scenario: 文書だけの PR
- **WHEN** PR で変えたファイルが `docs/worklog/2026-10-27.md` と `openspec/changes/c1/tasks.md` だけである
- **THEN** 判定は「文書だけ」になり、quality ジョブは lint・typecheck・test・build・配布物の検査を実行せずに成功する

#### Scenario: コードを含む PR
- **WHEN** PR で変えたファイルに `packages/kit/src/verify/run.ts` が含まれる
- **THEN** 判定は「文書だけ」にならず、quality ジョブはすべてのステップを実行する

#### Scenario: 配布する Markdown を含む PR
- **WHEN** PR で変えたファイルが `packages/kit/templates/AGENTS.md` だけである
- **THEN** 判定は「文書だけ」にならず、quality ジョブはすべてのステップを実行する

#### Scenario: 判定をジョブの中で行う
- **WHEN** `.github/workflows/ci.yml` を読む
- **THEN** ワークフローの `on` に `paths`・`paths-ignore` がなく、quality ジョブに変えたファイルを判定するステップがあり、lint・typecheck・test・build・配布物の検査のステップは、判定が「文書だけ」でないときだけ実行される

#### Scenario: main への push
- **WHEN** main への push で quality ジョブが動く
- **THEN** 変えたファイルによらず、すべてのステップを実行する

#### Scenario: 変えたファイルを調べられない
- **WHEN** PR の向き先のブランチとの差分を取れない
- **THEN** 判定は「文書だけ」にならず、quality ジョブはすべてのステップを実行する

### Requirement: 時間を確かめるテストの待ち方
リポジトリのテストは、子プロセスや偽の CLI が狙った段階に届いたことを、固定の長さの実時間の待ちで確かめない SHALL。段階に届いたことは、子プロセスが残す合図（ファイル・出力）で確かめ、合図を確かめたら次へ進む MUST。期限で止まることを確かめるテストは、期限より前に終わる処理を実時間で待たない SHALL。1000 ms を超える固定の待ちは、期限で止められることを確かめるための、終わらない子プロセスにだけ使う MUST。待ち方を変えるときも、テストが確かめる内容（終了コード・停止の理由・記録・残るファイル）は減らさない MUST。

Source: REQ-271

#### Scenario: 合図で次の段階へ進む
- **WHEN** 偽のエンジンが遅れて変更を書く段階を、テストが確かめる
- **THEN** テストは、偽のエンジンが段階に届いた合図を確かめてから先へ進み、固定の秒数が過ぎるのを待たない

#### Scenario: 長い固定の待ちを使う場所
- **WHEN** `packages/*/test/` と `tests/` のテストのソースを読む
- **THEN** 1000 ms を超える固定の待ち（偽のエンジンの `sleepMs`・`setTimeout`・`Atomics.wait` など）は、期限で止められることを確かめるための、終わらない子プロセスにだけ使われている

#### Scenario: 確かめる内容を保つ
- **WHEN** 待ち方を変えたテストを、変える前のテストと比べる
- **THEN** 終了コード・停止の理由・記録・残るファイルの検査が 1 つも減っていない
