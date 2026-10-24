## Why

CIと公開ワークフローのActionsが可変タグを参照し、チェックアウトの資格情報が後続の品質コマンドにも残る。公開するパッケージに出典のrepository情報がなく、provenanceも要求していない。OSSとしての貢献・脆弱性報告・サポート・互換性の文書も不足している。

## What Changes

- Actionsを確認したv4のコミットSHAへ固定し、参照元を記録する。
- チェックアウトで資格情報を保存せず、既定の権限をcontents readとし、公開ジョブとタグ送信の段階へ必要な権限を限定する。
- 5パッケージにrepositoryとprovenanceの設定を追加し、公開ジョブに必要なOIDC権限を付ける。実際の公開とattestationの検証は未実施として区別する。
- セキュリティの信頼境界・報告経路、貢献・サポート・互換性、依存更新と公開元確認の手順を文書化する。

## Capabilities

### New Capabilities

- `release-integrity`: 公開経路と配布元の整合性を確認する。

### Modified Capabilities

なし。

## Impact

.github/workflows、packagesのpackage.json、配布物の検査と回帰テスト、OSS向けの文書を変更する。製品の機能と実行時依存、品質コマンドの設定は変更しない。公開やGitHubの設定変更は実行しない。
