## 1. 実装
- [x] 1.1 エンジンを呼ぶ前と後の HEAD の SHA とブランチ名を比べ、変わっていたら止まる（REQ-126）
- [x] 1.2 止まるときに、前後の SHA・ブランチ名・差分と、確かめる手順と戻す手順を表示する（REQ-126）

## 2. テスト
- [x] 2.1 偽の claude で git のコマンドを実行できるようにし、各 Scenario に対応するテストを書く。テスト名に [REQ-126] を入れる

## 3. 確認
- [x] 3.1 `pnpm -s verify --change harden-run-engine-boundary --done` を通す
