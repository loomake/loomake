# Proposal

## Why

`findProducer` は検証ルートからファイルシステムの最上位まで `node_modules` を探すため、Git 作業ツリーの外にあるテストランナーと版を証拠へ採用し得る。Issue #238 で指摘された探索境界を閉じ、作業領域の親に偶然ある依存によって品質判定が変わることを防ぐ。

## What Changes

- 探索位置を、検証ルートからそのルートを含む Git 作業ツリーの最上位までに限定する。最上位を確かめられない場合やルートを含まない場合は、検証ルートの `node_modules` だけを探す。
- monorepo の子プロジェクトは同じ作業ツリー内の上位の依存を使えるようにし、nested repo・submodule・linked worktree は各作業ツリーの境界で止める。
- 上限は探索位置だけにかけ、pnpm の store や既存 fixture の symlink/junction のリンク先実体は制限しない。既存の vitest → jest の優先順、receipt の型、品質判定と終了コードを保つ。
- 新しい ADDED Requirement で探索境界を定め、repo 外の sentinel、子プロジェクト、Git 不明時、リンク経由の正負試験と CLI/API の回帰を追加する。既存の試験・期待値・timeout は変えない。

## Capabilities

### New Capabilities

なし。

### Modified Capabilities

- `verify`: テストランナーと版を確かめる探索位置に上限を加える。主仕様未同期の REQ-319 は MODIFIED にせず、その本文・2 Scenario・Source と既存 Q-03 の履歴を保持する。

## Impact

- 製品の変更候補は `packages/kit/src/verify/quality-receipt.ts` と必要最小の内部補助。直接の caller `runVerify` と receipt の公開形式を保つ。
- `packages/kit/test/quality-receipt.test.ts` を追加し、既存の CLI/API 受入試験へ独立した回帰を加える。fixture の任意の基点指定は既定値を変えずに追加する。
- 新しい設定・公開 API・実行時依存を追加しない。Git の追加操作は既存の `runExternal` と期限・中断・出力上限を使う。
- L3 として仕様ゲート、要件 ID 付き試験、ローカル完了ゲート、同 head の必須 CI・3 OS・独立最終レビューを後続で確認する。本計画は親 C001 の完了と S1 の実体照合を含まない。
