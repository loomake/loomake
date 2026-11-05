# Trace: validate-kit-input-targets

## 入力文書

| 文書 | 版 | 日付 |
|---|---|---|
| [Issue #417](https://github.com/loomake/loomake/issues/417) | 項目4-1〜4-5・修理方針 | 2026-11-05 |
| 本会話の利用者の delivery 指示 | 1Issue1PR・新仕様は仕様ゲート先行 | 2026-11-05 |

## 要件台帳

| ID | 出典 | 種別 | 要約（原文に忠実に） | 状態 | 反映先 |
|---|---|---|---|---|---|
| REQ-424 | Issue #417 4-1 | 制約 | report をroot内の安全な相対ファイルに限り既定値と削除直前にも検査する | 反映済 | specs/verify/spec.md |
| REQ-425 | Issue #417 4-2 | 制約 | init の不正な種類の置き先を全配置前に拒む | 反映済 | specs/init/spec.md |
| REQ-426 | Issue #417 4-3 | 機能 | report を正規化して文字どおりのgitignore行を作る | 反映済 | specs/init/spec.md |
| REQ-428 | Issue #417 4-4、追補Opus設計 | 制約 | 監視役の親側の期限とtimeout分類で後片付け・後続停止を保つ | 反映済 | specs/external-process-budget/spec.md |
| REQ-250 | 現行external-process-budget、Issue #417 4-4 | 制約 | 結果のない監視役の停止とwatchdogの例外分類を整合させる | 反映済 | specs/external-process-budget/spec.md |
| REQ-172 | Issue #417 4-5、現行bounded-input | 制約 | change の読取エラーをcauseつき入力エラーにする | 既存仕様で充足 | openspec/specs/bounded-input/spec.md |

## 確認事項

| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 | 回答者 | 回答日 |
|---|---|---|---|---|---|---|---|---|

元Issueの明示された正規化・無配置・内部安全リンクと、既存の停止規範を追補設計に照らして採用した。監視役のtimeout例外はREQ250をMODIFIEDして後続停止を保持し、猶予は既存2000msを再利用する。未回答の製品要件はない。

## 仮定

| ID | 関連 | 仮定の内容 | 理由 | 承認 | 承認者 | 承認日 |
|---|---|---|---|---|---|---|
