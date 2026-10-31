import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { chmodSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { StringDecoder } from 'node:string_decoder';
import { ProcessLimitError, UsageError, withProcessBudget } from '@loomake/kit';
import { chargedOutputBytes, findViolationsWithLimits, groupPaths, splitStagedPatch, stagedDisplayDiff } from '../src/guards.js';
import { git, gitMeasured, GitError } from '../src/git.js';
import { makeRepo, type Repo } from './helpers.js';

vi.setConfig({ testTimeout: 60_000 });
vi.mock('../src/git.js', async (original) => {
  const actual = await original<typeof import('../src/git.js')>();
  return { ...actual, git: vi.fn(actual.git), gitMeasured: vi.fn(actual.gitMeasured) };
});
const actual = await vi.importActual<typeof import('../src/git.js')>('../src/git.js');
const repos: Repo[] = [];
beforeEach(() => { vi.mocked(git).mockReset().mockImplementation(actual.git); vi.mocked(gitMeasured).mockReset().mockImplementation(actual.gitMeasured); });
afterEach(() => { for (const repo of repos.splice(0)) repo.cleanup(); });
function repo() { const result = makeRepo(); repos.push(result); result.git('config', 'core.autocrlf', 'false'); return result; }
function stage(r: Repo) { r.git('add', '-A'); }
function commit(r: Repo) { stage(r); r.git('commit', '-qm', 'synthetic preparation'); }
function raw(r: Repo, args: string[]) {
  const result = spawnSync('git', args, { cwd: r.root, env: r.env, encoding: 'utf8' });
  if (result.status !== 0) throw new Error('synthetic Git fixture failed');
  return result.stdout;
}
const options = ['--no-renames', '--no-color', '--no-ext-diff', '--submodule=short', '--src-prefix=a/', '--dst-prefix=b/'];
function codes(r: Repo) {
  const status = raw(r, ['diff', '--cached', '--name-status', '--no-renames', '-z']).split('\0');
  const map = new Map<string, string>(); for (let i = 0; i + 1 < status.length; i += 2) map.set(status[i + 1], status[i]); return map;
}
function patch(file = 'a', value = 'new') { return `diff --git a/${file} b/${file}\nindex 123..456 100644\n--- a/${file}\n+++ b/${file}\n@@ -1 +1 @@\n-old\n+${value}\n`; }

describe('群の完全性と予算の直接検査', () => {
  it.each(['missing-terminal', 'missing-path', 'incomplete-pair', 'duplicate-decoded-path'])('[REQ-137][REQ-138] name-statusの%sをMapへ上書きしない', (variant) => {
    const r = repo(); const file = 'tests/\ufffd.test.ts'; r.write(file, 'before\n'); commit(r); r.write(file, "it.skip('synthetic',()=>{});\n");
    const malformed: Record<string, string> = {
      'missing-terminal': `M\0${file}`,
      'missing-path': 'M\0\0',
      'incomplete-pair': `M\0${file}\0M\0`,
      'duplicate-decoded-path': `M\0${file}\0M\0${file}\0`,
    };
    vi.mocked(git).mockImplementation((root, env, args, limits) => args.includes('--name-status') ? malformed[variant] : actual.git(root, env, args, limits));
    expect(() => findViolationsWithLimits(r.root, r.env)).toThrow(GitError);
    expect(gitMeasured).not.toHaveBeenCalled();
  });
  it('[REQ-137] 空name-statusは正規の変更なしとして許可する', () => {
    const r = repo(); expect(findViolationsWithLimits(r.root, r.env)).toEqual({ findings: [], diff: '' });
    expect(gitMeasured).not.toHaveBeenCalled();
  });
  it('[REQ-180] greedy丸めの反例とsingle-overを落とさず独立上限を守る', () => {
    const paths = ['aaa', 'bbb', 'ccc']; // weight6 each; ceil18/10=2 is not an upper bound.
    expect(groupPaths(paths, 10)).toEqual(paths.map((path) => [path]));
    expect(groupPaths(['x'.repeat(20), 'a'], 10)).toEqual([['x'.repeat(20)], ['a']]);
    for (let cap = 4; cap <= 20; cap++) {
      const weights = paths.map((path) => JSON.stringify(path).length + 1);
      expect(groupPaths(paths, cap).length).toBeLessThanOrEqual(Math.min(paths.length, Math.ceil(2 * weights.reduce((a, b) => a + b, 0) / cap)));
    }
  });
  it.each([
    ['missing', ''], ['header only', 'diff --git a/a b/a\n'], ['preamble', 'garbage\n' + patch()],
    ['unknown path', patch('unknown')], ['cut line', patch().slice(0, -1)],
    ['missing hunk lines', patch().replace('@@ -1 +1 @@', '@@ -1,2 +1,2 @@')],
    ['extra hunk lines', patch() + '+extra\n'], ['metadata after hunk', patch() + 'new file mode 100644\n'],
    ['cut next hunk', patch() + '@@ -3 +3 @@\n-old\n'], ['invalid hunk', patch().replace('@@ -1 +1 @@', '@@ invalid @@')],
    ['unknown metadata', patch().replace('index 123..456 100644', 'untrusted metadata')],
  ])('[REQ-137] %sをheader数だけで成功にしない', (_, text) => {
    expect(() => splitStagedPatch(text, ['a'], new Map([['a', 'M']]))).toThrow(GitError);
  });
  it('[REQ-137] Tの片側欠落と不正UTF8のquoted pathを拒否する', () => {
    expect(() => splitStagedPatch(patch(), ['a'], new Map([['a', 'T']]))).toThrow(GitError);
    const quoted = patch().replace('a/a b/a', '"a/\\377" "b/\\377"');
    expect(() => splitStagedPatch(quoted, ['\ufffd'], new Map([['\ufffd', 'M']]))).toThrow(GitError);
  });
  it('[REQ-137] hunkを完結させた複数区間と改行なしmarkerは保存する', () => {
    const text = patch().replace('-old\n+new\n', '-old\n\\ No newline at end of file\n+new\n\\ No newline at end of file\n') + '@@ -3 +3 @@\n-x\n+y\n';
    expect(splitStagedPatch(text, ['a'], new Map([['a', 'M']])).byPath.get('a')).toEqual([text]);
  });
  it('[REQ-180] UTF8 prefixの最大3byte保留を含めて安全側へ課金する', () => {
    const values = [Buffer.from('ascii'), Buffer.from('é€😀'), Buffer.from([0xff, 0xc3]), Buffer.from('a\ufffdb')];
    const prefix = (text: string, room: number) => new StringDecoder('utf8').write(Buffer.from(text).subarray(0, room));
    for (const stdout of values) for (const stderr of values) for (let room = 1; room <= 30; room++) {
      const out = prefix(stdout.toString('utf8'), room); const err = prefix(stderr.toString('utf8'), room - Buffer.byteLength(out));
      const returned = Buffer.byteLength(out) + Buffer.byteLength(err);
      expect(chargedOutputBytes(returned, room)).toBeGreaterThanOrEqual(Math.min(room, stdout.length + stderr.length));
      expect(chargedOutputBytes(returned, room)).toBeLessThanOrEqual(room);
    }
    expect(chargedOutputBytes(96, 100)).toBe(96);
    expect(chargedOutputBytes(97, 100)).toBe(100);
    expect(chargedOutputBytes(100, 100)).toBe(100);
  });
  it('[REQ-180][REQ-112] 予算ゼロの次群は起動せずUsageErrorにしない', () => {
    const text = patch(); const limit = Buffer.byteLength(text) + 10;
    vi.mocked(gitMeasured).mockReturnValue({ stdout: text, bytes: limit, hasReplacementCharacter: false });
    const action = () => stagedDisplayDiff('', {}, ['a', 'b'], new Map([['a', 'M'], ['b', 'M']]), { maxPathspecChars: 1, maxOutputBytes: limit });
    let failure: unknown;
    try { action(); } catch (error) { failure = error; }
    expect(failure).toBeInstanceOf(ProcessLimitError); expect(failure).not.toBeInstanceOf(UsageError);
    expect(failure).toMatchObject({ kind: 'output' }); expect(gitMeasured).toHaveBeenCalledTimes(1);
  });
  it('[REQ-180][REQ-112] 正常UTF8の最後群は境界ぴったりでも完全な本文を返す', () => {
    const text = patch('a', '日本語😀'); const limit = Buffer.byteLength(text);
    vi.mocked(gitMeasured).mockReturnValue({ stdout: text, bytes: limit, hasReplacementCharacter: false });
    expect(stagedDisplayDiff('', {}, ['a'], new Map([['a', 'M']]), { maxPathspecChars: 8192, maxOutputBytes: limit })).toBe(text);
  });
  it('[REQ-180][REQ-137] 完全なprefixの後hunkがclipで消えた可能性を成功にしない', () => {
    const prefix = patch('a', '\ufffd'.repeat(64)); const limit = Buffer.byteLength(prefix);
    const [before, after] = prefix.split('\ufffd'.repeat(64));
    const wire = Buffer.concat([Buffer.from(before), Buffer.alloc(64, 0xff), Buffer.from(after + '@@ -3 +3 @@\n-x\n+y\n')]);
    expect(wire.length).toBeLessThanOrEqual(limit);
    const clipped = new StringDecoder('utf8').write(Buffer.from(wire.toString('utf8')).subarray(0, limit));
    expect(clipped).toBe(prefix);
    // Header and hunk counts alone accept this prefix, even though the second hunk was lost during decoding/prefixing.
    expect(splitStagedPatch(prefix, ['a'], new Map([['a', 'M']])).ordered).toHaveLength(1);
    vi.mocked(gitMeasured).mockReturnValue({ stdout: clipped, bytes: limit, hasReplacementCharacter: true });
    expect(() => stagedDisplayDiff('', {}, ['a'], new Map([['a', 'M']]), { maxPathspecChars: 8192, maxOutputBytes: limit })).toThrow('上限近傍で差分の完全性を確認できない');
    expect(gitMeasured).toHaveBeenCalledTimes(1);
  });
  it('[REQ-180][REQ-137] replacementが全落ちする極小roomの空patchを通さない', () => {
    vi.mocked(gitMeasured).mockReturnValue({ stdout: '', bytes: 0, hasReplacementCharacter: false });
    expect(() => stagedDisplayDiff('', {}, ['a'], new Map([['a', 'M']]), { maxPathspecChars: 8192, maxOutputBytes: 2 })).toThrow(ProcessLimitError);
  });
  it.each(['timeout', 'interrupted', 'output'] as const)('[REQ-180] 表示の%sを取り直さない', (reason) => {
    vi.mocked(gitMeasured).mockImplementation(() => { throw new ProcessLimitError(reason, 'git'); });
    let failure: unknown;
    try { stagedDisplayDiff('', {}, ['a', 'b'], new Map([['a', 'M'], ['b', 'M']]), { maxPathspecChars: 1, maxOutputBytes: 10000 }); } catch (error) { failure = error; }
    expect(failure).toBeInstanceOf(ProcessLimitError); expect(failure).toMatchObject({ kind: reason });
    expect(gitMeasured).toHaveBeenCalledTimes(1);
  });
});

describe('実Gitでの群化と対象file境界', () => {
  it('[REQ-112][REQ-138] 内容と表示の両群だけでliteral子envを渡し、先頭をdiffに保つ', () => {
    const r = repo(); const before = { ...r.env };
    r.write('tests/a.test.ts', "it.skip('synthetic',()=>{});\n");
    findViolationsWithLimits(r.root, r.env);
    const calls = vi.mocked(gitMeasured).mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls.map((call) => call[2].includes('-U0'))).toEqual([true, false]);
    for (const [, env, args] of calls) {
      expect(args[0]).toBe('diff'); expect(args).not.toContain('--literal-pathspecs');
      expect(env.GIT_LITERAL_PATHSPECS).toBe('1'); expect(env).not.toBe(r.env);
    }
    expect(r.env).toEqual(before);
  });
  it.each([
    ['GIT_GLOB_PATHSPECS', '1', true], ['GIT_ICASE_PATHSPECS', '1', true],
    ['GIT_NOGLOB_PATHSPECS', '1', false], ['GIT_LITERAL_PATHSPECS', '0', false],
  ] as const)('[REQ-112][REQ-137][REQ-138] 実Gitの%s=%sの正負と元envを保持する', (key, value, conflict) => {
    const r = repo();
    r.write('tests/[a].test.ts', 'before\n'); r.write('tests/a.test.ts', 'before\n'); commit(r);
    r.write('tests/[a].test.ts', "it.skip('synthetic',()=>{});\n"); r.write('tests/a.test.ts', 'outside_marker\n');
    const env = { ...r.env, [key]: value }; const before = { ...env };
    if (conflict) expect(() => findViolationsWithLimits(r.root, env)).toThrow(GitError);
    else {
      const result = findViolationsWithLimits(r.root, env);
      expect(result.findings.map((finding) => finding.file)).toEqual(['tests/[a].test.ts']);
      expect(result.diff).not.toContain('outside_marker');
      expect(result.diff).toBe(raw(r, ['--literal-pathspecs', 'diff', '--cached', ...options, '--', 'tests/[a].test.ts']));
    }
    expect(gitMeasured).toHaveBeenCalled();
    expect(vi.mocked(gitMeasured).mock.calls.every((call) => call[1].GIT_LITERAL_PATHSPECS === '1')).toBe(true);
    expect(env).toEqual(before);
  });
  it.each([8192, 30])('[REQ-109][REQ-201] 同群と別群%sで隣fileの追加を削除行へ偽対応しない', (cap) => {
    const r = repo(); r.write('tests/a.test.ts', 'expect(value).toBe(1);\n'); r.write('tests/b.test.ts', 'before\n'); commit(r);
    r.write('tests/a.test.ts', 'after\n'); r.write('tests/b.test.ts', 'expect(value).toBe(1);\n');
    const result = findViolationsWithLimits(r.root, r.env, 'openspec', { maxPathspecChars: cap, maxOutputBytes: 65536 });
    expect(result.findings.map((f) => f.file)).toEqual(['tests/a.test.ts', 'tests/a.test.ts']);
    expect(result.findings[1].reason).toContain('expect(value).toBe(1)');
  });
  it('[REQ-109][REQ-180] 1200file全findings順序を保ち13群の実起動数とargv上限を確認する', () => {
    const r = repo(); const files = Array.from({ length: 1200 }, (_, i) => `openspec/changes/c1/n/${i}-${'a'.repeat(50)}.md`).sort();
    for (const file of files) r.write(file, 'changed\n');
    vi.mocked(git).mockClear(); vi.mocked(gitMeasured).mockClear();
    const result = findViolationsWithLimits(r.root, r.env);
    expect(result.findings.map((f) => f.file)).toEqual(files);
    expect(groupPaths(files)).toHaveLength(13);
    expect(vi.mocked(git).mock.calls.length + vi.mocked(gitMeasured).mock.calls.length).toBe(28);
    const allCalls = [...vi.mocked(git).mock.calls, ...vi.mocked(gitMeasured).mock.calls];
    const calls = allCalls.filter((call) => call[1]?.GIT_LITERAL_PATHSPECS === '1');
    expect(Math.max(...calls.map((call) => JSON.stringify(call[2]).length))).toBeLessThanOrEqual(8192 + 152);
    expect(calls).toHaveLength(26);
    expect(calls.every((call) => call[2][0] === 'diff' && !call[2].includes('--literal-pathspecs'))).toBe(true);
    const otherCalls = allCalls.filter((call) => call[1]?.GIT_LITERAL_PATHSPECS !== '1');
    expect(otherCalls).toHaveLength(2);
    expect(otherCalls.every((call) => call[1]?.GIT_LITERAL_PATHSPECS === undefined)).toBe(true);
    expect(otherCalls.some((call) => call[2][0] === 'add')).toBe(true);
    expect(otherCalls.some((call) => call[2][0] === 'diff' && call[2].includes('--name-status'))).toBe(true);
  });
  const names = process.platform === 'win32' ? ['日本語 空白', '[a]'] : ['日本語 空白', 'tab\tname', 'line\nname', 'quote"name', 'slash\\name', '*', '?', ':magic'];
  it.each(names)('[REQ-138][REQ-112] %jをquotePath両設定とカラー固定で正しく照合する', (name) => {
    const r = repo(); const file = `tests/${name}.test.ts`; r.write(file, 'before\n'); commit(r); r.write(file, "it.skip('synthetic',()=>{});\n");
    for (const quote of ['true', 'false']) {
      r.git('config', 'core.quotepath', quote); r.git('config', 'color.diff', 'always'); r.git('config', 'diff.noprefix', 'true'); r.git('config', 'diff.mnemonicPrefix', 'true');
      const result = findViolationsWithLimits(r.root, r.env);
      expect(result.findings.map((f) => f.file)).toEqual([file]);
      expect(result.diff).not.toContain('\u001b['); expect(result.diff).toContain('diff --git ');
    }
  });
  it('[REQ-112][REQ-138] globに一致する他fileの本文を混ぜない', () => {
    const r = repo(); r.write('tests/[a].test.ts', 'old\n'); r.write('tests/a.test.ts', 'old\n'); commit(r);
    r.write('tests/[a].test.ts', "it.skip('synthetic',()=>{});\n"); r.write('tests/a.test.ts', 'outside_marker\n');
    const result = findViolationsWithLimits(r.root, r.env);
    expect(result.findings.map((f) => f.file)).toEqual(['tests/[a].test.ts']); expect(result.diff).not.toContain('outside_marker');
  });
  it('[REQ-112] fileからdirへの置換で表示に非違反descendantを混ぜない', () => {
    const r = repo(); r.write('tests/old.test.ts', 'old\n'); commit(r); rmSync(join(r.root, 'tests/old.test.ts')); r.write('tests/old.test.ts/inner.ts', 'outside_marker\n');
    const result = findViolationsWithLimits(r.root, r.env);
    expect(result.findings).toEqual([{ file: 'tests/old.test.ts', reason: 'テストファイルを消しました' }]);
    expect(result.diff).toContain('-old'); expect(result.diff).not.toContain('outside_marker');
  });
  it('[REQ-112] dirからconfigfileへの置換も非違反descendantを混ぜない', () => {
    const r = repo(); r.write('eslint.config.js/child.txt', 'outside_marker\n'); commit(r); rmSync(join(r.root, 'eslint.config.js'), { recursive: true }); r.write('eslint.config.js', 'new\n');
    const result = findViolationsWithLimits(r.root, r.env);
    expect(result.findings).toEqual([{ file: 'eslint.config.js', reason: '設定ファイルを変えました' }]);
    expect(result.diff).toContain('+new'); expect(result.diff).not.toContain('outside_marker');
  });
  it('[REQ-112][REQ-109] renameは群境界に依存せず削除と追加の全行を示す', () => {
    const r = repo(); r.write('tests/a.test.ts', 'old\n'); commit(r); renameSync(join(r.root, 'tests/a.test.ts'), join(r.root, 'tests/z.test.ts')); r.write('tests/z.test.ts', "it.skip('synthetic',()=>{});\n");
    const big = findViolationsWithLimits(r.root, r.env, 'openspec', { maxPathspecChars: 8192, maxOutputBytes: 65536 });
    const small = findViolationsWithLimits(r.root, r.env, 'openspec', { maxPathspecChars: 1, maxOutputBytes: 65536 });
    expect(small).toEqual(big); expect(big.diff).toContain('-old'); expect(big.diff).toContain('+it.skip'); expect(big.diff).not.toContain('rename from');
  });
  it('[REQ-109][REQ-137] A/M/empty/binary/modeの完結したGit出力を単独取得と照合する', () => {
    const r = repo(); for (const name of ['modified', 'binary', 'mode']) r.write(name, 'before\n'); commit(r);
    r.write('modified', 'after\n'); r.write('added', 'added\n'); r.write('empty', ''); writeFileSync(join(r.root, 'binary'), Buffer.from([0, 1, 2])); stage(r); r.git('update-index', '--chmod=+x', '--', 'mode');
    if (process.platform !== 'win32') chmodSync(join(r.root, 'mode'), 0o755);
    const map = codes(r); const files = [...map.keys()]; const text = raw(r, ['--literal-pathspecs', 'diff', '--cached', '-U0', ...options, '--', ...files]);
    const split = splitStagedPatch(text, files, map);
    for (const file of files) expect(split.byPath.get(file)!.join('')).toBe(raw(r, ['--literal-pathspecs', 'diff', '--cached', '-U0', ...options, '--', file]));
  });
  it.each(process.platform === 'win32' ? ['regular'] : ['true', 'false'])('[REQ-109][REQ-138] 型と通常変更の区切りを%sで保つ', (quote) => {
    const r = repo(); r.write('type', 'old\n'); commit(r);
    if (quote === 'regular') r.write('type', 'new\n');
    else { rmSync(join(r.root, 'type')); symlinkSync('target', join(r.root, 'type')); r.git('config', 'core.quotepath', quote); }
    stage(r); const map = codes(r); expect(map.get('type')).toBe(quote === 'regular' ? 'M' : 'T');
    const text = raw(r, ['--literal-pathspecs', 'diff', '--cached', '-U0', ...options, '--', 'type']);
    expect(splitStagedPatch(text, ['type'], map).byPath.get('type')).toHaveLength(quote === 'regular' ? 1 : 2);
  });
  it('[REQ-112] 既定の非rename単独群は旧表示とbyte一致する', () => {
    const r = repo(); r.write('tests/a.test.ts', "it.skip('synthetic',()=>{});\n"); const result = findViolationsWithLimits(r.root, r.env);
    expect(result.diff).toBe(raw(r, ['diff', '--cached', '--', 'tests/a.test.ts']));
  });
});

