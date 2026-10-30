# Design: stop-on-empty-engine-diff

## 判断の位置

エンジンの終わり方の判断（`decideAfterEngine`、REQ-204）は変えず、そのあとに変更の有無の判断（`decideAfterChanges`、REQ-332）を置く。

順序：エンジン → `decideAfterEngine`（中断・上限・質問・終了コード・HEAD／Git内部の変更）→ `guard()`（不正な直し方）→ `decideAfterChanges` → タスクを完了にしてコミット。

質問が合図より先になり、不正な直し方はタスクを完了にする前に止まる。

## 差分の判定

`guard()` の中の `findViolations` が `git add -A` で index に載せた状態を、`checkTask` の前に `git diff --cached --name-only` で調べる。

- ガードの入力と同じ差分なので、判定の範囲がずれない。
- run 自身が付ける tasks.md のチェックは、まだ index にないので、「チェックだけの差分」を除く処理が要らない。
- エンジンが tasks.md を変えた場合は、ガード（REQ-111）が先に止める。
- 直しの段階は、既存の `phases.ts` の判定と同じ書き方にそろえる。

## 合図

`LOOMAKE-QUESTION:` と同じく、行頭の合図にする（`/^LOOMAKE-NOCHANGE:[ \t]*(\S.*)$/m`）。

- 理由を必須にするのは、変更なしの完了をレビューで見分けるため。
- 合図はタスクの段階だけで意味を持つ。直しの段階では、差分のない直しは完了ゲートの結果を変えないので、合図があっても止まる。

## 止まり方

状態は既存の `stopped`、終了コードは 1（REQ-107）とし、`RunSummary` の型は変えない。

- 止まるとき index は空なので、`git reset` は要らない。
- 作業ツリーにある `.gitignore` 除外のファイルには触れない。

## 選ばなかった案

- 合図を認めず、常に止まる：変更不要なタスクのたびに人の操作が要る（確認事項 Q-01）。
- tasks.md のチェック後に、tasks.md を除いて比べる：除外の処理が増え、エンジンの tasks.md の変更と区別しにくい。

## 目的・範囲・対象外・前提・不明点

**目的**
- エンジンが終了コード 0 で終わっても、作業ツリーに差分がなければ、そのタスクを完了にしない。
- 変更の要らないタスクは、エンジンの明示の合図があるときだけ完了にする。
- 完了ゲートの直しで差分が出ないまま、直しの上限まで繰り返すことをなくす。

**範囲**
- 実装：`packages/runner/src/run/phases.ts`（タスクの段階と直しの段階）、`run/decision-policy.ts`（純粋な判断を 1 つ足す）、`run/prompt.ts`（決まりを 1 行足す）
- 試験：試験と、既存の試験の台本の置き換え
- 文書：利用者向けの文書（usage と run-recovery）、`docs/quality/scenarios.json`
- 仕様：差分仕様（`run` と `run-decision-policy` に ADDED、`run` の REQ-099・REQ-100 に MODIFIED）

**対象外**
- エンジンの権限の設定（`claudeArgs` の許可一覧）の変更。今回の再現は権限が足りないことが原因ですが、権限を広げる判断は別に扱います。
- ガード（run-guards）の検出規則。
- 完了ゲートのタスクの扱い。
- `decideAfterEngine` の優先順位（REQ-204）。
- 品質コマンドの不安定さ（flaky）の扱い。

**前提**
- 対象は HEAD `d5aa30d`。進行中の change 5 件は、どれも今回の範囲と重なりません。
  - `align-template-worklog`：テンプレート
  - `close-docs-only-gaps`：CI の文書判定
  - `gate-base-remote-ref`：CI の gate
  - `move-verification-policy-to-kit`：core と kit の判定
  - `record-ci-test-diagnostics`：CI の診断
- 要件 ID は REQ-330〜332 を使います。

**不明点**

| ID | 内容 | ブロッキング |
|---|---|---|
| Q-01 | 変更不要のタスクを、合図で認めるか | **yes**（外部の振る舞いが変わる） |
| Q-02 | 直しで差分がなければ、すぐ止めるか | **yes**（外部の振る舞いが変わる） |
| Q-03 | 合図の理由を、どこに残すか | no |

詳しくは trace.md の確認事項に書きます（Q-01〜Q-03 は 2026-10-30 におすすめ案で回答済み）。

## 観測事実と原因

