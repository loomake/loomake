// 使い捨て: Windows で偽の git.exe（node のリンク）と .cmd の偽 CLI が監視役から呼ばれるかを試す
import { copyFileSync, linkSync, mkdirSync, mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, delimiter, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
const SUP = resolve('packages/kit/supervisor/supervisor.cjs');
const base = mkdtempSync(join(tmpdir(), 'probe-'));
const bin = join(base, 'bin'); mkdirSync(bin);
const log = join(base, 'log.jsonl');
const win = process.platform === 'win32';
const realGit = spawnSync(win ? 'where' : 'which', ['git'], { encoding: 'utf8' }).stdout.split(/\r?\n/)[0].trim();
console.log('realGit', realGit, 'execPath', process.execPath, 'tmp', base);
const exe = join(bin, win ? 'git.exe' : 'git');
const t0 = Date.now();
try { linkSync(process.execPath, exe); console.log('hardlink ok'); } catch (e) { console.log('hardlink failed', e.code); copyFileSync(process.execPath, exe); }
console.log('link ms', Date.now() - t0);
const preload = join(bin, 'git-shim.cjs');
writeFileSync(preload, `const p=require('node:path');if(p.basename(process.execPath).toLowerCase().replace(/\\.exe$/,'')==='git'){
const fs=require('node:fs');const cp=require('node:child_process');
const args=process.argv.length>1?[p.relative(process.cwd(),process.argv[1]),...process.argv.slice(2)]:[];
fs.appendFileSync(${JSON.stringify(log)},JSON.stringify({event:'shim-start',at:Date.now(),argv:process.argv,args})+'\\n');
if(args[0]==='stall'){fs.appendFileSync(${JSON.stringify(log)},JSON.stringify({event:'stall-start',at:Date.now()})+'\\n');process.on('SIGTERM',()=>{});Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,5000);process.exit(0);}
const r=cp.spawnSync(${JSON.stringify(realGit)},args,{stdio:'inherit'});
fs.appendFileSync(${JSON.stringify(log)},JSON.stringify({event:'forward-end',at:Date.now(),status:r.status,error:r.error&&r.error.code})+'\\n');
process.exit(r.status??1);}`);
writeFileSync(join(bin, 'gh'), `const fs=require('node:fs');const cp=require('node:child_process');fs.appendFileSync(${JSON.stringify(log)},JSON.stringify({event:'gh-start',args:process.argv.slice(2)})+'\\n');const r=cp.spawnSync(process.execPath,[${JSON.stringify(join(bin, 'gh-original'))},...process.argv.slice(2)],{stdio:'inherit'});fs.appendFileSync(${JSON.stringify(log)},JSON.stringify({event:'gh-forward-end',status:r.status,error:r.error&&r.error.code})+'\\n');process.exit(r.status??1);`);
writeFileSync(join(bin, 'gh-original'), `#!/usr/bin/env node\nconsole.log('original gh', process.argv.slice(2).join(' '));`);
writeFileSync(join(bin, 'gh.cmd'), '@node "%~dp0gh" %*\r\n');
const env = { ...process.env, PATH: `${bin}${delimiter}${process.env.PATH}`, NODE_OPTIONS: `--require=${JSON.stringify(preload)}` };
function sup(command, args, shell, ms = 3000) {
  const start = Date.now();
  const now = Number(process.hrtime.bigint()) / 1e6;
  const r = spawnSync(process.execPath, [SUP, JSON.stringify([command, args, shell, now + ms, 1 << 20])], { cwd: base, env, stdio: ['ignore', 'pipe', 'pipe', 'pipe'] });
  console.log(JSON.stringify({ command, args, ms: Date.now() - start, stdout: r.stdout?.toString(), stderr: r.stderr?.toString(), outcome: r.output?.[3]?.toString(), error: r.error?.code }));
}
spawnSync(realGit, ['init', '-q'], { cwd: base });
for (let i = 0; i < 3; i++) sup('git', ['rev-parse', '--absolute-git-dir'], false);
sup('git', ['stall'], false, 1500);
sup('gh', ['auth', 'status'], win);
sup('gh', ['pr', 'list', '--head', '"x y"'], win);
console.log(readFileSync(log, 'utf8'));
