# shorten-ci-wall-clock

## Why
change speed-up-ci（REQ-214・REQ-215）のあとも、PR の CI が終わるまでに 7〜9 分かかる。2026-10-27 に測った値は次のとおりである。

- CI の run 40439394065（main）と 40439267528：ubuntu の `pnpm test --coverage` が 2.5〜3.3 分（ジョブは 3〜4 分）、macOS のシャードが 2〜6 分（ジョブは 2.5〜7 分）、Windows のシャードが 5.5〜8 分（ジョブは 7〜9 分）。全体の時間を決めているのは Windows のシャードである。gate ジョブは `scripts/ci-gate.mjs` から `verify --done` を実行し、lint・typecheck・test をもう一度実行するので 3.5 分かかる。クリティカルパスではないが、実行分を使う。checkout から typecheck までは約 1 分で、問題ではない
- 手元（8 コア）：vitest は 53 秒で 1007 件。ファイルごとの時間の合計 315 秒のうち 168 秒を、runner の 4 ファイルが占める（run 53 秒・external-budget 46 秒・publication-retry 42 秒・guards 29 秒）

原因は 2 つある。1 つは、テストが実時間を待つことである。偽のエンジンの `sleepMs: 3000`、偽の OpenSpec CLI の `setTimeout(…,3000)`、`timeoutMinutes: 0.1`（Windows では 0.3）、20 秒の予算などがあり、external-budget の 1 件だけで 13 秒かかる。もう 1 つは、git と node の子プロセスを多く起動することで、Windows では起動が遅い。main の Windows では 13 件のテストが失敗している（external-budget・process・ai-journeys・guards。どれも期限や時間に関わる）。遅さと不安定さの原因は同じである。

また、作業記録だけを変える PR のような、文書だけの PR でも 8 分以上の CI が走っている。

## What Changes
- 案 A（確認事項 Q-01・Q-02）：PR で変えたファイルがすべて文書なら、quality ジョブは lint・typecheck・test・build・配布物の検査を実行せずに成功する（REQ-270、ADDED）。ワークフローの `paths` フィルタやジョブの `if` ではなく、ジョブの中のステップで判定する。飛ばした PR でも、必須チェックのジョブが同じ名前で成功を報告するようにするためである。main への push では飛ばさない。あわせて、「3 つの OS での CI」（REQ-049）と「CI のテストの分割」（REQ-214）に、この例外を書き足す（MODIFIED）。文書だけの PR でも、gate ジョブの `verify` は lint・typecheck・test を ubuntu で 1 回実行する
- 案 B（確認事項 Q-03・Q-04・Q-05）：時間を確かめるテストを、固定の実時間の待ちではなく、子プロセスが段階に届いた合図で進む形に変える（REQ-271、ADDED）。期限で止まることを確かめるテストでは、期限を短くし、期限より前に終わる処理を実時間で待たない。確かめる内容（終了コード・停止の理由・記録・残るファイル）は弱めない
- 差分仕様は、おすすめの A と B で書いてある。どちらかを採らない回答になったときは、タスク 1.1 で差分仕様と tasks.md を直す

## Non-goals
- 案 C（Windows で Dev Drive を使う）、案 D（macOS と Windows のシャードを 2 から 3〜4 に増やす）、案 E（gate でテストを二重に実行しない）。採るかどうかは確認事項 Q-06〜Q-08 で決める。この change では、おすすめに従い採らない
- node20・node22・gate のジョブを、文書だけの PR で飛ばすこと
- 製品の振る舞い（runner や kit の期限・予算の値と、その扱い）を変えること。変えるのはテストとワークフローだけである
- Windows で失敗しているテストを直すこと。進行中の PR #19・#20・#22（Issue #5 の change A・B・C）が扱う。B と重なる部分の扱いは Q-05 で決める

## Impact
- 影響する capability：monorepo（REQ-049・REQ-214 を MODIFIED、REQ-270・REQ-271 を ADDED）
- 影響するファイル：`.github/workflows/ci.yml`、文書だけかを判定するスクリプト（`scripts/` に足す）、`tests/monorepo.test.ts`、`packages/runner/test/` の時間を待つテスト（run・external-budget・publication-retry・guards など）と `helpers.ts`、`packages/kit/test/` の同じ種類のテスト
- 既存のテストの期待値を変える：`tests/monorepo.test.ts` の `[REQ-049]` と `[REQ-214]`（A）、runner と kit の時間を待つテスト（B）。AGENTS.md 4 章により、変える前に Q-04 で人の承認を得る
- 利用者に見える変更：なし（配布するパッケージは変えない。空の changeset を足す）
- 要件 ID：REQ-270・REQ-271 を使う。main と開いている PR の最大は REQ-260（PR #26）で、PR #22 は REQ-250〜254 を使っている
