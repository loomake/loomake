## MODIFIED Requirements

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
