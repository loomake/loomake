# Design: bound-engine-timer-and-interrupt

## 目的と範囲

REQ-336 はエンジンの期限を Node のタイマーの上限で短縮しないこと、REQ-337 は記録開始後の git・gh の利用者による中断を interrupted、監視役の異常終了による中断を stopped と記録することである。共有予算で後続操作を拒否するときも、REQ-250 が定める理由の有無による区別を保つ。

設定の受け付ける値、公開 API、依存、準備中の終了コード 3 は変えない。supervisor.cjs の SIGHUP の扱いは PR #158 の範囲とする。約 1.8e303 分を超える設定で timeoutMinutes×60000 が Infinity になるときの文言と、コミット中断時に tasks.md の完了印が残る既存の挙動は対象外とする。

端末の Ctrl-C は監視役にも届くが、コマンドは detached の別グループにある。利用者の中断は reason を持たず、監視役が結果を書かずに終わった中断は reason を持つ。Windows では他プロセスからの SIGINT は強制終了になるため、REQ-337 の統合試験は POSIX だけで行う。

## タイマーの設計

### O1：エンジンのタイマー

| 案 | 内容 | 評価 |
|---|---|---|
| **A（おすすめ・採用）** | 監視役と同じ形にする。単調時計で期限を持ち、`min(残り, 2147483647)` ずつ待ち、発火のたびに計り直す | 原因そのものを直せる。設定の互換が保たれ、REQ-141 も変えずに済む。既存の kit 側の作りと対になる |
| B | `parseRunConfig` で `timeoutMinutes ≤ 35791` に制限し、超えたら UsageError にする | 今まで受け付けていた値を拒むので、仕様（REQ-141）を変えることになり、人の承認が要る。runClaude を直接呼んだときの丸めも残る |
| A＋B | 両方 | 上限を置く理由がなくなるので、B は要らない |

案 A のコードの形（`engine.ts` の期限の監視）：
```ts
const MAX_TIMER_MS = 2_147_483_647; // これを超えると Node は 1ms に丸める
const monotonicMs = () => Number(process.hrtime.bigint()) / 1_000_000;
const deadline = monotonicMs() + Math.max(call.timeoutMs, 0);
let timer: NodeJS.Timeout;
const watchDeadline = () => {
  const left = deadline - monotonicMs();
  if (!(left > 0)) { timedOut = true; stopping ??= stop(child); return; }
  timer = setTimeout(watchDeadline, Math.min(left, MAX_TIMER_MS));
};
timer = setTimeout(watchDeadline, Math.min(Math.max(call.timeoutMs, 0), MAX_TIMER_MS));
```
- 最初の発火は従来どおり非同期にする。`finishMonitoring` の `clearTimeout(timer)` は、そのとき有効なタイマーを解除する。
- `!(left > 0)` にしているので、NaN が来ても従来と同じくすぐ時間切れになる。

## 1. 採用する最小方針

### 1-1. 理由付き中断の区別（高 1 への対応）

**原因：** 品質コマンドの監視役が結果を書かずに終わると、`process.ts:443` で `budget.state.interrupted = true` になります。後続の `runExternal` は、`process.ts:402` で reason のない `ProcessLimitError('interrupted')` を投げます。この経路は 2 つあります。

- **経路 A（後続の品質コマンドがある場合）**
  1. lint の監視役が強制終了されると、verify は lint を `INTERRUPTED（理由）` と記録します。
  2. 続く test は、`402` で reason のない中断になり、`INTERRUPTED` と完全に一致する文で記録されます（`verify/run.ts:322`）。
  3. `phases.ts:117` がこれを中断とみなし、`:122` で `interrupted` を返します。現行のままでも、理由付きの中断が interrupted として記録されています。
- **経路 B（最後の品質コマンドだけが強制終了された場合）**
  1. `:117` は中断とみなしません。
  2. `:123` の `headState` の git が `402` で reason のない例外を投げ、`run.ts` の catch に届きます。
  3. 現行は stopped ですが、catch に判定を足すだけだと interrupted になります。

**(a) を選ぶ理由**

- (b)（runner で `rec.lastVerify` を見て補正する）では、経路 A が `:122` で interrupted を返して終わり、catch まで届きません。`:117` の判定も変える必要があります。
- (b) は verify を通る経路しか見られません。証拠の記録（runRecord）の中の git など、ほかの後続操作の拒否も補えません。
- 区別の元は kit の共有予算の状態です。`:443` と `:402` の 2 行を直せば、すべての後続操作の拒否が reason を持ちます。runner 側は「`kind==='interrupted' && reason===undefined` だけを interrupted にする」判定のままで済みます。
- REQ-250 は「利用者の中断とは理由の有無で区別する SHALL」と定めています。後続の拒否で理由が消えるのは、この区別を崩している状態です。REQ-250 の文は変えず（MODIFIED にせず）、その意図どおりの実装に揃えるという位置づけにします。

