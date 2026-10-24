# Proposal: count-supervisor-startup-budget

## Why

外部操作の監視役の起動を600ms遅らせると、150msの共有予算を過ぎても対象コマンドが起動し、成功を返すことを再現した。既存のREQ-180・REQ-182が定める残り時間の契約に合わせ、監視役の起動時間を予算に含める。

## What Changes

- 呼び出し元の単調時計による期限を監視役へ渡し、対象を起動する前に残り時間を再計算する。
- 起動前に期限を使い切ったら、対象を起動せず既存のtimeoutとして返す。残り時間がある場合も、監視役の起動後に予算を最初から数え直さない。
- 通常の結果、引数・環境・出力、共有予算とuntilDeadline、既存の停止・回収を維持する。

## Capabilities

### New Capabilities

なし。

### Modified Capabilities

- `external-process-budget`: 既存の期限に監視役の起動時間も含まれることを明記し、起動時の期限切れのScenarioを追加する。

## Impact

kitのprocess.tsと内部supervisor、回帰テスト、kitのchangesetを変更する。公開API・設定・実行時依存・出力JSONの版は変えない。監視役自身がOSから実行時間を得られない間の応答時間や、OS全体の強制上限は保証しない。並列実行の過去の失敗と今回の問題の因果は未確定である。
