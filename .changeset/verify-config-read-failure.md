---
"@loomake/kit": minor
"loomake": minor
---

verifyは、存在するloomake.config.jsonをOSのエラーで読めない場合、configのaborted/2からruntimeのaborted/3へ変更します。JSON構文・設定内容・入力制約の拒否は2、省略時の既定値とほかのコマンドの事前設定読取は維持します。JSONの形とschemaVersionは変えません。存在確認でのOS失敗も3、壊れたリンクは2へ分けます。

runとtrace recordが事前の共有設定読取を通過し、内部のverifyで設定ファイルの存在照会や読取りに失敗した場合にも同じ分類が及びます。この場合、runは3で止まり、trace recordはabortedを記録します。壊れたリンクは2です。実際にプロジェクトルートの検索権限がない場合は、事前の共有設定読取でtests.reportの照会が失敗して2で止まり、内部のverifyまで進みません。
