# Trace: bound-quality-producer-search

<!--
このファイルは loomake verify が読む。表の列の順番と見出し名は変えないこと。
状態の値：反映済 / 確認待ち / 範囲外 / 既存仕様で充足
-->

## 入力文書

| 文書 | 版 | 日付 |
|---|---|---|
| [Issue #238](https://github.com/loomake/loomake/issues/238)（PR #236 の軽微指摘、探索上限） | 2026-11-01 の着手時点 | 2026-11-01 |
| [管理役の設計採用記録](https://github.com/loomake/loomake/issues/238#issuecomment-6550040570)（Q238-01〜05：A/A/A/A/B） | 管理役による推奨採用 | 2026-11-01 |
| [REQ-359 の中央予約](https://github.com/loomake/loomake/issues/238#issuecomment-6550070729) | 管理役による採番 | 2026-11-01 |
| `openspec/changes/verify-v2-quality/trace.md` の Q-03、同 change の `specs/verify/spec.md`（REQ-319） | 変更しない既存決定と差分仕様 | 2026-10-31 |
| `docs/plan-2026-11.md` の柱 2、`docs/adr/0006-standing-approval-for-autonomous-delivery.md` の包括承認 | 設計対象の main | 2026-11-01 |
| Opus 設計回答（専用 tree の `.loomake/claude/3ac77583-7cee-4578-9cc1-50ea7bf23975/result.md`） | 実 Opus 5.5・読取のみ・拒否 0 | 2026-11-01 |

## 要件台帳

| ID | 出典 | 種別 | 要約（原文に忠実に） | 状態 | 反映先 |
|---|---|---|---|---|---|
| REQ-359 | Issue #238 の修正案 a、設計採用記録と中央予約（入力文書参照） | 機能 | ランナーの探索位置を検証ルートから Git 作業ツリーの最上位までに限定し、最上位不明時はルートだけに止める。範囲内から外部実体へのリンクは実体が外部であることだけでは除外しない | 反映済 | specs/verify/spec.md |
| REQ-319 | `verify-v2-quality` の台帳と差分仕様、Q-03 | 関連 | CLI/API の正常 PASS・不正 aborted・不足、古い成功証拠の拒否は既存 change の所有を保つ。本文・2 Scenario・Source と Q-03 の履歴を変更しない | 範囲外 | openspec/changes/verify-v2-quality/specs/verify/spec.md |

## 確認事項

| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 | 回答者 | 回答日 |
|---|---|---|---|---|---|---|---|---|
| Q238-01 | REQ-359 | 上へ探す位置の上限をどこにするか | A: Git 作業ツリーの最上位 / B: 現状維持 | A。設定を増やさず偶然の上位依存を除外できる | yes | A。管理役が採用。利用者の「判断待ちはおすすめで」と ADR 0006 に基づく。入力文書の採用記録参照 | 管理役 Codex | 2026-11-01 |
| Q238-02 | REQ-359 | Git 最上位が不明または検証ルートを含まない場合はどうするか | A: root の node_modules だけ / B: producer なし / C: ファイルシステム最上位まで | A。root 内は保持し、親の偶然の runner を使わない | yes | A。管理役が採用。非 Git・Git 不在・失敗・不正出力・実パス不明・包含不一致を含む。入力文書の採用記録と ADR 0006 参照 | 管理役 Codex | 2026-11-01 |
| Q238-03 | REQ-359 | monorepo・nested repo・submodule・linked worktree の境界をどうするか | A: 現在の show-toplevel / B: 主 checkout や superproject まで / C: .git を独自探索 | A。target と同じ作業ツリーを境界にする | yes | A。管理役が採用。子プロジェクトは同じ作業ツリー内の親を利用し、別作業ツリーへは上らない。入力文書の採用記録と ADR 0006 参照 | 管理役 Codex | 2026-11-01 |
| Q238-04 | REQ-359 | 上限をリンク先の runner 実体にもかけるか | A: 探索位置だけ / B: リンク先実体も作業ツリー内だけ | A。pnpm と既存 fixture のリンクを保つ | yes | A。管理役が採用。探索位置は実パスで比較し、リンク先実体の全面照合は S1 に残す。入力文書の採用記録と ADR 0006 参照 | 管理役 Codex | 2026-11-01 |
| Q238-05 | REQ-359・REQ-319 | 主仕様未同期の REQ-319 と新しい上限をどう所有するか | A: REQ-319 の MODIFIED / B: 新 ID の ADDED / C: 既存 change を直接変更 | B。未同期の MODIFIED と所有の重複を避ける | yes | B。管理役が採用し REQ-359 を予約。REQ-319 原文と Q-03 は保持する。入力文書の採用記録・中央予約と ADR 0006 参照 | 管理役 Codex | 2026-11-01 |

## 仮定

| ID | 関連 | 仮定の内容 | 理由 | 承認 | 承認者 | 承認日 |
|---|---|---|---|---|---|---|

新しい仮定はない。修理前の実行再現と Windows の短縮名の挙動は未観測であり、設計の事実として補わず実装タスクの正負試験と 3 OS 検証で確認する。
