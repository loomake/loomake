# split-trace-report-table-requirement

## Why
rename-acceptance-to-release を archive したあと、trace-report の Requirement「要件ごとの結果の表」の本文が 500 文字を超え、CI の gate ジョブが実行する `openspec validate --specs --strict` が不合格になった（PR #6 の確認事項、レビュー 5641828622）。本文には、表の中身を定める文と、レポートを作る change の探し方・change-id の検査を定める文が一緒に入っている。

## What Changes
- Requirement「要件ごとの結果の表」（REQ-070）から、change の探し方と change-id の検査を定める 2 文を、新しい Requirement「レポートを作る change の探し方」（REQ-213）に移す。残りは「要件ごとの結果の表の出力」（REQ-070）とする。文は移すだけで、語の追加・削除はしない
- OpenSpec の MODIFIED は Scenario を減らせないため、「要件ごとの結果の表」は REMOVED にし、2 つの Requirement を ADDED で書く（require-node-22 と同じ形）
- Scenario「archive した change」と「パスの区切りを含む change-id」を、新しい Requirement に移す
- 移した振る舞いを確かめているテストの名前に REQ-213 を足す。テストの中身は変えない

## Non-goals
- `loomake trace report` の振る舞いを変えること
- ほかの Requirement の本文を短くすること

## Impact
- 影響する capability：trace-report（Requirement の分割。「要件ごとの結果の表」の名前が「要件ごとの結果の表の出力」になる）
- 影響するコード：`packages/trace/test/report.test.ts`（テスト名だけ）
- 利用者に見える変更：なし
