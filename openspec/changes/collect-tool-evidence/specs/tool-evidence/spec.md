## Purpose

gh・claude・codex・biome・playwright の出力を終了コードと区別した中立型へ変換し、保存の前に既知の秘密の形を置換して、後段の品質判定に事実を渡す。

## ADDED Requirements

### Requirement: 外部ツールの出力の中立変換

`@loomake/core` は 5 つの parser と中立型を named export し、下記の公開型・入力分類・写し方・境界に従って変換する SHALL。形の誤りは安全な ParseError 1 件と value:null を返し、正しい形の失敗も事実として返す MUST。

Source: REQ-448

##### 規範

`@loomake/core` は parseGhChecks・parseClaudeResult・parseCodexEvents・parseBiomeReport・parsePlaywrightReport を named export する SHALL。各関数は `(file, text)` から `ParseResult<ToolObservation | null>` を返す。対応する入力は gh 2.103.0 の `pr checks --json name,bucket,workflow,link`、Claude Code の `--output-format json` の result、codex 0.166.0 の `exec --json`、Biome 2.6.5 の JSON reporter、Playwright 1.64.1 の JSON reporter とし、受け付ける形と写し方は本 Requirement の対応表に従う SHALL。

形の誤り、空の入力、終端の欠落、順序の誤りは、value を null とし、ParseError を 1 件返す MUST。ParseError は入力の値と入力由来の key を含めない MUST。ツールが失敗を報告した正しい形は、ToolObservation として返す SHALL。任意の欄が無いか null のとき、スカラーは null、配列は空の配列とし、型の違いは誤りとする MUST。出力の key は固定の名前だけとし、知らない欄は捨てる SHALL。I/O・時計・合否の判定・新しい依存を使わない MUST。

##### 3.1 公開する型と署名（一意に固定）

以下の型と関数 5 つを named export する。

```ts
export type ToolName = 'gh' | 'claude' | 'codex' | 'biome' | 'playwright';
export type GhCheckBucket = 'pass' | 'fail' | 'pending' | 'skipping' | 'cancel' | 'other';
export type GhCheck = { name: string; bucket: GhCheckBucket; workflow: string | null; link: string | null };
export type AgentCause = 'reported_error' | 'flagged_error' | 'missing_result' | 'unknown_subtype' | 'stream_error';
export type AgentResult = {
  terminal: 'success' | 'error';
  cause: AgentCause | null;        // terminal が success のときだけ null
  text: string | null; sessionId: string | null; turns: number | null; errors: string[];
};
export type ToolFinding = { severity: 'fatal' | 'error' | 'warning' | 'info' | 'hint'; category: string | null; message: string; file: string | null; line: number | null; column: number | null };
export type BiomeSummary = { errors: number; warnings: number; infos: number; diagnosticsNotPrinted: number };
export type PlaywrightTestCase = TestCase & { project: string; outcome: 'expected' | 'unexpected' | 'flaky' | 'skipped'; retries: number };
export type PlaywrightError = { message: string | null };
export type ToolObservation =
  | { tool: 'gh'; kind: 'checks'; checks: GhCheck[] }
  | { tool: 'claude' | 'codex'; kind: 'agent-result'; result: AgentResult }
  | { tool: 'biome'; kind: 'diagnostics'; findings: ToolFinding[]; summary: BiomeSummary }
  | { tool: 'playwright'; kind: 'tests'; tests: PlaywrightTestCase[]; stats: { expected: number; unexpected: number; flaky: number; skipped: number }; errors: PlaywrightError[] };

export function parseGhChecks(file: string, text: string): ParseResult<ToolObservation | null>;
// parseClaudeResult・parseCodexEvents・parseBiomeReport・parsePlaywrightReport も同じ署名
```

`ToolObservation | null` は 5 つの parser で共通にします。collector の分岐を 1 つにするためです。成功したときに返る tool は、parser ごとに固定です。

##### 3.2 共通の規則（全 parser）

