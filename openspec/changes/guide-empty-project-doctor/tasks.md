## 実装と検証

- [x] 1.1 採用設計の REQ-184・REQ-024 を MODIFIED だけで change にし、`openspec validate guide-empty-project-doctor --strict` と `pnpm -s verify --change guide-empty-project-doctor --spec-only` を通す（REQ-184・REQ-024）。
- [x] 2.1 親リポジトリ外で npm が PATH にある環境の R-01〜R-03 を実施し、全出力・終了コード・which・config と H-01・C-01 の結果を記録する（REQ-184・REQ-024）。
- [x] 3.1 #285 のマージを確認し、AC-01・AC-02 を RED → GREEN で実装する。package.json の不在、該当する commands と scripts の名前、問題 1 件、2 つの直し方、終了コード 1、不正な package.json の既存案内を検証する（REQ-184）。
- [x] 4.1 AC-03 を RED → GREEN で実装し、doctor が問題を出すことの追記、npm の既定値と package.json がある場合の既存挙動を検証する（REQ-024）。
- [x] 5.1 固定した PATH のフィクスチャで AC-04 の init → doctor を RED → GREEN で検証し、問題が 2 件だけで終了コード 1 になることを確かめる。AC-05 の既存テストも維持する（REQ-024・REQ-184）。
- [ ] 7.1 docs/worklog と、#285 で作成される `docs/dev/workflow-trial-2026-11.md` の集計表を同じ PR で更新し、版 1 との設計担当の違い、各工程の実測・未実施を記録する（REQ-184・REQ-024）。
- [ ] 6.1 `pnpm -s lint`・`pnpm -s typecheck`・`pnpm -s test` と要件 ID 付きテストの対応を確認する（REQ-184・REQ-024）。
- [ ] 6.2 `pnpm -s verify --change guide-empty-project-doctor --done --scope local` を通す（REQ-184・REQ-024）。 <!-- loomake:gate=done -->

6.2 はローカルの完了。最終の合格には同じ head の CI の `verify --done --scope ci`（判定 PASS・要判断なし）と必須 CI・3 OS 試験の成功、新しい Opus セッションの独立レビューが別に必要である。実装は #285 のマージ後に始め、独立レビューは必須 CI の成功後に行う。マージの直前には利用者の確認を取り、マージ後に項目 1 の完了と項目 2 以降が残ることを Issue #282 にコメントし、Issue は閉じない。
