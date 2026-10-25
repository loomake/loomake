## ADDED Requirements

### Requirement: CI のテストの分割
CI の quality ジョブは、macOS と Windows では `pnpm test` を `--shard` で 2 つのシャードに分け、別々のジョブで実行する SHALL。2 つのシャードを合わせて、すべてのテストを実行する MUST。ubuntu では `pnpm test` を 1 回だけ、カバレッジ付き（`--coverage`）で実行し、カバレッジが閾値を下回ったらジョブを失敗させる SHALL。どのジョブでも、lint・typecheck・build・配布物の検査を実行する MUST。

Source: REQ-214

#### Scenario: macOS と Windows のシャード
- **WHEN** `.github/workflows/ci.yml` を読む
- **THEN** quality ジョブのマトリクスで、macos-latest と windows-latest のそれぞれにシャード `1/2` と `2/2` があり、`pnpm test --shard=` にシャードを渡すステップがある

#### Scenario: ubuntu ではカバレッジ付きで 1 回だけ実行する
- **WHEN** `.github/workflows/ci.yml` を読む
- **THEN** ubuntu-latest にはシャードがなく、`pnpm test --coverage` のステップがあり、ほかにすべてのテストを実行するステップ（`pnpm test:coverage` など）はない

### Requirement: PR の古い CI 実行の取り消し
CI のワークフローは、同じ PR に新しい push があれば、その PR の古い実行を取り消す SHALL。main への push で動いた実行は取り消さない MUST。

Source: REQ-215

#### Scenario: PR の古い実行を取り消す
- **WHEN** `.github/workflows/ci.yml` を読む
- **THEN** ワークフローの `concurrency` の group に PR の番号が入り、`cancel-in-progress` は `github.event_name == 'pull_request'` のときだけ true になる
