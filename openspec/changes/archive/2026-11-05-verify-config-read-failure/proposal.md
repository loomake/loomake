# verify設定読取の失敗分類

## Why
C001と#61は、設定の構文・内容不正を2、存在する設定の読取不能を3に分ける。mainの実装は両方をUsageErrorへまとめ、実ファイルのEACCESも2になる。

## What Changes
- **BREAKING** verifyの設定の存在確認・読取りで起きるOS失敗をruntimeのaborted/3へ分ける。JSON構文・内容不正2と省略時の既定値を保つ。
- 入力予算・通常ファイル以外・リンク（壊れたリンクと競合を含む）の拒否はconfig/2とする。
- 共有loadConfigを使うdoctor・trace・runnerの事前読取の契約を保ち、changesetと互換性文書に移行を書く。内部でverifyを呼ぶ経路への影響も記す。

## Capabilities
### New Capabilities
なし。
### Modified Capabilities
- `verify`: 既存設定の読取不能と設定内容の誤りの分類（REQ-395）。

## Impact
kitの設定読取とverify、CLI/API回帰、移行文書。公開JSONの形・exports・依存・品質設定は変えない。旧PR #378のREQ-395製品修理だけを独立させる。REQ-360の同期・archiveは#366に残し、この変更へ混ぜない。親C001・#61全体の完了は管理役が別途確認する。
