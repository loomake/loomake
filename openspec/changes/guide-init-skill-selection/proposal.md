# Why

[Issue #286](https://github.com/loomake/loomake/issues/286) 項目2は、req-to-openspec と OpenSpec の Skill の使い分けを init の出力で案内することを求める。配置した主体を取り違えず、導入直後に選べるようにする。

# What Changes

- 成功した init に、要件書からの作成は req-to-openspec、作成済み change の操作は OpenSpec が配置する openspec-* を使うという1行を追加する。
- 成功時に1回だけ出し、中止・使い方の誤りでは出さない。新しい探索やオプションは加えない。

# Capabilities

- Modified: `init` の REQ-023（OpenSpec 初期化の案内）。既存の2 Scenarioを保持する。新しいcapability・要件IDはない。

# Impact

kit の成功時 stdout と CLI の ID 付き追加試験、kit patch changeset。配置ファイル・設定・既定コマンド・終了コードは不変。文書と試験を含め約200行、300行以内の一度に受け入れられる単位とする。

# Non-goals

項目1のキュー確認案と Q-286-01/a〜c は未承認の別範囲。doctor、CI、規則、GitHub取得、公開、新計測は変更せず、親Issueは閉じない。#336 の REQ-024 と未archiveの差分を保持し、主仕様を直接編集しない。
