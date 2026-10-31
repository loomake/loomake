# test/publication-retry-shared-run（2026-10-31）

1. やったこと：設計メモ design-b1-runner-tests の T3 として、publication-retry.test.ts で「作成前に失敗する 1 回目の run」が同じ形の 10 ケースについて、1 回目の run を 1 回だけ流して結果を保存し、各ケースはその複製から 2 回目の run を始めるようにした。1 回目の形が違う 15 ケースは従来のまま残し、段階の記録の説明（docs/dev/test-phase-profiling.md）を直した。
2. verify：change を持たない L2 の試験の変更なので、verify は対象外。`pnpm lint`・`pnpm typecheck`・`pnpm test` は通り、試験の数（25）・期待値・上限値は main と同じ。
3. 確認事項・仮定：1 回目の run の共有は Q-B1-2 で利用者が承認した（2026-10-31）。複製は元と同じ場所へ戻す方式にした。write-report.mjs のコミットが絶対パスを含み、場所を変えると 2 回目の run の前提が変わるためである。
4. 次にやること：別担当が独立 Opus レビューとマージを行う。CI の artifact で、前後の所要時間を比べる。

## 自己レビューへの対応（2026-10-31）

1. やったこと：自己レビューの軽微 5 件に対応した。1 回目の run や複製が途中で失敗しても、保存先のディレクトリが afterAll で消えるようにした。PR に `ci:all-os` ラベルを付けて Windows でも流し、PR 本文の証跡ブロックと仮定を書き直して `Refs #178, #116` を足した。
2. verify：change を持たない L2 の試験の変更なので、verify は対象外。`pnpm lint`・`pnpm typecheck` は通り、publication-retry.test.ts の 25 件も通った。
3. 確認事項・仮定：1 回目の run を共有すると、その run がたまにしか失敗しない場合に気づきにくくなる。この点は Q-B1-2 で承認済みなので、PR 本文に仮定として書いた。
4. 次にやること：Windows を含む CI の結果を確かめ、新しい head を管理役に渡す。Opus の独立レビューとマージは別担当が行う。
