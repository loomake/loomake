# test/publication-retry-shared-run（2026-10-31）

1. やったこと：設計メモ design-b1-runner-tests の T3 として、[PR #218](https://github.com/loomake/loomake/pull/218) を作った。
   - publication-retry.test.ts では、「作成前に失敗する 1 回目の run」が同じ形のケースが 10 個ある。この run を 1 回だけ流して結果を保存し、各ケースはその複製から 2 回目の run を始めるようにした。
   - 1 回目の形が違う 15 ケースは従来のまま残し、段階の記録の説明（docs/dev/test-phase-profiling.md）を直した。
   - 自己レビューへの対応：1 回目の run や複製が途中で失敗しても、保存先が afterAll で消えるようにした。`ci:all-os` ラベルで Windows でも流し、PR 本文の証跡と仮定を直した。
   - 独立レビュー（重大 0・軽微 3）には次の 3 点で対応した。
     - repo の操作関数が元の env を参照したままである点をコメントに書いた。
     - 外部プロセスの記録は case-start〜case-end の時刻で対応づける、と docs に足した。
     - この作業記録を 1 つの節にまとめた。
2. verify：change を持たない L2 の試験の変更なので、verify は対象外。
   - `pnpm lint`・`pnpm typecheck`・`pnpm test` は通った。試験の数（25）・期待値・上限値は main と同じ。
   - Windows では quality-quarantine のジョブで 25 件が通った。
3. 確認事項・仮定：1 回目の run の共有は Q-B1-2 で利用者が承認した（2026-10-31）。
   - 1 回目の run がたまにしか失敗しない場合に気づきにくくなる点も、この承認に含めた。
   - 複製は元と同じ場所へ戻す。write-report.mjs のコミットが絶対パスを含み、場所を変えると 2 回目の run の前提が変わるためである。
4. 次にやること：マージは別担当が行う。CI の artifact で、前後の所要時間を比べる。
