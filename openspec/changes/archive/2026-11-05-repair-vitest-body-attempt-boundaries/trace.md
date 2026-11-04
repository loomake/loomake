# Trace: repair-vitest-body-attempt-boundaries

## 要件台帳

| ID | 出典 | 種別 | 要約（原文に忠実に） | 状態 | 反映先 |
|---|---|---|---|---|---|
| REQ-393 | 現行test-body-evidence・Issue #376・本人Q-376-01/02 | 機能 | 試行境界とrunner統合を明示し、遅いbodyの誤帰属を防ぐ。未設定は証拠なしとし設定・移行を案内する | 反映済 | specs/test-body-evidence/spec.md |

## 確認事項

| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 | 承認者 | 承認日 |
|---|---|---|---|---|---|---|---|---|
| Q-376-01 | REQ-393 | body(ctx, fn)を保ち、初期化へVitestの実行hook登録を加える設計を含めるか | A: 初期化のhook/API・移行も設計 / B: 既存初期化だけで調べる | A。callback開始から試行を識別する設計を検討できる | yes | A「初期化へのhook登録追加も設計する（おすすめ）」。利用者直接回答、本会話call_da0ba10ae14d40b0ab46dcc29ba76d64。特定hookの互換性免除ではない | 本会話の利用者 | 2026-11-04 JST |
| Q-376-02 | REQ-393 | 新runner統合が未設定の場合の証拠をどうするか | A: fnを保ち証拠なし＋設定・移行案内 / B: 未検証印を付ける別形式を設計 | A。誤帰属する旧記録を有効な証拠として残さない | yes | A「未設定なら証拠なし＋設定・移行案内（おすすめ）」。利用者直接回答、本会話call_962c8718b5fb4797a63c029e7c62f4f9。旧偽ctx consumerも設定移行の対象 | 本会話の利用者 | 2026-11-04 JST |

## 仮定

| ID | 関連 | 仮定の内容 | 理由 | 承認 |
|---|---|---|---|---|

未回答の製品判断・承認待ちの仮定はない。実装の成立性と回帰試験は未完taskで検証し、未実測のsnapshot値を受入oracleとして決めない。

## 設計の出典と範囲

- [Issue #376](https://github.com/loomake/loomake/issues/376)：P35/P37/P41/P27/P28のattempts原観測比較と、遅いbodyの誤帰属修理。親#278の完了は認定しない。
- 独立調査・比較設計：Opus session `17c5bd19-aa75-4d2d-b25a-2f218504a59d`、対象head `d6008000192b7124336ffb2e60e408baf3a9b2fd`。2入力、終了0・ok:true、実モデルclaude-opus-5-5、読取専用・MCPなし。原結果は担当treeの`.loomake/claude/<session>/result.md`、実行監査は`.loomake/collector-376-provenance/loomake-376-followup-execution-audit.md`。
- 管理役の補正：`.loomake/collector-376-provenance/loomake-376-followup-design-assessment.md`。例外時の全閉鎖、token単位の入れ子、task単位の履歴保持、実観測oracle、同じhost設定での対照、偽ctxの設定移行をdesign/tasksへ反映する。
- Q-376-02はOpus結果の未決Q1を解消した直接回答。未検証の旧形式flagは採らず、`format:1`を保つ。initテンプレート追加は対象外。
- 診断はNode 24.21.0 / Vitest 5.0.5 / Linuxでの観測。Node下限・3 OS・tarball・custom Base合成の受入は後続taskで確かめる。実装済み・互換性確認済みとは扱わない。
- 独立計画レビューの補正：閉じ境界を標準wrapper/custom Baseへの一度の委譲のsettlementとfinishedの早い方へ明確化した。根拠はVitest engineのrunTask待機3900→finished3915/3928→retry更新3977。custom後処理中は同じ元試行・原counterを保つ。既存の原帰属・閉鎖後除外を保つ技術的明確化であり、新しい本人回答や対応範囲の縮小ではない。出典：`.loomake/collector-376-provenance/loomake-376-formal-plan-review.md`と管理役の同補正指示。
