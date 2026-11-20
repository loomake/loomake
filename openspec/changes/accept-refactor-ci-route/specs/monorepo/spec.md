## ADDED Requirements

### Requirement: リファクタの経路
CI の完了ゲートは、L3 で PR 本文に `loomake-change: none` と `loomake-route: refactor` の行があるとき、振る舞いを変えないリファクタとして次の条件をすべて確かめる MUST。満たせば change を指定せずに品質コマンドを実行し、その終了コードで終わる。

- `loomake-route:` の行がすべて `refactor`（大文字小文字は区別しない）
- 差分に `openspec/` の下の変更がない（名前の変更は前後のパスを見る）
- 既存のテストファイルを変更・削除・改名していない。テストファイルは `tests/` と `packages/*/test/` の下の全ファイルと `vitest.config.ts`。追加はよい
- 本文の `## 証跡` に `review: 実施済み` の行がある

足りなければ、change が必須だという案内に不足する条件をすべて添え、`verify` を実行せずに失敗する SHALL。

Source: REQ-477

#### Scenario: リファクタを受け付ける
- **WHEN** `packages/kit/src/a.ts` を変え、本文に `loomake-change: none`・`loomake-route: refactor` の行と、`review: 実施済み` の行を含む `## 証跡` がある PR で CI が動く
- **THEN** `--change` なしで品質コマンドだけが実行され、ジョブはその終了コードで終わる

#### Scenario: テストファイルを足す
- **WHEN** 「リファクタを受け付ける」と同じ PR で、新しい `packages/kit/test/a-pin.test.ts` も足している
- **THEN** リファクタとして受け付ける

#### Scenario: 既存のテストファイルを変えた
- **WHEN** 「リファクタを受け付ける」と同じ PR で、base にある `tests/a.test.ts` か `packages/kit/test/fixtures/x.json` を変更・削除・改名している
- **THEN** change が必須だという案内に、既存のテストファイルを変えたという理由とそのパスが添えられ、`verify` を実行せずにジョブが失敗する

#### Scenario: openspec を変えた
- **WHEN** 「リファクタを受け付ける」と同じ PR で、`openspec/changes/c1/tasks.md` も変えている
- **THEN** change が必須だという案内に、`openspec/` の下を変えたという理由が添えられ、ジョブが失敗する

#### Scenario: 独立レビューの証跡がない
- **WHEN** 「リファクタを受け付ける」と同じ PR で、`## 証跡` の review の行が `review: 未実施` だけか、`## 証跡` がない
- **THEN** change が必須だという案内に、独立レビューの証跡がないという理由が添えられ、ジョブが失敗する

#### Scenario: 経路の宣言が食い違う
- **WHEN** 本文に `loomake-route: refactor` と `loomake-route: spec-fix` の両方の行がある
- **THEN** 宣言の食い違いを理由に示し、リファクタとしても仕様適合の修正としても受け付けない

#### Scenario: 経路を名乗らない PR
- **WHEN** `loomake-route:` の行がない PR や、`spec-fix` だけを名乗る PR で CI が動く
- **THEN** これまでと同じ判定になる

## MODIFIED Requirements

### Requirement: 段階ごとの完了ゲートの動作
CI の完了ゲートは、決めた段階に応じて次のとおり動く MUST。

- L1：`commands.lint` と `tests/doc-links.test.ts` を実行する。change があれば change ごとに `verify` も実行し、なければ実行しない
- L2：「完了ゲートの対象の決め方」で change を決め、change ごとに `verify` を実行する。change がなければ「対象の change がない PR の扱い」に従う
- L3：L2 と同じ。仕様適合の修正とリファクタを除き、`loomake-change: none` の明示や change 未特定は失敗させる

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

#### Scenario: 仕様適合の修正を受け付ける
- **WHEN** 主仕様の Requirement の Source に `REQ-010` があり、`packages/kit/src/a.ts` と、`[REQ-010]` で始まる名前の試験を足した `tests/a.test.ts` を変え、本文に `loomake-change: none`・`loomake-route: spec-fix`・`loomake-req: REQ-010` の行がある PR で CI が動く
- **THEN** `--change` なしで品質コマンドだけが実行され、ジョブはその終了コードで終わる

#### Scenario: 仕様適合の修正で openspec を変えた
- **WHEN** 「仕様適合の修正を受け付ける」と同じ PR で、`openspec/changes/c1/tasks.md` も変えている
- **THEN** L3 では change が必須だという案内に、`openspec/` の下を変えたという理由が添えられ、`verify` を実行せずにジョブが失敗する

#### Scenario: 仕様適合の修正で主仕様にない REQ ID を書いた
- **WHEN** 「仕様適合の修正を受け付ける」と同じ PR で、本文の `loomake-req:` に主仕様のどの Source にもない `REQ-999` も書いている
- **THEN** L3 では change が必須だという案内に、`REQ-999` が主仕様の Source にないという理由が添えられ、`verify` を実行せずにジョブが失敗する

#### Scenario: 仕様適合の修正で REQ ID の試験を変えていない
- **WHEN** 「仕様適合の修正を受け付ける」と同じ印があり、`[REQ-010]` を名前に入れた試験を足しも変えもしていない PR で CI が動く
- **THEN** L3 では change が必須だという案内に、`REQ-010` の試験を足すか変えていないという理由が添えられ、`verify` を実行せずにジョブが失敗する

#### Scenario: 複数の要件を宣言する
- **WHEN** `loomake-req:` を複数行とカンマ区切りで宣言し、各値が `REQ-` と3桁以上の数字で、重複を除いた全 ID が主仕様と変更した試験の名前にある
- **THEN** すべての ID を確認し、ほかの条件も満たすときだけ仕様適合の修正を受け付ける。空値や形式の誤りがあれば理由付きで失敗する

#### Scenario: 宣言した経路が食い違う
- **WHEN** L3 の `loomake-change: none` に複数の `loomake-route:` 行があり、大文字小文字を区別せずに見ても spec-fix でない値が含まれる
- **THEN** 受け付けない値を理由に示し、仕様適合の修正として受け付けない

#### Scenario: 試験の本文を変更する
- **WHEN** vitest の対象である `tests/**/*.test.ts` または `packages/*/test/**/*.test.ts` の試験で、名前の `[REQ-010]` を保ったまま呼出の本文を変える
- **THEN** `REQ-010` の試験を変更したと数える。名前の変更だけのファイル移動、試験の削除、コメントや文字列内の呼出例は数えない

#### Scenario: 実行しない試験を足す
- **WHEN** 名前に `[REQ-010]` がある呼出に skip・todo・skipIf・runIf の修飾子が直接付き、ほかに `REQ-010` の試験を足しも変えもしていない
- **THEN** 試験の不足を理由に示し、仕様適合の修正として受け付けない
