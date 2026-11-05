# evidence-only-reuse の採用設計

出典: Issue #458、設計 4851fde6 §1〜7、安全性補足 a20fc407 §2〜5。管理役が 2026-11-06 JST に ADR 0006 の包括承認に従い採用した。個別の人による設計承認を意味しない。

## 1. 目的・範囲・前提（確定）

| 区分 | 内容 |
|---|---|
| 目的 | A17 の利用者向け入口 `loomake trace reuse` と `runReuse` を完成させる。<br>・実 Git の範囲が許可された証跡だけなら、品質コマンドを 0 回にする<br>・混在や環境の違いがあれば、同じ入口の中で実際に再検証する<br>・一次要約の改変は人へ差し戻す |
| 範囲 | ・kit：Git の範囲と blob を読む部品（新規 1 ファイル）<br>・trace：照合・分岐・再利用の記録（新規 2 ファイル）と、record の内部の小さな分離<br>・CLI：`reuse` 操作の追加<br>・差分仕様：ADDED 4 件と MODIFIED 1 件（REQ-323）<br>・CLI 基準の差分、生成ページ、公開型の利用側 fixture<br>・利用者向けの説明、changeset（patch）、worklog |
| 対象外 | 依頼のとおり、次は変えない。<br>・runner、`runVerify` の既定、skip の不足、必須 CI・done・独立レビュー、設定<br>・#69/#70 の完成扱い、anchor の真正性と実際の取得、release<br>・既存の 13 個の JSON Schema、core |
| 前提 | ・通常の L3 change `evidence-only-reuse`<br>・ADR 0002 により、非破壊の追加なので kit・trace・loomake はいずれも patch<br>・ID は 473〜476 を使い、467/468 は使わない |

---

## 2. 問い 1：層の境界と公開型（確定）

**kit は Git の事実と、メタデータだけによる分類までを担います。本文の検証は trace が行います。callback は採用しません。**

callback を採用しない理由は次のとおりです。

- kit から trace の validator を呼ぶ形（`evidenceProblem`・`summaryProblem`）は REQ-207 に反します。
- callback を使うと、1 回だけ呼ぶことの保証、例外の分類、予算の受け渡しという契約が増えます。
- blob の読取りは、`createInputReader` と同じ「共有予算を持つ reader」の形で kit が提供します。trace は 1 件ずつ読んで検証し、読んだものは保持せずに捨てます。

### kit：新規 `packages/kit/src/verify/trusted/evidence-range.ts`

import するのは `../../runtime/{process,input,errors}.js`、`../config.js`（`CHANGE_ID`）、`./canonical.js` だけです。REQ-207 に適合します。

```ts
export type EvidenceRangeEntry = { readonly commit: string; readonly path: string; readonly oid: string; readonly kind: 'evidence' | 'reuse' };
export type EvidenceRangeReasonCode =
  | 'SHALLOW_REPOSITORY' | 'SOURCE_UNAVAILABLE' | 'EMPTY_RANGE' | 'SOURCE_NOT_ANCESTOR'
  | 'RANGE_TOO_LARGE' | 'MERGE_IN_RANGE' | 'ENTRY_NOT_ADDED' | 'ENTRY_MODE'
  | 'ENTRY_PATH_NOT_ALLOWED' | 'GIT_RANGE_UNREADABLE';
export type EvidenceRangeReason = { readonly code: EvidenceRangeReasonCode; readonly message: string; readonly commit?: string; readonly path?: string };
export type EvidenceRangeOptions = { repository: string; source: string; target: string; changeId: string };
export type EvidenceRange =
  | { readonly allowed: true; readonly source: string; readonly target: string; readonly commits: readonly string[]; readonly entries: readonly EvidenceRangeEntry[] }
  | { readonly allowed: false; readonly source: string; readonly target: string; readonly reasons: readonly EvidenceRangeReason[] };
/** 同期。データ由来の不可は allowed:false。引数の誤りと git を起動できないときは UsageError、期限・中断は ProcessLimitError(RuntimeFailure) */
export function readEvidenceRange(options: EvidenceRangeOptions): EvidenceRange;

export type GitTreeLookup = { readonly kind: 'found'; readonly mode: string; readonly type: string; readonly oid: string } | { readonly kind: 'absent' } | { readonly kind: 'unreadable' };
export type GitBlobText = { readonly ok: true; readonly text: string; readonly bytes: number } | { readonly ok: false; readonly code: 'BLOB_UNREADABLE' | 'BLOB_TOO_LARGE' | 'BLOB_NOT_UTF8' };
export type GitEvidenceReader = { treeEntry(commit: string, path: string): GitTreeLookup; readText(oid: string): GitBlobText };
/** 呼出しごとに読んだ bytes を同じ合計に数える。同じ oid を重ねて呼ばないのは呼出側の責務 */
export function createGitEvidenceReader(repository: string, limits?: Readonly<InputLimits> /* 既定 JSON_LIMITS */): GitEvidenceReader;
```

- 純粋な分類 `classifyEvidenceRange` は内部関数とし、**公開しません**。kit の試験は src から直接 import します。
- `packages/kit/src/index.ts` に追加するのは、上の関数 2 つと型 9 つだけです。

### trace：新規 `reuse-record.ts` と `reuse.ts`

