---
"@loomake/trace": minor
"loomake": patch
---

`loomake trace report` は、ファイル名の日時がいちばん新しい証拠だけを読んで検証する。古い証拠が増えても、読み取りの合計の上限（128MiB）で失敗しない。古い証拠が壊れていても、レポートは最新の証拠から作る。
