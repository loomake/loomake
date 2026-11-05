# @loomake/kit

[loomake](https://www.npmjs.com/package/loomake) の内部用パッケージ。verify・init・doctor の本体と、init が配るテンプレート。

直接は使わず、CLI の `loomake` を使う。版が `0.y.z` のあいだは、API が予告なく変わることがある。

詳しくは [GitHub のリポジトリ](https://github.com/loomake/loomake)を見る。

## 評価済み品質結果の集約

`aggregateCiVerdict(results: readonly QualityResult[]): QualityResult` は、評価済み入力を集約して CI verdict の値だけを返す。`QualityResult` は core の共有スキーマから導出した型で、PASS・FAIL・INSUFFICIENT_EVIDENCE・NOT_APPLICABLE の4値を持つ。

FAIL があれば FAIL、次に証跡不足があれば INSUFFICIENT_EVIDENCE を返す。PASS が1件以上あり、残りが PASS または NOT_APPLICABLE なら PASS、空配列と全件 NOT_APPLICABLE は INSUFFICIENT_EVIDENCE を返す。

NOT_APPLICABLE の理由・確認者、証跡適格性、個別条件は集約前に確認する。この関数だけでは証跡適格性や完了ゲート全体の最終合格を判定しない。件数や summary は返さず、既存 verify の出力へは接続していない。

## 共通の秘密置換

`maskSecrets(text: string): string`、`createDiagnosticRedactor(sink)`、`createPrivateKeyFilter(sink)`、`maskValue<T>(value: T): T` を公開する。runner の従来の公開元も同じ関数を使う。診断ストリームと秘密鍵フィルターは `write(text)` と `end()` を持ち、チャンクの境界をまたぐ秘密も処理する。

置き換えるのは、既存の API トークン・Bearer トークン・秘密鍵などの既知の形だけである。任意のパスワードや個人情報を見分けられるとは保証しない。認証情報そのものを入力や記録へ含めない。

`maskValue` は文字列の値と own key を置き換え、入力を変えずに深く複製する。受け付けるのは null・boolean・有限の number・string、穴のない通常の Array、通常の object と null prototype の object である。object の own enumerable な data property の undefined は保持し、欠落した optional field は補わない。負の0、列挙順、prototype の種類、own `__proto__` なども保つ。共有された子の値は、出現ごとに独立して複製する。

root と Array 要素の undefined、非有限 number、bigint、function、symbol、class instance、Date・Map・Set・Proxy、getter・setter、symbol key、non-enumerable な object property、Array の穴や追加 property は UsageError になる。getter や `toJSON` は実行しない。循環と、置換後の key の衝突も拒否し、例外へ元の値や key を含めない。戻り値の型 T は構造を受け渡すためのもので、置換される文字列リテラルや key の同一性を保証しない。

この変更は共通関数の公開までである。五つのツールの変換・収集と、verify・trace の保存・表示・診断への接続は、Issue #65 の後続作業に残している。

## ライセンス

MIT