```ts
export const REUSE_RECORD_VERSION = 1;
export type ReuseRecord = {
  reuseVersion: 1; change: string; verification: 'integrity-only'; qualityCommands: 'not-run';
  source: { sha: string; summary: { path: string; oid: string; sha256: string; runId: string; runAttempt: string } };
  target: { sha: string };
  range: { commits: string[]; entries: { commit: string; path: string; oid: string }[] };
  anchor: { source: 'caller-file'; authenticity: 'unverified' };
  evaluator: { name: '@loomake/trace'; version: string };
  environment: { node: string; platform: string; arch: string };
  checkedAt: string;
};
export function reuseRecordProblem(value: unknown, change: string): string | undefined;   // 同期・I/Oなし・例外を出さない

export type ReuseOptions = {
  root: string; changeId: string;
  summaryPath: string;   // repo 相対 POSIX。.loomake/evidence/<change>/<YYYYMMDDTHHMMSSZ>-<12hex>.json だけ
  anchorPath: string;    // resolve(root, anchorPath)。CLI は root=cwd
  stdout: (text: string) => void; progress?: (text: string) => void;
  json?: boolean; scope?: VerifyScope; qualitySchema?: QualitySchemaLike;  // scope は再検証でだけ使う。既定 ci
  now?: () => Date; env?: NodeJS.ProcessEnv;                                  // env は再検証の runRecord へ渡す
};
export type ReuseOutcome = 'reused' | 'revalidated' | 'returned-to-human' | 'stopped';
export type ReuseReasonCode = FixedSummaryProblemCode | EvidenceRangeReasonCode
  | 'ANCHOR_UNREADABLE' | 'ANCHOR_IN_REPOSITORY'
  | 'PRIMARY_MISSING' | 'PRIMARY_NOT_REGULAR' | 'PRIMARY_TOO_LARGE' | 'PRIMARY_NOT_UTF8'
  | 'PRIMARY_OTHER_CHANGE' | 'PRIMARY_INVALID' | 'PRIMARY_ROLE' | 'PRIMARY_NAME_MISMATCH' | 'PRIMARY_IN_SOURCE'
  | 'SUMMARY_NOT_PASSING' | 'ENTRY_INVALID' | 'LEGACY_EVIDENCE_IN_RANGE' | 'OTHER_EVIDENCE_NOT_PASSING'
  | 'ENVIRONMENT_MISMATCH' | 'EVALUATOR_MISMATCH' | 'COMMANDS_MISMATCH' | 'BASIS_MISMATCH' | 'DOCUMENTS_MISMATCH'
  | 'WORKTREE_DIRTY' | 'STATE_CHANGED' | 'RECORD_EXISTS';
export type ReuseReason = { code: ReuseReasonCode; message: string; path?: string; commit?: string; field?: string };
export type ReuseResult = {
  resultVersion: 1; outcome: ReuseOutcome; exitCode: number;
  reasons: ReuseReason[];        // reused だけ空配列。ほかは空でない
  source: string | null;         // 信頼値の sha。読めなければ null
  target: string;
  record: { path: string } | null;   // reused：再利用の記録。revalidated：新しい Evidence 2（記録しなかったときは null）
  verifyExitCode: number | null;     // revalidated で verify が走ったときだけ値を持つ
};
/** 同期。結果を返し、表示も行う */
export function runReuse(options: ReuseOptions): ReuseResult;
```

- `packages/trace/src/index.ts` に、`runReuse`・`reuseRecordProblem`・`REUSE_RECORD_VERSION` と、型 `ReuseOptions`・`ReuseResult`・`ReuseOutcome`・`ReuseReason`・`ReuseReasonCode`・`ReuseRecord` を追加します。
- 型はどれも trace に置き、core は変えません。kit の型は kit から import し、重複して定義しません。

### 既存コードへの最小の内部変更（公開されているものは変えない）

- `record.ts`：`runRecord` の本体を、内部関数 `recordEvidence(options): { code: number; path?: string; verified: boolean }` に移します。`runRecord` は `recordEvidence(o).code` を返すだけになり、振る舞い・表示・公開型は同じです。
  - これで、再検証のときに記録先を取得できます。`stdout` の解析には頼りません。
  - `onVerify` は従来どおり、v2 の結果を通知するだけです。
- `summary-record.ts`：次の 2 つを内部 export にします。
  - `traceVersion()`（既存の `version`）
  - `commandsReference(root)`：`executionSummary` の 25〜27 行を関数に切り出したもの。出力は同じ

---

## 3. 問い 2・3：SHA と Git の範囲（確定）

### SHA の扱い

- **target は常に HEAD です。** CLI・API ともに target の指定はありません。初回の `target` は廃止し、CLI の usage と一致させます。
- `rev-parse HEAD` の結果は、小文字 40 桁または 64 桁の 16 進である必要があります。
  - 失敗した場合（unborn など）と、git を起動できない場合は UsageError（2）。record の `git()` と同じ分類です。
  - detached HEAD は受け付けます。
- **source は `anchor.sha` です。** 形式は `checkFixedSummary` と同じく小文字 40 桁または 64 桁で、`summary.sha` とは完全一致で照合します。
  - 大文字の summary は `TARGET_SHA_MISMATCH` で差し戻しになります。
  - source と target の桁数が違う場合（object format が違う場合）は `SOURCE_UNAVAILABLE` で、再検証になります。
- `readEvidenceRange` が受ける source と target は、上と同じ形式です。形式が違えば UsageError、`changeId` は `CHANGE_ID` で検査します。

### Git の操作

すべて `runExternalBytes('git', ['--no-replace-objects','--literal-pathspecs','-C', repo, ...], { maxBuffer: 16MiB })` で行います。1 操作の期限は既定の 30 秒です。分類は次のとおりです。

- `ProcessLimitError`
  - 種類が `output`：その段階の `RANGE_TOO_LARGE`
  - 種類が `timeout` と `interrupted`：そのまま投げる。CLI は終了コード 3（REQ-192）
