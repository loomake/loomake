import { describe, it, expect } from 'vitest';
import { main } from '../src/main.js';
import { CHANGE, withProject } from '../../kit/test/project.js';

async function run(root: string, ...argv: string[]) {
  const out: string[] = [];
  const err: string[] = [];
  const code = await main(argv, { cwd: root, stdout: (t) => out.push(t), stderr: (t) => err.push(t) });
  return { code, stdout: out.join('\n'), stderr: err.join('\n') };
}

describe('設定の誤り', () => {
  it.each([
    ['JSON のオブジェクトでない', [], 'loomake.config.json は JSON のオブジェクトにしてください'],
    ['openspecDir が文字列でない', { openspecDir: 1 }, 'openspecDir は文字列にしてください'],
    ['openspecValidate の値が違う', { openspecValidate: 'yes' }, 'openspecValidate は true・false・"auto" のどれかにしてください'],
    ['tests がオブジェクトでない', { tests: 'x' }, 'tests はオブジェクトにしてください'],
    ['tests.report が空', { tests: { report: '' } }, 'tests.report は空でない文字列にしてください'],
    ['commands の値が文字列でない', { commands: { test: 1 } }, 'commands は、値が文字列（または null）のオブジェクトにしてください'],
  ])('[REQ-041] %s設定は、理由を日本語で示して終了コード 2', async (_name, config, message) => {
    const r = await withProject({ config: config as never }, (root) => run(root, 'verify', '--change', CHANGE, '--spec-only'));
    expect(r.code).toBe(2);
    expect(r.stderr).toContain(message);
  });
});

describe('CLI の使い方の誤り', () => {
  it.each([
    ['--spec-only と --done を両方付ける', ['verify', '--change', CHANGE, '--spec-only', '--done'], '--spec-only と --done は同時に指定できません'],
    ['--change だけでゲートを付けない', ['verify', '--change', CHANGE], '--change を指定するときは --spec-only か --done を付けてください'],
    ['trace の知らない形式', ['trace', 'report', '--change', CHANGE, '--format', 'xml'], '--format は md か json にしてください：xml'],
    ['trace のサブコマンドがない', ['trace'], 'record・report・answer・approve のどれかを指定してください'],
    ['trace の知らないサブコマンド', ['trace', 'recrd'], 'もしかして：record'],
    ['trace answer の ID がない', ['trace', 'answer', '--change', CHANGE], '--change <id> と --question <ID> が必要です'],
  ])('[REQ-041] %sと、理由を日本語で示して終了コード 2', async (_name, argv, message) => {
    const r = await withProject({}, (root) => run(root, ...argv));
    expect(r.code).toBe(2);
    expect(r.stderr).toContain(message);
  });
});
