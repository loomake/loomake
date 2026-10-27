import { describe, expect, it } from 'vitest';
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, symlinkSync, truncateSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfig, runVerify, UsageError } from '../packages/kit/src/index.js';
import { readDocuments, runReport } from '../packages/trace/src/index.js';
import { buildPrompt, runRun } from '../packages/runner/src/index.js';
import { prBody } from '../packages/runner/src/pr.js';
import { withProject } from '../packages/kit/test/project.js';
import { makeRepo, CHANGE } from '../packages/runner/test/helpers.js';

const tooLarge = ' '.repeat(1024 * 1024 + 1);
const directoryLink = (target: string, link: string) => symlinkSync(target, link, process.platform === 'win32' ? 'junction' : 'dir');
const changeOf = (root: string) => join(root, 'openspec/changes/c1');
const sparse = (file: string, bytes: number) => { writeFileSync(file, ''); truncateSync(file, bytes); };

describe('コマンドの入力予算', () => {
  it('[REQ-172] 設定を一括読み取りする前にサイズで拒否する', () => withProject({}, (root) => {
    sparse(join(root, 'loomake.config.json'), 1024 * 1024 + 1);
    expect(() => loadConfig(root)).toThrow(/上限.*1048576/);
  }));

  it.each(['trace.md', 'tasks.md', 'specs/x/spec.md'])('[REQ-172] verifyの%sを文書の上限で止める', (name) => withProject({}, (root) => {
    appendFileSync(join(changeOf(root), name), tooLarge);
    expect(() => runVerify({ root, changeId: 'c1', gate: name === 'tasks.md' ? 'done' : 'spec-only', skipCommands: true })).toThrow(/上限.*1048576/);
  }));

  it('[REQ-172] specsの循環リンクをverifyとtraceとpromptで同じUsageErrorにする', () => withProject({}, (root) => {
    const change = changeOf(root);
    directoryLink(join(change, 'specs'), join(change, 'specs', 'loop'));
    for (const action of [() => runVerify({ root, changeId: 'c1' }), () => readDocuments(change), () => buildPrompt(root, change, 'task')]) {
      expect(action).toThrow(UsageError);
      expect(action).toThrow('リンク');
    }
  }));

  it('[REQ-172] traceのスナップショットも文書の上限を使う', () => withProject({}, (root) => {
    appendFileSync(join(changeOf(root), 'trace.md'), tooLarge);
    expect(() => readDocuments(changeOf(root))).toThrow('上限');
  }));

  it('[REQ-172] エンジンへの指示に含むAGENTS.mdも上限を使う', () => withProject({}, (root) => {
    writeFileSync(join(root, 'AGENTS.md'), tooLarge);
    expect(() => buildPrompt(root, changeOf(root), 'task')).toThrow('上限');
  }));

  it('[REQ-172] PR本文のproposalと証拠も共通の読み取り境界を使う', () => withProject({}, (root) => {
    writeFileSync(join(root, 'evidence.json'), JSON.stringify({ verify: { ok: true, coverage: {}, results: [] } }));
    appendFileSync(join(changeOf(root), 'proposal.md'), tooLarge);
    expect(() => prBody(root, changeOf(root), 'evidence.json')).toThrow('上限');
  }));

  it('[REQ-172] 文書ごとに上限内でもverify・trace・promptの合計16MiBで止める', () => withProject({}, (root) => {
    const block = Buffer.alloc(1024 * 1024, ' ');
    for (let index = 0; index < 16; index++) {
      const dir = join(changeOf(root), 'specs', `many-${index}`); mkdirSync(dir);
      writeFileSync(join(dir, 'spec.md'), block);
    }
    for (const action of [() => runVerify({ root, changeId: 'c1' }), () => readDocuments(changeOf(root)), () => buildPrompt(root, changeOf(root), 'task')]) {
      expect(action).toThrow(/合計.*16777216/);
    }
  }));

  it('[REQ-172] PR本文の証拠JSONも64MiBの上限を使う', () => withProject({}, (root) => {
    sparse(join(root, 'evidence.json'), 64 * 1024 * 1024 + 1);
    expect(() => prBody(root, changeOf(root), 'evidence.json')).toThrow(/上限.*67108864/);
  }));

  it('[REQ-172] 過大なtasksではrunを始めずGitとエンジンを変更しない', async () => {
    const repo = makeRepo();
    try {
      const tasks = `openspec/changes/${CHANGE}/tasks.md`;
      repo.write(tasks, readFileSync(join(repo.root, tasks), 'utf8') + tooLarge);
      repo.git('add', tasks); repo.git('commit', '-q', '-m', 'large task input');
      const head = repo.git('rev-parse', 'HEAD');
      await expect(runRun({ root: repo.root, changeId: CHANGE, dryRun: true, interactive: false, confirm: async () => false, stdout: () => {}, env: repo.env, fileExists: () => false })).rejects.toThrow(UsageError);
      expect(repo.git('rev-parse', 'HEAD')).toBe(head);
      expect(repo.calls()).toEqual([]);
      expect(existsSync(join(repo.root, '.loomake/runs'))).toBe(false);
    } finally { repo.cleanup(); }
  });

  it.each(['trace.md', 'tasks.md', 'specs/x/spec.md'])('[REQ-172] 通常runでも過大な%sを開始前に拒否し、エンジンと公開を始めない', async (name) => {
    const repo = makeRepo();
    try {
      const relative = `openspec/changes/${CHANGE}/${name}`;
      repo.write(relative, readFileSync(join(repo.root, relative), 'utf8') + tooLarge);
      repo.git('add', relative); repo.git('commit', '-qm', 'oversized document');
      const before = repo.git('rev-parse', 'HEAD');
      const branches = repo.git('branch', '--list');
      const error = await runRun({ root: repo.root, changeId: CHANGE, interactive: false, confirm: async () => false, stdout: () => {}, env: repo.env, fileExists: () => false }).catch((value: unknown) => value);
      expect(error).toBeInstanceOf(UsageError);
      expect(String(error)).toContain('1048576');
      expect(String(error)).toContain(join(repo.root, relative));
      expect(repo.git('rev-parse', 'HEAD')).toBe(before);
      expect(repo.git('branch', '--list')).toBe(branches);
      expect(repo.calls()).toEqual([]);
      expect(repo.prs()).toEqual([]);
      expect(existsSync(repo.env.FAKE_GH_LOOKUP_LOG!)).toBe(false);
      expect(existsSync(join(repo.root, '.loomake/runs'))).toBe(false);
      expect(existsSync(join(repo.root, '.loomake/evidence'))).toBe(false);
      expect(repo.git('ls-remote', 'origin')).toBe('');
    } finally { repo.cleanup(); }
  });

  it('[REQ-172] JSONのテストレポートは64MiBを超えたら解析しない', () => withProject({}, (root) => {
    mkdirSync(join(root, '.loomake'));
    sparse(join(root, '.loomake/test-report.json'), 64 * 1024 * 1024 + 1);
    expect(() => runVerify({ root, changeId: 'c1', gate: 'done', skipCommands: true })).toThrow(/上限.*67108864/);
  }));

  it('[REQ-172] JSONの証拠も64MiBを超えたら報告しない', () => withProject({}, (root) => {
    const dir = join(root, '.loomake/evidence/c1'); mkdirSync(dir, { recursive: true });
    sparse(join(dir, 'large.json'), 64 * 1024 * 1024 + 1);
    const output: string[] = [];
    const report = () => {
      try { return runReport({ root, changeId: 'c1', stdout: (text) => output.push(text) }); }
      catch (error) { expect(String(error)).toContain(join(dir, 'large.json')); throw error; }
    };
    expect(report).toThrow(/上限.*67108864/);
    expect(output).toEqual([]);
  }));

  // bound-report-evidence-reading で、合計 128MiB を超えたら止める動作から変えた（Q-01 の回答 A）
  it('[REQ-171][REQ-209] 古い証拠の合計が128MiBを超えても、ファイル名の日時が最新の証拠だけを読んでレポートを出す', () => withProject({}, (root) => {
    const dir = join(root, '.loomake/evidence/c1'); mkdirSync(dir, { recursive: true });
    const value = { schemaVersion: 1, change: 'c1', sha: 'a'.repeat(40), recordedAt: '2026-10-24T00:00:00Z', committedAt: '2026-10-24T00:00:00Z', verify: { schemaVersion: '1.0.0', change: 'c1', mode: 'done', ok: true, results: [], coverage: {} } };
    const whitespace = Buffer.alloc(45 * 1024 * 1024, ' ');
    for (const name of ['a', 'b', 'c']) {
      const file = join(dir, `${name}.json`);
      writeFileSync(file, JSON.stringify(value)); appendFileSync(file, whitespace);
    }
    const out: string[] = [];
    expect(runReport({ root, changeId: 'c1', stdout: (t) => out.push(t) })).toBe(0);
    expect(out.join('\n')).toContain('# リリースレポート：c1');
  }), 30_000);

  it('[REQ-171][REQ-209] 同じ秒の証拠の合計が128MiBを超えても、先頭だけを比べて最新の証拠を選び、レポートを出す', () => withProject({}, (root) => {
    const dir = join(root, '.loomake/evidence/c1'); mkdirSync(dir, { recursive: true });
    const value = (ms: string, ok: boolean) => ({ schemaVersion: 1, change: 'c1', sha: 'a'.repeat(40), recordedAt: `2026-10-24T00:00:00.${ms}Z`, committedAt: '2026-10-24T00:00:00Z', verify: { schemaVersion: '1.0.0', change: 'c1', mode: 'done', ok, results: [], coverage: {} } });
    const whitespace = Buffer.alloc(45 * 1024 * 1024, ' ');
    // 同じ秒の 3 件。ミリ秒がいちばん新しい .900Z だけが不合格
    for (const [name, ms, ok] of [['20261024T000000Z-aaaaaaaaaaaa', '900', false], ['20261024T000000Z-bbbbbbbbbbbb', '100', true], ['20261024T000000Z-cccccccccccc', '500', true]] as const) {
      const file = join(dir, `${name}.json`);
      writeFileSync(file, JSON.stringify(value(ms, ok), null, 2)); appendFileSync(file, whitespace);
    }
    const out: string[] = [];
    expect(runReport({ root, changeId: 'c1', format: 'json', stdout: (t) => out.push(t) })).toBe(0);
    expect(JSON.parse(out.join('')).evidence).toMatchObject({ recordedAt: '2026-10-24T00:00:00.900Z', ok: false });
  }), 30_000);
});

