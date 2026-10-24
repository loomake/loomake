import { describe, expect, it } from 'vitest';
import { appendFileSync, existsSync, mkdirSync, readFileSync, symlinkSync, truncateSync, writeFileSync } from 'node:fs';
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

  it('[REQ-172] JSONのテストレポートは64MiBを超えたら解析しない', () => withProject({}, (root) => {
    mkdirSync(join(root, '.loomake'));
    sparse(join(root, '.loomake/test-report.json'), 64 * 1024 * 1024 + 1);
    expect(() => runVerify({ root, changeId: 'c1', gate: 'done', skipCommands: true })).toThrow(/上限.*67108864/);
  }));

  it('[REQ-172] JSONの証拠も64MiBを超えたら報告しない', () => withProject({}, (root) => {
    const dir = join(root, '.loomake/evidence/c1'); mkdirSync(dir, { recursive: true });
    sparse(join(dir, 'large.json'), 64 * 1024 * 1024 + 1);
    expect(() => runReport({ root, changeId: 'c1', stdout: () => {} })).toThrow(/上限.*67108864/);
  }));

  it('[REQ-172] 個別には64MiB以内でも証拠の合計が128MiBを超えたら止める', () => withProject({}, (root) => {
    const dir = join(root, '.loomake/evidence/c1'); mkdirSync(dir, { recursive: true });
    const value = { schemaVersion: 1, change: 'c1', sha: 'a'.repeat(40), recordedAt: '2026-10-24T00:00:00Z', committedAt: '2026-10-24T00:00:00Z', verify: { schemaVersion: '1.0.0', change: 'c1', mode: 'done', ok: true, results: [], coverage: {} } };
    const whitespace = Buffer.alloc(45 * 1024 * 1024, ' ');
    for (const name of ['a', 'b', 'c']) {
      const file = join(dir, `${name}.json`);
      writeFileSync(file, JSON.stringify(value)); appendFileSync(file, whitespace);
    }
    expect(() => runReport({ root, changeId: 'c1', stdout: () => {} })).toThrow(/合計.*134217728/);
  }), 30_000);
});
