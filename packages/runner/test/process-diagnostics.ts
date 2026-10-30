import { appendFileSync, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { randomUUID } from 'node:crypto';

const LIMIT = 64 * 1024;
const RESERVE = 160;
const CASE_LABELS = new Set(['publication-retry', 'create-before', 'create-after', 'push-retry', 'repeat', 'new-source', 'json', 'sha', 'change', 'failed', 'fail-result', 'hash', 'snapshot', 'legacy', 'lookup-fail', 'lookup-invalid', 'verify-fail', 'verify-head', 'verify-branch', 'verify-dirty', 'lookup-broken-json', 'lookup-object', 'lookup-bad-url', 'lookup-credentials', 'lookup-wrong-head', 'lookup-cross-repo', 'lookup-multiple']);
const PHASES = new Set(['case-start', 'repo-ready', 'run-start', 'run-end', 'mutate-end', 'amend-end', 'cleanup-start', 'cleanup-end', 'case-end']);
type Phase = 'case-start' | 'repo-ready' | 'run-start' | 'run-end' | 'mutate-end' | 'amend-end' | 'cleanup-start' | 'cleanup-end' | 'case-end';
type Details = { n?: number; code?: number; expectedReason?: boolean; completed?: boolean };

/** 完全な行と上限到達の印を残す。診断の失敗で元の試験を変えない。 */
function appendBounded(file: string, row: object) {
  try {
    const used = existsSync(file) ? statSync(file).size : 0;
    if (used > LIMIT - RESERVE) return false;
    const line = JSON.stringify(row) + '\n';
    if (used + Buffer.byteLength(line) <= LIMIT - RESERVE) { appendFileSync(file, line); return true; }
    appendFileSync(file, JSON.stringify({ event: 'truncated', at: Date.now(), pid: process.pid }) + '\n');
  } catch { /* 計測不足として扱い、元の処理へ例外を返さない。 */ }
  return false;
}

/** case開始時に閉包を作る。並行して残ったcallbackも別caseへ混ざらない。 */
export function createCaseDiagnostics(kind = 'publication-retry') {
  const label = CASE_LABELS.has(kind) ? kind : 'publication-retry';
  const directory = process.env.LOOMAKE_EXTERNAL_TEST_DIAGNOSTIC_DIR;
  const id = `publication-retry-${process.pid}-${randomUUID()}`;
  let repo: string | undefined;
  let terminal = false;
  return {
    bind(base: string) {
      const name = basename(base);
      if (/^loomake-run-[a-zA-Z0-9_-]{1,80}$/.test(name)) repo = name;
    },
    event(event: Phase, details: Details = {}) {
      if (!directory || terminal || !PHASES.has(event)) return;
      try {
        mkdirSync(directory, { recursive: true });
        const safe: Details = {};
        for (const key of ['n', 'code'] as const) if (Number.isSafeInteger(details[key])) safe[key] = details[key];
        for (const key of ['expectedReason', 'completed'] as const) if (typeof details[key] === 'boolean') safe[key] = details[key];
        terminal = !appendBounded(join(directory, `${id}.phases.jsonl`), { event, at: Date.now(), pid: process.pid, id, label, ...(repo ? { repo } : {}), ...safe });
      } catch { /* 保存先が使えなくても元の処理を続ける。 */ }
    },
  };
}

/** 任意のローカル診断。生の引数・出力・環境値は記録しない。 */
export function attachProcessDiagnostics(base: string, env: NodeJS.ProcessEnv) {
  const directory = process.env.LOOMAKE_EXTERNAL_TEST_DIAGNOSTIC_DIR;
  if (!directory) return;
  try {
    const repo = basename(base);
    if (!/^loomake-run-[a-zA-Z0-9_-]{1,80}$/.test(repo)) return;
    mkdirSync(directory, { recursive: true });
    const preload = join(base, 'process-diagnostics.cjs');
    writeFileSync(preload, `try {
      const fs = require('node:fs');
      const path = require('node:path');
      const name = path.basename(process.argv[1] || '');
      const supervisor = name === 'supervisor.cjs';
      const fake = name === 'claude' || name === 'gh';
      if (supervisor || fake) {
        const session = require('node:crypto').randomUUID();
        const operations = new Set(['status', 'show', 'diff', 'rev-parse', 'check-ignore', 'switch', 'add', 'commit', 'push', 'init', 'remote', 'config', 'list', 'create', 'auth', 'pr']);
        let operation = fake ? name : 'other';
        let deadline;
        if (supervisor) {
          const [target, args, , observedDeadline] = JSON.parse(process.argv[2]);
          if (typeof observedDeadline === 'number' && Number.isFinite(observedDeadline)) deadline = observedDeadline;
          const command = path.basename(String(target)).replace(/\\.exe$/i, '');
          if (['git', 'gh', 'node', 'cmd', 'sh', 'bash', 'powershell'].includes(command)) operation = command;
          const unquote = value => String(value).replace(/^"(.*)"$/, '$1');
          const first = unquote(args[0]);
          const second = unquote(args[1]);
          if ((command === 'git' || command === 'gh') && operations.has(first)) operation += '-' + first;
          if (command === 'gh' && operations.has(first) && operations.has(second)) operation += '-' + second;
        } else if (name === 'gh') {
          if (operations.has(process.argv[2])) operation += '-' + process.argv[2];
          if (operations.has(process.argv[3])) operation += '-' + process.argv[3];
        }
        const file = path.join(${JSON.stringify(directory)}, ${JSON.stringify(repo)} + '.' + process.pid + '.' + session + '.processes.jsonl');
        let terminal = false;
        const event = (event, code) => {
          if (terminal) return;
          try {
            const used = fs.existsSync(file) ? fs.statSync(file).size : 0;
            if (used > ${LIMIT - RESERVE}) { terminal = true; return; }
            const row = { event, at: Date.now(), pid: process.pid, session, repo: ${JSON.stringify(repo)}, operation };
            if (Number.isSafeInteger(code)) row.code = code;
            if (supervisor && deadline !== undefined) {
              const remainingMs = deadline - Number(process.hrtime.bigint()) / 1000000;
              if (Number.isFinite(remainingMs)) row.remainingMs = remainingMs;
            }
            const line = JSON.stringify(row) + '\\n';
            if (used + Buffer.byteLength(line) <= ${LIMIT - RESERVE}) fs.appendFileSync(file, line);
            else {
              terminal = true;
              fs.appendFileSync(file, JSON.stringify({ event: 'truncated', at: Date.now(), pid: process.pid, session }) + '\\n');
            }
          } catch { terminal = true; /* 診断だけを欠損させる。 */ }
        };
        event(supervisor ? 'supervisor-entry' : 'fake-cli-entry');
        process.on('exit', code => event(supervisor ? 'supervisor-exit' : 'fake-cli-exit', code));
      }
    } catch { /* preloadの診断失敗を対象プロセスへ返さない。 */ }\n`);
    env.NODE_OPTIONS = `${env.NODE_OPTIONS ?? ''} --require=${JSON.stringify(preload)}`.trim();
  } catch { /* 診断の準備失敗で元の試験を止めない。 */ }
}
