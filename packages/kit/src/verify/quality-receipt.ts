// ci の完了ゲートで、ci.test_report の adapter に渡す事実（receipt）を集める I/O（REQ-319）。照合は adapter が行う
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { createInputReader, JSON_LIMITS } from '../runtime/input.js';
import { runExternal } from '../runtime/process.js';
import { specFiles, toPosix } from '../runtime/change-files.js';
import { QUALITY_FILE } from './quality-input.js';
import type { TestReportReceipt } from './policy/test-report-observation.js';

const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');

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
  const hash = createHash('sha256');
  for (const file of files) {
    let text: string;
    try {
      text = `file\n${reader.read(file)}`;
    } catch {
      text = 'unreadable';
    }
    hash.update(`${toPosix(relative(root, file))}\0${sha256(text)}\n`);
  }
  return hash.digest('hex');
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

/** ルートから親へたどって、node_modules にあるテストランナーの名前と版を探す。見つからなければ null */
export function findProducer(root: string): TestReportReceipt['producer'] {
  const reader = createInputReader();
  for (let dir = root; ; dir = dirname(dir)) {
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
    if (dirname(dir) === dir) return null;
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
  return { path: display, text, sha256: sha256(text) };
}