- `result.error`（ENOENT など）：UsageError。固定の文言だけにし、git の stderr は載せない
- 終了コードが 0 以外：段階ごとに下の表の reason にする（再検証）

初回の「例外で止まらず再検証」は、**データに由来する場合だけ**に適用します。期限は REQ-192 のとおり 3 にします。

| 段階 | 操作 | 不可になる条件 → reason（その段階で終わる） |
|---|---|---|
| 1 | `rev-parse --is-shallow-repository` | `true` → `SHALLOW_REPOSITORY`。0 以外の終了 → `GIT_RANGE_UNREADABLE` |
| 2 | `cat-file -t <source>`、`cat-file -t <target>` | 0 以外の終了、または `commit` でない → `SOURCE_UNAVAILABLE`（target なら `GIT_RANGE_UNREADABLE`） |
| 3 | なし | source と target が同じ → `EMPTY_RANGE` |
| 4 | `merge-base --is-ancestor <s> <t>` | 終了コード 1 → `SOURCE_NOT_ANCESTOR`。それ以外の 0 以外 → `GIT_RANGE_UNREADABLE` |
| 5 | `rev-list --reverse --parents --max-count=4097 <s>..<t>` | 4097 件 → `RANGE_TOO_LARGE`。親が 1 つでないコミット → `MERGE_IN_RANGE`（該当するすべてのコミットを commit 付きで並べて終える） |
| 6 | 各コミットで `diff-tree -r -z --raw --no-renames --no-commit-id --full-index <parent> <commit>` | ・合計の entry 数が 4096 を超える → `RANGE_TOO_LARGE` で終える<br>・状態が `A` 以外（M/D/T/C/U）→ `ENTRY_NOT_ADDED`<br>・旧 mode が `000000` でない、または新 mode が `100644` でない（100755/120000/160000）→ `ENTRY_MODE`<br>・path が `isSafeRepoPath` に通らない、または下の 2 つの形のどちらでもない → `ENTRY_PATH_NOT_ALLOWED`<br>・この段階だけは、全コミットの理由を集めて返す |

許可する path は次の 2 つの形だけです。`<change>` は検査済みの id をそのまま文字列で比べます。

- `.loomake/evidence/<change>/<\d{8}T\d{6}Z>-<[0-9a-f]{12}>.json`：kind `evidence`
- `.loomake/evidence/<change>/reuse/<同じ形>.json`：kind `reuse`

`effort/` やほかの change の証跡は `ENTRY_PATH_NOT_ALLOWED` です（確認事項 Q-09）。

### 全 diff の意味

**各コミットの diff を使います。最終 tree の net diff は使いません。** その結果、次のようになります。

| 範囲の中身 | 結果 |
|---|---|
| コード変更 → revert | M か D が出るので再検証 |
| 証跡の追加 → 変更 → 復元 | M が出るので再検証 |
| rename | `--no-renames` で D と A になり、再検証 |
| root commit | source が祖先なので範囲に入らない。祖先でなければ段階 4 で止まる |
| merge | Q5a のとおり常に再検証 |
| 空のコミット | entry がないので許可 |

- source と target が同じ空範囲は `EMPTY_RANGE` です。ただし trace では、先に `PRIMARY_IN_SOURCE`（差し戻し）が当たります（4 章）。
- 追加 A は、範囲の中の各コミットで要求します。一次要約は「source の tree にない」ことと「target の tree にある」ことで確認し、範囲の entry に含まれることも trace で確かめます。

---

## 4. 問い 4・5・6・7：`runReuse` の手順・優先順・予算・anchor・状態（確定）

### 優先順

**stopped（開始時）＞ returned-to-human ＞ stopped（終了時）＞ revalidated ＞ reused**

- 差し戻しの段階では、最初に当たった 1 件だけを理由にして終えます。
- 再検証の理由は、すべて集めてから決めます。
- 旧 PASS や再検証の PASS で、差し戻しを隠すことはありません。差し戻しのときは再検証も記録も行いません。