- **先頭の BOM**：1 つだけ取り除きます。
- **空の入力**：空白だけの入力も含め、ParseError「出力が空です」にします。
- **JSON の構文の誤り**：ParseError にし、line は `errorLine` で求めます。message は固定文で、V8 の例外文は使いません。JSON.parse が投げる例外は RangeError も含めてすべて捕捉します。
- **エラーの返し方**：value を `null` にし、ParseError を**最初に見つけた 1 件だけ**入れます。走査は文書の順に行います。空の成功は返しません。
- **ParseError の message**：「固定文：パス」の形にします。パスは固定の key と添字だけで作ります（例：`suites[0].specs[1].tests[0].status`）。入力の値と、入力由来の key は含めません。形の誤りの line は 1、JSONL は該当する行の番号です。
- **任意の欄（スカラー）**：欄が無いか `null` なら `null` にします。あるのに型が違えば ParseError です。
- **任意の欄（配列）**：欄が無いか `null` なら `[]` にします。要素の型が違えば ParseError です。d93 にあった「errors は `string[]` なのに、任意の欄は null」という食い違いは、この規則で解消します。
- **整数**：「0 以上の安全な整数」は `Number.isSafeInteger(v) && v >= 0` で判定します。小数、負の数、2^53 以上の値は ParseError です。
- **知らない欄**：捨てます。入力由来の key は出力に出しません。
- **使わないもの**：I/O、時計、zod、例外の送出、入力の変更。入れ子の再帰は明示したスタックで走査し、関数の再帰は使いません。

##### 3.3 gh（v2.103.0、aggregate.go:12-22/72-88、checks.go:189-190/302-304）

| 入力 | 結果 |
|---|---|
| 最上位が array 以外 | ParseError |
| 要素が object 以外、`name` か `bucket` が string 以外 | ParseError |
| `workflow`・`link` が無いか null | null。gh は `""` を出すことがあり、その場合は `""` のまま返す |
| bucket が 5 種のどれでもない | `other` |
| `[]` | parsed で `checks: []`。合格とは扱わない（純粋な parser の契約） |

実際の gh は、check が 0 件のとき exporter の前で終了し（checks.go:302-304、test:338-348）、stdout は空、終了コードは 1 になります。この空の stdout は §4 で `unreadable` になります。parser が `[]` を受け付けることとは別の扱いです。

##### 3.4 claude（`--output-format json`。2.1.308 で観測したのは stream-json の result の欄の型だけ）

必須の欄は 3 つです。`type === 'result'`、`subtype: string`、`is_error: boolean`。任意の欄は 4 つです。`result: string`、`session_id: string`、`num_turns`（0 以上の安全な整数）、`errors: string[]` で、§3.2 の規則を適用します。

| 入力 | 層 | terminal / cause |
|---|---|---|
| 最上位が array（`--verbose` の形など）、または object 以外 | ParseError | — |
| `type` が無い、または `result` 以外 | ParseError | — |
| subtype か is_error が無い、または型が違う | ParseError | — |
| 任意の欄の型が違う（例：errors が string、errors の要素が number、num_turns が負） | ParseError | — |
| `subtype:'success'`、`is_error:false`、result が string | parsed | success / null |
| `subtype:'success'`、`is_error:true` | parsed | error / `flagged_error` |
| `subtype:'success'`、`is_error:false`、result が無いか null | parsed | error / `missing_result` |
| subtype が `error_` で始まる（is_error の値は問わない） | parsed | error / `reported_error` |
| subtype がそれ以外の未知の値 | parsed | error / `unknown_subtype` |

text は result（string のときだけ）、sessionId は session_id、turns は num_turns、errors は errors です。cause の判定は表の上から順に行います。`success` の判定（is_error → result の順）が `error_` の判定より先です。

##### 3.5 codex（rust-v0.166.0、exec_events.rs）

**行の読み方**

- CRLF と LF を受け付けます。空白だけの行は無視します。
- 各行は object で、`type: string` を持つ必要があります。満たさなければ、その行の番号で ParseError にします。最後の途中行も同じです。最後の行に改行がなくても、正しい行なら受け付けます。

**既知の event の必須 payload**

