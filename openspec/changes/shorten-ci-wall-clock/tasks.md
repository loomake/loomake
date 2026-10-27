## 1. 確認事項の反映
- [x] 1.1 確認事項 Q-01〜Q-08 の回答を trace.md に書き、差分仕様・proposal.md・tasks.md を回答に合わせて直す。案 B（REQ-271）は別の change に分け、申し送りを proposal.md に書く（REQ-049, REQ-214, REQ-270, REQ-271）

## 2. 文書だけの PR（案 A）
- [x] 2.1 変えたファイルが文書だけかを判定するスクリプトを `scripts/` に足す。PR のベースとの差分を、名前の変更を含めて読む（REQ-270）
- [x] 2.2 2.1 のスクリプトのテストを書く。Scenario「文書だけの PR」「コードを含む PR」「配布する Markdown を含む PR」「設定と実行用のファイルを含む PR」「試験用データを含む PR」「文書の置き場所にある設定と実行用のファイル」「前のコミットでコードを変えた PR」「名前を変えたファイル」「差分を取れない、または解釈できない」を確かめる（REQ-270）
- [x] 2.3 Q-04 で承認された範囲で、`tests/monorepo.test.ts` の `[REQ-049]` と `[REQ-214]` の期待値を、判定のステップと条件つきのステップを含む ci.yml に合わせる。シャードとカバレッジの検査は弱めない（REQ-049, REQ-214）
- [x] 2.4 `tests/monorepo.test.ts` に、Scenario「判定をジョブの中で行う」「main への push」のテストを足す（REQ-270）
- [x] 2.5 `.github/workflows/ci.yml` の quality ジョブに判定のステップを足し、lint・typecheck・test・build・配布物の検査のステップを、判定が「文書だけ」でないときだけ実行する（REQ-270）
- [x] 2.6 2.2〜2.4 の試験を読み直してから、差分仕様の Scenario 14 件について、`docs/quality/scenarios.json` に change 側の ID でレビューを足す。`node scripts/scenario-audit.mjs` で 14 件が reviewed になることを確かめる。archive する PR への申し送りを proposal.md の Impact に書く（REQ-049, REQ-214, REQ-270）

## 3. 確認
- [x] 3.1 `pnpm -s lint`・`pnpm -s typecheck`・`pnpm -s test` を通す
- [x] 3.2 この PR の CI で、quality ジョブがすべてのステップを実行したこと（この PR はコードを変えるため）と、判定のステップの出力を確かめ、作業記録に書く（REQ-270）
- [x] 3.3 `pnpm -s verify --change shorten-ci-wall-clock --done` を通す <!-- loomake:gate=done -->
