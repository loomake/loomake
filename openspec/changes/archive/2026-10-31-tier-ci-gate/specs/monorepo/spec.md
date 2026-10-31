## ADDED Requirements

### Requirement: 工程の段階の判定
CI の完了ゲートは、変えたファイルのパス（名前の変更は前後両方）と `spec.md` の差分から、段階を次のうち最も高いものに決める MUST。

- L3：`packages/<name>/src/` の下。`spec.md` で `### Requirement:` の見出しから次の見出しまでの節（見出しを含む）に当たる行の追加・削除
- L2：`tests/`・`test/`・`.github/`・`scripts/`・`.agents/skills/`・`packages/` の下（src 以外）、`.changeset/config.json`、`openspec/config.yaml`、規則の文書（AGENTS.md・ADR・agent-workflow.md）、どれにも当たらないもの
- L1：「文書として扱うファイル」

archive に足し全ファイルが L1 の PR は L1。本文の `loomake-tier:` は高い段階にだけ上書きでき、下げる指定と読めない値は失敗にする MUST。

Source: REQ-342

#### Scenario: 文書だけの PR
- **WHEN** `docs/usage.md`・`README.md`・`.changeset/x.md`・`openspec/changes/c1/tasks.md` だけを変えた PR で CI が動く
- **THEN** 段階は L1 になる

#### Scenario: Scenario の文言だけを変えた spec.md
- **WHEN** `openspec/specs/x/spec.md` で、`#### Scenario:` の WHEN と THEN の行だけを変えた PR で CI が動く
- **THEN** 段階は L1 になる

#### Scenario: 試験と開発基盤の PR
- **WHEN** `tests/a.test.ts`・`packages/runner/test/a.test.ts`・`.github/workflows/ci.yml`・`scripts/x.mjs`・`.agents/skills/delivery/SKILL.md`・`packages/kit/templates/AGENTS.md`・`package.json` のどれかだけを変えた PR で CI が動く
- **THEN** 段階は L2 になる

#### Scenario: 製品コードの PR
- **WHEN** `packages/kit/src/verify/run.ts` を変えた PR で CI が動く
- **THEN** 段階は L3 になる

#### Scenario: Requirement の本文を変えた spec.md
- **WHEN** `openspec/specs/x/spec.md` か `openspec/changes/c1/specs/x/spec.md` で、`### Requirement:` の見出しか、その本文の行（RFC 2119 の語のない箇条書きを含む）を足すか消した PR で CI が動く
- **THEN** 段階は L3 になる

#### Scenario: Scenario に RFC 2119 の語を足す
- **WHEN** `openspec/specs/x/spec.md` の `#### Scenario:` の THEN の行に MUST を足しただけの PR で CI が動く
- **THEN** 段階は L1 になる

#### Scenario: 複数の段階に当たる PR
- **WHEN** `docs/usage.md` と `scripts/x.mjs` を変えた PR と、`docs/usage.md` と `packages/kit/src/a.ts` を変えた PR で CI が動く
- **THEN** 前者は L2、後者は L3 になる

#### Scenario: archive の PR
- **WHEN** `openspec/changes/c1/` の削除と、`openspec/changes/archive/2026-10-23-c1/` の追加と、`openspec/specs/x/spec.md` への Requirement の追加だけの PR で CI が動く
- **THEN** 段階は L1 になる。archive の下のファイルを変えただけで足していなければ例外に当たらず、L3 になる

#### Scenario: 名前を変えたファイル
- **WHEN** `scripts/x.md` を `docs/x.md` に名前を変えただけの PR で CI が動く
- **THEN** 変更前のパスも判定し、段階は L2 になる

#### Scenario: 本文で段階を上げる
- **WHEN** `docs/usage.md` だけを変え、本文に `loomake-tier: L3` の行がある PR で CI が動く
- **THEN** 段階は L3 になる

#### Scenario: 本文で段階を下げる
- **WHEN** `packages/kit/src/a.ts` を変え、本文に `loomake-tier: L2` の行がある PR で CI が動く
- **THEN** 段階は上げる方向にだけ上書きできると案内が表示され、ジョブが失敗する

#### Scenario: 本文の段階が読めない
- **WHEN** 本文に `loomake-tier: L4` の行がある PR で CI が動く
- **THEN** 段階の値が読めないと案内が表示され、ジョブが失敗する

#### Scenario: テンプレートのまま
- **WHEN** 本文に `loomake-tier: L1|L2|L3` の行がある PR と、`loomake-tier:` の行がない PR で CI が動く
- **THEN** どちらも判定どおりの段階になる

### Requirement: 段階ごとの完了ゲートの動作
CI の完了ゲートは、決めた段階に応じて次のとおり動く MUST。

- L1：`commands.lint` と `tests/doc-links.test.ts` を実行する。change があれば change ごとに `verify` も実行し、なければ実行しない
- L2：「完了ゲートの対象の決め方」で change を決め、change ごとに `verify` を実行する。change がなければ「対象の change がない PR の扱い」に従う
- L3：L2 と同じ。`loomake-change: none` の明示と、change を特定できないときは失敗させる

