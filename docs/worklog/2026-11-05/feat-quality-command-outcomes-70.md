# W1-11 前提：品質コマンドの任意通知

1. `expose-quality-command-outcomes` のタスク1.1〜3.2を実施し、[PR #446](https://github.com/loomake/loomake/pull/446)にmainの設定読取分類・C1・固定要約APIを統合した。独立Opus R2は重大0・軽微1・情報4件で、軽微指摘に従い、任意API追加のchangesetをADR 0002どおりpatchへ直した。
2. main統合後の通常ローカル完了ゲートは実終了0・21項目PASSで、全件3,514成功・失敗0・既存保留8だった。仕様ゲート15項目・関連161試験・今回の配布物を使う公開型コンパイルも成功した。
3. 軽微M1（null・空文字の無通知）とM2（仕様検査の外部操作の無通知）の試験補足は[Issue #447](https://github.com/loomake/loomake/issues/447)の`deferred-after-1116`で追跡し、未回答の確認事項と未承認の仮定はない。通知だけではshell子孫・bail・テスト全件の完了を証明できない。
4. R2後の変更は指摘に沿うchangesetとこの記録だけであり、最終headの必須CI・kitの3 OSを確認してから受け入れる。C2親の全要件・元の35 Scenarioと補足2件・C3移管を未完了のまま保持し、前提変更のmain受入・同期とarchive後にC2を再開する。

| PR | 設計待ち | 実装 | CI待ち | レビュー往復回数 | マージまで |
|---|---|---|---|---|---|
| [#446](https://github.com/loomake/loomake/pull/446) | 補足設計取得済み | main統合・ローカル完了 | R2対象でgate成功・Windowsの既存試験が時間切れ、修正後headは未実施 | 1往復（初回1回・R2実施済み） | 未マージ |
