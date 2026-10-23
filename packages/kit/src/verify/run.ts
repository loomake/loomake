import { existsSync, readFileSync, readdirSync, realpathSync, rmSync, statSync } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  LEDGER_STATES,
  VERIFY_RESULT_SCHEMA_VERSION,
  extractTestRequirements,
  parseSpec,
  parseTasks,
  parseTrace,
  type ParseError,
  type SpecRequirement,
  type Trace,
  type VerifyCheckResult,
  type VerifyMode,
  type VerifyResult,
} from '@loomake/core';
import { assertChangeId, loadConfig, type LoomakeConfig } from './config.js';

export type VerifyOptions = {
  /** プロジェクトのルート（loomake.config.json のあるディレクトリ） */
  root: string;
  /** 省略すると commands だけを実行する（REQ-042） */
  changeId?: string;
  /** --spec-only なら 'spec-only'、--done なら 'done'。changeId を省略したときは使わない */
  gate?: 'spec-only' | 'done';
  /** commands を実行しない。完了ゲートでは、すでにあるテストのレポートを読む（add-verify-cli の仮定 A-06） */
  skipCommands?: boolean;
  /** 進捗の表示先。--json のときも標準出力を汚さないよう、CLI は標準エラーを渡す（仮定 A-03） */
  progress?: (message: string) => void;
  /** 品質コマンドの実行時間の上限（ミリ秒、すべてのコマンドの合計）。上限を過ぎたコマンドは止めて不合格にする（fix-review-findings-2 の仮定 A-02） */
  timeoutMs?: number;
};

// 試作の verify.mjs と同じく、出力の上限を 64MB にする
const MAX_BUFFER = 64 * 1024 * 1024;
const COMMAND_ORDER = ['lint', 'typecheck', 'test'];
// 上限つきで品質コマンドを動かす小さなスクリプト。上限を過ぎたら、シェルだけでなくその子のプロセスまで止める。
// spawnSync の timeout はシェルしか止めず、Windows ではテストのプロセスが残るため（fix-review-findings-2 の仮定 A-02）
const TIMED_OUT_STATUS = 124;
const TIMED_OUT_MARK = 'loomake: command timed out';
const KILL_TREE_ON_TIMEOUT = `
const { spawn, spawnSync } = require('node:child_process');
const [ms, cmd] = process.argv.slice(1);
const win = process.platform === 'win32';
const child = spawn(cmd, { shell: true, stdio: 'inherit', detached: !win });
const timer = setTimeout(() => {
  if (win) spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  else try { process.kill(-child.pid, 'SIGKILL'); } catch {}
  process.stderr.write('${TIMED_OUT_MARK}\\n');
  process.exit(${TIMED_OUT_STATUS});
}, Number(ms));
child.on('exit', (code) => { clearTimeout(timer); process.exit(code ?? 1); });
`;
/** 実行時間の上限で止めた品質コマンドの detail */
export const TIMED_OUT = '実行時間の上限に達したので止めました';

// node_modules・ドットで始まるディレクトリは見ない
function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const toPosix = (p: string) => p.split(sep).join('/');

