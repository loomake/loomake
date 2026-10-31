// C-001 の 5/6 の受入（REQ-319）。git の一時リポジトリで実際の Vitest を動かし、同じ CLI と関数 API の結果を比べる。
// 成功例に手書きの ok:true や適格の印を使わず、Vitest が書き出したレポートと verify が集めた事実だけで判定させる
import { describe, it, expect, vi } from 'vitest';
import { chmodSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadVerifyResultSchemas, type VerifyResult } from '@loomake/core';
import { loadVerifyQualitySchema, runVerify, verifyExitCode } from '@loomake/kit';
import { main } from '../src/main.js';
import { CHANGE, commitAll, requirement, specMd, vitestCommand, withProject } from '../../kit/test/project.js';

vi.setConfig({ testTimeout: 120_000 });

const { verifyResultSchema } = await loadVerifyResultSchemas();
const qualitySchema = await loadVerifyQualitySchema();

const TEST_FILE = "it('[REQ-012] 動く', () => {});\n";

// CI=1 で、確認を受け付けない入出力で動かす
async function cli(root: string, ...argv: string[]) {
  const out: string[] = [];
  const saved = process.env.CI;
  process.env.CI = '1';
  try {
    const code = await main(['verify', '--change', CHANGE, ...argv, '--json'], { cwd: root, stdout: (t) => out.push(t), stderr: () => {} });
    const result = JSON.parse(out.join('\n')) as VerifyResult;
    expect(verifyResultSchema.safeParse(result).success, out.join('\n')).toBe(true);
    return { code, result };
  } finally {
    if (saved === undefined) delete process.env.CI;
    else process.env.CI = saved;
  }
}

const api = (root: string, gate: 'done' | 'spec-only' = 'done', extra: { skipCommands?: boolean } = {}) => {
  const result = runVerify({ root, qualitySchema, changeId: CHANGE, gate, ...extra });
  expect(verifyResultSchema.safeParse(result).success, JSON.stringify(result)).toBe(true);
  return { code: verifyExitCode(result), result };
};

const resultOf = (r: VerifyResult, id: string) => ('checks' in r ? r.checks?.find((c) => c.id === id)?.result : undefined);
const verdictOf = (r: VerifyResult) => ('verdict' in r ? r.verdict : undefined);
const errorKinds = (r: VerifyResult) => r.run.errors.map((e) => e.kind);

const vitestProject = { config: { openspecValidate: false, commands: { test: vitestCommand() } }, files: { 'tests/a.test.ts': TEST_FILE } };

// 1 回目は Vitest を動かしてレポートを .loomake/saved.json にも残し、2 回目からは残したレポートを写すだけの test コマンド
const REPLAY = [
  "import { copyFileSync, existsSync, mkdirSync } from 'node:fs';",
  "import { execSync } from 'node:child_process';",
  "mkdirSync('.loomake', { recursive: true });",
  "if (existsSync('.loomake/saved.json')) copyFileSync('.loomake/saved.json', '.loomake/test-report.json');",
  `else { execSync(${JSON.stringify(vitestCommand())}, { stdio: 'inherit' }); copyFileSync('.loomake/test-report.json', '.loomake/saved.json'); }`,
  '',
].join('\n');

// root では読めないファイルを作れない。Windows は chmod で読み取りを禁止できない
const canDenyRead = process.platform !== 'win32' && process.getuid?.() !== 0;

