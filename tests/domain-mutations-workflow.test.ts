import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
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
});