1. **タスクの段階**（`packages/runner/src/run/phases.ts:63-70`）
   - `callEngine` は、エンジンの終わり方だけで止まるかを決めます。終了コード 0 で質問もなければ `undefined` を返します（`phases.ts:43-44`、`decision-policy.ts:21-28`）。
   - そのあと `guard(ctx)`（`phases.ts:65`）、`checkTask`（`phases.ts:67`）、`git add -A`（`phases.ts:68`）、`git commit`（`phases.ts:69`）が、差分の有無を見ずに続きます。
   - このため、エンジンが何も変えなくても、tasks.md だけを含む `run(<id>): 1.1 …` のコミットができます。
2. **ガードの入力**（`packages/runner/src/guards.ts:62-64`）
   - `findViolations` は最初に `git add -A` を実行し、index に載せた差分を調べます。
   - つまり `guard()` から戻った直後の index は、エンジンの変更だけを持っています。run 自身のチェックは、まだ付いていません。
   - エンジンが tasks.md を書き換えた場合は、ガードが「change の文書を変えました」として先に止めます（`guards.ts:74`）。
3. **直しの段階**（`phases.ts:132-135`）
   - 差分がないときはコミットを飛ばしますが、止まらずにループの先頭へ戻ります。
   - 差分がないので完了ゲートは同じ結果で不合格になり、`decideAfterGate` の上限（`decision-policy.ts:37`）まで、エンジンと verify を繰り返します。
4. **既存の合図**
   - 質問の合図は `decideAfterEngine` が行頭の `^LOOMAKE-QUESTION:\s*(.*)$/m` で読みます（`decision-policy.ts:22-23`）。
   - 指示の決まりは `prompt.ts:23-26` にあります。
   - 停止の状態は `RunSummary.status` の `'completed' | 'stopped' | 'interrupted'` です（`run/types.ts:35`）。理由は自由な文で、種別を表す欄はありません。
5. **再現**
   - `.loomake/repro/bin/claude` は、入力を読み捨てて、何もせずに result（`I could not make changes because the Bash tool was not permitted.`）を返す偽のエンジンです。
   - `.loomake/repro/run.mjs` はこれを使って `runRun` を呼びます。
6. **既存の試験も、差分なしの完了に頼っています**
   - `packages/runner/test/run.test.ts:54` の `passing = [{ write: { 'impl.txt': … } }, {}]` は、1.2 で何も変えないエンジンを完了として扱います。
   - `packages/runner/test/helpers.ts:40` の偽の claude は、台本が尽きると何もしません。
   - `{}` を使う台本は、runner の試験の 12 ファイルにあります。例：`run.test.ts:188,286,305(台本なし),343`、`guards.test.ts:19,333`、`external-budget.test.ts:139`、`pr.test.ts:15` など。
   - 修正すると、これらは仕様どおりに止まって失敗するので、台本の置き換えが必要です。

**原因：** run の段階の流れに「エンジンの変更がない」ことを判断する分岐がありません。終了コード 0 を「タスクを終えた」と同じに扱っています。

## 修正方針の比較

### 3.1 変更不要のタスクを認めるか（Q-01）

| 案 | 内容 | 利点 | 欠点 |
|---|---|---|---|
| **A（おすすめ）** | 差分がなく、出力の行頭に `LOOMAKE-NOCHANGE: <理由>` があれば完了にする。なければ止まる | 確認だけのタスクや、前のタスクで済んだタスクを、無人の run のまま進められる。`LOOMAKE-QUESTION:` と同じ形で、エンジンへの決まりと読み取りがそろう。既存の試験は台本の置き換えで済む | 誤った合図をエンジンが出す余地が残る。理由をレビューで見られるようにする必要がある（Q-03） |
| B | 差分がなければ常に止まる | 判断が最も単純 | 変更不要のタスクのたびに、人が tasks.md を完了にしてコミットする必要がある。既存の試験の台本は、ダミーのファイルを書く形に変えることになる |

### 3.2 合図の扱い（A を採る場合）

- **正規表現：** `/^LOOMAKE-NOCHANGE:[ \t]*(\S.*)$/m`。行頭だけを認め、理由が空なら合図とみなしません。合図が複数あれば最初を使います。
- **質問との優先順位：** `decideAfterEngine` が先に動くので、質問の合図が優先されます。既存の規則は変えません。
- **差分と合図が両方ある場合：** 合図は無視して、ふつうにコミットします（仮定 A-02）。
- **直しの段階：** 合図は意味を持たないので、差分がなければ止まります（Q-02）。直しの指示には、この決まりを含めません。

