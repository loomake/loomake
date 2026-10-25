# trace-report Specification

## Purpose
`loomake trace report` がリリースレポートを出すときの振る舞いを定める。要件ごとの結果の表、冒頭の要注意の一覧、使った証拠の記載、確認事項と仮定の一覧と空の欄の警告、出力の形式、同じ入力から同じレポートを出すこと、性能、日本語、動作環境、実行時依存を含む。

## Requirements

### Requirement: 範囲外と既存仕様で充足の要件
要件ごとの結果の表は、状態が「範囲外」と「既存仕様で充足」の要件も、状態を付けて含める SHALL。

Source: REQ-071

#### Scenario: 範囲外の要件
- **WHEN** 状態が範囲外の REQ-075 を持つ change に `loomake trace report` を実行する
- **THEN** 表に REQ-075 の行があり、状態に「範囲外」と書かれている

#### Scenario: 既存仕様で充足の要件
- **WHEN** 状態が既存仕様で充足の要件を持つ change に `loomake trace report` を実行する
- **THEN** 表にその要件の行があり、状態に「既存仕様で充足」と書かれている

### Requirement: 使った証拠の記載
レポートは、使った証拠の記録の、記録した日時・検査したコミットの SHA・コミットの日時を記載する SHALL。証拠の記録に、JSON として読めないファイルと、`schemaVersion` が読める版でないか、レポートが使う欄の形が違うか、`change` が change-id と違うファイルがあるときは、そのファイルのパスを日本語で示し、使い方の誤りとして終了コード 2 を返す SHALL。

Source: REQ-073

#### Scenario: 記録の情報が載る
- **WHEN** SHA が `0123456789ab…` の記録を使って `loomake trace report` を実行する
- **THEN** レポートに、その記録の記録した日時・SHA・コミットの日時が載る

#### Scenario: 読めない記録がある
- **WHEN** `.loomake/evidence/c1/` に JSON として壊れたファイルがある change に `loomake trace report --change c1` を実行する
- **THEN** そのファイルのパスと、読めないことが日本語で表示され、スタックトレースは出ず、終了コードは 2 である

#### Scenario: 読めない版の記録がある
- **WHEN** `.loomake/evidence/c1/` に `schemaVersion` が 2 の記録がある change に `loomake trace report --change c1` を実行する
- **THEN** そのファイルのパスと、読める版でないことが日本語で表示され、終了コードは 2 である

#### Scenario: 形の違う記録がある
- **WHEN** `.loomake/evidence/c1/` に `verify.results` のない記録がある change に `loomake trace report --change c1` を実行する
- **THEN** そのファイルのパスと、`verify.results` の形が違うことが日本語で表示され、スタックトレースは出ず、終了コードは 2 である

#### Scenario: ほかの change の記録がある
- **WHEN** `.loomake/evidence/c1/` に `change` が c2 の記録がある change に `loomake trace report --change c1` を実行する
- **THEN** そのファイルのパスと、ほかの change の記録であることが日本語で表示され、終了コードは 2 である

### Requirement: 出力の形式
`loomake trace report` は、`--format md` で Markdown を、`--format json` で JSON を標準出力に出す SHALL。`--format` を省いたときは Markdown にする SHALL。`--format html` を指定したときは、HTML は次の版で対応する旨を日本語で表示し、終了コード 2 を返す SHALL。

Source: REQ-074

#### Scenario: Markdown で出す
- **WHEN** `loomake trace report --change c1 --format md` を実行する
- **THEN** Markdown の表を含むレポートが出力され、終了コードは 0 である

#### Scenario: JSON で出す
- **WHEN** `loomake trace report --change c1 --format json` を実行する
- **THEN** 要件ごとの行と使った証拠の記録を含む JSON が出力される

#### Scenario: HTML はまだ出せない
- **WHEN** `loomake trace report --change c1 --format html` を実行する
- **THEN** HTML は次の版で対応する旨が表示され、終了コードは 2 である

### Requirement: 同じ入力からは同じレポート
同じ trace.md・差分仕様・証拠の記録からは、`loomake trace report` は毎回同じ内容を出力する SHALL。レポートには作った日時を入れず、表の行は REQ の番号順に並べる SHALL。

Source: REQ-085

#### Scenario: 2 回出力する
- **WHEN** 入力を変えずに、時刻を変えて `loomake trace report` を 2 回実行する
- **THEN** 2 回の出力は 1 文字も違わない

### Requirement: オフラインでの動作
`loomake trace report` は、ネットワークに接続せずに動く SHALL。

Source: REQ-084

