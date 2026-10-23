# TDD実行記録

## 1.1 配布物

統合テストは検査スクリプトがない現行実装で失敗した。prepareとcheck、公開用exportsを実装した後は、5パッケージのtarballだけから主要コマンドが成功した。公開APIとJSONスキーマも確認し、テンプレートを削除した配布物は失敗として検出した。

## 1.2 CIと公開前ゲート

現行ワークフローで回帰テスト2件が失敗した。3OSとNode下限に配布物のcheckを追加し、公開前に同じコミットのlint・型・テスト・ビルド・配布物を検証するよう変更した。新規2件と既存23件の計25件が成功した。実際のGitHub Actionsの実行結果はまだ確認していない。

## 検証の実行方法

開発用のNode24で`node scripts/package-smoke.mjs prepare <新規ディレクトリ>`を実行する。ビルドした5つのtarballをオフラインで利用先へ導入し、Gitとサンプルchangeを準備する。既存のディレクトリには上書きしない。

続けて、確認するNodeで`node scripts/package-smoke.mjs check <同じディレクトリ>`を実行する。公開API、スキーマ、インストールしたbin、help、version、init、doctor、verify、証拠の記録とレポートを確認する。Node20ではcheckだけを動かす。

ローカルの成功は、別OS・別NodeのCI成功を意味しない。公開ワークフローは同じコミットを検査するが、npmへの公開権限や実際の認証は別に確認する。

## 完了ゲート

`pnpm -s verify --change verify-package-artifacts --done`はexit 0。lint・型検査・346件のテスト・全REQの対応を確認した。現在のホストで配布物の統合テストが成功した。CIの別OS・別Nodeでの実行とnpm公開は未実施。