| event | 必須の内容 |
|---|---|
| `thread.started` | `thread_id: string` |
| `turn.started` | なし |
| `turn.completed` | `usage` が object。中身は検査せずに捨てる |
| `turn.failed` | `error.message: string` |
| `error` | `message: string` |
| `item.started`・`item.updated`・`item.completed` | `item` が object で、`item.id: string` と `item.type: string` を持つ |
| `item.completed` で `item.type === 'agent_message'` のとき | 上に加えて `item.text: string` |

満たさなければ ParseError です。知らない event の type と、知らない item の type は無視します。item 型の `error`（致命的でないもの）も無視します。

**順序（状態：none → open → completed／failed）**

- `thread.started` は、最初の `turn.started` より前に高々 1 回だけ置けます。省略してもかまいません。2 回目や turn の後に現れたら ParseError です。
- `turn.started` を open のときに受けたら ParseError です。それ以外のときは open にし、「最後の turn の範囲」を新しく始めます。
- `turn.completed`・`turn.failed` は open のときだけ受け付け、それぞれ completed・failed にします。open 以外のときに受けたら ParseError です。
- `error` はいつでも受け付けます。状態は変えず、その時点の範囲（turn の前なら最初の範囲）へ記録します。
- item は open のときだけ text の候補にし、open の外では無視します。

**終端の判定**

| 状態 | 結果 |
|---|---|
| 最後の範囲に `error` がある | parsed、error / `stream_error`。turn が 0 件の致命的エラーや、open のまま終わった場合も含む |
| `error` がなく、turn が 0 件 | ParseError（終端がない） |
| `error` がなく、最後が open | ParseError（途中で終わった） |
| `error` がなく、最後が completed | parsed、success / null |
| `error` がなく、最後が failed | parsed、error / `reported_error` |

- text は、最後の turn の最後の agent_message です。なければ null で、success のときも null を許します。
- errors は、最後の範囲にある `turn.failed.error.message` と `error.message` を出現順に並べたものです。過去の turn の失敗は含めません。このため、過去の turn が失敗して最後の turn が成功した場合は、success で errors は `[]` になります。
- sessionId は thread_id で、無ければ null です。turns は `turn.started` の数です。usage は返しません。

##### 3.6 playwright（v1.64.1、testReporter.d.ts:267-350、json.ts）

**欄の検査**

| 位置 | 必須 | 任意 |
|---|---|---|
| 最上位 | object。`suites` は array、`errors` は array、`stats` は object で、expected・unexpected・flaky・skipped が 0 以上の安全な整数 | config・startTime・duration は捨てる |
| suite | `title: string`、`file: string`、`specs: array` | `suites`（無いか null なら `[]`） |
| spec | `title: string`、`file: string`、`tests: array`（空の array も受け付ける） | — |
| test | `status` が 4 種のどれか、`expectedStatus: string`（値は自由）、`projectName: string`、`results: array` | — |
| result | object で、`retry` が 0 以上の安全な整数 | — |
| root の errors の要素 | object | `message: string`。無いか null なら `{message:null}`。型が違えば ParseError |

**写し方**

- file は spec.file です。
- fullName は、祖先の suite のうち最上位（ファイル単位の suite）を除いた title と spec.title を、`' > '` でつないだものです。requirements は既存と同じ抽出です。
- project は projectName です。retries は results の retry の最大値で、results が空なら 0 です。
- suites が空の array でも parsed にし、`tests: []` を返します。root の errors は残します。
- **stats と tests の件数は照合しません。** 不整合があってもそのまま返します。合否の判断は P3 で行います。

**status の写し方（優先順位は test.status → expectedStatus）**

| test.status | expectedStatus | TestCaseStatus |
|---|---|---|
| `unexpected` | 何でも | `failed` |
| `skipped` | 何でも | `skipped` |
| `flaky` | 何でも | `other` |
| `expected` | `passed` | `passed` |
| `expected` | `skipped` | `skipped` |
| `expected` | それ以外（failed、timedOut、interrupted、未知の値） | `other` |

未知の expectedStatus が影響するのは `expected` の行だけです。ほかの status を上書きしません。

