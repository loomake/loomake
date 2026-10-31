import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { removeWithRetry } from './partition-fixture.js';
import type { RowReport, RowMarker } from './partition-rows-fixture.js';

type WiringCall = { group: 'success' | 'timeout' | 'error'; ids: readonly string[]; call: string };
// These calls are copied byte-for-byte from the immutable runtime API probe.
export const canonicalCalls: readonly WiringCall[] = [
  {
    "group": "success",
    "ids": [
      "r1-a",
      "r1-b",
      "r1-c",
      "r1-d"
    ],
    "call": "it.each(['a', 'b', 'c', 'd'])('case %#/%$ %s', function(...args) { const value=args[0]; expect(args).toHaveLength(1); mark('R1', 'abcd'.indexOf(value), value, args.length); });"
  },
  {
    "group": "success",
    "ids": [
      "r2-tuple12",
      "r2-tuple34"
    ],
    "call": "it.each([[1, 2], [3, 4]])('tuple %#', function(...args) { expect(args).toHaveLength(2); mark('R2tuple', args[0]===1?0:1, args, args.length); });"
  },
  {
    "group": "success",
    "ids": [
      "r2-scalar7",
      "r2-scalar8"
    ],
    "call": "it.each([7, 8])('scalar %#', function(...args) { expect(args).toHaveLength(1); mark('R2scalar', args[0]===7?0:1, args[0], args.length); });"
  },
  {
    "group": "success",
    "ids": [
      "r3-x",
      "r3-y"
    ],
    "call": "it.each(['x', 'y'])('duplicate', function(...args) { expect(args).toHaveLength(1); mark('R3', args[0]==='x'?0:1, args[0], args.length); });"
  },
  {
    "group": "success",
    "ids": [
      "r4-p-x"
    ],
    "call": "it.each(['x'])('p %s %% [.*+?]', function(...args) { expect(args).toHaveLength(1); mark('R4printf', 0, args[0], args.length); });"
  },
  {
    "group": "success",
    "ids": [
      "r4-pair-xy"
    ],
    "call": "it.each([['x', 'y']])('q %s %% z', function(...args) { expect(args).toHaveLength(2); mark('R4pair', 0, args, args.length); });"
  },
  {
    "group": "success",
    "ids": [
      "r4-obj-dollar",
      "r4-obj-plain"
    ],
    "call": "it.each([{ v: '$&' }, { v: 'plain' }])('obj $v %#', function(...args) { expect(args).toHaveLength(1); mark('R4object', args[0].v==='$&'?0:1, args[0], args.length); });"
  },
  {
    "group": "timeout",
    "ids": [
      "num-quick",
      "num-late"
    ],
    "call": "it.each(['quick', 'late'])('numeric %s', async (value) => { if(value==='late') await new Promise(resolve=>setTimeout(resolve, 220)); expect(value).toMatch(/quick|late/); }, 80);"
  },
  {
    "group": "timeout",
    "ids": [
      "opt-quick",
      "opt-late"
    ],
    "call": "it.each(['quick', 'late'])('options %s', {timeout:80}, async (value) => { if(value==='late') await new Promise(resolve=>setTimeout(resolve, 220)); expect(value).toMatch(/quick|late/); });"
  },
  {
    "group": "error",
    "ids": [
      "err-safe",
      "err-boom"
    ],
    "call": "it.each(['safe', 'boom'])('error %s', (value) => { if(value==='boom') throw new Error('row boom'); expect(value).toBe('safe'); });"
  }
];
export const nonliteralCall: WiringCall = {
  "group": "success",
  "ids": [
    "r2-empty",
    "r2-value"
  ],
  "call": "it.each([EMPTY, 'value'])('mixed %#', function(...args) { const value=args[0]; expect(args).toHaveLength(1); if(Array.isArray(value)) expect(value).toBe(EMPTY); else expect(value).toBe('value'); mark('R2mixed', Array.isArray(value)?0:1, value, args.length); });"
};
const repository = join(import.meta.dirname, '../..');
export type WiringMarker = Omit<RowMarker, 'part'>;
export const directCall = "it('direct a',()=>{expect('a').toBe('a');mark('direct',0,'a',0);});";
export function canonicalWiringSource(file: string, calls: readonly WiringCall[], marker: string, mode?: 'native' | 'falseHas' | 'shadow') {
  const ids = calls.flatMap(item => [...item.ids]);
  const direct = calls.some(item => item.group === 'success');
  const allIds = [...ids, ...(direct ? ['direct-a'] : [])];
  const common = `import {describe,it,expect} from 'vitest';
import {appendFileSync} from 'node:fs';
`;
  const header = mode === 'native' ? '' : `import {join} from 'node:path';
import {includeCase,loadPartition} from '../scripts/lib/test-partition.mjs';
import {currentPart,eachRows} from './helpers/partition-part.js';
const registry=loadPartition(join(import.meta.dirname,'..'));
const has=${mode === 'falseHas' ? '()=>true' : `(id)=>includeCase(registry,'${file}',currentPart(),id)`};
const hasAny=(ids)=>ids.some(has);
`;
  const mark = `const mark=(group,idx,value,argc)=>appendFileSync(${JSON.stringify(marker)},JSON.stringify({group,idx,value,argc})+'\\n');\n`;
  const body = calls.map(item => mode === 'native' ? item.call : `{const it=eachRows(has,${JSON.stringify(item.ids)});\n${item.call}\n}`).join('\n');
  const group = `${mode === 'native' ? '' : `if(hasAny(${JSON.stringify(ids)})) `}describe('rows',()=>{\n${mode === 'shadow' ? 'const has=()=>true;\n' : ''}${body}\n});\n`;
  const leaf = !direct ? '' : mode === 'native' ? directCall : mode === 'shadow' ? `{const has=()=>true;if(has('direct-a')) ${directCall}}` : `if(has('direct-a')) ${directCall}`;
  return { source: common + header + mark + group + leaf, ids: allIds };
}

