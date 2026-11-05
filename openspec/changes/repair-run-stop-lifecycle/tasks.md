## 1. 仕様
- [x] 1.1 Issue・実再現・Opus 設計・利用者回答を差分仕様へ反映し、仕様ゲートを通す

## 2. 実装
- [ ] 2.1 dry-run の例外時の復帰と想定外例外の停止記録を RED/GREEN で確かめる
- [ ] 2.2 エンジンの出力待機を有界化し、通常結果と明示停止の判定を確かめる
- [ ] 2.3 2 回目の信号の強制終了と初回の既存動作を確かめる
- [ ] 2.4 使い方・復旧手順・changeset・作業記録を更新する

## 3. 検証
- [ ] 3.1 関連試験・lint・型検査を通す
- [ ] 3.2 `pnpm -s verify --change repair-run-stop-lifecycle --done --scope local` を通す <!-- loomake:gate=done -->