### 3.3 差分の判定方法

| 案 | 内容 |
|---|---|
| **a（おすすめ）** | `guard()` の直後、`checkTask` の前に `git diff --cached --name-only` を見る。ガードと同じ index を入力にするので、ガードの入力と同じ差分になる。run 自身のチェックはまだ付いていないので、「tasks.md のチェックだけの差分」は構造上、差分なしと数えられ、除外する処理が要らない。直しの段階の `phases.ts:133` と同じ書き方になる |
| b | `checkTask` と `git add -A` のあとに見て、tasksRel を除外する。除外する処理が増えるうえ、エンジンが tasks.md を変えた場合と区別しにくい |

### 3.4 止まるときの扱い

- 状態は `stopped`、終了コードは 1 で、既存の REQ-107 と同じです。新しい状態の種別は足しません。
- 理由の文：
  - タスク：`エンジンが変更を残さずに終わりました`
  - 直し：`完了ゲートの直しで、エンジンが変更を残さずに終わりました`
- 残ったタスク：
  - タスクの段階：止まったタスクから後ろ（`remaining`）
  - 直しの段階：`gateTasks`
- 標準出力には、エンジンの出力の記録の場所（`.loomake/runs/<run>/NN-output.json`）と、次の 2 つの対処を表示します。
  1. 権限や環境を見直して、もう一度実行する
  2. 変更が要らないなら、tasks.md のそのタスクを完了にして自分でコミットしてから、もう一度実行する

### 3.5 判断の置き場所

`decision-policy.ts` に、I/O を持たない `decideAfterChanges` を足します（REQ-332）。`decideAfterEngine` には手を入れません。

```ts
export type ChangeObservation = Readonly<{ phase: 'task' | 'repair'; changed: boolean; text: string }>;
export type ChangeDecision = { kind: 'commit' } | { kind: 'no-change'; reason: string } | { kind: 'stop'; reason: string };

/** エンジンの変更の有無と合図から、コミット・変更なしの完了・停止を決める（REQ-330〜REQ-332） */
export function decideAfterChanges(value: ChangeObservation): ChangeDecision {
  if (value.changed) return { kind: 'commit' };
  if (value.phase === 'repair') return { kind: 'stop', reason: '完了ゲートの直しで、エンジンが変更を残さずに終わりました' };
  const noChange = value.text.match(/^LOOMAKE-NOCHANGE:[ \t]*(\S.*)$/m);
  if (noChange) return { kind: 'no-change', reason: noChange[1].trim() };
  return { kind: 'stop', reason: 'エンジンが変更を残さずに終わりました' };
}
```

### 3.6 phases.ts の変更

- **`callEngine`：** 続行のときにエンジンの本文を返す形にします（例：`{ stop } | { text }`）。
- **`runEngineTasks`：** `guard` のあとに `decideAfterChanges({ phase: 'task', changed, text })` を呼びます。
  - `stop`：止まる。index は空なので、戻す処理は要りません。
  - `no-change`：標準出力に「変更なしで完了にしました：<タスク>（<理由>）」と出し、これまでどおり `checkTask`・`add`・`commit` をします。
  - Q-03 の A を採るなら、コミット本文に `LOOMAKE-NOCHANGE: ${maskSecrets(reason)}` を付けます。
- **`runGate`：** `phases.ts:133-135` の `if` を `decideAfterChanges({ phase: 'repair', … })` に置き換えます。`stop` なら `stopped(reason)` を返します。
- **`prompt.ts`：** `failure` がないとき（タスクの指示）だけ、次の決まりを 1 行足します。
  > - 変更が要らないタスクなら、何も変えずに `LOOMAKE-NOCHANGE:` で始まる行に理由を書いて終える。変更を残さず、この行もなければ、run はタスクを完了にせずに止まる

## 受入条件と確認方法

### 受入条件

