import { afterEach, expect, it, vi } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
vi.mock('node:fs', async (original) => {
  const fs = await original<typeof import('node:fs')>();
  return { ...fs, unlinkSync: vi.fn(fs.unlinkSync) };
});
vi.mock('@loomake/kit', async (original) => ({ ...await original<typeof import('@loomake/kit')>(), loadVerifyQualitySchema: vi.fn(() => { throw new Error('quality schema must not load'); }) }));
import { loadVerifyQualitySchema } from '@loomake/kit';
import { main } from '../src/main.js';
const roots: string[] = [];
afterEach(() => { vi.clearAllMocks(); for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
function project() {
  const root = mkdtempSync(join(tmpdir(), 'loomake-cli-effort-')); roots.push(root);
  mkdirSync(join(root, 'openspec/changes/add-x'), { recursive: true });
  writeFileSync(join(root, 'openspec/changes/add-x/.keep'), '');
  writeFileSync(join(root, 'loomake.config.json'), JSON.stringify({ commands: { test: 'exit 99' } }));
  for (const args of [['init', '-q'], ['add', '.'], ['commit', '-qm', 'initial']]) {
    const result = spawnSync('git', ['-c', 'user.name=loomake-test', '-c', 'user.email=test@example.com', ...args], { cwd: root }); expect(result.status).toBe(0);
  }
  const out: string[] = [], err: string[] = [];
  const run = (args: string[]) => main(['trace', 'record', '--change', 'add-x', ...args], { cwd: root, stdout: (text) => out.push(text), stderr: (text) => err.push(text) });
  return { root, run, out, err };
}
it('[REQ-466] 両構文と最後の値を使い、quality schemaなしで専用記録する', async () => {
  const p = project();
  expect(await p.run(['--effort', '9m', '--effort=1.5h', '--decisions=0', '--attempts', '2', '--cost', 'actual-usd:1.25,tokens:7', '--note=確認済み'])).toBe(0);
  expect(loadVerifyQualitySchema).not.toHaveBeenCalled();
  const dir = join(p.root, '.loomake/evidence/add-x/effort');
  const files = readdirSync(dir); expect(files).toHaveLength(1);
  expect(JSON.parse(readFileSync(join(dir, files[0]), 'utf8'))).toMatchObject({ totalMinutes: 90, decisions: 0, attempts: 2, cost: [{ kind: 'actual-usd', cents: 125 }, { kind: 'tokens', count: 7 }], note: '確認済み' });
  expect(p.err).toEqual([]); expect(p.out.join('\n')).toContain('git にコミットしてください');
});
it('[REQ-466] 付帯のみ・scope併用・不正時間/回数/費用/noteは外部操作前に2を返す', async () => {
  const errors: string[] = [];
  const io = { cwd: '/a/missing/project', stdout: () => {}, stderr: (text: string) => errors.push(text) };
  for (const args of [['--decisions', '1'], ['--attempts=0'], ['--cost=tokens:1'], ['--note=x'], ['--effort=1m', '--scope=local'], ['--effort=1m', '--scope=bad'], ['--effort='], ['--effort=0.01h'], ['--effort=1m', '--decisions=-1'], ['--effort=1m', '--attempts=1.2'], ['--effort=1m', '--attempts=1e2'], ['--effort=1m', '--attempts=Infinity'], ['--effort=1m', '--decisions=9007199254740992'], ['--effort=1m', '--cost=tokens:1.5'], ['--effort=1m', '--note=a\nb']]) {
    expect(await main(['trace', 'record', '--change', 'add-x', ...args], io), args.join(' ')).toBe(2);
  }
  expect(loadVerifyQualitySchema).not.toHaveBeenCalled(); expect(errors.join('\n')).not.toContain('quality schema must not load');
});
it('[REQ-466] helpは全新オプションを示し、未知引数と位置引数を拒否する', async () => {
  const p = project(); expect(await p.run(['--help'])).toBe(0);
  for (const name of ['--effort', '--decisions', '--attempts', '--cost', '--note']) expect(p.out.join('\n')).toContain(name);
  for (const name of ['--unknown', '--decision', '--decisions-extra', '--decisions.extra']) expect(await p.run(['--effort=1m', name])).toBe(2);
  expect(await p.run(['--effort=1m', 'extra'])).toBe(2);
  const token = 'sk-' + 'a'.repeat(20);
  expect(await p.run(['--effort=1m', token])).toBe(2);
  expect(p.err.join('\n')).not.toContain(token);
  expect(p.err.join('\n')).toContain('***');
  expect(loadVerifyQualitySchema).not.toHaveBeenCalled();
});
it('[REQ-466] dirtyは1、missing/change誤りは2を維持する', async () => {
  const p = project(); writeFileSync(join(p.root, 'dirty'), ''); expect(await p.run(['--effort=0m'])).toBe(1);
  expect(await p.run(['--change=missing', '--effort=0m'])).toBe(2);
  expect(await p.run(['--change=archive', '--effort=0m'])).toBe(2);
});

it.each(['cleanup', 'stdout-first', 'stdout-second'] as const)('[REQ-466] 保存後%s失敗は3と保存済み案内を返しhelpや元の例外を表示しない', async (phase) => {
  const p = project(); const token = 'sk-' + 'a'.repeat(20);
  if (phase === 'cleanup') vi.mocked(unlinkSync).mockImplementationOnce(() => { throw new Error(token); });
  let calls = 0;
  const status = await main(['trace', 'record', '--change', 'add-x', '--effort=1m'], {
    cwd: p.root, stderr: (text) => p.err.push(text), stdout: (text) => {
      calls++; if (phase === 'stdout-first' || (phase === 'stdout-second' && calls === 2)) throw new Error(token);
      p.out.push(text);
    },
  });
  expect(status).toBe(3); expect(p.err).toHaveLength(1);
  expect(p.err[0]).toContain('実績は保存しました：.loomake/evidence/add-x/effort/');
  expect(p.err[0]).toContain('もう一度記録せず、このファイルを git にコミットしてください。');
  expect(p.err[0]).not.toMatch(/使い方|記録できません|保存できません/); expect(p.err[0]).not.toContain(token); expect(p.err[0]).not.toContain(p.root);
  const dir = join(p.root, '.loomake/evidence/add-x/effort');
  const files = readdirSync(dir); const final = files.filter((name) => name.endsWith('.json'));
  expect(final).toHaveLength(1); expect(JSON.parse(readFileSync(join(dir, final[0]), 'utf8')).totalMinutes).toBe(1);
  expect(files).toHaveLength(phase === 'cleanup' ? 2 : 1); expect(loadVerifyQualitySchema).not.toHaveBeenCalled();
});
