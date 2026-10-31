# 手元の速い確認と夜間の変異試験

1. やったこと：`pnpm test:changed`（`scripts/test-changed.mjs`。origin/main との分岐点から `vitest run --changed` で関係する試験だけを流す）を足し、`quality-quarantine.yml` に定期実行と手動実行だけで動く独立ジョブ `domain-mutations` を足した（quality-speed-plan の B4・A3）。生き残った変異の数と一覧を `survived.json` と実行の概要に書き、artifact に 30 日残す。
2. verify の結果：change のない L2 なので、`pnpm lint`・`pnpm typecheck`・`pnpm test` を流して通った。ジョブの形は `tests/domain-mutations-workflow.test.ts` で確かめ、変異試験は手元で 13/13 を検出した。
3. 残っている確認事項・仮定：`vitest related --run` と `vitest run --changed` は、同じ変更で同じ 78 ファイルを選んだ。コミット前の変更も自動で拾える `--changed` を選んだ。夜間ジョブの実際の動作は、マージ後の最初の定期実行か手動実行で確かめる。
4. 次にやること：マージ後に手動実行で artifact と概要を確かめ、ダッシュボードに生き残った変異の数を載せる。
