## 1. 実装
- [x] 1.1 パッケージ `@loomake/trace` を作る（REQ-083。Q-04 の回答に従う）
- [x] 1.2 `loomake trace record` で verify を実行し、証拠を保存する（REQ-066）
- [x] 1.3 未コミットの変更があるときに記録を止める（REQ-067）
- [x] 1.4 新しいファイルとして足し、既存の記録を書き換えない（REQ-068）
- [x] 1.5 `.gitignore` と証拠の保存先を決める（Q-02 の回答に従う）

## 2. テスト
- [x] 2.1 各 Scenario に対応するテストを書く。テスト名に [REQ-xxx] を入れる。git のリポジトリは一時ディレクトリに作る
- [x] 2.2 CI の Node.js 20.19 でテストを流す（REQ-089）

## 3. 確認
- [ ] 3.1 `pnpm -s verify --change add-trace-record --done` を通す