describe('C-001 の成功経路と不足拒否', () => {
  it('[REQ-319] 最小の quality.yaml と実際の Vitest の結果から、CLI と関数 API はともに ci の PASS と終了コード 0 を返す', async () => {
    await withProject({ ...vitestProject, quality: true }, async (root) => {
      for (const { code, result } of [api(root), await cli(root, '--done')]) {
        expect(code, JSON.stringify(result)).toBe(0);
        expect(result).toMatchObject({ scope: 'ci', run: { status: 'completed' }, verdict: 'PASS' });
        expect(resultOf(result, 'quality:subjects')).toBe('PASS');
        expect(resultOf(result, 'quality:PQ-900')).toBe('PASS');
      }
    });
  });

  it('[REQ-319] quality.yaml の誤りは aborted の 2、不在は aborted の 3。仕様ゲートでも誤りは 2 になる', async () => {
    await withProject({ ...vitestProject, quality: 'version: 2\nproduct: [\n' }, async (root) => {
      for (const { code, result } of [api(root), await cli(root, '--done'), api(root, 'spec-only'), await cli(root, '--spec-only')]) {
        expect(code).toBe(2);
        expect(result.run.status).toBe('aborted');
        expect(errorKinds(result)).toEqual(['config']);
      }
    });
    await withProject({ ...vitestProject, quality: true }, async (root) => {
      rmSync(join(root, 'quality.yaml'));
      commitAll(root, 'quality.yaml を消す');
      for (const { code, result } of [api(root), await cli(root, '--done')]) {
        expect(code).toBe(3);
        expect(result.run.status).toBe('aborted');
        expect(errorKinds(result)).toEqual(['runtime']);
      }
      // 仕様ゲートは quality.yaml がなくても止めない
      expect(api(root, 'spec-only').code).toBe(0);
    });
  });

  it.runIf(canDenyRead)('[REQ-319] quality.yaml を読む権限がなければ aborted の 3 を返す', async () => {
    await withProject({ ...vitestProject, quality: true }, async (root) => {
      chmodSync(join(root, 'quality.yaml'), 0o000);
      try {
        for (const { code, result } of [api(root), await cli(root, '--done')]) {
          expect(code).toBe(3);
          expect(errorKinds(result)).toEqual(['permission']);
        }
      } finally {
        chmodSync(join(root, 'quality.yaml'), 0o644);
      }
    });
  });

  it('[REQ-319] 品質コマンドを省いた・テストランナーを確かめられないときは、INSUFFICIENT_EVIDENCE と終了コード 1 を返す', async () => {
    await withProject({ ...vitestProject, quality: true }, async (root) => {
      for (const { code, result } of [api(root, 'done', { skipCommands: true }), await cli(root, '--done', '--skip-commands')]) {
        expect(code).toBe(1);
        expect(verdictOf(result)).toBe('INSUFFICIENT_EVIDENCE');
        expect(resultOf(result, 'quality:PQ-900')).toBe('INSUFFICIENT_EVIDENCE');
      }
      // node_modules/vitest を外すと、レポートを書いた実行器と版を確かめられない
      rmSync(join(root, 'node_modules', 'vitest'), { recursive: true, force: true });
      for (const { code, result } of [api(root), await cli(root, '--done')]) {
        expect(code).toBe(1);
        expect(verdictOf(result)).toBe('INSUFFICIENT_EVIDENCE');
        expect(resultOf(result, 'quality:PQ-900')).toBe('INSUFFICIENT_EVIDENCE');
      }
    });
  });

  it('[REQ-319] 正常に実行したあとで対象のコミットや必須の仕様を変え、前回の成功のレポートだけを置いても、ci の PASS を返さない', async () => {
    await withProject({ config: { openspecValidate: false, commands: { test: 'node replay.mjs' } }, files: { 'tests/a.test.ts': TEST_FILE, 'replay.mjs': REPLAY }, quality: true }, async (root) => {
      expect(api(root).result).toMatchObject({ verdict: 'PASS' });
      // 対象のコミットを変える
      writeFileSync(join(root, 'notes.txt'), '別の変更\n');
      commitAll(root, '対象を変える');
      for (const { code, result } of [api(root), await cli(root, '--done')]) {
        expect(code).toBe(1);
        expect(verdictOf(result)).toBe('INSUFFICIENT_EVIDENCE');
        expect(resultOf(result, 'quality:PQ-900')).toBe('INSUFFICIENT_EVIDENCE');
      }
      // 必須の仕様（差分仕様の Requirement）を変える
      writeFileSync(join(root, 'openspec', 'changes', CHANGE, 'specs', 'x', 'spec.md'), specMd(requirement('書き換えた振る舞い')));
      commitAll(root, '必須の仕様を変える');
      for (const { code, result } of [api(root), await cli(root, '--done')]) {
        expect(code).toBe(1);
        expect(verdictOf(result)).toBe('INSUFFICIENT_EVIDENCE');
        expect(resultOf(result, 'quality:PQ-900')).toBe('INSUFFICIENT_EVIDENCE');
      }
    });
  });

  it('[REQ-319] 品質コマンドが 0 以外で終わったら、テストのレポートが成功でも ci の PASS を返さない', async () => {
    const config = { openspecValidate: false, commands: { test: `${vitestCommand()} && node -e "process.exit(1)"` } };
    await withProject({ ...vitestProject, config, quality: true }, async (root) => {
      for (const { code, result } of [api(root), await cli(root, '--done')]) {
        expect(code).toBe(1);
        expect(verdictOf(result)).toBe('FAIL');
        expect(resultOf(result, 'command: test')).toBe('FAIL');
        // quality:PQ-900 の観測が終了状態を見るかは確認事項 Q-09 で扱う。ここでは全体が PASS にならないことを確かめる
      }
    });
  });
});
