## 1. 実装
- [x] 1.1 SKILL.md の採番の手順を、既存の最大の REQ 番号の次から振る形に変える（REQ-026）
- [x] 1.2 このリポジトリの `.agents/skills/req-to-openspec/` にも同じ文面を入れる

## 2. テスト
- [x] 2.1 各 Scenario に対応するテストを書き、変わった Requirement に合わせて既存のテストを直す。テスト名に [REQ-xxx] を入れる

## 3. 確認
- [x] 3.1 `pnpm -s verify --change fix-req-numbering --done` を通す
