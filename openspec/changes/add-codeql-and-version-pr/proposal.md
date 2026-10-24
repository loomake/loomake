# CodeQL を足し、バージョンを上げる PR を通す

## Why

2026-10-24 の品質評価で、次の 2 点が残った。

- CodeQL の Action は `github/codeql-action/init@<sha>` のようにサブパスを使う。外部 Actions の検査（REQ-167）は `owner/repo@sha` の形だけを認めるので、CodeQL のワークフローを足せない
- `pnpm changeset version` で版を上げた PR は、changeset を消化して package.json を変えるので、`changeset status`（REQ-056）が「変更したのに changeset がない」で失敗する。docs/release.md の公開の手順のうち、この PR が CI を通らない

## What Changes

- 外部 Actions のサブパスつきの参照も、完全なコミット SHA で固定していれば認め、記録とはリポジトリ（owner/repo）と SHA で照合する
- CodeQL で JavaScript・TypeScript を解析するワークフローを足す
- `changeset status` が失敗しても、変えたファイルが版の上げ下げ（package.json の version と内部の依存、CHANGELOG.md、消化した changeset）だけなら、公開準備の検査を合格にする

## Capabilities

### New Capabilities

なし。

### Modified Capabilities

- `release-integrity`: サブパスつきの Action の参照と、CodeQL の解析。
- `monorepo`: 版を上げる PR の changeset の検査。

## Impact

テスト（tests/release-security.test.ts・tests/monorepo.test.ts）と、.github/ のワークフローと Action の記録を変える。配布物の振る舞いは変えない。
