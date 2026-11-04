---
"@loomake/kit": minor
"loomake": minor
---

init が品質目標未設定の quality.yaml と、自動実行されない4ジョブの workflow 呼出し見本を配置します。品質目標と合格に必要な証拠の設定、見本の未提供参照について案内します。ci の完了ゲートで quality.yaml がないときは、読取の最小構成と合格に必要な設定を分けて案内します。

既存の `quality.yaml` または `.github/loomake/workflow.example.yml` が配布テンプレートと異なる場合、非TTYの `init` は終了コード1で全ファイルの配置を中止します。端末から再実行し、既存の内容を残す場合は該当ファイルの上書きを拒否してください。
