import { afterEach, describe, expect, it, vi } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { findProducer } from '../src/verify/quality-receipt.js';
import * as external from '../src/runtime/process.js';
import { commitAll } from './project.js';

const realVitest = dirname(createRequire(import.meta.url).resolve('vitest/package.json'));
const expected = JSON.parse(readFileSync(join(realVitest, 'package.json'), 'utf8')) as { name: string; version: string };
const producer = { name: expected.name, version: expected.version };
const roots: string[] = [];
const directory = (base = tmpdir()) => {
  const root = mkdtempSync(join(base, 'loomake-producer-'));
  roots.push(root);
  return root;
};
const child = (base: string, name: string) => {
  const path = join(base, name);
  mkdirSync(path, { recursive: true });
  return path;
};
const actualRunner = (root: string) => {
  mkdirSync(join(root, 'node_modules'), { recursive: true });
  symlinkSync(realVitest, join(root, 'node_modules', 'vitest'), 'junction');
};
// This package is used only where selecting it would be a failure.
const sentinel = (root: string, name = 'vitest') => {
  const path = child(root, `node_modules/${name}`);
  writeFileSync(join(path, 'package.json'), JSON.stringify({ name, version: '9.9.9' }));
};
const repo = (root: string) => {
  writeFileSync(join(root, '.gitignore'), 'node_modules/\n');
  commitAll(root);
};
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  for (const root of roots.splice(0).reverse()) rmSync(root, { recursive: true, force: true });
});

describe('bounded producer search', () => {
  it('[REQ-359] rejects the sentinel above a Git worktree', () => {
    const outer = directory();
    sentinel(outer);
    const root = child(outer, 'repo');
    repo(root);
    expect(findProducer(root)).toBeNull();
  });

  it('[REQ-359] finds the real runner at the inclusive Git top from a child project', () => {
    const root = directory();
    repo(root);
    actualRunner(root);
    expect(findProducer(child(root, 'packages/app'))).toEqual(producer);
  });

  it('[REQ-359] prefers the nearest runner and vitest before jest in the same directory', () => {
    const root = directory();
    repo(root);
    sentinel(root);
    const project = child(root, 'packages/app');
    actualRunner(project);
    sentinel(project, 'jest');
    expect(findProducer(project)).toEqual(producer);
  });

  it('[REQ-359] stops at a nested repository instead of using its parent repository', () => {
    const outer = directory();
    repo(outer);
    sentinel(outer);
    const nested = child(outer, 'nested');
    repo(nested);
    expect(findProducer(nested)).toBeNull();
  });

  it('[REQ-359] stops at a linked worktree instead of using the primary checkout', () => {
    const primary = directory();
    repo(primary);
    sentinel(primary);
    const worktree = join(primary, 'linked');
    const added = spawnSync('git', ['worktree', 'add', '--detach', worktree, 'HEAD'], { cwd: primary, encoding: 'utf8' });
    expect(added.status, added.stderr).toBe(0);
    expect(findProducer(worktree)).toBeNull();
  });

  it('[REQ-359] restricts a non-Git root to its own node_modules', () => {
    const outer = directory();
    sentinel(outer);
    const root = child(outer, 'plain');
    expect(findProducer(root)).toBeNull();
    actualRunner(root);
    expect(findProducer(root)).toEqual(producer);
  });

  it('[REQ-359] restricts search to root when git is unavailable', () => {
    const top = directory();
    repo(top);
    sentinel(top);
    const root = child(top, 'app');
    vi.stubEnv('PATH', '');
    expect(findProducer(root)).toBeNull();
    actualRunner(root);
    expect(findProducer(root)).toEqual(producer);
  });

  it('[REQ-359] rejects a Git top that does not contain the root', () => {
    const top = directory();
    repo(top);
    sentinel(top);
    const root = child(top, 'app');
    const different = directory();
    vi.stubEnv('GIT_DIR', join(top, '.git'));
    vi.stubEnv('GIT_WORK_TREE', different);
    expect(findProducer(root)).toBeNull();
  });

  it.each(['', 'relative/path', 'missing', 'failure', 'exception'])('[REQ-359] falls back to root for unusable Git top: %s', (kind) => {
    const top = directory();
    sentinel(top);
    const root = child(top, 'app');
    const spy = vi.spyOn(external, 'runExternal');
    if (kind === 'exception') spy.mockImplementation(() => { throw new Error('unavailable'); });
    else spy.mockReturnValue({ status: kind === 'failure' ? 1 : 0, signal: null, stdout: kind === 'missing' ? join(top, 'absent') : kind, stderr: '' });
    expect(findProducer(root)).toBeNull();
    actualRunner(root);
    expect(findProducer(root)).toEqual(producer);
  });

  it('[REQ-359] canonicalizes a linked root before walking to the Git top', () => {
    const top = directory();
    repo(top);
    actualRunner(top);
    const root = child(top, 'packages/app');
    const outside = directory();
    const link = join(outside, 'root');
    symlinkSync(root, link, 'junction');
    expect(findProducer(link)).toEqual(producer);
  });

  it('[REQ-359] accepts an in-bound runner junction to a real external package', () => {
    const root = directory();
    repo(root);
    actualRunner(root);
    expect(realpathSync.native(join(root, 'node_modules', 'vitest'))).toBe(realpathSync.native(realVitest));
    expect(findProducer(root)).toEqual(producer);
  });

  it.each(['\n', '\r\n'])('[REQ-359] preserves spaces in the Git top while removing its final line ending %j', (ending) => {
    const outer = directory();
    const top = child(outer, 'top with trailing space ');
    actualRunner(top);
    const root = child(top, 'app');
    vi.spyOn(external, 'runExternal').mockReturnValue({ status: 0, signal: null, stdout: top + ending, stderr: '' });
    expect(findProducer(root)).toEqual(producer);
  });
});
