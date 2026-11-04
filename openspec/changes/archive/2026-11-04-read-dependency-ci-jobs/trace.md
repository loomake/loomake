# Trace: read-dependency-ci-jobs

## 入力文書

| 文書 | 版 | 日付 |
|---|---|---|
| [#285](https://github.com/loomake/loomake/issues/285)、[本人回答](https://github.com/loomake/loomake/issues/121#issuecomment-6591068404)（Q-DEP-01=B/02=C/03=B/04=A） | — | 2026-11-03 |
| openspec/specs/external-process-budget/spec.md（REQ-180・REQ-182・REQ-412）、process.ts、input.ts | ac17c769 | 2026-11-04 |
| REQ-400の差分仕様（6122a5afのarchive原文）、通常分割設計e5c5f2ed、boundary/*.json | ac17c769 | 2026-11-04 |

管理役の委任では、未採用の一体案REQ候補415を3子へ分け、1回の取得だけを本子のRequirementとした。Windowsのcmd経由の起動、9009の分類、従来相当のUTF-8復号、約350行の自然な単位の採用は管理役の技術判断で、利用者の回答とは扱わない。Linux/Node24の実測を他OSの実測済みとは扱わない。

## 要件台帳

| ID | 出典 | 種別 | 要約（原文に忠実に） | 状態 | 反映先 |
|---|---|---|---|---|---|
| REQ-415 | #285 C3a・Q-DEP-03=B・一体案REQ候補415の1回の取得 | 機能 | 宣言したCI jobを同じrepoからghで同期に1回取得し、未検証のJSON値か取得不能と出力のバイト数を返し、監視の停止は投げる | 反映済 | specs/verify/spec.md、designの試験表 |

「反映済」は差分仕様への反映を示し、実装と受入は未完了である。同じjobの1回化・合計128MiB・期限の取得不能化（候補416）、照合と接続（候補417）をこの行の完了に含めない。正式化前にmainと178作業木のOpenSpec、GitHub code/issuesを照合し、415〜417の別予約との衝突は見つからなかった。

## 確認事項

| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 | 回答者 | 回答日 |
|---|---|---|---|---|---|---|---|---|

## 仮定

| ID | 関連 | 仮定の内容 | 理由 | 承認 | 承認者 | 承認日 |
|---|---|---|---|---|---|---|
