---
"@loomake/kit": minor
"loomake": minor
---

verifyは、存在するloomake.config.jsonをOSのエラーで読めない場合、configのaborted/2からruntimeのaborted/3へ変更します。JSON構文・設定内容・入力制約の拒否は2、省略時の既定値とほかのコマンドの事前設定読取は維持します。JSONの形とschemaVersionは変えません。存在確認でのOS失敗も3、壊れたリンクは2へ分けます。

runとtrace recordが内部でverifyを呼ぶ場合にも同じ分類が及びます。壊れたリンクは2となり、存在確認のOS失敗ではrunが3で止まり、trace recordはabortedを記録します。