**kit の差分（`packages/kit/src/runtime/process.ts`。#159 だけが変更する範囲）**

```ts
type Budget = { deadline: number; maxOperationMs: number; state: { interrupted: boolean; reason?: string } };
// withProcessBudget の初期値 { interrupted: false } はそのまま（reason は未設定）
if (budget?.state.interrupted) throw new ProcessLimitError('interrupted', command, '', '', budget.state.reason);   // 402
...
const error = missingResultError(command, stdout, stderr, ended, report.invalid, cleanup);
if (budget) { budget.state.interrupted = true; budget.state.reason = error.reason; }                             // 443 付近
throw error;
```

- 443 行は、`stopTree` のあとに作った error の reason を入れる順に並べ替えます。後片付けの結果を含む reason を引き継ぐためです。`state.interrupted` と reason は、`stopTree` の結果を含む error を作ったあとに記録します。`stopTree` が想定外の例外を投げた場合は、その例外を外へ投げ直す既存の経路となり、この記録までは進みません。
- 利用者の信号による中断（`:451`）では reason を入れません。そのため後続の拒否も、従来どおり reason を持ちません。
- 引き継いだ文は変えずにそのまま使います。拒否された側のコマンド名は、従来どおりメッセージの先頭に入ります。
- 中断（kind は interrupted）として返すことは変えません。`cleanup` は元の操作の記録なので引き継ぎません。

**runner の差分**

- `phases.ts` に次を export します。

  ```ts
  export const interruptedOperation = (e: unknown) => e instanceof ProcessLimitError && e.kind === 'interrupted' && e.reason === undefined;
  ```

- 状態だけをこの判定で選ぶのは次の 2 か所です。理由の文は変えません。
  - `run.ts:75`
  - `phases.ts:191`（push と、gh の PR の検索・作成の catch）
- `ghLoggedIn`（`gh auth status`）の中断は try の外なので、`run.ts` の catch で同じ判定を受けます。

**目に見える影響：** 先に理由付きの中断があった場合、後続の品質コマンドの detail が `INTERRUPTED` から `INTERRUPTED（理由）` に変わります。その結果、run の状態は stopped になります（経路 A は、いまは interrupted）。これは承認済みの Q-02（理由がないものだけ interrupted）と REQ-250 の範囲内の帰結です。新たに質問はせず、仮定 A-07 として明記します。

### 1-2. 変更前の設計の誤りの訂正

- 旧設計で「品質コマンドの理由付きの中断のあと、直しへ進む経路」を対象外とした判断を訂正します。run は必ず共有予算の中で動くので、`:123` の git が必ず拒まれ、直しへは進みません。1-1 の修正で、この経路も stopped に揃います。Issue に回す必要はありません。
- 旧設計で #158 が process.ts を変えるとした記述を訂正します。#158 が変えるのは `supervisor.cjs` だけで、`process.ts` は変えません。`process.ts` は #159 だけが変える範囲とします。
  - #158 の SIGHUP は `stop('interrupted')` を通り、reason を持ちません。そのため、PR #158はmain ac87014から統合済みであり、SIGHUPも同じ判定でinterruptedに写ります。Q-05の取り決めは変わりません。

### 1-3. タイマー（REQ-336）は変えない

本書の「O1：エンジンのタイマー」節の採用案 A を維持します。

- 待機は `min(残り, 2147483647)` に分け、発火のたびに単調時計で計り直します。
- `!(left > 0)` で判定するので、NaN・0・負の値はすぐ時間切れになります（現行と同じ）。
- 最初の待機は従来どおり非同期で始めます。
- `timer` は `let` にし、`finishMonitoring` の `clearTimeout(timer)` が、その時点で有効なタイマーを解除します。

## 2. 変更対象

