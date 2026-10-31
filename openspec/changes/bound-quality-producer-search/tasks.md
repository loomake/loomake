# Tasks

## 1. 仕様と採用記録

- [x] 1.1 REQ-359 の差分仕様、採番の出典、Q238-01〜05 の回答と設計を記録し、`openspec validate bound-quality-producer-search --strict` と `pnpm -s verify --change bound-quality-producer-search --spec-only` の exit 0 を確認する。

## 2. 探索境界の修理

- [x] 2.1 `[REQ-359]` を持つ直接試験と CLI/API の独立回帰を追加し、repo 外の sentinel、子プロジェクト、nested repo・linked worktree、Git 不明・不一致、root と runner のリンクを確かめる。既存 fixture の既定を保ち、修理前の負例の RED と正例の現況を保存する。
- [ ] 2.2 `findProducer` の探索位置を Git 作業ツリー内へ限定し、不明時は root だけに止める。既存の監視役・優先順・reader・receipt 型を保ち、JSDoc に境界を記す。2.1 の全正負例と既存の品質受入試験を成功させ、元 assert・timeout・skip・設定の不変を確認する。

## 3. 統合検証

- [ ] 3.1 kit の patch changeset と同 PR の作業記録を加え、lint・型検査・全体試験と changeset status を成功させる。REQ-359 の実行済み成功試験、既存 REQ-319 の正常・不正・不足と古い結果拒否の保持を確認する。
- [ ] 3.2 `pnpm -s verify --change bound-quality-producer-search --done --scope local` を成功させ、全タスクと要件対応試験の実結果を記録する。<!-- loomake:gate=done -->

## Workflow follow-up

- 同 head の必須 CI・gate の ci scope・kit の 3 OS 試験・独立最終レビューを確認し、管理役が通常の L3 マージ条件で受入を判断する。本 change に段階受入の例外は使わない。
- 全受入後にこの change 経由で仕様を同期し archive し、その検証結果を Issue #238 に記録する。親 C001 と S1 の未達を本 change で完了扱いにしない。
