#!/usr/bin/env node
// CI の完了ゲート。先に PR の段階（L1・L2・L3）を変えたファイルと spec の差分から決め（REQ-342、ci-tier.mjs）、
// 段階ごとに検査を変える（REQ-343）。L1 は lint と文書のリンクの試験を実行し、change がなければ verify を呼ばない。
// change があれば段階を問わず verify を呼ぶ（L2・L3 は --done、L1 は tasks.md に完了した印がない change だけ --spec-only）。L2・L3 は対象の change を、PR 本文の「loomake-change:」の行、PR で変えたファイル、ブランチ名から決め、
// それぞれに --change <id> --done を実行する（REQ-010・REQ-132）。L3 では change が必須。
// loomake run が作る loomake/<id> のブランチは、先頭の loomake/ を除いて比べる（fix-review-findings の仮定 A-01）
//
//   BASE_REF=<向き先のブランチ> PR_NUMBER=<PR の番号> node scripts/ci-gate.mjs <branch>
//
// PR 本文は、実行のたびに gh で読む。本文を書き直したら、gate のジョブを再実行すれば反映される（make-ci-change-selection-explicit の仮定 A-03）。
// PR_BODY を渡せば、gh を使わずにその文を本文として使う

import { appendFileSync, existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseRawDiff } from './ci-docs-only.mjs';
import { decideTier, formatTierLine, isDocumentPath, isSpecPath } from './ci-tier.mjs';

// change は changes/ の直下のディレクトリだけ。changes/archive/ は完了した change の置き場で、change ではない
const isChangeName = (name) => /^[^/\\.][^/\\]*$/.test(name) && name !== 'archive';
const isChangeDir = (changesDir, name) => isChangeName(name) && existsSync(join(changesDir, name)) && statSync(join(changesDir, name)).isDirectory();

