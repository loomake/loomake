---
"@loomake/core": minor
"@loomake/kit": patch
---

trace.md の確認事項の表に「回答者」「回答日」、仮定の表に「承認者」「承認日」の列を足した。`parseTrace` は新しい列を読み、列のない既存の trace.md では空の文字列を返す。`createTraceTemplate` と kit が配る trace.md の雛形にも列を足した。
