# Design

## Context
対象 base は `7d7f69b5dfbd890798aa4589cf04ae64b63bc300`。既存 verify の判定に使う入力なので、別 capability や core の公開 API を増やさず `verify` に ADDED を置く。
Opus 設計 `3380f500-70d2-466b-8b7d-a6fafd6a6157` は旧 head `3b572c22` が対象。今回はその reader と判定の責務を C1a/C1b に分ける設計判断であり、新分割の Opus レビュー成功はまだない。
## Goals / Non-Goals
C1a は REQ-400 の全3種の構文変換だけを担う。CLI 接続、提供元 DoD の確認、ネットワーク、git、テンプレート、producer、CI 権限、計測の追加は含めない。
## Decisions
- 新規 `packages/kit/src/verify/dependencies.ts` に kit 内部の純粋関数を named export で置く。本文・台帳 ID・自 change-id を受け、節の有無、宣言配列、位置つきエラー配列を返す。package の入口から公開しない。
- `splitLines` と `fenceMask` は既存の core export を使う。セル分割は `core/src/parse.ts` の空白・エスケープの扱いに合わせる。公開 `readTable` の追加や Trace/schema/parseTrace の拡張は採らない。
- change-id は既存 `CHANGE_ID` と archive 禁止を再利用し、自分自身も拒否する。宣言の不正を UsageError にせず、位置つきエラーにする。表欠落は見出し、列不正は表頭の行を使う。
- 最初の表だけを次の第2階層の節まで読む。ID・関連・種類・提供元・blob・CI の全境界は差分仕様の5 Scenario を基準にし、後から実在確認へ意味を広げない。
## 試験と独立レビューの観点
- `[REQ-400]` の表駆動試験を `packages/kit/test/verify-dependencies.test.ts` に追加する。有効な全3種、空の任意列、40/64桁 blob、複数 REQ/CI、表順・正の行番号を確かめる。
- 不正の表なし/空表/区切り行欠落/列欠落・余分・順違い/ID形・重複/関連空・未知/未知種類/自己・archive・不正 change-id/提供元欠落・不一致/Issue URL・他repo/path絶対・逆斜線・親参照区間`..`・空区間/blob欠落・非16進・桁違い・不要/CI形・空要素をすべて残す。
- 節なし、旧節だけ、フェンス内だけ、LF/CRLF/CR、通常名a..b.ts、セルのエスケープ、次節の表を入力例で確認する。既存テストの期待値と assert を変更せず、core parser と kit verify の回帰試験を実行する。
- 不変条件は REQ-034〜042/046/047/132/172/183/298/299/303/308/309/311/319/360/361/394。公開 Trace/schema/parseTrace、4 callers、同期 runVerify、依存方向、decision/code enum、run.errors、承認判定、入力予算、UsageError/abort を変えない。
- この子の直接の呼び出し元は単体試験だけ。製品が依存を警告・検査済みとは報告しない。新しい実行時依存や静的 zod、skip、期限・品質設定変更を加えない。
## Risks / Trade-offs
- CLI 未接続の期間がある → C1b を具体的な次子として保持し、C1a の通常 done 0 と親 #285 の完成を区別する。
- 旧 C1 の297行見積は design と yaml が未計上だった → 以下を全差分で数える。実装時に300行超が見えたら早期に管理役へ返し、圧縮・試験削減で合わせない。
## 全差分の見積と次子
| 子 | 計画・delta・同期・実装・試験・記録等 | 見積 |
|---|---|---|
| C1a 初期 | proposal17 + trace30 + design35 + tasks10 + yaml2 + delta29 + main同期29 + reader70 + 試験65 + 日誌8 + changeset4 | 299行 |
| C1a 現計画 | proposal17 + trace30 + design35 + tasks10 + yaml2 + delta26 + main同期26 + reader70 + 試験65 + 日誌8 + changeset4 | 293行 |
| C1b | 計画95 + delta24 + main同期24 + 接続15 + 試験85 + 日誌8 + changeset4 | 255行 |
C1b は REQ-401 を予約し、`run.ts` の checkSpec で一度読んだ本文を保持して shared questions の直後に内部 reader を接続する。構文不正は check「依存する成果物」の FAIL、詳細は `trace.md:<行> D-xx <理由>` とする。
C1b は正しい全3種を必ず未確認にし、spec-only は `案内：REQ-006 ← D-01 change add-x（未確認）` の PASS/0、done は local pending/ci INSUFFICIENT_EVIDENCE/1 とする。既存の失敗・承認判断と併存させ、節なしの check 数・順序・JSON・表示・終了コード・読取予算を完全に保つ。
C1b の試験は新規 `verify-dependency-gates.test.ts` で両モード・全3種・既存失敗との併存・JSON2.0.0・節なし・追加読取/外部操作なし・UsageError/abort保持を確かめ、4 callers を変更しない。各子は独立 change と通常 done0、自身の同期/archiveを同じ作業 PR に含める。
## Migration Plan
C1a の仕様ゲート後に試験→内部 reader→回帰検証を小さくコミットする。同期/archive は実装と同じ PR で行い、日別 worklog と changeset を含める。今回の計画段階ではコード・同期・archive・PR を実行しない。
## Open Questions
C1a にブロッキングな未回答はない。後続の正の判定では必要 CI 集合 U1 と他プロジェクトの producer 契約 U2 が未決であり、この子で回答や保証を補わない。
C2 producer、C3a job取得、C3b結果照合、C4 path blob、C5 Issue状態、C6配布文書は後続。archive存在や依存元の今回の試験だけを提供元 DoD の代わりにせず、#285 を完了にしない。
