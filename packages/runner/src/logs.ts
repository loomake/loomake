import { closeSync, existsSync, lstatSync, mkdirSync, openSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createInputReader, DOCUMENT_LIMITS, UsageError } from '@loomake/kit';
import { maskSecrets } from './mask.js';
import { admitLog, DEFAULT_LOG_LIMITS, LogQuotaError, validateLogLimits, type LogLimits, type LogUsage } from './log-policy.js';

function history(root: string, limits: LogLimits) {
  const dir = join(root, '.loomake/runs');
  const reader = createInputReader({ maxEntries: limits.maxEntries });
  let bytes = 0; let entries = 0;
  const visit = (path: string, depth: number) => {
    if (depth > DOCUMENT_LIMITS.maxDepth) throw new UsageError(`実行履歴の探索の深さの上限は${DOCUMENT_LIMITS.maxDepth}です：${path}`);
    const items = reader.entries(path); entries += items.length;
    for (const item of items) {
      const file = join(path, item.name);
      if (item.kind === 'directory') visit(file, depth + 1);
      else {
        const stats = lstatSync(file);
        if (!stats.isFile() || stats.isSymbolicLink()) throw new UsageError(`実行履歴は通常のファイルにしてください：${file}`);
        if (stats.size > limits.maxHistoryBytes - bytes) throw new LogQuotaError(`実行履歴の上限は${limits.maxHistoryBytes}バイトです：${file}`);
        bytes += stats.size;
      }
    }
  };
  visit(dir, 0);
  const bootstrap = existsSync(join(dir, '.gitignore')) ? 0 : 1;
  if (bytes + bootstrap * 2 + limits.summaryBytes > limits.maxHistoryBytes || entries + bootstrap + 2 > limits.maxEntries) throw new LogQuotaError(`実行履歴の上限は${limits.maxHistoryBytes}バイト・${limits.maxEntries}項目です。停止情報を予約できません：${dir}`);
  return { dir, bytes, entries, bootstrap };
}

export function checkLogHistory(root: string, limits: LogLimits = DEFAULT_LOG_LIMITS): void {
  validateLogLimits(limits);
  try { history(root, limits); }
  catch (error) { if (error instanceof UsageError) throw error; throw new UsageError(`実行履歴を確認できません：${root}（${(error as Error).message}）`); }
}

export function createLogStore(root: string, baseId: string, limits: LogLimits = DEFAULT_LOG_LIMITS) {
  validateLogLimits(limits);
  if (!baseId || /[/\\]/.test(baseId) || baseId === '.' || baseId === '..') throw new UsageError('実行記録の名前が不正です');
  let initial: ReturnType<typeof history>;
  let runDir = ''; let runId = baseId;
  try {
    initial = history(root, limits);
    mkdirSync(initial.dir, { recursive: true });
    if (initial.bootstrap) writeFileSync(join(initial.dir, '.gitignore'), '*\n', { flag: 'wx' });
    for (let index = 1; index <= limits.maxEntries; index++) {
      runId = index === 1 ? baseId : `${baseId}-${index}`;
      runDir = join(initial.dir, runId);
      try { mkdirSync(runDir); break; }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; runDir = ''; }
    }
    if (!runDir) throw new UsageError('実行記録の名前を確保できません');
  } catch (error) { if (error instanceof UsageError) throw error; throw new UsageError(`実行記録を開始できません：${root}（${(error as Error).message}）`); }
  let usage: LogUsage = { runBytes: 0, historyBytes: initial.bytes + initial.bootstrap * 2, entries: initial.entries + initial.bootstrap + 1 };
  let poisoned = false; let finished = false;
  const write = (name: string, text: string) => {
    if (poisoned || finished) throw new UsageError(`実行記録を保存できません。保存先と作業状態を確認してください：${runDir}`);
    const file = join(runDir, name);
    let fd: number | undefined; let created = false;
    try {
      fd = openSync(file, 'wx', 0o600); created = true;
      writeFileSync(fd, text); closeSync(fd); fd = undefined;
    } catch (error) {
      poisoned = true;
      if (fd !== undefined) { try { closeSync(fd); } catch { /* 保存失敗を優先して説明する。 */ } }
      let cleanup = '';
      if (created) { try { unlinkSync(file); } catch (failed) { cleanup = `。部分記録を片付けられません：${(failed as Error).message}`; } }
      throw new UsageError(`実行記録を保存できません：${file}（${(error as Error).message}${cleanup}）。保存先と作業状態を確認してください`);
    }
  };
  return {
    runDir, runId,
    save(name: string, original: string) {
      if (!/^[a-zA-Z0-9][a-zA-Z0-9.-]*$/.test(name) || name.includes('..') || ['summary.json', 'stop.json'].includes(name)) throw new UsageError('実行記録のファイル名が不正です');
      const text = maskSecrets(original);
      const next = admitLog(usage, Buffer.byteLength(text), limits);
      write(name, text); usage = next;
    },
    finish(name: 'summary.json' | 'stop.json', original: string) {
      const text = maskSecrets(original); const size = Buffer.byteLength(text);
      if (size > limits.summaryBytes) throw new LogQuotaError(`停止情報の予約の上限は${limits.summaryBytes}バイトです`);
      if (usage.runBytes + size > limits.maxRunBytes || usage.historyBytes + size > limits.maxHistoryBytes || usage.entries + 1 > limits.maxEntries) throw new LogQuotaError('停止情報の予約を確保できません');
      write(name, text); finished = true;
    },
  };
}
