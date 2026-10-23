## 1. 実装
- [ ] 1.1 core の `parseTrace` で、回答者・回答日・承認者・承認日を読む（REQ-011、REQ-077、REQ-078）
- [ ] 1.2 `createTraceTemplate` と kit の trace.md の雛形に列を足す（REQ-017）
- [ ] 1.3 このリポジトリの `.agents/skills/req-to-openspec/templates/trace.md` にも列を足す

## 2. テスト
- [ ] 2.1 各 Scenario に対応するテストを書く。テスト名に [REQ-xxx] を入れる

## 3. 確認
- [ ] 3.1 `pnpm -s verify --change add-agreement-columns --done` を通す
