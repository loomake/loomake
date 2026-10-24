import { runExternal } from '@loomake/kit';
import { dirtyFiles, git } from './git.js';

/** 不正な直し方として見つけたもの */
export type GuardFinding = { file: string; reason: string };

// テストファイル（add-run-guards の仮定 A-17）
const isTestFile = (f: string) => /\.(test|spec)\./.test(f) || /(^|\/)(test|tests|__tests__)\//.test(f);
// skip・todo を足した行（A-17）。it.concurrent.skip のような修飾と、条件つきの skipIf・runIf も見る（fix-review-findings-2 の仮定 A-04）
const SKIP = /\b(it|test|describe|suite)(\.\w+)*\.(skip|todo|skipIf|runIf)\b|\bx(it|test|describe)\(/;
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
// いまの仕様と change の文書（A-19、fix-review-findings-2 の仮定 A-01）。openspecDir は loomake.config.json の値
const openspecPrefix = (dir: string) => `${dir.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, '')}/`;

// どの階層の package.json でも scripts を比べる（fix-review-findings の仮定 A-04）
const isPackageJson = (f: string) => f.split('/').pop() === 'package.json';

const scriptsOf = (root: string, env: NodeJS.ProcessEnv, rev: string, file: string): string => {
  const r = runExternal('git', ['show', `${rev}:${file}`], { cwd: root, env });
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
export function findViolations(root: string, env: NodeJS.ProcessEnv, openspecDir = 'openspec'): { findings: GuardFinding[]; diff: string } {
  const prefix = openspecPrefix(openspecDir);
  const specsDir = `${prefix}specs/`;
  const changesDir = `${prefix}changes/`;
  git(root, env, ['add', '-A']);
  const findings: GuardFinding[] = [];
  const status = git(root, env, ['diff', '--cached', '--name-status', '--no-renames', '-z']).split('\0');
  for (let i = 0; i + 1 < status.length; i += 2) {
    const code = status[i];
    const file = status[i + 1];
    if (code === 'D' && isTestFile(file)) findings.push({ file, reason: 'テストファイルを消しました' });
    if (isConfigFile(file)) findings.push({ file, reason: '設定ファイルを変えました' });
    if (isPackageJson(file) && scriptsOf(root, env, 'HEAD', file) !== scriptsOf(root, env, '', file)) {
      findings.push({ file, reason: 'package.json の scripts を変えました' });
    }
    if (file.startsWith(specsDir)) findings.push({ file, reason: 'いまの仕様を変えました' });
    else if (file.startsWith(changesDir)) findings.push({ file, reason: file.endsWith('/trace.md') ? 'trace.md を変えました' : 'change の文書を変えました' });
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

/** HEAD のコミットの SHA とブランチ名。コミットがなければ sha は空、detached なら branch は HEAD */
export type HeadState = { sha: string; branch: string };

export const headState = (root: string, env: NodeJS.ProcessEnv): HeadState => ({
  sha: (runExternal('git', ['rev-parse', '--verify', '-q', 'HEAD'], { cwd: root, env }).stdout ?? '').trim(),
  branch: (runExternal('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: root, env }).stdout ?? '').trim(),
});

/**
 * エンジンが自分でコミットしたかブランチを切り替えたかを、呼ぶ前の HEAD と比べて調べる（REQ-126）。
 * 変わっていれば、止まる理由と、人が確かめて戻すための表示を返す。run はエンジンのコミットを取り消さず、ブランチも戻さない
 */
export function findEngineMove(
  root: string,
  env: NodeJS.ProcessEnv,
  before: HeadState,
  changeBranch: string,
): { reason: string; report: string } | undefined {
  const after = headState(root, env);
  if (after.sha === before.sha && after.branch === before.branch) return undefined;
  const label = (s: HeadState) => `${s.branch} ${s.sha || '（コミットなし）'}`;
  const diff = before.sha && after.sha ? git(root, env, ['diff', before.sha, after.sha]) : '';
  const dirty = dirtyFiles(root, env);
  const report = [
    'エンジンが HEAD かブランチを変えました。run はエンジンのコミットを取り消さず、ブランチも戻していません。',
    `  呼ぶ前：${label(before)}`,
    `  呼んだ後：${label(after)}`,
    ...(diff ? ['', diff] : []),
    ...(dirty.length ? ['', 'コミットしていない変更：', ...dirty.map((l) => `  ${l}`)] : []),
    '',
    ...(before.sha && after.sha ? [`変更を確かめるには、git log --stat ${before.sha}..${after.sha} を実行してください。`] : []),
    `受け入れるなら、${changeBranch} のブランチで差分を確かめたうえで tasks.md のそのタスクを完了にし、自分でコミットしてから、もう一度 loomake run を実行してください。`,
    ...(before.sha
      ? [`元に戻すなら、git switch ${changeBranch} と git reset --hard ${before.sha} を実行してから、もう一度実行してください。エンジンの変更は消えます。`]
      : []),
  ].join('\n');
  return { reason: `エンジンが HEAD かブランチを変えました（${label(before)} → ${label(after)}）`, report };
}
