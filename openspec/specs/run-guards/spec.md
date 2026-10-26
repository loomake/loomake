# run-guards Specification

## Purpose
`loomake run` が、エンジンの変更から不正な直し方を見つけて止まるときの振る舞いを定める。テストの削除と skip・todo、設定の変更、いまの仕様と trace.md の変更の検出と、止まったときの差分の表示と承認のしかたを含む。

## Requirements

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

### Requirement: 設定の変更の検出
エンジンの変更に、loomake.config.json、`eslint.config.*`・`.eslintrc*`、`tsconfig*.json`、`vitest.config.*`・`vitest.workspace.*`・`vite.config.*`、`jest.config.*` の変更か、リポジトリの中のどの階層にある package.json でも `scripts` の値の変更があれば、`loomake run` はその変更をコミットせずに止まる SHALL。

Source: REQ-110

#### Scenario: loomake.config.json を変える
- **WHEN** エンジンが loomake.config.json の commands を書き換えて終える
- **THEN** run は止まり、loomake.config.json の差分が表示され、終了コードは 1 である

#### Scenario: package.json の scripts を変える
- **WHEN** エンジンが package.json の `scripts.test` を書き換えて終える
- **THEN** run は止まる

#### Scenario: 子パッケージの package.json の scripts を変える
- **WHEN** エンジンが `packages/app/package.json` の `scripts.test` を書き換えて終える
- **THEN** run は止まる

#### Scenario: package.json の依存だけを変える
- **WHEN** エンジンが package.json の `dependencies` だけを書き換えて終える
- **THEN** run は止まらずにコミットする

### Requirement: 仕様と trace.md の変更の検出
エンジンの変更に、`<openspecDir>/specs/` の下のファイルか、`<openspecDir>/changes/` の下のファイル（trace.md・tasks.md・proposal.md・差分仕様などの change の文書）の変更があれば、`loomake run` はその変更をコミットせずに止まる SHALL。`<openspecDir>` は loomake.config.json の `openspecDir` とする SHALL。run 自身が tasks.md のタスクを完了にする変更は、この検出の対象にしない SHALL。

Source: REQ-111

#### Scenario: いまの仕様を書き換える
- **WHEN** エンジンが openspec/specs/x/spec.md を書き換えて終える
- **THEN** run は止まり、終了コードは 1 である

#### Scenario: trace.md を書き換える
- **WHEN** エンジンが change の trace.md の回答欄を書き換えて終える
- **THEN** run は止まり、終了コードは 1 である

#### Scenario: tasks.md を書き換える
- **WHEN** エンジンが tasks.md から未完了のタスクの行を消して終える
- **THEN** run は止まり、終了コードは 1 である

#### Scenario: 差分仕様を書き換える
- **WHEN** エンジンが change の差分仕様から Requirement を消して終える
- **THEN** run は止まり、終了コードは 1 である

#### Scenario: openspecDir を変えたプロジェクト
- **WHEN** `openspecDir` が `spec` のプロジェクトで、エンジンが `spec/specs/x/spec.md` を書き換えて終える
- **THEN** run は止まり、終了コードは 1 である

#### Scenario: 完了ゲートの直しのあいだ
- **WHEN** 完了ゲートの直しで、エンジンが change の文書を変えずにコードだけを直して終える
- **THEN** run は止まらずに直しをコミットする

### Requirement: 止まったときの差分の表示と承認
不正な直し方を見つけて止まったとき、`loomake run` は見つけた理由と、対象のファイルの差分を表示する SHALL。その変更はコミットせずに作業ツリーに残し、終了コード 1 を返す SHALL。あわせて、承認するなら人が差分を確かめて、tasks.md のそのタスクを完了にしたうえで自分でコミットし、もう一度 `loomake run` を実行するよう案内する SHALL。人のコミットがない限り、run は先へ進まない SHALL。

Source: REQ-112

#### Scenario: 差分を表示して止まる
- **WHEN** エンジンが loomake.config.json を書き換えて終える
- **THEN** 理由と loomake.config.json の差分が表示され、その変更は作業ツリーに残り、コミットは増えず、承認のしかたが案内され、終了コードは 1 である

#### Scenario: 承認しないで実行し直す
- **WHEN** 止まったあと、変更をコミットしないまま `loomake run --change c1` を実行する
- **THEN** 未コミットの変更があるので始めず、終了コードは 1 である

