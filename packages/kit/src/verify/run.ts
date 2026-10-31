import { evaluateAgreement, type AgreementDecision } from './policy/agreement.js';
import { evaluateTestCoverage } from './policy/coverage-policy.js';
import { existsSync, realpathSync, rmSync, statSync } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { hasProcessBudget, holderWaitTime, ProcessLimitError, runExternal } from '../runtime/process.js';
import {
  LEDGER_STATES,
  createAgreement,
  extractTestRequirements,
  parseSpec,
  parseTasks,
  parseTrace,
  type ParseError,
  type SpecRequirement,
  type Trace,
  type VerifyCheckResult,
  type VerifyResult,
  type VerifyRunError,
  type VerifyScope,
} from '@loomake/core';
import { assembleVerifyResult } from './result.js';
import { assertChangeId, loadConfig, type LoomakeConfig } from './config.js';
import { createInputReader, JSON_LIMITS, type InputReader } from '../runtime/input.js';
import { findChangeDir, specFiles, toPosix } from '../runtime/change-files.js';

export type VerifyOptions = {
  /** プロジェクトのルート（loomake.config.json のあるディレクトリ） */
  root: string;
  /** 省略すると commands だけを実行する（REQ-042） */
  changeId?: string;
  /** --spec-only なら 'spec-only'、--done なら 'done'。changeId を省略したときは使わない */
  gate?: 'spec-only' | 'done';
  /** commands を実行せず、テストのレポートも読まない。品質コマンドの項目（完了ゲートでは要件ごとのテストも）を不足（INSUFFICIENT_EVIDENCE）にするので、終了コードは 1 になる（REQ-040） */
  skipCommands?: boolean;
  /** 進捗の表示先。--json のときも標準出力を汚さないよう、CLI は標準エラーを渡す */
  progress?: (message: string) => void;
  /** 品質コマンドの実行時間の上限（ミリ秒、すべてのコマンドの合計）。上限を過ぎたコマンドは止めて、その項目を不足にする */
  timeoutMs?: number;
  /**
   * ci = CI 必須項目を含む全条件で集約して verdict を返す。local = ローカル実施項目の完了だけを返す（verdict なし）。
   * 省略すると、完了ゲートは ci、仕様ゲートと change なしの実行は local（REQ-311）
   */
  scope?: VerifyScope;
};

// 試作の verify.mjs と同じく、出力の上限を 64MB にする
const MAX_BUFFER = 64 * 1024 * 1024;
const COMMAND_ORDER = ['lint', 'typecheck', 'test'];
/** 実行時間の上限で止めた品質コマンドの reason */
export const TIMED_OUT = '実行時間の上限に達したので止めました';
export const INTERRUPTED = '中断されたので止めました';


/**
 * verify を実行して 2.0.0 の結果を返す（REQ-311）。使い方と設定の誤りは UsageError を投げる。
 * 終了コードは verifyExitCode で決め、例外は verifyAbortedResult で aborted の結果にできる
 */
