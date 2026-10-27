## 1. 確認事項の反映
- [ ] 1.1 確認事項 Q-01〜Q-08 の回答を trace.md に書く。回答が差分仕様のおすすめと違うときは、差分仕様・proposal.md・tasks.md を回答に合わせて直す（REQ-049, REQ-214, REQ-270, REQ-271）
- [ ] 1.2 Q-05 の回答に従い、PR #19・#20・#22 と B の作業の順を決め、必要なら main を取り込む（REQ-271）

## 2. 文書だけの PR（案 A）
- [ ] 2.1 変えたファイルが文書だけかを判定するスクリプトを `scripts/` に足し、Scenario「文書だけの PR」「コードを含む PR」「配布する Markdown を含む PR」「変えたファイルを調べられない」のテストを書く（REQ-270）
- [ ] 2.2 Q-04 の承認を得たあとで、`tests/monorepo.test.ts` の `[REQ-049]` と `[REQ-214]` の期待値を、判定のステップと条件つきのステップを含む ci.yml に合わせる。シャードとカバレッジの検査は弱めない（REQ-049, REQ-214）
- [ ] 2.3 `tests/monorepo.test.ts` に、Scenario「判定をジョブの中で行う」「main への push」のテストを足す（REQ-270）
- [ ] 2.4 `.github/workflows/ci.yml` の quality ジョブに判定のステップを足し、lint・typecheck・test・build・配布物の検査のステップを、判定が「文書だけ」でないときだけ実行する（REQ-270）

## 3. 時間を確かめるテスト（案 B）
- [ ] 3.1 Q-04 の承認を得たあとで、`packages/runner/test/` の固定の待ち（`helpers.ts` の `sleepMs`、run・external-budget・publication-retry・guards などのテスト）を、偽のエンジンや偽の CLI が残す合図で進む形に変える。確かめる内容は減らさない（REQ-271）
- [ ] 3.2 Q-04 の承認を得たあとで、`packages/kit/test/` と `tests/` の同じ種類の待ちを、3.1 と同じ形に変える（REQ-271）
- [ ] 3.3 Scenario「長い固定の待ちを使う場所」を確かめるテストを書く（REQ-271）
- [ ] 3.4 変える前と後の時間を、手元（vitest 全体と runner の 4 ファイル）と CI（OS ごとの quality ジョブ）で測り、作業記録に書く（REQ-271）

## 4. 確認
- [ ] 4.1 `pnpm -s lint`・`pnpm -s typecheck`・`pnpm -s test` を通す
- [ ] 4.2 `pnpm -s verify --change shorten-ci-wall-clock --done` を通す <!-- loomake:gate=done -->
