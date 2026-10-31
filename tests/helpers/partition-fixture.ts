import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const repository = join(import.meta.dirname, '../..');
type Assertion = { fullName: string; status: string };
export type FixtureReport = { numPassedTests: number; numFailedTests: number; testResults: { name: string; assertionResults: Assertion[] }[] };
export type Marker = { event: string; dir?: string; project?: string };
export type WatchPhase = { phase: string; builds: string[]; exists: boolean[]; error?: string };

export function relevantSpecifications(root: string, quarantine: string[], profileDirectory: string) {
  const driver = join(root, '.loomake/partition-collect.mjs');
  writeFileSync(driver, `import {createVitest} from 'vitest/node';const ctx=await createVitest('test',{root:${JSON.stringify(root)},config:${JSON.stringify(join(root, 'vitest.config.ts'))},watch:false});try{const specs=await ctx.getRelevantTestSpecifications();console.log('PARTITION_SPECS='+JSON.stringify(specs.map(s=>({project:s.project.name,file:s.moduleId}))));}finally{await ctx.close();}`);
  const result = spawnSync(process.execPath, [driver], { cwd: root, encoding: 'utf8', timeout: 60000, env: { ...process.env, LOOMAKE_TEST_QUARANTINE_EXCLUDE: JSON.stringify(quarantine), LOOMAKE_TEST_PHASE_PROFILE_DIR: profileDirectory } });
  const line = result.stdout.split('\n').find((line) => line.startsWith('PARTITION_SPECS='));
  return { ...result, specs: line ? JSON.parse(line.slice('PARTITION_SPECS='.length)) as { project: string; file: string }[] : undefined };
}