##### 3.7 biome（2.6.5、json.rs、reporter/mod.rs:36-131、cli_options.rs:33-40/218-244）

**欄の検査**

| 位置 | 必須 | 任意 |
|---|---|---|
| 最上位 | object。`summary` は object、`diagnostics` は array | `command` は捨てる |
| summary | errors、warnings、infos、diagnosticsNotPrinted が 0 以上の安全な整数 | ほかの欄は捨てる。duration は debug build では出ないため（mod.rs:43） |
| 診断 | object。severity が 5 種のどれか、`message: string` | `category: string`。`location`（無いか null なら file・line・column は null） |
| location | `path: string`、`start{line,column}`、`end{line,column}`。値はすべて 0 以上の安全な整数。end は検査して捨てる | — |

advices は検査せずに捨てます。

**写し方**

- start の line と column が両方 0 なら、null と null にします（ファイル単位の診断、json.rs:306-307）。
- 両方 1 以上なら、その値を返します。
- 片方だけ 0 なら ParseError です。

**全件とは保証しません。** findings は、Biome が出力の対象にした診断だけです。diagnostic level と verbose で絞り込まれます（json.rs:280-290）。summary.diagnosticsNotPrinted は値をそのまま返します。

##### 出典と保証の限界

gh・Codex・Biome・Playwright は表に示す固定版の一次資料を基にした受理契約で、実ツールの互換性や将来の版を保証しない。Claude の json の実 fixture は未観測で、2.1.308 の stream-json の result の欄の型と、版を固定していない公式 docs を基にした合成である。

#### Scenario: 5 つのツールの正常な形を変換する
- **WHEN** 各ツールの版を固定した一次資料に基づく、正常な合成 fixture を渡す
- **THEN** 決めた tool と kind の ToolObservation を返し、errors は空である

#### Scenario: gh の空の array と未知の bucket
- **WHEN** `[]`、および bucket が 5 種以外の要素を渡す
- **THEN** 空の checks、および bucket が `other` の check を返す。空の checks を合格とは扱わない

#### Scenario: Claude の終端を区別する
- **WHEN** success、`is_error:true` の success、result の欠落、`error_` で始まる subtype、未知の subtype を渡す
- **THEN** 1 つ目だけが terminal success になり、ほかは error で、cause がそれぞれ flagged_error・missing_result・reported_error・unknown_subtype になる

#### Scenario: Claude の不正な形
- **WHEN** array、result 以外の type、is_error の欠落、errors が string、num_turns が負のいずれかを渡す
- **THEN** value が null で、ParseError が 1 件になる

#### Scenario: Claude の任意の欄の欠落と null
- **WHEN** errors・session_id・num_turns が欠けているか null の success を渡す
- **THEN** errors は空の配列、sessionId と turns は null になる

#### Scenario: Codex の turn 前の致命的エラー
- **WHEN** turn.started より前に error event だけがある
- **THEN** terminal error、cause stream_error、turns 0 を返す

#### Scenario: Codex の複数の turn
- **WHEN** 失敗した turn の後に、成功した turn が続く
- **THEN** success になり、text は最後の turn の最後の agent_message、errors は空である

#### Scenario: Codex の途中終了と順序の誤り
- **WHEN** 最後の turn が開始のまま終わる、最後の行が途中で切れている、turn の外に turn.completed がある、入れ子の turn.started がある、のいずれかを渡す
- **THEN** value が null で、その行の番号を持つ ParseError になる

#### Scenario: Codex の必須 payload と未知の event
- **WHEN** usage のない turn.completed、または text のない agent_message を渡し、別の入力では未知の event の type を混ぜる
- **THEN** 前者は ParseError になり、後者は未知の event を無視して変換する

#### Scenario: Biome の位置と summary
- **WHEN** 5 種の severity、0/0 の位置、片方だけ 0 の位置、safe 整数を超える line、end の欠落、summary の欠落を渡す
- **THEN** 0/0 は file 単位の null になる。片方だけ 0・safe 整数の超過・end の欠落・summary の欠落は ParseError になる。summary の 4 つの値はそのまま返る