export function runVerify(options: VerifyOptions): VerifyResult {
  const { changeId, skipCommands = false, progress = () => {} } = options;
  if (changeId) assertChangeId(changeId);
  // ルートがシンボリックリンクを通るとき（macOS の /var → /private/var など）、レポートのパスは実パスのことも、リンクのままのこともある。
  // 実パスのルートで動かし、相対パスはどちらのルートの中にあるかで作る
  const givenRoot = resolve(options.root);
  const root = existsSync(givenRoot) ? realpathSync(givenRoot) : givenRoot;
  const config = loadConfig(root);
  const gate = changeId ? (options.gate ?? 'spec-only') : undefined;
  const scope: VerifyScope = options.scope ?? (gate === 'done' ? 'ci' : 'local');
  const checks: GateCheck[] = [];
  const errors: VerifyRunError[] = [];
  const record: Recorder = (check, status, detail = '') => checks.push({ check, status, detail });
  const fail: RunErrorRecorder = (check, detail) => {
    record(check, 'insufficient', detail);
    errors.push({ kind: 'runtime', target: check, message: detail, next: '原因を確かめてから、もう一度実行してください' });
  };
  const rel = (p: string) => {
    const inside = [root, givenRoot].map((base) => relative(base, p)).find((r) => r !== '..' && !r.startsWith(`..${sep}`) && !isAbsolute(r));
    return toPosix(inside ?? relative(root, p));
  };
  // 知らないキーは、打ち間違いに気づけるよう案内にする。新しい版の設定でも止まらないよう、不合格にはしない（REQ-039）
  if (config.unknownKeys.length) record('loomake.config.json', 'warn', `知らないキー：${config.unknownKeys.join('、')}（打ち間違いなら直してください）`);
  let coverage: Record<string, string[]> | undefined;

  if (!changeId) {
    runCommands(root, config, skipCommands, record, fail, progress, options.timeoutMs);
  } else {
    const spec = checkSpec(root, config, changeId, record, rel);
    if (spec && gate === 'done') {
      checkTasksAndPending(spec, record);
      // 前回のレポートで合格させないよう、commands を実行する前に消す
      const reportPath = resolve(root, config.tests.report);
      if (!skipCommands) rmSync(reportPath, { force: true });
      runCommands(root, config, skipCommands, record, fail, progress, options.timeoutMs);
      // 品質コマンドを省いたときは、前回のレポートを今回の成功の一覧に使わず、coverage を出さない（REQ-040）
      if (skipCommands) record('要件ごとのテスト', 'insufficient', REQUIREMENTS_NOT_RUN);
      else coverage = checkCoverage(root, config, spec.live, reportPath, record, rel);
    }
  }

  return assembleVerifyResult({ change: changeId ?? null, scope, checks: checks.map(toCheck), errors, coverage });
}

/** 1 つの検査の観測。warn は案内つきの合格、insufficient は証拠の不足（仮定 A-02・A-03） */
type GateCheck = { check: string; status: 'pass' | 'fail' | 'warn' | 'insufficient'; detail: string };

/** 案内つきの合格の reason の先頭（formatVerifyResult が「!」で示す） */
export const NOTICE = '案内：';

const toCheck = ({ check, status, detail }: GateCheck): VerifyCheckResult => ({
  id: check,
  result: status === 'fail' ? 'FAIL' : status === 'insufficient' ? 'INSUFFICIENT_EVIDENCE' : 'PASS',
  reason: status === 'warn' ? `${NOTICE}${detail}` : detail,
  evidence: [],
});

type Recorder = (check: string, status: GateCheck['status'], detail?: string) => void;
/** 品質コマンドを最後まで実行できなかったとき、その項目を不足にし、実行エラー（runtime）を残す */
type RunErrorRecorder = (check: string, detail: string) => void;
type SpecState = { reader: InputReader; changeDir: string; trace: Trace; live: SpecRequirement[]; decision: AgreementDecision };

const formatErrors = (errors: ParseError[]) => errors.map((e) => `${e.file}:${e.line} ${e.message}`).join('\n');