| ファイル | 変えること | 重なり |
|---|---|---|
| `packages/kit/src/runtime/process.ts` | `state.reason` を足す。402 行の拒否と 443 行付近の記録（1-1） | #159 だけが変える |
| `packages/kit/test/process.test.ts` | 1-1 の kit の試験（AC-11） | なし |
| `packages/runner/src/engine.ts` | 本書「O1：エンジンのタイマー」節の採用案 A に従い、タイマーを分けて待つ形にする | なし |
| `packages/runner/src/run/phases.ts` | `interruptedOperation` を export し、191 行の catch で使う。`ProcessLimitError` を `@loomake/kit` から import する | #157（`callEngine` と noChange）。互いに離れた行で、意味の上では衝突しない |
| `packages/runner/src/run.ts` | 75 行の状態の選び方 | なし |
| `packages/runner/test/helpers.ts` | 監視役へ信号を送るスクリプトを、信号を引数に取る形で、ファイルの**末尾**に export する。結果の JSON はスクリプトと同じ場所（`repo.base`）に書き、作業ツリーを汚さない | #157 も helpers を変えるので、末尾に足して衝突を減らす |
| `packages/runner/test/external-budget.test.ts` | 上のスクリプトを helpers から使う。期待値は変えない | なし |
| `packages/runner/test/engine-long-deadline.test.ts`（新規） | AC-1〜3 | なし |
| `packages/runner/test/signal-during-sync.test.ts` | AC-4〜9（POSIX だけ） | なし |
| `docs/guide/2.guides/3.run-recovery.md` | 節「端末を閉じたときとコンテナを止めたとき」の末尾に 1 文 | #158と同じ節。main ac87014との統合で両方の説明を保持する |
| `docs/quality/scenarios.json` と `.changeset/*.md` | Scenario のレビューを足す。changeset は `@loomake/kit`・`@loomake/runner`・`loomake` の patch | なし |

`supervisor.cjs` と `config.ts` は変えません。

## 3. 受入条件と試験

試験名には要件 ID を入れます。REQ-337 の統合試験は `it.runIf(process.platform !== 'win32')` とします（A-03）。

**信号の送り方**

- helpers のスクリプトを `repo.base` に置きます。
- git のフック（`.git/hooks/pre-commit` と `pre-push`。`makeRepo` のあとに置く）か、偽の gh の入口から、`node <script> <SIG>` を同期で呼びます。
- スクリプトは祖先をたどって監視役を探し、指定の信号を送ってから、止められるまで待ちます。
- **偽の gh の入口：** `bin/gh` を、対象のサブコマンド（`pr list` か `pr create`）のときだけスクリプトを実行し、それ以外は元の偽の gh（`gh-original`）へ渡す形に差し替えます。`fakeCli` が元のファイルを写すのと同じ方法です。

| ID | 受入条件 | 試験（修正前 → 修正後） |
|---|---|---|
| AC-1 | タイマー上限超えでも時間内の結果を保つ | `runClaude` に2147483647ms＋60000msを渡し300msで終わる偽エンジンを呼ぶ。timedOut:false・終了コード0・出力「完了」と、TimeoutOverflowWarningなしを確認する。タイマー修正前は失敗する |
| AC-2 | 分割待機の早い発火と、最後に有効な待機の解除 | 最初の2回の長い待機を早く発火させ、3回待ち直すこと、各待機が上限以下で結果を保つことを確認する。返った時点で最後のhandleがclearTimeoutへ渡されたことも検査する。最初のhandleだけを解除する変異が失敗することを確認する |
| AC-3 | timeoutMinutes 40000のrun | 偽エンジンが500msで実装を書き、通常runがcompleted・終了コード0となり、タスクのコミットが残り、実行時間の上限の表示がないことを確認する。タイマー修正前は失敗する |
| AC-4 | タスクのコミットの git のあいだに、監視役が **SIGINT・SIGTERM** を受けたら interrupted | `it.each(['SIGINT','SIGTERM'])` `[REQ-337] タスクのコミットのgitのあいだに監視役が%sを受けたら、interruptedにする`。pre-commit から送る。状態は `interrupted`、`doneTasks: []`、`remainingTasks[0]` は 1.1、エンジンの呼び出しは 1 回、PR は 0 件、終了コード 1。修正前は stopped で失敗する |
| AC-5 | 証拠の push のあいだの中断 | pre-push から SIGINT を送る。状態は `interrupted`、reason に「証拠のコミットを保っています」、HEAD は `evidence(c1):`、`ls-remote` は空、PR は 0 件、終了コード 1。修正前は失敗する |
| AC-6 | **gh の PR の検索・作成**のあいだの中断 | `it.each([['list','SIGINT'],['create','SIGTERM']])` `[REQ-337] PRの%sのあいだに監視役が%sを受けたら、証拠とpushを保ちinterruptedにする`。偽の gh の入口から送る。状態は `interrupted`、HEAD は `evidence(c1):`、`ls-remote` にブランチがある、PR は 0 件（作成の記録がない）、終了コード 1。修正前は失敗する |
| AC-7 | タスクのコミット中の監視役の強制終了は stopped | pre-commit から SIGKILL を送る。状態は `stopped`、reason に「監視役が結果を書かずに終了しました」。修正の前後とも成功する（写し方を広げすぎていないかの見張り） |
| AC-8 | **品質コマンドの監視役が強制終了されたあとの git**（経路 A） | `commands: { lint: 'node <script> SIGKILL', test: 'node write-report.mjs' }`。状態は `stopped`、reason に「監視役が結果を書かずに終了しました」、エンジンの呼び出しは 1 回（直しなし）、push・PR はなし、終了コード 1。保存した verify の JSON の test の detail に `中断されたので止めました（監視役が結果を書かずに`。**修正前は `:122` で interrupted になり失敗する** |
| AC-9 | 同じく、最後の品質コマンドの場合（経路 B） | `commands: { test: 'node <script> SIGKILL' }`。AC-8 と同じ期待値。修正前は status が stopped のままだが、reason が失われるため失敗する。runner の写し方だけを入れると status も interrupted になり、kit を直すと成功する |
| AC-10 | 既存の試験が変わらず通る | `engine-safety`・`engine-normal-exit`、`run.test` の REQ-105・REQ-124・REQ-137・REQ-182、`signal-during-sync` の REQ-208 の 3 件、`external-budget` の REQ-183・REQ-250、kit の `process.test`・`orphans.test`・`process-long-deadline.test` |
| AC-11 | kit：後続の拒否は最初の reason を引き継ぎ、利用者の中断では reason を持たない | (1) 既存の `[REQ-181][REQ-250]`（`process.test.ts:105`）の 124 行の後続の呼び出しに、`kind:'interrupted'` と `reason` が「監視役が結果を書かずに終了しました」を含むことを**足す**（既存の期待値は残す）。修正前は失敗する。(2) 新規 `[REQ-250][REQ-337] 利用者の中断のあとの後続の拒否はreasonを持たない`（POSIX）。同じ予算で監視役に SIGINT を送ったあと、次の呼び出しが `reason === undefined` であること。修正の前後とも成功する |

