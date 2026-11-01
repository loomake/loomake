# クラス式の宣言名の誤検出修理

1. やったこと：`split-slow-ci-checks` の task 2.7 の部分修理として、名前付きクラス式の宣言名を値参照から除外した。旧試験の全文を保持して正負8件を追加し、[PR #283 の軽微指摘](https://github.com/loomake/loomake/pull/283)と [Issue #241](https://github.com/loomake/loomake/issues/241) の残件に対応した。
2. verify の結果：仕様ゲートは終了0、対象269件と全体2674件が成功した（失敗0、既存のOS条件によるpending12件）。通常local doneは21検査中20件がPASSし、未完了14タスクによる `tasks.md` のFAILだけで終了1だった。
3. 残っている確認事項・仮定：新しい仕様判断はない。CI・別担当の自己レビュー・独立Opus最終レビューは未実施で、Opusへの送信許可は回答待ちである。
4. 次にやること：採用済みの段階受入の条件で統合先 `change/split-slow-ci-checks` へのPRを準備し、CIとレビューを確認する。親task 2.7、一般oracle、実case登録、実OS割当と親change全体の完了は未達のまま残す。
