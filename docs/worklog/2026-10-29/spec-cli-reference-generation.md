# CLIリファレンス生成の計画

1. やったこと：[Issue #104](https://github.com/loomake/loomake/issues/104)のCLI残作業をchange `add-cli-reference-generation`（REQ-323〜325）へ計画し、タスク1.1を完了した。main `684abf0`を基準に全planning artifactsを用意し、quality側は読み取り参照だけとした。
2. verify の結果：change strict・全体strict 34/34・spec-onlyはexit 0。yomiyasuのrun/verifyと計画差分を照合した。製品コード・試験・設定・主仕様は変更しておらず、完了ゲートは未実行。
3. 残っている確認事項・仮定：人の新しい仕様判断はない。quality生成の受入とreference-docsの主仕様反映が実装開始の必須依存であり、タスク1.2以降は未着手。
4. 次にやること：管理役が計画を確認し、依存受入後に別のapply作業を指示する。この作業ではPRを作成しない。
