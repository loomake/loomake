import { it, expect, vi } from 'vitest';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveChangeDir } from '../src/runtime/change-files.js';
import { UsageError } from '../src/runtime/errors.js';
vi.mock('node:fs', async (original) => ({ ...await original<typeof fs>(), lstatSync: vi.fn((await original<typeof fs>()).lstatSync) }));
it('[REQ-172] treats ENOENT and ENOTDIR as absent and searches the archive', () => {
  const root = fs.mkdtempSync(join(tmpdir(), 'loomake-lstat-'));
  try {
    fs.mkdirSync(join(root, 'archive', '2026-11-05-c1'), { recursive: true });
    for (const code of ['ENOENT', 'ENOTDIR']) {
      vi.mocked(fs.lstatSync).mockImplementationOnce(() => { throw Object.assign(new Error(code), { code }); });
      expect(resolveChangeDir(root, 'c1')).toEqual({ kind: 'archived', dir: join(root, 'archive', '2026-11-05-c1') });
    }
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
it('[REQ-172] preserves permission and loop errors as UsageError causes', () => {
  for (const code of ['EACCES', 'ELOOP']) {
    const cause = Object.assign(new Error(code), { code });
    vi.mocked(fs.lstatSync).mockImplementationOnce(() => { throw cause; });
    let error: unknown;
    try { resolveChangeDir('/unused', 'c1'); } catch (caught) { error = caught; }
    expect(error).toBeInstanceOf(UsageError);
    expect(error).toMatchObject({ cause, message: expect.stringContaining('c1') });
  }
});
it('[REQ-172] returns missing when an actual ancestor is a regular file', () => {
  const root = fs.mkdtempSync(join(tmpdir(), 'loomake-lstat-'));
  try { fs.writeFileSync(join(root, 'file'), ''); expect(resolveChangeDir(join(root, 'file', 'changes'), 'c1')).toEqual({ kind: 'missing', dirs: [] }); }
  finally { fs.rmSync(root, { recursive: true, force: true }); }
});
