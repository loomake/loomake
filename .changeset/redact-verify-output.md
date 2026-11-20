---
'@loomake/kit': patch
'loomake': patch
---

verify の戻り値、進捗、失敗した品質コマンドと openspec validate の出力、整形した文字列、CLI のエラー表示から、既知の形の秘密を取り除いて `***` にします。外部コマンドの出力は全文を置換してから、既存の上限で切ります。
