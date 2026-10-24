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
