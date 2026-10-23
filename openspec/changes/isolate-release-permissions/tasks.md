## 1. 実装
- [x] 1.1 release ワークフローを `check` と `publish` のジョブに分け、書き込みの権限を `publish` だけに持たせる。`publish` は `--ignore-scripts` でインストールし、`check` がビルドした `dist/` を受け取る（REQ-143）
- [x] 1.2 release ワークフローの action を、コミットの SHA で固定する（REQ-143）
- [x] 1.3 docs/release.md の「やった方がいいこと」から権限の項目を外し、release ワークフローの仕組みを手順に合わせて書く

## 2. テスト
- [x] 2.1 各 Scenario に対応するテストを書く。テスト名に [REQ-xxx] を入れる

## 3. 確認
- [ ] 3.1 `pnpm -s verify --change isolate-release-permissions --done` を通す