| # | 処理 | 結果 |
|---|---|---|
| 0 | 引数を確かめる。<br>・`assertChangeId`<br>・`loadConfig`<br>・active な `openspec/changes/<id>` がディレクトリとしてある（archive は見ない）<br>・`summaryPath` が許可された形（`reuse/` は不可）<br>・`anchorPath` が空でない | 違えば UsageError（2）。JSON は出さない |
| 1 | `rev-parse HEAD`、`rev-parse --show-toplevel`、`rev-parse --git-common-dir` を読む | 失敗すれば UsageError（2） |
| 2 | 未コミットの変更（`status --porcelain --untracked-files=all`）がある | stopped `WORKTREE_DIRTY`（1） |
| 2' | 開始時の状態を保持する。<br>・HEAD<br>・`readDocuments(changeDir)`<br>・`commandsReference(root)` | なし |
| 3 | anchor を読む。<br>・`realpathSync.native` で正規化したパスが、toplevel か git common dir の中にある<br>・読取りは `readInputBytes(path, DOCUMENT_LIMITS)` で行い、最後の要素のリンクと通常ファイル以外は拒否する（親の symlink や junction は realpath で解決したうえで内外を判定する）<br>・strict UTF-8 で decode し、`JSON.parse` する<br>・生 bytes の SHA-256 を保持する | ・中にある → `ANCHOR_IN_REPOSITORY`<br>・読めない（不在、上限超過、UTF-8 や JSON の不正）→ `ANCHOR_UNREADABLE`<br>・どちらも差し戻し（1） |
| 4 | `reader = createGitEvidenceReader(root)`（JSON_LIMITS）を作り、`treeEntry(target, summaryPath)` と `readText(oid)` で一次要約を読む | ・absent か unreadable → `PRIMARY_MISSING`<br>・blob でない、または mode が 100644 でない → `PRIMARY_NOT_REGULAR`<br>・`BLOB_TOO_LARGE` → `PRIMARY_TOO_LARGE`<br>・`BLOB_NOT_UTF8` → `PRIMARY_NOT_UTF8`<br>・`BLOB_UNREADABLE` → `PRIMARY_MISSING`<br>・どれも差し戻し |
| 5 | `checkFixedSummary(text, anchorValue)` | FAIL なら reason をそのまま付けて差し戻し（信頼値での照合を、形の確認より先に行う） |
| 6 | 形を確かめる（`value = JSON.parse(text)`）。<br>・`value.change` が対象の change と違う<br>・`evidenceProblem(value, change)` に通らない、または own の `summaryVersion` がない<br>・`role` が development でない<br>・ファイル名の 12 桁が `anchor.sha.slice(0, 12)` と違う | 順に `PRIMARY_OTHER_CHANGE`、`PRIMARY_INVALID`、`PRIMARY_ROLE`（Q6）、`PRIMARY_NAME_MISMATCH`。どれも差し戻し |
| 7 | `treeEntry(source, summaryPath)` | ・found → `PRIMARY_IN_SOURCE`（差し戻し）<br>・absent → 次へ<br>・unreadable → 次へ（8 で `SOURCE_UNAVAILABLE` になる） |
| 8 | 要約が合格の ci であることを確かめる（`!isAbortedResult(v)`、`v.scope === 'ci'`、`verifyExitCode(v) === 0`） | 満たさなければ再検証の理由 `SUMMARY_NOT_PASSING` |
| 9 | `readEvidenceRange({ repository: root, source, target, changeId })` | ・allowed でなければ、kit の reasons を再検証の理由にする。本文は読まない<br>・allowed なら、一次要約の oid も entry にあることを確かめる（ない場合は `PRIMARY_MISSING` で差し戻し）<br>・ほかの entry を、範囲の順に 1 件ずつ `readText` で読む（下の表） |
| 10 | 環境と基準を照合する（下の表） | 違えば再検証の理由 |
| 11 | 終了時の状態を確かめる。<br>・HEAD、未コミットの変更、文書、`commandsReference`<br>・`basisHash`（10 で求めた値）<br>・anchor を読み直した生 bytes の SHA-256 | 2' からどれかが変わっていれば stopped `STATE_CHANGED`（1）。記録も再検証もしない |
| 12a | 再検証の理由が 1 件以上ある | 理由を表示してから `recordEvidence({ root, changeId, scope, qualitySchema, env, now, stdout: json ? progress : stdout, progress, onVerify })` を呼ぶ。outcome は revalidated、exitCode はその code、record は path か null |
| 12b | 再検証の理由が 0 件 | 再利用の記録を保存する（5 章）。<br>・保存した → reused（0）<br>・同名がある → stopped `RECORD_EXISTS`（1） |

#### 手順 9：範囲の entry の本文検査

| entry の種類 | 検査 | 不可になったときの理由 |
|---|---|---|
| 共通 | `readText` で読む | 上限超過 → `RANGE_TOO_LARGE` を付けて本文の検査を終える。UTF-8 の不正や読めない → `ENTRY_INVALID`（path 付き） |
| evidence | `evidenceProblem(change)` に通り、ファイル名の 12 桁が `sha.slice(0, 12)` と一致する | `ENTRY_INVALID` |
| evidence（Evidence 1） | なし | `LEGACY_EVIDENCE_IN_RANGE` |
| evidence（Evidence 2 の合格でない記録：aborted か終了コードが 0 以外） | なし | `OTHER_EVIDENCE_NOT_PASSING`（Q-12） |
| reuse | `reuseRecordProblem(change)` に通り、ファイル名の 12 桁が `target.sha.slice(0, 12)` と一致する | `ENTRY_INVALID` |

#### 手順 10：環境と基準の照合

| 理由 | 照合の内容 |
|---|---|
| `ENVIRONMENT_MISMATCH` | `execution.environment` の node・platform・arch を `process` と、項目ごとに比べる。field に項目名を入れる |
| `EVALUATOR_MISMATCH` | `execution.evaluator.version` と `traceVersion()` |
| `COMMANDS_MISMATCH` | `execution.commands` の source・sha256 と `commandsReference(root)` |
| `BASIS_MISMATCH` | `execution.basisSha256` と `basisHash(root, changeDir)` |
| `DOCUMENTS_MISMATCH` | `documents` と `readDocuments` を `changedDocuments` で比べる。`documents` がない場合もこの理由 |

#### 再検証の理由の並び順

1. `SUMMARY_NOT_PASSING`
2. kit の段階の順
3. entry の範囲の順
4. 環境：node → platform → arch → evaluator → commands → basis → documents

### 予算（既存の値は緩めない）

| 対象 | 上限 |
|---|---|
| コミット | 4096 件 |
| entry | 合計 4096 件 |
| Git のメタデータ | 1 回の呼出しの出力が 16MiB |
| 深さ | path の形で 5 に固定される |
| blob | 1 件 64MiB、一次要約と全 entry の合計 128MiB。同じ reader が 1 つの合計で数える |
| anchor | 1MiB（DOCUMENT_LIMITS） |
| 設定の raw | 既存の `readInputBytes` の既定 |

