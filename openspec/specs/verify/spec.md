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
