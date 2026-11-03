# verify設定読取の失敗分類

## Why
C001と#61は、設定の構文・内容不正を2、存在する設定の読取不能を3に分ける。現実装は両方をUsageErrorへまとめ、実ファイルのEACCESも2になる。

## What Changes
- **BREAKING** verifyだけで設定読取不能をruntimeのaborted/3へ分ける。JSON構文・内容不正2と省略時の既定値を保つ。
- 共有loadConfigを使うdoctor・trace・runnerの契約、入力予算・リンク拒否を保ち、changesetと互換性文書に移行を書く。

## Capabilities
### New Capabilities
なし。
### Modified Capabilities
- `verify`: 既存設定の読取不能と設定内容の誤りの分類。

## Impact
kitの設定読取とverify、CLI/API回帰、移行文書。公開JSONの形・依存・設定ファイル自体は変えない。親C001・#61全体の完了判定は管理役に残す。
