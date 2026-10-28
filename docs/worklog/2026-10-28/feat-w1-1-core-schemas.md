# 2026-10-28 の作業記録（feat/w1-1-core-schemas）

## W1-1 の最初の部分：verify 結果を Zod に移す（19:00〜）

- やったこと：change core-zod-verify-result のタスク 1.1〜3.2（Issue #60、WBS の W1-1）。W1-1 は範囲が広いので change を分け、この change では verify 結果と、JSON Schema を書き出す処理だけを扱った。`@loomake/core` の `dependencies` に `zod`（^4.6.7）を足した。verify 結果を Zod スキーマ（`verifyResultSchema` など）で定義し、`VerifyResult`・`VerifyCheckResult`・`VerifyMode` の型をスキーマから導出して、手書きの型を消した（REQ-274）。未知のフィールドは拒否せず、解析結果にそのまま残す（REQ-275）。`packages/core/schema/verify-result.schema.json` は `z.toJSONSchema()` で書き出したものに置き換え、`pnpm --filter @loomake/core schema:write` で作り直せるようにした。ファイルと書き出した内容が違うと、core のテストが失敗する（REQ-276）。
- 合わせて直したもの：core のソースを複製して動かす `scripts/schema-contract-check.mjs`・`scripts/domain-mutations.mjs`・`packages/runner/test/guards-special-files.test.ts` が、core の `node_modules` から `zod` を読めるようにした。`scripts/package-smoke.mjs` の準備では、外部の実行時依存を `npm cache add` で cache に入れてから、オフラインで入れるようにした。`tests/package-artifacts.test.ts` で公開型を壊す箇所は、宣言が Zod の型になったので `ok: boolean` から `ok: z.ZodBoolean` に替えた。壊したときに利用側のコンパイルが失敗することを確かめる点は変えていない。
- verify の結果：`pnpm -s verify --change core-zod-verify-result --spec-only` と `--done` は合格（exit 0）。仮定 A-01・A-02 が未承認なので、警告が 1 件出る。lint・typecheck・test（1090 件が通り、8 件は skip）も通った。1 回目の `--done` では、verify の中で動くテストのうち、性能の試験（REQ-050、3 秒以内）が 3.38 秒で落ちた。単独で 3 回動かすと通り、2 回目の `--done` も通った。
- 気づいたこと：この環境では `import('zod')` に約 300ms かかり、CLI の起動（`--version`）の中央値は約 430ms だった。REQ-050 の性能の試験は、余裕が少なくなっている。
- 残っている確認事項・仮定：Q-01（要件 ID の振り方）、Q-02（quality-report の項目が要件定義で決まっていない）、Q-03（trace.md・spec・tasks の `version` をどこに持つか）。どれもこの change ではブロッキングにしていないが、Q-02 と Q-03 は後続の change ではブロッキングになる。A-01（JSON Schema で未知のフィールドを許し、版は 1.0.0 のまま）、A-02（書き出しの検査は新しい CI の手順を足さず、テストで行う）は承認待ち。
- 次にやること：PR の CI を確かめる。W1-1 の残り（quality.yaml のスキーマ、trace.md・spec・tasks のスキーマと版、quality-report のスキーマ、証跡とレポートの版の移行）を、後続の change で進める。

## PR #113 の Windows の CI への対応

- やったこと：Windows の quality ジョブで落ちた 4 件を直した（core-zod-verify-result 2.3 の追従）。(1) checkout で改行が CRLF になり、書き出した JSON Schema との比較が合わなかったので、改行をそろえて比べるようにした。(2) 複製したソースから `zod` を読めなかったので、`scripts/package-smoke.mjs` に `linkRuntimeDependencies` を足した。`node_modules` 全体ではなく、`zod` の実体を指すリンクを作る。スキーマ契約の検査、ドメインテストを壊す検査、書き出しのコマンドの試験で使う。
- verify の結果：lint・typecheck と、変えた試験（78 件）がローカルで通った。Windows での結果は CI で確かめる。
