## ADDED Requirements

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
