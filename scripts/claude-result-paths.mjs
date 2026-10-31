import { Buffer } from 'node:buffer';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { constants, lstatSync, realpathSync } from 'node:fs';
import { lstat, mkdtemp, open, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, parse, relative, resolve } from 'node:path';
import { RESULT_NATIVE_SHA256 } from './claude-result-collector.mjs';

const NATIVE_RELATIVE = 'node_modules/@anthropic-ai/claude-code-linux-arm64/claude';
const NOTE = 'Safe fixture note.\n';
const inside = (parent, child) => {
  const path = relative(parent, child);
  return path !== '' && path !== '..' && !path.startsWith('../') && !path.startsWith('..\\') && !isAbsolute(path);
};
const result = (accepted, reasonCode) => ({ accepted, reasonCode });

/** Low-level file check for synthetic controls; supplied pins never qualify an observation. */
export async function inspectExpectedNativeFile(prefix, expectedSha256) {
  let handle;
  try {
    if (!/^[a-f0-9]{64}$/.test(expectedSha256)) return result(false, 'native-pin-invalid');
    const root = resolve(prefix);
    if (realpathSync(root) !== root) return result(false, 'native-symlink');
    const target = join(root, NATIVE_RELATIVE);
    let path = root;
    for (const [index, part] of NATIVE_RELATIVE.split('/').entries()) {
      path = join(path, part);
      const entry = await lstat(path);
      if (entry.isSymbolicLink()) return result(false, 'native-symlink');
      if (index < NATIVE_RELATIVE.split('/').length - 1 && !entry.isDirectory()) return result(false, 'native-type-invalid');
    }
    const before = await lstat(target);
    if (!before.isFile()) return result(false, 'native-type-invalid');
    handle = await open(target, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const opened = await handle.stat();
    if (!opened.isFile() || opened.dev !== before.dev || opened.ino !== before.ino) return result(false, 'native-changed');
    const digest = createHash('sha256');
    const bytes = Buffer.alloc(65536);
    for (;;) {
      const read = await handle.read(bytes, 0, bytes.length, null);
      if (read.bytesRead === 0) break;
      digest.update(bytes.subarray(0, read.bytesRead));
    }
    const after = await handle.stat();
    if (after.size !== opened.size || after.mtimeMs !== opened.mtimeMs || after.ctimeMs !== opened.ctimeMs) return result(false, 'native-changed');
    return digest.digest('hex') === expectedSha256 ? result(true, 'native-pin-matched') : result(false, 'native-hash-mismatch');
  } catch { return result(false, 'native-path-unproved'); }
  finally { if (handle) await handle.close().catch(() => {}); }
}

/** Production P1 uses only the two published pins and derived paths, without override input. */
export async function inspectResultNative(workspace, version) {
  if (!Object.hasOwn(RESULT_NATIVE_SHA256, version)) return result(false, 'native-version-invalid');
  try {
    const root = realpathSync(workspace);
    const prefix = join(root, '.loomake', 'e3-cli', `${version}-arm64`);
    if (realpathSync(prefix) !== prefix || !inside(root, prefix)) return result(false, 'native-symlink');
    return await inspectExpectedNativeFile(prefix, RESULT_NATIVE_SHA256[version]);
  } catch { return result(false, 'native-path-unproved'); }
}

/** Read-only P2. Path acceptance is not an atomic-open guarantee or a collection certificate. */
export function inspectResultOutputPath(workspace, output, environment = process.env) {
  try {
    if (Object.keys(environment).some((key) => key.toUpperCase().startsWith('GIT_'))) return result(false, 'output-git-environment');
    const root = realpathSync(workspace), lexicalRoot = join(root, '.loomake');
    const boundary = realpathSync(lexicalRoot), requested = resolve(root, output);
    if (!inside(root, boundary) || !inside(lexicalRoot, requested)) return result(false, 'output-outside-boundary');
    let existing = requested;
    for (;;) {
      try { lstatSync(existing); break; }
      catch (error) {
        if (error?.code !== 'ENOENT') return result(false, 'output-path-unproved');
        const parent = dirname(existing);
        if (parent === existing) return result(false, 'output-path-unproved');
        existing = parent;
      }
    }
    const actual = realpathSync(existing);
    if (actual !== boundary && !inside(boundary, actual)) return result(false, 'output-outside-boundary');
    if (!lstatSync(actual).isDirectory()) return result(false, 'output-not-directory');
    const ignored = spawnSync('git', ['check-ignore', '-q', '--', requested], { cwd: root, shell: false, env: { ...environment }, stdio: 'ignore', timeout: 5000 });
    return ignored.status === 0 && !ignored.error ? result(true, 'output-path-checked') : result(false, 'output-ignore-unproved');
  } catch { return result(false, 'output-path-unproved'); }
}

/** P3 checks ancestor entries, ambient Git-variable presence and an explicit Git non-repo error. */
export async function inspectResultCwd(cwd, environment = process.env) {
  try {
    if (Object.keys(environment).some((key) => key.toUpperCase().startsWith('GIT_'))) return result(false, 'cwd-git-environment');
    const root = realpathSync(cwd);
    let ancestor = root;
    for (;;) {
      try { await lstat(join(ancestor, '.git')); return result(false, 'cwd-git-ancestor'); }
      catch (error) { if (error?.code !== 'ENOENT') return result(false, 'cwd-git-unproved'); }
      const parent = dirname(ancestor);
      if (ancestor === parse(ancestor).root || parent === ancestor) break;
      ancestor = parent;
    }
    const checked = spawnSync('git', ['rev-parse', '--is-inside-work-tree'], {
      cwd: root, shell: false, env: { ...environment, LC_ALL: 'C' }, encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'], timeout: 5000, maxBuffer: 8192,
    });
    if (checked.error || checked.signal || checked.status !== 128 || checked.stdout !== '' ||
      !checked.stderr.startsWith('fatal: not a git repository')) return result(false, 'cwd-git-unproved');
    return result(true, 'cwd-outside-git');
  } catch { return result(false, 'cwd-git-unproved'); }
}

/**
 * Own a temporary cwd with one fixed note, invoke a non-CLI operation, and always clean up.
 * @template T
 * @param {(cwd: string) => Promise<T>} operation
 * @param {{ environment?: NodeJS.ProcessEnv }} [options]
 */
export async function withResultFixtureCwd(operation, { environment = process.env } = {}) {
  let directory, outcome;
  try {
    directory = await mkdtemp(join(tmpdir(), 'loomake-result-fixture-'));
    const note = await open(join(directory, 'note.txt'), constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    try { await note.writeFile(NOTE, 'utf8'); } finally { await note.close(); }
    const checked = await inspectResultCwd(directory, environment);
    if (!checked.accepted) outcome = { ...checked };
    else if ((await readdir(directory)).length !== 1) outcome = result(false, 'cwd-content-unproved');
    else outcome = { ...result(true, 'cwd-operation-finished'), value: await operation(directory) };
  } catch { outcome = result(false, 'cwd-operation-failed'); }
  finally {
    if (directory) {
      try { await rm(directory, { recursive: true, force: true }); }
      catch { outcome = result(false, 'cwd-cleanup-failed'); }
    }
  }
  return outcome;
}
