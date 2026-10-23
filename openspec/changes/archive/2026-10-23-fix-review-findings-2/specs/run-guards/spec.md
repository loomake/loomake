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
