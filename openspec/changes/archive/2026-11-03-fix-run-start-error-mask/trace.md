# Trace: fix-run-start-error-mask

## 入力文書

| 文書 | 版 | 日付 |
|---|---|---|
| run/cli主仕様、runner/CLI実装・既存試験 | main fc0f17b9 | 2026-11-02 |
| Opus設計5164ff47と補足6a25d16f、rootのB案採用 | 同head、実モデルclaude-opus-5-5 | 2026-11-02 |
| 管理役の既存不具合修理の切出し、ローカル実装許可 | 今回の指示、PR作成保留 | 2026-11-02 |

## 要件台帳

| ID | 出典 | 種別 | 要約（原文に忠実に） | 状態 | 反映先 |
|---|---|---|---|---|---|
| REQ-154 | 主仕様runの表示境界保護 | 既存の修理 | 本文・旧2Scenario・Source不変で、開始前Git失敗の既定表示を明示 | 反映済 | specs/run/spec.md |
| REQ-199 | 主仕様runの置換形式 | 既存 | 形式・閾値・置換文字は変更せず既存関数を再利用 | 既存仕様で充足 | design.md、mask.test.ts |
| REQ-137 | 主仕様runの実行中の失敗 | 既存 | 開始前exit 2・記録なし、開始後の記録と停止を保持 | 既存仕様で充足 | design.md、run.test.ts |
| REQ-192 | 主仕様cliの実行時失敗 | 既存 | RuntimeFailureのexit 3・usageなしを保持 | 既存仕様で充足 | design.md、external-budget.test.ts |

## 確認事項

| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 | 回答者 | 回答日 |
|---|---|---|---|---|---|---|---|---|
| Q-START-01 | REQ-154 | 修理の配置 | A:CLI / B:runの2catch | B。発生元に限定 | yes | B。Opus設計と補足を採用する技術判断。利用者の新仕様承認ではない | 管理役Codex（root） | 2026-11-02 |

## 仮定

| ID | 関連 | 仮定の内容 | 理由 | 承認 | 承認者 | 承認日 |
|---|---|---|---|---|---|---|

## 保持する範囲

#65/W1-6の依存#62とC003は未完。collector/共通形式/鮮度/保存へ進まない。REQ-070/127の原文・hash、C001/E3/S1/PIN、既存it/assert/期待/期限/skip/設定/依存を保持する。日別worklogと常時yomiyasuは今回の利用者直接指示を優先し、新規則の採用としない。設計時は本数条件で新L3 PRを保留した。[R351=A](https://github.com/loomake/loomake/issues/121#issuecomment-6590095928)で修理1本の例外が承認され、[PR #352](https://github.com/loomake/loomake/pull/352)を受け入れた。local完了とCI・独立最終・merge・archiveの確認を区別し、親の受入とは呼ばない。
