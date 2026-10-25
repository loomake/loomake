# SIGTERM・SIGHUP でもエンジンを止めてから終わる

## Why

Issue #48。`loomake run` はエンジンを別のプロセスグループで起動する。CLI は SIGINT しか中断として扱わないので、端末や SSH の接続を閉じたとき（SIGHUP）や、CI・コンテナの停止で SIGTERM が届いたときは、loomake だけが既定の動作で終わる。エンジンは監視されないまま動き続け、期限もガードもなしに作業ツリーを変え続ける。

## What Changes

- `loomake run` は SIGTERM・SIGHUP も SIGINT と同じく中断として扱い、エンジンのプロセスグループを止め、記録を残してから終わる

## Capabilities

### New Capabilities

なし。

### Modified Capabilities

- `run`: 中断として扱う信号。

## Impact

CLI の信号の扱いと、配布物に実際に信号を送る smoke 検査を変える。
