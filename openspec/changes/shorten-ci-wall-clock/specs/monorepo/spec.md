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
CI の quality ジョブは、PR で変えたファイルがすべて「文書として扱うファイル」に当たるとき、lint・typecheck・test・build・配布物の検査を実行せずに成功する SHALL。判定はジョブの中のステップで行い、ワークフローの `paths`・`paths-ignore` やジョブの `if` では行わない MUST（必須チェックのジョブが、同じ名前で結果を報告するようにするため）。main への push では、判定によらず、すべてのステップを実行する MUST。

Source: REQ-270

#### Scenario: 文書だけの PR
- **WHEN** PR で変えたファイルが `docs/worklog/2026-10-27.md`・`openspec/changes/c1/tasks.md`・`.changeset/c1.md` だけである
- **THEN** 判定は「文書だけ」になり、quality ジョブは lint・typecheck・test・build・配布物の検査を実行せずに成功する

#### Scenario: 判定をジョブの中で行う
- **WHEN** `.github/workflows/ci.yml` を読む
- **THEN** ワークフローの `on` に `paths`・`paths-ignore` がなく、quality ジョブに変えたファイルを判定するステップがあり、lint・typecheck・test・build・配布物の検査のステップは、判定が「文書だけ」でないときだけ実行される

#### Scenario: main への push
- **WHEN** main への push で quality ジョブが動く
- **THEN** 変えたファイルによらず、すべてのステップを実行する

### Requirement: 文書として扱うファイル
「文書だけの PR の品質ジョブ」の判定で文書として扱うのは、次のファイルだけとする MUST。

- リポジトリの直下にある `.md` のファイル（`README.md`・`CONTRIBUTING.md` など）
- `docs/` の下にある `.md` のファイル
- `openspec/specs/` と `openspec/changes/`（`archive/` を含む）の下にある `.md` のファイルと、`openspec/changes/` の下にある `spec-gate.txt`
- `.changeset/` の直下にある `.md` のファイル（changeset の本文）

これ以外のファイル（設定・実行用のファイル・`tests/` の下・`packages/` の下のファイルを含む）は、文書として扱わない MUST。

Source: REQ-270

#### Scenario: コードを含む PR
- **WHEN** PR で変えたファイルに `packages/kit/src/verify/run.ts` が含まれる
- **THEN** 判定は「文書だけ」にならず、quality ジョブはすべてのステップを実行する

#### Scenario: 配布する Markdown を含む PR
- **WHEN** PR で変えたファイルが `packages/kit/templates/AGENTS.md` だけである
- **THEN** 判定は「文書だけ」にならず、quality ジョブはすべてのステップを実行する

#### Scenario: 設定と実行用のファイルを含む PR
- **WHEN** PR で変えたファイルが、`.changeset/config.json`・`openspec/config.yaml`・`docs/wbs/initial-status.yaml`・`scripts/ci-gate.mjs` のどれか 1 つと、`docs/` の下の `.md` だけである
- **THEN** どの場合も、判定は「文書だけ」にならず、quality ジョブはすべてのステップを実行する

#### Scenario: 試験用データを含む PR
- **WHEN** PR で変えたファイルが `tests/fixtures/verify-project/openspec/changes/sample/tasks.md` だけである
- **THEN** 判定は「文書だけ」にならず、quality ジョブはすべてのステップを実行する

#### Scenario: 文書の置き場所にある設定と実行用のファイル
- **WHEN** PR で変えたファイルが、`docs/` の下の `.json`・`.yaml`・`.yml`、`.github/` の下の `.md`、`openspec/changes/archive/` の下の `.mjs` のどれか 1 つだけである
- **THEN** どの場合も、判定は「文書だけ」にならない

### Requirement: 文書だけかの判定に使う差分
「文書だけの PR の品質ジョブ」の判定には、PR のベースとの差分（ベースから PR の先頭までのすべてのコミット）で変わったファイルをすべて使う MUST。名前を変えたファイルは、変更前と変更後の両方のパスを判定する MUST。消したファイルも判定する。差分を取れなかったとき、または差分を解釈できなかったときは、文書だけではないとみなす MUST。

Source: REQ-270

#### Scenario: 前のコミットでコードを変えた PR
- **WHEN** PR の 1 つ目のコミットで `packages/kit/src/verify/run.ts` を変え、2 つ目のコミットで `docs/notes.md` だけを変えた
- **THEN** 判定はベースとの差分のすべてのファイルを使うので「文書だけ」にならず、quality ジョブはすべてのステップを実行する

#### Scenario: 名前を変えたファイル
- **WHEN** PR で `scripts/notes.md` の名前を `docs/notes.md` に変えた
- **THEN** 変更前のパス `scripts/notes.md` が文書ではないので、判定は「文書だけ」にならない

#### Scenario: 差分を取れない、または解釈できない
- **WHEN** PR のベースとの差分を取るコマンドが失敗する、または差分の出力に解釈できない行がある
- **THEN** 判定は「文書だけ」にならず、quality ジョブはすべてのステップを実行する
