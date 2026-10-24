# 認証や署名の入力で git が失敗したときに理由を示す

## Why

Issue #49。run は git・gh を、制御端末を持たない別のプロセスグループで動かす。SSH の鍵のパスフレーズ、HTTPS の利用者名とパスワード、GPG の署名のように、端末で入力が要る設定では、git は入力を求められずに失敗する。いまは git のエラーをそのまま表示するだけなので、利用者は、なぜ失敗したのか、どうすればよいのかが分からない。

## What Changes

- run が動かす git に `GIT_TERMINAL_PROMPT=0` を渡し、入力を求めずにすぐ失敗させる
- git の commit・push が、認証や署名の入力が要るために失敗したときは、ssh-agent・credential helper・gpg-agent を使って入力なしで動くようにする案内を、理由に添える

## Capabilities

### New Capabilities

なし。

### Modified Capabilities

- `run-pr`: 認証や署名の入力による失敗の案内。

## Impact

runner の git の呼び出しとテストを変える。入力なしで動く設定の利用者の動作は変わらない。
