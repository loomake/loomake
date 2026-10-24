// verify のテスト用に、一時ディレクトリに change を持つプロジェクトを作る
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

export type ProjectFiles = {
  /** loomake.config.json の中身。既定は OpenSpec の検証をしない、commands が空の設定 */
  config?: object;
  trace?: string;
  spec?: string;
  tasks?: string;
  /** プロジェクトのルートからのパス → 中身 */
  files?: Record<string, string>;
};

export const CHANGE = 'c1';

export const ledgerRow = (id: string, state = '反映済') => `| ${id} | 要件書 §1 | 機能 | 要約 | ${state} | specs/x/spec.md |`;

export function traceMd({ ledger = [ledgerRow('REQ-012')], questions = [] as string[], assumptions = [] as string[] } = {}) {
  return [
    `# Trace: ${CHANGE}`,
    '',
    '## 要件台帳',
    '',
    '| ID | 出典 | 種別 | 要約（原文に忠実に） | 状態 | 反映先 |',
    '|---|---|---|---|---|---|',
    ...ledger,
    '',
    '## 確認事項',
    '',
    '| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 |',
    '|---|---|---|---|---|---|---|',
    ...questions,
    '',
    '## 仮定',
    '',
    '| ID | 関連 | 仮定の内容 | 理由 | 承認 |',
    '|---|---|---|---|---|',
    ...assumptions,
    '',
  ].join('\n');
}

export const requirement = (name: string, { source = 'Source: REQ-012', scenario = true } = {}) =>
  [`### Requirement: ${name}`, `システムは${name}を持つ SHALL。`, '', source, '', ...(scenario ? ['#### Scenario: 確かめる', '- **WHEN** 確かめる', '- **THEN** 結果が出る', ''] : [])].join('\n');

export const specMd = (...requirements: string[]) => ['## ADDED Requirements', '', ...(requirements.length ? requirements : [requirement('検査用の振る舞い')])].join('\n');

/** プロジェクトを作って fn を実行し、終わったら消す。fn が Promise を返したら、終わるのを待ってから消す */
export function withProject<T>(files: ProjectFiles, fn: (root: string) => T): T {
  const root = mkdtempSync(join(tmpdir(), 'loomake-kit-'));
  const cleanup = () => rmSync(root, { recursive: true, force: true });
  let result: T;
  try {
    const write = (p: string, text: string) => {
      mkdirSync(dirname(join(root, p)), { recursive: true });
      writeFileSync(join(root, p), text);
    };
    const changeDir = `openspec/changes/${CHANGE}`;
    write('loomake.config.json', JSON.stringify(files.config ?? { openspecValidate: false, commands: {} }));
    write(`${changeDir}/proposal.md`, `# ${CHANGE}\n\n## Why\n検査用。\n\n## What Changes\n- 検査用\n`);
    write(`${changeDir}/tasks.md`, files.tasks ?? '## 1. 実装\n- [x] 1.1 検査用のタスク\n');
    write(`${changeDir}/trace.md`, files.trace ?? traceMd());
    write(`${changeDir}/specs/x/spec.md`, files.spec ?? specMd());
    for (const [p, text] of Object.entries(files.files ?? {})) write(p, text);
    result = fn(root);
  } catch (e) {
    cleanup();
    throw e;
  }
  if (result instanceof Promise) return result.finally(cleanup) as T;
  cleanup();
  return result;
}

/** Vitest の json レポーターの形のレポート。tests はテストファイル（ルートからのパス）→ [名前, status] */
export function reportJson(root: string, tests: Record<string, [string, string][]>) {
  return JSON.stringify({
    testResults: Object.entries(tests).map(([file, cases]) => ({
      name: join(root, file),
      assertionResults: cases.map(([fullName, status]) => ({ fullName, status })),
    })),
  });
}

const require = createRequire(import.meta.url);
const vitestBin = join(dirname(require.resolve('vitest/package.json')), 'vitest.mjs');

/** 一時プロジェクトで、Vitest を実行して JSON レポートを書き出す test コマンド。テストファイルは import なしで it・describe を使える */
export const vitestCommand = (report = '.loomake/test-report.json') =>
  `node ${JSON.stringify(vitestBin)} run --globals --reporter=json --outputFile=${report}`;

/**
 * 端末の Ctrl-C をまねる品質コマンドのスクリプト。親をたどって時間の上限の見張り役を見つけて SIGINT を送り、
 * 自分と子のプロセスの番号を pids.json に書いてから眠る。Windows 以外で使う（ps で親をたどる）
 */
export const INTERRUPT_SCRIPT = `
const { execFileSync, spawn } = require('node:child_process');
const { writeFileSync } = require('node:fs');
let pid = process.ppid;
let found = false;
for (let i = 0; i < 5 && pid > 1 && !found; i++) {
  const [ppid, ...command] = execFileSync('ps', ['-ww', '-o', 'ppid=,command=', '-p', String(pid)], { encoding: 'utf8' }).trim().split(/\\s+/);
  found = command.join(' ').includes('loomake: command');
  if (!found) pid = Number(ppid);
}
// 見張り役が見つからなければ、ほかのプロセスに SIGINT を送らずに失敗する
if (!found) throw new Error('時間の上限の見張り役が見つかりません');
const child = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 30000)'], { stdio: 'ignore' });
writeFileSync('pids.json', JSON.stringify([process.pid, child.pid]));
process.kill(pid, 'SIGINT');
setTimeout(() => writeFileSync('finished.txt', ''), 15000);
`;

/** プロセスが動いているか */
export const alive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};
