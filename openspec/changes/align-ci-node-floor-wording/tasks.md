## 1. 仕様
- [x] 1.1 monorepo の差分仕様で、「対応環境での配布物の検証」を MODIFIED にし、Node 20.19.0 での検証が過去の下限での追加確認だと分かる文言にする。Scenario の WHEN の言い方も合わせる（REQ-144）

## 2. テスト
- [x] 2.1 tests/package-workflows.test.ts に [REQ-144] のテストがあり、合格することを確かめる。テストの名前と期待値は変えない（REQ-144）

## 3. 確認
- [ ] 3.1 `pnpm -s verify --change align-ci-node-floor-wording --done` を通す <!-- loomake:gate=done -->
