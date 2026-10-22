## 1. 実装
- [x] 1.1 trace.md の 3 つの表を読む `parseTrace` を実装する（REQ-011）
- [x] 1.2 台帳の状態値の検査を実装する（REQ-012）
- [x] 1.3 spec.md から Requirement を取り出す `parseSpec` を実装する（REQ-013, REQ-051）
- [x] 1.4 tasks.md から `parseTasks` を実装する（REQ-014）
- [x] 1.5 テストランナーの JSON レポートから、テストファイルごとに要件 ID を取り出す `extractTestRequirements` を実装する（REQ-015、Q-11、A-06）
- [x] 1.6 verify 結果の JSON スキーマと型を公開する（REQ-016, REQ-053）
- [x] 1.7 `createTraceTemplate` を実装する（REQ-017）
- [x] 1.8 解析エラーにファイル名と行番号を含める（REQ-018）
- [ ] 1.9 実行時依存がゼロであることを確かめる（REQ-046）

## 2. テスト
- [ ] 2.1 各 Scenario に対応するテストを書く。テスト名に [REQ-xxx] を入れる
- [ ] 2.2 Loomake の追加書式（Source 行・trace.md）を含む change が `openspec validate --strict` を通ることを確かめるテストを書く（REQ-052, REQ-058）

## 3. 確認
- [ ] 3.1 `node scripts/verify.mjs --change add-core-parsers --done` を通す
