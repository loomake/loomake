# Proposal

## Why

#415 の全体レビューで、PGP の秘密鍵と END 行のない秘密鍵が記録に残ることが分かった。平文とストリームの両経路で秘密鍵を伏せ字にし、REQ-199 の保護を満たす。

## What Changes

- PGP PRIVATE KEY BLOCK と END 行のない秘密鍵を伏せ字にすることを REQ-199 に明記する。
- 平文とストリームの両方で同じ入力を確認し、チャンクの分割位置によらず秘密鍵を隠す。
- PGP PUBLIC KEY BLOCK は保持し、既存のトークン置換とヘッダ上限を維持する。

## Capabilities

### New Capabilities

なし。

### Modified Capabilities

- `run`: 記録の秘密鍵の伏せ字に PGP と END 行のない入力を含める。

## Impact

`packages/runner/src/mask.ts` と `private-key-stream.ts`、runner の回帰テスト、runner patch changeset。公開 API・依存・設定は変更しない。

## Non-Goals

秘密情報の新しい種類の追加、見出し上限・記録上限の変更、実際の鍵による試験、#414・#416 以降の修理は含めない。
