---
"@loomake/kit": patch
"loomake": patch
---

テストのレポートの置き場と init の配置先を事前に検査し、不正な入力による外部ファイルの削除や一部だけの配置を防ぐ。report の表記をそろえて文字どおりに gitignore へ書き、監視役が停止しない場合の時間制限と change 探索のエラー分類を修理する。
