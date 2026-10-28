## ADDED Requirements

### Requirement: 完了ゲートが読む差分のベース
CI の完了ゲートは、PR で変えたファイルを、PR のマージ先のリモートの追跡ブランチ（`refs/remotes/origin/<base>`）と PR の先頭との差分で調べる MUST。ベースと同じ名前のタグやブランチ（`refs/tags/origin/<base>`・`refs/heads/origin/<base>` など）があっても、それを差分のベースに使ってはならない MUST NOT。

Source: REQ-272

#### Scenario: 同じ名前のタグやブランチがある
- **WHEN** ブランチ名 `fix-x` で、本文に明示がない PR で CI が動く。PR の 1 つ目のコミットで `openspec/changes/c1/tasks.md` を、2 つ目のコミットで `packages/a.ts` を変えていて、2 つのコミットのあいだを `refs/tags/origin/main` または `refs/heads/origin/main` が指している
- **THEN** 同じ名前のタグやブランチではなく、リモートの追跡ブランチ `refs/remotes/origin/main` との差分で change を選び、`verify --change c1 --done` が実行される
