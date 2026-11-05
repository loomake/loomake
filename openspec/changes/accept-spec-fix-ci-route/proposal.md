# accept-spec-fix-ci-route

## Why

PR #429 で承認された「仕様適合の修正」は、既存 Requirement に実装を合わせる修正に限って change を省ける。しかし、現在の REQ-343 と CI は change のない L3 をすべて失敗にするため、この経路を使えない。

出典：Issue #427 とコメント 6651349025、ADR 0006「完成を早めるための規則変更」（2026-11-05）。

## What Changes

- REQ-343 を変更し、PR 本文の宣言と三つの機械的条件を満たす `spec-fix` だけを、品質コマンドを実行する経路へ進める。
- 条件が足りないときは、不足する条件を日本語で示して失敗する。通常の L3 と既存の L1・L2 の動作は保つ。
- 公開契約を変えていないことと、要件付きテストの修正前失敗・修正後成功の証拠をレビューで確認する手順を文書に記す。

## Capabilities

### New Capabilities

なし。

### Modified Capabilities

- `monorepo`：REQ-343「段階ごとの完了ゲートの動作」に `spec-fix` の条件付き経路を追加する。

## Non-goals

- 製品 CLI のフラグ・終了コード・JSON の形式・設定キーの変更。
- 公開契約の変更有無や RED/GREEN 証拠の機械的な判定。
- Windows の隔離一覧と時間切れの原因の修理（Issue #428）。
- 規則の変更、独立レビューや必須 CI の省略。

## Impact

- `scripts/ci-gate.mjs` と条件を調べる補助関数。
- REQ-343 の差分仕様、関連する CI 試験、`docs/dev/ci.md`。
- この PR は `openspec/` を変える通常の L3 として進め、今回追加する経路は使わない。
