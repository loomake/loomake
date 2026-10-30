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

`LOOMAKE-QUESTION:` と同じく、行頭の合図にする（`/^LOOMAKE-NOCHANGE:[^\S\r\n\u2028\u2029]*(\S.*)$/m`）。

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

**当初の前提（調査開始時の記録）**
- 当初の対象は HEAD `d5aa30d`。以下の並行changeの記録は、その時点の状態です。
  - `align-template-worklog`：テンプレート
  - `close-docs-only-gaps`：CI の文書判定
  - `gate-base-remote-ref`：CI の gate
  - `move-verification-policy-to-kit`：core と kit の判定
  - `record-ci-test-diagnostics`：CI の診断
- 当初の要件 ID は REQ-330〜332です。その後、表示と記録をREQ-339に分けて追加しました。

**当初の確認事項（回答済み）**

| ID | 内容 | ブロッキング |
|---|---|---|
| Q-01 | 変更不要のタスクを、合図で認めるか | **yes**（外部の振る舞いが変わる） |
| Q-02 | 直しで差分がなければ、すぐ止めるか | **yes**（外部の振る舞いが変わる） |
| Q-03 | 合図の理由を、どこに残すか | no |

詳しくは trace.md の確認事項に書きます（Q-01〜Q-03 は 2026-10-30 におすすめ案で回答済み）。

## 修正前の観測事実と原因（d5aa30d）

1. **タスクの段階**（`packages/runner/src/run/phases.ts`）
   - `callEngine` は、エンジンの終わり方だけで止まるかを決めます。終了コード 0 で質問もなければ `undefined` を返します（`phases.ts`、`decision-policy.ts`）。
   - そのあと `guard(ctx)`（`phases.ts`）、`checkTask`（`phases.ts`）、`git add -A`（`phases.ts`）、`git commit`（`phases.ts`）が、差分の有無を見ずに続きます。
   - このため、エンジンが何も変えなくても、tasks.md だけを含む `run(<id>): 1.1 …` のコミットができます。
2. **ガードの入力**（`packages/runner/src/guards.ts`）
   - `findViolations` は最初に `git add -A` を実行し、index に載せた差分を調べます。
   - つまり `guard()` から戻った直後の index は、エンジンの変更だけを持っています。run 自身のチェックは、まだ付いていません。
   - エンジンが tasks.md を書き換えた場合は、ガードが「change の文書を変えました」として先に止めます（`guards.ts`）。
3. **直しの段階**（`phases.ts`）
   - 差分がないときはコミットを飛ばしますが、止まらずにループの先頭へ戻ります。
   - 差分がないので完了ゲートは同じ結果で不合格になり、`decideAfterGate` の上限（`decision-policy.ts`）まで、エンジンと verify を繰り返します。
4. **既存の合図**
   - 質問の合図は `decideAfterEngine` が行頭の `^LOOMAKE-QUESTION:\s*(.*)$/m` で読みます（`decision-policy.ts`）。
   - 指示の決まりは `prompt.ts` にあります。
   - 停止の状態は `RunSummary.status` の `'completed' | 'stopped' | 'interrupted'` です（`run/types.ts`）。理由は自由な文で、種別を表す欄はありません。
5. **再現**
   - `.loomake/repro/bin/claude` は、入力を読み捨てて、何もせずに result（`I could not make changes because the Bash tool was not permitted.`）を返す偽のエンジンです。
   - `.loomake/repro/run.mjs` はこれを使って `runRun` を呼びます。
6. **既存の試験も、差分なしの完了に頼っています**
   - `packages/runner/test/run.test.ts` の `passing = [{ write: { 'impl.txt': … } }, {}]` は、1.2 で何も変えないエンジンを完了として扱います。
   - `packages/runner/test/helpers.ts` の偽の claude は、台本が尽きると何もしません。
   - `{}` を使う台本は、`run.test.ts`・`guards.test.ts`・`external-budget.test.ts`・`pr.test.ts`などにありました。変更対象表にある既存試験では、意味と期待値を保って台本を置き換えます。
   - 修正すると、これらは仕様どおりに止まって失敗するので、台本の置き換えが必要です。

