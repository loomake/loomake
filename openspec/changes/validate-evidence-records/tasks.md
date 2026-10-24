## 1. 実装
- [x] 1.1 trace report で、証拠の記録の schemaVersion・形・change を確かめ、違えばファイルのパスと理由を示して終了コード 2 を返す（REQ-073）

## 2. テスト
- [ ] 2.1 各 Scenario に対応するテストを、実装の前に書いて落ちることを確かめる。テスト名に [REQ-xxx] を入れる

## 3. 確認
- [ ] 3.1 `pnpm -s verify --change validate-evidence-records --done` を通す <!-- loomake:gate=done -->
