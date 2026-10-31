import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { removeWithRetry } from './partition-fixture.js';

const repository = join(import.meta.dirname, '../..');
// Frozen native call bodies from the reviewed V2b mechanism experiment.
const calls = [
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
      "r2-empty",
      "r2-value"
    ],
    "call": "it.each([EMPTY, 'value'])('mixed %#', function(...args) { const value=args[0]; expect(args).toHaveLength(1); if(Array.isArray(value)) expect(value).toBe(EMPTY); else expect(value).toBe('value'); mark('R2mixed', Array.isArray(value)?0:1, value, args.length); });"
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
] as const;
export const expectedRowNames = [
  "rows case 0/1 a",
  "rows case 1/2 b",
  "rows case 2/3 c",
  "rows case 3/4 d",
  "rows mixed 0",
  "rows mixed 1",
  "rows tuple 0",
  "rows tuple 1",
  "rows scalar 0",
  "rows scalar 1",
  "rows duplicate",
  "rows duplicate",
  "rows p x % undefined [.*+?]",
  "rows q x % y z",
  "rows obj $& 0",
  "rows obj plain 1"
] as const;
export const rowIds = ["r1-a", "r1-b", "r1-c", "r1-d", "r2-empty", "r2-value", "r2-tuple12", "r2-tuple34", "r2-scalar7", "r2-scalar8", "r3-x", "r3-y", "r4-p-x", "r4-pair-xy", "r4-obj-dollar", "r4-obj-plain"] as const;
export const mixedSlowIds: readonly string[] = ["r1-b", "r1-d", "r2-empty", "r2-tuple34", "r2-scalar8", "r3-y", "r4-pair-xy", "r4-obj-dollar"];
export const expectedRowMarkers = [
  {
    "group": "R1",
    "idx": 0,
    "value": "a",
    "argc": 1
  },
  {
    "group": "R1",
    "idx": 1,
    "value": "b",
    "argc": 1
  },
  {
    "group": "R1",
    "idx": 2,
    "value": "c",
    "argc": 1
  },
  {
    "group": "R1",
    "idx": 3,
    "value": "d",
    "argc": 1
  },
  {
    "group": "R2mixed",
    "idx": 0,
    "value": [],
    "argc": 1
  },
  {
    "group": "R2mixed",
    "idx": 1,
    "value": "value",
    "argc": 1
  },
  {
    "group": "R2tuple",
    "idx": 0,
    "value": [
      1,
      2
    ],
    "argc": 2
  },
  {
    "group": "R2tuple",
    "idx": 1,
    "value": [
      3,
      4
    ],
    "argc": 2
  },
  {
    "group": "R2scalar",
    "idx": 0,
    "value": 7,
    "argc": 1
  },
  {
    "group": "R2scalar",
    "idx": 1,
    "value": 8,
    "argc": 1
  },
  {
    "group": "R3",
    "idx": 0,
    "value": "x",
    "argc": 1
  },
  {
    "group": "R3",
    "idx": 1,
    "value": "y",
    "argc": 1
  },
  {
    "group": "R4printf",
    "idx": 0,
    "value": "x",
    "argc": 1
  },
  {
    "group": "R4pair",
    "idx": 0,
    "value": [
      "x",
      "y"
    ],
    "argc": 2
  },
  {
    "group": "R4object",
    "idx": 0,
    "value": {
      "v": "$&"
    },
    "argc": 1
  },
  {
    "group": "R4object",
    "idx": 1,
    "value": {
      "v": "plain"
    },
    "argc": 1
  }
] as const;
export type RowReport = { testResults: { name: string; assertionResults: { fullName: string; status: string; failureMessages: string[] }[] }[] };
export type RowMarker = { part: string; group: string; idx: number; value: unknown; argc: number };