- 大きさは `cat-file -s` で確かめ、`cat-file blob` の maxBuffer を size に合わせて読みます。長さが一致しなければ `BLOB_UNREADABLE` です。
- 同じ oid は trace が 2 度読みません。一次要約の text を再利用し、ほかに重複する oid も最初の結果を使います。
- strict UTF-8 の decode は `TextDecoder('utf-8', { fatal: true, ignoreBOM: true })` で 1 回だけ行います。BOM は文字として残るので JSON の不正になります。
- `-z` を使うので、path に NUL は現れません。改行や制御文字を含む path は、`isSafeRepoPath` で `ENTRY_PATH_NOT_ALLOWED` になります。

### anchor の最小保証（契約に明記する）

- 信頼値は、呼出側が repo の外で凍結して用意するものです。実装で保証するのは次の 3 つだけです。
  1. realpath で解決したパスが、toplevel と git common dir の外にある
  2. 最後の要素がリンクでない、通常のファイルである
  3. 手順 11 で、bytes が変わっていない
- hardlink と、別の経路でマウントした場所は検出しません（Q-11）。
- 読めたことと自己ハッシュは、真正性の根拠にしません。記録には `authenticity: 'unverified'` と書きます。
- Windows と大文字小文字の違いは、`realpathSync.native` の正規化に任せます。そのうえで `path.relative` の結果が `..` で始まらず、絶対パスでもなければ「中にある」と判定します。

### 状態の保証範囲

- 保証するのは、手順 2 から手順 11 の終了までです。11 の後から保存までの競合は、`publishEvidence` の `wx` と hardlink による衝突の拒否だけが守ります。
- 再検証に入った後は、`runRecord` の既存の保証（REQ-067・REQ-128）が引き継ぎます。手順 11 で止めるので、状態が変わった後に再検証へ進むことはありません。

---

## 5. 問い 8：ReuseRecord の検証と保存（確定）

### `reuseRecordProblem` の契約

- 同期で、I/O を行いません。全体を try で包み、getter・Proxy・循環などで例外が起きても `'再利用の記録を読めません'` を返します。
- 入力は変更しません。未知の欄と own の `__proto__` は無視し、保持します（`evidenceProblem` と同じ流儀）。
- 欄はすべて必須で、nullable な欄はありません。

検査する内容は次のとおりです。

| 欄 | 条件 |
|---|---|
| `reuseVersion` | number の 1 |
| `change` | 対象の change と同じ |
| 固定値の 3 欄 | `verification`・`qualityCommands`・`anchor` が上の型の値と完全一致 |
| SHA（`source.sha`・`target.sha`・各 commit） | 小文字 40 桁か 64 桁で、すべて同じ桁数。source と target は違う |
| `range.commits` | 空でなく、重複がなく、最後が `target.sha` |
| `range.entries` | 空でない。各 commit が `range.commits` に含まれ、path が許可された形で重複がなく、oid は SHA と同じ桁数 |
| `source.summary` | path が entries にあって oid が一致する。path は evidence の形で、12 桁は `source.sha` の先頭と一致する |
| `source.summary` のほかの欄 | sha256 は小文字 64 桁の 16 進。runId は数字列、runAttempt は `[1-9]\d*` |
| `evaluator` | name が `@loomake/trace`、version が空でない |
| `environment` | 3 項目とも空でない文字列 |
| `checkedAt` | 既存の date の形 |

- 後の範囲に含まれる reuse 記録は、この検査とファイル名の照合（4 章の手順 9）に通ることだけを条件に許可します。判定の根拠には使いません。

### 保存

内部関数 `serializeReuseRecord(record)` で次の順に処理します。

1. `reuseRecordProblem` で確かめる
2. `JSON.stringify(record, null, 2) + '\n'` にする
3. UTF-8 で 64MiB 以内であることを確かめる
4. `JSON.parse` で読み直して、もう一度確かめる

どの失敗も UsageError（記録なし）です。`serializeEvidence` は使いません。

保存先は `.loomake/evidence/<change>/reuse/<stamp(now)>-<target12>.json` です。

- 保存の前に、`.loomake`・`evidence`・`<change>`・`reuse` のうち存在するものを lstat し、通常のディレクトリで symlink でないことを確かめます。違えば UsageError です。
- その後 `publishEvidence` を使います。false が返れば `RECORD_EXISTS` です。それ以外の失敗は既存どおり UsageError になります。

## 5. 4851 §5「秘密の扱い」の差し替え文

> - 記録の値は、hash・SHA・oid・数字列・固定の列挙値・形を検査した path・change・評価器と環境の版だけで、自由な文は入りません。
> - SHA・oid・sha256・runId・runAttempt・日時と 12 桁は、16 進か数字だけなので、既知の秘密の形には当たりません。一方、change-id は `CHANGE_ID` の文法上、`sk-`・`xox?-`・`glpat-` の形を含み得ます。その change-id を含む path と、評価器や実行環境の版も、秘密の形を含み得ます。
> - そのため、値は置き換えずに、`reuseRecordProblem` で既知の文字列の欄すべてが `maskSecrets` で変わらないことを確かめます。変わる場合は保存せず、固定の UsageError にします。元の要約の bytes は変えません。
> - 表示する診断は次のように扱います。
>   - JSON 出力は `maskValue(result)` を通し、人向けの文は 1 行ずつ `maskSecrets` を通します。path に含まれる秘密の形は `***` のまま出し、元に戻しません。
>   - git の stderr と blob の内容は、message と cause のどちらにも載せません。

§5 の `reuseRecordProblem` の契約の表には、3 章の読み方の表と、runId・runAttempt の行（`summary.ts` と同じ条件）を加えます。

---

## 6. 問い 9：出力と JSON（確定）

