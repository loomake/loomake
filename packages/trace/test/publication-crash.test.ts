import { describe, expect, it, vi } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { ModuleKind, ScriptTarget, transpileModule } from 'typescript';
import { publishEvidence } from '../src/publication.js';

// git やコマンドのプロセスを何度も起動するので、マシンの負荷が高いと既定の 5 秒を超えることがある
vi.setConfig({ testTimeout: 60_000 });

const source = join(import.meta.dirname, '../src/publication.ts');
const compilerOptions = { module: ModuleKind.ESNext, target: ScriptTarget.ES2022 };
const errors = 'data:text/javascript;base64,' + Buffer.from(transpileModule(
  readFileSync(join(import.meta.dirname, '../../kit/src/runtime/errors.ts'), 'utf8'), { compilerOptions },
).outputText).toString('base64');
const executableSource = transpileModule(
  readFileSync(source, 'utf8').replace("'@loomake/kit'", JSON.stringify(errors)), { compilerOptions },
).outputText;
const content = '{"ok":true}\n';

describe('証拠公開中の実プロセスの強制終了', () => {
  it.each(['during-write', 'before-publish', 'after-publish'])('[REQ-175][REQ-176] %sで終了しても最終JSONを保ち、所有者終了後の片付けから再開できる', async (phase) => {
    const root = mkdtempSync(join(tmpdir(), 'loomake-publication-crash-'));
    const file = join(root, 'evidence.json');
    // 実際のソースを変換し、ネイティブのファイル操作の境界でだけ待機させる。
    const script = `
      import fs from 'node:fs';
      import { syncBuiltinESMExports } from 'node:module';
      const source = ${JSON.stringify(executableSource)};
      const nativeOpen = fs.openSync;
      const nativeWrite = fs.writeFileSync;
      const nativeLink = fs.linkSync;
      let owned;
      const pause = () => { fs.writeSync(1, 'ready\\n'); Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0); };
      fs.openSync = (...args) => {
        const fd = nativeOpen(...args);
        if (String(args[0]).includes('.loomake-evidence-')) owned = fd;
        return fd;
      };
      fs.writeFileSync = (...args) => {
        if (${JSON.stringify(phase)} === 'during-write' && args[0] === owned) {
          nativeWrite(args[0], args[1].slice(0, 7)); pause();
        } else nativeWrite(...args);
      };
      fs.linkSync = (from, to) => {
        if (to !== ${JSON.stringify(file)}) return nativeLink(from, to);
        if (${JSON.stringify(phase)} === 'after-publish') nativeLink(from, to);
        pause();
      };
      syncBuiltinESMExports();
      const { publishEvidence } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
      publishEvidence(${JSON.stringify(file)}, ${JSON.stringify(content)});
    `;
    const child = spawn(process.execPath, ['--input-type=module', '-e', script], { stdio: ['ignore', 'pipe', 'pipe'] });
    const exited = once(child, 'close');
    let stderr = '';
    child.stderr.on('data', (data) => { stderr += data.toString(); });
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        once(child.stdout, 'data').then(([data]) => { expect(data.toString()).toBe('ready\n'); }),
        exited.then(() => { throw new Error(`待機点より前に終了しました：${stderr}`); }),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`待機点に到達しません：${stderr}`)), 10_000); }),
      ]);
      expect(child.kill('SIGKILL')).toBe(true);
      await exited;
      const temporary = readdirSync(root).filter((name) => name.startsWith(`.loomake-evidence-${child.pid}-`));
      expect(temporary).toHaveLength(1);
      expect(existsSync(file)).toBe(phase === 'after-publish');
      expect(readFileSync(join(root, temporary[0]), 'utf8')).toBe(phase === 'during-write' ? content.slice(0, 7) : content);
      if (phase === 'after-publish') expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({ ok: true });
      // closeを待って所有者の終了を確認した後、自分の一時名だけを取り除く。
      unlinkSync(join(root, temporary[0]));
      expect(publishEvidence(file, content)).toBe(phase !== 'after-publish');
      expect(readFileSync(file, 'utf8')).toBe(content);
      expect(readdirSync(root)).toEqual(['evidence.json']);
    } finally {
      if (timer) clearTimeout(timer);
      if (child.exitCode === null && child.signalCode === null) { child.kill('SIGKILL'); await exited; }
      rmSync(root, { recursive: true, force: true });
    }
  }, 30_000);
});
