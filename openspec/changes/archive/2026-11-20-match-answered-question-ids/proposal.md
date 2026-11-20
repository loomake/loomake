# 回答済みの確認事項IDを全体で照合する

## Why

Issue #327では、差分仕様のQ-285-01がQ-285へ切り詰められ、長いIDの案内漏れと短いIDの誤案内が起きる。REQ-360の案内をID全体の照合へ直す。

## What Changes

- 自changeのtraceにあるIDを文字列のまま照合し、前後のASCII英数字・ハイフンと、長い既知IDの一部を除外する。
- 既存の5 Scenario、案内の形式・順序・繰り返し、コードブロック除外、判定・終了コード・JSON 2.0.0を維持する。
- Q-327-01の回答Aを仕様へ反映する。

## Capabilities

### New Capabilities

なし。

### Modified Capabilities

- `verify`: REQ-360の回答済み確認事項の参照をID全体で照合する。

## Impact

kitのcheckSpec、REQ-360の差分仕様、追加の回帰試験、kitのpatch changesetを変更する。親#285の元6項目や追加依存検出、REQ-361、coreのID制限、設定・品質基盤は変更しない。
