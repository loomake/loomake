import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { runRun } from '@loomake/runner';
import { CHANGE, makeRepo, noChange, type Repo } from './helpers.js';
import { git } from '../src/git.js';
import { createCaseDiagnostics } from './process-diagnostics.js';

vi.mock('../src/git.js', async (original) => {
  const actual = await original<typeof import('../src/git.js')>();
  return { ...actual, git: vi.fn(actual.git) };
});
beforeEach(() => { vi.mocked(git).mockClear(); });

function beginRetryPushCheck() {
  expect(vi.mocked(git).mock.calls.some(([, , args]) => args[0] === 'push')).toBe(true);
  vi.mocked(git).mockClear();
}
function expectNoPush() {
  expect(vi.mocked(git).mock.calls.filter(([, , args]) => args[0] === 'push')).toEqual([]);
}


vi.setConfig({ testTimeout: 60_000 });

const diagnostics = new WeakMap<Repo, { phase: ReturnType<typeof createCaseDiagnostics>; n: number }>();

async function run(repo: Repo) {
  const context = diagnostics.get(repo);
  const n = context ? ++context.n : 0;
  context?.phase.event('run-start', { n });
  const out: string[] = [];
  const code = await runRun({ root: repo.root, changeId: CHANGE, interactive: false, confirm: async () => false, stdout: (text) => out.push(text), env: repo.env, fileExists: () => false });
  context?.phase.event('run-end', { n, code, expectedReason: out.some((text) => text.includes('作成前に失敗')) });
  return { code, stdout: out.join('\n') };
}
async function withRepo(label: string, action: (repo: Repo) => Promise<void>) {
  const phase = createCaseDiagnostics(label);
  phase.event('case-start');
  const repo = makeRepo({ run: { maxFixes: 1 } });
  phase.bind(repo.base);
  diagnostics.set(repo, { phase, n: 0 });
  phase.event('repo-ready');
  let completed = false;
  try {
    repo.plan([{ write: { 'impl.txt': '実装\n' } }, noChange]);
    await action(repo);
    completed = true;
  } finally {
    phase.event('cleanup-start');
    let cleaned = false;
    try { repo.cleanup(); cleaned = true; phase.event('cleanup-end'); }
    finally { phase.event('case-end', { completed: completed && cleaned }); }
  }
}
const files = (repo: Repo) => readdirSync(join(repo.root, '.loomake/evidence', CHANGE));
const evidence = (repo: Repo) => `.loomake/evidence/${CHANGE}/${files(repo)[0]}`;
const lookupCount = (repo: Repo) => readFileSync(repo.env.FAKE_GH_LOOKUP_LOG!, 'utf8').trim().split('\n').length;
const row = { url: 'https://github.com/example/repo/pull/1', baseRefName: 'main', headRefName: 'loomake/c1', isCrossRepository: false };

