# add-trace-report

## Why
trace.md と証拠の記録から「どの要件を、どのテストで、いつ確かめたか」を、顧客に渡せる検収レポートにまとめる。確認事項への回答と仮定の承認も、合意の記録として載せる。これで、実装を人が行っても AI が行っても、kit と trace だけで「要件、実装、証拠」が一周する。出典：trace 要件定義書 v0.1 §1、§3.2、§3.3

## What Changes
- `loomake trace report --change <id>` を追加する。要件ごとに出典・対応する Requirement・テスト・最後の検査結果を並べる（REQ-070、REQ-071）
- 冒頭に、テストのない要件・不合格の要件・確認待ちの要件を一覧で示す（REQ-072。テストがない要件と不合格の要件は 1 つにまとめる）
- 使った証拠の記録の日時と SHA を載せる（REQ-073）
- Markdown と JSON の形式で出力する（REQ-074）
- 確認事項と仮定の一覧を合意の記録として載せる（REQ-077〜REQ-079。回答者・日付は add-agreement-columns で足す列から読む）

## Non-goals
- REQ-064：顧客による承認の操作と電子署名（trace はレポートを渡すところまで）
- REQ-065：見積もりと請求
- 後のフェーズ：REQ-075（HTML の出力）、REQ-076（`--audience customer`）、REQ-080（git の履歴からの合意の日時）、REQ-081・REQ-082（リリース単位の集約）、REQ-087（HTML を 1 つのファイルで完結させる）

## Impact
- 影響する capability：trace-report（新規）
- 影響するコード：`packages/trace/`、CLI の trace サブコマンド
