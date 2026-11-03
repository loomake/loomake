# verify Specification

## Purpose
`loomake verify` が change を検査する内容を定める。実装に入ってよいかを確かめる仕様ゲートと、完了を確かめる完了ゲートの検査項目、品質コマンドの実行、JSON 出力と終了コード、日本語のメッセージ、実行時依存の範囲、性能を含む。

## Requirements

### Requirement: ブロッキング確認事項の検査
`loomake verify --change <id> --spec-only` は、trace.md にブロッキングで回答が空の確認事項があるとき、不合格にする SHALL。ブロッキング列の値は yes・no・はい・いいえ のどれか（英字の大文字と小文字は区別しない）とし、yes と はい をブロッキングとみなす SHALL。それ以外の値（空を含む）の確認事項があるときは、その ID と値を出して不合格にする SHALL。trace.md または差分仕様に解析エラー（節や表が無いなど）があるときも、そのファイル名・行番号・内容を出して不合格にする MUST。

Source: REQ-034

#### Scenario: 未回答のブロッキング確認事項がある
- **WHEN** ブロッキング = yes で回答が空の Q-01 を持つ change に `--spec-only` を実行する
- **THEN** 不合格となり、Q-01 の ID・関連する要件・質問が出力され、終了コードは 1 である

#### Scenario: すべて回答済み
- **WHEN** ブロッキング = yes の確認事項がすべて回答済みの change に `--spec-only` を実行する
- **THEN** この検査は合格する

#### Scenario: ブロッキングでない確認事項
- **WHEN** ブロッキングが no で回答が空の確認事項だけを持つ change に `--spec-only` を実行する
- **THEN** この検査は合格する

#### Scenario: 確認事項の節名が崩れている
- **WHEN** 未回答のブロッキング確認事項 Q-01 を持つ trace.md の節名を `## 確認事項（未回答）` に変えた change に `--spec-only` を実行する
- **THEN** 「確認事項」の節が無いことを trace.md の名前とともに出して不合格になり、終了コードは 1 である

#### Scenario: 差分仕様の解析エラー
- **WHEN** RENAMED の FROM に対応する TO が無い spec.md を持つ change に `--spec-only` を実行する
- **THEN** その spec.md のファイル名と行番号を出して不合格になる

#### Scenario: ブロッキング列が はい
- **WHEN** ブロッキング = はい で回答が空の Q-01 を持つ change に `--spec-only` を実行する
- **THEN** 不合格となり、Q-01 の ID・関連する要件・質問が出力され、終了コードは 1 である

#### Scenario: ブロッキング列の値が使えない
- **WHEN** ブロッキング = 要 の Q-01 を持つ change に `--spec-only` を実行する
- **THEN** Q-01 と値「要」を出して不合格になり、終了コードは 1 である

### Requirement: 仕様の整合性の検査
仕様ゲートは Source の無い Requirement、台帳に無い要件 ID を Source に持つ Requirement、Scenario の無い Requirement、状態が反映済なのに仕様のどの Requirement からも参照されていない要件を、不合格にする SHALL。

Source: REQ-035

#### Scenario: Source が無い
- **WHEN** `Source:` 行の無い Requirement を持つ change に `--spec-only` を実行する
- **THEN** その Requirement の名前を含めて不合格になる

#### Scenario: 台帳に無い要件 ID
- **WHEN** Source に台帳に載っていない REQ-999 を書いた Requirement を持つ change に `--spec-only` を実行する
- **THEN** `Requirement → REQ-999` を含めて不合格になる

#### Scenario: Scenario が無い
- **WHEN** Scenario の無い Requirement を持つ change に `--spec-only` を実行する
- **THEN** その Requirement の名前を含めて不合格になる

#### Scenario: 反映済なのに仕様に無い
- **WHEN** 台帳で反映済の REQ-007 が、どの Requirement の Source にも無い change に `--spec-only` を実行する
- **THEN** REQ-007 を含めて不合格になる

### Requirement: 仕様ゲートの警告
仕様ゲートは承認が空の仮定と、状態が確認待ちの要件を警告として表示し、警告だけでは不合格にしない SHALL。

Source: REQ-036

#### Scenario: 警告のみ
- **WHEN** 未承認の仮定 A-01 と確認待ちの REQ-002 だけが問題である change に `--spec-only` を実行する
- **THEN** A-01 と REQ-002 が警告として出力され、終了コードは 0 である

