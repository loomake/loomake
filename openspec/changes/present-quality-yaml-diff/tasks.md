# Tasks

## 1. 具体提示と告知

- [ ] 1.1 X の最終 head をローカル依存として固定・取り込み、a470 の Req409 root 二件・六行を同じ describe へ全文移管する。同じ最終試験で二件 RED を確認し、両 Skill の X 小節末尾へ見出しなしで各二行と guide を追加する。二件 GREEN と X 五件・旧 assert 成功を確認する。
- [ ] 1.2 strict/spec-only と固定親基準の差分・全量行数を確認し、判断結果だけの日誌と kit patch changeset を同じ作業へ含める。format・kit 試験・B2・旧 branch は変更しない。

## 2. 統合確認

- [ ] 2.1 `pnpm -s verify --change present-quality-yaml-diff --done --scope local` を通常実行で通す。 <!-- loomake:gate=done -->

## Workflow follow-up

- 同じ実装 PR で同期/archive を行い、親 main 後に自身の最終差分を再確定する。非作者自己レビュー・独立最終レビュー重大ゼロ・軽微 Issue 化・必須 CI/kit 三 OS・merge 直前 head 照合を確認し、X→Y→B2 の最終受入順を守る。
