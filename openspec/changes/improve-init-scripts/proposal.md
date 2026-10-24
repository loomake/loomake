# init が実在する script とテストランナーに合わせる

## Why

`loomake init` は、package.json に lint・typecheck の script がなくても、`commands` に 3 つのコマンドを書く。そのため、導入直後の `loomake verify` が「Missing script」の不合格から始まる。テストのレポートの設定例も、使っていないテストランナーの分まで表示する。

## What Changes

- package.json に `scripts` があるときは、lint・typecheck・test のうち、ある script のコマンドだけを `commands` に書き、書かなかった名前を案内する
- 依存に vitest か jest があるときは、そのテストランナーの設定例だけを表示する

## Capabilities

### New Capabilities

なし。

### Modified Capabilities

- `init`: commands の既定値と、テストのレポートの設定例。

## Impact

kit の init と CLI のテストを変える。`scripts` のない package.json と、package.json のないプロジェクトの結果は変えない。
