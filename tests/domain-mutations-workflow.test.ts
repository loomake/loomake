import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';

// 夜間の変異試験のジョブ（.github/workflows/quality-quarantine.yml の domain-mutations）。開発の仕組みなので要件 ID は付けない（ADR 0005）
const root = join(import.meta.dirname, '..');
// Windows のチェックアウトでは行末が CRLF になるので、LF にそろえて読む
const workflow = readFileSync(join(root, '.github/workflows/quality-quarantine.yml'), 'utf8').replace(/\r\n/g, '\n');
const start = workflow.indexOf('\n  domain-mutations:\n');
const rest = workflow.slice(start + 1);
const job = rest.slice(0, rest.slice(1).search(/\n {2}[a-z#][a-z0-9-]*/) + 1);
const steps = job.slice(job.indexOf('\n    steps:\n')).split(/\n(?= {6}- )/).filter((step) => /^ {6}- /.test(step));
const stepOf = (id: string) => steps.find((step) => new RegExp(`^ {6}(?:- | {2})id: ${id}$`, 'm').test(step));
// survived の段階の run を取り出し、作った results.json に bash と jq で当てる。jq は GitHub の ubuntu の実行環境に入っている
const hasTools = ['bash', 'jq'].every((tool) => spawnSync(tool, ['--version'], { encoding: 'utf8' }).status === 0);
function runSurvived(results: unknown) {
  const block = stepOf('survived')!.split('\n');
  const at = block.findIndex((line) => /^ {8}run: \|$/.test(line));
  const body = block.slice(at + 1);
  const end = body.findIndex((line) => line.trim() && !line.startsWith(' '.repeat(10)));
  const script = body.slice(0, end < 0 ? undefined : end).map((line) => line.slice(10)).join('\n') + '\n';
  const dir = mkdtempSync(join(tmpdir(), 'loomake-nightly-mutations-'));
  try {
    const out = join(dir, '.loomake/quality/domain-mutations-nightly');
    mkdirSync(out, { recursive: true });
    writeFileSync(join(out, 'results.json'), JSON.stringify(results));
    const summaryFile = join(dir, 'summary.md');
    const result = spawnSync('bash', ['-e', '-c', script], { cwd: dir, encoding: 'utf8', env: { ...process.env, GITHUB_STEP_SUMMARY: summaryFile } });
    expect(result.status, result.stderr).toBe(0);
    // Windows の jq は標準出力の行末を CRLF で書く。確かめたいのは jq の式と要約の中身で、ジョブは ubuntu でしか動かないので、行末は LF にそろえて読む
    return { survived: JSON.parse(readFileSync(join(out, 'survived.json'), 'utf8')), summary: readFileSync(summaryFile, 'utf8').replace(/\r\n/g, '\n') };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
const mutation = (id: string, status: string) => ({ id, label: `${id} の条件`, file: `packages/core/src/${id}.ts`, status, failedTests: [], reason: 'x' });

describe('夜間の変異試験のジョブ', () => {
  it('定期実行と手動実行のときだけ動き、PR と main への push では動かない', () => {
    expect(start).toBeGreaterThan(0);
    const condition = job.match(/^ {4}if: (.*)$/m)![1]!;
    const runs = (event_name: string) => Boolean(runInNewContext(condition, { github: { event_name } }));
    expect(runs('schedule')).toBe(true);
    expect(runs('workflow_dispatch')).toBe(true);
    expect(runs('pull_request')).toBe(false);
    expect(runs('push')).toBe(false);
  });

  it('ほかのジョブとつながず、失敗を隠さない', () => {
    expect(job).not.toMatch(/^ {4}needs:/m);
    expect(job).not.toContain('continue-on-error');
    expect(workflow).not.toMatch(/needs:.*domain-mutations/);
    expect(job).toMatch(/^ {4}timeout-minutes: \d+$/m);
  });

  it('変異試験を流し、生き残った変異の一覧を書いて、結果を artifact に残す', () => {
    expect(stepOf('mutations')).toContain('run: node scripts/domain-mutations.mjs .loomake/quality/domain-mutations-nightly');
    const survived = stepOf('survived')!;
    expect(survived).toContain('!cancelled()');
    expect(survived).toContain('select(.status == "survived")');
    expect(survived).toContain('survived.json');
    expect(survived).toContain('$GITHUB_STEP_SUMMARY');
    const upload = stepOf('upload')!;
    expect(upload).toContain('actions/upload-artifact@');
    expect(upload).toContain('!cancelled()');
    expect(upload).toContain('path: .loomake/quality/domain-mutations-nightly/');
    expect(steps.indexOf(stepOf('mutations')!)).toBeLessThan(steps.indexOf(survived));
    expect(steps.indexOf(survived)).toBeLessThan(steps.indexOf(upload));
  });

  it.skipIf(!hasTools)('生き残った変異と試行のエラーだけを survived.json と要約に書く', () => {
    const { survived, summary } = runSurvived({ ok: false, originalsUnchanged: true, baseline: { status: 'passed', tests: [] }, mutations: [mutation('m1', 'killed'), mutation('m2', 'survived'), mutation('m3', 'error'), mutation('m4', 'survived')] });
    expect(survived).toEqual({
      ok: false,
      originalsUnchanged: true,
      baseline: 'passed',
      survived: 2,
      errors: 1,
      mutations: ['m2', 'm3', 'm4'].map((id) => ({ id, label: `${id} の条件`, file: `packages/core/src/${id}.ts`, status: id === 'm3' ? 'error' : 'survived' })),
    });
    expect(summary).toBe([
      '## 変異試験（夜間）',
      '',
      'ok：false、元ファイルが変わっていない（originalsUnchanged）：true',
      '',
      '生き残った変異：2 件、試行のエラー：1 件（基準の試験：passed）',
      '',
      '- m2 m2 の条件（packages/core/src/m2.ts）：survived',
      '- m3 m3 の条件（packages/core/src/m3.ts）：error',
      '- m4 m4 の条件（packages/core/src/m4.ts）：survived',
      '',
    ].join('\n'));
  });

  it.skipIf(!hasTools)('基準の試験の前で止まった結果（baseline が null）でも要約を書く', () => {
    const { survived, summary } = runSurvived({ ok: false, originalsUnchanged: false, baseline: null, mutations: [] });
    expect(survived).toEqual({ ok: false, originalsUnchanged: false, baseline: '未実施', survived: 0, errors: 0, mutations: [] });
    expect(summary).toBe('## 変異試験（夜間）\n\nok：false、元ファイルが変わっていない（originalsUnchanged）：false\n\n生き残った変異：0 件、試行のエラー：0 件（基準の試験：未実施）\n\n');
  });
});
