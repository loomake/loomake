# 手元の速い確認と夜間の変異試験

1. やったこと：`pnpm test:changed`（`scripts/test-changed.mjs`。origin/main との分岐点から `vitest run --changed` で関係する試験だけを流す）を足し、`quality-quarantine.yml` に定期実行と手動実行だけで動く独立ジョブ `domain-mutations` を足した（quality-speed-plan の B4・A3）。生き残った変異の数と一覧を `survived.json` と実行の概要に書き、artifact に 30 日残す。
2. verify の結果：change のない L2 なので、`pnpm lint`・`pnpm typecheck`・`pnpm test` を流して通った。ジョブの形は `tests/domain-mutations-workflow.test.ts` で確かめ、変異試験は手元で 13/13 を検出した。
3. 残っている確認事項・仮定：`vitest related --run` と `vitest run --changed` は、同じ変更で同じ 78 ファイルを選んだ。コミット前の変更も自動で拾える `--changed` を選んだ。夜間ジョブの実際の動作は、マージ後の最初の定期実行か手動実行で確かめる。
4. 次にやること：マージ後に手動実行で artifact と概要を確かめ、ダッシュボードに生き残った変異の数を載せる。

## 自己レビューへの対応

1. やったこと：自己レビューの軽微 3 件を直した。origin/main との分岐点を求められないときに `test:changed` が終了コード 2 で止まる試験を足した。夜間の変異試験の survived の段階は、文字列を確かめる代わりに、作った `results.json` に jq を実際に当てる試験にした。killed・survived・error が混ざる場合と、baseline が null の場合を確かめる。baseline が null のときは要約に「未実施」と書くようにした。`docs/dev/ci.md` には、夜間実行が赤いときに失敗したジョブの名前で原因を分けることを書いた。
2. verify の結果：`pnpm lint`・`pnpm typecheck`・`pnpm test` を流して通った。
3. 残っている確認事項・仮定：jq の試験は bash と jq があるときだけ動く。GitHub の ubuntu の実行環境には両方とも入っているので、CI では毎回動く。
4. 次にやること：独立の Opus レビューに出す。

### 独立レビューへの対応

1. やったこと：独立レビュー（Claude Opus 5.5、1cded378）の軽微 1 件を直した。夜間の変異試験が赤くなったときに原因を分けられるよう、survived の段階で `originalsUnchanged` を `survived.json` に書き、概要に `ok` と並べて出す。jq の試験の期待値にもこの項目を足した。`docs/dev/ci.md` には、`domain-mutations` と `plan` が失敗する場合を並べ、それ以外は `results.json` とログを見ることを書いた。
2. verify の結果：`pnpm lint`・`pnpm typecheck`・`pnpm test` を流して通った。
3. 残っている確認事項・仮定：なし。
4. 次にやること：管理役に新しい head を伝える。
