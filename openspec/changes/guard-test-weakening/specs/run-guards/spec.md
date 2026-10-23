## ADDED Requirements

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
