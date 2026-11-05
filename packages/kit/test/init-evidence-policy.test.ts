import { readFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it, expect } from 'vitest';
import { loadQualitySchema } from '@loomake/core';
import { runInit } from '../src/index.js';
import { parse } from 'yaml';

const schema = await loadQualitySchema();
describe('initの証跡保管方針', () => {
  it('[REQ-396] 未設定の品質目標と保管既定値を同じ雛形に置く', () => {
    const template = readFileSync(join(import.meta.dirname, '..', 'templates/quality.yaml'), 'utf8');
    const quality = schema.qualitySchema.parse(parse(template));
    expect(quality.evidence).toEqual({ artifact_retention: '90d', long_term_store: 'github-release', long_term_retention: '5y', access: 'project-members', delete_policy: 'owner-approval' });
    expect(quality.product).toEqual({}); expect(quality.objectives).toEqual({}); expect(quality.version).toBe(2);
  });
  it('[REQ-396] initで配置し一覧に含め既存の設定ファイルへ品質目標を混ぜない', async () => {
    const root = mkdtempSync(join(tmpdir(), 'loomake-init-policy-'));
    try {
      mkdirSync(join(root, '.git')); const out: string[] = [];
      expect(await runInit({ root, stdout: (s) => out.push(s), interactive: false, confirm: async () => true })).toBe(0);
      expect(out.join('\n')).toContain('quality.yaml');
      const value = parse(readFileSync(join(root, 'quality.yaml'), 'utf8')); expect(value.evidence.artifact_retention).toBe('90d');
      const config = JSON.parse(readFileSync(join(root, 'loomake.config.json'), 'utf8')); expect(config).not.toHaveProperty('objectives'); expect(config).not.toHaveProperty('evidence');
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});
