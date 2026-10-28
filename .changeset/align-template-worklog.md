---
"@loomake/kit": patch
"loomake": patch
---

`loomake init` が配る AGENTS.md の作業記録の決まりを変える。記録は、日付ごとのファイル `docs/worklog/<作業した日>.md` ではなく、作業したブランチごとのファイル `docs/worklog/<日本時間の日付>/<ブランチ名>.md` に書く。ブランチ名の `/` は `-` に置き換える。作業記録はその作業の PR に含め、作業記録だけの PR は作らない。
