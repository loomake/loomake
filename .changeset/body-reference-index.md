---
"@loomake/core": patch
"@loomake/kit": patch
"@loomake/trace": patch
---

固定要約を変更せず本体参照receiptを原子的に追加し、明示した保持方針と日時で索引を解決する同期APIを公開します。raw bytes・CI・実checkout・本体・ZIPを照合し、不正候補や矛盾を成功扱いにしません。取得・真正性・品質合格は別に扱い、既存13 Schemaと旧Evidenceの閲覧を維持します。
