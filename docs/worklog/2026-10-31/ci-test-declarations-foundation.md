# companion の監査と試験宣言の検査を先行して追加する

1. やったこと：[Issue #240](https://github.com/loomake/loomake/issues/240) に従い、計画 change `split-slow-ci-checks` のタスク2.5を先行する L2 変更としてまとめた。登録済み companion の監査と旧形式の移行、試験宣言の inventory・登録検査を同じ変更に含め、既存の Opus 設計と実装を再利用した。
2. verify の結果：管理役が親 change の更新と仕様ゲートの成功を確認してから着手した。部分 PR は `loomake-change: none` とし、build・typecheck・lint、監査・宣言検査・分割の190件が成功した。
3. 残っている確認事項・仮定：試験関数名を通常の const 変数で隠す形の追加検査は、行単位の登録を追加する後続設計で扱う。必須 CI、3 OS の検証、独立レビューと、実ケースを使った監査の受入はまだ実施していない。
4. 次にやること：管理役が独立した自己レビューと Opus レビュー、必須 CI を確認して受け入れる。[PR #184](https://github.com/loomake/loomake/pull/184) の仕様反映・実ケース登録・OS ごとの割当・Node20 検査の削除と残る受入条件は、この先行追加では完了にしない。
