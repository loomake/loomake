# kit の実行の基盤と機能を分ける

## Why

`@loomake/kit` には、verify・init・doctor の機能と、外部プロセスの監視・入力の上限・エラーの型などの実行の基盤が、同じ階層に並んでいる。2026-10-24 の品質評価のアーキテクチャで、この同居が残った。いまは基盤が機能を import していないが、決まりとして書かれておらず、テストもないので、崩れても気づけない。

## What Changes

- 実行の基盤（process・input・errors・change-files）を `packages/kit/src/runtime/` に移す
- kit の中の import の向きを決め、テストで確かめる

## Capabilities

### New Capabilities

なし。

### Modified Capabilities

- `monorepo`: kit の中の依存の向き。

## Impact

kit のファイルの場所と import のパスを変える。公開する API（`@loomake/kit` の export）と振る舞いは変えない。