#### Scenario: ネットワークがない
- **WHEN** ネットワークに接続できない状態で `loomake trace report --change c1` を実行する
- **THEN** レポートが出力される

### Requirement: 日本語のレポート
`loomake trace report` が出すレポートの見出し・列名・説明とメッセージは、日本語で書かれている SHALL。

Source: REQ-088

#### Scenario: 見出しが日本語
- **WHEN** `loomake trace report --change c1` を実行する
- **THEN** レポートの見出しと表の列名は日本語である

### Requirement: trace report の実行時依存
trace report を含む `@loomake/trace` の実行時依存は `@loomake/core` と `@loomake/kit` のみとする SHALL。

Source: REQ-083

#### Scenario: trace の依存
- **WHEN** `packages/trace/package.json` の `dependencies` を読む
- **THEN** `@loomake/core` と `@loomake/kit` 以外が含まれない

### Requirement: 冒頭の要注意の一覧
レポートの冒頭に、状態が反映済で、使った証拠の記録の中に合格したテストのない要件と、状態が確認待ちの要件を、それぞれ一覧で示す SHALL。テストがない要件と、テストが不合格だった要件は分けずに、「合格したテストのない要件」として 1 つにまとめる SHALL。使った証拠の記録の検査が不合格のときは、冒頭に、検査が不合格であることと、不合格になった検査の名前を示す SHALL。要注意の要件も不合格の検査もないときは、ないことを示す SHALL。

Source: REQ-072

#### Scenario: 合格したテストのない要件がある
- **WHEN** 反映済の REQ-070 に、証拠の記録の中で合格したテストがない change のレポートを作る
- **THEN** 冒頭の「合格したテストのない要件」の一覧に REQ-070 が挙がる

#### Scenario: 確認待ちの要件がある
- **WHEN** 状態が確認待ちの REQ-072 を持つ change のレポートを作る
- **THEN** 冒頭の「確認待ちの要件」の一覧に REQ-072 が挙がる

#### Scenario: 証拠の検査が不合格
- **WHEN** 反映済の要件すべてに合格したテストがあり、確認待ちの要件もないが、lint が不合格だった証拠の記録で change のレポートを作る
- **THEN** 冒頭に、検査が不合格であることと「command: lint」が書かれ、要注意の要件がないとは書かれない

#### Scenario: どちらもない
- **WHEN** 反映済の要件すべてに合格したテストがあり、確認待ちの要件がなく、検査が合格した証拠の記録で change のレポートを作る
- **THEN** 冒頭に、要注意の要件がないことが書かれる

### Requirement: 確認事項の一覧
レポートは、確認事項ごとに ID・質問・回答・回答者・回答日を一覧にする SHALL。

Source: REQ-077

#### Scenario: 確認事項が並ぶ
- **WHEN** 回答者が「プロダクト責任者」、回答日が 2026-10-23 の Q-01 を持つ change のレポートを作る
- **THEN** 確認事項の一覧に Q-01 の質問・回答・「プロダクト責任者」・2026-10-23 が並ぶ

### Requirement: 仮定の一覧
レポートは、仮定ごとに ID・内容・承認者・承認日を一覧にする SHALL。

Source: REQ-078

#### Scenario: 仮定が並ぶ
- **WHEN** 承認者が「開発リーダー」、承認日が 2026-10-23 の A-01 を持つ change のレポートを作る
- **THEN** 仮定の一覧に A-01 の内容・「開発リーダー」・2026-10-23 が並ぶ

### Requirement: 合意の欄が空のときの警告
回答のある確認事項で回答者か回答日が空のとき、または承認欄のある仮定で承認者か承認日が空のとき、レポートはその ID と空の欄を警告として示す SHALL。回答も承認もまだない行は、この警告の対象にしない SHALL。

Source: REQ-079

#### Scenario: 回答者が空
- **WHEN** 回答はあるが回答者が空の Q-02 を持つ change のレポートを作る
- **THEN** Q-02 の回答者が空であることが警告として示される

#### Scenario: 列のない古い trace.md
- **WHEN** 回答者・回答日の列がない trace.md で、回答のある Q-01 を持つ change のレポートを作る
- **THEN** レポートは作られ、Q-01 の回答者と回答日が空であることが警告として示される

#### Scenario: 未回答の行
- **WHEN** 回答が空の Q-03 を持つ change のレポートを作る
- **THEN** Q-03 は回答者・回答日の警告の対象にならない

### Requirement: report の性能
要件 500 件の change のレポートを、`loomake trace report` は 5 秒以内に出力する SHALL。

Source: REQ-086