| ID | 受入条件 |
|---|---|
| AC-1 (REQ-330) | 差分も合図もないとき、タスクは `- [ ]` のままで、run はコミットせず、エンジンを 1 回だけ呼んで止まる。終了コードは 1、summary の status は `stopped`。理由と対処が表示される |
| AC-2 (REQ-330) | 差分がなく、合図と理由があるとき、tasks.md だけの `run(c1): 1.2 …` のコミットで完了にし、理由を表示する |
| AC-3 (REQ-330) | 合図が行頭にないか、理由が空なら、AC-1 と同じに止まる。質問と合図が両方あれば、質問で止まる。差分と合図が両方あれば、ふつうにコミットする |
| AC-4 (REQ-330) | タスクの指示に合図の決まりが含まれ、直しの指示には含まれない |
| AC-5 (REQ-331) | 直しで差分がなければ、上限を待たずに止まる。合図があっても止まる。完了ゲートのタスクは `- [ ]` のまま |
| AC-6 (REQ-332) | 純粋な判断が、入力を変えずに定めた結果を返す。変異（後述）を同じ試験の assertion で検出する |
| AC-7 | 既存の試験は、台本の置き換えだけで、期待値を変えずに通る。lint・typecheck・test と `verify --done` が通る |

### 回帰試験

修正前に失敗し、修正後に成功する試験です。新しいファイル `packages/runner/test/run-no-change.test.ts` に置き、`run.test.ts` の `withRepo`・`run` と同じ書き方にします。

1. **`[REQ-330] エンジンが変更を残さず合図もなく終えたら、タスクを完了にせず、コミットせずに止まる`**
   - 台本：`[{ output: 'I could not make changes because the Bash tool was not permitted.' }]`
   - 期待：`code===1`、標準出力に「エンジンが変更を残さずに終わりました」、`tasksMd` に `- [ ] 1.1`、`log(repo)` が `['init']`、`calls()` が 1 件、`summary.status==='stopped'`、remainingTasks の先頭が 1.1
   - **修正前に失敗する理由：** 1.1 が `- [x]` になり、コミットが増え、直しまで呼ばれて calls が 7 件になる
2. **`[REQ-330] LOOMAKE-NOCHANGE: と理由を出して変更を残さなければ、tasks.md だけのコミットで完了にし、理由を表示する`**
   - 台本：`[{ write: impl }, { output: '確かめました。\nLOOMAKE-NOCHANGE: 1.1 で済んでいます' }]`
   - 期待：`code===0`、1.2 のコミットのファイルが tasks.md だけ、標準出力に理由がある。Q-03 の決定に従い、コミット本文にも理由がある
   - **修正前に失敗する理由：** 理由の表示がない
3. **`[REQ-330] 変更を残したうえで LOOMAKE-NOCHANGE を出したら、変更と合わせてコミットする`**
   - 修正前も成功します。退行を防ぐための試験です。
4. **`[REQ-330] LOOMAKE-QUESTION と LOOMAKE-NOCHANGE が両方あれば、質問で止まる`**
5. **`[REQ-330] タスクの指示に LOOMAKE-NOCHANGE の決まりを含め、完了ゲートの直しの指示には含めない`**
   - dry-run の表示と、直しの回の `calls()[n].prompt` で確かめます。
6. **`[REQ-331] 完了ゲートの直しでエンジンが変更を残さなければ、直しの上限を待たずに止まる`**
   - 台本：`[{ write: { 'a.txt': 'a' } }, { write: { 'b.txt': 'b' } }, {}]`。impl.txt がないので、完了ゲートは不合格になります。
   - 期待：`code===1`、理由、`calls()` が 3 件、`- [ ] 3.1`
   - **修正前に失敗する理由：** 既定の maxFixes 5 で calls が 7 件になる
7. **`[REQ-331] 完了ゲートの直しで LOOMAKE-NOCHANGE を出しても、変更がなければ止まる`**
8. **`[REQ-332] %s`**（`packages/runner/test/decision-policy.test.ts` に `it.each` で足す）
   - 次の 9 行を確かめます。
     - タスクで変更あり → commit
     - 直しで変更あり → commit
     - 変更なし・合図なし → stop
     - 合図あり → no-change と理由
     - 行頭でない合図 → stop
     - 理由が空の合図 → stop
     - 最初の合図を使う
     - 直しでは合図があっても stop
     - freeze した入力を変えない

### 突然変異試験（`tests/run-decision-mutations.test.ts`）

次の 2 つの変異を足します。

| 変異 | 変える前 | 変えた後 |
|---|---|---|
| `{ id: 'repair-no-change' }` | `if (value.phase === 'repair')` | `if (value.phase === 'repair' && !value.text)` |
| `{ id: 'no-change-anchor' }` | `/^LOOMAKE-NOCHANGE:` | `/LOOMAKE-NOCHANGE:` |