| outcome | exitCode | record | verifyExitCode |
|---|---|---|---|
| reused | 0 | 再利用の記録 | null |
| revalidated | `recordEvidence` の code（0〜3。記録しなかった場合は 1） | Evidence 2、または null | 値、または null（未実行のとき） |
| returned-to-human | 1 | null | null |
| stopped | 1 | null | null |

- `--json` のとき、`stdout` が呼ばれるのは最後の 1 回だけで、`JSON.stringify(maskValue(result))` を渡します。進捗と `runRecord` の表示はすべて `progress`（標準エラー）へ出します。
- 使い方の誤り（2）と実行時の失敗（3）は例外として投げます。JSON は出しません。これは verify と同じです。
- 保存の失敗（UsageError）も、例外としてそのまま投げます。
- `stdout` や `progress` の callback が投げた例外は捕まえず、変換もせず、そのまま伝えます。すでに保存した記録は追記専用なので消しません。
- 人向けの表示は、reused のときに次の文を必ず含めます。
  > 品質コマンドは実行していません。品質の合格や CI の最終合格を表しません
- 再検証の FAIL・aborted、記録なし、衝突は、exitCode・record・verifyExitCode の組み合わせで区別できます。「revalidated かつ 0」の場合だけが、再検証の成功です。
- `qualitySchema` は CLI が `await loadVerifyQualitySchema()` で用意して渡します。`runReuse` 自体は同期です。

---

## 7. 問い 10：CLI・既存の契約・配布

### CLI の定義

`args.ts` の `traceOperations` の**末尾**（approve の後）に、次を追加します。

```
usage: loomake trace reuse --change <id> --summary <path> --anchor <file> [--scope local|ci] [--json]
description: 証跡だけの差分なら、外部の信頼値で照合した要約を品質コマンドなしで再利用して .loomake/evidence/<change-id>/reuse/ に記録する。混在や環境の違いは再検証し、要約の改変は人へ差し戻す。
options:
 --change  value  必須  なし
 --summary value  必須  なし   target時点の要約のrepo相対パス（.loomake/evidence/<id>/<日時>-<12桁>.json）
 --anchor  value  必須  なし   repo外で凍結した信頼値JSON。真正性は確かめない
 --scope   value  任意  ci     再検証するときのverifyの範囲。choices SCOPES
 --json    flag   任意  false  結果のJSONだけを標準出力へ出す
```

### `main.ts` の変更

- record・report の判定より前に `if (sub === 'reuse') return reuse(rest, io);` を入れます。
- `reuse` の中では、`parseOptions` の後に次を判定します。
  - `--change` がない：`--change <id> が必要です`
  - `--summary` がない：`--summary <path> が必要です`
  - `--anchor` がない：`--anchor <file> が必要です`
- そのうえで、`scopeOption` と `runReuse({ ..., qualitySchema: await loadVerifyQualitySchema(), stdout: io.stdout, progress: io.stderr, json })` を呼び、`exitCode` を返します。
- 操作の指定がないときの文を、`record・report・answer・approve・reuse のどれかを指定してください` に変えます。
- `trace` の summary と description にも reuse を加えます。

### CLI 基準の差分

`reference-cli-baseline-changes.json` に追記します。各項目は change `evidence-only-reuse`、requirement `REQ-476`、承認元 `Q-08` です。

| # | 対象の argv | stream / entry | 旧文 → 新文 |
|---|---|---|---|
| 1 | effort-record の第 4 項と同じ 11 例（`trace`、`trace recrd`、`trace record`、`trace report` など、usage を出す例） | stderr / 1 | `       loomake trace approve --change <id> --assumption <A-ID> --by <承認者> [--date YYYY-MM-DD]` → 同じ行 ＋ `\n       loomake trace reuse …`（上の usage） |
| 2 | `trace --help`、`trace -h`、`constructor`・`toString`・`nothing` の `--help` の 5 例 | stdout / 0 | `  --date YYYY-MM-DD   承認日。省くと今日の日付` → 同じ行 ＋ `\n\n使い方: loomake trace reuse …\n<description>\n\nオプション:\n…`（`commandHelp` の実出力どおり） |
| 3 | `--help`、`-h` | stdout | `  trace    証拠を記録し（record）、リリースレポートを出す（report）。確認事項の回答（answer）と仮定の承認（approve）を書く` → 末尾に `。証跡だけの差分なら要約を再利用する（reuse）` を加えた 1 行 |
| 4 | `trace` | stderr / 0 | 操作の指定がないときの文を上の新しい文へ |

- `trace record --help` と `trace approve --help` は、変わらないことを確かめます。
- `trace reuse --help` は原本にない新しい例なので、基準の差分ではなく新しい試験で確かめます。
- `trace recrd` から `reuse` への編集距離は 3 なので、「もしかして」の候補は変わりません。
- 実装の担当者は、原本で trace の usage を出すすべての例を列挙します。`applyBaselineChanges` は、対象の例がないときも、差分の当て漏れがあるときも失敗するので、列挙漏れは試験で分かります。

### MODIFIED と生成物

- **MODIFIED は REQ-323 だけです。** 「コマンドと操作の列挙」の Scenario に reuse を加えます。全文は 8 章に載せます。
  - REQ-324 は、未 archive の verify-v2-scope の差分で、すでに「改版での基準の差分」を許しています。REQ-135・REQ-325 は変更せずに満たせます。
