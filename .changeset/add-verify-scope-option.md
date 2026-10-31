---
'loomake': minor
'@loomake/kit': patch
---

`verify` と `trace record` に `--scope local|ci` を足す。省くと `--done` は ci、`--spec-only` と `--change` なしは local。`--change` を指定しない `--scope ci` は使い方の誤り（終了コード 2）にする。
