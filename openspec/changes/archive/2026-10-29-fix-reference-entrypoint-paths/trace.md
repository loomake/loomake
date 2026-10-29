# Trace: fix-reference-entrypoint-paths

## 入力文書

| 文書 | 版 | 日付 |
|---|---|---|
| openspec/specs/reference-docs/spec.md | main 03ff605、REQ-321 | 2026-10-29確認 |
| scripts/generate-quality-reference.mjs、tests/quality-reference.test.ts | main 03ff6057845e6e5bcb1bb1d2ba086db9def83126 | 2026-10-29確認 |
| macOS shard2の失敗 | [CI40844515674 / job123348619751](https://github.com/loomake/loomake/actions/runs/40844515674/job/123348619751) | 2026-10-29 |
| Issue #104、固定WBS W6-8 | [再生成差分の検出](https://github.com/loomake/loomake/issues/104) | 2026-10-29確認 |
| delivery管理役からの修正準備依頼 | 既存REQ-321の回復、計画と再現まで。CLI未マージコードを変更しない | 2026-10-29 |

## 要件台帳

| ID | 出典 | 種別 | 要約（原文に忠実に） | 状態 | 反映先 |
|---|---|---|---|---|---|
| REQ-321 | 現行reference-docs、WBS W6-8、既存REQ-321試験、CI40844515674 | 品質 | 安定した再生成と読み取り専用checkを保ち、リンク経由の直接起動でも欠落・改変を検出する。importの無副作用と既存の終了コードを保つ | 反映済 | specs/reference-docs/spec.md |

## 確認事項

| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 | 回答者 | 回答日 |
|---|---|---|---|---|---|---|---|---|

未回答の仕様判断はない。既存契約の不具合修正として計画し、テストの弱化・設定の緩和・公開を含めない。PR #144のマージ承認やC-001の確認事項へ回答したものとして扱わない。

## 仮定

| ID | 関連 | 仮定の内容 | 理由 | 承認 | 承認者 | 承認日 |
|---|---|---|---|---|---|---|

未承認の製品仕様を仮定で補わない。realpathで実体を比較する方法とOS別のfixtureは、designに記した技術判断である。

## 担当と検証の範囲

担当はdelivery管理役配下のCodex。branchは `fix/reference-entrypoint-paths`、worktreeは `.claude/worktrees/codex-reference-entrypoint-paths`。既存のopen PRとworktreeに同changeの担当がいないことを確認した。既存の試験本文と期待値を保持し、リンク経由の起動とimportの回帰試験、生成器の直接起動の判定だけを変更した。

失敗元は上のCIを参照する。Linux Node24で同じ起動判定の不一致を再現した。2.1・2.2の実装と関連試験、生成物check、lint・typecheckをローカルで確認した。WindowsとmacOSの修正後の成功、全体の完了ゲート、独立レビュー、PR作成は未実施で、3.1を未チェックで保持する。詳細な再現ログは専有worktreeの `node_modules/.cache/reference-entrypoint-paths/reproduction.json` に置き、引継ぎ時に管理役へ伝える。