function noisy(r: Repo) {
  const driver = join(r.base, 'noisy.cjs'); writeFileSync(driver, "const fs=require('node:fs');process.stderr.write('E'.repeat(4096));process.stdout.write(fs.readFileSync(process.argv[2]));\n");
  r.write('.gitattributes', '*.noisy diff=noisy\n'); for (const f of ['a.noisy', 'b.noisy', 'c.noisy']) r.write(f, 'old\n'); commit(r);
  r.git('config', 'diff.noisy.textconv', `"${process.execPath.replace(/\\/g, '/')}" "${driver.replace(/\\/g, '/')}"`);
  for (const f of ['a.noisy', 'b.noisy', 'c.noisy']) r.write(f, 'new\n'); stage(r); return ['a.noisy', 'b.noisy', 'c.noisy'];
}
describe('実textconvのstderrとoutput限定再取得', () => {
  it('[REQ-109][REQ-112][REQ-137] constant textconvのM0を旧内容/表示と等価に保つ', () => {
    const r = repo(); const driver = join(r.base, 'constant.cjs');
    writeFileSync(driver, "process.stdout.write('normalized\\n');\n");
    r.write('.gitattributes', '*.constant diff=constant\n');
    for (const file of ['a.constant', 'b.constant', 'c.constant']) r.write(file, 'old raw\n'); commit(r);
    r.git('config', 'diff.constant.textconv', `"${process.execPath.replace(/\\/g, '/')}" "${driver.replace(/\\/g, '/')}"`);
    for (const file of ['a.constant', 'b.constant', 'c.constant']) r.write(file, 'new raw\n'); stage(r);
    const map = codes(r); const files = [...map.keys()];
    expect([...map.values()]).toEqual(['M', 'M', 'M']);
    for (const file of files) expect(raw(r, ['diff', '--cached', '-U0', '--', file])).toBe('');
    for (const cap of [1, 8192]) {
      const limits = { maxPathspecChars: cap, maxOutputBytes: 65536 };
      expect(findViolationsWithLimits(r.root, r.env, 'openspec', limits)).toEqual({ findings: [], diff: '' });
      expect(stagedDisplayDiff(r.root, r.env, files, map, limits)).toBe(raw(r, ['diff', '--cached', '--', ...files]));
    }
    r.write('tests/extra.test.ts', "it.skip('synthetic',()=>{});\n");
    expect(findViolationsWithLimits(r.root, r.env).findings.map((f) => f.file)).toEqual(['tests/extra.test.ts']);
  });
  it('[REQ-180] gitMeasuredは成功stderrをstdoutと合算し旧gitはstdoutを保つ', () => {
    const r = repo(); noisy(r); const args = ['diff', '--cached', '--no-ext-diff', '--', 'a.noisy']; const result = gitMeasured(r.root, r.env, args);
    expect(result.bytes - Buffer.byteLength(result.stdout)).toBe(8192); expect(git(r.root, r.env, args)).toBe(result.stdout);
  });
  it('[REQ-180][REQ-137] 正規U+FFFDでも境界では停止し十分な余裕があれば通す', () => {
    const r = repo(); r.write('tests/a.test.ts', "it.skip('synthetic\ufffd',()=>{});\n"); stage(r);
    const args = ['--literal-pathspecs', 'diff', '--cached', ...options, '--', 'tests/a.test.ts'];
    const measured = actual.gitMeasured(r.root, r.env, args);
    expect(measured.hasReplacementCharacter).toBe(true);
    const limits = { maxPathspecChars: 8192, maxOutputBytes: measured.bytes };
    expect(() => stagedDisplayDiff(r.root, r.env, ['tests/a.test.ts'], codes(r), limits)).toThrow(ProcessLimitError);
    expect(stagedDisplayDiff(r.root, r.env, ['tests/a.test.ts'], codes(r), { ...limits, maxOutputBytes: measured.bytes + 100 })).toBe(measured.stdout);
    // The metadata alone must not impose this new rejection on legacy git() callers.
    expect(actual.git(r.root, r.env, args, { maxBuffer: measured.bytes })).toBe(measured.stdout);
  });
  it('[REQ-180][REQ-109] 内容の上限近傍replacementは二分し単独なら停止する', () => {
    const r = repo(); for (const f of ['tests/a.test.ts', 'tests/b.test.ts']) r.write(f, "it.skip('synthetic\ufffd',()=>{});\n");
    vi.mocked(gitMeasured).mockImplementation((root, env, args, limits) => {
      if (args.includes('-U0') && args.slice(args.indexOf('--') + 1).length > 1) {
        const stdout = patch('tests/a.test.ts', '\ufffd');
        return { stdout, bytes: limits?.maxBuffer ?? 65536, hasReplacementCharacter: true };
      }
      return actual.gitMeasured(root, env, args, limits);
    });
    expect(findViolationsWithLimits(r.root, r.env).findings).toHaveLength(2);
    expect(vi.mocked(gitMeasured).mock.calls.filter((call) => call[2].includes('-U0'))).toHaveLength(3);
    vi.mocked(gitMeasured).mockImplementation(actual.gitMeasured);
    const text = raw(r, ['--literal-pathspecs', 'diff', '--cached', '-U0', ...options, '--', 'tests/a.test.ts']);
    expect(() => findViolationsWithLimits(r.root, r.env, 'openspec', { maxPathspecChars: 1, maxOutputBytes: Buffer.byteLength(text) })).toThrow(ProcessLimitError);
  });
  it('[REQ-180][REQ-112] 表示の全群でstderr込み合計を超えたら止まる', () => {
    const r = repo(); const files = noisy(r); const map = codes(r); const display = stagedDisplayDiff(r.root, r.env, files, map, { maxPathspecChars: 1, maxOutputBytes: 100000 }); const size = Buffer.byteLength(display);
    expect(stagedDisplayDiff(r.root, r.env, files, map, { maxPathspecChars: 1, maxOutputBytes: size + 6 * 4096 })).toBe(display);
    expect(() => stagedDisplayDiff(r.root, r.env, files, map, { maxPathspecChars: 1, maxOutputBytes: size + 2 * 4096 + 1 })).toThrow(ProcessLimitError);
  });
  it('[REQ-180][REQ-109] 内容のoutput超過だけ二分しsingleton超過は残す', () => {
    const r = repo(); for (const file of ['tests/a.test.ts', 'tests/b.test.ts']) r.write(file, "it.skip('synthetic',()=>{});\n");
    const size = Buffer.byteLength(patch('tests/a.test.ts')); const normal = actual.gitMeasured;
    vi.mocked(gitMeasured).mockImplementation((root, env, args, limits) => {
      if (args.includes('-U0') && args.slice(args.indexOf('--') + 1).length > 1) throw new ProcessLimitError('output', 'git');
      return normal(root, env, args, limits);
    });
    const result = findViolationsWithLimits(r.root, r.env); expect(result.findings).toHaveLength(2);
    expect(vi.mocked(gitMeasured).mock.calls.filter((call) => call[2].includes('-U0'))).toHaveLength(3);
    expect(() => findViolationsWithLimits(r.root, r.env, 'openspec', { maxPathspecChars: 1, maxOutputBytes: size / 4 | 0 })).toThrow(ProcessLimitError);
  });
  it.each(['timeout', 'interrupted'] as const)('[REQ-180] 内容の%sでは二分しない', (reason) => {
    const r = repo(); r.write('tests/a.test.ts', "it.skip('synthetic',()=>{});\n"); r.write('tests/b.test.ts', 'new\n');
    vi.mocked(gitMeasured).mockImplementation((root, env, args, limits) => { if (args.includes('-U0')) throw new ProcessLimitError(reason, 'git'); return actual.gitMeasured(root, env, args, limits); });
    let failure: unknown; try { findViolationsWithLimits(r.root, r.env); } catch (error) { failure = error; }
    expect(failure).toBeInstanceOf(ProcessLimitError); expect(failure).toMatchObject({ kind: reason });
    expect(vi.mocked(gitMeasured).mock.calls.filter((call) => call[2].includes('-U0'))).toHaveLength(1);
  });
  it('[REQ-180] 共有期限が尽きていれば群のGitを起動しない', () => {
    withProcessBudget({ timeoutMs: 1 }, () => {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 3);
      expect(() => actual.gitMeasured('', {}, ['--version'])).toThrow(ProcessLimitError);
    });
  });
});
