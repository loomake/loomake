// verify のテスト用に、一時ディレクトリに change を持つプロジェクトを作る
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

export type ProjectFiles = {
  /** Optional parent for an isolated fixture; defaults to the OS temporary directory. */
  base?: string;
  /** loomake.config.json の中身。既定は OpenSpec の検証をしない、commands が空の設定 */
  config?: object;
  trace?: string;
  spec?: string;
  tasks?: string;
  /** プロジェクトのルートからのパス → 中身 */
  files?: Record<string, string>;
  /**
   * ci の完了ゲートの準備をする（REQ-319）。quality.yaml を置き、実際の Vitest を node_modules/vitest として見せ、
   * ファイルを git にコミットする。文字列なら quality.yaml の中身にする
   */
  quality?: boolean | string;
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

/** ci.test_report の必須 1 項目だけを置く quality.yaml（リポジトリ直下の quality.yaml と同じ形） */
export const QUALITY_YAML = [
  'version: 2',
  'model: iso-iec-25010-2011',
  'product:',
  '  PQ-900:',
  '    characteristic: functional_suitability',
  '    subcharacteristic: functional_correctness',
  '    blocking: true',
  '    applicability: applicable',
  '    evidence:',
  '      - source: ci.test_report',
  '        metric: required_subjects_with_failed_tests',
  '        target: "== 0"',
  '        min_samples: 1',
  '',
].join('\n');

const vitestDir = () => dirname(createRequire(import.meta.url).resolve('vitest/package.json'));

// 試験が PATH を空にしても、準備の git は読み込んだときの PATH で探す
const pathAtLoad = process.env.PATH;

/** 一時プロジェクトの git を作り、いまのファイルをすべてコミットする。対象のコミット（HEAD）を返す */
export function commitAll(root: string, message = 'fixture'): string {
  const git = (...args: string[]) => {
    const r = spawnSync('git', ['-c', 'user.name=loomake-test', '-c', 'user.email=test@example.invalid', '-c', 'commit.gpgsign=false', ...args], { cwd: root, encoding: 'utf8', env: { ...process.env, PATH: pathAtLoad } });
    if (r.status !== 0) throw new Error(`git ${args.join(' ')} に失敗しました：${r.stderr}`);
    return r.stdout.trim();
  };
  git('init', '-q');
  git('add', '-A');
  git('commit', '-qm', message, '--allow-empty');
  return git('rev-parse', 'HEAD');
}

/**
 * ci の完了ゲートの準備（REQ-319）。quality.yaml を書き、実際の Vitest のパッケージを node_modules/vitest として見せ
 * （テストランナーと版を解決できるようにする）、git にコミットする。node_modules は .gitignore で除く
 */
export function prepareCiQuality(root: string, quality: string = QUALITY_YAML): string {
  placeCiQuality(root, quality);
  writeFileSync(join(root, '.gitignore'), 'node_modules/\n.loomake/\n');
  return commitAll(root);
}

/** quality.yaml と node_modules/vitest だけを置く（コミットは呼び出し側。node_modules/ を .gitignore に入れること） */
export function placeCiQuality(root: string, quality: string = QUALITY_YAML): void {
  writeFileSync(join(root, 'quality.yaml'), quality);
  mkdirSync(join(root, 'node_modules'), { recursive: true });
  symlinkSync(vitestDir(), join(root, 'node_modules', 'vitest'), 'junction');
}

/** プロジェクトを作って fn を実行し、終わったら消す。fn が Promise を返したら、終わるのを待ってから消す */
export function withProject<T>(files: ProjectFiles, fn: (root: string) => T): T {
  const root = mkdtempSync(join(files.base ?? tmpdir(), 'loomake-kit-'));
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
    if (files.quality) prepareCiQuality(root, files.quality === true ? QUALITY_YAML : files.quality);
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
export const interruptScript = (signal: 'SIGINT' | 'SIGHUP') => `
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
process.kill(pid, '${signal}');
setTimeout(() => writeFileSync('finished.txt', ''), 15000);
`;

export const INTERRUPT_SCRIPT = interruptScript('SIGINT');

/** プロセスが動いているか */
export const alive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

/**
 * 今回の test コマンドとして、用意したレポート（report-src.json）を tests.report に書き出すコマンド。
 * verify は前回のレポートを消してから品質コマンドを実行するので、今回の実行で書き出したレポートだけが証拠になる（REQ-040）。
 * Vitest と同じく、開始時刻（startTime）がなければ書き出す時刻を入れる（REQ-319 の同じ実行の鮮度）。JSON でなければそのまま写す
 */
export const COPY_REPORT = `node -e "const f=require('fs');f.mkdirSync('.loomake',{recursive:true});let b=f.readFileSync('report-src.json');try{const j=JSON.parse(b.toString('utf8'));if(j&&typeof j==='object'&&!Array.isArray(j)&&!('startTime' in j)){j.startTime=Date.now();b=JSON.stringify(j)}}catch{}f.writeFileSync('.loomake/test-report.json',b)"`;