- `reference-definition.test.ts:106,112` の操作の列挙の期待値に、reuse と `{ values: ['--change','--summary','--anchor','--scope'], flags: ['--json'] }` を加えます。仕様の MODIFIED に従う変更で、試験を弱めるものではありません。
- `docs/guide/3.reference/5.cli.md` を再生成します。
- 公開型の検査のため、`tests/fixtures/public-api/consumer.ts.txt` に次を加えます。
  - kit：`readEvidenceRange`、`createGitEvidenceReader`、`type EvidenceRange`、`type GitEvidenceReader`
  - trace：`runReuse`、`reuseRecordProblem`、`REUSE_RECORD_VERSION`、`type ReuseOptions`、`type ReuseResult`、`type ReuseRecord`
  - 戻り値の型が等しいことを、`Equal` で 1 つずつ確かめます。
- `public-source-exports.test.ts` は解決先の試験なので変えません。`package-artifacts` は、基準の差分を当てた packed CLI の比較で reuse の help も確かめます。

---


## 2. 決定 (1)：秘密の形に当たる値を含む記録の扱い

### 採用する方法

**値は置き換えず、検証で拒否します。** 検査は `reuseRecordProblem` の 1 箇所だけに置きます。

- 既知の文字列の欄のどれかで `maskSecrets(s) !== s` なら不正とし、固定の問題文 `'記録する値が秘密情報の形に当たります'` を返します。
- 検査の順序は、型と形の検査がすべて通った後です（3 章の「型を先に確かめる」を守るため）。
- 対象は、既知の文字列の欄すべてです。欄ごとの選別はしません。
  - `change`、`verification`、`qualityCommands`
  - `source.sha`、`source.summary.{path, oid, sha256, runId, runAttempt}`
  - `target.sha`、`range.commits[]`、`range.entries[].{commit, path, oid}`
  - `anchor.{source, authenticity}`、`evaluator.{name, version}`
  - `environment.{node, platform, arch}`、`checkedAt`
- 未知の欄は従来どおり無視し、保持します。検査の対象にもしません。
- 置き換えて保存する案（maskValue の結果を書く案）は採りません。理由は次のとおりです。
  - `***` になった path や change は ReuseRecord の検査（path の形、change の一致）に通らないので、自己矛盾した記録になります。
  - 再利用元と範囲を特定するという記録の意味がなくなります。
  - Effort の方式（`effort-input.ts:117-122`：置換した後に検査し、不正なら汎用の UsageError）とも、結果が同じ「拒否」になります。

### 呼出しの位置と結果

| 経路 | 位置 | 結果 |
|---|---|---|
| 保存（手順 12b） | `serializeReuseRecord` の 1 と 4。どちらも `reuseRecordProblem` を呼ぶので、追加の分岐は要らない | 固定の UsageError（終了コード 2）。JSON は出さない |
| 範囲の中の reuse 記録（手順 9） | 既存の `reuseRecordProblem(change)` の呼出しのまま | `ENTRY_INVALID`（path 付き。表示は mask する）で revalidated |
| 公開 API の利用者 | `reuseRecordProblem` | 例外は出さず、上の固定の問題文を返す |

**開始時（手順 0）の事前拒否は採りません。** 理由は次の 2 つです。

- 秘密の形は保存する値の性質であり、新しく保存するのは ReuseRecord だけです。
- 事前に拒否すると、revalidated の経路（REQ-476「runRecord と同じ検証と記録」）まで止まり、change-id の受理条件をほかの trace の操作と変えることになります。

その代わり、拒否は判定がすべて終わった後になります。利用者が change-id や版を変えないかぎり再利用は成立しないことを、文で示します。

### UsageError の固定文

`serializeReuseRecord` のすべての失敗（形の不正、秘密の形、JSON への変換、64MiB 超）で同じ文を使います。cause は付けません。

> 再利用の記録を保存できません。記録する値（change-id を含むパス、評価器と実行環境の版）に秘密情報の形があるか、記録の形が不正です。記録していません。

### 保存する前と、すでに保存されたものの扱い

- `serializeReuseRecord` は、祖先ディレクトリの lstat と `publishEvidence` より**前**に呼びます。失敗したときは、ディレクトリも一時ファイルも作りません。
- 人向けの表示で「reused」の文を出すのは保存の成功後なので、失敗したときは出ません。`--json` のときは、最後の 1 回の stdout も呼ばれません。
- 元の要約、Evidence 2、範囲の中にすでにある reuse 記録の bytes は、どの経路でも書き換えません。不正なものは `ENTRY_INVALID` として revalidated にするだけです。
- 表示の扱いは 4851 のとおりです（JSON は `maskValue(result)`、人向けの文は `maskSecrets`）。
  - 秘密の形の change-id を含む `record.path`（revalidated で記録した Evidence 2 の path）や、reasons の `path` は `***` を含んだまま出し、元に戻しません。
  - これは表示の制約として、利用者向けの説明に 1 文で書きます。

---

## 3. 決定 (2)・(3)：既知の欄の型の境界と runAttempt

### `reuseRecordProblem` の読み方（全体を try で包む既存の契約は維持）

| 規則 | 内容 |
|---|---|
| change の引数 | `typeof change !== 'string' \|\| !CHANGE_ID.test(change) \|\| change === 'archive'` なら問題を返す（例外は出さない） |
| 既知の欄の読取り | `Object.getOwnPropertyDescriptor` で読み、own の data property（`'value' in d`）だけを使う<br>・accessor は実行せずに不正とする<br>・継承した値は「欠落」として扱う |
| object | Array でなく、prototype が `Object.prototype` か null のもの |
| Array | `Array.isArray` で、prototype が `Array.prototype`。要素は 0〜length−1 を同じく own の data property として読む（穴は欠落として不正） |
| 文字列の欄 | 正規表現・`includes`・`slice`・比較・`maskSecrets` より**先に** `typeof v === 'string'` を確かめる。boxed の String、Array（`['1']` が `/^[1-9]\d*$/` に通ることを防ぐ）、`toString` を持つ object は不正 |
| 数の欄 | `reuseVersion` は `typeof v === 'number' && v === 1`。boxed の Number と `'1'` は不正 |
| 固定値の欄 | 文字列のリテラルと `===` で比べる |
| 禁止事項 | 既知の欄で `String()`、テンプレート文字列、`==`、`Number()` による変換を、判定より前に行わない |
| Proxy | trap が投げた場合は、既存の `'再利用の記録を読めません'` を返す。trap の実行自体は防がない（4851 の契約のまま） |

