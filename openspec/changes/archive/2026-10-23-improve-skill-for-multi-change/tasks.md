## 1. 実装
- [x] 1.1 SKILL.md に、通し番号と、複数の change にかかわる行の載せ方を書く（REQ-026、REQ-029）
- [x] 1.2 SKILL.md に、要件書の未決事項の扱いを書く（REQ-027）
- [x] 1.3 SKILL.md と openspec-format.md に、後のフェーズの要件の書き方を書く（REQ-031）
- [x] 1.4 このリポジトリの `.agents/skills/req-to-openspec/` にも同じ文面を足す（verify の呼び方の違いは残す）

## 2. テスト
- [x] 2.1 各 Scenario に対応するテストを書く。テスト名に [REQ-xxx] を入れる

## 3. 確認
- [x] 3.1 `pnpm -s verify --change improve-skill-for-multi-change --done` を通す