**原因：** run の段階の流れに「エンジンの変更がない」ことを判断する分岐がありません。終了コード 0 を「タスクを終えた」と同じに扱っています。

## 修正方針の比較

### 3.1 変更不要のタスクを認めるか（Q-01）

| 案 | 内容 | 利点 | 欠点 |
|---|---|---|---|
| **A（おすすめ）** | 差分がなく、出力の行頭に `LOOMAKE-NOCHANGE: <理由>` があれば完了にする。なければ止まる | 確認だけのタスクや、前のタスクで済んだタスクを、無人の run のまま進められる。`LOOMAKE-QUESTION:` と同じ形で、エンジンへの決まりと読み取りがそろう。既存の試験は台本の置き換えで済む | 誤った合図をエンジンが出す余地が残る。理由をレビューで見られるようにする必要がある（Q-03） |
| B | 差分がなければ常に止まる | 判断が最も単純 | 変更不要のタスクのたびに、人が tasks.md を完了にしてコミットする必要がある。既存の試験の台本は、ダミーのファイルを書く形に変えることになる |

### 3.2 合図の扱い（A を採る場合）

- **正規表現：** `/^LOOMAKE-NOCHANGE:[^\S\r\n\u2028\u2029]*(\S.*)$/m`。行頭だけを認め、理由が空なら合図とみなしません。合図が複数あれば最初を使います。
- **質問との優先順位：** `decideAfterEngine` が先に動くので、質問の合図が優先されます。既存の規則は変えません。
- **差分と合図が両方ある場合：** 合図は無視して、ふつうにコミットします（仮定 A-02）。
- **直しの段階：** 合図は意味を持たないので、差分がなければ止まります（Q-02）。直しの指示には、この決まりを含めません。

### 3.3 差分の判定方法

| 案 | 内容 |
|---|---|
| **a（おすすめ）** | `guard()` の直後、`checkTask` の前に `git diff --cached --name-only` を見る。ガードと同じ index を入力にするので、ガードの入力と同じ差分になる。run 自身のチェックはまだ付いていないので、「tasks.md のチェックだけの差分」は構造上、差分なしと数えられ、除外する処理が要らない。`runGate`の差分判定と同じ入力を使える |
| b | `checkTask` と `git add -A` のあとに見て、tasksRel を除外する。除外する処理が増えるうえ、エンジンが tasks.md を変えた場合と区別しにくい |

### 3.4 止まるときの扱い

- 状態は `stopped`、終了コードは 1 で、既存の REQ-107 と同じです。新しい状態の種別は足しません。
- 理由の文：
  - タスク：`エンジンが変更を残さずに終わりました。出力の記録：<パス>。権限や環境を見直して実行し直すか、変更が要らないなら人が tasks.md のこのタスクを完了にしてコミットしてから実行し直してください。`
  - 直し：`直しでエンジンが変更を残さずに終わりました。出力の記録：<パス>。権限や環境を見直してから実行し直してください。`
- 残ったタスク：
  - タスクの段階：止まったタスクから後ろ（`remaining`）
  - 直しの段階：`gateTasks`
- タスク段階の標準出力には、エンジンの出力の記録の場所（`.loomake/runs/<run>/NN-output.json`）と、次の 2 つの対処を表示します。直しの段階は、同じ記録の場所と権限や環境を見直して再実行する対処を示します。
  1. 権限や環境を見直して、もう一度実行する
  2. 変更が要らないなら、tasks.md のそのタスクを完了にして自分でコミットしてから、もう一度実行する

### 3.5 判断の置き場所

`decision-policy.ts` に、I/O を持たない `decideAfterChanges` を足します（REQ-332）。`decideAfterEngine` には手を入れません。

