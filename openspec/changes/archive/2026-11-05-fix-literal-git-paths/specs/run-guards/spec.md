## MODIFIED Requirements

### Requirement: テストの削除と skip・todo の検出
エンジンを動かすたびに、`loomake run` はコミットする前の変更を調べ、テストファイルの削除か、足した行の skip・todo（`it`・`test`・`describe`・`suite` に続く `.skip`・`.todo`・`.skipIf`・`.runIf`。`it.concurrent.skip` のように間に修飾が入るものを含む。それと `xit(`・`xtest(`・`xdescribe(`）を見つけたら、その変更をコミットせずに止まる SHALL。テストファイルは、名前に `.test.` か `.spec.` を含むファイルと、`test/`・`tests/`・`__tests__/` の下のファイルとする SHALL。

Source: REQ-109

#### Scenario: テストファイルを消す
- **WHEN** エンジンが tests/a.test.ts を消して終える
- **THEN** run は止まり、tests/a.test.ts の削除が表示され、その変更はコミットされず、終了コードは 1 である

#### Scenario: skip を足す
- **WHEN** エンジンがテストファイルに `it.skip(` の行を足して終える
- **THEN** run は止まり、その行が表示され、終了コードは 1 である

#### Scenario: 条件つきの skip を足す
- **WHEN** エンジンがテストファイルに `it.skipIf(true)(`・`describe.skipIf(`・`it.runIf(false)(`・`it.concurrent.skip(` のどれかの行を足して終える
- **THEN** run は止まり、その行が表示され、終了コードは 1 である

#### Scenario: ふつうのテストを足す
- **WHEN** エンジンがテストファイルに `it(` の行を足して終える
- **THEN** run は止まらずにコミットする

#### Scenario: pathspec の名前に skip を足す
- **WHEN** エンジンが `:(top)x.test.ts` のように git の pathspec の魔法構文に見える名前のテストファイルに `it.skip(` を足して終える
- **THEN** run は実際のファイル名と skip の行、対象の差分を表示し、変更をコミットせず終了コード 1 で止まる

### Requirement: 特殊文字を含むパスのガード
変更のパスに日本語・空白・タブ・改行があっても、仕様とchangeの文書の変更、テストの削除とskipの追加を通常のパスと同じように検出する SHALL。

Source: REQ-138

#### Scenario: 日本語の仕様とテスト
- **WHEN** 日本語を含む仕様ファイルを変え、テストを削除する
- **THEN** 正しいファイル名で違反が表示され、変更はコミットされない

#### Scenario: 区切り文字を含むパス
- **WHEN** タブか改行を含むファイル名で検出対象の変更を行う
- **THEN** パスを分断せずに違反を検出する

#### Scenario: pathspec の名前を通常のファイル名として扱う
- **WHEN** 変更したテストファイルの名前が `:(top)`・`:(glob)`・`:!`・`:/` で始まる
- **THEN** pathspec の式として別のパスを選ばず、その名前の変更にある skip の追加とアサーションの削除を検出し、正しい名前と対象の差分を表示する

### Requirement: アサーションとテストの宣言の書き換えの検出
エンジンを動かすたびに、`loomake run` は、HEAD にあったテストファイルから、アサーション（`expect`・`assert` の呼び出し）かテストの宣言（`it`・`test`・`describe` の呼び出し）を含む行を消すか書き換えたかを調べ、見つけたらその行を表示し、変更をコミットせずに止まる SHALL。消した行と同じ内容（前後の空白を除く）の行を同じファイルに足しているときは、行を移しただけとみなして止まらない SHALL。テストファイルは「テストの削除と skip・todo の検出」と同じとする SHALL。

Source: REQ-109

#### Scenario: アサーションを書き換える
- **WHEN** エンジンが tests/a.test.ts の `expect(add(1, 2)).toBe(3);` の行を `expect(true).toBe(true);` に書き換えて終える
- **THEN** run は止まり、書き換える前の行が表示され、その変更はコミットされず、終了コードは 1 である

#### Scenario: ファイルの中のテストを消す
- **WHEN** エンジンが tests/a.test.ts から `it('[REQ-012] b', ...)` のテストを消して終える
- **THEN** run は止まり、消した `it(` の行が表示され、終了コードは 1 である

#### Scenario: アサーションの行を移すだけ
- **WHEN** エンジンが tests/a.test.ts のアサーションの行の字下げを変え、別の `describe` の中へ移して終える
- **THEN** run は止まらずにコミットする

#### Scenario: テストでない呼び出しの行を書き換える
- **WHEN** エンジンが tests/a.test.ts の `const ok = /x/.test(s);` の行を書き換えて終える
- **THEN** run は止まらずにコミットする

#### Scenario: pathspec の名前にあるアサーションを消す
- **WHEN** エンジンが `:(glob)`・`:!`・`:/` などで始まる名前の既存テストファイルからアサーションの行を消して終える
- **THEN** run はそのファイル名と消した行、対象の差分を表示し、変更をコミットせず終了コード 1 で止まる

### Requirement: git の設定とフックの変更の検出
`loomake run` は、エンジンを呼ぶ前後で、git の設定ファイル（`git rev-parse --git-path config`）の中身と、フックのディレクトリ（`git rev-parse --git-path hooks`。`core.hooksPath` を反映する）にあるファイルの相対パスと中身を比べる SHALL。変わっていたら、`git add`・`git commit` を実行せず、タスクを完了にせずに、エンジンが git の設定かフックを変えたことと確かめる場所を表示して、終了コード 1 で止まる SHALL。run は書き換えを戻さない SHALL。run を始める前からあるフックは、これまでどおり run のコミットで動く SHALL。

Source: REQ-198

#### Scenario: エンジンがフックを足す
- **WHEN** エンジンが `.git/hooks/pre-commit` を書く
- **THEN** run はコミットせず、そのフックを実行せず、タスクは未完了のまま、エンジンが git の設定かフックを変えたことを表示して終了コード 1 で止まる

#### Scenario: エンジンが git の設定を変える
- **WHEN** エンジンが `git config core.hooksPath` を設定する
- **THEN** run はコミットせず、エンジンが git の設定かフックを変えたことを表示して終了コード 1 で止まる

#### Scenario: 前からあるフック
- **WHEN** run を始める前から `.git/hooks/post-commit` があり、エンジンはフックも設定も変えない
- **THEN** run はタスクを完了にしてコミットし、そのフックが動く

#### Scenario: 既存フックの glob と環境を保つ
- **WHEN** 開始前からある pre-commit または pre-push が `git ls-files -- '*.ts'` で対象を選ぶ
- **THEN** runner の commit・push は pathspec 環境の 4 変数を元の値または未設定のまま渡し、フックは従来の対象を検査できる