### Requirement: openspec validate の実行
verify は、OpenSpec CLI が見つかるとき `openspec validate <id> --strict` を実行し、その結果をゲートに含める SHALL。

Source: REQ-037

#### Scenario: validate が失敗する
- **WHEN** `openspec validate --strict` が失敗する change に `--spec-only` を実行する
- **THEN** 不合格となり、validate の出力が詳細に含まれる

#### Scenario: OpenSpec CLI が無い
- **WHEN** OpenSpec CLI が見つからない環境で `loomake.config.json` の `openspecValidate` が `auto` のまま `--spec-only` を実行する
- **THEN** 警告が表示され、この検査だけでは不合格にならない

### Requirement: 完了ゲート
`--done` は、仕様ゲートに加えて、未完了のタスク、状態が確認待ちの要件、テストの無い要件を不合格にする SHALL。tasks.md にタスクが 1 つも無いときも不合格にする SHALL。テストの有無は、test コマンドが書き出したテストランナーの JSON レポートで、成功したテストの名前にある `[REQ-xxx]` で判定する MUST。

Source: REQ-038

#### Scenario: 未完了タスクがある
- **WHEN** `- [ ]` のタスクが残る change に `--done` を実行する
- **THEN** 未完了タスクの行を含めて不合格になる

#### Scenario: タスクが無い
- **WHEN** タスクが 1 つも無い tasks.md を持つ change に `--done` を実行する
- **THEN** タスクが無いことを含めて不合格になる

#### Scenario: 確認待ちが残っている
- **WHEN** 台帳に状態が確認待ちの要件が残る change に `--done` を実行する
- **THEN** その要件の ID を含めて不合格になる

#### Scenario: テストの無い要件
- **WHEN** 仕様で参照される REQ-012 を名前に含むテストが無い change に `--done` を実行する
- **THEN** 「テストが無い要件：REQ-012」を含めて不合格になる

#### Scenario: skip されたテスト
- **WHEN** REQ-012 を名前に含むテストが `it.skip` だけである change に `--done` を実行する
- **THEN** REQ-012 はテストが無い要件として不合格になる

#### Scenario: 修飾子が続く skip の中のテスト
- **WHEN** REQ-012 を名前に含むテストが `describe.skip.each(...)` の中にだけある change に `--done` を実行する
- **THEN** REQ-012 はテストが無い要件として不合格になる

#### Scenario: テスト名以外の文字列にだけある要件 ID
- **WHEN** REQ-012 がテストファイルの中の文字列（`const fixture = '[REQ-012]'` など）にだけあり、名前に REQ-012 を含むテストが無い change に `--done` を実行する
- **THEN** REQ-012 はテストが無い要件として不合格になる

#### Scenario: テストランナーが実行しないファイル
- **WHEN** REQ-012 を名前に含むテストが、テストランナーの実行対象に入っていないファイルにだけある change に `--done` を実行する
- **THEN** REQ-012 はテストが無い要件として不合格になる

#### Scenario: レポートが書き出されない
- **WHEN** 前回のレポートが `tests.report` に残っていて、今回の test コマンドがレポートを書き出さない設定で `--done` を実行する
- **THEN** 「要件ごとのテスト」が不合格になり、レポートが無いことが詳細に含まれる

### Requirement: 品質コマンドの実行
`--done` は、`loomake.config.json` の `commands`（lint・typecheck・test）を実行し、1 つでも失敗したら不合格にする SHALL。verify は、どのモードでも、loomake.config.json に知らないキーがあれば、そのキーを警告として表示する SHALL。知らないキーがあっても不合格にはしない SHALL。

Source: REQ-039

#### Scenario: コマンドが失敗する
- **WHEN** `commands.test` が終了コード 1 で終わる設定で `--done` を実行する
- **THEN** `command: test` が不合格になり、出力の末尾が詳細に含まれる

#### Scenario: すべて成功する
- **WHEN** 3 つのコマンドがすべて終了コード 0 で終わる設定で `--done` を実行する
- **THEN** 3 つの `command:` 検査がすべて合格する