/** verify を実行して結果を返す。設定の誤りは UsageError を投げる */
export function runVerify(options: VerifyOptions): VerifyResult {
  const { changeId, skipCommands = false, progress = () => {} } = options;
  if (changeId) assertChangeId(changeId);
  // ルートがシンボリックリンクを通るとき（macOS の /var → /private/var など）、レポートのパスは実パスのことも、リンクのままのこともある。
  // 実パスのルートで動かし、相対パスはどちらのルートの中にあるかで作る
  const givenRoot = resolve(options.root);
  const root = existsSync(givenRoot) ? realpathSync(givenRoot) : givenRoot;
  const config = loadConfig(root);
  const results: VerifyCheckResult[] = [];
  const record = (check: string, status: VerifyCheckResult['status'], detail = '') => results.push({ check, status, detail });
  const rel = (p: string) => {
    const inside = [root, givenRoot].map((base) => relative(base, p)).find((r) => r !== '..' && !r.startsWith(`..${sep}`) && !isAbsolute(r));
    return toPosix(inside ?? relative(root, p));
  };
  const mode: VerifyMode = changeId ? (options.gate ?? 'spec-only') : 'quality';
  let coverage: Record<string, string[]> | undefined;

  if (!changeId) {
    runCommands(root, config, skipCommands, record, progress, options.timeoutMs);
  } else {
    const spec = checkSpec(root, config, changeId, record, rel);
    if (spec && mode === 'done') {
      checkTasksAndPending(spec, record);
      // 前回のレポートで合格させないよう、commands を実行する前に消す（仮定 A-05）
      const reportPath = resolve(root, config.tests.report);
      if (!skipCommands) rmSync(reportPath, { force: true });
      runCommands(root, config, skipCommands, record, progress, options.timeoutMs);
      coverage = checkCoverage(root, config, spec.live, reportPath, record, rel);
    }
  }

  return {
    schemaVersion: VERIFY_RESULT_SCHEMA_VERSION,
    mode,
    change: changeId ?? null,
    ok: results.every((r) => r.status !== 'fail'),
    results,
    ...(coverage ? { coverage } : {}),
  };
}

type Recorder = (check: string, status: VerifyCheckResult['status'], detail?: string) => void;
type SpecState = { changeDir: string; trace: Trace; live: SpecRequirement[] };

const formatErrors = (errors: ParseError[]) => errors.map((e) => `${e.file}:${e.line} ${e.message}`).join('\n');

// ---------- 仕様ゲート ----------
function checkSpec(root: string, config: LoomakeConfig, changeId: string, record: Recorder, rel: (p: string) => string): SpecState | null {
  const changeDir = resolve(root, config.openspecDir, 'changes', changeId);
  if (!existsSync(changeDir) || !statSync(changeDir).isDirectory()) {
    record('change の存在', 'fail', `${rel(changeDir)} がありません。change-id を確かめてください`);
    return null;
  }
  record('change の存在', 'pass', rel(changeDir));

  for (const f of ['proposal.md', 'tasks.md', 'trace.md']) {
    record(`${f} の存在`, existsSync(join(changeDir, f)) ? 'pass' : 'fail', existsSync(join(changeDir, f)) ? '' : `${f} がありません`);
  }

  checkOpenspecValidate(root, config, changeId, record);

  // trace.md
  const tracePath = join(changeDir, 'trace.md');
  const parsed = parseTrace('trace.md', existsSync(tracePath) ? readFileSync(tracePath, 'utf8') : '');
  const trace = parsed.value;
  const { ledger, questions, assumptions } = trace;
  // 解析できなかった trace.md では未回答の確認事項を数えられないので、エラーは不合格にする（harden-init-and-trace-check の仮定 A-02）
  record('trace.md の解析', parsed.errors.length ? 'fail' : 'pass', formatErrors(parsed.errors));
  if (ledger.length === 0) record('要件台帳', 'fail', 'trace.md に「## 要件台帳」の表がありません');
  else record('要件台帳', 'pass', `${ledger.length} 件`);

  const badState = ledger.filter((r) => !(LEDGER_STATES as readonly string[]).includes(r['状態']));
  if (badState.length) record('台帳の状態値', 'fail', badState.map((r) => `${r.ID}: "${r['状態']}"`).join(', '));

  const noSource = ledger.filter((r) => !r['出典']);
  if (noSource.length) record('台帳の出典', 'fail', `出典が空：${noSource.map((r) => r.ID).join(', ')}`);

  // ブロッキングな確認事項（ブロッキング列が yes のもの。仮定 A-04）
  const openBlocking = questions.filter((q) => /^yes$/i.test(q['ブロッキング']) && !q['回答']);
  if (openBlocking.length) {
    record('ブロッキング確認事項', 'fail', openBlocking.map((q) => `${q.ID}（${q['関連']}）${q['質問']}`).join('\n'));
  } else {
    record('ブロッキング確認事項', 'pass', `未回答 0 件（全 ${questions.length} 件）`);
  }

  checkSharedQuestions(root, config, changeId, questions, record);

  const unapproved = assumptions.filter((a) => !a['承認']);
  if (unapproved.length) record('仮定の承認', 'warn', `未承認：${unapproved.map((a) => `${a.ID} ${a['仮定の内容']}`).join(' / ')}`);

  const pending = ledger.filter((r) => r['状態'] === '確認待ち');
  if (pending.length) record('確認待ちの要件', 'warn', pending.map((r) => r.ID).join(', '));

  // specs
  const specFiles = walk(join(changeDir, 'specs')).filter((f) => f.endsWith('spec.md'));
  if (specFiles.length === 0) record('差分仕様', 'fail', 'specs/<capability>/spec.md がありません');
  const specErrors: ParseError[] = [];
  const reqs = specFiles.flatMap((f) => {
    const file = toPosix(relative(changeDir, f));
    const spec = parseSpec(file, readFileSync(f, 'utf8'));
    specErrors.push(...spec.errors);
    return spec.value.map((r) => ({ ...r, file }));
  });
  if (specFiles.length) record('spec.md の解析', specErrors.length ? 'fail' : 'pass', formatErrors(specErrors));

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

  return { changeDir, trace, live };
}