```ts
export type ChangeObservation = Readonly<{ phase: 'task' | 'repair'; hasChanges: boolean; text: string }>;
export type ChangeDecision = { kind: 'commit' | 'stop' } | { kind: 'no-change'; reason: string };

/** エンジンの変更がない場合の完了と停止を判断する（REQ-332）。 */
export function decideAfterChanges(value: ChangeObservation): ChangeDecision {
  if (value.hasChanges) return { kind: 'commit' };
  if (value.phase === 'repair') return { kind: 'stop' };
  const signal = value.text.match(/^LOOMAKE-NOCHANGE:[^\S\r\n\u2028\u2029]*(\S.*)$/m);
  return signal ? { kind: 'no-change', reason: signal[1] } : { kind: 'stop' };
}
```

### 3.6 phases.ts の変更

- **`callEngine`：** 続行のときは `{ kind: 'continue', text }`、停止のときは `{ kind: 'stop', status, reason }` を返します。
- **`runEngineTasks`：** `guard` のあとに `decideAfterChanges({ phase: 'task', hasChanges, text })` を呼びます。
  - `stop`：止まる。index は空なので、戻す処理は要りません。
  - `no-change`：標準出力に「変更不要としてタスクを完了にします：<可視化した理由>」と出し、これまでどおり `checkTask`・`add`・`commit` をします。
  - Q-03 の決定に従い、理由を `maskSecrets` で置換し、REQ-339のC0/C1可視化を行った同じ文字列を標準出力とgit commit本文へ渡します。変更不要のコミットだけに `--cleanup=verbatim` を指定します。
- **`runGate`：** ガードのあとに `decideAfterChanges({ phase: 'repair', hasChanges, text })` を呼びます。`stop` なら出力記録の具体パスを含む理由で `stopped(reason)` を返します。
- **`prompt.ts`：** `failure` がないとき（タスクの指示）だけ、次の決まりを 1 行足します。
  > - 変更が要らないときは何も変えず、`LOOMAKE-NOCHANGE:` で始まる行に理由を書いて終える。変更もこの行もなければ loomake run は止まる

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

以下は当初の検証観点の要約で、コード上の試験名の全文引用ではありません。新しい振る舞いは修正前の失敗と修正後の成功を確認し、既存の振る舞いを守るケースは修正前から成功することを確認します。`packages/runner/test/run-no-change.test.ts` に置き、`run.test.ts` の `withRepo`・`run` と同じ書き方にします。

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
   - 次の17行を確かめます。全ケースで入力をfreezeし、同じ判断を繰り返して入力が変わらないことも確認します。
     - タスクで変更あり → commit
     - 直しで変更あり → commit
     - 変更なし・合図なし → stop
     - 合図と理由あり → no-change
     - 行頭でない合図 → stop
     - 空の理由 → stop
     - 最初の合図 → no-change
     - 直しでは合図があっても停止 → stop
     - 全角空白の区切り → no-change
     - NBSPの区切り → no-change
     - 同じ行の空白が混ざる区切り → no-change
     - 同じ行の空白だけの理由 → stop
     - LFを越えた理由 → stop
     - CRLFを越えた理由 → stop
     - U+2028を越えた理由 → stop
     - U+2029を越えた理由 → stop
     - freezeした入力を変更しない → no-change

### 突然変異試験（`tests/run-decision-mutations.test.ts`）

次の 2 つの変異を足します。

| 変異 | 変える前 | 変えた後 |
|---|---|---|
| `{ id: 'repair-no-change' }` | `if (value.phase === 'repair')` | `if (value.phase === 'repair' && !value.text)` |
| `{ id: 'no-change-anchor' }` | `/^LOOMAKE-NOCHANGE:` | `/LOOMAKE-NOCHANGE:` |

- 試験の名前の数は、既存27行と追加17行を合わせた44行です。
- 結果の期待値は `['killed' × 5]` にします（仮定 A-04）。

### 確認コマンド

Scenario監査の保存先には、まだ存在しないパスを指定します。change外の未確認と対象changeの状態を分けて読みます。

