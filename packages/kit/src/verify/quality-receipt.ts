// ci の完了ゲートで、ci.test_report の adapter に渡す事実（receipt）を集める I/O（REQ-319）。照合は adapter が行う
import { existsSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, sep } from 'node:path';
import { createInputReader, JSON_LIMITS } from '../runtime/input.js';
import { runExternal } from '../runtime/process.js';
import { specFiles, toPosix } from '../runtime/change-files.js';
import { QUALITY_FILE } from './quality-input.js';
import { sha256Hex } from './hash.js';
import type { TestReportReceipt } from './policy/test-report-observation.js';

/**
 * 基準（quality.yaml・差分仕様・trace.md）の hash。読めないファイルは「読めない」という印で数え、
 * あとで読めるようになったら違う hash になるようにする
 */
export function basisHash(root: string, changeDir: string): string {
  const reader = createInputReader();
  const files = [join(root, QUALITY_FILE), join(changeDir, 'trace.md')];
  try {
    files.push(...specFiles(changeDir, reader));
  } catch {
    files.push(join(changeDir, 'specs'));
  }
  const lines: string[] = [];
  for (const file of files) {
    let text: string;
    try {
      text = `file\n${reader.read(file)}`;
    } catch {
      text = 'unreadable';
    }
    lines.push(`${toPosix(relative(root, file))}\0${sha256Hex(text)}\n`);
  }
  return sha256Hex(lines.join(''));
}

const COMMIT = /^[0-9a-f]{40}(?:[0-9a-f]{24})?$/;

/** `git rev-parse HEAD` の結果。git がない・リポジトリでない・形が違うときは null */
export function gitHead(root: string): string | null {
  try {
    const r = runExternal('git', ['rev-parse', 'HEAD'], { cwd: root, maxBuffer: 1024 * 1024 });
    const sha = r.status === 0 ? r.stdout.trim() : '';
    return COMMIT.test(sha) ? sha : null;
  } catch {
    return null;
  }
}

const PRODUCERS = ['vitest', 'jest'];

/** The current Git worktree bounds lookup positions (REQ-359); an unknown or unrelated top permits only root. */
function searchTop(root: string): string {
  try {
    const result = runExternal('git', ['rev-parse', '--show-toplevel'], { cwd: root, maxBuffer: 1024 * 1024 });
    const output = result.status === 0 ? result.stdout.replace(/\r?\n$/, '') : '';
    if (!output || !isAbsolute(output)) return root;
    const top = realpathSync.native(output);
    const inside = relative(top, root);
    return inside === '' || (inside !== '..' && !inside.startsWith(`..${sep}`) && !isAbsolute(inside)) ? top : root;
  } catch {
    return root;
  }
}

/** Search from the real root through its inclusive Git top; runner links may point outside that boundary (REQ-359). */
export function findProducer(root: string): TestReportReceipt['producer'] {
  const reader = createInputReader();
  let start = root;
  let top = root;
  try {
    start = realpathSync.native(root);
    top = searchTop(start);
  } catch {
    // An unresolved root cannot justify searching any parent.
  }
  for (let dir = start; ; dir = dirname(dir)) {
    for (const name of PRODUCERS) {
      const file = join(dir, 'node_modules', name, 'package.json');
      if (!existsSync(file)) continue;
      try {
        const pkg = JSON.parse(reader.read(file)) as { name?: unknown; version?: unknown };
        if (pkg.name === name && typeof pkg.version === 'string') return { name, version: pkg.version };
      } catch {
        // シンボリックリンクなど、読めないものは使わない
      }
    }
    if (relative(dir, top) === '' || dirname(dir) === dir) return null;
  }
}

/** 実行のあとのテストのレポート。なければ null。読めないときは本文を空にして、adapter が未照合にする */
export function readReport(path: string, display: string): TestReportReceipt['report'] {
  if (!existsSync(path)) return null;
  let text = '';
  try {
    text = createInputReader(JSON_LIMITS).read(path);
  } catch {
    // 形の誤りと同じく、照合できない証拠にする
  }
  return { path: display, text, sha256: sha256Hex(text) };
}
