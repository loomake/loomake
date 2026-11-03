---
"@loomake/kit": minor
"loomake": minor
---

verifyは、存在するloomake.config.jsonをOSのエラーで読めない場合、configのaborted/2からruntimeのaborted/3へ変更します。JSON構文・設定内容・入力制約の拒否は2、省略時の既定値とほかのコマンドの事前設定読取は維持します。JSONの形とschemaVersionは変えません。
