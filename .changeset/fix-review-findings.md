---
"@loomake/core": patch
"@loomake/runner": patch
---

`parseTrace` は、trace.md の表に必須の列（合意の 4 列を除く列）がないとき、解析エラーを返す。`loomake run` は、エンジンが 0 以外の終了コードで終わったらタスクを完了にせずに止まる。再開のときは `loomake/<change-id>` に切り替えてから仕様ゲートとタスクを読み、PR の向き先には、run が `loomake/<change-id>` を作ったときのブランチを使う。どの階層の package.json でも、`scripts` の変更を不正な直し方として見つける。
