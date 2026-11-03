# Proposal

## Why
#285 の追加依存検査は、宣言の読み取りと verify の判定を分けて進める。C1a では全3種類の宣言を検証する内部 reader を作り、後続 C1b が同じ宣言を判定に使える状態にする。

## What Changes
- trace.md の任意の「依存する成果物」の表を、kit 内部の純粋関数で読み、構文と参照形を検証する。
- REQ-400 は内部 reader の行・値・エラーの契約だけを定める。直接の呼び出し元は単体試験だけであり、CLI にはまだ接続しない。
- REQ-401 は後続 C1b の予約とし、spec-only の案内と done の不足判定はこの子に含めない。

## Capabilities
### New Capabilities
なし。
### Modified Capabilities
- `verify`: 判定に用いる依存宣言の内部読み取り契約を追加する。core の公開 Trace と parseTrace は変えない。
## Impact
新規 `packages/kit/src/verify/dependencies.ts` とその試験。外部操作・追加のファイル読み取り・実行時依存は増やさず、CLI の出力は変わらない。親 #285 は全3種類の依存判定と提供元 DoD の確認がそろうまで完了にしない。