#### Scenario: 大きな change
- **WHEN** 要件 500 件と、その証拠の記録を持つ見本の change に `loomake trace report` を実行する
- **THEN** 5 秒以内に出力が終わる

### Requirement: 記録のあとで変わった文書
レポートは、証拠の記録に保存した文書と、いまの change のディレクトリにある trace.md と差分仕様を比べる SHALL。内容が違う文書、記録にあっていまはない文書、いまあって記録にない文書があれば、冒頭の要注意の一覧に「記録のあとで変わった文書」としてパスを並べる SHALL。いまの文書の内容は、表には使わない SHALL。

Source: REQ-129

#### Scenario: 差分仕様が変わっている
- **WHEN** 証拠を記録したあとで `specs/x/spec.md` を書き換えた change のレポートを作る
- **THEN** 冒頭の「記録のあとで変わった文書」に `specs/x/spec.md` が挙がる

#### Scenario: 文書が変わっていない
- **WHEN** 証拠を記録したあとで trace.md と差分仕様を変えていない change のレポートを作る
- **THEN** 「記録のあとで変わった文書」には何も挙がらない

### Requirement: 古い形式の証拠の記録
使う証拠の記録に文書が保存されていないとき、レポートは、いまの change のディレクトリにある trace.md と差分仕様から表を作る SHALL。そのうえで、冒頭の要注意の一覧に、検証した時点の仕様との対応を確かめていないことを示す SHALL。反映済で合格したテストのある要件の最後の検査結果は、「合格（仕様との対応は未確認）」とする SHALL。

Source: REQ-130

#### Scenario: 文書のない記録を使う
- **WHEN** 文書が保存されていない記録で、反映済の REQ-012 に合格したテストがある change のレポートを作る
- **THEN** REQ-012 の最後の検査結果は「合格（仕様との対応は未確認）」で、冒頭に仕様との対応を確かめていないことが書かれる

### Requirement: 検査の範囲の説明
レポートは、「自動検査は、要件 ID を含む成功したテストの存在を確認しています。テスト内容の妥当性と、要件を満たしているかの判断にはレビューが必要です。」という説明を、要件ごとの結果の表より前に載せる SHALL。

Source: REQ-131

#### Scenario: 説明が載る
- **WHEN** `loomake trace report --change c1` を実行する
- **THEN** 要件ごとの結果の表より前に、検査の範囲の説明が載る

### Requirement: 証拠の実行時検証
証拠を読むときは必須値・対応するschemaVersion・有効な日時・対象changeと検証結果の対応を検証する SHALL。documentsがある場合はパスの重複と内容のSHA-256の不一致を拒否する SHALL。不正な証拠はファイル名と理由を日本語で示し、UsageErrorとして返す SHALL。documentsのない既存の証拠も読む SHALL。

Source: REQ-142

#### Scenario: 構文が正しい不正データ
- **WHEN** 証拠がnull・空のオブジェクト・不正な検証結果・不正な日時のどれかである
- **THEN** TypeErrorを出さず、ファイル名と理由を示して終了コード2で返す

#### Scenario: 対象が違う
- **WHEN** 証拠か検証結果のchangeが指定したchangeと違う
- **THEN** 証拠を採用せずエラーとして返す

#### Scenario: 内容の不一致
- **WHEN** 保存した文書のcontentとsha256が一致しない
- **THEN** レポートを作らずエラーとして返す

#### Scenario: 古い証拠
- **WHEN** documentsのない既存の正しい証拠を読む
- **THEN** 従来どおり仕様との対応は未確認と表示する

### Requirement: Node.js の下限
`loomake trace report` は、Node.js 22.12 以上で動作する SHALL。

Source: REQ-142

#### Scenario: Node.js 22.12 で動く
- **WHEN** Node.js 22.12 の環境で trace report のテストを実行する
- **THEN** テストが合格する

### Requirement: レポートを作る change の探し方
change は進行中の change から探し、なければ archive から探す SHALL。change-id が OpenSpec の change 名の形でないときと、`archive` のときは、使い方の誤りとして終了コード 2 を返す SHALL。

Source: REQ-213

#### Scenario: archive した change
- **WHEN** `archive/2026-10-23-c1` にある change c1 に `loomake trace report --change c1` を実行する
- **THEN** archive の change の証拠の記録からレポートが作られる

#### Scenario: パスの区切りを含む change-id
- **WHEN** `loomake trace report --change ../c1` を実行する
- **THEN** change-id にパスの区切りを含められないと日本語で表示され、終了コードは 2 である

