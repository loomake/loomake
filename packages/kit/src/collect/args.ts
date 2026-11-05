import { UsageError } from '../runtime/errors.js';

function pathsValid(paths: readonly string[], minimum: number): boolean {
  return Array.isArray(paths) && paths.length >= minimum
    && Array.from(paths).every(path => typeof path === 'string' && path.length > 0 && !path.startsWith('-') && !path.includes('\0'));
}

export function ghPrChecksArgs(pr: number, options?: { repo?: string }): string[] {
  if (!Number.isSafeInteger(pr) || pr <= 0) throw new UsageError('PR 番号は正の安全な整数にしてください。');
  const repo = options?.repo;
  if (repo !== undefined && (typeof repo !== 'string' || !/^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/.test(repo))) {
    throw new UsageError('リポジトリは owner/name の形にしてください。');
  }
  return ['pr', 'checks', String(pr), '--json', 'name,bucket,workflow,link', ...(repo ? ['--repo', repo] : [])];
}

export function biomeArgs(mode: 'lint' | 'ci', paths: readonly string[]): string[] {
  if (!(['lint', 'ci'] as readonly string[]).includes(mode) || !pathsValid(paths, 1)) {
    throw new UsageError('Biome の mode と、1 件以上の有効な path を指定してください。');
  }
  return [mode, '--reporter', 'json', '--max-diagnostics', 'none', ...paths];
}

export function playwrightTestArgs(files: readonly string[]): string[] {
  if (!pathsValid(files, 0)) throw new UsageError('Playwright の対象は有効な path の配列にしてください。');
  return ['test', '--reporter', 'json', ...files];
}
