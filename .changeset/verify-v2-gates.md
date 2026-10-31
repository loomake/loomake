---
'@loomake/kit': patch
---

verify の warn・skip・NOT_APPLICABLE と要判断の分類を 2.0.0 に合わせる。完了ゲート（done）では、未承認の仮定と確認待ちの要件を不足にして `decision.required` を返し、終了コード 1 にする。OpenSpec CLI が無いとき（`openspecValidate: auto`）は、ローカルでは理由と確認者つきの対象外、CI では不足にする。仕様ゲートの案内（終了コード 0）は変えない。