### Requirement: エンジンによるコミットとブランチの切り替えの検出
`loomake run` は、エンジンを呼ぶ直前に HEAD のコミットの SHA とブランチ名を覚え、エンジンが終わったあとに比べる SHALL。エンジンが成功・失敗・質問・時間切れ・中断のどれで終えたときも比べる SHALL。どちらかが変わっていれば、run はそのタスクを完了にせず、コミットもせずに止まり、終了コード 1 を返す SHALL。止まるときは、呼ぶ前と後の SHA とブランチ名、呼ぶ前のコミットから後のコミットまでの差分を表示し、変更を確かめる手順と、受け入れる場合と元に戻す場合の手順を案内する SHALL。run はエンジンのコミットを取り消さず、ブランチも戻さない SHALL。

Source: REQ-126

#### Scenario: エンジンが自分でコミットする
- **WHEN** エンジンがファイルを変えて、自分でコミットして終える
- **THEN** run は止まり、呼ぶ前と後の SHA が表示され、tasks.md のそのタスクは未完了のままで、run はコミットを作らず、終了コードは 1 である

#### Scenario: 設定を変えてコミットする
- **WHEN** エンジンが loomake.config.json を書き換えて、自分でコミットして終える
- **THEN** run は止まり、loomake.config.json の差分が表示され、終了コードは 1 である

#### Scenario: エンジンがブランチを切り替える
- **WHEN** エンジンが別のブランチに切り替えて終える
- **THEN** run は止まり、呼ぶ前と後のブランチ名が表示され、run はブランチを戻さず、終了コードは 1 である

#### Scenario: コミットしてから失敗する
- **WHEN** エンジンが自分でコミットしてから、終了コード 1 で終える
- **THEN** run は止まり、止まった理由に HEAD が変わったことが含まれ、終了コードは 1 である

#### Scenario: 完了ゲートの直しでコミットする
- **WHEN** 完了ゲートの直しで、エンジンが自分でコミットして終える
- **THEN** run は止まり、完了ゲートのタスクは未完了のままで、終了コードは 1 である

#### Scenario: コミットしないエンジン
- **WHEN** エンジンがファイルを変えるだけで、コミットせずに終える
- **THEN** run は止まらずに、そのタスクを完了にしてコミットする

### Requirement: 特殊文字を含むパスのガード
変更のパスに日本語・空白・タブ・改行があっても、仕様とchangeの文書の変更、テストの削除とskipの追加を通常のパスと同じように検出する SHALL。

Source: REQ-138

#### Scenario: 日本語の仕様とテスト
- **WHEN** 日本語を含む仕様ファイルを変え、テストを削除する
- **THEN** 正しいファイル名で違反が表示され、変更はコミットされない

#### Scenario: 区切り文字を含むパス
- **WHEN** タブか改行を含むファイル名で検出対象の変更を行う
- **THEN** パスを分断せずに違反を検出する

### Requirement: テストの検査を弱める変更の検出
エンジンの変更をコミットする前に、HEAD にあるテストファイルの差分で、消した行のうち検査の行（コメントと import・require の行を除き、`expect(`・`assert(`・`assert.<名前>(` を呼ぶ行）の数が、足した行のうち検査の行の数より多いときは、不正な直し方として、そのファイルと理由を表示し、コミットせずに終了コード 1 で止まる SHALL。テストファイルに、同じリテラルどうしを比べる検査（`expect(true).toBe(true)`・`expect(1).toEqual(1)`・`assert.equal('a', 'a')` など）を足したときも、同じく止まる SHALL。止まったときの扱いは REQ-109〜REQ-112 と同じとする SHALL。

Source: REQ-201

#### Scenario: 検査の行を消す
- **WHEN** エンジンが既存のテストファイルから `expect(...)` の行を 1 行消し、検査の行を足さない
- **THEN** run はコミットせず、テストの検査を減らしたことを表示して止まる

#### Scenario: 必ず通る検査に書き換える
- **WHEN** エンジンが `expect(add(1, 2)).toBe(3)` を `expect(true).toBe(true)` に書き換える
- **THEN** run はコミットせず、必ず通る検査を足したことを表示して止まる

#### Scenario: テストを足す
- **WHEN** エンジンが既存のテストファイルに `expect` を含むテストを足す
- **THEN** run は止まらずにコミットする

