## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: git の設定の比較の範囲
REQ-198 の比較では、リポジトリの設定ファイルだけでなく、git が実際に使う設定（`git config --list --show-origin` の出力。include・includeIf の先、利用者全体とシステム全体の設定、worktree の設定を含む）を、エンジンを呼ぶ前後で比べる SHALL。フックのディレクトリのシンボリックリンクは、リンク先をたどらずにリンクの文字列を比べ、リンク先がないリンクやディレクトリを指すリンクがあっても、run はエラーで落ちずに続ける SHALL。

Source: REQ-204

#### Scenario: include の先の設定を変える
- **WHEN** リポジトリの設定が `include.path` で別のファイルを読み、エンジンがそのファイルに `core.fsmonitor` を書く
- **THEN** run はコミットせず、エンジンが git の設定かフックを変えたことを表示して終了コード 1 で止まる

#### Scenario: リンク先のないフック
- **WHEN** run を始める前から、フックのディレクトリにリンク先のないシンボリックリンクがある
- **THEN** run はスタックトレースで落ちずに、タスクを完了にしてコミットする
