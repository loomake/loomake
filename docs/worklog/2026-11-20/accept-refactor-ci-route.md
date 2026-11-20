# accept-refactor-ci-route（gate にリファクタの経路を足す）

1. **やったこと**：change accept-refactor-ci-route を作り、REQ-477（リファクタの経路）を足して REQ-343 を変更した。tasks 1.1〜3.3 を終えた。`scripts/ci-refactor.mjs` で 4 条件を判定する。条件は、宣言がすべて `refactor` であること、`openspec/` を変えないこと、既存のテストファイル（`tests/`・`packages/*/test/` の下と `vitest.config.ts`）を変更・削除・改名しないこと、`## 証跡` に `review: 実施済み` の行があることの 4 つ。`scripts/ci-gate.mjs` の L3 の分岐にこの判定をつなぎ、`docs/dev/ci.md`・`AGENTS.md`・PR テンプレート・delivery スキルに書き方を足した。AGENTS.md には関数の書き方の規則（c319a490 の内容）も入れた。利用者の承認は 2026-11-20 の 3 条件による。
2. **verify**：仕様ゲート（`--spec-only`）は通過した。gate 関連の 4 ファイル（ci-gate-process・ci-spec-fix・ci-refactor・ci-gate-contract）の 188 件、文書リンクの試験 47 件、lint、typecheck、REQ 重複検査はすべて成功した。全試験は 3,964 件のうち 3,954 件が成功、2 件が失敗、8 件が既存の保留だった。失敗した 2 件は今回触っていない packages/cli（REQ-050、3 秒以内の性能）と packages/runner（REQ-182、フックの期限）の時間の試験で、開発機の過負荷（load 40〜50）による時間切れと見ている。管理役の指示で全体の再実行と `verify --done` は止め、全体の確認は CI に任せる。その後、負荷が下がってから完了ゲートを 1 回実行した。不合格は tasks.md の未チェック（4.1・4.2）と、packages/kit/test/verify-archive.test.ts の 5 件の時間切れ（5 秒）だけだった。verify-archive.test.ts を単独で回すと 27 件すべて成功した。PR #471 の CI の gate でも、tasks.md 以外の項目（lint・typecheck・全試験・要件ごとのテスト）はすべて PASS だったので、4.1・4.2 をチェックし、CI の gate で完了ゲートを確かめる。
3. **確認事項・仮定**：trace.md に非ブロッキングの確認事項を 3 つ置いた。Q-01 はテストファイルの範囲、Q-02 は独立レビューの証跡を `review: 実施済み` の行だけで判定し、重大ゼロ・担当の独立・head の一致は管理役が確かめること、Q-03 は経路を L3 かつ `loomake-change: none` のときだけ評価すること。仮定はない。
4. **次にやること**：push と PR の作成（GitHub の認証が切れていれば利用者の再ログインを待つ）。CI の成功を確かめ、管理役の順番で `verify --done` を通して 4.1・4.2 をチェックする。PR #469 がこの経路を使うには、既存のテストファイルに足した試験を新しいテストファイルへ移し、本文に `loomake-change: none` と `loomake-route: refactor`、`## 証跡` に `review: 実施済み` の行を書き、AGENTS.md の変更を外す。

## PR #471 のレビューへの対応

1. **やったこと**：Claude Opus 5.5 の独立レビュー（1 回目、HEAD cdbb2f92）で、重大 1・軽微 2・参考の指摘を受けた。tasks 5.1〜5.5 で次のように直した。
   - S-1（重大）：既存のファイルの判定を、禁止リストから許可リストに変えた。変更は `packages/*/src/` と `docs/` の下だけ、削除は `packages/*/src/` の下だけ、改名は前後とも範囲の下のときだけ認める。追加は `openspec/` の下を除いてどこでもよい。`scripts/lib/test-partition.mjs`・`package.json`・`loomake.config.json`・`.github/workflows/ci.yml` の変更と、範囲の外での削除・改名を拒む試験を足した。仕様は 2e7b8a00、RED の試験は bd0fe50d、実装は be1e517d。
   - M-1（軽微）：足したパスが HEAD のツリーの別のパスと大文字小文字だけ違えば拒む。判定には `scripts/ci-tier.mjs` の `caseTwins`（REQ-281）を使い、ツリーを読めなければ拒む。コミットは S-1 と同じ。
   - M-2（軽微）：tasks 4.2 を「PR の scope ci の完了ゲートを通す」に直した（2e7b8a00）。4.2 の根拠は、cdbb2f92 での CI の gate の成功（https://github.com/loomake/loomake/actions/runs/44708002769）。手元の完了ゲートで出た verify-archive.test.ts の 5 件の時間切れは、開発機の過負荷によるもので、このファイルだけを回すと 27 件すべて通る。
   - 参考：`ci-refactor.mjs` の長い行を名前を付けた小さな関数に分けた（7ad5042e、振る舞いは変えない）。`docs/dev/ci.md` には、試験を弱める変更を L2 の PR に分ける抜け道は機械では防げず、独立レビューで確かめることを書いた。`AGENTS.md` には、整理の前に振る舞いを固定するテストは書いた時点で通ってよいことを書いた。catch の文言「主仕様を読めませんでした」は、仕様に文言の定めがないのでそのままにした。