// ---------- 仕様ゲート ----------
function checkSpec(root: string, config: LoomakeConfig, changeId: string, record: Recorder, rel: (p: string) => string): SpecState | null {
  const reader = createInputReader();
  const changeDir = resolve(root, config.openspecDir, 'changes', changeId);
  if (!existsSync(changeDir) || !statSync(changeDir).isDirectory()) {
    record('change の存在', 'fail', `${rel(changeDir)} がありません。change-id を確かめてください`);
    return null;
  }
  record('change の存在', 'pass', rel(changeDir));

  for (const f of ['proposal.md', 'tasks.md', 'trace.md']) {
    record(`${f} の存在`, existsSync(join(changeDir, f)) ? 'pass' : 'fail', existsSync(join(changeDir, f)) ? '' : `${f} がありません`);
  }


  // trace.md
  const tracePath = join(changeDir, 'trace.md');
  const parsed = parseTrace('trace.md', existsSync(tracePath) ? reader.read(tracePath) : '');
  const trace = parsed.value;
  const { ledger, questions, assumptions } = trace;
  const model = createAgreement('trace.md', trace);
  const decision = evaluateAgreement(model.value);
  record('要件モデルの整合性', model.errors.length ? 'fail' : 'pass', formatErrors(model.errors));
  // 解析できなかった trace.md では未回答の確認事項を数えられないので、エラーは不合格にする
  record('trace.md の解析', parsed.errors.length ? 'fail' : 'pass', formatErrors(parsed.errors));
  if (ledger.length === 0) record('要件台帳', 'fail', 'trace.md に「## 要件台帳」の表がありません');
  else record('要件台帳', 'pass', `${ledger.length} 件`);

  const badState = ledger.filter((r) => !(LEDGER_STATES as readonly string[]).includes(r['状態']));
  if (badState.length) record('台帳の状態値', 'fail', badState.map((r) => `${r.ID}: "${r['状態']}"`).join(', '));

  const noSource = ledger.filter((r) => decision.missingSources.some((id) => id === r.ID));
  if (noSource.length) record('台帳の出典', 'fail', `出典が空：${noSource.map((r) => r.ID).join(', ')}`);

  const badBlocking = questions.filter((q) => !BLOCKING.test(q['ブロッキング']) && !NOT_BLOCKING.test(q['ブロッキング']));
  if (badBlocking.length) record('ブロッキングの値', 'fail', badBlocking.map((q) => `${q.ID}: "${q['ブロッキング']}"`).join(', '));
  // ブロッキングな確認事項（yesまたははい）
  const openBlocking = questions.filter((q) => decision.blockingQuestions.includes(q.ID));
  if (openBlocking.length) {
    record('ブロッキング確認事項', 'fail', openBlocking.map((q) => `${q.ID}（${q['関連']}）${q['質問']}`).join('\n'));
  } else {
    record('ブロッキング確認事項', 'pass', `未回答 0 件（全 ${questions.length} 件）`);
  }

  checkSharedQuestions(root, config, changeId, questions, record, reader);

  const unapproved = assumptions.filter((a) => decision.unapprovedAssumptions.includes(a.ID));
  if (unapproved.length) record('仮定の承認', 'warn', `未承認：${unapproved.map((a) => `${a.ID} ${a['仮定の内容']}`).join(' / ')}`);

  const pending = ledger.filter((r) => decision.pendingRequirements.some((id) => id === r.ID));
  if (pending.length) record('確認待ちの要件', 'warn', pending.map((r) => r.ID).join(', '));

  // specs
  const specs = specFiles(changeDir, reader);
  if (specs.length === 0) record('差分仕様', 'fail', 'specs/<capability>/spec.md がありません');
  const specErrors: ParseError[] = [];
  const reqs = specs.flatMap((f) => {
    const file = toPosix(relative(changeDir, f));
    const spec = parseSpec(file, reader.read(f));
    specErrors.push(...spec.errors);
    return spec.value.map((r) => ({ ...r, file }));
  });
  if (specs.length) record('spec.md の解析', specErrors.length ? 'fail' : 'pass', formatErrors(specErrors));

  const ledgerIds = new Set(ledger.map((r) => r.ID));
  const live = reqs.filter((r) => r.op === 'ADDED' || r.op === 'MODIFIED');

  const noSrc = reqs.filter((r) => r.op !== 'RENAMED' && r.sources.length === 0);
  record('Requirement の Source', noSrc.length ? 'fail' : 'pass', noSrc.map((r) => `${r.file}: ${r.name}`).join('\n'));

  const unknown = reqs.flatMap((r) => r.sources.filter((s) => !ledgerIds.has(s)).map((s) => `${r.name} → ${s}`));
  record('Source が台帳にある', unknown.length ? 'fail' : 'pass', unknown.join('\n'));

  const noScenario = live.filter((r) => r.scenarios === 0);
  record('Scenario の有無', noScenario.length ? 'fail' : 'pass', noScenario.map((r) => r.name).join(', '));

  // 反映済なのに、どの Requirement からも参照されていない要件
  const referenced = new Set(reqs.flatMap((r) => r.sources));
  const orphan = ledger.filter((r) => r['状態'] === '反映済' && !referenced.has(r.ID));
  record('反映済の要件が仕様にある', orphan.length ? 'fail' : 'pass', orphan.map((r) => r.ID).join(', '));

  checkOpenspecValidate(root, config, changeId, record);
  return { reader, changeDir, trace, live, decision };
}

const BLOCKING = /^(yes|はい)$/i;
const NOT_BLOCKING = /^(no|いいえ)$/i;

// 質問に「<change-id> の Q-xx と同じ質問」と書いた確認事項の回答を、参照先と比べる（add-shared-question-check の仮定 A-01・A-02）
const SHARED_MARK = /([a-z0-9]+(?:-[a-z0-9]+)*) の (Q-\d+) と同じ質問/;

