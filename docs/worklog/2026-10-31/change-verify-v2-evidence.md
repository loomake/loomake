# C001 の分割 2b-2/6（verify-v2-evidence）

1. やったこと：証拠の現行の名前（`Evidence`・`evidenceSchema`・`EVIDENCE_SCHEMA_VERSION`・`evidence.schema.json`）を Evidence 2 にした。trace report は、未対応の版・版の混在・状態別の必須欄の欠けを、ファイルと箇所を示して拒否する（REQ-073）。`--skip-commands` の help を REQ-040 の動きに合わせ、基準の原本は変えずに、承認した差分を別ファイルに記録した（REQ-324）。互換性の文書と root の `quality.yaml` を置いた。
2. verify の結果：子の `--done`、親・1/6・2a・2b-1 の `--spec-only` は exit 0。
3. 残っている確認事項・仮定：S8-07（基準の差分の記録のしかた）は管理役の依頼に沿って A とした。PR で確認を受ける。旧形式の不合格は 2c/6。
4. 次にやること：CI と Opus のレビューを管理役が確かめる。

| PR | 設計待ち | 実装 | CI 待ち | レビュー往復回数 | マージまで |
|---|---|---|---|---|---|
| change/verify-v2-evidence | 対象外 | 約 40 分 | 未実施 | 0 | 未実施 |
