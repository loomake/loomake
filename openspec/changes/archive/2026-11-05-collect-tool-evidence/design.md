# Design

## Context

P1 の置換 API と runExternal をそのまま使う。設計の正は actual Opus の最終補足設計（2026-11-06 JST、session 34fddb45-e9d6-4ad2-b461-7c1c6797fda9、claude-opus-5-5）であり、旧 d93 設計を置き換える。設計対象 db893f0 と作業 base deaf02d の差は #69 の summary API の追加で、この実装が使う契約に影響しない。

## Goals / Non-Goals

core は純粋な中立変換、kit は実行と保存前の置換を担当する。公開契約の全型・分類表・境界は specs/tool-evidence/spec.md に置く。P3・親 #65 の完成条件は proposal の Non-goals のとおり残す。

## Decisions

- core/src/tool-output/ に types.ts・json.ts・gh.ts・claude.ts・codex.ts・biome.ts・playwright.ts を置く。共通読取りは例外文を外へ出さず最初の ParseError を保持し、ネストは明示したスタックで走査する。
- requirementIds と errorLine は test-report.ts の内部 export を再利用し、公開 index には足さない。
- kit/src/collect/ は @loomake/core と runtime の process・redact・errors だけを import する。runExternal 本体・既存置換・依存・schema・public CLI は変更しない。
- collector は実終了状態を事実として残し、parser の失敗とツールの失敗を区別する。子の起動は 1 回で、追加問い合わせはしない。
- AI の引数生成は、help で --・コマンド名衝突・sandbox 既定を確かめられないため作らない。利用者の args による 5 ツールの収集はすべて作る。
- stderr は全文を共通 redactor に通してから末尾を切る。maskValue の失敗は固定文の unreadable にする。
- kit-layers は既存配列へ collect を足し、元の禁止検査を保つ。
- 非破壊追加なので ADR 0002 に従い core・kit は patch とする。最終設計の minor という表記との差は trace の Q-P2-08 で決定する。

## Risks / Trade-offs

- Claude json 実 fixture 未観測、Biome CI stdout と max-diagnostics の適用未確認 → spec・PROVENANCE・README に限界を残し、形が違えば unreadable にする。
- Playwright の config.outputFile があると stdout が空になる → 設定は変えず unreadable とする。
- 差分が大きくなる → B0 と core 5 parser 後の B1 で src・test・docs を含む全差分を測る。160KiB 超の見込みなら REQ-448 と REQ-449/450 を独立の通常 PR へ分ける案を管理役へ返す。hard 200KiB を維持し、要件・試験は削らない。

## Migration Plan

既存 API を維持した追加として配布する。新しい利用箇所を外せば既存 API に戻せる。独立レビューと必須 CI・3 OS 試験の受入は管理役が行う。