`verify` は `--change <id> --done`。L1 で tasks.md に完了した印がない change だけ `--spec-only`。段階と理由を `loomake-tier: <段階>（<理由>）` の形で標準出力に書き、`GITHUB_OUTPUT` があれば `tier` と `tier_line` も書く SHALL。

Source: REQ-343

#### Scenario: L1 で change がない
- **WHEN** `docs/usage.md` だけを変えた PR で CI が動く
- **THEN** lint と文書のリンクの試験が実行され、`verify` は実行されない

#### Scenario: L1 で change がある
- **WHEN** ブランチ名 `c2` で、`openspec/changes/c2/tasks.md` だけを変えた PR で CI が動く
- **THEN** lint と文書のリンクの試験と `verify --change c2 --done` が実行される

#### Scenario: 規則の文書は L2
- **WHEN** `AGENTS.md`・`docs/adr/0006-x.md`・`docs/dev/agent-workflow.md` のどれかだけを変えた PR で CI が動く
- **THEN** 段階は L2 になる

#### Scenario: L1 で lint が失敗する
- **WHEN** `README.md` だけを変えた PR で CI が動き、lint が非ゼロで終わる
- **THEN** ジョブが失敗する

#### Scenario: L2 で change がない
- **WHEN** `scripts/x.mjs` を変え、本文に `loomake-change: none` の行がある PR で CI が動く
- **THEN** `--change` なしで品質コマンドだけが実行される

#### Scenario: L2 で change がある
- **WHEN** `openspec/changes/c1/tasks.md` と `scripts/x.mjs` を変えた PR で CI が動く
- **THEN** `verify --change c1 --done` が実行される

#### Scenario: L3 で change がないと明示する
- **WHEN** `packages/kit/src/a.ts` を変え、本文に `loomake-change: none` の行がある PR で CI が動く
- **THEN** L3 では change が必須だと案内が表示され、`verify` を実行せずにジョブが失敗する

#### Scenario: L3 で change を特定できない
- **WHEN** ブランチ名 `fix-x` で、本文に明示がなく、`packages/kit/src/a.ts` だけを変えた PR で CI が動く
- **THEN** `loomake-change:` の行を書くよう案内が表示され、ジョブが失敗する

#### Scenario: L3 で change がある
- **WHEN** `openspec/changes/c1/tasks.md` と `packages/kit/src/a.ts` を変えた PR で CI が動く
- **THEN** `verify --change c1 --done` が実行され、標準出力に `loomake-tier: L3（packages/kit/src/a.ts）` の行が書かれる

#### Scenario: 提案だけの change
- **WHEN** `openspec/changes/c1/proposal.md` と、完了した印が 1 つもない `openspec/changes/c1/tasks.md` を足しただけ（段階 L1）の PR で CI が動く
- **THEN** `verify --change c1 --spec-only` が実行され、`--done` は実行されない

#### Scenario: L2・L3 は完了した印がなくても --done
- **WHEN** `packages/kit/src/a.ts` と、完了した印が 1 つもない `openspec/changes/c1/tasks.md` を変えた PR で CI が動く
- **THEN** `verify --change c1 --done` が実行される

#### Scenario: 理由の件数
- **WHEN** 4 つのファイルが段階を決めた PR で CI が動く
- **THEN** 理由にはパスが 3 件と「ほか 1 件」が書かれる

## MODIFIED Requirements

### Requirement: プルリクエストごとの完了ゲート
CI はプルリクエストごとに完了ゲートを実行し、不合格のときジョブを失敗させる SHALL。完了ゲートは先に「工程の段階の判定」で段階を決め、「段階ごとの完了ゲートの動作」に従う MUST。段階が L1 で対象の change がないときは `verify` を実行しない MUST。対象の change は「完了ゲートの対象の決め方」に従って決め、対象の change ごとに `--change <id> --done` で実行し、1 つでも不合格ならジョブを失敗させる MUST。対象の change がないときは、「対象の change がない PR の扱い」に従う MUST。あわせて、PR の種類によらず、いまの仕様（`openspec/specs/`）に `openspec validate --specs --strict` を実行し、失敗したらジョブを失敗させる SHALL。

Source: REQ-010, REQ-054, REQ-132, REQ-343

#### Scenario: ブランチ名が change-id と一致する
- **WHEN** ブランチ名 `setup-monorepo` の PR で CI が動く
- **THEN** `verify --change setup-monorepo --done` が実行され、不合格ならジョブが失敗する

#### Scenario: run のブランチ名
- **WHEN** `openspec/changes/c1` があり、ブランチ名 `loomake/c1` の PR で CI が動く
- **THEN** `verify --change c1 --done` が実行される

#### Scenario: PR 本文で明示する
- **WHEN** `openspec/changes/c1` と `openspec/changes/c2` があり、ブランチ名 `fix-typo` で、本文に `loomake-change: c1, c2` の行がある PR で CI が動く
- **THEN** `verify --change c1 --done` と `verify --change c2 --done` が実行される

