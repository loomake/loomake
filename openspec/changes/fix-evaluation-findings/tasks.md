## 1. 実装
- [ ] 1.1 change-id を OpenSpec の change 名の形に限り、`archive` も使い方の誤りにする（REQ-041・REQ-066・REQ-070・REQ-101）
- [ ] 1.2 ブロッキング列の値を yes・no・はい・いいえ に限る（REQ-034）
- [ ] 1.3 タスクの記号に `*`・`+` を認め、タスクの無い tasks.md を完了ゲートで不合格にする（REQ-014・REQ-038）
- [ ] 1.4 検収レポートの冒頭に、不合格の検査を示す（REQ-072）
- [ ] 1.5 run は gh CLI が使えるかを、エンジンを呼ぶ前に確かめる（REQ-116）

## 2. テスト
- [ ] 2.1 各 Scenario に対応するテストを、実装の前に書いて落ちることを確かめる。テスト名に [REQ-xxx] を入れる

## 3. 確認
- [ ] 3.1 `pnpm -s verify --change fix-evaluation-findings --done` を通す <!-- loomake:gate=done -->