/** ブランチ名から決めた verify の引数。一致する change がなければ空 */
export function verifyArgs(ref, changesDir) {
  const branch = ref.replace(/^loomake\//, '');
  return isChangeDir(changesDir, branch) ? ['--change', branch, '--done'] : [];
}

/** PR 本文の「loomake-change:」の行に書いた change-id。行がなければ undefined、none なら空 */
export function declaredChanges(body) {
  const m = body.match(/^[ \t]*loomake-change:[ \t]*(.*?)[ \t]*\r?$/m);
  if (!m) return undefined;
  if (m[1].toLowerCase() === 'none') return [];
  return [...new Set(m[1].split(',').map((s) => s.trim()).filter(Boolean))];
}

/**
 * 対象の change を決める。明示があれば明示だけを、なければ変えたファイルとブランチ名から決めた change を合わせて使う（仮定 A-02）。
 * 返すのは { changes }・{ qualityOnly: 理由 }・{ error: 理由 } のどれか
 * @param {{ ref?: string; body?: string; files?: string[]; changesDir: string; changesPrefix?: string }} options
 * @returns {{ changes: string[]; qualityOnly?: undefined; error?: undefined } | { qualityOnly: string; changes?: undefined; error?: undefined } | { error: string; changes?: undefined; qualityOnly?: undefined }}
 */
export function selectChanges({ ref = '', body = '', files = [], changesDir, changesPrefix = 'openspec/changes/' }) {
  const declared = declaredChanges(body);
  if (declared) {
    if (!declared.length) return { qualityOnly: 'PR 本文で、change のない PR だと明示しています' };
    const missing = declared.filter((id) => !isChangeDir(changesDir, id));
    if (missing.length) return { error: `PR 本文の loomake-change: に書いた change がありません：${missing.join('、')}` };
    return { changes: declared };
  }
  const fromFiles = files.filter((f) => f.startsWith(changesPrefix)).map((f) => f.slice(changesPrefix.length).split('/')[0]);
  const fromBranch = verifyArgs(ref, changesDir)[1];
  const changes = [...new Set([...fromFiles, fromBranch].filter((id) => id && isChangeDir(changesDir, id)))].sort();
  if (changes.length) return { changes };
  // 文書の判定は quality ジョブと同じ関数（ci-tier.mjs の isDocumentPath）。段階 L1 はここに来ないので、本文で段階を上げた文書だけの PR が当たる
  if (files.every(isDocumentPath)) return { qualityOnly: '対象の change がなく、変えたのは文書だけです' };
  return {
    error:
      'コードを変えていますが、対象の change を特定できませんでした。PR 本文に「loomake-change: <change-id>」の行を書いてください。change のない PR なら「loomake-change: none」と書いてください',
  };
}

/**
 * change ごとの verify の引数。段階が L1 で、tasks.md に完了した印（- [x]）が 1 つもなければ提案だけの change なので
 * --done ではなく --spec-only（仕様ゲート）で検査する。L2・L3 は完了数によらず常に --done（REQ-343）
 */
export function gateArgs(changesDir, id, tier) {
  if (tier !== 'L1') return ['--change', id, '--done'];
  const tasksPath = join(changesDir, id, 'tasks.md');
  const checked = existsSync(tasksPath) ? readFileSync(tasksPath, 'utf8').split('\n').filter((line) => /^\s*[-*]\s+\[[xX]\]/.test(line)).length : 1;
  return ['--change', id, checked ? '--done' : '--spec-only'];
}

/**
 * change の完了ゲート（--done）の結果を、CI の最終合格として受け入れるか（REQ-318）。受け入れないときは理由を返す。
 * verify 2.0.0 は ci・completed・要判断なし・verdict PASS・不合格や不足の検査なし・終了コード 0 のときだけ受け入れ、
 * local・partial・要判断・中止の結果は合格にしない。いまの書き出しの 1.0.0 は、ok:true・fail の検査なし・終了コード 0 なら
 * これまでどおり受け入れる（verify-v2-readers。1.0.0 を受け入れなくするのは verify-v2-wiring）。ci-gate の実行の流れにはまだつながない
 * @param {string} stdout verify --json の標準出力
 * @param {number} exitCode verify の終了コード
 * @returns {string | undefined}
 */
export function ciGateProblem(stdout, exitCode) {
  let result;
  try { result = JSON.parse(stdout); } catch { return 'verify の結果を JSON として読めません'; }
  if (!result || typeof result !== 'object' || Array.isArray(result)) return 'verify の結果が JSON のオブジェクトではありません';
  if (result.schemaVersion === '1.0.0') {
    if (result.ok !== true || !Array.isArray(result.results) || result.results.some((r) => r?.status === 'fail')) return 'verify の結果（1.0.0）が合格ではありません';
    return exitCode === 0 ? undefined : `verify の終了コードが 0 ではありません（${exitCode}）`;
  }
  if (result.schemaVersion !== '2.0.0') return `verify の結果の版に対応していません（${JSON.stringify(result.schemaVersion)}）`;
  const run = result.run && typeof result.run === 'object' ? result.run : {};
  if (run.status === 'aborted') {
    const errors = Array.isArray(run.errors) ? run.errors.map((e) => `${e?.kind}：${e?.message}`).join(' / ') : '';
    return `verify が実行エラーで中止されました（${errors}）`;
  }
  if (result.scope !== 'ci') return `scope が ci ではありません（${JSON.stringify(result.scope)}）。ローカルの結果は最終の合格にしません`;
  if (run.status !== 'completed') return `一部の証拠を取得できませんでした（${JSON.stringify(run.status)}）`;
  if (result.decision?.required !== false) return '人の判断が必要です';
  if (result.verdict !== 'PASS') return `verdict が PASS ではありません（${JSON.stringify(result.verdict)}）`;
  const checks = Array.isArray(result.checks) ? result.checks : [];
  const notPassed = checks.filter((c) => c?.result === 'FAIL' || c?.result === 'INSUFFICIENT_EVIDENCE').map((c) => c.id);
  if (!checks.length || notPassed.length) return `不合格か証拠不足の検査があります（${notPassed.join('、') || '検査なし'}）`;
  if (exitCode !== 0) return `verify の終了コードが 0 ではありません（${exitCode}）`;
  return undefined;
}

/** L1 で実行する検査。lint は loomake.config.json の commands.lint（既定 pnpm lint）、文書のリンクの試験は vitest で 1 ファイルだけ */
export function tierOneCommands(configPath = 'loomake.config.json') {
  let lint = 'pnpm lint';
  if (existsSync(configPath)) {
    const config = JSON.parse(readFileSync(configPath, 'utf8'));
    if (typeof config?.commands?.lint === 'string' && config.commands.lint) lint = config.commands.lint;
  }
  return [lint, 'pnpm exec vitest run tests/doc-links.test.ts'];
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const branch = process.argv[2] ?? '';
  const base = process.env.BASE_REF ?? '';
  const git = (args) => spawnSync('git', ['-c', 'core.quotePath=false', ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  let entries = [];
  let specDiff = '';
  if (base) {
    // ベースは refs/remotes/ から書く。「origin/main」とだけ書くと、同じ名前のタグやブランチ（refs/tags/origin/main など）が
    // 先に選ばれ、PR で変えたファイルを取り違える（REQ-272）。--raw -z -M で、名前の変更は変更前と変更後の両方を読む
    const range = `refs/remotes/origin/${base}...HEAD`;
    const r = git(['diff', '--raw', '-z', '-M', range]);
    if (r.status !== 0) {
      console.error(`ci-gate: PR で変えたファイルを調べられませんでした（${(r.stderr || r.error?.message || '').trim()}）`);
      process.exit(1);
    }
    try {
      entries = parseRawDiff(r.stdout ?? '');
    } catch (error) {
      console.error(`ci-gate: PR の差分を解釈できませんでした（${error.message}）`);
      process.exit(1);
    }
    // Requirement の本文の変更は、spec.md だけの -U0 の差分で見る（REQ-342）
    const specPaths = [...new Set(entries.flatMap((entry) => entry.paths).filter(isSpecPath))];
    if (specPaths.length) {
      const d = git(['diff', '-U0', range, '--', ...specPaths]);
      if (d.status !== 0) {
        console.error(`ci-gate: spec.md の差分を読めませんでした（${(d.stderr || d.error?.message || '').trim()}）`);
        process.exit(1);
      }
      specDiff = d.stdout ?? '';
    }
  }
  // 変更行が属する節を見るため、変更前と変更後（HEAD）の spec.md を読む。
  // 変更前は、差分（base...HEAD）と同じ起点になるよう、ベースと HEAD の merge-base のファイルを読む
  let mergeBase;
  const readSpec = (side, path) => {
    if (side === 'old' && mergeBase === undefined) {
      const m = git(['merge-base', `refs/remotes/origin/${base}`, 'HEAD']);
      mergeBase = m.status === 0 ? m.stdout.trim() : '';
    }
    const ref = side === 'new' ? 'HEAD' : mergeBase;
    if (!ref) return undefined;
    const r = git(['show', `${ref}:${path}`]);
    return r.status === 0 ? r.stdout : undefined;
  };
  const files = [...new Set(entries.flatMap((entry) => entry.paths))];
  let body = process.env.PR_BODY ?? '';
  if (process.env.PR_BODY === undefined && process.env.PR_NUMBER) {
    const r = spawnSync('gh', ['pr', 'view', process.env.PR_NUMBER, '--json', 'body', '-q', '.body'], { encoding: 'utf8' });
    if (r.status !== 0) {
      console.error(`ci-gate: PR 本文を読めませんでした（${(r.stderr || r.error?.message || '').trim()}）`);
      process.exit(1);
    }
    body = r.stdout;
  }
  const decided = decideTier({ entries, specDiff, body, readSpec });
  if (decided.error) {
    console.error(`ci-gate: ${decided.error}`);
    process.exit(1);
  }
  // 段階と理由は標準出力の 1 行に書く（進行の表示は標準エラー）。GITHUB_OUTPUT があれば後続のステップにも渡す（REQ-343）
  const tierLine = formatTierLine(decided).replace(/[\r\n%]/g, '');
  console.log(tierLine);
  // 複数行の値と同じ形（heredoc）で書く。区切りの語が値に現れないよう、改行と % は先に除いてある
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `tier=${decided.tier}\ntier_line<<LOOMAKE_TIER_EOF\n${tierLine}\nLOOMAKE_TIER_EOF\n`);

  const run = (cmd) => spawnSync(cmd, { shell: true, stdio: 'inherit' }).status ?? 1;
  // loomake verify は先に pnpm build しておく（CI の gate ジョブ）
  const verify = (args) => spawnSync(process.execPath, ['packages/cli/dist/cli.js', 'verify', ...args], { stdio: 'inherit' }).status ?? 1;
  let status = 0;
  if (decided.tier === 'L1') {
    // L1 は lint と文書のリンクの試験を実行する（REQ-343）。
    // 文書だけの PR では quality ジョブが品質コマンドを飛ばすので、文書を読む試験を回すのはここだけになる（docs/dev/ci.md）
    for (const cmd of tierOneCommands()) {
      console.error(`ci-gate: branch=${branch || '(なし)'} 段階 L1 → ${cmd}`);
      const code = run(cmd);
      if (code !== 0) status = code;
    }
  }
  const selected = selectChanges({ ref: branch, body, files, changesDir: join('openspec', 'changes') });
  if (selected.error) {
    console.error(`ci-gate: ${selected.error}`);
    process.exit(1);
  }
  if (selected.qualityOnly) {
    // change を持つ PR は段階を問わず --done を通す（AGENTS.md 2 章）。L1 で change がなければ verify は呼ばない
    if (decided.tier === 'L1') process.exit(status);
    if (decided.tier === 'L3') {
      console.error(`ci-gate: L3 では change が必須です（${selected.qualityOnly}）。PR 本文に「loomake-change: <change-id>」の行を書いてください`);
      process.exit(1);
    }
    console.error(`ci-gate: branch=${branch || '(なし)'} 段階 ${decided.tier} → verify（品質コマンドのみ。${selected.qualityOnly}）`);
    process.exit(verify([]));
  }
  for (const id of selected.changes) {
    const args = gateArgs(join('openspec', 'changes'), id, decided.tier);
    console.error(`ci-gate: branch=${branch || '(なし)'} 段階 ${decided.tier} → verify ${args.join(' ')}`);
    if (verify(args) !== 0) status = 1;
  }
  process.exit(status);
}