2. **verify**：仕様ゲート（`--spec-only`）は通過した。`tests/ci-refactor.test.ts` と `tests/ci-gate-process.test.ts` の 187 件と、変えたファイルの lint が通った。管理役の指示で、手元の完了ゲートと全試験は実行していない。
3. **確認事項・仮定**：trace.md の Q-01 を、許可リストか禁止リストかの選択に書き直した（おすすめは許可リスト、非ブロッキング）。PR #469 の差分は、足した試験を新しいテストファイルへ移し、AGENTS.md の変更を外せば、`packages/core/src/` の変更と追加だけになるので、この条件を通る。
4. **次にやること**：push して CI を確かめ、PR 本文の証跡の head を更新する。そのあと再レビューを待つ。

## PR #471 の再レビューへの対応

1. **やったこと**：Claude Opus 5.5 の再レビュー（2 回目、HEAD 87ec219c）で、重大 0・軽微 2・情報の指摘を受けた。品質を優先して、tasks 6.1〜6.5 で次のように直した。
   - 軽微-1：追加をどこでも認めていたため、入れ子の設定ファイル（例：`packages/kit/src/eslint.config.js`）を足すと root の lint の違反が通った。追加と改名の先を `packages/*/src/`・`packages/*/test/`・`tests/`・`docs/`・`.changeset/` の下に絞った。さらに、設定ファイルの基本名（`eslint.config.*`・`vitest.config.*`・`vite.config.*`・`vitest.workspace.*`・`tsconfig*.json`・`package.json`・`.npmrc`・`.pnpmfile.cjs`・`.gitattributes`）と、途中に `node_modules/` を含むパスは、場所を問わず拒む。
   - 軽微-2：`docs/guide/3.reference/` の下は、試験が照合する正本なので、変更も追加も拒む。
   - 情報-1：改名の元を、削除してよい範囲（`packages/*/src/`）に限った。`docs/` から外への改名で文書を実質消せなくなる。
   - 情報-3：HEAD のツリーを読めないときは、git の失敗の詳細か、一覧が NUL で終わっていないことを理由に添える。gate からは `headTree` の代わりに `headTreeResult` を渡す。
   - コミットは、仕様 4ff5794b、RED の試験 072a0b06、実装 2cc82dd7、整理 f9f2bd84。
   - 仕様が変わって期待が変わった試験は、この PR で足した試験のうち 1 件だけ。`docs/a.md` を `docs/b/a.md` に改名する差分は、以前は受け付けていたが、今は拒む側の表に移した。
2. **verify**：仕様ゲート（`--spec-only`）は通過した。`tests/ci-refactor.test.ts` と `tests/ci-gate-process.test.ts` の 234 件と、変えたファイルの lint が通った。管理役の指示で、手元の完了ゲートと全試験は実行していない。
3. **確認事項・仮定**：trace.md の Q-01 の案 A を、追加の範囲と除外を含む形に書き直した。設定ファイルの除外は、変更・削除・改名にも当てる（指示は追加についてだったが、範囲の中の設定ファイルを書き換える抜け道もふさぐため）。ツリーを読めないときの子プロセスの試験は、git の失敗を作りにくいので単体の試験だけで確かめている。
4. **次にやること**：push して CI を確かめ、PR 本文の証跡の head を更新する。そのあと 3 回目の再レビューを待つ。
