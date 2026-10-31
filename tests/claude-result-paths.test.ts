import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { access, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { inspectExpectedNativeFile, inspectResultCwd, inspectResultNative, inspectResultOutputPath, withResultFixtureCwd } from '../scripts/claude-result-paths.mjs';
const roots: string[] = [];
async function temp() { const root = await realpath(await mkdtemp(join(tmpdir(), 'loomake-path-control-'))); roots.push(root); return root; }
afterEach(async () => { await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))); });
const synthetic = 'synthetic native bytes';
const hash = createHash('sha256').update(synthetic).digest('hex');
const native = (prefix: string) => join(prefix, 'node_modules', '@anthropic-ai', 'claude-code-linux-arm64', 'claude');
async function fakeNative(prefix: string) { await mkdir(join(prefix, 'node_modules', '@anthropic-ai', 'claude-code-linux-arm64'), { recursive: true }); await writeFile(native(prefix), synthetic); }
async function repo(ignore = true) { const root = await temp(); execFileSync('git', ['init', '-q', root], { stdio: 'ignore' }); await mkdir(join(root, '.loomake')); await writeFile(join(root, '.gitignore'), ignore ? '.loomake/\n' : ''); return root; }

// Synthetic filesystem controls only. No CLI is spawned, no observation is qualified.
describe('P1 固定nativeのreadonly検証', () => {
  it('[REQ-340][REQ-341] 合成nativeの実bytesを逐次hashし変更しない', async () => {
    const prefix = await temp(); await fakeNative(prefix);
    expect(await inspectExpectedNativeFile(prefix, hash)).toEqual({ accepted: true, reasonCode: 'native-pin-matched' });
    expect(await readFile(native(prefix), 'utf8')).toBe(synthetic);
    expect(await inspectExpectedNativeFile(prefix, '0'.repeat(64))).toEqual({ accepted: false, reasonCode: 'native-hash-mismatch' });
  });
  it.each(['unknown', '2.1.309', '../2.1.308'])('[REQ-340][REQ-341] 未指定版を拒否する %s', async (version) => {
    expect(await inspectResultNative(await temp(), version)).toEqual({ accepted: false, reasonCode: 'native-version-invalid' });
  });
  it('[REQ-340][REQ-341] 実入口は合成hashをoverrideできず公式pin不一致で拒否する', async () => {
    const root = await temp(); const prefix = join(root, '.loomake', 'e3-cli', '2.1.308-arm64'); await fakeNative(prefix);
    expect(await inspectResultNative(root, '2.1.308')).toEqual({ accepted: false, reasonCode: 'native-hash-mismatch' });
  });
  it('[REQ-340][REQ-341] native本体と中間ディレクトリのsymlinkを拒否する', async () => {
    const prefix = await temp(); await fakeNative(prefix); const target = join(prefix, 'private_marker'); await writeFile(target, synthetic);
    await rm(native(prefix)); await symlink(target, native(prefix));
    expect(await inspectExpectedNativeFile(prefix, hash)).toEqual({ accepted: false, reasonCode: 'native-symlink' });
    await rm(join(prefix, 'node_modules'), { recursive: true }); const other = await temp(); await fakeNative(other); await symlink(join(other, 'node_modules'), join(prefix, 'node_modules'));
    expect(await inspectExpectedNativeFile(prefix, hash)).toEqual({ accepted: false, reasonCode: 'native-symlink' });
  });
  it('[REQ-340][REQ-341] 公式prefix自体のsymlinkと不正pinを拒否する', async () => {
    const root = await temp(); const other = await temp(); await fakeNative(other);
    await mkdir(join(root, '.loomake', 'e3-cli'), { recursive: true }); await symlink(other, join(root, '.loomake', 'e3-cli', '2.1.308-arm64'));
    expect(await inspectResultNative(root, '2.1.308')).toEqual({ accepted: false, reasonCode: 'native-symlink' });
    expect(await inspectExpectedNativeFile(other, 'private_marker')).toEqual({ accepted: false, reasonCode: 'native-pin-invalid' });
  });
  it('[REQ-340][REQ-341] 存在しないpathとdirectory本体を固定理由で拒否する', async () => {
    const prefix = await temp(); expect((await inspectExpectedNativeFile(prefix, hash)).accepted).toBe(false);
    await fakeNative(prefix); await rm(native(prefix)); await mkdir(native(prefix));
    expect(await inspectExpectedNativeFile(prefix, hash)).toEqual({ accepted: false, reasonCode: 'native-type-invalid' });
  });
});

