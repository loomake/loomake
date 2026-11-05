# validate-kit-input-targets

## Why

Issue #417 の再現で、設定した report が root の外を消すこと、init が一部を配置してから EISDIR で止まること、監視役が期限を過ぎても親が待つことを確認した。入力の誤りを変更前に拒否し、監視役の停止にも既存の予算と後続停止を適用する。

## What Changes

- **BREAKING** tests.report を root 内のファイルを指す相対パスへ制限し、区切りと冗長な要素を正規化する。
- init の全置き先を事前に検査し、実効 report を変更前に検査して gitignore の文字どおりの行を作る。
- 監視役に対象の期限と既存の停止猶予を足した親側の期限を設け、結果なしの時間切れは後片付けと後続停止を保つ。
- change 探索の lstat で ENOENT・ENOTDIR と他の入力エラーを区別する。

## Capabilities

### New Capabilities

なし。

### Modified Capabilities

- `verify`: report のパスの制限と削除前の再検査。
- `init`: 通常のファイルでない置き先の無配置中止、gitignore の正規化とエスケープ。
- `external-process-budget`: 監視役の親側の期限と timeout 分類を既存の後片付け・後続停止に整合させる。

## Non-goals

- 他の修理 Issue、既存のテスト・期待値・skip・期限・品質設定の変更。
- 原本の BOM の扱い、監視役の新しい猶予値、Windows の taskkill 時間の変更。

## Impact

packages/kit の config・init・doctor・runtime・verify と対応テスト。公開 JSON の形式と依存を変えず、kit の patch changeset を追加する。1 Issue = 1 change = 1 PR とし、同期・archive も同じ PR に含める。
