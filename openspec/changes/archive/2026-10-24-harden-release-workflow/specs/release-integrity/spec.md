## Purpose

公開予定のコミットから品質と配布物を検査し、外部Actionsの参照・資格情報・パッケージの出典を明確にする。公開元検証の設定と、実際の公開で得られた検証結果を区別する。

## ADDED Requirements

### Requirement: 外部Actionsの不変参照
リポジトリのワークフローが使う外部Actionsは、確認した完全なコミットSHAで参照する SHALL。既存のv4系の参照元とSHAの対応を記録し、更新時に出典・変更内容・品質と配布物の結果をレビューする SHALL。

Source: REQ-167

#### Scenario: ワークフローを検査する
- **WHEN** CIと公開のワークフローを確認する
- **THEN** 外部Actionsが完全なコミットSHAで参照され、対応する上流の参照元を確認できる

### Requirement: CIと公開の資格情報の制限
ワークフローの既定権限はcontents readとし、タグ送信に必要なcontents writeとprovenanceに必要なid-token writeは公開ジョブに限定する SHALL。チェックアウトは資格情報を保存しない SHALL。npmの認証情報は公開ステップだけに渡し、タグ送信の認証は品質コマンドと公開を終えた後のステップだけに渡す SHALL。公開はmainからの手動実行を維持する SHALL。

Source: REQ-168

#### Scenario: 品質コマンドを実行する
- **WHEN** lint・型検査・テスト・配布物の検査を実行する
- **THEN** チェックアウトの資格情報が保存されず、npm公開とタグ送信の認証情報も渡されない

### Requirement: 配布元とprovenanceの設定
5パッケージの公開メタデータに、実際のリポジトリと各パッケージのディレクトリ、provenanceを要求する設定を含める SHALL。公開ジョブはprovenanceを要求し、必要なOIDC権限を持つ SHALL。配布物の検査でも同じメタデータを確認する SHALL。設定だけをもって公開やattestationの検証が成功したとは報告しない SHALL。

Source: REQ-169

#### Scenario: 配布物を検査する
- **WHEN** tarballを独立したプロジェクトへ導入する
- **THEN** 5パッケージの出典とディレクトリ、provenanceの設定が保たれる
