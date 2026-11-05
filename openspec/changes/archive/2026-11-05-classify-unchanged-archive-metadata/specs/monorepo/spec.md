# Spec Delta: monorepo

## ADDED Requirements

### Requirement: archive のメタデータの移動
次のすべてに当たる名前の変更の前後のパスは、段階を L1 とする MUST。

- R100 で、merge-base と HEAD のオブジェクト ID が同じで、前後のモードが 100644
- 前が `openspec/changes/<id>/.openspec.yaml`、後が `openspec/changes/archive/<名前>/.openspec.yaml`
- `<id>` は `/` を含まず、`archive` でも `.` 始まりでもない
- `<id>` が `YYYY-MM-DD-` で始まれば `<名前>` は `<id>`、始まらなければ `<日付>-<id>`。どちらの日付も実在する日
- 前後のパスが「文書として扱わないファイルの名前」に当たらない
- 同じ PR で、同じ `archive/<名前>/` の下に文書を足すか移している

当たらないものは今までどおりに扱い、オブジェクト ID を確かめられなければ当たらないとみなす MUST。このファイルを文書には加えない。

Source: REQ-362

#### Scenario: 内容を変えずに archive へ移すメタデータ
- **WHEN** `openspec/changes/c1/` の `tasks.md` と `.openspec.yaml` を `openspec/changes/archive/2026-11-01-c1/` へ R100 で移し、`openspec/specs/x/spec.md` に Requirement を足した PR で CI が動く
- **THEN** 段階は L1 になり、quality ジョブは品質コマンドを飛ばし、gate は lint と文書のリンクの試験だけを実行する

#### Scenario: 日付で始まる change の archive
- **WHEN** `openspec/changes/2026-11-01-c1/` の `tasks.md` と `.openspec.yaml` を `openspec/changes/archive/2026-11-01-c1/` へ R100 で移した PR で CI が動く
- **THEN** 段階は L1 になる

#### Scenario: 日付の二重・別の change・不正な日付
- **WHEN** `c1` の `.openspec.yaml` の移動先が `archive/c1/`・`archive/2026-11-01-c2/`・`archive/2026-02-30-c1/`・`archive/2026-11-01-2026-11-01-c1/`・`archive/2026-11-01-c1/sub/` のどれかか、`2026-11-01-c1` の移動先が `archive/2026-11-02-2026-11-01-c1/` か、`2026-02-30-c1` の移動先が `archive/2026-02-30-c1/` である
- **THEN** どの場合も、段階は L1 にならない

#### Scenario: 移動元の名前
- **WHEN** 移動元が `openspec/changes/archive/.openspec.yaml`・`openspec/changes/.x/.openspec.yaml`・`openspec/changes/c1/sub/.openspec.yaml`・`openspec/changes/aux/.openspec.yaml` のどれかである
- **THEN** どの場合も、段階は L1 にならない

#### Scenario: 内容を変えたメタデータ
- **WHEN** 最初の Scenario と同じ PR で、`.openspec.yaml` が R090 か、R100 でも変更前と変更後のオブジェクト ID が違う
- **THEN** 段階は L1 にならない

#### Scenario: オブジェクト ID を確かめられない
- **WHEN** 変更前か変更後のオブジェクト ID を読むコマンドが失敗する
- **THEN** 段階は L1 にならない

#### Scenario: 通常のファイルでないメタデータ
- **WHEN** 移した `.openspec.yaml` の変更前か変更後のモードが 100755 か 120000 である
- **THEN** 段階は L1 にならない

#### Scenario: メタデータだけの移動
- **WHEN** `.openspec.yaml` の R100 の移動と主仕様への Requirement の追加だけで、同じ `archive/<名前>/` の下に文書を足していない PR で CI が動く
- **THEN** 段階は L1 にならない

#### Scenario: 足したメタデータ・変えたメタデータ・ほかの YAML
- **WHEN** archive の下に `.openspec.yaml` を足した PR、archive の下の `.openspec.yaml` を変えた PR、`openspec/changes/c1/x.yaml` を `archive/2026-11-01-c1/x.yaml` へ R100 で移した PR で CI が動く
- **THEN** どの場合も、段階は L1 にならない

#### Scenario: コードの混在
- **WHEN** 最初の Scenario の PR で、`scripts/x.mjs` も変えている
- **THEN** 段階は L3 になる

## MODIFIED Requirements

### Requirement: 工程の段階の判定
CI の完了ゲートは、変えたファイルのパス（名前の変更は前後両方）と `spec.md` の差分から、段階を次のうち最も高いものに決める MUST。

- L3：`packages/<name>/src/` の下。`spec.md` で `### Requirement:` の見出しから次の見出しまでの節（見出しを含む）に当たる行の追加・削除
- L2：`tests/`・`test/`・`.github/`・`scripts/`・`.agents/skills/`・`packages/` の下（src 以外）、`.changeset/config.json`、`openspec/config.yaml`、規則の文書（AGENTS.md・ADR・agent-workflow.md）、どれにも当たらないもの
- L1：「文書として扱うファイル」か「archive のメタデータの移動」

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

