# devcontainer

このリポジトリは `.devcontainer/devcontainer.json` を持つ。

- イメージは Node 24 系（`mcr.microsoft.com/devcontainers/typescript-node` の 24 の版）を使う
- コンテナを作ったあとの `postCreateCommand` で、OpenSpec CLI（`@fission-ai/openspec`。CI と同じ版）を入れる

`tests/monorepo.test.ts` の「devcontainer」の試験が、この 2 つを確かめる。

利用者に `loomake init` で配る devcontainer の雛形は、別のファイル（`packages/kit/templates/devcontainer/devcontainer.json`）で、init の仕様で扱う。このページの決まりは雛形には及ばない。

この決まりは以前、monorepo の仕様の Requirement「devcontainer」（REQ-004・REQ-061）だった。change move-dev-mechanics-to-docs で仕様から外した。