#### Scenario: 明示した change がない
- **WHEN** 本文に `loomake-change: nothing` の行があり、`openspec/changes/nothing` がない PR で CI が動く
- **THEN** change がないことが表示され、ジョブが失敗する

#### Scenario: change のない PR だと明示する
- **WHEN** 本文に `loomake-change: none` の行があり、`packages/a.ts` を変えた PR で CI が動く
- **THEN** 段階は L2 になり、`--change` なしで品質コマンドだけが実行される

#### Scenario: 変えたファイルから決める
- **WHEN** ブランチ名 `feature-x` で、`openspec/changes/c1/tasks.md` と `packages/a.ts` を変えた PR で CI が動く
- **THEN** `verify --change c1 --done` が実行される

#### Scenario: コードを変えて対象を特定できない
- **WHEN** ブランチ名 `fix-typo` で、本文に明示がなく、`packages/a.ts` を変えた PR で CI が動く
- **THEN** `loomake-change:` の行を書くよう案内が表示され、ジョブが失敗する

#### Scenario: ブランチ名が change-id と一致しない
- **WHEN** ブランチ名 `fix-typo` で、本文に明示がなく、`docs/usage.md` だけを変えた PR で CI が動く
- **THEN** 段階は L1 になり、lint と文書のリンクの試験だけが実行される

#### Scenario: archive の PR
- **WHEN** ブランチ名 `archive-c1` で、`openspec/changes/c1/` の削除と、`openspec/changes/archive/2026-10-23-c1/` と `openspec/specs/` の追加と変更だけの PR で CI が動く
- **THEN** 段階は L1 になり、lint と文書のリンクの試験だけが実行される

#### Scenario: いまの仕様の検証
- **WHEN** archive で反映した Requirement の本文が長すぎて、`openspec validate --specs --strict` が失敗する PR で CI が動く
- **THEN** gate ジョブが失敗する

### Requirement: 対象の change がない PR の扱い
段階が L2 で対象の change がなく、`loomake-change: none` の明示があるか、PR で変えたファイルが「文書として扱うファイル」だけのときは、CI は品質コマンドだけを実行する MUST。段階が L2 で対象の change がなく、文書のほかのファイルを変えているときは、`loomake-change:` の行を書くよう日本語で案内し、ジョブを失敗させる MUST。段階が L1 で対象の change がないときは「段階ごとの完了ゲートの動作」に従い、品質コマンドを実行しない MUST。

Source: REQ-132, REQ-343

#### Scenario: changeset と README だけの PR
- **WHEN** ブランチ名 `fix-typo` で、本文に明示がなく、`README.md` と `.changeset/x.md` だけを変えた PR で CI が動く
- **THEN** 段階は L1 になり、lint と文書のリンクの試験だけが実行される

#### Scenario: 文書だけの PR を L2 に上げる
- **WHEN** ブランチ名 `fix-typo` で、`README.md` だけを変え、本文に `loomake-tier: L2` の行があり、`loomake-change:` の明示がない PR で CI が動く
- **THEN** `--change` なしで品質コマンドだけが実行される

#### Scenario: 文書とコードを変えた PR
- **WHEN** ブランチ名 `fix-typo` で、本文に明示がなく、`docs/usage.md` と `scripts/x.mjs` を変えた PR で CI が動く
- **THEN** `loomake-change:` の行を書くよう案内が表示され、ジョブが失敗する

### Requirement: 文書だけの PR の品質ジョブ
CI の quality ジョブは、PR の段階が「工程の段階の判定」で L1 になるとき（PR 本文の `loomake-tier:` は読まず、変えたファイルと spec の差分だけで判定する）、lint・typecheck・test・build・配布物の検査を実行せずに成功する SHALL。判定はジョブの中のステップで行い、ワークフローの `paths`・`paths-ignore` やジョブの `if` では行わない MUST（必須チェックのジョブが、同じ名前で結果を報告するようにするため）。main への push では、判定によらず、すべてのステップを実行する MUST。

Source: REQ-270, REQ-342

#### Scenario: 文書だけの PR
- **WHEN** PR で変えたファイルが `docs/worklog/2026-10-27.md`・`openspec/changes/c1/tasks.md`・`.changeset/c1.md` だけである
- **THEN** 判定は「文書だけ」になり、quality ジョブは lint・typecheck・test・build・配布物の検査を実行せずに成功する

#### Scenario: Requirement の本文を変えた spec.md だけの PR
- **WHEN** PR で変えたファイルが `openspec/specs/x/spec.md` だけで、SHALL を含む行を足している
- **THEN** 段階は L3 なので判定は「文書だけ」にならず、quality ジョブはすべてのステップを実行する

#### Scenario: 判定をジョブの中で行う
- **WHEN** `.github/workflows/ci.yml` を読む
- **THEN** ワークフローの `on` に `paths`・`paths-ignore` がなく、quality ジョブに変えたファイルを判定するステップがあり、lint・typecheck・test・build・配布物の検査のステップは、判定が「文書だけ」でないときだけ実行される

#### Scenario: main への push
- **WHEN** main への push で quality ジョブが動く
- **THEN** 変えたファイルによらず、すべてのステップを実行する
