---
"@loomake/kit": patch
---

`loomake init` は、置き先がシンボリックリンクを通ってプロジェクトの外を指すときと、リンク先の無いシンボリックリンクのとき、何も置かずに終了コード 1 で中止する。`loomake verify` の仕様ゲートは、trace.md と spec.md の解析エラーを不合格にする。
