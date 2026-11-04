# Proposal

## Why

固定 commit の複数文書は size ごとに Git を起動している。既定予算の size 照会を一括化し、内容・上限・拒否順を保って起動を減らす。

## What Changes

REQ-418 を追加し、適格な複数文書の size を一括取得する。現 REQ-376 の baseline PASS、新要件の RED、source の GREEN を同じ L3 PR の小さいタスクで進め、全試験をその PR に残す。

## Capabilities

### New Capabilities

なし。

### Modified Capabilities

- `trusted-baseline`: REQ-418 を追加し、REQ-376・377 は変更しない。

## Impact

対象は私的 `git-objects.ts`、新規専用試験、正式6文書・同期/archive・kit patch changeset・日別worklog。本文は個別取得を保つ。Raw API・REQ-405/412/413/未承認414・公開形式・品質設定は対象外。fixture 修理 #399 とは領域を分け、baseline の別 PR や main 受入を依存にしない。
