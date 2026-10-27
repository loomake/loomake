# shorten-ci-wall-clock

## Why
change speed-up-ci（REQ-214・REQ-215）のあとも、PR の CI が終わるまでに 7〜9 分かかる。作業記録だけを変える PR のような、文書だけの PR でも 8 分以上の CI が走っている。この change では、文書だけの PR で quality ジョブを飛ばす（案 A）。

### 測った時間（2026-10-27）
- CI の run 40439394065（main）と 40439267528：ubuntu の `pnpm test --coverage` が 2.5〜3.3 分（ジョブは 3〜4 分）、macOS のシャードが 2〜6 分（ジョブは 2.5〜7 分）、Windows のシャードが 5.5〜8 分（ジョブは 7〜9 分）。全体の時間を決めているのは Windows のシャードである。gate ジョブは `scripts/ci-gate.mjs` から `verify` を実行し、lint・typecheck・test をもう一度実行するので 3.5 分かかる。クリティカルパスではないが、実行分を使う。checkout から typecheck までは約 1 分で、問題ではない
- 手元（8 コア）：vitest は 53 秒で 1007 件。ファイルごとの時間の合計 315 秒のうち 168 秒を、runner の 4 ファイルが占める（run 53 秒・external-budget 46 秒・publication-retry 42 秒・guards 29 秒）。external-budget の 1 件だけで 13 秒かかる

### 試験ごとの失敗
main の run 40439394065 では、Windows の quality ジョブで 22 件の試験が失敗した（1/2 のシャードが 13 件、2/2 のシャードが 9 件）。失敗には、配布物と AI 操作の試験での build の失敗、CRLF を含む YAML と正規表現の不一致（5 件）、壊れたフックの失敗、期限や時間に関わる試験（external-budget・process など）の失敗が含まれる（PR #31 の 2026-10-27 12:19 の技術レビュー）。

### 原因の推定
時間がかかるのは、テストが実時間を待つこと（偽のエンジンの `sleepMs: 3000`、偽の OpenSpec CLI の `setTimeout(…,3000)`、`timeoutMinutes: 0.1`（Windows では 0.3）、20 秒の予算など）と、git と node の子プロセスを多く起動すること（Windows では起動が遅い）によると推定している。Windows の失敗の原因は試験ごとに違い、すべてを実時間の待ちと同じ原因とはみなせない。時間を縮める作業は、案 B として別の change で扱う。

## What Changes
- PR で変えたファイルがすべて文書なら、quality ジョブは lint・typecheck・test・build・配布物の検査を実行せずに成功する（REQ-270、ADDED）。文書として扱うファイルは、差分仕様に列挙したもの（通常の文書・change の成果物・changeset の本文）だけとする。設定・実行用のファイル・`tests/fixtures/` の下・`packages/` の下は、quality の対象に残す
- 判定には PR のベースからの差分をすべて使い、名前の変更（rename）では変更前のパスも判定する。差分を取れなかったときと、解釈できなかったときは飛ばさない
- 判定はジョブの中のステップで行い、ワークフローの `paths` フィルタやジョブの `if` は使わない。飛ばした PR でも、必須チェックのジョブが同じ名前で成功を報告するようにするためである。main への push では飛ばさない
- 「3 つの OS での CI」（REQ-049）と「CI のテストの分割」（REQ-214）に、この例外を書き足す（MODIFIED）
- 既存のテスト `tests/monorepo.test.ts` の `[REQ-049]` と `[REQ-214]` の期待値を、判定のステップを足した ci.yml に合わせる。シャードとカバレッジの検査は弱めない。利用者本人が Q-04 で承認した（2026-10-27 13:25）。実装では `[REQ-214]` だけを変え、`[REQ-049]` は変える必要がなかった

## Non-goals
- 案 B（時間を確かめるテストを、固定の待ちではなく合図で進む形に変える）。PR #19・#20・#22 が main に入ってから、別の change・別の PR で出す（Q-03・Q-05）。その change のテストの変更は、そこで改めて人の承認を得る。申し送りは下の「次の change への申し送り」にある
- 案 C（Windows で Dev Drive を使う）、案 D（macOS と Windows のシャードを 2 から 3〜4 に増やす）、案 E（gate でテストを二重に実行しない）（Q-06〜Q-08）
- node20・node22・gate のジョブを、文書だけの PR で飛ばすこと
- Windows で失敗しているテストを直すこと。PR #19・#20・#22（Issue #5 の change A・B・C）が扱う

## 次の change への申し送り（案 B）
- 期限で止まることを確かめる試験では、次の 4 点を保つ
  - 1 つの操作の期限と、共有の期限を区別すること
  - 準備にかかった時間を期限に含めること
  - 期限が切れたら、子孫のプロセスまで止めること
  - 期限が切れたあとは、次の操作を始めないこと
- 「1000 ms を超える待ちを禁止する」こと自体を目的にしない。本当に期限が切れる経路を通る試験は残す。終了コードや記録の検査が同じでも、実際の期限切れを通らなくなると、検査の意味が弱まる
- PR #30（probe/req173-windows-timing）の Windows の計測は、通常の CI の 2 つのシャードとは並行の条件が違う（PR #20 へのコメント 6432637977）。時間の比較に使うときは、条件をそろえる

## Impact
- 影響する capability：monorepo（REQ-049・REQ-214 を MODIFIED、REQ-270 を ADDED）
- 影響するファイル：`.github/workflows/ci.yml`、文書だけかを判定するスクリプト（`scripts/` に足す）、`tests/monorepo.test.ts`
- 利用者に見える変更：なし（配布するパッケージは変えない。空の changeset を足す）
- 品質レビューの記録：`docs/quality/scenarios.json` に、差分仕様の Scenario 14 件のレビューを change 側の ID で足した。archive する PR では、次の 2 つを行う（前例：コミット cc5df0f）。1 つ目は、14 件のレビューの ID を archive 後の ID（`openspec/specs/monorepo/spec.md` の Scenario の ID）に付け替えること。2 つ目は、REQ-049 と REQ-214 の今の仕様に対するレビューを、付け替えたレビューで置き換えること。なお、`tests/monorepo.test.ts` を参照する今の仕様のレビュー 18 件は、main の時点ですでに試験のソースのハッシュが合わず無効になっている（この change の前から）。この change では書き換えていない
- 要件 ID：REQ-270 を使う。REQ-271 は案 B のために取ってあり、この change では範囲外とする。main と開いている PR の最大は REQ-260（PR #26）で、PR #22 は REQ-250〜254 を使っている
