## 1. 実装
- [ ] 1.1 引数の解析と終了コード（0・1・2）を実装する（REQ-041, REQ-042）
- [x] 1.2 仕様ゲートのうち、ブロッキング確認事項の検査を実装する（REQ-034）
- [x] 1.3 仕様ゲートのうち、Source・台帳・Scenario・反映済の検査を実装する（REQ-035）
- [x] 1.4 未承認の仮定と確認待ちの要件を警告として表示する（REQ-036）
- [x] 1.5 `openspec validate --strict` を実行して結果をゲートに含める（REQ-037）
- [x] 1.6 完了ゲートのうち、未完了タスク・確認待ち・テストの無い要件の検査を実装する。テストの有無は、test コマンドが `tests.report` に書き出した JSON レポートで判定する（REQ-038、Q-11、A-05）
- [x] 1.7 `loomake.config.json` の commands を実行し、失敗を不合格にする（REQ-039）
- [x] 1.8 `--json` で結果と要件ごとのテストファイル一覧を出力する（REQ-040）
- [x] 1.9 `--change` 省略時は commands だけを実行する（REQ-042）
- [ ] 1.10 エラーメッセージを日本語で書く（REQ-055）
- [x] 1.11 kit の実行時依存を core のみ、loomake の実行時依存を core と kit のみにする（REQ-047）
- [ ] 1.12 1,000 ファイル・500 要件で 3 秒以内に終わることを確かめ、遅ければ直す（REQ-050）
- [ ] 1.13 このリポジトリの Vitest が JSON レポートを `tests.report` に書き出すようにし、`loomake.config.json` に `tests.report` を足す。設定を変えるので、先に人の承認を取る（AGENTS.md 4 章）

## 2. テスト
- [ ] 2.1 各 Scenario に対応するテストを書く。テスト名に [REQ-xxx] を入れる

## 3. 確認
- [ ] 3.1 `node scripts/verify.mjs --change add-verify-cli --done` を通す
- [ ] 3.2 `loomake verify` が試作と同じ結果を返すことを確かめたうえで、CI を `loomake verify` に切り替え、`scripts/verify.mjs` を置き換える。`scripts/` を変更するときは、先に人の確認を取る
