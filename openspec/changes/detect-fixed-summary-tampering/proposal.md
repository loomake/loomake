# detect-fixed-summary-tampering

## Why

要件定義 v0.11.3 の A16 は、固定済み要約と自己ハッシュが同時に改変されても、リリース記録の固定ハッシュと CI の識別子で検出することを求める。現在の証拠検証は保存文書と付随ハッシュを照合するが、外部に固定した値を受け取る照合関数がない。W1-12（Issue #71）として、固定 fixture でこの境界を確かめる。

## What Changes

- 新しい capability `summary-integrity` に REQ-443〜445 を追加する。
- kit に固定済み要約の照合関数 `checkFixedSummary` と結果の型を公開する。
- 要約とは別の引数で固定ハッシュと CI 実行 ID・試行番号・対象 SHA を受け取り、不一致なら再利用を拒否して FAIL と人への差し戻しを返す。
- リリース記録・要約・自己ハッシュの固定 fixture と、原本を変えずに写しを改変する A16 の試験を追加する。

## Capabilities

### New Capabilities

- `summary-integrity`: 外部に固定した値で要約の同一性と CI の識別子を照合する。

### Modified Capabilities

なし。既存の Evidence 1・2、CLI、verify JSON、trace report の契約は変えない。

## Non-goals

- Issue #69 の三層保管、正式な要約・リリース記録の形式。仮の照合対象欄との整合は #69 で再確認する。
- Issue #70 の eval・履歴・状況レポート、および gate・eval・report への組み込み。
- W5 の実リリースの承認、署名、CI への問い合わせ、保管先からの取得。

## Impact

- `packages/kit/src/verify/summary-integrity.ts` と kit の公開 API。
- `packages/kit/test/summary-integrity.test.ts` と固定 fixture。
- kit README と minor changeset。依存や品質設定は増減しない。
