# Proposal

## Why

quality.yamlリファレンス生成器を親ディレクトリのシンボリックリンク経由で起動すると、引数処理を実行せず0で終了する。生成物の欠落をcheckが見逃し、macOSの既存REQ-321試験も失敗したため、同じ実体のスクリプトでは既存の生成・照合処理が動くように直す。

## What Changes

- REQ-321の既存本文とScenarioを保持し、リンク経由の直接起動でも欠落・改変を検出するScenarioを追加する。
- 起動判定を同じ実体のパスで照合し、cwdに依存しない生成、欠落checkの終了1、不明引数の終了2、通常生成と一致checkの終了0を保つ。
- Linux/macOSのディレクトリsymlinkとWindowsのjunctionを使う回帰試験、およびimport時に生成・診断・終了コード変更を起こさない確認を追加する。

## Capabilities

### New Capabilities

なし。

### Modified Capabilities

- `reference-docs`: REQ-321にリンク経由の直接起動の受入例を明記する。

## Impact

対象はmainの `scripts/generate-quality-reference.mjs` と `tests/quality-reference.test.ts`。生成内容、生成先、公開API/JSON、実行時依存は変えない。既存試験の期待値・skipと品質設定を維持する。未マージのCLI生成PR #144、C-001、公開・リリースは対象外である。
