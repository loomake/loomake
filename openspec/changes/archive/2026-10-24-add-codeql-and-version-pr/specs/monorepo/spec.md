## MODIFIED Requirements

### Requirement: changesets による公開準備
リポジトリは changesets を設定し、パッケージごとに独立したバージョンで公開できる状態にする SHALL。`pnpm changeset status` がエラーなく終わる SHALL。ただし、main と比べて変えたファイルが、`pnpm changeset version` による版の上げ下げ（各 package.json の `version` と内部の依存の版、CHANGELOG.md、消化して消した `.changeset/*.md`）だけのときは、`changeset status` の失敗を許す SHALL。

Source: REQ-056

#### Scenario: changesets が設定されている
- **WHEN** `.changeset/config.json` を読む
- **THEN** ファイルが存在し、`pnpm changeset status` がエラーなく終わる

#### Scenario: 版を上げるだけの変更
- **WHEN** main と比べて、package.json の version・CHANGELOG.md・消した changeset だけが変わっている
- **THEN** 公開準備の検査は合格する

#### Scenario: 版の上げ下げ以外の変更
- **WHEN** main と比べて、package.json の version のほかに scripts も変わっていて、changeset がない
- **THEN** 公開準備の検査は不合格になる
