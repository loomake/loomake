## 1. 実装
- [x] 1.1 trace report の見出しとヘルプ、trace answer の案内を「リリースレポート」「要件ごとの結果」にする（REQ-070・REQ-071・REQ-131）
- [x] 1.2 req-to-openspec Skill のテンプレートと `.agents/skills/` の写し、配布する AGENTS.md の文面を変える（REQ-028・REQ-029・REQ-033）
- [x] 1.3 仕様の Scenario の例と同じ値を使うテストの例から「顧客」を外す（REQ-011・REQ-077・REQ-078・REQ-202）
- [x] 1.4 docs と README の「検収レポート」をリリースレポートにする

## 2. テスト
- [x] 2.1 各 Scenario に対応するテストの期待値を新しい文面に合わせる。テスト名に [REQ-xxx] を入れる

## 3. 確認
- [x] 3.1 `pnpm -s verify --change rename-acceptance-to-release --done` を通す <!-- loomake:gate=done -->
