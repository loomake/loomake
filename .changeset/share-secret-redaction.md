---
"@loomake/kit": patch
"@loomake/runner": patch
---

既存の秘密置換と診断ストリームを kit へ共有し、runner の公開元と既存の置換結果を維持する。kit に、JSONに使う値と object の own undefined を入力不変で深く複製・置換する `maskValue` を追加する。対象外の値、循環、置換後のキー衝突は、入力内容を含まない UsageError で拒否する。
