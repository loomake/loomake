## 1. 確認事項の反映
- [ ] 1.1 確認事項 Q-01〜Q-04 の回答を trace.md に書く。回答が差分仕様のおすすめと違うときは、差分仕様と tasks.md を回答に合わせて直す（REQ-046, REQ-047, REQ-260）

## 2. 文書
- [ ] 2.1 AGENTS.md の「プロジェクト固有の情報」のコーディング規約を、core の外部の実行時依存は `zod` だけ、kit の実行時依存は core と `yaml` だけ、に改める。trace・runner・loomake の記述は変えない（REQ-046, REQ-047）
- [ ] 2.2 CONTRIBUTING.md の「コードの境界」の依存の記述を、2.1 と同じ内容に改める（REQ-046, REQ-047）
- [ ] 2.3 `docs/adr/0003-zod-as-core-runtime-dependency.md` の「状態」の括弧書き（「仕様への反映は別の change で行う。それまでは…が有効」）を、この change で仕様に反映したことが分かる文に改める（REQ-046, REQ-047）

## 3. テスト
- [ ] 3.1 Q-01 の承認を得たあとで、`packages/core/test/package.test.ts` の `[REQ-046]` のテストの名前と期待値を、Scenario「zod 以外の依存がない」に合わせる（REQ-046）
- [ ] 3.2 Q-01 の承認を得たあとで、`packages/cli/test/cli.test.ts` の kit の `[REQ-047]` のテストの名前と期待値を、Scenario「kit の依存」に合わせる。loomake の `[REQ-047]` のテストは変えない（REQ-047）
- [ ] 3.3 `pnpm -s lint`・`pnpm -s typecheck`・`pnpm -s test` を通す

## 4. 確認
- [ ] 4.1 `pnpm -s verify --change allow-zod-and-yaml-runtime-deps --done` を通す <!-- loomake:gate=done -->