#### Scenario: import とコメントを消す
- **WHEN** エンジンが既存のテストファイルから、使っていない `import { assert } from 'vitest'` の行と、`assert` を含むコメントの行を消す
- **THEN** run はテストの検査を減らしたとはみなさず、コミットする

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

### Requirement: git の設定の比較の範囲
REQ-198 の比較では、リポジトリの設定ファイルだけでなく、git が実際に使う設定（`git config --list --show-origin` の出力。include・includeIf の先、利用者全体とシステム全体の設定、worktree の設定を含む）を、エンジンを呼ぶ前後で比べる SHALL。フックのディレクトリのシンボリックリンクは、リンク先をたどらずにリンクの文字列を比べ、リンク先がないリンクやディレクトリを指すリンクがあっても、run はエラーで落ちずに続ける SHALL。

Source: REQ-204

#### Scenario: include の先の設定を変える
- **WHEN** リポジトリの設定が `include.path` で別のファイルを読み、エンジンがそのファイルに `core.fsmonitor` を書く
- **THEN** run はコミットせず、エンジンが git の設定かフックを変えたことを表示して終了コード 1 で止まる

#### Scenario: リンク先のないフック
- **WHEN** run を始める前から、フックのディレクトリにリンク先のないシンボリックリンクがある
- **THEN** run はスタックトレースで落ちずに、タスクを完了にしてコミットする

### Requirement: フックの特殊ファイルを開く前に止める
Git内部のスナップショットは、フックのディレクトリ内で、ディレクトリ・通常ファイル・シンボリックリンク以外の項目を見つけたら、その内容を開く前に拒否する SHALL。FIFO・ソケット・デバイスなどを検出した場合、runは対象のパスと特殊ファイルを読み込まない理由を日本語で示し、そのタスクを完了にせず、コミット前に終了コード1で止まる SHALL。エンジンの変更と特殊ファイルは削除や上書きをしない SHALL。通常ファイルの比較と、リンク先をたどらずリンク文字列を比較するREQ-204の契約は維持する SHALL。

Source: REQ-224

#### Scenario: 実行前からFIFOがある
- **WHEN** POSIXのフックのディレクトリに書き手のないFIFOが存在した状態でrunを始める
- **THEN** FIFOの読み込みを待たずに対象と理由を日本語で示して終了コード1で止まり、エンジンは呼ばれず、タスクは未完了で、コミットは増えず、FIFOは残る

#### Scenario: エンジンがFIFOを作る
- **WHEN** POSIXのエンジンが実装ファイルとフックのディレクトリ内のFIFOを作って終える
- **THEN** FIFOの読み込みを待たずに対象と理由を日本語で示して終了コード1で止まり、実装とFIFOは残り、タスクは未完了で、コミットは増えない

#### Scenario: 通常のフックを保つ
- **WHEN** 以前から置かれた通常ファイルのフックをエンジンが変えずに実装を終える
- **THEN** 特殊ファイルとして拒否せず、タスクを完了にしてコミットする

#### Scenario: リンク先のないリンクとディレクトリへのリンクを保つ
- **WHEN** フックのディレクトリにリンク先のないシンボリックリンクかディレクトリへのシンボリックリンクがある
- **THEN** リンク先を開かずにリンク文字列を比較し、リンクを変えていない実装はタスクを完了にしてコミットする

### Requirement: フックと子プロセスを保護する範囲の明示
利用者向けのセキュリティ文書は、フックのリンク文字列の比較がリンク先の内容とそこから呼ぶコードを保護しないこと、既存のフックと設定したコマンドを利用者の権限で実行することを明記する SHALL。通常終了後の子の停止は同じPOSIXプロセスグループが対象で、別のセッションへ離脱した子やWindowsでの同等の停止を保証しないことを明記する SHALL。実行していないOSや実Claude・GitHub接続の成功を記載しない SHALL。

Source: REQ-225

#### Scenario: リンクの保護範囲を読む
- **WHEN** 利用者がセキュリティ文書のフック保護の説明を読む
- **THEN** リンク先の内容とそこから呼ぶコードは検査の対象外であり、信頼して確認したフックとコマンドを利用者の権限で実行することが分かる

#### Scenario: 子プロセスの保護範囲を読む
- **WHEN** 利用者がセキュリティ文書の子プロセス停止の説明を読む
- **THEN** 通常終了後の停止は同じPOSIXプロセスグループが対象であり、別のセッションへ離脱した子とWindowsの同等保証は含まれず、未実行の環境を確認済みとしていないことが分かる