- 試験の名前の数の期待値 `27` は、足した行の数だけ増やします。
- 結果の期待値は `['killed' × 5]` にします（仮定 A-04）。

### 確認コマンド

- `pnpm -s test -- packages/runner`
- `pnpm -s lint`
- `pnpm -s typecheck`
- `pnpm -s test`
- `node scripts/scenario-audit.mjs`
- `pnpm -s verify --change stop-on-empty-engine-diff --done`
- 手動：`.loomake/repro/run.mjs` を実行すると、`exit code 1` で、コミットが増えないことを確かめる

## 変更対象

| ファイル | 変えること |
|---|---|
| `packages/runner/src/run/decision-policy.ts` | `ChangeObservation`・`ChangeDecision`・`decideAfterChanges` を足す |
| `packages/runner/src/run/phases.ts` | `callEngine` が本文を返すようにする。`runEngineTasks` に差分の判定と `no-change` の処理を足す。`runGate` の `phases.ts:133-135` を判断に置き換える。差分を見る小さな関数を 1 つ置く |
| `packages/runner/src/run/prompt.ts` | `failure` がないときだけ、`LOOMAKE-NOCHANGE` の決まりを 1 行足す |
| `packages/runner/src/mask.ts` | 変更なし。Q-03 の決定に従い、`maskSecrets` を phases から使う |
| `packages/runner/test/run-no-change.test.ts`（新規） | 回帰試験 1〜7 |
| `packages/runner/test/decision-policy.test.ts` | REQ-332 の `it.each` を足す |
| `tests/run-decision-mutations.test.ts` | 変異 2 つを足し、名前の数と結果の期待値を増やす |
| `packages/runner/test/helpers.ts` | `export const noChange = { output: 'LOOMAKE-NOCHANGE: 検査用に変更が要らない' }` を足す。偽の claude の既定の動き（台本が尽きたら何もしない）は変えない |
| runner の試験 12 ファイル（例：`run.test.ts`・`guards.test.ts`・`external-budget.test.ts`・`pr.test.ts`） | エンジンのタスクに当たる `{}` を `noChange` に置き換える。`run.test.ts:305` の REQ-100・REQ-111 の試験のタスクを `noChange` にし、REQ-104 の試験は、タスクを `noChange` にし、直しを不合格のままのファイルを書く台本（例：`{ write: { 'fix.txt': '1' } }` と `'2'`）にする。期待値は変えない |
| `docs/guide/1.getting-started/2.usage.md` | `:282` の近くに、合図と、差分なしで止まることを 1 項目足す |
| `docs/guide/2.guides/3.run-recovery.md` | 「エンジンが変更を残さずに止まった場合」の短い節を足す（記録の場所と 2 つの対処） |
| `docs/quality/scenarios.json` | この change の Scenario のレビューを足す。台本を変えた試験を根拠にする既存のレビューは、読み直してハッシュを更新する |
| `.changeset/*.md` | `@loomake/runner`・`loomake` の minor（新しい合図を足すため） |
| `openspec/changes/stop-on-empty-engine-diff/*` | この change の proposal・specs・tasks・trace・design |

## 設計工程の記録

- 実行ツール：Claude Code 2.1.308（ask-opus.mjs 経由）、設計セッション：`c9f6a4c0-7acf-4533-a132-1b6d6fec06dc`、設計元コミット：`d5aa30d`。
- 実際の主モデル：`claude-opus-5-5`。補助呼び出しの `claude-haiku-5-5` を含む。修正後の validator で保存ログを再確認し、`manifest-revalidated.json` の `ok:true`・権限拒否 0 件を管理役が確認した。工程は実施済みとして再利用する。
- 設計成果物：`.loomake/claude/c9f6a4c0-7acf-4533-a132-1b6d6fec06dc/result-revalidated.md`。公開する根拠は [PR #157 の設計レビュー](https://github.com/loomake/loomake/pull/157#issuecomment-6512610409) と `evidence.md` に要約する。
- 設計レビューは Opus 評価 1 回として数える。残り 1 回の最終レビューは管理役が実施する。追加の AI レビューは実行しない。
- 実装担当：Codex（実際のモデル識別子は取得できず不明）。PR #159 は `bound-engine-timer-and-interrupt` で phases.ts・helpers.ts 等が重なる。別 worktree で実装し、157→158→159 の順に管理役が統合する。
