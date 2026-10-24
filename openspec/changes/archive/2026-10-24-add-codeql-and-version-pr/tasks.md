# Tasks

## 1. 外部 Actions と CodeQL

- [x] 1.1 サブパスつきの参照のテストで Red を確かめ、REQ-167 の検査をリポジトリと SHA で照合する形にする（REQ-167）
- [x] 1.2 CodeQL のワークフローのテストで Red を確かめ、codeql.yml と Action の記録を足す（REQ-200）

## 2. 版を上げる PR

- [x] 2.1 版の上げ下げだけの変更を見分けるテストで Red を確かめ、REQ-056 の検査に例外を足す（REQ-056）

## 3. 統合検証

- [x] 3.1 docs（release-integrity の説明と release.md の手順）と changeset を更新し、TDD の結果を tdd.md に記録する
- [x] 3.2 `pnpm -s verify --change add-codeql-and-version-pr --done` を通す <!-- loomake:gate=done -->
