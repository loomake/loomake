---
"@loomake/core": patch
"@loomake/kit": patch
"@loomake/trace": patch
"@loomake/runner": patch
"loomake": patch
---

公開メタデータにリポジトリと各パッケージのディレクトリを追加し、provenanceを要求する。公開前に配布物の同じメタデータを検査する。公開経路ではActionsをコミットSHAへ固定し、checkoutの資格情報の保存と公開・タグ送信の認証範囲を制限する。