// 質問に「<change-id> の Q-xx と同じ質問」と書いた確認事項の回答を、参照先と比べる（add-shared-question-check の仮定 A-01・A-02）
const SHARED_MARK = /([a-z0-9][a-z0-9-]*) の (Q-\d+) と同じ質問/;

function checkSharedQuestions(root: string, config: LoomakeConfig, changeId: string, questions: Trace['questions'], record: Recorder) {
  const changesDir = resolve(root, config.openspecDir, 'changes');
  const archiveDir = join(changesDir, 'archive');
  // 進行中の change を先に、なければ archive の <日付>-<change-id> を探す
  const findTrace = (id: string) => {
    const active = join(changesDir, id, 'trace.md');
    if (id !== 'archive' && existsSync(active)) return active;
    const archived = existsSync(archiveDir)
      ? readdirSync(archiveDir).filter((d) => d.replace(/^\d{4}-\d{2}-\d{2}-/, '') === id).sort().reverse()
      : [];
    return archived.map((d) => join(archiveDir, d, 'trace.md')).find((p) => existsSync(p));
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
    const other = parseTrace('trace.md', readFileSync(path, 'utf8')).value.questions.find((o) => o.ID === otherQ);
    if (!other) problems.push(`${q.ID}：${otherId} の trace.md に ${otherQ} がありません`);
    else if (answer(other) !== answer(q)) {
      problems.push(`${q.ID}：回答が ${otherId} の ${otherQ} と違います（${changeId}：「${answer(q)}」、${otherId}：「${answer(other)}」）`);
    }
  }
  if (problems.length) record('同じ確認事項の回答', 'fail', problems.join('\n'));
  else record('同じ確認事項の回答', 'pass', shared ? `${shared} 件が参照先と一致` : 'ほかの change と同じ確認事項なし');
}

// openspec validate（REQ-037）。CLI が無いときの扱いは仮定 A-01
function checkOpenspecValidate(root: string, config: LoomakeConfig, changeId: string, record: Recorder) {
  if (config.openspecValidate === false) return;
  const r = spawnSync('openspec', ['validate', changeId, '--strict'], {
    cwd: root,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    maxBuffer: MAX_BUFFER,
  });
  // Windows では shell 経由で起動するので、CLI が無いと ENOENT ではなくシェルが終了コード 1 を返す
  const missing = (r.error as NodeJS.ErrnoException | undefined)?.code === 'ENOENT' || (process.platform === 'win32' && /is not recognized|認識されていません/.test(r.stderr ?? ''));
  if (missing) {
    record('openspec validate', config.openspecValidate === 'auto' ? 'warn' : 'fail', 'OpenSpec CLI が見つかりません（npm install -g @fission-ai/openspec）');
  } else {
    record('openspec validate', r.status === 0 ? 'pass' : 'fail', r.status === 0 ? '' : `${r.stdout ?? ''}${r.stderr ?? ''}`.trim().slice(0, 2000));
  }
}

