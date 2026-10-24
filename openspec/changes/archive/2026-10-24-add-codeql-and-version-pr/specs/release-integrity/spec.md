## MODIFIED Requirements

### Requirement: 外部Actionsの不変参照
リポジトリのワークフローが使う外部Actionsは、確認した完全なコミットSHAで参照する SHALL。`owner/repo/path@sha` のようにサブパスを持つ参照も同じく完全なコミットSHAで固定し、記録とはリポジトリ（owner/repo）とSHAで照合する SHALL。既存のv4系の参照元とSHAの対応を記録し、更新時に出典・変更内容・品質と配布物の結果をレビューする SHALL。

Source: REQ-167

#### Scenario: ワークフローを検査する
- **WHEN** CIと公開のワークフローを確認する
- **THEN** 外部Actionsが完全なコミットSHAで参照され、対応する上流の参照元を確認できる

#### Scenario: サブパスを持つ参照
- **WHEN** ワークフローが `github/codeql-action/init@<40 桁の SHA>` を使う
- **THEN** 記録に `github/codeql-action` と同じ SHA があれば合格し、短い SHA やタグの参照は不合格になる

## ADDED Requirements

### Requirement: コードの静的解析
リポジトリは、PR・main への push・週 1 回の定期実行で、CodeQL による JavaScript・TypeScript の解析を行う SHALL。解析のジョブだけが `security-events: write` を持ち、ワークフローの既定の権限は `contents: read` とする SHALL。

Source: REQ-200

#### Scenario: CodeQL のワークフロー
- **WHEN** `.github/workflows/codeql.yml` を読む
- **THEN** pull_request・main への push・schedule で動き、javascript-typescript を解析し、既定の権限は contents read で、checkout は資格情報を保存しない
