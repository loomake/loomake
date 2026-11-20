import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it, expect } from 'vitest';
import { buildReport } from '../src/report.js';
import { main } from '../../cli/src/main.js';
import { traceMd, specMd } from '../../kit/test/project.js';
import { summaryFixture } from './summary-fixture.js';

describe('要約拡張と既存reportの互換性', () => {
  it('[REQ-460] 拡張前後の既存report出力を保ち、不正な最新から古い成功へ戻らずCLIで2を返す', async () => {
    const root = mkdtempSync(join(tmpdir(), 'loomake-summary-report-'));
    const write = (file: string, text: string) => { mkdirSync(dirname(join(root, file)), { recursive: true }); writeFileSync(join(root, file), text); };
    try {
      write('loomake.config.json', JSON.stringify({ commands: {} }));
      write('openspec/changes/sample/trace.md', traceMd()); write('openspec/changes/sample/specs/x/spec.md', specMd());
      const e = summaryFixture();
      const path = '.loomake/evidence/sample/20261105T000001Z-aaaaaaaaaaaa.json';
      const legacy = { schemaVersion: 2, change: e.change, sha: e.sha, committedAt: e.committedAt, recordedAt: e.recordedAt, verify: e.verify, storage: { future: null } };
      write(path, JSON.stringify(legacy)); const before = buildReport(root, 'sample'); expect(before).toBeDefined();
      write(path, JSON.stringify(e)); expect(buildReport(root, 'sample')).toEqual(before);
      for (const [invalid, reason] of [[{ ...e, summaryVersion: 2 }, '要約拡張の版'], [{ ...e, role: ['development'] }, 'role'], [{ ...e, role: { toString: null } }, 'role']] as const) {
        write('.loomake/evidence/sample/20261105T000002Z-aaaaaaaaaaaa.json', JSON.stringify(invalid));
        expect(() => buildReport(root, 'sample')).toThrow(reason);
        const out: string[] = [], err: string[] = [];
        expect(await main(['trace', 'report', '--change', 'sample'], { cwd: root, stdout: (s) => out.push(s), stderr: (s) => err.push(s) })).toBe(2);
        expect(err.join('\n')).toContain(reason); expect(err.join('\n')).toContain('20261105T000002Z-aaaaaaaaaaaa.json'); expect(out).toEqual([]);
      }
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});
