## 1. 実装
- [ ] 1.1 `.claude/skills/req-to-openspec/` と `AGENTS.md` を `packages/kit/templates/` に取り込み、CLAUDE.md・trace.md のテンプレートも置く（REQ-062 を出発点に）
- [ ] 1.2 Skill の本文を整える：読める形式と取り出しツール（REQ-025）、採番と出典（REQ-026）、チェックリスト（REQ-027）、必ずブロッキングにする分類（REQ-028）
- [ ] 1.3 Skill の本文を整える：change 分割（REQ-029）、Requirement の書式（REQ-030）、範囲外の扱い（REQ-031）、報告（REQ-032）、確認事項の文面（REQ-033）
- [ ] 1.4 AGENTS.md の本文を整える：5 つの節（REQ-043）、禁止事項（REQ-044）、プロジェクト固有欄（REQ-045）
- [ ] 1.5 Skill・AGENTS.md を日本語にする（REQ-055）
- [ ] 1.6 kit のコードにテキスト抽出処理が無いことを確かめる（REQ-059）

## 2. テスト
- [ ] 2.1 各 Scenario に対応する構造検査のテストを書く。テスト名に [REQ-xxx] を入れる

## 3. 確認
- [ ] 3.1 `node scripts/verify.mjs --change add-kit-assets --done` を通す
