import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { withProject } from './project.js';
import type { BodyEvidence } from '@loomake/core';
type Case = { fullName: string; status: string; meta: { loomakeBody?: BodyEvidence } };
type Report = { testResults: { assertionResults: Case[] }[] };
const vitestBin = join(dirname(createRequire(import.meta.url).resolve('vitest/package.json')), 'vitest.mjs');
// 実Vitestを4回起動するため、外部実行試験と同じ60秒枠を使う。fixtureのtimeoutは変えない。
it('[REQ-393] 公開取得器が52境界の原観測を保ち元のstatusと終了値を変えない', { timeout: 60_000 }, () => {
  const fixture = readFileSync(new URL('./fixtures/vitest-body-cases.mjs.txt', import.meta.url), 'utf8');
  const api = pathToFileURL(join(import.meta.dirname, '../src/index.ts')).href;
  const collect = (mode: string, filter?: string) => withProject({ quality: true, files: {
    'body-cases.test.mjs': fixture,
    'body.mjs': `import { chai } from 'vitest';import { createBodyRecorder as real } from ${JSON.stringify(api)};export const createBodyRecorder = ${JSON.stringify(mode)}==='identity'?()=> (_ctx,fn)=>fn():real;export const body=createBodyRecorder(chai);`,
  } }, root => {
    const run = spawnSync(process.execPath, [vitestBin, 'run', 'body-cases.test.mjs', '--reporter=json', '--outputFile=.loomake/test-report.json', ...(filter ? ['-t', filter] : [])], { cwd: root, encoding: 'utf8' });
    return { status: run.status, report: JSON.parse(readFileSync(join(root, '.loomake/test-report.json'), 'utf8')) as Report };
  });
  const reports = ['identity', 'adapter'].map(mode => collect(mode));
  const [plain, recorded] = reports.map(({ report }) => report.testResults.flatMap(file => file.assertionResults));
  expect(recorded).toHaveLength(52);
  expect(reports[1].status).toBe(reports[0].status);
  expect(recorded.map(t => [t.fullName, t.status])).toEqual(plain.map(t => [t.fullName, t.status]));
  const byId = Object.fromEntries(recorded.map(t => [t.fullName.match(/\[P\d+\]/)?.[0] ?? t.fullName, t] as const));
  const attempt = (id: string) => byId[id].meta.loomakeBody!.attempts;
  for (const id of ['P01','P02','P03','P07','P09','P10','P14','P21','P22','P36']) expect(attempt(`[${id}]`)[0].calls).toEqual({});
  for (const id of ['P04','P08','P11','P12','P13','P29','P31','P33']) expect(attempt(`[${id}]`)[0].calls).toEqual({toBe:1});
  for (const [id,key] of [['P05','toEqual'],['P06','toMatchObject'],['P15','not.toBe'],['P16','resolves.toBe'],['P17','rejects.toBe'],['P18','soft.toBe'],['P20','poll.toBe']]) expect(attempt(`[${id}]`)[0].calls).toEqual({[key]:1});
  expect(attempt('[P23]').map(a=>[a.repeat,a.retry,a.state,a.calls])).toEqual([[0,0,'fail',{toBe:1}],[0,1,'pass',{}]]);
  expect(attempt('[P26]').map(a=>[a.repeat,a.retry])).toEqual([[0,0],[0,1],[1,1],[1,2]]);
  expect(attempt('[P25]')).toHaveLength(3);
  expect(attempt('[P30]')).toMatchObject([{calls:{toBe:2}}]);
  expect(attempt('[P42]')).toMatchObject([{expectedFailure:true,state:'pass',calls:{toBe:1}}]);
  expect(attempt('[P04]')[0].expectedFailure).toBe(null);
  expect(attempt('[P52]')).toMatchObject([{state:null,calls:{}}]);
  expect(byId['[P32]'].meta).not.toHaveProperty('loomakeBody');
  for (const mode of ['identity', 'adapter']) {
    const clean = collect(mode, '\\[P(?:4[3-9]|5[0-2])\\]');
    expect(clean.status).toBe(0);
    expect(clean.report.testResults.flatMap(file => file.assertionResults).filter(t => t.status === 'passed')).toHaveLength(10);
  }
});
