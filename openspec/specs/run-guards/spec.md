# run-guards Specification

## Purpose
`loomake run` が、エンジンの変更から不正な直し方を見つけて止まるときの振る舞いを定める。テストの削除と skip・todo、設定の変更、いまの仕様と trace.md の変更の検出と、止まったときの差分の表示と承認のしかたを含む。

## Requirements

### Requirement: テストの削除と skip・todo の検出
エンジンを動かすたびに、`loomake run` はコミットする前の変更を調べ、テストファイルの削除か、足した行の skip・todo（`it.skip`・`test.skip`・`describe.skip`・`it.todo`・`test.todo`・`xit(`・`xtest(`・`xdescribe(`）を見つけたら、その変更をコミットせずに止まる SHALL。テストファイルは、名前に `.test.` か `.spec.` を含むファイルと、`test/`・`tests/`・`__tests__/` の下のファイルとする SHALL。

Source: REQ-109

#### Scenario: テストファイルを消す
- **WHEN** エンジンが tests/a.test.ts を消して終える
- **THEN** run は止まり、tests/a.test.ts の削除が表示され、その変更はコミットされず、終了コードは 1 である

#### Scenario: skip を足す
- **WHEN** エンジンがテストファイルに `it.skip(` の行を足して終える
- **THEN** run は止まり、その行が表示され、終了コードは 1 である

#### Scenario: ふつうのテストを足す
- **WHEN** エンジンがテストファイルに `it(` の行を足して終える
- **THEN** run は止まらずにコミットする

### Requirement: 設定の変更の検出
エンジンの変更に、loomake.config.json、`eslint.config.*`・`.eslintrc*`、`tsconfig*.json`、`vitest.config.*`・`vitest.workspace.*`・`vite.config.*`、`jest.config.*` の変更か、package.json の `scripts` の値の変更があれば、`loomake run` はその変更をコミットせずに止まる SHALL。

Source: REQ-110

#### Scenario: loomake.config.json を変える
- **WHEN** エンジンが loomake.config.json の commands を書き換えて終える
- **THEN** run は止まり、loomake.config.json の差分が表示され、終了コードは 1 である

#### Scenario: package.json の scripts を変える
- **WHEN** エンジンが package.json の `scripts.test` を書き換えて終える
- **THEN** run は止まる

#### Scenario: package.json の依存だけを変える
- **WHEN** エンジンが package.json の `dependencies` だけを書き換えて終える
- **THEN** run は止まらずにコミットする

### Requirement: 仕様と trace.md の変更の検出
エンジンの変更に、`openspec/specs/` の下のファイルか、`openspec/changes/` の下の trace.md の変更があれば、`loomake run` はその変更をコミットせずに止まる SHALL。

Source: REQ-111

#### Scenario: いまの仕様を書き換える
- **WHEN** エンジンが openspec/specs/x/spec.md を書き換えて終える
- **THEN** run は止まり、終了コードは 1 である

#### Scenario: trace.md を書き換える
- **WHEN** エンジンが change の trace.md の回答欄を書き換えて終える
- **THEN** run は止まり、終了コードは 1 である

### Requirement: 止まったときの差分の表示と承認
不正な直し方を見つけて止まったとき、`loomake run` は見つけた理由と、対象のファイルの差分を表示する SHALL。その変更はコミットせずに作業ツリーに残し、終了コード 1 を返す SHALL。あわせて、承認するなら人が差分を確かめて、tasks.md のそのタスクを完了にしたうえで自分でコミットし、もう一度 `loomake run` を実行するよう案内する SHALL。人のコミットがない限り、run は先へ進まない SHALL。

Source: REQ-112

#### Scenario: 差分を表示して止まる
- **WHEN** エンジンが loomake.config.json を書き換えて終える
- **THEN** 理由と loomake.config.json の差分が表示され、その変更は作業ツリーに残り、コミットは増えず、承認のしかたが案内され、終了コードは 1 である

#### Scenario: 承認しないで実行し直す
- **WHEN** 止まったあと、変更をコミットしないまま `loomake run --change c1` を実行する
- **THEN** 未コミットの変更があるので始めず、終了コードは 1 である
