## 1. 実装
- [x] 1.1 時間の上限を見張るスクリプトが SIGINT・SIGTERM を受けたら、コマンドを子のプロセスまで止め、中断で止めたと記録する（REQ-124）
- [x] 1.2 完了ゲートの品質コマンドが中断で止まったら、残りのコマンドとエンジンを動かさずに終わる（REQ-124）

## 2. テスト
- [x] 2.1 各 Scenario に対応するテストを、実装の前に書いて落ちることを確かめる。テスト名に [REQ-xxx] を入れる

## 3. 確認
- [x] 3.1 `pnpm -s verify --change stop-gate-on-interrupt --done` を通す <!-- loomake:gate=done -->
