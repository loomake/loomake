# ci-deadline-clock-alignment Specification

## Purpose

共有期限の試験を、保持役の準備待ちを除外する本体の仕様と同じ基準で測る。予算と猶予を維持し、実時間の診断と停止・再実行の検証を残す。

## Requirements

### Requirement: 共有期限を測る時計の整合

共有期限試験は、初回runの経過時間から同runの保持役の準備待ちの差分だけを除き、既存の上限・下限で比較する SHALL。待ちがない場合は従来と同じ経過時間にする SHALL。予算、猶予、assertion、停止地点の確認、再試行とその検証、製品runtime、品質設定は変更しない MUST。実時間と予算上の時間の診断を維持し、試験の元の成否を保存する SHALL。

Source: REQ-297

#### Scenario: Windowsで最初の保持役を待つ
- **WHEN** 共有期限試験の初回runで保持役の準備待ちがある
- **THEN** 待ちを除いた経過時間を既存の上限・下限で比較し、その他の既存検証を実行する

#### Scenario: 準備待ちがない
- **WHEN** 同runで保持役の準備待ちが発生しない
- **THEN** 従来と同じ経過時間で既存の期限を検証する
