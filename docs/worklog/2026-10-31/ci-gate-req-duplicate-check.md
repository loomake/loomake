# gate に REQ ID の重複検査を足す

1. やったこと：`scripts/req-duplicate-check.mjs` を足し、gate がどの段階でも呼ぶようにした（quality-speed-plan の A4）。主仕様に進行中の change の差分仕様を当てた後で Source の REQ ID を集めるので、同じ Requirement の MODIFIED は重複に数えない。
2. verify の結果：change のない L2 なので、`pnpm lint`・`pnpm typecheck`・`pnpm test` を流して通った。重複あり・なし・MODIFIED などの回帰試験を `tests/req-duplicate-check.test.ts` と `tests/ci-gate-process.test.ts` に足した。
3. 残っている確認事項・仮定：main には 22 件の重複があり、意図した共有と番号の衝突が混ざっていた。仕様は直さずに `scripts/req-duplicate-known.json` に既知として記録し、Issue #213 に見直しを頼んだ。一覧にない新しい重複だけが失敗する。
4. 次にやること：Issue #213 で衝突と共有を分け、衝突は別の change で振り直して一覧から消す。
