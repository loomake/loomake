# W0-6・W0-7 を進め、C-001 の前提を決める

## Why

WBS（`docs/wbs.md` v1.3.1）の W0-6（版管理の方式と `0.x` の互換性の方針）と W0-7（開発効率の手書きの記録様式と、C-001 の事前見積もり）が未着手である。W0-7 は C-001 の着手前に終える必要がある（WBS 4 章の W0-7 の完了条件、5 章）。

C-001 を始める前に、決まっていないことが 2 つある。1 つは core の契約を Zod で書くかどうかである。WBS の W1-1 と要件定義 v0.11.1 の NFR-01・NFR-02 は Zod を前提にしている。一方、いまの仕様（REQ-046）は `@loomake/core` の実行時依存をゼロと定めている。もう 1 つは技術スタックである。要件定義 8 章・アーキテクチャ 6 章・WBS の W0-2・`docs/overview.md` は npm workspaces・`node:test`・Biome と書いているが、リポジトリは pnpm・Vitest・ESLint で動いている。

どちらも利用者が判断することなので、この change では決めない。確認事項として選択肢とおすすめを示し、仕様ゲートで止める。

## What Changes

- W0-6：版管理の方式と `0.x` の互換性の方針を ADR に残し、CONTRIBUTING.md に書く
- W0-7：開発効率の手書きの記録様式を作り、C-001 の事前見積もりを着手前に記録する
- C-001 の前提（core の実行時依存、技術スタック）の決定を ADR に残す
- 決定に合わせて、WBS・`docs/overview.md`・アーキテクチャ・要件定義の記述をそろえる

## Capabilities

### New Capabilities

- `development-decisions`：Loomake 自身の開発で決めたこと（版管理と互換性の方針、設計判断の ADR、開発効率の手書きの記録）の置き場と書き方。

### Modified Capabilities

なし。

## Non-goals

- REQ-046（core の実行時依存ゼロ）を変えること。Q-01 の回答で変更が必要になったら、別の change で行う
- 技術スタックを実際に移すこと。Q-02 で文書のとおりに移すと決まったら、別の change で行う
- 開発効率の集計と `trace record --effort`（REQ-235。W1-9 で実装する）
- 互換性の方針の運用（W6-5）と npm 公開（W6-1）

## Impact

- 文書：CONTRIBUTING.md、ADR（置き場はタスク 1.1 で決める）、`docs/wbs.md`、`docs/overview.md`、`docs/architecture.md`、`docs/requirements/loomake-v0.11.md`
- コード：配布するパッケージは変えない。差分仕様を確かめるテストを `tests/` に足す
- 差分仕様について：CONTRIBUTING.md には「文書だけの修正で新しい製品の振る舞いがない場合は、そのためだけに製品の Requirement を作らない」とある。一方、verify は `specs/` のない change を失敗にする（`packages/kit/src/verify/run.ts` の「差分仕様」の検査）。archive 済みの change 63 件にも、`specs/` のないものはない。この change の Requirement は、`monorepo` の「MIT ライセンス」や「changesets による公開準備」と同じく、製品の振る舞いではなくリポジトリの決まりとして書いた
