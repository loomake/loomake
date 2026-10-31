# Proposal: tier-ci-gate

## Why

AGENTS.md 2 章は変更の種類で工程を 3 段階（L1 文書・L2 試験と開発基盤・L3 製品コード）に分け、段階は PR の変更パスから gate が決めると定めた（PR #187、計画 rebuild-plan 2.1）。しかし CI の完了ゲート（`scripts/ci-gate.mjs`）は、いまも PR の種類によらず `verify` を呼ぶ。文書だけの PR でも lint・typecheck・全体のテストが走り、L1 の「gate ＋ lint」という軽い工程が成立していない。

gate が文書かどうかを決める判定（`isDocument`）は、quality ジョブの判定（`scripts/ci-docs-only.mjs` の `isDocumentPath`）と別の実装で、`.md` ならどこでも文書、`openspec/` の下は設定でも文書と扱う。2 つのジョブで「文書だけ」の意味が食い違う。

あわせて、マージされた PR の worktree を当日中に消す運用（計画 2.6）のための台本がなく、手作業で消している。

## What Changes

- `scripts/ci-tier.mjs` を足し、変更パスと spec の差分から段階 L1・L2・L3 を決める。Requirement の変更は、変更行が属する節（`### Requirement:` の見出しから次の見出しまで）で判定する。`loomake-tier:` の行で上げる方向にだけ上書きできる。
- `scripts/ci-gate.mjs` を段階で分ける。L1 は lint と文書のリンクの試験を実行し、change がなければ `verify` を呼ばない（change があれば段階を問わず `verify` を通す。L1 で tasks.md に完了した印がない提案だけの change は `--spec-only`、L2・L3 は常に `--done`）。L2 は今までどおり。L3 は change を必須にする。決めた段階と理由を標準出力の 1 行と `GITHUB_OUTPUT` に書く。gate の独自の `isDocument` を消し、quality と同じ `isDocumentPath` を使う。
- `scripts/ci-docs-only.mjs` の最終判定を「段階が L1」に変える。Requirement の本文だけを変えた spec.md の PR は、文書だけと判定しなくなる。
- `.github/workflows/ci.yml` の gate ステップに `id: gate` を付け、コメントを段階の説明に直す。
- PR テンプレートと delivery スキルの証跡ブロックに `tier:` の行を足す。スキルに worktree の削除の手順を 1 行足す。
- `scripts/clean-merged-worktrees.sh` と `scripts/delivery-metrics.sh` を足す。どちらも開発の仕組みで、仕様の対象にしない。
- `docs/dev/ci.md` の「文書だけの PR でテストを実行するジョブ」を段階の説明に書き換える。
- main で重複している REQ-273 を解消する。agents-rules の「AGENTS.md の作業記録の決まり」の Source を REQ-288 に振り直し、`tests/kit-assets.test.ts` と `docs/quality/scenarios.json` の ID も合わせる。本文は変えない。

## Capabilities

### New Capabilities

なし。

### Modified Capabilities

- `agents-rules`: 「AGENTS.md の作業記録の決まり」の Source を REQ-273 から REQ-288 に振り直す（本文は変えない）。
- `monorepo`: 「工程の段階の判定」（REQ-342）と「段階ごとの完了ゲートの動作」（REQ-343）を足す。「プルリクエストごとの完了ゲート」「対象の change がない PR の扱い」を段階に合わせて直し、「文書だけの PR の品質ジョブ」の判定を段階 L1 に変える。

## Impact

`scripts/ci-tier.mjs`（新規）・`scripts/ci-gate.mjs`・`scripts/ci-docs-only.mjs`・`.github/workflows/ci.yml`・`.github/PULL_REQUEST_TEMPLATE.md`・`.agents/skills/delivery/SKILL.md`・`docs/dev/ci.md` と、試験 `tests/ci-tier.test.ts`（新規）・`tests/ci-gate-process.test.ts`・`tests/ci-docs-only.test.ts` を変える。製品のコード、公開 API、配布するパッケージは変えないので、changeset は足さない。

副作用として、`packages/kit/templates/` や `openspec/config.yaml` だけを変えた PR は、gate で「文書だけ」ではなく L2 として扱われる（計画 2.1 と同じ）。`ci:all-os` ラベルを gate で強制することは、3 OS の試験の時間切れ（計画 3 章の手順 5）が直るまで入れない。
