# Proposal: spec-fixups-1031

## Why

tier-ci-gate（PR #195 で archive）で主仕様に入った「完了ゲートの対象の決め方」（REQ-132）の Scenario「明示を優先する」は、THEN が「`verify --change c1 --done` だけが実行される」と、実行するコマンド全体を限定している。実装（`scripts/ci-gate.mjs`）は段階 L1 で lint と文書のリンクの試験も実行する。これは「段階ごとの完了ゲートの動作」（REQ-343）の本文どおりで、試験（`tests/ci-gate-process.test.ts`）もそう確かめている。誤っているのは Scenario の文言である。PR #194 のレビューで見つかった。

同じレビューで挙がった「ブランチ名が change-id と一致しない」「archive の PR」「changeset と README だけの PR」の 3 件は、tier-ci-gate の archive で THEN が「段階は L1 になり、lint と文書のリンクの試験だけが実行される」に変わっている。試験は呼び出しが lint と文書のリンクの試験の 2 つだけ（verify を呼ばない）ことを確かめており、文言と食い違わないので、仕様は変えず、レビュー表だけを記録し直す。

## What Changes

- `monorepo` の「完了ゲートの対象の決め方」を MODIFIED にし、Scenario「明示を優先する」の THEN を「verify の呼び出しは `verify --change c1 --done` だけになる」に直す。同じ Requirement の Scenario「変えたファイルとブランチ名を合わせる」は、c1 の tasks.md の状態を WHEN に書き、THEN を `verify --change c1 --spec-only` と `verify --change c2 --done` に直す。変更したファイルだけの PR は段階 L1 で、REQ-343 は L1 で完了した印のない change を `--spec-only` で検査すると定めている。実装（`gateArgs`）と試験はこれに従っている。Requirement の本文は変えない。
- レビュー表 `docs/quality/scenarios.json` で、tier-ci-gate の archive で無効になった 4 行（SCN-149eab9b・SCN-d31a4872・SCN-711b5333・SCN-2f7149cc）を、試験を読み直して本文ブロックのハッシュで記録し直す。

## Capabilities

### New Capabilities

なし。

### Modified Capabilities

- `monorepo`：「完了ゲートの対象の決め方」（REQ-132）の Scenario「明示を優先する」の THEN と、Scenario「変えたファイルとブランチ名を合わせる」の WHEN・THEN を変える。

## Impact

仕様の文言とレビュー表だけを変える。製品のコード・試験・公開 API・配布するパッケージは変えないので、changeset は足さない。