- `pnpm -s vitest run packages/runner`
- `pnpm -s lint`
- `pnpm -s typecheck`
- `pnpm -s test`
- `node scripts/scenario-audit.mjs .loomake/scenario-audit-check-01`
- `pnpm -s verify --change stop-on-empty-engine-diff --done`
- 元の再現台本の実測結果は `evidence.md` と作業記録に残します。新しいcheckoutでは、追跡対象の `run-no-change.test.ts` の合図なしの試験で終了コード1・未完了・コミット不変を確認できます。

## 変更対象

| ファイル | 変えること |
|---|---|
| `packages/runner/src/run/decision-policy.ts` | `ChangeObservation`・`ChangeDecision`・`decideAfterChanges` を足す |
| `packages/runner/src/run/phases.ts` | `callEngine` が本文を返すようにする。`runEngineTasks` に差分の判定と `no-change` の処理を足す。`runGate` の修正後の差分判定を純粋関数の判断に置き換える。差分を見る小さな関数を 1 つ置く |
| `packages/runner/src/run/prompt.ts` | `failure` がないときだけ、`LOOMAKE-NOCHANGE` の決まりを 1 行足す |
| `packages/runner/src/mask.ts` | 変更なし。Q-03 の決定に従い、`maskSecrets` を phases から使う |
| `packages/runner/test/run-no-change.test.ts`（新規） | タスク・直し・Unicode区切り・制御文字・末尾保持の回帰 |
| `packages/runner/test/decision-policy.test.ts` | REQ-332 の `it.each` を足す |
| `tests/run-decision-mutations.test.ts` | 変異 2 つを足し、名前の数と結果の期待値を増やす |
| `packages/runner/test/helpers.ts` | `export const noChange = { output: 'LOOMAKE-NOCHANGE: 検査用に変更が要らない' }` を足す。偽の claude の既定の動き（台本が尽きたら何もしない）は変えない |
| runner の既存試験（例：`run.test.ts`・`guards.test.ts`・`external-budget.test.ts`・`pr.test.ts`） | エンジンのタスクに当たる `{}` を `noChange` に置き換える。`run.test.ts` の REQ-100・REQ-111 の試験はタスクを `noChange` にする。REQ-104 と、残ったタスクの印を確かめる REQ-100 の試験は、タスクを `noChange` にし、直しで不合格のままの `fix.txt` を書く台本にする。期待値は変えない |
| `docs/guide/1.getting-started/2.usage.md` | runの使い方に、合図と差分なしで止まることを1項目追加する |
| `docs/guide/2.guides/3.run-recovery.md` | 「エンジンが変更を残さずに止まった場合」の短い節を足す（記録の場所と 2 つの対処） |
| `docs/quality/scenarios.json` | この change の Scenario のレビューを足す。台本を変えた試験を根拠にする既存のレビューは、読み直してハッシュを更新する |
| `.changeset/*.md` | `@loomake/runner`・`loomake` の minor（新しい合図を足すため） |
| `openspec/changes/stop-on-empty-engine-diff/*` | この change の proposal・specs・tasks・trace・design |

## 当初の設計工程と引き継ぎの記録