function checkSharedQuestions(root: string, config: LoomakeConfig, changeId: string, questions: Trace['questions'], record: Recorder, reader: InputReader) {
  const changesDir = resolve(root, config.openspecDir, 'changes');
  const findTrace = (id: string) => {
    const dir = findChangeDir(changesDir, id, 'trace.md', reader);
    return dir && join(dir, 'trace.md');
  };
  const answer = (q: { 回答: string }) => q['回答'].trim();
  const problems: string[] = [];
  let shared = 0;
  for (const q of questions) {
    const m = q['質問'].match(SHARED_MARK);
    if (!m) continue;
    const [, otherId, otherQ] = m;
    if (otherId === changeId) continue;
    shared++;
    const path = findTrace(otherId);
    if (!path) {
      problems.push(`${q.ID}：参照先の change ${otherId} が見つかりません`);
      continue;
    }
    const other = parseTrace('trace.md', reader.read(path)).value.questions.find((o) => o.ID === otherQ);
    if (!other) problems.push(`${q.ID}：${otherId} の trace.md に ${otherQ} がありません`);
    else if (answer(other) !== answer(q)) {
      problems.push(`${q.ID}：回答が ${otherId} の ${otherQ} と違います（${changeId}：「${answer(q)}」、${otherId}：「${answer(other)}」）`);
    }
  }
  if (problems.length) record('同じ確認事項の回答', 'fail', problems.join('\n'));
  else record('同じ確認事項の回答', 'pass', shared ? `${shared} 件が参照先と一致` : 'ほかの change と同じ確認事項なし');
}

// openspec validate（REQ-037）。CLI が無いときは、openspecValidate が auto なら警告、true なら不合格にする
function checkOpenspecValidate(root: string, config: LoomakeConfig, changeId: string, record: Recorder) {
  if (config.openspecValidate === false) return;
  let r;
  try { r = runExternal('openspec', ['validate', changeId, '--strict'], {
    cwd: root,
    shell: process.platform === 'win32',
    maxBuffer: MAX_BUFFER,
  }); } catch (error) {
    if (!(error instanceof ProcessLimitError)) throw error;
    record('openspec validate', 'fail', error.message);
    return;
  }
  // Windows では shell 経由で起動するので、CLI が無いと ENOENT ではなくシェルが終了コード 1 を返す
  const missing = r.error?.code === 'ENOENT' || (process.platform === 'win32' && /is not recognized|認識されていません/.test(r.stderr));
  if (missing) {
    record('openspec validate', config.openspecValidate === 'auto' ? 'warn' : 'fail', 'OpenSpec CLI が見つかりません（npm install -g @fission-ai/openspec）');
  } else {
    record('openspec validate', r.status === 0 ? 'pass' : 'fail', r.status === 0 ? '' : `${r.stdout}${r.stderr}`.trim().slice(0, 2000));
  }
}

// ---------- 完了ゲート ----------
function checkTasksAndPending(spec: SpecState, record: Recorder) {
  // 完了時に確認待ちの要件が残っていてはいけない
  const pending = spec.trace.ledger.filter((r) => spec.decision.pendingRequirements.some((id) => id === r.ID));
  record('確認待ちが残っていない', pending.length ? 'fail' : 'pass', pending.map((r) => r.ID).join(', '));

  const tasksPath = join(spec.changeDir, 'tasks.md');
  if (existsSync(tasksPath)) {
    const tasks = parseTasks('tasks.md', spec.reader.read(tasksPath)).value;
    const open = tasks.filter((t) => !t.checked);
    // タスクが 0 件のときに「すべて完了」とすると、tasks.md を空にしたのと区別できない（fix-evaluation-findings の仮定 A-03）
    if (!tasks.length) record('tasks.md', 'fail', 'タスクがありません');
    else record('tasks.md', open.length ? 'fail' : 'pass', open.length ? open.map((t) => `- [ ] ${t.text}`).join('\n') : `${tasks.length} 件すべて完了`);
  }
}

