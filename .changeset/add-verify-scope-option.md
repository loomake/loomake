---
'loomake': minor
'@loomake/kit': patch
---

`verify` と `trace record` に `--scope local|ci` を足す。省くと `--done` は ci、`--spec-only` と `--change` なしは local。明示した scope は指定どおりに扱う。