export function partitionWiringFixture() {
  mkdirSync(join(repository, '.loomake'), { recursive: true });
  const root = realpathSync(mkdtempSync(join(repository, '.loomake/partition-wiring-')));
  for (const dir of ['tests/helpers', 'scripts/lib', 'cache', 'tmp', 'outputs']) mkdirSync(join(root, dir), { recursive: true });
  symlinkSync(join(repository, 'node_modules'), join(root, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
  for (const file of ['tests/helpers/partition-part.ts', 'scripts/lib/test-partition.mjs']) copyFileSync(join(repository, file), join(root, file));
  writeFileSync(join(root, 'package.json'), '{"type":"module"}');
  let serial = 0;
  return {
    root,
    run(options: { group?: 'success' | 'timeout' | 'error'; native?: boolean; slowIds?: readonly string[]; negative?: 'falseHas' | 'shadow' } = {}) {
      const id = String(++serial); const output = join(root, 'outputs', id); mkdirSync(output);
      const marker = join(output, 'markers.jsonl'); const reportPath = join(output, 'report.json'); const file = 'tests/canonical.test.ts';
      const calls = canonicalCalls.filter(item => item.group === (options.group ?? 'success'));
      const { source, ids } = canonicalWiringSource(file, calls, marker, options.native ? 'native' : options.negative);
      const cases = Object.fromEntries(ids.map(id => [id, options.slowIds?.includes(id) ? [process.platform] : []]));
      const registry = JSON.stringify({ files: { [file]: { cases } } });
      writeFileSync(join(root, 'tests/test-partition.json'), registry); writeFileSync(join(output, 'registry.json'), registry);
      writeFileSync(join(root, file), source);
      writeFileSync(join(root, 'tests/canonical.slow.test.ts'), "import {setPart} from './helpers/partition-part.js';setPart('slow');await import('./canonical.test.js');");
      const allocations = Object.values(cases).map(platforms => platforms.includes(process.platform));
      const include = options.native ? [file] : [...(allocations.some(slow => !slow) ? [file] : []), ...(allocations.some(Boolean) ? ['tests/canonical.slow.test.ts'] : [])];
      const config = join(output, 'vitest.config.mjs');
      writeFileSync(config, `export default ${JSON.stringify({ root, cacheDir: join(root, 'cache', id), test: { include, maxWorkers: 1, fileParallelism: false, reporters: ['json'], outputFile: reportPath } })};`);
      const result = spawnSync(process.execPath, [join(root, 'node_modules/vitest/vitest.mjs'), 'run', '--config', config, '--configLoader', 'native'], { cwd: root, encoding: 'utf8', timeout: 30000, env: { ...process.env, TMPDIR: join(root, 'tmp'), TMP: join(root, 'tmp'), TEMP: join(root, 'tmp') } });
      writeFileSync(join(output, 'process.json'), JSON.stringify({ status: result.status, signal: result.signal, error: result.error?.message, stdout: result.stdout, stderr: result.stderr }));
      const readback = readFileSync(join(root, file), 'utf8'); writeFileSync(join(output, 'source.ts'), readback);
      // Receipt readbacks share the disposable output and are removed by cleanup.
      const receipt = output;
      for (const [path, name] of [['tests/helpers/partition-part.ts','partition-part.ts'],['scripts/lib/test-partition.mjs','test-partition.mjs'],['tests/canonical.slow.test.ts','companion.ts']]) copyFileSync(join(root,path!),join(receipt,name!));
      return { ...result, source: readback, file, calls, ids, receipt, report: existsSync(reportPath) ? JSON.parse(readFileSync(reportPath, 'utf8')) as RowReport : undefined, markers: existsSync(marker) ? readFileSync(marker, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line) as WiringMarker) : [] };
    },
    cleanup() { removeWithRetry(root); },
  };
}
