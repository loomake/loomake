# Tasks
## 1. 仕様
- [x] 1.1 REQ-400と全境界の計画を確認し、strict validateとspec-onlyの終了0を記録する。
## 2. 内部読み取り
- [ ] 2.1 REQ-400の全Scenarioとdesignの境界を新規単体試験にし、未実装で失敗することを確かめる。
- [ ] 2.2 全3種の純粋な内部readerを実装し、新規試験とcore parser・kit verify回帰試験の成功、CLI未接続を確かめる。変更内容の説明とchangesetを同じ作業に含める。
## 3. 統合検証
- [ ] 3.1 lint・typecheck・通常doneを実行し、全タスクとREQ-400の試験対応、既存期待値・設定の保持を確認する。
## Workflow follow-up
- 日別worklogに判断と結果を4項目で追記し、独立レビュー・必須CI・3 OSを確認する。自身のspec同期とarchiveを同じ実装PRに含め、archive後の通常done0を確かめる。計画だけのPRは作らない。C1bと親#285は未完了として引き継ぐ。