describe('組み立てた指示の全体予算', () => {
  it('[REQ-173] 指示全体の上限ちょうどは受け付ける', () => withProject({}, (root) => {
    const change = changeOf(root);
    const baseBytes = Buffer.byteLength(buildPrompt(root, change, ''));
    const prompt = buildPrompt(root, change, 'x'.repeat(16 * 1024 * 1024 - baseBytes));
    expect(Buffer.byteLength(prompt)).toBe(16 * 1024 * 1024);
  }));

  it('[REQ-173] 対象の文字列が上限を超えたらエンジンへ渡さない', () => withProject({}, (root) => {
    expect(() => buildPrompt(root, changeOf(root), 'あ'.repeat(6 * 1024 * 1024))).toThrow(/指示.*16777216/);
  }));

  it('[REQ-173] 検証の失敗情報による指示の超過も止める', () => withProject({}, (root) => {
    expect(() => buildPrompt(root, changeOf(root), 'task', { schemaVersion: '1.0.0', mode: 'done', change: 'c1', ok: false, results: [{ check: 'test', status: 'fail', detail: 'x'.repeat(16 * 1024 * 1024) }] })).toThrow(/指示.*16777216/);
  }));
  // Issue #5。Windows の CI で不安定に落ちるため、直るまで Windows でだけ止める
  it.runIf(process.platform !== 'win32')('[REQ-173] 通常runで巨大な検証失敗を指示へ加える前に止まり、エンジンを起動しない', async () => {
    const tasks = '- [ ] 完了ゲート（REQ-012） <!-- loomake:gate=done -->\n';
    const repo = makeRepo({ tasks });
    try {
      const failureBytes = 16 * 1024 * 1024;
      repo.write('write-report.mjs', `process.stdout.write('x'.repeat(${failureBytes}), () => { process.exitCode = 1; });\n`);
      repo.git('add', 'write-report.mjs'); repo.git('commit', '-qm', 'large verification diagnostic');
      const before = repo.git('rev-parse', 'HEAD');
      for (const file of ['AGENTS.md', 'proposal.md', 'tasks.md', 'trace.md', 'specs/x/spec.md']) {
        const path = file === 'AGENTS.md' ? join(repo.root, file) : join(repo.root, 'openspec/changes', CHANGE, file);
        expect(statSync(path).size).toBeLessThanOrEqual(1024 * 1024);
      }
      const output: string[] = [];
      const code = await runRun({ root: repo.root, changeId: CHANGE, interactive: false, confirm: async () => false, stdout: (text) => output.push(text), env: repo.env, fileExists: () => false });
      expect(code).toBe(1);
      expect(output.join('\n')).toContain('エンジンへの指示の上限は16777216バイト');
      const runs = join(repo.root, '.loomake/runs');
      const directories = readdirSync(runs).filter((name) => name !== '.gitignore');
      expect(directories).toHaveLength(1);
      const run = join(runs, directories[0]);
      const verify = JSON.parse(readFileSync(join(run, '00-verify.json'), 'utf8'));
      expect(verify.results.find((result: { check: string }) => result.check === 'command: test')).toMatchObject({ status: 'fail', detail: 'x'.repeat(failureBytes) });
      expect(JSON.parse(readFileSync(join(run, 'summary.json'), 'utf8'))).toMatchObject({ status: 'stopped', doneTasks: [], remainingTasks: ['完了ゲート（REQ-012）'], reason: expect.stringContaining('指示の上限は16777216バイト') });
      expect(readFileSync(join(repo.root, 'openspec/changes', CHANGE, 'tasks.md'), 'utf8')).toBe(tasks);
      expect(repo.git('rev-parse', 'HEAD')).toBe(before);
      expect(repo.calls()).toEqual([]);
      expect(repo.prs()).toEqual([]);
      expect(existsSync(repo.env.FAKE_GH_LOOKUP_LOG!)).toBe(false);
      expect(existsSync(join(repo.root, '.loomake/evidence'))).toBe(false);
      expect(repo.git('ls-remote', 'origin')).toBe('');
    } finally { repo.cleanup(); }
  });

});
