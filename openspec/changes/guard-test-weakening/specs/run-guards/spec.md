## MODIFIED Requirements

### Requirement: テストの削除と skip・todo の検出
エンジンを動かすたびに、`loomake run` はコミットする前の変更を調べ、テストファイルの削除か、足した行の skip・todo（`it`・`test`・`describe`・`suite` に続く `.skip`・`.todo`・`.skipIf`・`.runIf`。`it.concurrent.skip` のように間に修飾が入るものを含む。それと `xit(`・`xtest(`・`xdescribe(`）を見つけたら、その変更をコミットせずに止まる SHALL。HEAD にあったテストファイルから、アサーション（`expect`・`assert` の呼び出し）かテストの宣言（`it`・`test`・`describe` の呼び出し）を含む行を消すか書き換えたときも、その行を表示し、変更をコミットせずに止まる SHALL。消した行と同じ内容（前後の空白を除く）の行を同じファイルに足しているときは、行を移しただけとみなして止まらない SHALL。テストファイルは、名前に `.test.` か `.spec.` を含むファイルと、`test/`・`tests/`・`__tests__/` の下のファイルとする SHALL。

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