export function partitionFixture() {
  mkdirSync(join(repository, '.loomake'), { recursive: true });
  const root = realpathSync(mkdtempSync(join(repository, '.loomake/partition-fixture-')));
  for (const path of ['tests', 'scripts/lib', 'packages']) mkdirSync(join(root, path), { recursive: true });
  symlinkSync(join(repository, 'node_modules'), join(root, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
  for (const path of ['vitest.config.ts', 'loomake.config.json', 'scripts/lib/test-partition.mjs', 'scripts/test-phase-profile.mjs', 'tests/packed-tarballs.ts']) copyFileSync(join(repository, path), join(root, path));
  copyFileSync(join(repository, 'tests/package-build.setup.ts'), join(root, 'tests/package-build.factory.ts'));
  writeFileSync(join(root, 'package.json'), '{"type":"module"}');
  writeFileSync(join(root, 'scripts/package-smoke.mjs'), 'export function buildAndPack(){throw new Error("fixtureは注入したbuildを使う")}');
  const registry: { files: Record<string, { cases: Record<string, string[]> }> } = { files: {
    'tests/routed.test.ts': { cases: { local: [process.platform], remote: [process.platform === 'win32' ? 'linux' : 'win32'], all: ['linux', 'darwin', 'win32'], fast: [] } },
    'tests/package-artifacts.test.ts': { cases: { packed: ['linux', 'darwin', 'win32'] } },
  } };
  const marker = join(root, 'markers.jsonl');
  const markerCode = `const mark=(value)=>appendFileSync(${JSON.stringify(marker)},JSON.stringify(value)+'\\n');`;
  writeFileSync(join(root, 'tests/package-build.setup.ts'), `
import {appendFileSync,existsSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {createPackageBuildSetup} from './package-build.factory.js';
${markerCode}
export default createPackageBuildSetup((dir)=>{mark({event:'build',dir});writeFileSync(join(dir,'artifact'),'fixture');if(existsSync(join(import.meta.dirname,'fail-build')))throw new Error('fixture build failed');});
`);
  // 登録callbackだけを分割し、case名/本体は同じ関数を使う。
  writeFileSync(join(root, 'tests/register.ts'), `
import {describe,it,expect,inject} from 'vitest';
import {appendFileSync,existsSync} from 'node:fs';
import {loadPartition,includeCase} from '../scripts/lib/test-partition.mjs';
import {packedTarballsEnv} from './packed-tarballs.js';
${markerCode}
export function register(file,part){const registry=loadPartition(import.meta.dirname+'/..');describe('logical suite',()=>{for(const id of Object.keys(registry.files[file].cases)){if(includeCase(registry,file,part,id)){it(id,()=>{if(file.includes('package-artifacts')||part==='slow'){const dir=packedTarballsEnv(inject('packedTarballs')).LOOMAKE_PACKED_TARBALLS;expect(existsSync(dir)).toBe(true);mark({event:'inject',dir,project:part==='slow'?'slow':'package'});}expect(id.length).toBeGreaterThan(0);});}}});}
`);
  for (const [file, body] of [
    ['tests/routed.test.ts', "register('tests/routed.test.ts','fast');"],
    ['tests/routed.slow.test.ts', "register('tests/routed.test.ts','slow');"],
    ['tests/package-artifacts.test.ts', "register('tests/package-artifacts.test.ts','fast');"],
    ['tests/package-artifacts.slow.test.ts', "register('tests/package-artifacts.test.ts','slow');"],
  ]) writeFileSync(join(root, file), `import {register} from './register.js';${body}`);
  writeFileSync(join(root, 'tests/ai-journeys.test.ts'), `import {it,expect,inject} from 'vitest';import {appendFileSync,existsSync} from 'node:fs';import {packedTarballsEnv} from './packed-tarballs.js';${markerCode}it('package companion consumer',()=>{const dir=packedTarballsEnv(inject('packedTarballs')).LOOMAKE_PACKED_TARBALLS;expect(existsSync(dir)).toBe(true);mark({event:'inject',dir,project:'package'});});`);
  writeFileSync(join(root, 'tests/unit.test.ts'), "import {it,expect} from 'vitest';it('unit independent',()=>expect(2).toBe(2));");
  const setRegistry = () => writeFileSync(join(root, 'tests/test-partition.json'), JSON.stringify(registry));
  setRegistry();
  const markers = (): Marker[] => existsSync(marker) ? readFileSync(marker, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line) as Marker) : [];
  const reset = () => rmSync(marker, { force: true });
  const run = (args: string[] = [], env: NodeJS.ProcessEnv = process.env) => {
    const reportPath = join(root, '.loomake/test-report.json');
    rmSync(reportPath, { force: true });
    const result = spawnSync(process.execPath, [join(repository, 'node_modules/vitest/vitest.mjs'), 'run', '--config', join(root, 'vitest.config.ts'), ...args], { cwd: root, env: { ...env, LOOMAKE_TEST_PHASE_PROFILE_DIR: join(root, '.loomake/profile') }, encoding: 'utf8', timeout: 60000 });
    const report = existsSync(reportPath) ? JSON.parse(readFileSync(reportPath, 'utf8')) as FixtureReport : undefined;
    return { ...result, report, markers: markers() };
  };
  const watch = () => {
    const driver = join(root, 'watch.mjs');
    writeFileSync(driver, `
import {createVitest} from 'vitest/node';
import {writeFileSync,existsSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
const root=${JSON.stringify(root)};
const read=()=>existsSync(${JSON.stringify(marker)})?readFileSync(${JSON.stringify(marker)},'utf8').split('\\n').filter(Boolean).map(JSON.parse):[];
const ctx=await createVitest('test',{root,config:join(root,'vitest.config.ts'),watch:true});
const phases=[];
const save=(phase,error)=>{const builds=read().filter(m=>m.event==='build').map(m=>m.dir);phases.push({phase,builds,exists:builds.map(d=>existsSync(d)),...(error?{error}:{})});};
try{
  await ctx.start();save('initial');
  const specs=await ctx.getRelevantTestSpecifications();
  await ctx.rerunTestSpecifications(specs.filter(s=>s.project.name==='unit'));save('unit');
  await ctx.rerunTestSpecifications(specs.filter(s=>s.project.name==='package'));save('package');
  writeFileSync(join(root,'tests/fail-build'),'fail');
  try{await ctx.rerunTestSpecifications(specs.filter(s=>s.project.name==='package'));save('failed-without-error');}
  catch(error){save('failed',error.message);}
}finally{await ctx.close();save('closed');}
console.log('PARTITION_WATCH='+JSON.stringify(phases));
`);
    const result = spawnSync(process.execPath, [driver], { cwd: root, env: { ...process.env, LOOMAKE_TEST_PHASE_PROFILE_DIR: join(root, '.loomake/profile') }, encoding: 'utf8', timeout: 60000 });
    const line = result.stdout.split('\n').find((line) => line.startsWith('PARTITION_WATCH='));
    return { ...result, phases: line ? JSON.parse(line.slice('PARTITION_WATCH='.length)) as WatchPhase[] : undefined };
  };
  return { root, registry, setRegistry, markers, marker, reset, run, watch, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}
