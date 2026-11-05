# @loomake/kit

[loomake](https://www.npmjs.com/package/loomake) の内部用パッケージ。verify・init・doctor の本体と、init が配るテンプレート。

直接は使わず、CLI の `loomake` を使う。版が `0.y.z` のあいだは、API が予告なく変わることがある。

詳しくは [GitHub のリポジトリ](https://github.com/loomake/loomake)を見る。

## 評価済み品質結果の集約

`aggregateCiVerdict(results: readonly QualityResult[]): QualityResult` は、評価済み入力を集約して CI verdict の値だけを返す。`QualityResult` は core の共有スキーマから導出した型で、PASS・FAIL・INSUFFICIENT_EVIDENCE・NOT_APPLICABLE の4値を持つ。

FAIL があれば FAIL、次に証跡不足があれば INSUFFICIENT_EVIDENCE を返す。PASS が1件以上あり、残りが PASS または NOT_APPLICABLE なら PASS、空配列と全件 NOT_APPLICABLE は INSUFFICIENT_EVIDENCE を返す。

NOT_APPLICABLE の理由・確認者、証跡適格性、個別条件は集約前に確認する。この関数だけでは証跡適格性や完了ゲート全体の最終合格を判定しない。件数や summary は返さず、既存 verify の出力へは接続していない。

## 固定済み要約の改変検出

`checkFixedSummary(summaryText: unknown, anchor: unknown): FixedSummaryCheck` は、要約の UTF-8 本文全体の SHA-256 と `sha`・`ci.runId`・`ci.runAttempt` を、別の引数で渡した固定値と完全一致で照合する。自己ハッシュは照合に使わず、改行・空白・大文字小文字も正規化しない。

孤立した UTF-16 サロゲートを含む文字列は、UTF-8 変換で U+FFFD に置き換わる前に拒否する。正しいサロゲートペアや U+FFFD 自体は、この理由では拒否しない。この API は文字列だけを受けるため、呼び出し側が `TextDecoder('utf-8', { fatal: true })` などで生バイトを厳密にデコードしてから渡す。置換付きでデコードした文字列から、元の不正なバイト列は復元できない。

`anchor` は `SummaryTrustAnchor` の形で、`summarySha256`（小文字64桁の16進）、`sha`（小文字40桁または64桁の16進）、`runId`（空でない文字列）、`runAttempt`（1以上の整数を先頭ゼロなしで表す文字列）を持つ。呼び出し側が、要約を改変する側から分離したリリース記録などから固定値を取得し、取得元の真正性・権限・承認状態を確認する。

一致したときは `reusable: true`・`result: 'PASS'`・`returnToHuman: false`・空の `reasons` を返す。不一致や入力形式の誤りでは `reusable: false`・`result: 'FAIL'`・`returnToHuman: true` と、`FixedSummaryProblemCode` と日本語の説明を持つ `reasons` を返す。

W1 の A16 は固定 fixture で確認する。正式な要約の保存形式とは Issue #69 で再照合する。gate・eval・report への接続、W5 の実リリースの承認・署名・取得処理は、この関数の追加では実装していない。

## ライセンス

MIT