- 実行ツール：Claude Code 2.1.308（ask-opus.mjs 経由）、設計セッション：`c9f6a4c0-7acf-4533-a132-1b6d6fec06dc`、設計元コミット：`d5aa30d`。
- 実際の主モデル：`claude-opus-5-5`。補助呼び出しの `claude-haiku-5-5` を含む。修正後の validator で保存ログを再確認し、`manifest-revalidated.json` の `ok:true`・権限拒否 0 件を管理役が確認した。工程は実施済みとして再利用する。
- 設計成果物：`.loomake/claude/c9f6a4c0-7acf-4533-a132-1b6d6fec06dc/result-revalidated.md`。公開する根拠は [PR #157 の設計レビュー](https://github.com/loomake/loomake/pull/157#issuecomment-6512610409) と `evidence.md` に要約する。
- 当初の設計レビューは Opus 評価 1 回として数えた。修正前 head の最終レビューを 2 回目として実施した。その後の回数と工程は、末尾の利用者の新しい指示に従う。
- 実装担当：Codex（実際のモデル識別子は取得できず不明）。PR #159 は `bound-engine-timer-and-interrupt` で phases.ts・helpers.ts 等が重なる。当初は別worktreeで実装して157→158→159の順に統合する計画だった。現在は条件の揃ったPRから管理役が取り込み、後続がmainへ追従する。PR #158は取り込み済み。

## 最終レビュー後の修正方針

2026-10-30 の管理役の確認で、REQ-330・REQ-332 の「空でない理由」に対し、修正前の ASCII 空白・タブだけの正規表現では同一行の全角空白や NBSP に続く理由を認めないと分かった。仕様を ASCII 限定へ狭めず、同一行の空白を区切りとして認めるよう判定を修正する。LF・CR・U+2028・U+2029 を越えて、別行の文字を理由に取り込まない。既存の期待値は維持し、要件 ID 付きの直接試験と統合試験を追加する。この時点では Opus 評価 2/2 の履歴を保持し、修正後 head の最終レビューを追加 1 回の明示承認待ちとして記録した。その後の回数上限の撤廃は末尾に記録する。

理由の末尾の空白は、仕様が除去を要求していないため判定関数では保持する。変更不要のコミットだけに `--cleanup=verbatim` を渡し、Gitの既定の整形で末尾ASCII空白を削らせない。通常・直し・evidenceのコミットの整形は変えない。例のコードを現行の型・戻り値・表示文言へ合わせた。

## 最終レビュー後の表示の設計

Opus が、利用者の具体的な対象資料の送信承認の範囲で、表示の 2 点を読取専用で設計した。直しの停止理由には、タスク段階と同じ式で既存の `NN-output.json` の具体パスを含める。NoChange 理由は `maskSecrets` のあとに C0/C1 制御文字を小文字 16 進 4 桁の可視化文字列へ変え、標準出力と git commit 本文で同じ文字列を使う。監査 JSON は既存の秘密情報置換だけを行い、制御文字の原文を保つ。変更箇所は phases.ts の 2 か所に限り、新しい API・依存・共通関数は足さない。既存の質問や他コマンドの表示には広げない。

追加回帰は、合図の有無ごとの直しの具体パス、C0/C1 の可視化と秘密情報置換・監査原文維持、NUL を含む理由でも tasks.md だけのコミットで完了することを確かめる。既存の `it` と `expect` を変えず、4 件の試験を追加する。

旧 head の Opus 評価 2 回の履歴は保持する。その後の利用者の明示指示でレビュー回数の上限は撤廃され、修正後の head に指摘ゼロが出るまで独立した新規セッションで最終レビューする。上記の追加 1 回の承認待ちは、この新しい指示で解消した。送信範囲は利用者が明示承認した対象資料に限定する。

理由の表示と記録は、OpenSpecの500文字制限を保つため、管理役が予約したREQ-339として独立したRequirementに記録する。追加の機能ではなく、上記の設計と同じ振る舞いを分けて表した。対応する新規回帰にはREQ-330とREQ-339を併記する。

## 理由の末尾を実際のコミット本文にも保つ

実Gitの比較で、既定の整形は末尾ASCII空白を削り、verbatimなら保持することを確認した。REQ-339の本文は変えず、NoChangeの理由を第2段落へ足す分岐だけに `--cleanup=verbatim` を加える。通常のタスク・直し・完了ゲート・evidenceのコミットは変えない。

実Gitの追加回帰は、stdoutとcommit本文の理由の行を完全一致で比べる。repo.gitのtrimで末尾を失わないよう、`%B%x00` のNUL終端より前を読む。ASCII空白1個・3個・NBSP後のASCII空白、NBSP・全角・en-space・可視化タブを確かめる。engineはJSONのresultをtrimしないことをCodexがローカルで確認したため、出力末尾の理由を検証し、補足行が続く場合も確認する。旧回数の履歴は保持し、新headの独立最終レビューを指摘ゼロまで続ける。
