## 1. 実装
- [x] 1.1 trace record で、検証した時点の trace.md と差分仕様を証拠に保存する（REQ-127）
- [x] 1.2 trace record で、検査の前後の HEAD・作業ツリー・文書を比べ、変わっていたら記録しない（REQ-128）
- [x] 1.3 trace report で、証拠に保存した文書から表を作り、記録のあとで変わった文書を示す（REQ-070・REQ-129）
- [x] 1.4 trace report で、文書のない古い記録に「仕様との対応は未確認」と示す（REQ-130）
- [x] 1.5 レポートに検査の範囲の説明を載せる（REQ-131）

## 2. テスト
- [x] 2.1 各 Scenario に対応するテストを書く。テスト名に [REQ-xxx] を入れる

## 3. 確認
- [x] 3.1 `pnpm -s verify --change bind-evidence-to-spec-snapshot --done` を通す
