# 配布物と公開前の検証

## Why

ソースを使うテストだけでは、公開するtarballの同梱漏れと依存解決を確認できない。配布物から主要コマンドを検査し、公開するコミットでも同じ検査を実行する。

## What Changes

- 5パッケージをpackし、別プロジェクトへオフライン導入して主要コマンドを検証する。
- 3OSとNode下限のCIに、配布物の検証を追加する。
- 公開前に同じコミットのlint・型・テスト・配布物を検査する。
- 公開するexportsに、同梱しないソースへの条件を残さない。

## Capabilities

### New Capabilities

なし。

### Modified Capabilities

- `monorepo`: 配布物と公開前の検証。

## Impact

CI・公開ワークフロー、各package.jsonのpublishConfig、検査用スクリプトとテストを変更する。実行時依存と公開認証の方式は変えない。
