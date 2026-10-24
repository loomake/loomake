# 証拠が増えても trace report が失敗しないようにする

## Why

Issue #50。`loomake trace report` は、いちばん新しい証拠を選ぶために、change の証拠の JSON をすべて 1 つの読み取りの予算（合計 128MiB）で読む。証拠は文書のスナップショットを含むので、`trace record` を重ねると、最新の証拠が小さくても、読み取りの合計の上限でいつも失敗するようになる。

この動作は、bounded-input の要件（同じ証拠の読み取り処理の合計 128MiB）と、すべての証拠の不正を見つける REQ-073 のとおりである。直すには、資源の上限と証拠の検証のどちらを優先するかを決める必要がある（確認事項 Q-01）。

## What Changes

- 確認事項 Q-01 の回答に従って、trace report の証拠の読み方を変える

## Capabilities

### New Capabilities

なし。

### Modified Capabilities

- `bounded-input`: trace report の証拠の読み取りの上限。
- `trace-report`: 検証する証拠の範囲（Q-01 の回答による）。

## Impact

trace の report と、関係するテストを変える。
