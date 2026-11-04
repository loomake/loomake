# Proposal

## Why

C001のC3でGit読取りを既存の外部操作監視へ接続するには、原文のバイト列を失わずに受け取る入口が必要である。公開の文字列APIを保ち、共通の監視処理から私的にBufferを返せるようにする。

## What Changes

- REQ-412として私的raw入口を追加し、期限・中断・子孫停止・保持役を既存処理と共有する。
- 私的入口ではデータ上限に既存64KiBの制御用領域を足して親が捕捉し、データ上限ちょうどの成功を保つ。
- 公開runExternalの型・文字列化・例外・戻り値のerror有無・同期性とbarrelを保持する。

## Capabilities

### New Capabilities

なし。

### Modified Capabilities

- `external-process-budget`: バイト列を保持する私的な同期外部操作を追加する。

## Impact

実装対象は `packages/kit/src/runtime/process.ts` と既存 `packages/kit/test/process.test.ts`。新しい依存、設定変更、公開API追加はない。Git接続、stream別上限、stderr分離は後続の変更とし、この子だけでC3・S1・C001を完了にしない。
