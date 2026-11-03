# Trace: supervise-raw-external-output

## 入力文書

| 文書 | 版 | 日付 |
|---|---|---|
| C001のC3 [#310](https://github.com/loomake/loomake/issues/310)、verify-v2-c001/design-candidate-a.md | main 7d7f69b5 | 2026-11-04 |
| openspec/specs/external-process-budget/spec.md、process.ts、process.test.ts、kit/src/index.ts | main 7d7f69b5 | 2026-11-04 |

管理役の委任では、normal設計a1092eaeのX1だけを正式化し、私的captureの安全加算不能を起動前UsageErrorにする技術適用を採用した。人の製品判断や新しい仮定承認へ読み替えない。project内のNode24/Linux限定実験はdesignの技術判断に用い、他OSやNode22の実測済みとは扱わない。旧da3ef42fのENOBUFS置換案は不採用。

## 要件台帳

| ID | 出典 | 種別 | 要約（原文に忠実に） | 状態 | 反映先 |
|---|---|---|---|---|---|
| REQ-412 | #310のC3・既存外部操作監視・委任されたX1 | 追加 | 原文Bufferを保持する私的な同期入口を既存監視と共有し、公開APIを保つ | 反映済 | specs/external-process-budget/spec.md、designの4Scenario試験表 |

「反映済」は差分仕様への反映を示し、実装と受入は未完了である。REQ-402〜411は再利用しない。採番前にmainと169作業木のopenspec、GitHub code/issuesでREQ-412の一致なしを確認した。C3全接続やstderr上限の採用をこの行の完了に含めない。

## 確認事項

| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 | 回答者 | 回答日 |
|---|---|---|---|---|---|---|---|---|

## 仮定

| ID | 関連 | 仮定の内容 | 理由 | 承認 | 承認者 | 承認日 |
|---|---|---|---|---|---|---|