describe('P2 ignored保存先のreadonly検証', () => {
  it('[REQ-340][REQ-341] ignored内部の新規子pathを検査し実際には作らない', async () => {
    const root = await repo(); expect(inspectResultOutputPath(root, '.loomake/fixtures/new')).toEqual({ accepted: true, reasonCode: 'output-path-checked' });
    await expect(access(join(root, '.loomake', 'fixtures'))).rejects.toThrow();
  });
  it.each(['../private_marker', '.loomake', '.loomake/../../private_marker'])('[REQ-340][REQ-341] 境界外と境界そのものを拒否する %s', async (output) => {
    expect(inspectResultOutputPath(await repo(), output).accepted).toBe(false);
  });
  it('[REQ-340][REQ-341] 外向きsymlinkを拒否してpathを結果へ出さない', async () => {
    const root = await repo(); const other = await temp(); await symlink(other, join(root, '.loomake', 'private_marker'));
    const result = inspectResultOutputPath(root, '.loomake/private_marker/new'); expect(result.accepted).toBe(false);
    expect(JSON.stringify(result)).not.toContain(root); expect(JSON.stringify(result)).not.toContain('private_marker');
  });
  it('[REQ-340][REQ-341] Git非除外・祖先file・不在boundaryを拒否する', async () => {
    const root = await repo(false); expect(inspectResultOutputPath(root, '.loomake/new').accepted).toBe(false);
    await writeFile(join(root, '.loomake', 'file'), synthetic); expect(inspectResultOutputPath(root, '.loomake/file/new').accepted).toBe(false);
    await rm(join(root, '.loomake'), { recursive: true }); expect(inspectResultOutputPath(root, '.loomake/new').accepted).toBe(false);
  });
});

describe('P3 owned cwdとgit外の根拠', () => {
  it('[REQ-340][REQ-341] 祖先.git不在とgitの明示的非repoを確認する', async () => {
    const root = await temp(); expect(await inspectResultCwd(root, {})).toEqual({ accepted: true, reasonCode: 'cwd-outside-git' });
  });
  it('[REQ-340][REQ-341] .git祖先とgitfileを拒否する', async () => {
    const root = await repo(); const child = join(root, 'child'); await mkdir(child);
    expect(await inspectResultCwd(child, {})).toEqual({ accepted: false, reasonCode: 'cwd-git-ancestor' });
    const other = await temp(); await writeFile(join(other, '.git'), 'private_marker');
    expect(await inspectResultCwd(other, {})).toEqual({ accepted: false, reasonCode: 'cwd-git-ancestor' });
  });
  it('[REQ-340][REQ-341] bare repositoryをgit外と読み替えない', async () => {
    const root = await temp(); execFileSync('git', ['init', '--bare', '-q', root], { stdio: 'ignore' });
    expect(await inspectResultCwd(root, {})).toEqual({ accepted: false, reasonCode: 'cwd-git-unproved' });
  });
  it('[REQ-340][REQ-341] git実行失敗の非ゼロを非repoの証明へ数えない', async () => {
    const root = await temp();
    expect(await inspectResultCwd(root, { PATH: root })).toEqual({ accepted: false, reasonCode: 'cwd-git-unproved' });
  });
  it.each(['GIT_DIR', 'GIT_WORK_TREE', 'GIT_PRIVATE_MARKER'])('[REQ-340][REQ-341] Git環境の存在を値によらず拒否する %s', async (key) => {
    const root = await temp(); const result = await inspectResultCwd(root, { [key]: 'private_marker' });
    expect(result).toEqual({ accepted: false, reasonCode: 'cwd-git-environment' }); expect(JSON.stringify(result)).not.toContain('private_marker');
  });
  it('[REQ-340][REQ-341] 固定noteだけのowned cwdを使い成功後に削除する', async () => {
    let used = '';
    const result = await withResultFixtureCwd(async (cwd: string) => { used = cwd; return await readFile(join(cwd, 'note.txt'), 'utf8'); }, { environment: {} });
    expect(result).toEqual({ accepted: true, reasonCode: 'cwd-operation-finished', value: 'Safe fixture note.\n' }); await expect(access(used)).rejects.toThrow();
  });
  it('[REQ-340][REQ-341] callbackの秘密入り例外を捨て失敗後も自己cwdを削除する', async () => {
    let used = '';
    const result = await withResultFixtureCwd(async (cwd: string) => { used = cwd; throw new Error('private_marker'); }, { environment: {} });
    expect(result).toEqual({ accepted: false, reasonCode: 'cwd-operation-failed' }); await expect(access(used)).rejects.toThrow(); expect(JSON.stringify(result)).not.toContain('private_marker');
  });
  it('[REQ-340][REQ-341] Git環境があるとoperationを呼ばない', async () => {
    let calls = 0;
    const result = await withResultFixtureCwd(async () => { calls++; }, { environment: { GIT_DIR: 'private_marker' } });
    expect(calls).toBe(0); expect(result).toEqual({ accepted: false, reasonCode: 'cwd-git-environment' });
  });
});
