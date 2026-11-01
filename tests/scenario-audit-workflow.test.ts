import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';

const ci = readFileSync(join(import.meta.dirname, '../.github/workflows/ci.yml'), 'utf8').replaceAll('\r\n', '\n');
function job(name: string) {
  const source = ci.match(new RegExp(`^ {2}${name}:\\n((?: {4}.*\\n|\\s*\\n)*)`, 'm'))![1]!;
  const steps = source.split(/\n(?= {6}- )/).filter((step) => /^ {6}- /.test(step));
  return { source, steps };
}
const audit = job('scenario-audit');
const node22 = job('node22');
const byId = (steps: string[], id: string) => {
  const step = steps.find((source) => new RegExp(`^ {6}(?:- | {2})id: ${id}$`, 'm').test(source));
  expect(step, id).toBeDefined();
  return step!;
};
const condition = (step: string) => step.match(/^ {6}(?:- | {2})if: (.*)$/m)![1]!;
function evaluate(expression: string, context: Record<string, unknown>) {
  return runInNewContext(expression.replace(/^\$\{\{\s*|\s*\}\}$/g, ''), context, { timeout: 1000 });
}
const steps = (report: string, dist: string) => ({ report: { outcome: report }, audit_dist: { outcome: dist } });

describe('Scenario 監査の既存 build を同一 run の成果物で省く', () => {
  it('Node22 の明示 build と既存互換性検査の後に core/kit dist だけを保存する', () => {
    const upload = byId(node22.steps, 'audit_dist_upload');
    const index = node22.steps.indexOf(upload);
    expect(node22.steps.slice(0, index).some((step) => step.includes('run: pnpm build'))).toBe(true);
    expect(node22.steps[index - 1]).toContain('deny-network.py node scripts/runtime-compatibility.mjs');
    expect(index).toBe(node22.steps.length - 1);
    expect(upload).toContain('actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02');
    expect(upload).not.toContain('continue-on-error');
    expect(upload).not.toMatch(/^ {6}(?:- | {2})if:/m);
    expect(upload).toContain('if-no-files-found: error');
    expect(upload).toContain('retention-days: 1');
    expect([...upload.matchAll(/^ {12}(packages\/.*)$/gm)].map((match) => match[1])).toEqual(['packages/core/dist', 'packages/kit/dist']);
    expect(node22.source).toContain('node-version: 22.12.0');
    expect(node22.source).toContain('deny-network.py node scripts/runtime-compatibility.mjs');
  });

  it('同じ run と attempt の dist だけを packages 下へ取得し、レポート欠落時は取得しない', () => {
    const download = byId(audit.steps, 'audit_dist');
    const upload = byId(node22.steps, 'audit_dist_upload');
    const name = (step: string) => step.match(/^ {10}name: (.*)$/m)![1]!;
    expect(name(upload)).toBe('scenario-audit-dist-${{ github.run_id }}-${{ github.run_attempt }}');
    expect(name(download)).toBe(name(upload));
    expect(download).toContain('actions/download-artifact@d3f86a106a0bac45b974a628896c90dbdf5c8093');
    expect(download).toContain('path: packages');
    expect(download).toContain('continue-on-error: true');
    expect(download).not.toMatch(/^ {10}(run-id|repository|github-token):/m);
    for (const report of ['success', 'failure', 'skipped']) {
      expect(evaluate(condition(download), { steps: steps(report, '') })).toBe(report === 'success');
    }
  });

  it('取得成功時だけ既存 build を省き、失敗や未取得では元の build に戻す', () => {
    const build = audit.steps.find((step) => step.includes('run: pnpm build'))!;
    expect(build).toBeDefined();
    expect(audit.steps.indexOf(build)).toBeGreaterThan(audit.steps.indexOf(byId(audit.steps, 'audit_dist')));
    for (const report of ['success', 'failure', 'skipped']) for (const dist of ['success', 'failure', 'skipped', '']) {
      expect(evaluate(condition(build), { steps: steps(report, dist) })).toBe(report === 'success' && dist !== 'success');
    }
    const install = audit.steps.find((step) => step.includes('run: pnpm install --frozen-lockfile'))!;
    expect(condition(install)).toBe("steps.report.outcome == 'success'");
  });

  it('品質ジョブだけを待ち、Node22 の未完了や失敗を新たな待ちや条件にしない', () => {
    expect(audit.source).toContain('needs: quality');
    expect(audit.source).not.toContain('needs: [');
    const jobCondition = audit.source.match(/^ {4}if: (.*)$/m)![1]!;
    for (const cancelled of [false, true]) {
      expect(evaluate(jobCondition, { cancelled: () => cancelled, success: () => false, needs: { node22: { result: 'failure' }, quality: { result: 'failure' } } })).toBe(!cancelled);
    }
    const report = byId(audit.steps, 'report');
    expect(report).toContain('name: ci-tests-${{ github.run_id }}-${{ github.run_attempt }}-ubuntu-latest-all');
    expect(report).toContain('continue-on-error: true');
    const warning = audit.steps.find((step) => step.includes('レポート（quality の ubuntu の artifact）を取得できなかった'))!;
    expect(condition(warning)).toBe("steps.report.outcome == 'failure'");
  });

  it('監査本体・失敗警告・監査成果物の保存と実行レポートを維持し、試験を再実行しない', () => {
    const run = byId(audit.steps, 'audit');
    expect(condition(run)).toBe("steps.report.outcome == 'success'");
    expect(run).toContain('continue-on-error: true');
    expect(run).toContain('run: node scripts/scenario-audit.mjs "$RUNNER_TEMP/loomake-scenario-audit" docs/quality/scenarios.json "$RUNNER_TEMP/loomake-ci-tests/test-report.json"');
    expect(audit.source).toContain("if: steps.audit.outcome == 'failure'");
    expect(audit.source).toContain("if: ${{ !cancelled() && (steps.audit.outcome == 'success' || steps.audit.outcome == 'failure') }}");
    expect(audit.source).toContain('name: scenario-audit-${{ github.run_id }}-${{ github.run_attempt }}');
    expect(audit.source).toContain('retention-days: 7');
    expect(audit.source).not.toMatch(/run: pnpm (?:test|verify)/);
  });
});
