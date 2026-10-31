# companion の監査と試験宣言の検査を先行して追加する

1. やったこと：[Issue #240](https://github.com/loomake/loomake/issues/240) と[PR #253](https://github.com/loomake/loomake/pull/253) で、計画 change `split-slow-ci-checks` のタスク2.5の監査・旧形式の移行・宣言 inventory を同じ L2 変更にまとめた。自己レビューで再発した重大指摘には難しいバグの経路で独立調査・設計を受け、新しい Codex 担当へ引き継ぎ、タスク2.10の読み込み先・expect 限定・namespace の許可位置を閉じる修理を加えた。
2. verify の結果：親 change の第12 Scenario と仕様ゲートの成功を管理役が確認してから修理し、部分 PR は `loomake-change: none` を保った。同名の自前宣言だけで元 source が確認済みになる修正前の状態と修正後の両入口の拒否・出力なしを確認し、旧228件と追加41件、build・typecheck・lint が成功した。
3. 残っている確認事項・仮定：必須 CI、3 OS の検証、独立最終レビューと実ケースの監査の受入はまだ残る。companion 本体の静的検査と、依存 module・実行時の反射を静的には検証できないという限界を区別し、既知の不正を受理する免除にはしない。
4. 次にやること：管理役が独立した自己レビューと Opus レビュー、必須 CI を確認して受け入れる。[PR #184](https://github.com/loomake/loomake/pull/184) の仕様反映・実ケース登録・OS ごとの割当・Node20 検査の削除と残る受入条件は、この先行追加では完了にしない。