describe('証拠とPRの再試行', () => {
  it.each(['before', 'after'])('[REQ-164][REQ-165] 作成の%sで失敗した後も同じ証拠とコミットを使う', (failure) => withRepo(failure === 'before' ? 'create-before' : 'create-after', async (repo) => {
    repo.env.FAKE_GH_CREATE = failure;
    expect((await run(repo)).code).toBe(1);
    const head = repo.git('rev-parse', 'HEAD');
    const saved = readFileSync(join(repo.root, evidence(repo)), 'utf8');
    delete repo.env.FAKE_GH_CREATE;
    const second = await run(repo);
    expect(second.code, second.stdout).toBe(0);
    expect(repo.git('rev-parse', 'HEAD')).toBe(head);
    expect(files(repo)).toHaveLength(1);
    expect(readFileSync(join(repo.root, evidence(repo)), 'utf8')).toBe(saved);
    expect(repo.calls()).toHaveLength(2);
    expect(repo.prs()).toHaveLength(failure === 'after' ? 1 : 2);
    if (failure === 'after') expect(second.stdout).toContain('既存のPR');
  }));

  it('[REQ-164] push失敗後に同じ証拠を再利用して送信する', () => withRepo('push-retry', async (repo) => {
    repo.git('remote', 'set-url', '--push', 'origin', join(repo.base, 'missing.git'));
    expect((await run(repo)).code).toBe(1);
    const head = repo.git('rev-parse', 'HEAD');
    expect(repo.prs()).toEqual([]);
    repo.git('remote', 'set-url', '--push', 'origin', join(repo.base, 'origin.git'));
    const retry = await run(repo);
    expect(retry.code, retry.stdout).toBe(0);
    expect(repo.git('rev-parse', 'HEAD')).toBe(head);
    expect(files(repo)).toHaveLength(1);
  }));

  it('[REQ-164][REQ-165] 完了後も再実行で証拠・コミット・PRを増やさない', () => withRepo('repeat', async (repo) => {
    expect((await run(repo)).code).toBe(0);
    const head = repo.git('rev-parse', 'HEAD');
    const retry = await run(repo);
    expect(retry.code, retry.stdout).toBe(0);
    expect(retry.stdout).toContain('既存のPR');
    expect(repo.git('rev-parse', 'HEAD')).toBe(head);
    expect(files(repo)).toHaveLength(1);
    expect(repo.prs()).toHaveLength(1);
    expect(lookupCount(repo)).toBe(2);
  }));

  it('[REQ-164] 証拠の後に実装を変えたら新しい対象SHAの証拠を作る', () => withRepo('new-source', async (repo) => {
    repo.env.FAKE_GH_CREATE = 'before';
    expect((await run(repo)).code).toBe(1);
    const old = evidence(repo);
    const oldContent = readFileSync(join(repo.root, old), 'utf8');
    repo.write('impl.txt', '変更した実装\n');
    repo.git('add', 'impl.txt'); repo.git('commit', '-q', '-m', 'change implementation');
    const changed = repo.git('rev-parse', 'HEAD');
    delete repo.env.FAKE_GH_CREATE;
    expect((await run(repo)).code).toBe(0);
    expect(files(repo)).toHaveLength(2);
    const latest = files(repo).find((name) => !old.endsWith(name))!;
    expect(JSON.parse(readFileSync(join(repo.root, '.loomake/evidence', CHANGE, latest), 'utf8')).sha).toBe(changed);
    expect(readFileSync(join(repo.root, old), 'utf8')).toBe(oldContent);
  }));
});

describe('不正な証拠候補を保護する', () => {
  it.each(['json', 'sha', 'change', 'failed', 'fail-result', 'hash', 'snapshot', 'legacy'])('[REQ-164] %sの証拠は消さず増やさず停止する', (kind) => withRepo(kind, async (repo) => {
    repo.env.FAKE_GH_CREATE = 'before';
    expect((await run(repo)).code).toBe(1);
    const path = evidence(repo);
    const value = JSON.parse(readFileSync(join(repo.root, path), 'utf8'));
    if (kind === 'sha') value.sha = '0'.repeat(40);
    if (kind === 'change') value.change = 'other';
    if (kind === 'failed') value.verify.ok = false;
    if (kind === 'fail-result') value.verify.results[0].status = 'fail';
    if (kind === 'hash') value.documents[0].sha256 = '0'.repeat(64);
    if (kind === 'snapshot') {
      value.documents[0].content += '\n違う文書\n';
      value.documents[0].sha256 = createHash('sha256').update(value.documents[0].content).digest('hex');
    }
    if (kind === 'legacy') delete value.documents;
    const content = kind === 'json' ? 'broken json' : JSON.stringify(value);
    repo.write(path, content);
    diagnostics.get(repo)?.phase.event('mutate-end');
    repo.git('add', path); repo.git('commit', '--amend', '--no-edit', '-q');
    diagnostics.get(repo)?.phase.event('amend-end');
    const head = repo.git('rev-parse', 'HEAD');
    delete repo.env.FAKE_GH_CREATE;
    const retry = await run(repo);
    expect(retry.code, retry.stdout).toBe(1);
    expect(retry.stdout).toContain('証拠');
    expect(repo.git('rev-parse', 'HEAD')).toBe(head);
    expect(readFileSync(join(repo.root, path), 'utf8')).toBe(content);
    expect(files(repo)).toHaveLength(1);
    expect(repo.prs()).toHaveLength(1);
  }));
});

describe('検索を確認できないときは新規作成しない', () => {
  it.each(['fail', 'broken', '{}', JSON.stringify([{ ...row, url: 'javascript:bad' }]), JSON.stringify([{ ...row, url: 'https://user:password@example.com/a/pull/1' }]), JSON.stringify([{ ...row, headRefName: 'other' }]), JSON.stringify([{ ...row, isCrossRepository: true }]), JSON.stringify([row, row])])('[REQ-165] 検索結果 %s で停止して証拠を残す', (value) => withRepo(value === 'fail' ? 'lookup-fail' : 'lookup-invalid', async (repo) => {
    if (value === 'fail') repo.env.FAKE_GH_LOOKUP = 'fail';
    else repo.env.FAKE_GH_RESULT = value;
    const result = await run(repo);
    expect(result.code, result.stdout).toBe(1);
    expect(repo.prs()).toEqual([]);
    expect(files(repo)).toHaveLength(1);
  }));
});

