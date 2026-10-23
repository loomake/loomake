## 1. 実装
- [x] 1.1 change・差分仕様・いちばん新しい証拠の記録を読み、要件ごとの行を作る（REQ-070、REQ-071、REQ-073）
- [x] 1.2 冒頭の一覧を作る（REQ-072。Q-07 の回答に従う）
- [x] 1.3 確認事項と仮定の一覧を作る（REQ-077〜REQ-079。Q-01 の回答に従う）
- [x] 1.4 Markdown と JSON の出力と `--format` を作る（REQ-074）
- [x] 1.5 同じ入力から同じ出力になるようにする（REQ-085）
- [x] 1.6 性能を計測する（REQ-086。Q-03 の回答に従う）
- [x] 1.7 docs/usage.md と docs/architecture.md に trace の使い方と状態を書く

## 2. テスト
- [x] 2.1 各 Scenario に対応するテストを書く。テスト名に [REQ-xxx] を入れる。change と証拠の記録は一時ディレクトリに作る
- [x] 2.2 CI の Node.js 20.19 でテストを流す（REQ-089）

## 3. 確認
- [x] 3.1 `pnpm -s verify --change add-trace-report --done` を通す
