## 1. 仕様
- [x] 1.1 trace-report の差分仕様で、「要件ごとの結果の表」を REMOVED にし、「要件ごとの結果の表の出力」と「レポートを作る change の探し方」を ADDED として書く。文は移すだけで、本文はそれぞれ 500 文字以内にする（REQ-070・REQ-213）

## 2. テスト
- [x] 2.1 移した振る舞いを確かめるテストの名前に [REQ-213] を足す。中身は変えない（REQ-213）

## 3. 確認
- [x] 3.1 `pnpm -s verify --change split-trace-report-table-requirement --done` を通す <!-- loomake:gate=done -->
