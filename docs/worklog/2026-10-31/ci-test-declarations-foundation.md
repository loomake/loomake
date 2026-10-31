# companion の監査と試験宣言の検査を先行して追加する

1. やったこと：[Issue #240](https://github.com/loomake/loomake/issues/240) と[PR #253](https://github.com/loomake/loomake/pull/253) で、計画 change `split-slow-ci-checks` のタスク2.5の監査・旧形式の移行・宣言 inventory を同じ変更にまとめた。タスク2.10の閉じた構文の修理に加え、独立 Opus 設計に基づく Q-95〜Q-97 の module 読み込み先の検査を実装し、query・fragment・percent・曖昧な拡張子などを拒否した。
2. verify の結果：管理役が採用済みの第12 Scenario と親の仕様ゲート成功を確認してから修理した。旧269件と新39件の計308件が成功し、元の試験本文と期待値を保持した。query 経由の偽 reviewed の修理前の状態を保存し、修理後は監査と移行の両方で出力前に拒否した。native 1起動では query・fragment による自前行と source 行、正規 helper の対照を確認した。build・typecheck・lint も成功した。
3. 残っている確認事項・仮定：必須 CI、3 OS の検証、独立した自己レビューと最終 Opus レビュー、実ケース監査の受入は残る。依存 module の中身・symlink の解決先・実行時の反射は静的検査の技術限界であり、既知の不正を受理する免除にはしない。percent 形式の native 宣言成功は未確認である。
4. 次にやること：管理役が正式 change を持つ統合ブランチへ接続し、レビューと CI を確認する。[PR #184](https://github.com/loomake/loomake/pull/184) の仕様反映・実ケース登録・OS ごとの割当・Node20 検査の削除と残る受入条件は、この追加では完了にしない。