export function partitionRowsFixture() {
  mkdirSync(join(repository, '.loomake'), { recursive: true });
  const root = realpathSync(mkdtempSync(join(repository, '.loomake/partition-rows-')));
  for (const dir of ['tests/helpers', 'scripts/lib', 'cache', 'tmp', 'outputs']) mkdirSync(join(root, dir), { recursive: true });
  symlinkSync(join(repository, 'node_modules'), join(root, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
  for (const file of ['tests/helpers/partition-part.ts', 'scripts/lib/test-partition.mjs']) copyFileSync(join(repository, file), join(root, file));
  writeFileSync(join(root, 'package.json'), '{"type":"module"}');
  let serial = 0;
  return {
    root,
    run(options: { group?: 'success' | 'timeout' | 'error'; native?: boolean; slowIds?: readonly string[]; part?: 'fast' | 'slow' | 'both'; platform?: string; invalid?: 'length' | 'double' | 'tagged' | 'duplicate' } = {}) {
      const group = options.group ?? 'success'; const id = String(++serial); const output = join(root, 'outputs', id);
      mkdirSync(output); const marker = join(output, 'markers.jsonl'); const report = join(output, 'report.json');
      const chosen = calls.filter((item) => item.group === group);
      const ids = chosen.flatMap((item) => [...item.ids]);
      const source = 'tests/routed.test.ts';
      const cases: Record<string, string[]> = Object.fromEntries(ids.map((id) => [id, options.slowIds?.includes(id) ? [process.platform] : []]));
      writeFileSync(join(root, 'tests/test-partition.json'), JSON.stringify({ files: { [source]: { cases } } }));
      const header = `import {describe,it,expect} from 'vitest';
import {appendFileSync,writeFileSync} from 'node:fs';
import {includeCase,loadPartition,PartitionError} from '../scripts/lib/test-partition.mjs';
import {currentPart,eachRows} from './helpers/partition-part.js';
const part=currentPart();const registry=loadPartition(import.meta.dirname+'/..');
const has=id=>includeCase(registry,'tests/routed.test.ts',part,id,${JSON.stringify(options.platform ?? process.platform)});
const EMPTY=[];const mark=(group,idx,value,argc)=>appendFileSync(${JSON.stringify(marker)},JSON.stringify({part,group,idx,value,argc})+'\\n');
`;
      let body: string = chosen.map((item) => options.native ? item.call : `{ const it = eachRows(has, ${JSON.stringify(item.ids)});\n${item.call}\n}`).join('\n');
      if (options.invalid) {
        const invocations = {
          length: "eachRows(has,['r1-a']).each(['a','b'])('invalid',()=>mark('invalid',0,0,0));",
          double: "const wrapper=eachRows(has,['r1-a']);wrapper.each(['a'])('first',()=>{});wrapper.each(['a'])('second',()=>{});",
          tagged: "eachRows(has,['r1-a']).each`value\n${1}`('invalid',()=>mark('invalid',0,0,0));",
          duplicate: "eachRows(has,['r1-a','r1-a']).each(['a','b'])('invalid',()=>mark('invalid',0,0,0));",
        };
        body = `let caught;try{${invocations[options.invalid]}}catch(error){caught=error;}if(!(caught instanceof PartitionError))throw new Error('expected PartitionError instance');writeFileSync(${JSON.stringify(join(output, 'collection-error.json'))},JSON.stringify({partitionError:true,message:caught.message}));throw caught;`;
      }
      writeFileSync(join(root, source), header + `describe('rows',()=>{\n${body}\n});\n`);
      writeFileSync(join(root, 'tests/routed.slow.test.ts'), "import {setPart} from './helpers/partition-part.js';setPart('slow');await import('./routed.test.js');");
      const allocations = Object.values(cases).map((platforms) => platforms.includes(options.platform ?? process.platform));
      const include = options.native || options.part === 'fast' ? [source] : options.part === 'slow' ? ['tests/routed.slow.test.ts'] : [...(allocations.some((slow) => !slow) ? [source] : []), ...(allocations.some(Boolean) ? ['tests/routed.slow.test.ts'] : [])];
      const config = join(output, 'vitest.config.mjs');
      writeFileSync(config, `export default ${JSON.stringify({ root, cacheDir: join(root, 'cache', id), test: { include, maxWorkers: 1, fileParallelism: false, reporters: ['json'], outputFile: report } })};`);
      const result = spawnSync(process.execPath, [join(root, 'node_modules/vitest/vitest.mjs'), 'run', '--config', config, '--configLoader', 'native'], { cwd: root, encoding: 'utf8', timeout: 30000, env: { ...process.env, TMPDIR: join(root, 'tmp'), TMP: join(root, 'tmp'), TEMP: join(root, 'tmp') } });
      // Capture the process result before any assertion inspects it.
      writeFileSync(join(output, 'process.json'), JSON.stringify({ status: result.status, signal: result.signal, error: result.error?.message, stdout: result.stdout, stderr: result.stderr }));
      return { ...result, collectionError: existsSync(join(output, 'collection-error.json')) ? JSON.parse(readFileSync(join(output, 'collection-error.json'), 'utf8')) as { partitionError: boolean; message: string } : undefined, report: existsSync(report) ? JSON.parse(readFileSync(report, 'utf8')) as RowReport : undefined, markers: existsSync(marker) ? readFileSync(marker, 'utf8').trim().split('\n').filter(Boolean).map((line) => JSON.parse(line) as RowMarker) : [], source: readFileSync(join(root, source), 'utf8') };
    },
    cleanup() { removeWithRetry(root); },
  };
}
