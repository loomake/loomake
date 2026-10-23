# Trace: fix-review-findings-2

<!--
このファイルは loomake verify が読む。表の列の順番と見出し名は変えないこと。
状態の値：反映済 / 確認待ち / 範囲外 / 既存仕様で充足
この change はレビューの指摘を直すもので、新しい REQ は振らない。既存の REQ の Requirement を変える。
A の番号はこの change の中の通し番号にする。
-->

## 入力文書

| 文書 | 版 | 日付 |
|---|---|---|
| review.md（2 回目のリポジトリ全体のレビュー）の指摘 1〜8 | - | 2026-10-23 |
| docs/requirements/mvp-v0.7.md（Loomake MVP 要件定義書（core・kit）） | v0.7 | 2026-10-22 |
| docs/requirements/trace-v0.1.md（trace 要件定義書） | v0.1 | 2026-10-23 |
| docs/requirements/runner-v0.1.md（run 要件定義書） | v0.1 | 2026-10-23 |

## 要件台帳

| ID | 出典 | 種別 | 要約（原文に忠実に） | 状態 | 反映先 |
|---|---|---|---|---|---|
| REQ-041 | 要件定義書 v0.7 §5.3 F-VER-08 | 機能 | 合格なら終了コード 0、不合格なら 1、使い方の誤りなら 2 を返すこと | 反映済 | specs/verify/spec.md |
| REQ-066 | trace 要件定義書 v0.1 §3.1 TRC-REC-01 | 機能 | `loomake trace record --change <id>` で `verify --done` を実行し、結果をコミットの SHA・日時と合わせて `.loomake/evidence/<change-id>/` に保存すること | 反映済 | specs/trace-record/spec.md |
| REQ-070 | trace 要件定義書 v0.1 §3.2 TRC-RPT-01 | 機能 | `loomake trace report --change <id>` で、要件ごとに出典・対応する Requirement・テスト・最後の検査結果を並べた表を出力すること | 反映済 | specs/trace-report/spec.md |
| REQ-073 | trace 要件定義書 v0.1 §3.2 TRC-RPT-04 | 機能 | レポートに、使った証拠の記録（日時・SHA）を記載すること | 反映済 | specs/trace-report/spec.md |
| REQ-094 | run 要件定義書 v0.1 §3.1 RUN-PRE-02 | 機能 | 作業ツリーに未コミットの変更があるときは、実装を始めないこと | 反映済 | specs/run/spec.md |
| REQ-101 | run 要件定義書 v0.1 §3.2 RUN-LOOP-06 | 機能 | `--engine` でエンジンを選べること。初版は `claude-code` に対応する | 反映済 | specs/run/spec.md |
| REQ-105 | run 要件定義書 v0.1 §3.3 RUN-STOP-02 | 機能 | 実行時間が上限（既定 60 分）に達したら止まること | 反映済 | specs/run/spec.md |
| REQ-109 | run 要件定義書 v0.1 §3.4 RUN-GRD-01 | 機能 | テストファイルの削除と、skip・todo の追加を差分から検出したら止まること | 反映済 | specs/run-guards/spec.md |
| REQ-111 | run 要件定義書 v0.1 §3.4 RUN-GRD-03 | 機能 | `openspec/specs/` と trace.md の変更を検出したら止まること | 反映済 | specs/run-guards/spec.md |

## 確認事項

<!-- 回答 欄が空で ブロッキング = yes の行があると、verify の仕様ゲートは失敗する。回答を書いたら、回答者（名前の代わりに役割でもよい）と回答日（YYYY-MM-DD）も書く -->

| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 | 回答者 | 回答日 |
|---|---|---|---|---|---|---|---|---|

## 仮定

<!-- 承認 欄が空の仮定は verify で警告になる（失敗にはしない）。承認したら、承認者（名前の代わりに役割でもよい）と承認日（YYYY-MM-DD）も書く -->

| ID | 関連 | 仮定の内容 | 理由 | 承認 | 承認者 | 承認日 |
|---|---|---|---|---|---|---|
| A-01 | REQ-111 | `<openspecDir>/changes/` の下のファイルは、trace.md に限らずすべて（proposal.md・design.md・tasks.md・差分仕様）を検出の対象にする。完了ゲートの直しのあいだは、run が完了にした完了ゲートのタスクを、エンジンを呼ぶ前に元に戻しておき、run 自身の変更を検出しないようにする | タスクを完了にするのは run（REQ-099）で、エンジンへの指示でも change の文書を書き換えないよう決めている（REQ-098）。指摘 1・2 | | | |
| A-02 | REQ-105 | 完了ゲートの品質コマンドには、run を始めてからの残り時間を spawnSync の timeout として渡す。時間切れで止めたときは、品質コマンドの不合格ではなく「実行時間の上限に達しました」を理由に止まる | 直しの回数を使い切る前に、時間の上限で止まるべきため。指摘 3 | | | |
| A-03 | REQ-094 | `tests.report` のファイルが除外されているかは `git check-ignore` で調べる。除外されていなければ、未コミットの変更の確認と同じく、実装を始める前に止まる。init の案内は変えない | レポートがコミットに入ると、完了ゲートのあと作業ツリーが変わったままになり、原因と違う理由で止まる。run の側で確かめれば、init を使わないプロジェクトでも防げる。指摘 4 | | | |
| A-04 | REQ-109 | skip・todo とみなすのは、`it`・`test`・`describe`・`suite` のあとに、`.concurrent` などの修飾をはさんで `.skip`・`.todo`・`.skipIf`・`.runIf` が続く書き方とする。`.runIf` は条件しだいで実行するが、条件で実行を止められるので検出する。承認するかは人が差分を見て決める（REQ-112） | AGENTS.md 4 章の「テストを skip する」を防ぐ。指摘 5 | | | |
| A-05 | REQ-041, REQ-066, REQ-070, REQ-101 | change-id の検査は kit に 1 つの関数として置き、verify・run・trace record・trace report から呼ぶ。`/`・`\` を含む値と、`..` を含む値を使い方の誤りにする | ci-gate.mjs と同じ扱いにそろえ、`.loomake/evidence/` の外に書き出さないようにする。指摘 6 | | | |
| A-06 | REQ-073 | 読めない証拠の記録が 1 つでもあれば、いちばん新しい記録が読めても使い方の誤りにする | 記録した日時を比べるには、すべての記録を読む必要がある。指摘 7 | | | |
