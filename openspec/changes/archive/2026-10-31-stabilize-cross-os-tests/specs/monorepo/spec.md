## ADDED Requirements

### Requirement: 試験の隔離一覧
macOS と Windows で時間切れが続く試験ファイルは、`tests/quarantine.json` に書いて、その OS のシャードから一時的に外してよい。各エントリは試験ファイル（`tests/` か `packages/<name>/test/` の下の `.test.ts`）、OS（`macos-latest`・`windows-latest`）、Issue 番号、追加日、期限を持ち、期限は追加日から 14 日以内とする MUST。形式の誤り・ファイルがない・重複・対象外の OS・14 日を超える期限・期限切れ（日本時間）のどれかなら、CI は理由を日本語で示して失敗する MUST。ワークフロー `quality-quarantine` は、main への push・定期実行・手動実行・`ci:all-os` の PR で、一覧のファイルを一覧の OS ごとにシャードに分けず実行する SHALL。その失敗は run の成否に数えない。一覧が空なら試験のジョブを飛ばす SHALL。

Source: REQ-344

#### Scenario: 期限内のエントリ
- **WHEN** `packages/runner/test/guards.test.ts` を `windows-latest` で期限 2026-11-14 に隔離した一覧を、2026-11-14 に windows-latest のシャード向けに検査する
- **THEN** 検査は成功し、そのファイルを除外の対象として出力する。macos-latest 向けに検査したときは、除外の対象を出力しない

#### Scenario: 期限を過ぎた一覧
- **WHEN** 期限が 2026-11-14 のエントリがある一覧を、日本時間で 2026-11-15 に検査する
- **THEN** 期限を過ぎたことと、そのファイルと Issue 番号が表示され、ジョブが失敗する

#### Scenario: Ubuntu を指定した一覧
- **WHEN** OS に `ubuntu-latest` を含むエントリがある一覧を検査する
- **THEN** Ubuntu は隔離できないことが表示され、ジョブが失敗する

#### Scenario: 期限が長すぎる一覧
- **WHEN** 追加日 2026-10-31、期限 2026-11-15 のエントリがある一覧を検査する
- **THEN** 期限は追加日から 14 日以内と表示され、ジョブが失敗する

#### Scenario: 存在しないファイル
- **WHEN** リポジトリにない試験ファイルを書いた一覧を検査する
- **THEN** ファイルがないことが表示され、ジョブが失敗する

#### Scenario: 空の一覧
- **WHEN** `entries` が空の一覧を検査する
- **THEN** 除外の対象を出力せず、`has_entries` を false にする。`quality-quarantine` の試験のジョブは実行されない

#### Scenario: 隔離のワークフロー
- **WHEN** `.github/workflows/quality-quarantine.yml` を読む
- **THEN** main への push・定期実行・手動実行と、`ci:all-os` ラベルの PR で動き、試験のジョブに `continue-on-error: true` と `has_entries` の条件がある

## MODIFIED Requirements

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
