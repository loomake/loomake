---
"@loomake/core": minor
"@loomake/kit": minor
---

判定関数 evaluateAgreement・evaluateTestCoverage と結果型の公開元を core から kit へ移した。入力モデルと createAgreement は core に残る。利用側は判定の import 元を kit に変更する。