function qualitySwitch(repo: Repo, code: string) {
  const script = readFileSync(join(repo.root, 'write-report.mjs'), 'utf8');
  repo.write('write-report.mjs', `import { spawnSync } from 'node:child_process';\n${script}\nif (existsSync('.loomake/quality-switch')) { ${code} }\n`);
  repo.write('.gitignore', readFileSync(join(repo.root, '.gitignore'), 'utf8') + '.loomake/quality-switch\n');
  repo.git('add', 'write-report.mjs', '.gitignore');
  repo.git('commit', '-q', '-m', 'set up quality command failure');
}

describe('再試行の再検証と状態保護', () => {
  it('[REQ-166] 今回の検証に不合格なら過去の証拠を代用しない', () => withRepo('verify-fail', async (repo) => {
    qualitySwitch(repo, "writeFileSync('.loomake/test-report.json', JSON.stringify({ numTotalTests: 0, numPassedTests: 0, numFailedTests: 0, numPendingTests: 0, testResults: [] }));");
    repo.env.FAKE_GH_CREATE = 'before';
    expect((await run(repo)).code).toBe(1);
    const head = repo.git('rev-parse', 'HEAD');
    const lookups = lookupCount(repo);
    repo.write('.loomake/quality-switch', 'fail');
    beginRetryPushCheck();
    delete repo.env.FAKE_GH_CREATE;
    expect((await run(repo)).code).toBe(1);
    expect(repo.git('rev-parse', 'HEAD')).toBe(head);
    expect(lookupCount(repo)).toBe(lookups);
    expectNoPush();
    expect(repo.prs()).toHaveLength(1);
    expect(files(repo)).toHaveLength(1);
  }));

  it.each([
    ['HEAD', "spawnSync('git', ['update-ref', 'HEAD', 'HEAD^']);"],
    ['ブランチ', "spawnSync('git', ['switch', '-q', '-c', 'changed-by-quality']);"],
  ])('[REQ-166] 検証が%sを変えたら取り消さず外部操作を止める', (label, command) => withRepo(label === 'HEAD' ? 'verify-head' : 'verify-branch', async (repo) => {
    qualitySwitch(repo, command);
    repo.env.FAKE_GH_CREATE = 'before';
    expect((await run(repo)).code).toBe(1);
    const lookups = lookupCount(repo);
    const head = repo.git('rev-parse', 'HEAD');
    repo.write('.loomake/quality-switch', 'move');
    beginRetryPushCheck();
    delete repo.env.FAKE_GH_CREATE;
    const retry = await run(repo);
    expect(retry.code, retry.stdout).toBe(1);
    expect(retry.stdout).toContain('検証のあいだにHEADかブランチ');
    if (label === 'HEAD') expect(repo.git('rev-parse', 'HEAD')).toBe(repo.git('rev-parse', `${head}^`));
    else expect(repo.git('branch', '--show-current')).toBe('changed-by-quality');
    expect(lookupCount(repo)).toBe(lookups);
    expectNoPush();
    expect(repo.prs()).toHaveLength(1);
    expect(files(repo)).toHaveLength(1);
  }));

  it('[REQ-166] 検証が作業ファイルを変えたら、その変更を残して停止する', () => withRepo('verify-dirty', async (repo) => {
    qualitySwitch(repo, "writeFileSync('impl.txt', '検証が残した変更');");
    repo.env.FAKE_GH_CREATE = 'before';
    expect((await run(repo)).code).toBe(1);
    const head = repo.git('rev-parse', 'HEAD');
    const lookups = lookupCount(repo);
    repo.write('.loomake/quality-switch', 'dirty');
    beginRetryPushCheck();
    delete repo.env.FAKE_GH_CREATE;
    const retry = await run(repo);
    expect(retry.code, retry.stdout).toBe(1);
    expect(retry.stdout).toContain('未コミットの変更');
    expect(readFileSync(join(repo.root, 'impl.txt'), 'utf8')).toBe('検証が残した変更');
    expect(repo.git('rev-parse', 'HEAD')).toBe(head);
    expect(lookupCount(repo)).toBe(lookups);
    expectNoPush();
    expect(repo.prs()).toHaveLength(1);
    expect(files(repo)).toHaveLength(1);
  }));
});
