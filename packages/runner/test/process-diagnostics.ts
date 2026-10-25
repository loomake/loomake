import { mkdirSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';

/** 任意のローカル診断。引き継いだ環境変数の値は記録しない。 */
export function attachProcessDiagnostics(base: string, env: NodeJS.ProcessEnv) {
  const directory = process.env.LOOMAKE_EXTERNAL_TEST_DIAGNOSTIC_DIR;
  if (!directory) return;
  mkdirSync(directory, { recursive: true });
  const output = join(directory, `${basename(base)}.processes.jsonl`);
  const preload = join(base, 'process-diagnostics.cjs');
  writeFileSync(preload, `if (process.argv[1]?.endsWith('supervisor.cjs')) {
    const fs = require('node:fs');
    const [target, args, , deadline] = JSON.parse(process.argv[2]);
    const event = (name, code) => {
      const file = ${JSON.stringify(output)};
      const used = fs.existsSync(file) ? fs.statSync(file).size : 0;
      if (used >= 65536) return;
      const row = { event: name, at: Date.now(), remainingMs: deadline - Number(process.hrtime.bigint()) / 1000000, pid: process.pid, target: String(target).slice(0,160), args: args.slice(0,4).map(value => String(value).slice(0,160)), code };
      fs.appendFileSync(file, Buffer.from(JSON.stringify(row) + '\\n').subarray(0, 65536 - used));
    };
    event('supervisor-entry');
    process.on('exit', code => event('supervisor-exit', code));
  }`);
  env.NODE_OPTIONS = `${env.NODE_OPTIONS ?? ''} --require=${JSON.stringify(preload)}`.trim();
}
