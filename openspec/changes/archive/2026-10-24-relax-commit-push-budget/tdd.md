# TDD実行記録

## 1.1 期限

1 操作の期限（500 ミリ秒）より遅い pre-commit・pre-push のフック（各 1 秒）があるときに、run がコミット・push・PR の作成まで進むことを求めるテストを足し、現行の実装ではタスクのコミットで止まることを確かめた。kit の外部操作に `untilDeadline` を足し、run の git commit・git push と gh pr create で使うようにした。

この変更で、push と PR の作成が止まらない場合の既存のテスト（REQ-182）が、1 操作の期限で止まらなくなって 2 件失敗した。仕様（Q-01 の回答 A）では、この 2 つは run の残り時間で止まる。そこで、この 2 段階だけ、偽のコマンドを run 全体の予算（8 秒）より長く止め、全体の期限で止まることを確かめる形に直した。期待値（終了コード 1、実行時間の上限、証拠と PR の数、再試行での再利用）は変えていない。全体の期限を待つので、この 2 件だけテストの時間の上限を 30 秒にした。kit の単体のテストも足し、external-budget の 14 件と process の 12 件が成功した。

## 2.1 文書

resources.md・run-recovery.md・security.md の 1 操作の期限の説明に、git commit・git push・gh pr create を除くことを書き、changeset を足した。

## 完了ゲート

`pnpm -s verify --change relax-commit-push-budget --done` は exit 0。lint・型検査・838 件のテストと全 REQ の対応が成功した。
