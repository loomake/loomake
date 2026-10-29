---
'@loomake/core': patch
---

quality.yaml v2 の Zod スキーマと、スキーマから導出した型を追加した。`loadQualitySchema()` でスキーマを読み、証跡の保管方針に既定値を補う。外部ツール向けの `schema/quality.schema.json` も公開し、Zod スキーマから書き出した内容との差分をテストで検出する。
