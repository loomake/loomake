# PR #47 のレビューで見つかったガードの不具合を直す

## Why

PR #47 のレビューで、run のガードに次の 3 つの不具合が見つかった。

- REQ-198 の比較は `.git/config` だけを見るので、include の先や `~/.gitconfig` に `core.fsmonitor` などを書かれると見逃す
- フックのディレクトリにリンク先のないシンボリックリンクがあると、比較が ENOENT で落ち、summary.json を書かずに終わる
- REQ-201 の「検査の行」が import やコメントの `assert` も数えるので、使っていない import を消しただけで止まる

## What Changes

- git が実際に使う設定（`git config --list --show-origin`）を比べる
- フックのシンボリックリンクはたどらずに、リンクの文字列を比べる
- 検査の行から、コメントと import・require の行を除き、`expect(`・`assert(`・`assert.<名前>(` を呼ぶ行だけを数える

## Capabilities

### New Capabilities

なし。

### Modified Capabilities

- `run-guards`: git の設定の比較の範囲と、検査の行の数え方。

## Impact

runner のガードとテストを変える。
