## ADDED Requirements

### Requirement: テストの検査を弱める変更の検出
エンジンの変更をコミットする前に、HEAD にあるテストファイルの差分で、消した行のうち検査の行（`expect(` か `assert` を含む行）の数が、足した行のうち検査の行の数より多いときは、不正な直し方として、そのファイルと理由を表示し、コミットせずに終了コード 1 で止まる SHALL。テストファイルに、同じリテラルどうしを比べる検査（`expect(true).toBe(true)`・`expect(1).toEqual(1)`・`assert.equal('a', 'a')` など）を足したときも、同じく止まる SHALL。止まったときの扱いは REQ-109〜REQ-112 と同じとする SHALL。

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