#### Scenario: Playwright の status の優先順位
- **WHEN** unexpected・skipped・flaky の test に未知の expectedStatus を付けたもの、および expected の test に passed・skipped・failed・未知の expectedStatus を付けたものを渡す
- **THEN** 写し方の表のとおりになり、未知の expectedStatus が影響するのは expected の test だけである

#### Scenario: Playwright の境界
- **WHEN** 空の suites、空の results、空の spec.tests、message のない root error、stats と tests の件数の不整合、深く入れ子になった suites を渡す
- **THEN** 変換に成功する。retries は 0、message は null になり、stats はそのまま返り、深い入れ子でも例外にならない

#### Scenario: Playwright の不正な retry と status
- **WHEN** retry が負または小数、または test.status が未知の値
- **THEN** ParseError になる

#### Scenario: 空の入力と解析できない入力
- **WHEN** 各 parser に、空・空白だけ・BOM だけ・JSON の構文の誤りを渡す
- **THEN** value が null で、ParseError が 1 件になる

#### Scenario: エラー文に入力が出ない
- **WHEN** 既知の秘密の形を値と key に含む不正な入力を渡す
- **THEN** ParseError の message に、その値も key も含まれない

#### Scenario: 知らない欄を捨てる
- **WHEN** 各ツールの入力に知らない欄を足す
- **THEN** 出力の key は定めた固定の名前だけである

### Requirement: 1 回の実行による収集と 5 種類の分類

`@loomake/kit` は collectToolOutput と 3 つの引数生成関数を named export する SHALL。下記の公開型・入力検査・分類・env・実行条件に従い、runExternal を shell:false・untilDeadline:true で 1 回だけ呼ぶ MUST。

Source: REQ-449

##### 規範

`@loomake/kit` は collectToolOutput・ghPrChecksArgs・biomeArgs・playwrightTestArgs を named export する SHALL。collectToolOutput は検査を通った request で、runExternal を `shell:false`・`untilDeadline:true` として 1 回だけ呼ぶ SHALL。結果は parsed・unreadable・not_found・spawn_error・limited に分け、終了コードから合否や件数を作らない MUST。非 0 の終了やシグナルによる終了でも、payload が正しければ parsed とし、終了状態を記録する SHALL。

不正な tool・command・args・timeoutMs・maxBuffer は、起動の前に、入力値を含まない UsageError にする MUST。playwright では、子へ渡す env の複製から `PLAYWRIGHT_JSON_OUTPUT_FILE`・`PLAYWRIGHT_JSON_OUTPUT_DIR`・`PLAYWRIGHT_JSON_OUTPUT_NAME` だけを外し、利用者の設定は変えない SHALL。既存の期限・共有予算・中断状態・子孫の停止を保ち、install・auth・追加の問い合わせを行わない MUST。gh の args は読み取り専用の `pr checks` だけを作る SHALL。AI ツールの args は作らない。

##### 公開契約の詳細

##### 4.1 公開する型（`packages/kit/src/collect/collect.ts`・`args.ts`）

```ts
export type CollectRequest = { tool: ToolName; command: string; args: readonly string[]; cwd?: string; env?: NodeJS.ProcessEnv; timeoutMs: number; maxBuffer?: number };
export type CollectExit = { status: number | null; signal: NodeJS.Signals | null };
export type Collected = { tool: ToolName; diagnostics: string } & (
  | { outcome: 'parsed'; exit: CollectExit; observation: ToolObservation }
  | { outcome: 'unreadable'; exit: CollectExit; reason: string }
  | { outcome: 'not_found' | 'spawn_error'; reason: string }
  | { outcome: 'limited'; kind: ProcessLimitKind; reason: string });
export function collectToolOutput(request: CollectRequest): Collected;
export function ghPrChecksArgs(pr: number, options?: { repo?: string }): string[];
export function biomeArgs(mode: 'lint' | 'ci', paths: readonly string[]): string[];
export function playwrightTestArgs(files: readonly string[]): string[];
```

`collect/` が import するのは `runtime/`（process・redact・errors）と `@loomake/core` だけです。

##### 4.2 処理の順序

