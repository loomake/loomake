---
"@loomake/runner": patch
"loomake": patch
---

エンジンのstdoutとstderrの合計を既定64MiBに制限する。run.maxOutputBytesで上限を設定でき、超過時はタスク・コミット・PRへ進めず理由を記録する。
