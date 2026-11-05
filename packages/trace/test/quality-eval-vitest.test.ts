import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { readFileSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { sha256Hex } from '@loomake/kit';
import { testRunIncomplete } from '../src/quality-execution.js';
import { fixture, git } from './quality-eval-fixtures.js';

const require = createRequire(import.meta.url);
const vitestPackage = require.resolve('vitest/package.json');
const vitestRoot = dirname(vitestPackage);
const producer = JSON.parse(readFileSync(vitestPackage, 'utf8')) as { name: string; version: string };
vi.setConfig({ testTimeout: 30_000 });
describe('P1実測と実Vitestの完了境界', () => {
  it('[REQ-429] 元のP1全4レポートをそのまま照合し通常失敗だけ測定へ進める', () => {
    expect(producer).toMatchObject({ name: 'vitest', version: '5.0.5' });
    for (const name of ['normal', 'normal-wrapper0', 'bail1', 'bail1-wrapper0']) {
      const text = readFileSync(new URL(`./fixtures/quality-p1/${name}.json`, import.meta.url), 'utf8');
      const result = testRunIncomplete({ text, sha256: sha256Hex(text), path: name }, producer, name.endsWith('wrapper0') ? 0 : 1);
      if (name.startsWith('normal')) expect(result).toBeUndefined(); else expect(result).toBeTypeOf('string');
    }
  });
  it('[REQ-429] 同じ6試験を実Vitestで通常/bailと各wrapper0まで実collectorで検査する', async () => {
    const f = fixture();
    rmSync(join(f.root, 'node_modules/vitest'), { recursive: true });
    symlinkSync(vitestRoot, join(f.root, 'node_modules/vitest'), process.platform === 'win32' ? 'junction' : 'dir');
    writeFileSync(join(f.root, 'package.json'), '{"type":"module"}');
    writeFileSync(join(f.root, 'vitest.config.mjs'), `import {defineConfig} from 'vitest/config';import {BaseSequencer} from 'vitest/node';class Ordered extends BaseSequencer{async sort(files){return [...files].sort((a,b)=>a.moduleId.localeCompare(b.moduleId));}}export default defineConfig({test:{include:['*.test.mjs'],maxWorkers:1,fileParallelism:false,sequence:{sequencer:Ordered},cache:false}});`);
    for (let i = 1; i <= 3; i++) writeFileSync(join(f.root, `0${i}.test.mjs`), `import {it,expect} from 'vitest';it('file${i}-first',()=>expect(1).toBe(${i === 1 ? 2 : 1}));it('file${i}-second',()=>expect(1).toBe(1));`);
    for (const [bail, wrapper] of [[false, false], [true, false], [false, true], [true, true]]) {
      const args = [join(vitestRoot, 'vitest.mjs'), 'run', '--reporter=json', '--outputFile=.loomake/test-report.json', ...(bail ? ['--bail=1'] : [])];
      writeFileSync(join(f.root, 'quality-command.cjs'), `const r=require('node:child_process').spawnSync(process.execPath,${JSON.stringify(args)},{encoding:'utf8'});require('node:fs').writeFileSync('.loomake/child-output.log',String(r.stdout)+String(r.stderr));process.exitCode=${wrapper ? '0' : 'r.status??3'};`);
      git(f.root, 'add', '.'); git(f.root, 'commit', '-q', '-m', `fixture-${bail}-${wrapper}`);
      expect(await f.evaluate()).toBe(0);
      const saved = f.storage().index; expect(saved?.commands[0].result).toBe(wrapper ? 'passed' : 'failed');
      if (bail) {
        expect(saved?.observations[0].status).toBe('not_run'); expect(saved?.observations[0]).not.toHaveProperty('value');
      } else expect(saved?.observations[0], f.read('.loomake/child-output.log')).toMatchObject({ status: 'measured', value: 1, samples: 6 });
    }
    expect(f.storage().ledgers.history).toHaveLength(4);
  });
});
