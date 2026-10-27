# 質問と不具合報告

初めて使う場合は[使い方](docs/guide/1.getting-started/2.usage.md)、導入状態の確認は`loomake doctor`、runの中断と再開は[復旧手順](docs/guide/2.guides/3.run-recovery.md)を参照する。doctorは導入設定の診断であり、品質コマンドや外部サービスへの接続の成功を保証するものではない。

解決しない場合は、[リポジトリのIssues](https://github.com/loomake/loomake/issues)で既存の報告を確認し、見つからなければ報告する。脆弱性や秘密情報に関わる報告は、公開Issueに詳細を載せず[SECURITY.md](SECURITY.md)の手順を使う。

報告には次を含める。

- Loomakeの版またはコミット、OS、Nodeとpnpmの版
- 実行したコマンドと、期待した結果・実際の結果・終了コード
- 秘密情報を取り除いた設定と、最小の再現手順
- `verify --json`や`summary.json`のうち、問題を説明する部分
- 初回から失敗するか、以前の版では動いたか

ログや証拠を共有する前に、トークン、外部から受け取った文書、個人情報が含まれないか確認する。診断の既知トークンの置換は、あらゆる秘密情報を検出する仕組みではない。再現用の文書はダミーの内容で作る。

対応範囲は[互換性の方針](docs/guide/3.reference/1.compatibility.md)、開発への参加は[CONTRIBUTING.md](CONTRIBUTING.md)を参照する。回答や修正の期限を定めたサポート契約は、このリポジトリでは提供していない。
