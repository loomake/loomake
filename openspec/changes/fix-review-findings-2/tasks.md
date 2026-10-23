## 1. 実装
- [x] 1.1 change の文書の変更を検出し、`openspecDir` の設定を使う（REQ-111）
- [x] 1.2 完了ゲートの品質コマンドに、実行時間の残りを上限として渡す（REQ-105）
- [x] 1.3 テストのレポートが `.gitignore` で除外されていなければ始めない（REQ-094）
- [x] 1.4 skip の検出に条件つきの skip などの書き方を足す（REQ-109）
- [x] 1.5 パスの区切りを含む change-id を使い方の誤りにする（REQ-041・REQ-066・REQ-070・REQ-101）
- [ ] 1.6 trace report で読めない証拠の記録を使い方の誤りにする（REQ-073）
- [ ] 1.7 AGENTS.md のプロジェクト固有の情報を直す

## 2. テスト
- [ ] 2.1 各 Scenario に対応するテストを書く。テスト名に [REQ-xxx] を入れる

## 3. 確認
- [ ] 3.1 `pnpm -s verify --change fix-review-findings-2 --done` を通す
