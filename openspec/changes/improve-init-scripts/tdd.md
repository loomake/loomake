# TDD実行記録

## 1.1・1.2 init

script の有無とテストランナーの判定のテストを 7 件足し、現行の実装で 4 件が失敗することを確かめた（scripts がない場合・すべてある場合・どちらのテストランナーもない場合は、これまでの動作で成功する）。2 つのタスクは同じ init の出力を変えるので、1 回の変更で行った。package.json の scripts と依存を読み、ある script のコマンドだけを書き、使っているテストランナーの例だけを示すようにして、CLI と kit の 204 件が成功した。既存の loomake.config.json を上書きしなかったときは、書かなかった名前の案内を出さない。

## 2.1 文書

changeset を足した。init の出力を説明する usage.md と quickstart.md は利用者が編集中なので変えず、利用者に知らせる。for-agents.md は init の出力を説明していないので変えていない。

## 完了ゲート

`pnpm -s verify --change improve-init-scripts --done` は exit 0。lint・型検査・657 件のテストと全 REQ の対応が成功した。
