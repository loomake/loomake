# fix-windows-test-assumptions

## Why

CI の quality (windows-latest) のジョブで、既存のテストが落ち続けている（Issue #5）。main f535fd2 の run 40230837026 の失敗 22 件と、run によって通ったり落ちたりする 4 件を調べたところ、原因は 6 つに分かれた。そのうち次の 4 つは、製品ではなくテストの前提の問題である。

- ① ワークフローの YAML が Windows では CRLF で取り出され、`\n` を直接書いた正規表現に合わない（release-security.test.ts の 5 件）
- ② リンク先のないフックを、Linux の git は無視するが、Git for Windows は実行しようとする（guards.test.ts の REQ-204）
- ③ 配布物の試験のスクリプトがコマンド名を `"pnpm"` `"npm"` と引用符で囲み、シェルから起動する（ai-journeys の 2 件、package-artifacts の 3 件）
- ⑤ Windows では run の準備が遅く、`vi.waitFor` の既定の待ち時間（1 秒）に収まらない（run.test.ts の REQ-158）

④の偽の CLI と⑥の監視役の強制終了は、別の change で直す。

## What Changes

- tests/release-security.test.ts で、読んだワークフローの改行を LF にそろえる。前例は tests/monorepo.test.ts の `readLf`。`.gitattributes` は入れない
- packages/runner/test/guards.test.ts の REQ-204 のテストで、リンク先のないシンボリックリンクを、git がフックとして実行しない名前で `.git/hooks` に置く。リンクを作ることと、完了の検査は残す
- scripts/package-smoke.mjs と scripts/ai-journeys.mjs で、固定の裸のコマンド名 `pnpm` と `npm` だけを引用符で囲まずに起動する。空白を含む実行パスと引数は、今までどおり囲む
- packages/runner/test/run.test.ts の REQ-158 のテストで、`vi.waitFor` の待ち時間を明示する。二重起動と、中断後のロックの解放の検査は残す
- この 4 つの前提を、monorepo の新しい Requirement「OS によらないテストの前提」（REQ-236）に書く。直したテストの名前に [REQ-236] を足す

どの直しでも、期待値は変えず、skip せず、Windows だけを対象から外すこともしない。

## Non-goals

- ④ 偽の git・gh・openspec を Windows でも動くようにすること（change B）
- ⑤のうち、external-budget.test.ts の「準備で使った時間を含めてエンジンの期限を制限する」。偽の CLI の到達の検査と一緒に直すほうがよいので change B に回す
- ⑥ 監視役が結果を書かずに強制終了したときの製品の振る舞い（change C）
- Windows の quality のすべてのステップを成功させること（Issue #5 を閉じる条件は、3 つの change がそろってから満たす）

## Capabilities

### New Capabilities

なし。

### Modified Capabilities

- `monorepo`: Requirement「OS によらないテストの前提」を足す。

## Impact

- 影響するコード：tests/release-security.test.ts、packages/runner/test/guards.test.ts、packages/runner/test/run.test.ts、scripts/package-smoke.mjs、scripts/ai-journeys.mjs、tests/package-artifacts.test.ts と tests/ai-journeys.test.ts（テストの名前だけ）
- 配布するパッケージ・公開 API・設定は変えない。利用者に見える変更はない
