# Proposal

## Why

runner が git から受け取ったファイル名を pathspec として渡すため、`:(top)` などで始まるテストの差分が空になり、既存のガードを回避できる。出典は [Issue #414](https://github.com/loomake/loomake/issues/414) の再現と修理案である。

## What Changes

- runner の git 呼び出しにリテラルなパスの扱いを適用し、名前の解釈によるガードの空振りを防ぐ。
- 既存の REQ-109・REQ-138 に pathspec の名前を使う回帰 Scenario を足す。
- 修正前に失敗する回帰試験、既存の特殊文字パス試験、git の直接呼び出しと証拠の配置を確認する。

## Capabilities

### New Capabilities

なし。

### Modified Capabilities

- `run-guards`: 既存の検出と差分表示を、pathspec の魔法構文に見える名前でも確かめる Scenario を追加する。規範文と既存 Scenario は保持する。

## Impact

- `packages/runner/src/git.ts` と、直接 git を呼ぶ `guards.ts`。
- runner のガード・git 読み取り・run の回帰試験。
- CLI・JSON 形式・依存・品質設定は変更しない。

## Non-goals

- git の glob を製品機能として提供すること。
- runner 以外の git 呼び出しや、ほかのレビュー欠陥を修理すること。
