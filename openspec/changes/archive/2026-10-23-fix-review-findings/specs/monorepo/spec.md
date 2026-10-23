## MODIFIED Requirements

### Requirement: プルリクエストごとの完了ゲート
CI はプルリクエストごとに完了ゲートを実行し、不合格のときジョブを失敗させる SHALL。PR のブランチ名、またはブランチ名から先頭の `loomake/` を除いた名前が `openspec/changes/<id>` のディレクトリ名と一致するときは `--change <id> --done` で実行し、一致しないときは品質コマンドだけを実行する MUST。

Source: REQ-010, REQ-054

#### Scenario: ブランチ名が change-id と一致する
- **WHEN** ブランチ名 `setup-monorepo` の PR で CI が動く
- **THEN** `verify --change setup-monorepo --done` が実行され、不合格ならジョブが失敗する

#### Scenario: run のブランチ名
- **WHEN** `openspec/changes/c1` があり、ブランチ名 `loomake/c1` の PR で CI が動く
- **THEN** `verify --change c1 --done` が実行される

#### Scenario: ブランチ名が change-id と一致しない
- **WHEN** ブランチ名 `fix-typo` の PR で CI が動く
- **THEN** `--change` なしで品質コマンド（lint・typecheck・test）だけが実行される