### Requirement: 要件ごとの結果の表の出力
`loomake trace report --change <id>` は、`.loomake/evidence/<change-id>/` のいちばん新しい記録を使い、その記録に保存した trace.md の要件台帳の要件ごとに、出典・状態・対応する Requirement・テストファイル・最後の検査結果を 1 行に並べた表を、リリースレポートとして出力する SHALL。Markdown のレポートの題は「リリースレポート」、要件ごとの表の見出しは「要件ごとの結果」とし、題と見出しの固定文言に「検収」の語を使わない SHALL。証拠に保存した要約・質問・回答・仮定の原文は置き換えずに載せる SHALL。対応する Requirement は、その記録に保存した差分仕様で、その要件を `Source:` に持つ Requirement の名前とする SHALL。テストファイルと最後の検査結果は、同じ記録から取る SHALL。記録に文書が保存されていないときの扱いは、「古い形式の証拠の記録」に従う SHALL。

Source: REQ-070

#### Scenario: 要件の行が並ぶ
- **WHEN** REQ-070 を `Source:` に持つ Requirement「表の出力」があり、証拠の記録で REQ-070 に tests/report.test.ts が挙がっている change に `loomake trace report --change c1` を実行する
- **THEN** 表に REQ-070 の行があり、出典・状態・「表の出力」・tests/report.test.ts・最後の検査結果が並ぶ

#### Scenario: レポートの題と表の見出し
- **WHEN** 要約に「検収」の語を含む要件を持つ change に `loomake trace report --change c1` を Markdown で実行する
- **THEN** 題が「リリースレポート：c1」、要件ごとの表の見出しが「要件ごとの結果」で、題と見出しの固定文言に「検収」の語はなく、要約の「検収」は原文のまま表に載る

#### Scenario: いちばん新しい記録を使う
- **WHEN** 記録した日時の違う記録が 2 つある change に `loomake trace report` を実行する
- **THEN** 新しいほうの記録のテストファイルと検査結果が使われる

#### Scenario: 証拠の記録がない
- **WHEN** `.loomake/evidence/c1/` に記録がない change に `loomake trace report --change c1` を実行する
- **THEN** `loomake trace record` を先に実行するよう日本語で案内し、終了コードは 1 である

#### Scenario: 記録のあとで要約を変える
- **WHEN** 証拠を記録したあとで、trace.md の REQ-070 の要約を書き換えて `loomake trace report --change c1` を実行する
- **THEN** 表の REQ-070 の要約は記録したときの要約で、書き換えたあとの要約は表に載らない

### Requirement: 使う証拠だけを読む
`loomake trace report` は、`.loomake/evidence/<change-id>/` の証拠のうち、ファイル名の日時（`YYYYMMDDTHHMMSSZ`、秒まで）がいちばん新しい秒の証拠だけを読んで検証する SHALL。その秒の証拠が複数あるときは、それぞれの先頭（4KiB）だけを読んで、JSON の最上位の記録した日時（`recordedAt`、ミリ秒まで）を比べ、いちばん新しいものだけを全部読んでレポートに使う SHALL。先頭で最上位の記録した日時を見つけられない候補は、捨てずに全部読んで検証してから比べる SHALL。候補の先頭と全部の読み取りは、同じ読み取りの予算で数え、予算を超えたら古い証拠に戻らずに、対象を示して止まる SHALL。ほかの証拠は読まない SHALL。証拠の数が増えても、読み取りの合計の上限で失敗しない SHALL。

Source: REQ-209

#### Scenario: 古い証拠が多い
- **WHEN** 1 つは小さいが、合わせると 128MiB を超える古い証拠が多数ある change に `loomake trace report` を実行する
- **THEN** いちばん新しい証拠を使ってレポートを出し、終了コードは 0 である

#### Scenario: 最新の証拠が壊れている
- **WHEN** ファイル名の日時がいちばん新しい証拠が JSON として壊れている
- **THEN** そのファイルを日本語で示し、終了コード 2 を返す

#### Scenario: 同じ秒の証拠
- **WHEN** 同じ秒に記録した証拠が 2 つあり、記録した日時が `.100Z` の証拠は合格、`.900Z` の証拠は不合格である
- **THEN** `.900Z` の証拠を使い、レポートの検査の結果は不合格になる

#### Scenario: 同じ秒の大きな証拠
- **WHEN** 同じ秒に記録した 45MiB の証拠が 3 つあり、合わせると 128MiB を超える
- **THEN** 読み取りの合計の上限で失敗せず、記録した日時がいちばん新しい証拠でレポートを出す

#### Scenario: 記録した日時が先頭にない
- **WHEN** 同じ秒の新しい証拠で、記録した日時の前に 5KB の項目がある
- **THEN** その証拠を全部読んで比べ、新しい証拠でレポートを出す
