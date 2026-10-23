## MODIFIED Requirements

### Requirement: プルリクエストごとの完了ゲート
CI はプルリクエストごとに完了ゲートを実行し、不合格のときジョブを失敗させる SHALL。対象の change は次の順に決める MUST。

1. PR 本文に `loomake-change: <id>` の行があれば、その change とする。`,` で区切って複数を書ける。`loomake-change: none` なら、change のない PR とする
2. 明示がなければ、PR で変えたファイルのうち `openspec/changes/<id>/` の下にあるもの（`archive` を除き、いまディレクトリがあるもの）の change と、PR のブランチ名、またはブランチ名から先頭の `loomake/` を除いた名前と一致する `openspec/changes/<id>` の change を合わせたものとする

対象の change があれば、それぞれに `--change <id> --done` で実行し、1 つでも不合格ならジョブを失敗させる MUST。明示した change のディレクトリがないときは、ジョブを失敗させる MUST。対象がなく、`loomake-change: none` の明示があるか、PR で変えたファイルが文書（`.md` のファイル、`docs/`・`openspec/`・`.changeset/` の下のファイル）だけのときは、品質コマンドだけを実行する MUST。対象がなく、文書のほかのファイルを変えているときは、`loomake-change:` の行を書くよう日本語で案内し、ジョブを失敗させる MUST。

Source: REQ-010, REQ-054, REQ-132

#### Scenario: ブランチ名が change-id と一致する
- **WHEN** ブランチ名 `setup-monorepo` の PR で CI が動く
- **THEN** `verify --change setup-monorepo --done` が実行され、不合格ならジョブが失敗する

#### Scenario: run のブランチ名
- **WHEN** `openspec/changes/c1` があり、ブランチ名 `loomake/c1` の PR で CI が動く
- **THEN** `verify --change c1 --done` が実行される

#### Scenario: PR 本文で明示する
- **WHEN** `openspec/changes/c1` と `openspec/changes/c2` があり、ブランチ名 `fix-typo` で、本文に `loomake-change: c1, c2` の行がある PR で CI が動く
- **THEN** `verify --change c1 --done` と `verify --change c2 --done` が実行される

#### Scenario: 明示した change がない
- **WHEN** 本文に `loomake-change: nothing` の行があり、`openspec/changes/nothing` がない PR で CI が動く
- **THEN** change がないことが表示され、ジョブが失敗する

#### Scenario: change のない PR だと明示する
- **WHEN** 本文に `loomake-change: none` の行があり、`packages/a.ts` を変えた PR で CI が動く
- **THEN** `--change` なしで品質コマンドだけが実行される

#### Scenario: 変えたファイルから決める
- **WHEN** ブランチ名 `feature-x` で、`openspec/changes/c1/tasks.md` と `packages/a.ts` を変えた PR で CI が動く
- **THEN** `verify --change c1 --done` が実行される

#### Scenario: コードを変えて対象を特定できない
- **WHEN** ブランチ名 `fix-typo` で、本文に明示がなく、`packages/a.ts` を変えた PR で CI が動く
- **THEN** `loomake-change:` の行を書くよう案内が表示され、ジョブが失敗する

#### Scenario: ブランチ名が change-id と一致しない
- **WHEN** ブランチ名 `fix-typo` で、本文に明示がなく、`docs/usage.md` だけを変えた PR で CI が動く
- **THEN** `--change` なしで品質コマンドだけが実行される

#### Scenario: archive の PR
- **WHEN** ブランチ名 `archive-c1` で、`openspec/changes/c1/` の削除と、`openspec/changes/archive/2026-10-23-c1/` と `openspec/specs/` の追加と変更だけの PR で CI が動く
- **THEN** `--change` なしで品質コマンドだけが実行される
