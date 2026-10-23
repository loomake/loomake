import { spawnSync } from 'node:child_process';
import { git } from './git.js';

/** 不正な直し方として見つけたもの */
export type GuardFinding = { file: string; reason: string };

// テストファイル（add-run-guards の仮定 A-17）
const isTestFile = (f: string) => /\.(test|spec)\./.test(f) || /(^|\/)(test|tests|__tests__)\//.test(f);
// skip・todo を足した行（A-17）
const SKIP = /\b(it|test|describe)\.(skip|todo)\b|\bx(it|test|describe)\(/;
// lint・型・テストの設定ファイル（A-18）
const isConfigFile = (f: string) => {
  const name = f.split('/').pop() ?? '';
  return (
    f === 'loomake.config.json' ||
    /^eslint\.config\./.test(name) ||
    /^\.eslintrc/.test(name) ||
    /^tsconfig.*\.json$/.test(name) ||
    /^(vitest\.config|vitest\.workspace|vite\.config|jest\.config)\./.test(name)
  );
};
// いまの仕様と trace.md（A-19）
const isSpecOrTrace = (f: string) => f.startsWith('openspec/specs/') || (f.startsWith('openspec/changes/') && f.endsWith('/trace.md'));

// どの階層の package.json でも scripts を比べる（fix-review-findings の仮定 A-04）
const isPackageJson = (f: string) => f.split('/').pop() === 'package.json';

const scriptsOf = (root: string, env: NodeJS.ProcessEnv, rev: string, file: string): string => {
  const r = spawnSync('git', ['show', `${rev}:${file}`], { cwd: root, env, encoding: 'utf8' });
  if (r.status !== 0) return '{}';
  try {
    return JSON.stringify((JSON.parse(r.stdout) as { scripts?: unknown }).scripts ?? {});
  } catch {
    return '{}';
  }
};

/**
 * エンジンの変更を index に載せ、HEAD との差分から不正な直し方を探す（REQ-109〜REQ-111、仮定 A-20）。
 * 見つけたら、その差分を返す。変更は index に載ったままなので、呼び出し側で戻すかコミットする
 */
export function findViolations(root: string, env: NodeJS.ProcessEnv): { findings: GuardFinding[]; diff: string } {
  git(root, env, ['add', '-A']);
  const findings: GuardFinding[] = [];
  const status = git(root, env, ['diff', '--cached', '--name-status', '--no-renames']).split('\n').filter(Boolean);
  for (const line of status) {
    const [code, file] = line.split('\t');
    if (code === 'D' && isTestFile(file)) findings.push({ file, reason: 'テストファイルを消しました' });
    if (isConfigFile(file)) findings.push({ file, reason: '設定ファイルを変えました' });
    if (isPackageJson(file) && scriptsOf(root, env, 'HEAD', file) !== scriptsOf(root, env, '', file)) {
      findings.push({ file, reason: 'package.json の scripts を変えました' });
    }
    if (isSpecOrTrace(file)) findings.push({ file, reason: file.startsWith('openspec/specs/') ? 'いまの仕様を変えました' : 'trace.md を変えました' });
    if (code !== 'D') {
      const added = git(root, env, ['diff', '--cached', '-U0', '--', file])
        .split('\n')
        .filter((l) => l.startsWith('+') && !l.startsWith('+++'));
      for (const l of added) if (SKIP.test(l)) findings.push({ file, reason: `skip・todo を足しました：${l.slice(1).trim()}` });
    }
  }
  const files = [...new Set(findings.map((f) => f.file))];
  const diff = files.length ? git(root, env, ['diff', '--cached', '--', ...files]) : '';
  return { findings, diff };
}

/** 止まったときに、人が承認するための手順（add-run-guards の確認事項 Q-07） */
export const APPROVAL_GUIDE = [
  '変更はコミットせずに作業ツリーに残しました。',
  '承認するなら、差分を確かめたうえで tasks.md のそのタスクを完了にし、自分でコミットしてから、もう一度 loomake run を実行してください。',
  '承認しないなら、変更を元に戻してから、もう一度実行してください。',
].join('\n');
