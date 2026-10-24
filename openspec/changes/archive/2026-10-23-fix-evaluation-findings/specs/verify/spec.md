## MODIFIED Requirements

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
