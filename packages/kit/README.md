# @loomake/kit

[loomake](https://www.npmjs.com/package/loomake) の内部用パッケージ。verify・init・doctor の本体と、init が配るテンプレート。

直接は使わず、CLI の `loomake` を使う。版が `0.y.z` のあいだは、API が予告なく変わることがある。

詳しくは [GitHub のリポジトリ](https://github.com/loomake/loomake)を見る。

## 評価済み品質結果の集約

`aggregateCiVerdict(results: readonly QualityResult[]): QualityResult` は、評価済み入力を集約して CI verdict の値だけを返す。`QualityResult` は core の共有スキーマから導出した型で、PASS・FAIL・INSUFFICIENT_EVIDENCE・NOT_APPLICABLE の4値を持つ。

FAIL があれば FAIL、次に証跡不足があれば INSUFFICIENT_EVIDENCE を返す。PASS が1件以上あり、残りが PASS または NOT_APPLICABLE なら PASS、空配列と全件 NOT_APPLICABLE は INSUFFICIENT_EVIDENCE を返す。

NOT_APPLICABLE の理由・確認者、証跡適格性、個別条件は集約前に確認する。この関数だけでは証跡適格性や完了ゲート全体の最終合格を判定しない。件数や summary は返さず、既存 verify の出力へは接続していない。

## 品質コマンドの終わり方の通知

`runVerify` の任意の `onCommand` は、コマンド名と `QualityCommandOutcome` を実行順に一度ずつ同期通知する。正常な数値終了は `exited` と `status`、信号は `signal`、起動等の失敗は `error` と `code`（不明は null）、上限や中断は `timeout`・`interrupted`・`output` と任意の `reason` を持つ。

訪問時点で期限切れのコマンドは `timeout` を通知する。省略・空設定・早期終了後の未訪問コマンドと、品質コマンド以外の外部操作は通知しない。通知先が投げた値はそのまま呼出元へ伝わり、後続を実行しない。通知先が正常に戻るとき、verify の既存の結果・表示・JSON・終了コードは変わらない。

通知は実行経路の観測であり、テスト全件の完了証明ではない。shell が失敗や途中停止を終了0へまとめることもあるため、レポートの完全性は利用側で別に照合する。

## ライセンス

MIT