// ---------- 完了ゲート ----------
function checkTasksAndPending(spec: SpecState, record: Recorder) {
  // 完了時に確認待ちの要件が残っていてはいけない
  const pending = spec.trace.ledger.filter((r) => r['状態'] === '確認待ち');
  record('確認待ちが残っていない', pending.length ? 'fail' : 'pass', pending.map((r) => r.ID).join(', '));

  const tasksPath = join(spec.changeDir, 'tasks.md');
  if (existsSync(tasksPath)) {
    const tasks = parseTasks('tasks.md', readFileSync(tasksPath, 'utf8')).value;
    const open = tasks.filter((t) => !t.checked);
    record('tasks.md', open.length ? 'fail' : 'pass', open.length ? open.map((t) => `- [ ] ${t.text}`).join('\n') : `${tasks.length} 件すべて完了`);
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
  const covered = new Map<string, string[]>();
  if (!existsSync(reportPath)) {
    record(
      '要件ごとのテスト',
      'fail',
      `テストのレポート（${config.tests.report}）がありません。test コマンドが、テストランナーの JSON レポートをこのファイルに書き出すよう設定してください`,
    );
  } else {
    const { value, errors } = extractTestRequirements(config.tests.report, readFileSync(reportPath, 'utf8'));
    for (const [file, ids] of Object.entries(value)) {
      const name = rel(resolve(root, file));
      for (const id of ids) covered.set(id, [...(covered.get(id) ?? []), name]);
    }
    const missing = needed.filter((id) => !covered.has(id));
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
  return Object.fromEntries(needed.map((id) => [id, (covered.get(id) ?? []).sort()]));
}

// ---------- 品質コマンド ----------
// lint・typecheck・test の順に実行し、1 つ失敗しても残りを実行する（仮定 A-02）
function runCommands(root: string, config: LoomakeConfig, skip: boolean, record: Recorder, progress: (m: string) => void, timeoutMs?: number) {
  if (skip) return;
  const deadline = timeoutMs === undefined ? undefined : Date.now() + timeoutMs;
  const names = [...COMMAND_ORDER.filter((n) => n in config.commands), ...Object.keys(config.commands).filter((n) => !COMMAND_ORDER.includes(n))];
  for (const name of names) {
    const cmd = config.commands[name];
    if (!cmd) continue;
    const left = deadline === undefined ? undefined : deadline - Date.now();
    if (left !== undefined && left <= 0) {
      record(`command: ${name}`, 'fail', TIMED_OUT);
      continue;
    }
    progress(`… ${name}: ${cmd}`);
    const r =
      left === undefined
        ? spawnSync(cmd, { cwd: root, shell: true, encoding: 'utf8', maxBuffer: MAX_BUFFER })
        : spawnSync(process.execPath, ['-e', KILL_TREE_ON_TIMEOUT, String(left), cmd], { cwd: root, encoding: 'utf8', maxBuffer: MAX_BUFFER });
    if (left !== undefined && r.status === TIMED_OUT_STATUS && (r.stderr ?? '').includes(TIMED_OUT_MARK)) {
      record(`command: ${name}`, 'fail', TIMED_OUT);
      continue;
    }
    const out = `${r.stdout ?? ''}${r.stderr ?? ''}`.trim();
    record(`command: ${name}`, r.status === 0 ? 'pass' : 'fail', r.status === 0 ? '' : out.split('\n').slice(-30).join('\n'));
  }
}
