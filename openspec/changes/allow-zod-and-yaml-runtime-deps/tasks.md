## 1. 確認事項の反映
- [x] 1.1 確認事項 Q-01〜Q-04 の回答を trace.md に書く。回答が差分仕様のおすすめと違うときは、差分仕様と tasks.md を回答に合わせて直す（REQ-046, REQ-047, REQ-260）。Q-01 は人の承認を待つ。Q-02〜Q-04 は AI の技術レビューの回答を書いた（2026-10-27）

## 2. 文書
- [x] 2.1 AGENTS.md の「プロジェクト固有の情報」のコーディング規約を、core の外部の実行時依存は `zod` だけ、kit の実行時依存は core と `yaml` だけ、に改める。trace・runner・loomake の記述は変えない（REQ-046, REQ-047）
- [x] 2.2 CONTRIBUTING.md の「コードの境界」の依存の記述を、2.1 と同じ内容に改める（REQ-046, REQ-047）
- [x] 2.3 `docs/adr/0003-zod-as-core-runtime-dependency.md` の「状態」の括弧書き（「仕様への反映は別の change で行う。それまでは…が有効」）を、この change で仕様に反映したことが分かる文に改める（REQ-046, REQ-047）
- [x] 2.4 CONTRIBUTING.md の「コードの境界」に、実行時の依存を増やすときは、標準機能で足りないこと、自作よりコードと保守が減ること、実行経路に必要なことの 3 点を文書に書く、という手順を足す。REQ-260 は範囲外なので、仕様とテストは足さない（Q-04 の回答 B、REQ-260）

## 3. テスト
- [x] 3.1 Q-01 の承認を得たあとで、`packages/core/test/package.test.ts` の `[REQ-046]` のテストの名前と期待値を、Scenario「zod 以外の依存がない」に合わせる（REQ-046）
- [x] 3.2 Q-01 の承認を得たあとで、`packages/cli/test/cli.test.ts` の kit の `[REQ-047]` のテストの名前と期待値を、Scenario「kit の依存」に合わせる。loomake の `[REQ-047]` のテストは変えない（REQ-047）
- [ ] 3.3 `pnpm -s lint`・`pnpm -s typecheck`・`pnpm -s test` を通す

## 4. 品質レビューの記録
- [ ] 4.1 3.1・3.2 のあとで、差分仕様の Scenario 3 件（core-parsers の「core の実行時依存の範囲 / zod 以外の依存がない」、verify の「実行時依存の範囲 / kit の依存」と「loomake の依存」）について、変えたテストを読み直してから、`docs/quality/scenarios.json` に change 側の ID でレビューを足す。今の仕様に対するレビュー（SCN-f9797c510a56149bfd76、SCN-129c1a409ad4cdd46ce6、SCN-38961b7ee7aa96aad6f6）のハッシュだけを書き換えることはしない。`node scripts/scenario-audit.mjs` で、3 件の状態を確かめる（REQ-046, REQ-047）
- [ ] 4.2 archive する PR への申し送りを、proposal.md の Impact に書く。内容は次の 2 点。1 つ目は、core-parsers の「実行時依存ゼロ / dependencies が空」のレビュー（SCN-f9797c510a56149bfd76）を消し、4.1 のレビューの ID を archive 後の ID に付け替えること（前例：コミット cc5df0f）。2 つ目は、verify の 2 件は archive 後も ID が変わらないので、今の仕様に対するレビューを消して、change 側のレビューを残すこと（REQ-046, REQ-047）

## 5. 確認
- [ ] 5.1 `pnpm -s verify --change allow-zod-and-yaml-runtime-deps --done` を通す <!-- loomake:gate=done -->