1. **起動の前に検査します。** 次のどれかに当たれば、値を含めない固定文の UsageError にします。
   - tool が 5 種のどれでもない
   - command が空、または NUL を含む
   - args が string の array でないか、要素が NUL を含む
   - timeoutMs が正の有限数でない（0、負、NaN、Infinity）
   - maxBuffer が省略されておらず、正の安全な整数でもない
2. **env を用意します。** tool が playwright のときだけ、`request.env ?? process.env` の複製から 3 つの名前を外します。win32 では大文字と小文字を区別せずに一致を見て、POSIX では完全一致にします。それ以外の tool では env をそのまま渡します。
3. **`runExternal` を 1 回だけ呼びます。** オプションは `{cwd, env, timeoutMs, maxBuffer, shell:false, untilDeadline:true}` です。
4. **`ProcessLimitError` を捕捉したら `limited` にします。**
   - kind はそのまま残します。reason は、固定の見出しに `maskSecrets(e.reason)` を付けたものです（e.reason が無いときは見出しだけ）。
   - stdout は捨てます。e.stderr は diagnostics に回します。command と message は使いません。
   - 中断状態は runExternal の側で既に保たれているので、collector では複製しません。
5. **起動エラーを分けます。** `result.error` があれば、code が `ENOENT` なら `not_found`、それ以外は `spawn_error` にします。reason は固定文で、code が `/^[A-Z0-9_]+$/` に合うときだけ code を付けます。
6. **それ以外は、終了状態にかかわらず parser に渡します**（file 名は `` `${tool}:stdout` ``）。
   - errors があれば `unreadable` にします。reason は `${line}行目：${message}` に maskSecrets を掛けたものです。
   - errors がなければ `maskValue(value)` を掛けて `parsed` にします。maskValue が例外を投げたら `unreadable` にし、reason は固定文にします（Q-P2-04）。
   - exit には `{status, signal}` をそのまま入れます。
7. **ほかの例外**：runExternal が返す UsageError（固定文）はそのまま伝えます。それ以外は、cause を付けない固定文の RuntimeFailure に置き換えます。

##### 4.3 引数の関数

| 関数 | 生成する args | 入力の制限（外れたら固定文の UsageError） |
|---|---|---|
| `ghPrChecksArgs` | `['pr','checks',String(pr),'--json','name,bucket,workflow,link', ...(repo ? ['--repo',repo] : [])]` | pr は正の安全な整数。repo は `^[A-Za-z0-9-]+/[A-Za-z0-9._-]+$` に合うもの |
| `biomeArgs` | `[mode,'--reporter','json','--max-diagnostics','none',...paths]` | mode は 2 値だけ。paths は 1 件以上で、各 path は空でなく、`-` で始まらず、NUL を含まない |
| `playwrightTestArgs` | `['test','--reporter','json',...files]` | files は 0 件以上で、各要素に biome の path と同じ制限 |

- どの関数も毎回新しい array を返します。install、auth、version の問い合わせは行いません。
- command の解決は呼び出し側の責任です。Windows では `gh.exe`、または `process.execPath` と JS の CLI のパスを渡し、`.cmd` は対応しないと docs に書きます。

##### 未観測の条件

GitHub Actions 上の Biome ci mode の stdout が JSON だけであること、JSON reporter に max-diagnostics が適用されることは未確認である。JSON 以外が混ざった stdout は unreadable とし、診断の全件取得は保証しない。Claude と Codex の args は呼び出し側が組み立て、collector は 5 ツールすべてを収集対象とする。

#### Scenario: 非 0 の終了で payload が正しい
- **WHEN** 子が正しい payload を出して、非 0 で終わる
- **THEN** parsed になり、exit に status が残る

#### Scenario: gh で check が 0 件
- **WHEN** 子が stdout を空のまま、終了コード 1 で終わる
- **THEN** unreadable になり、空の checks も合格も作らない

#### Scenario: payload が正しくない
- **WHEN** 子が途中で切れた JSON を出して、0 で終わる
- **THEN** unreadable になり、exit が記録される

