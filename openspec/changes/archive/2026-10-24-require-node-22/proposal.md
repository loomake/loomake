# require-node-22

## Why
Node 20 のサポートは 2026-04 に終わっている。配布物の `engines.node` は `>=20.19.0`（REQ-048・REQ-089・REQ-125）のままで、サポートの終わった版を支え続けることになる。実行時の依存は Loomake のパッケージだけなので技術的な制約はなく、サポートの方針として下限を上げる（docs/release.md の 7）。

## What Changes
- ルートと 5 つのパッケージの `engines.node` を `>=22.12.0` にする（REQ-142）
- trace record・trace report・run の動作環境を Node.js 22.12 以上にする（REQ-142）
- CI の `node20` ジョブを `node22` ジョブにし、Node 22.12.0 でビルドした CLI が動くかを確かめる（REQ-142）
- README・docs/usage.md・AGENTS.md・パッケージの README の「20.19 以上」を「22.12 以上」に直す

## Non-goals
- 開発に使う Node（24）と devcontainer の変更
- Node 22 以上でしか使えない API への書き換え

## Capabilities

### New Capabilities
なし

### Modified Capabilities
- `monorepo`：Node.js のバージョン宣言を `>=22.12.0` にする
- `trace-record`・`trace-report`・`run`：動作環境を Node.js 22.12 以上にする

## Impact
- 影響するコード：ルートと `packages/*/package.json`、`.github/workflows/ci.yml`、`tests/monorepo.test.ts`、`packages/trace/test/record.test.ts`、`packages/runner/test/run.test.ts`、README・docs
- Node 20 の利用者は、次の版から入れられなくなる
