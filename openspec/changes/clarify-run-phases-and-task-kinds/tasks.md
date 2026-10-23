## 1. 実装
- [ ] 1.1 `runRun` を段階ごとの関数に分ける（振る舞いは変えない）
- [ ] 1.2 完了ゲートのタスクを印で決め、旧書式には印を付けるよう案内する（REQ-100）
- [ ] 1.3 Skill の tasks.md の雛形と SKILL.md に、完了ゲートのタスクの印を足す（REQ-136）
- [ ] 1.4 run を始めたあとの git の失敗と証拠の記録の失敗を、記録に残して終了コード 1 で止める（REQ-137）

## 2. テスト
- [ ] 2.1 各 Scenario に対応するテストを書く。テスト名に [REQ-xxx] を入れる

## 3. 確認
- [ ] 3.1 `pnpm -s verify --change clarify-run-phases-and-task-kinds --done` を通す <!-- loomake:gate=done -->