#### Scenario: 実行ファイルがない・起動できない
- **WHEN** 存在しない command、または実行権限のないファイルを渡す
- **THEN** それぞれ not_found、spawn_error になる

#### Scenario: 期限・出力の上限・中断
- **WHEN** 子が期限を超える、出力の上限を超える、または同じ共有予算が中断された後に呼ぶ
- **THEN** limited になり、kind がそれぞれ timeout・output・interrupted になる。中断の後は子を起動しない

#### Scenario: シグナルによる終了
- **WHEN** 子が正しい payload を出した後にシグナルで終わる
- **THEN** parsed になり、exit に signal が残る

#### Scenario: 不正な request
- **WHEN** timeoutMs が 0・負・NaN・Infinity、maxBuffer が 0 か小数、args に NUL、未知の tool を渡す
- **THEN** 子を起動せずに UsageError になり、timeout とは扱わない

#### Scenario: Playwright の env
- **WHEN** 3 つの変数と、ほかの変数を env に入れて playwright を収集する
- **THEN** 子には 3 つだけが渡らず、呼び出し側の env は変わらない

#### Scenario: 引数の関数
- **WHEN** 正しい入力と、不正な pr・repo・mode・`-` で始まる path・空の path を渡す
- **THEN** 決めた args の配列を返すか、入力値を含まない UsageError になる

### Requirement: 保存前の置換と保証の範囲

collectToolOutput は下記の保存前の置換と保証範囲に従い、返す文字列と投げる例外に既知の秘密の形を残さない MUST。stderr 全文を置換してから末尾 4096 文字を切り出し、サロゲートペアを分断しない SHALL。

Source: REQ-450

##### 規範

collectToolOutput は、observation に maskValue を掛け、stderr の全文を createDiagnosticRedactor に通してから末尾の 4096 文字を diagnostics とする MUST。limited のときは stdout を捨てる MUST。reason と例外に、command・args・生の出力・cause を含めない MUST。maskValue が失敗したときは、固定の reason を持つ unreadable とする SHALL。保証は REQ-118・REQ-199 の既知の形に限り、ツール自身が書くファイル、プロセス一覧から見える argv、findings が全件であることは保証しない。

##### 公開契約の詳細

- **stdout**：メモリ上で parse し、その結果に `maskValue` を掛けます。一時ファイルは作りません。`limited` のときは stdout を捨てます。
- **stderr**：全文を `createDiagnosticRedactor` の write と end に通します。そのあと末尾の 4096 文字を切り出します。切り出す位置が低位サロゲートなら、1 文字後ろへずらします。
- **保証する範囲**：`Collected` のすべての文字列（observation、diagnostics、reason）と、collector が投げる例外の message と cause に、REQ-118・199 の既知の形が残らないこと。command、args、生の出力は、reason にも例外にも入れません。
- **保証しない範囲**：
  - ツール自身が書くファイル（session log、trace、attachment、outputFile、キャッシュ）
  - argv の内容が OS のプロセス一覧から見えること
  - 既知の形以外の秘密
  - findings が全件そろっていること
  - これらは README の 1 節に書きます。

#### Scenario: stdout の JSON に含まれる秘密
- **WHEN** Unicode escape、escape された改行、入れ子、Bearer、PEM を含む正しい payload を収集する
- **THEN** 結果全体の JSON に既知の形が残らず、入力は変わらない

#### Scenario: stderr の境界
- **WHEN** 4096 文字の切り出し位置を PEM の BEGIN とトークンがまたぐ stderr を収集する
- **THEN** diagnostics に秘密の本文が残らず、サロゲートペアも分断されない

#### Scenario: limited のときの stdout
- **WHEN** 秘密を出した後に期限か出力の上限に達する
- **THEN** stdout はどこにも残らない

#### Scenario: 置換の失敗
- **WHEN** maskValue が例外を投げる
- **THEN** 固定の reason を持つ unreadable になり、値は残らない

#### Scenario: args の秘密
- **WHEN** args にトークンを入れて、各分類と UsageError を起こす
- **THEN** 結果にも例外の message と cause にも、そのトークンは出ない
