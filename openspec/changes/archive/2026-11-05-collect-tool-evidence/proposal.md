# collect-tool-evidence

## Why

W1-6（Issue #65）では、gh・claude・codex・biome・playwright の出力を、終了コードと区別した事実として収集する必要がある。P1 の既存の置換 API と外部実行基盤を使い、P3 の品質判定に渡せる中立型を追加する。

## What Changes

- REQ-448：core に 5 つの純粋 parser と中立型を追加する。
- REQ-449：kit に 1 回の外部実行を 5 種類に分ける collector と、gh・Biome・Playwright の引数生成関数を追加する。
- REQ-450：保存前に既知の秘密の形を置換し、保証する範囲と未観測の条件を文書に記す。

## Capabilities

### New Capabilities

- `tool-evidence`：外部ツールの JSON・JSONL の中立変換、収集、保存前の置換。

### Modified Capabilities

なし。既存の外部実行・置換・依存規則は変更しない。

## Non-goals

- AI ツールの引数生成、prompt の受理範囲、install・auth・版の問い合わせ、新しい実 fixture の収集。
- 新しい依存・JSON Schema・CLI、runExternal・既存置換 API の変更。
- 後段 P3（REQ-451〜453・REQ-070）の verify・trace 接続、runner、Issue #65 親全体の完成。

## Impact

core と kit の src・test・README、公開型の consumer fixture、kit の依存方向試験、changeset を変更する。既存 API は維持し、ADR 0002 に従い core・kit とも patch とする。