// 要件ごとのテスト（REQ-038）。test コマンドが書き出したレポートの、成功したテストの名前にある要件 ID で判定する
function checkCoverage(
  root: string,
  config: LoomakeConfig,
  live: SpecRequirement[],
  reportPath: string,
  record: Recorder,
  rel: (p: string) => string,
): Record<string, string[]> {
  const needed = [...new Set(live.flatMap((r) => r.sources))].sort();
  let coverage = evaluateTestCoverage(needed, {});
  if (!existsSync(reportPath)) {
    record(
      '要件ごとのテスト',
      'fail',
      `テストのレポート（${config.tests.report}）がありません。test コマンドが、テストランナーの JSON レポートをこのファイルに書き出すよう設定してください`,
    );
  } else {
    const { value, errors } = extractTestRequirements(config.tests.report, createInputReader(JSON_LIMITS).read(reportPath));
    coverage = evaluateTestCoverage(needed, Object.fromEntries(Object.entries(value).map(([file, ids]) => [rel(resolve(root, file)), ids])));
    const missing = coverage.missing;
    if (errors.length) {
      record('要件ごとのテスト', 'fail', errors.map((e) => `${e.file}:${e.line} ${e.message}`).join('\n'));
    } else {
      record(
        '要件ごとのテスト',
        missing.length ? 'fail' : 'pass',
        missing.length ? `テストが無い要件：${missing.join(', ')}` : `${needed.length} 件すべてにテストあり（テストファイル ${Object.keys(value).length} 個）`,
      );
    }
  }
  return coverage.coverage;
}

// ---------- 品質コマンド ----------
// lint・typecheck・test の順に実行し、1 つ失敗しても残りを実行する
/** --skip-commands で省いたときの項目の reason */
export const COMMANDS_SKIPPED = '--skip-commands で実行していません。完了の確認には --skip-commands を付けずに実行してください';
/** --skip-commands で省いたときの「要件ごとのテスト」の reason。前回のレポートは今回の証拠にしない（REQ-040） */
export const REQUIREMENTS_NOT_RUN = '品質コマンドを実行していないので、要件ごとの成功したテストを確かめていません。--skip-commands を付けずに実行してください';

function runCommands(
  root: string, config: LoomakeConfig, skip: boolean, record: Recorder, fail: RunErrorRecorder, progress: (m: string) => void, timeoutMs?: number,
) {
  // 省いたことを証拠の不足として残し、品質コマンドを実行した合格と見分けられるようにする（REQ-191・REQ-040）
  if (skip) {
    record('品質コマンド', 'insufficient', COMMANDS_SKIPPED);
    return;
  }
  // Windows の保持役の準備を待った時間は、品質コマンドの合計の予算に含めない（REQ-257）
  const now = () => Date.now() - holderWaitTime();
  const deadline = timeoutMs === undefined ? undefined : now() + timeoutMs;
  const names = [...COMMAND_ORDER.filter((n) => n in config.commands), ...Object.keys(config.commands).filter((n) => !COMMAND_ORDER.includes(n))];
  for (const name of names) {
    const cmd = config.commands[name];
    if (!cmd) continue;
    const left = deadline === undefined ? undefined : deadline - now();
    if (left !== undefined && left <= 0) {
      fail(`command: ${name}`, TIMED_OUT);
      continue;
    }
    progress(`… ${name}: ${cmd}`);
    let r;
    try {
      r = left === undefined && !hasProcessBudget()
        ? spawnSync(cmd, { cwd: root, shell: true, encoding: 'utf8', maxBuffer: MAX_BUFFER })
        : runExternal(cmd, [], { cwd: root, shell: true, timeoutMs: left, qualityCommand: true, maxBuffer: MAX_BUFFER });
    } catch (error) {
      if (!(error instanceof ProcessLimitError)) throw error;
      const reason = error.kind === 'interrupted' ? (error.reason ? `${INTERRUPTED}（${error.reason}）` : INTERRUPTED) : error.message;
      fail(`command: ${name}`, error.kind === 'timeout' ? TIMED_OUT : reason);
      // 共有予算では後続の外部操作も起動せず拒否し、各項目に未実行の理由を残す。
      if (error.kind === 'interrupted' && !hasProcessBudget()) return;
      continue;
    }
    // spawnSync は起動に失敗すると、型に反して stdout・stderr が null になる
    const out = `${(r.stdout as string | null) ?? ''}${(r.stderr as string | null) ?? ''}`.trim();
    record(`command: ${name}`, r.status === 0 ? 'pass' : 'fail', r.status === 0 ? '' : out.split('\n').slice(-30).join('\n'));
  }
}