修正前に失敗する試験は、入れたコミットで実装前に実行し、結果を PR に記録します。


## 記録と確認事項

Q-01〜06 の既存の回答を維持する。Q-07 の案 (a) は、REQ-250・REQ-337 と承認済み Q-02 の実現に必要な技術方針として Opus が採用した。新たな人の個別承認とは記録しない。A-01〜07 は ADR 0006 に基づき管理役が理由を確認して承認し、trace.md に記録した。

1 つの change・PR とする既存 Q-03 と、各タスクを小さくコミットする今回の管理役の指示に従う。修正版の細分タスクでは 10 commit を超えるため、その理由を PR の引き継ぎに残す。

## 付録：再現の要点

runClaude に timeoutMs: 2_147_483_648 を渡し、300ms で終わる偽の claude を使うと、Node のタイマーが 1ms に丸められ、約 250ms の停止猶予後に timedOut:true となり、TimeoutOverflowWarning が出る。コミットする AC-1 のテストを再現手順とし、gitignore 対象の再現スクリプトを前提にしない。

## 設計工程の記録

- 実行ツール：Claude Code 2.1.308、共通原則の版 1。
- 旧設計：session 380d4efd-8a0c-4224-b255-3283edbb838a、対象 d5aa30d。実際の本体は claude-opus-5-5、補助は claude-haiku-5-5。旧 validator は補助を含むため ok:false と判定した。
- 旧ログの再確認：修正後 validator（c4dd0d3）で、本体と補助を区別し、読取専用・MCP なし・権限拒否 0 を確認して ok:true。成果物は同セッションの result-revalidated.md / manifest-revalidated.json。元の ok:false を上書きせず、設計を再利用する。
- 修正版設計：session fdfe3430-6d70-445a-8c6b-404fbc53ac62、対象 12286031518849a04248dbfdbd91d9582a514a9f。本体 claude-opus-5-5、補助なし、Read/Glob/Grep のみ、MCP なし、権限拒否 0、ok:true（実施済み）。管理役から .loomake/handoff/redesign.md と redesign-summary.json で引き継いだ。
- Codex 実装：実行ツール Codex、実際のモデル識別子は取得できず不明。
- 既存の Opus 設計レビュー 1 回は履歴として保持する。2026-10-30 の最新の利用者指示に従い、最終レビューは設計・実装と別の新しいセッションで、回数上限なく新しい head の指摘ゼロまで繰り返す。同じ指摘が 3 回連続したら Issue へ記録し、修正・検証・レビューは続ける。

補助モデルの選択肢 A は利用者の今回の明示依頼を出典とする。[PR #160](https://github.com/loomake/loomake/pull/160) に承認記録の要約があるが、人の承認投稿そのものの URL は不明である。Q-01〜06 の元の回答を維持し、存在しない承認元 URL は補わない。Q-06 の追跡先は [Issue #161](https://github.com/loomake/loomake/issues/161) とする。
