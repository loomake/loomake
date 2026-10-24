import { expect, it, vi } from 'vitest';
import { main } from '../src/main.js';
import * as processes from '../../kit/src/runtime/process.js';
import { withProject } from '../../kit/test/project.js';

it('[REQ-041] 不正なchange-idはOpenSpecを含む外部操作を呼ばずに終了コード2を返す', async () => {
  const spy = vi.spyOn(processes, 'runExternal');
  try {
    for (const id of ['c1&echo', 'C1', 'c1_x', '-c1', 'c1-', 'a--b']) {
      await withProject({ config: { openspecValidate: true, commands: { test: 'node -e "process.exit(99)"' } } }, async (root) => {
        const out: string[] = [];
        const err: string[] = [];
        const code = await main(['verify', '--change', id, '--spec-only'], {
          cwd: root, stdout: (text) => out.push(text), stderr: (text) => err.push(text),
        });
        expect(code, id).toBe(2);
        expect(err.join('\n'), id).toContain('英小文字・数字');
        expect(out, id).toEqual([]);
        expect(spy, id).not.toHaveBeenCalled();
      });
    }
  } finally {
    spy.mockRestore();
  }
});