#### Scenario: 知らないキーがある
- **WHEN** loomake.config.json に `comands` のキーがあるプロジェクトで `loomake verify` を実行する
- **THEN** 「loomake.config.json」の検査が警告になり、`comands` が表示され、ほかに不合格がなければ終了コードは 0 である

### Requirement: JSON 出力
`--json` を指定すると、verify は core のスキーマに沿った結果と、要件ごとのテストファイル一覧を JSON で標準出力に出す SHALL。

Source: REQ-040

#### Scenario: スキーマに沿った出力
- **WHEN** `--change <id> --done --json` を実行する
- **THEN** 標準出力は JSON のみで、`schemaVersion` を含み、core の JSON スキーマで検証できる

#### Scenario: 要件ごとのテストファイル
- **WHEN** REQ-012 を名前に含むテストが `tests/a.test.ts` にある change に `--done --json` を実行する
- **THEN** 出力の要件ごとの一覧で REQ-012 に `tests/a.test.ts` が含まれる

### Requirement: 終了コード
verify は、合格なら終了コード 0、不合格なら 1、使い方の誤りなら 2 を返す SHALL。`--change` の値が OpenSpec の change 名の形（英小文字・数字と、間に 1 つずつのハイフン）でないとき（`/`・`\`・`..` を含むときを含む）と、`archive` のときは、使い方の誤りとする SHALL。

Source: REQ-041

#### Scenario: 合格
- **WHEN** すべての検査が合格か警告である
- **THEN** 終了コードは 0 である

#### Scenario: 不合格
- **WHEN** 1 つ以上の検査が不合格になる
- **THEN** 終了コードは 1 である

#### Scenario: 使い方の誤り
- **WHEN** `--change` を付けずに `--spec-only` を指定する
- **THEN** 使い方が日本語で表示され、終了コードは 2 である

#### Scenario: パスの区切りを含む change-id
- **WHEN** `loomake verify --change ../../packages --spec-only` を実行する
- **THEN** change-id にパスの区切りを含められないと日本語で表示され、終了コードは 2 である

#### Scenario: change 名の形でない change-id
- **WHEN** `loomake verify --change 'c1&echo' --spec-only` を実行する
- **THEN** change-id の形が正しくないと日本語で表示され、`openspec validate` は呼ばれず、終了コードは 2 である

#### Scenario: archive を change-id にする
- **WHEN** `loomake verify --change archive --spec-only` を実行する
- **THEN** archive は change-id に使えないと日本語で表示され、終了コードは 2 である

### Requirement: change の省略
`--change` を省略した場合、verify は commands だけを実行する SHALL。

Source: REQ-042

#### Scenario: commands のみ
- **WHEN** `loomake verify` を引数なしで実行する
- **THEN** `commands` の各コマンドだけが実行され、仕様の検査は行われない

### Requirement: 日本語のメッセージ
verify のエラーメッセージと使い方の表示は日本語である SHALL。

Source: REQ-055

#### Scenario: 日本語の出力
- **WHEN** 存在しない change-id に `--spec-only` を実行する
- **THEN** 「change の存在」検査が日本語の説明つきで不合格になる

### Requirement: 実行時依存の範囲
`@loomake/kit` の実行時依存は `@loomake/core` と `yaml` だけとし、`loomake` の実行時依存は `@loomake/core`・`@loomake/kit`・`@loomake/trace`・`@loomake/runner` のみとする SHALL。

Source: REQ-047

#### Scenario: kit の依存
- **WHEN** `packages/kit/package.json` の `dependencies` を読む
- **THEN** `@loomake/core` が含まれ、`@loomake/core` と `yaml` 以外のパッケージが含まれない

#### Scenario: loomake の依存
- **WHEN** `packages/cli/package.json` の `dependencies` を読む
- **THEN** `@loomake/core`・`@loomake/kit`・`@loomake/trace`・`@loomake/runner` 以外が含まれない

### Requirement: verify の性能
テストファイル 1,000 個・要件 500 件の change で、commands を除く verify（`--done --skip-commands`）は 3 秒以内に終わる SHALL。この数値は暫定であり、実案件で計測したあと見直す。

Source: REQ-050

#### Scenario: 1,000 ファイル・500 要件
- **WHEN** 要件 500 件の change と、テストファイル 1,000 個を生成した一時ディレクトリで `verify --change <id> --done --skip-commands` を実行する
- **THEN** 3 秒以内に終わる

### Requirement: 同じ確認事項の回答の照合
仕様ゲートは、質問に「<change-id> の Q-xx と同じ質問」と書いた確認事項について、参照先の change の trace.md にある同じ ID の確認事項と回答を比べ、違えば不合格にする SHALL。片方の回答だけが空のときも違うとみなす SHALL。参照先は進行中の change から探し、なければ archive から探す SHALL。参照先の change か、その中の確認事項が見つからないときは不合格にする MUST。

Source: REQ-034

#### Scenario: 回答が同じ
- **WHEN** change B の Q-01 の質問に「（A の Q-01 と同じ質問）」とあり、change A の Q-01 と回答が同じ状態で、B に `--spec-only` を実行する
- **THEN** この検査は合格する

#### Scenario: 回答が違う
- **WHEN** change B の Q-01 の質問に「（A の Q-01 と同じ質問）」とあり、A と B で Q-01 の回答が違う状態で、B に `--spec-only` を実行する
- **THEN** 不合格となり、Q-01 と、A と B それぞれの回答が出力され、終了コードは 1 である

#### Scenario: 片方だけ回答がある
- **WHEN** change A の Q-01 には回答があり、印のある change B の Q-01 の回答が空の状態で、B に `--spec-only` を実行する
- **THEN** 不合格となる

#### Scenario: 参照先が archive にある
- **WHEN** 印の参照先の change A が `archive/2026-10-01-A` にあり、Q-01 の回答が同じ状態で、B に `--spec-only` を実行する
- **THEN** この検査は合格する

#### Scenario: 参照先が見つからない
- **WHEN** 印の参照先の change が進行中にも archive にもない状態で `--spec-only` を実行する
- **THEN** 不合格となり、見つからない change-id が出力される

#### Scenario: 印がない
- **WHEN** 別の change と同じ ID の Q-01 を持つが、質問に印がない change に `--spec-only` を実行する
- **THEN** 回答が違っても、この検査は不合格にしない

### Requirement: 要件モデルの検証結果を使う
verifyはcoreの要件と合意のモデルを検証し、変換時に不正な要件IDか状態を見つけたときはゲートを不合格にする SHALL。正常な入力のブロッキング質問、確認待ち、仮定の承認、テストの対応は既存の判定を維持する SHALL。

Source: REQ-150

#### Scenario: 不正な要件ID
- **WHEN** 台帳の要件IDが不正なchangeを検証する
- **THEN** モデルの整合性エラーとして不合格を返す

### Requirement: 品質コマンドを省いたことの表示
`--skip-commands` で品質コマンドを実行しなかったときは、結果に状態 `skip` の項目「品質コマンド」を加え、前回のテストのレポートで判定したことと、完了の確認には `--skip-commands` を付けずに実行することを detail に書く SHALL。人が読む表示の最後の行には、品質コマンドを実行していないことを書く SHALL。合否と終了コードは、これまでどおり不合格の項目の有無で決める SHALL。

Source: REQ-191

#### Scenario: 完了ゲートで品質コマンドを省く
- **WHEN** `verify --change <id> --done --skip-commands` を実行する
- **THEN** 結果に状態 `skip` の「品質コマンド」の項目があり、表示の最後の行に品質コマンドを実行していないことが書かれる

#### Scenario: JSON で品質コマンドを省く
- **WHEN** `verify --change <id> --done --skip-commands --json` を実行する
- **THEN** 出力の `results` に、状態 `skip` の「品質コマンド」の項目が含まれる

#### Scenario: 品質コマンドを実行する
- **WHEN** `--skip-commands` を付けずに `verify --change <id> --done` を実行する
- **THEN** 結果に「品質コマンド」の `skip` の項目は含まれない

### Requirement: テストランナーの探索範囲
ciの完了ゲートでテストランナーと版を確かめるとき、verifyは検証ルートから、そのルートを含むGit作業ツリーの最上位までの各ディレクトリのnode_modulesだけを探す MUST。作業ツリーの最上位より上、別の作業ツリー、作業ツリー外の探索位置から採用してはならない MUST NOT。最上位を確かめられない場合やルートを含まない場合は、検証ルートのnode_modulesだけを探す MUST。範囲内の探索位置から外部実体へのリンクは、外部実体であることだけを理由に除外してはならない MUST NOT。

Source: REQ-359

#### Scenario: 作業ツリーの外のランナーを採用しない
- **WHEN** ほかの設定と証拠が正常で、ルートを含む作業ツリーにテストランナーがなく、外側のディレクトリ、外側のリポジトリ、またはlinked worktreeに対する主checkoutにだけある
- **THEN** 外側のランナーと版を採用せず、ciの完了ゲートはINSUFFICIENT_EVIDENCEと終了コード1を返す

#### Scenario: 子プロジェクトから最上位のランナーを使う
- **WHEN** 検証ルートが作業ツリー内の子ディレクトリで、最上位のnode_modulesに実際のテストランナーがある
- **THEN** 探索範囲内のそのテストランナーと版をreceiptに使う

#### Scenario: 最上位を確かめられない
- **WHEN** Gitでない、gitを実行できない、最上位の出力や実パスを確かめられない、または最上位がルートを含まない
- **THEN** 検証ルートのnode_modulesだけを探し、その外の探索位置のランナーを採用しない

#### Scenario: 探索位置とリンク先を区別する
- **WHEN** 検証ルートがリンク経由で指定され、範囲内の探索位置のnode_modulesにあるランナーが作業ツリー外の実体へのsymlinkまたはjunctionである
- **THEN** 検証ルートの実パスに基づいて探索位置を比べ、範囲内の有効なpackage.jsonを使う。リンク先実体の照合はこの要件では行わない

### Requirement: 回答の反映漏れの案内
spec-onlyは、確認待ちの要件の案内で、確認事項の「関連」の列にその要件IDと完全に一致するIDを持つ確認事項のIDを、確認事項の表の順に重複なく要件IDのあとへ示す SHALL。関連する確認事項がない要件は要件IDだけを示す SHALL。回答が空でない確認事項の「関連」にある要件が確認待ちのときと、changeの差分仕様のコードブロックの外に回答が空でない確認事項のIDが、前後にASCII英数字やハイフンが続かず、より長い確認事項のIDの一部でもない形で、ID全体として残っているときは、それぞれを案内つきの合格として示す SHALL。これらの案内だけでは不合格・pending・要判断を立てず終了コードを変えない MUST。doneの判定と出力は変えない MUST。

Source: REQ-360

#### Scenario: 確認待ちの要件に対応するQ
- **WHEN** 関連がREQ-027のQ-15と、確認待ちのREQ-027を持つchangeに--spec-onlyを実行する
- **THEN** 確認待ちの要件の案内に「REQ-027（Q-15）」が出て、終了コードは0である
#### Scenario: 関連するQがない
- **WHEN** どの確認事項の関連にもない確認待ちのREQ-002を持つchangeに--spec-onlyを実行する
- **THEN** 案内は「REQ-002」のままである
#### Scenario: 回答済みのQの要件が確認待ち
- **WHEN** 回答のあるQ-15の関連にある REQ-029 が確認待ちのchangeに--spec-onlyを実行する
- **THEN** Q-15とREQ-029が案内つきの合格で出て、pendingと要判断は立たず終了コードは0である
#### Scenario: specに回答済みのQの参照が残る
- **WHEN** 回答のあるQ-15を、差分仕様のコードブロックの外で参照するchangeに--spec-onlyを実行する
- **THEN** そのファイル名・行番号・Q-15が案内つきの合格で出て、終了コードは0である
#### Scenario: 未回答のQの参照
- **WHEN** 回答が空のQ-15だけを差分仕様で参照するchangeに--spec-onlyを実行する
- **THEN** 参照の案内は出ない

#### Scenario: ハイフンを含むIDの全体を照合する
- **WHEN** 回答のあるQ-285-01を、差分仕様のコードブロックの外で参照するchangeに--spec-onlyを実行する
- **THEN** そのファイル名・行番号・Q-285-01が案内つきの合格で出て、終了コードは0である
#### Scenario: 短いIDを長いIDの一部として示さない
- **WHEN** 回答のあるQ-285があり、差分仕様にはQ-285-01だけがあるchangeに--spec-onlyを実行する
- **THEN** Q-285の参照の案内は出ない
#### Scenario: Q-の形でないIDも照合する
- **WHEN** 回答のあるQ279-00を、差分仕様のコードブロックの外で参照するchangeに--spec-onlyを実行する
- **THEN** そのファイル名・行番号・Q279-00が案内つきの合格で出る

### Requirement: 回答と承認の書き方の案内
人が読むverifyの表示は、ブロッキング確認事項の不合格の詳細のあとに、changeのtrace.mdの「確認事項」の表の該当する行の「回答」に回答を決めた人が書くことと `loomake trace answer` の書き方を一行で示す SHALL。未承認の仮定の詳細のあとに、「仮定」の表の「承認」に `承認` と書くことと `loomake trace approve` の書き方を一行で示す SHALL。この案内はJSONの結果に含めず、検査の分類・詳細・終了コードを変えない MUST。

Source: REQ-361

#### Scenario: ブロッキング失敗の書き方
- **WHEN** 未回答のブロッキングQ-15を持つchangeの結果を人向けに表示する
- **THEN** 「Q-15（REQ-012）…」の次の行に回答の書き方が出て、JSONには含まれない
#### Scenario: 未承認の仮定の書き方
- **WHEN** 未承認のA-01を持つchangeの spec-only と done の結果を人向けに表示する
- **THEN** 未承認の詳細の次の行に承認の書き方が出て、終了コードはそれぞれ0と1のままである

### Requirement: archiveしたchangeの通常検査
verifyはactive実pathが存在すれば従来どおりそれを検査し、不完全でもarchiveへ逃げないMUST。activeなしでは同IDの唯一の日付付きarchiveを実対象とし、不在・複数は不合格にするSHALL。標準rootのarchiveでは元repoのHEAD・commands・qualityと実pathのspecs/tasks/coverage/basis/receiptを保ち、外部strictだけ対象原文・現行主仕様・config・project schemaを隔離複写して同CLIで検査し、その旨を示すMUST。copy・strict・実行失敗の検査をPASSにせず、元入力を移設せず、設定・依存を増やさないMUST。

Source: REQ-394

#### Scenario: archiveの通常done
- **WHEN** 唯一archiveを標準rootでCLI/APIから検査する
- **THEN** archiveの実pathと元repoを使い、通常doneとciの全条件を省かずに評価する
#### Scenario: 対象不正と既存active
- **WHEN** archiveが不在/複数、activeが不完全/通常file/dangling・外向きlink、idが不正、またはopenspecDirがopenspec以外のarchive入力を渡す
- **THEN** 不在・複数・標準外は不合格にし、不正idの使い方エラーと既存activeの結果を保持する
#### Scenario: strictの入力と失敗
- **WHEN** 同期前後4種の差分、Scenario欠落・metadata/task不正・copy/外部実行失敗を検査する
- **THEN** 必要入力と診断を失わず同CLI strictへ渡し、失敗をPASSにしない。root/HEAD/commands/qualityを隔離先へ移さず、一時入力を片付ける

### Requirement: verify設定の読取不能の分類
verifyは、存在するloomake.config.jsonのOS由来の読取失敗を実行時の失敗として扱い、CLIのJSON出力ではruntimeのabortedと終了コード3を返すMUST。JSON構文・設定内容の誤りと、入力予算・リンク・通常ファイル以外の拒否はconfigのabortedと2、設定省略時は既存の既定値を保つMUST。JSONの形、入力予算・リンク拒否とverify以外の共有設定読取の契約を変えないMUST。

Source: REQ-395

#### Scenario: 存在する設定を読めない
- **WHEN** 設定の読取りがOSのエラーで失敗し、verifyをJSONあり/なしで実行する
- **THEN** どちらも3で、JSONだけをstdoutへ出しruntimeのabortedにする。APIの例外も共通分類で3となり、使い方を表示しない
#### Scenario: 構文・内容の誤りと不在
- **WHEN** 不正JSON・不正な設定内容・設定の不在でverifyを実行する
- **THEN** 不正入力はconfigのaborted/2、不在は既存の既定値となり、内容不正を実行時の失敗へ変えない
#### Scenario: 共有読取と入力制約
- **WHEN** 同じ読取不能を共有loadConfigの利用側へ渡すか、入力予算超過やリンクを設定として渡す
- **THEN** verify以外のUsageError契約と入力拒否を維持し、入力の拒否はverifyでもconfig/2を保つ
