# TDD実行記録

## 1.1・1.2 ガード

include の先の設定に core.fsmonitor を書く場合、リンク先のないフックがある場合、import とコメントの assert を消す場合の 3 件のテストを足し、現行の実装で 3 件とも失敗することを確かめた（1 件目は止まらずにコミットし、2 件目は ENOENT で落ち、3 件目は検査を減らしたとして止まった）。同じガードのファイルを直すので、2 つのタスクは 1 回の変更で行った。git config --list --show-origin の出力も比べ、フックのリンクはたどらずに比べ、検査の行からコメントと import・require を除いて、runner の 296 件が成功した。

## 2.1 文書

security.md の比較の範囲と検査の行の説明を直し、changeset を足した。

## 完了ゲート

`pnpm -s verify --change fix-guard-review-findings --done` は exit 0。lint・型検査・836 件のテストと全 REQ の対応が成功した。
