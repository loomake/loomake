# C001 の分割 2c/6（verify-v2-strict）

1. やったこと：子 change `verify-v2-strict` のタスク 1.1〜5.1。親から REQ-164・317・318 を既存 ID のまま移した。ci-gate は change のゲートを `--json` で実行し、終了コードではなく 2.0.0 の結果（対象の change・scope ci・completed・要判断なし・PASS・完了ゲートの検査あり）で合格を決め、1.0.0・local・証拠不足・仕様ゲートだけの結果・全件 NOT_APPLICABLE を合格にしない（REQ-318）。runner は Evidence 1 を再利用せず新しい記録に進み（REQ-164）、完了ゲートに scope:ci の結果が来たら直しに進まず止まる（REQ-317）。trace の `evidenceProblem` は local の pending が insufficient 以上であることを確かめる。
2. verify の結果：子の `--done`、親・1/6・2a・2b-1・2b-2 の `--spec-only` は exit 0。lint・typecheck・全体試験は done ゲート内で成功。
3. 残っている確認事項・仮定：S8-08（完了ゲートの結果の見分け方）は A を管理役が採用。仮定 A-01〜A-03 は管理役承認（2026-10-31）。`--scope` の CLI フラグ、実証跡の adapter、規約・雛形の更新は 6/6。
4. 次にやること：CI（gate が自分の 2.0.0 の結果で合格すること）と Opus のレビューを管理役が確かめる。

| PR | 設計待ち | 実装 | CI 待ち | レビュー往復回数 | マージまで |
|---|---|---|---|---|---|
| change/verify-v2-strict | 対象外（設計メモと管理役の決定で代替） | 約 50 分 | 未実施 | 0 | 未実施 |