### runId と runAttempt

`summary.ts` と同じ条件にします。要約で通った値が保存のときに落ちないように、受理する範囲を一致させます。

| 欄 | 条件 |
|---|---|
| `runAttempt` | `typeof v === 'string' && /^[1-9]\d*$/.test(v) && Number.isSafeInteger(Number(v))`（`summary.ts:8` と同じ。正の 10 進で、先頭に 0 がなく、上限は `"9007199254740991"`） |
| `runId` | `typeof v === 'string' && /^\d+$/.test(v)`（`summary.ts:19` と同じ。先頭の 0 は許す） |

- 判定の関数は `reuse-record.ts` の中で同じ式で定義し、`summary.ts` は変えません。
- 一致していることは、境界値の試験で確かめます（6 章）。
- record に入れる値は、手順 6 で `summaryProblem` を通った要約の `ci.runAttempt` と `ci.runId` を**そのまま写したもの**です。
  - `checkFixedSummary` の `ATTEMPT` には安全な整数の検査がありません。しかし手順 6 の `summaryProblem` で、安全な整数を超える値は `PRIMARY_INVALID`（差し戻し）になるので、record まで届きません。

### `reuse.ts` の側

- 要約の欄の比較（手順 8 と 10）は、`evidenceProblem` と `summaryProblem` で型が確定した値に対して、`===` だけで行います。
- `anchor.sha` は、`checkFixedSummary` が PASS で、かつ `typeof === 'string'` を確かめてから `slice(0, 12)` に使います。

---


## 試験と互換

## 9. tasks.md（案）と試験の対応

試験の仕組みは初回の 8 章を引き継ぎます。

- 品質コマンドは、カウンタを記録する `node count.mjs` にします。
- 要約は、`runRecord({ scope: 'ci' })` に GITHUB の環境値を付けて実際に記録します。
- anchor は、repo の外の一時ファイルに凍結します。

1. kit の `evidence-range.ts` と公開
   - 試験 `packages/kit/test/evidence-range.test.ts`、[REQ-473] ×7
   - 内容：許可、混在、マージ、祖先でない、M/D/T・mode・別 change・`effort/`、shallow・欠落・上限、revert と `git replace`、共有予算と UTF-8
   - 依存の向きの試験が通ること
2. trace の `reuse-record.ts`（型、`reuseRecordProblem`、serialize）
   - 試験は validator の境界：必須欄、版、相互の整合、未知の欄、`__proto__`、getter や Proxy でも例外にならないこと、入力が変わらないこと
3. record の内部分離と `reuse.ts`
   - 試験 `packages/trace/test/evidence-reuse.test.ts`、[REQ-474] ×8、[REQ-475] ×4
   - 内容：優先順、差し戻し時のカウンタ 0、bytes が変わらないこと、report と runner の結果が変わらないこと、同名、symlink の祖先
4. CLI の `trace reuse`、基準の差分、`reference-definition` の更新、生成ページ
   - 試験 `packages/cli/test/trace-reuse-cli.test.ts`、[REQ-476] ×5
   - 内容：`main` 経由で実 Git と実プロセスを使う。reuse のカウンタ 0、混在のカウンタが各 1 で終了コードが一致、状態の変化、`--json` の 4 種、使い方の誤り、help
   - 既存の [REQ-323] の試験の期待値を更新する
5. `consumer.ts.txt` に公開型を追加
6. 利用者向けの説明（真正性が未確認であること、品質の合格ではないこと、マージ直前に再実行すること）、changeset（kit・trace・loomake すべて patch）、worklog
7. lint・typecheck・全体試験・`generate-cli-reference --check` を通す。このタスクに `- [x]` を付けた状態で、`pnpm -s verify --change evidence-only-reuse --done --scope local` を通す `<!-- loomake:gate=done -->`

通常の done は、未完了のタスクを 1 件でも残すと失敗します。そのため、7 は**同じコミットの中でチェックしてから**ローカルの done を実行します。最終の合格は、CI の gate（scope ci）と必須 5 チェックで判断します。

既存の回帰試験（publication-retry、summary-integrity、verify-v2-*、ci-gate-*、package-artifacts）は、変更せずに通します。

### 差分の大きさの見積り

| 対象 | 大きさ |
|---|---|
| kit（実装と試験） | 約 35KiB |
| trace（実装と試験） | 約 65KiB |
| CLI（実装と試験） | 約 20KiB |
| 基準の差分の JSON | 約 15KiB（argv の列挙が大きい） |
| 生成ページと fixture | 約 3KiB |
| openspec 一式 | 約 25KiB |
| docs・changeset・worklog | 約 7KiB |
| **合計** | **約 170KiB** |

200KiB 以内ですが、余裕はあまりありません。超えた場合も、helper だけを先に受け入れる分割はしません（判断は管理役）。

---


REQ-475 の保存は内部で構築した既知欄だけを対象とする。未知欄を解釈せず保持する validator の互換契約は、未知欄を判定根拠や新規保存データに取り込むことを意味しない。

公開kit型の列挙は8件である。出典の「型9つ」は実数の誤記として扱い、列挙にない型を追加しない。
