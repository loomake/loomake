## MODIFIED Requirements

### Requirement: 完了ゲートの対象の決め方
CI の完了ゲートは、対象の change を次の順に決める MUST。

1. PR 本文に `loomake-change: <id>` の行があれば、その change とする。`,` で区切って複数を書ける。`loomake-change: none` なら、change のない PR とする
2. 明示がなければ、PR で変えたファイルのうち `openspec/changes/<id>/` の下にあるもの（`archive` を除き、いまディレクトリがあるもの）の change と、PR のブランチ名、またはブランチ名から先頭の `loomake/` を除いた名前と一致する `openspec/changes/<id>` の change を合わせたものとする

明示した change のディレクトリがないときは、ジョブを失敗させる MUST。

Source: REQ-132

#### Scenario: 明示を優先する
- **WHEN** `openspec/changes/c1` と `openspec/changes/c2` があり、c1 の tasks.md に完了した印があり、ブランチ名 `c2` で、`openspec/changes/c2/tasks.md` を変え、本文に `loomake-change: c1` の行がある PR で CI が動く
- **THEN** verify の呼び出しは `verify --change c1 --done` だけになる

#### Scenario: 変えたファイルとブランチ名を合わせる
- **WHEN** `openspec/changes/c1` と `openspec/changes/c2` があり、c2 の tasks.md に完了した印があり、ブランチ名 `c2` で、本文に明示がなく、`openspec/changes/c1/tasks.md` を完了した印のない内容に変えた PR で CI が動く
- **THEN** lint と文書のリンクの試験のあとに、`verify --change c1 --spec-only` と `verify --change c2 --done` が実行される
