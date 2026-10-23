---
"@loomake/trace": minor
"loomake": minor
---

`@loomake/trace` を足し、`loomake trace record --change <id>` を追加した。`verify --done` を実行し、結果を検査したコミットの SHA・日時と合わせて `.loomake/evidence/<change-id>/` に新しいファイルとして記録する。作業ツリーに未コミットの変更があるときは記録しない。
