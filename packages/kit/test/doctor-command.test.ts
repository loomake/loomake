import { describe, expect, it } from 'vitest';
import { classifyCommand } from '../src/doctor/command.js';

describe('doctorの純粋なコマンド分類', () => {
  it.each([
    ['npm test', 'npm', 'test'], ['npm run lint', 'npm', 'lint'], ['npm run-script typecheck', 'npm', 'typecheck'],
    ['pnpm test', 'pnpm', 'test'], ['pnpm lint', 'pnpm', 'lint'], ['pnpm typecheck', 'pnpm', 'typecheck'],
    ['pnpm run build:check', 'pnpm', 'build:check'], ['pnpm run-script test', 'pnpm', 'test'],
    ['yarn run test', 'yarn', 'test'], ['yarn test', 'yarn', 'test'], ['npm run test -- --reporter=json', 'npm', 'test'],
  ])('[REQ-184] %sをscriptの存在確認として分類する', (command, manager, script) => {
    expect(classifyCommand(command)).toEqual({ kind: 'script', executable: manager, manager, script });
  });
  it.each(['node -e "console.log(1)"', '"/tools with space/node" test.js', 'vitest run'])('[REQ-185] %sは実行ファイルの検出範囲とする', (command) => {
    expect(classifyCommand(command).kind).toBe('direct');
  });
  it('[REQ-185] 引用した先頭の空白を保ち、Windowsのパスを壊さない', () => {
    expect(classifyCommand('"/tools with space/node" x')).toEqual({ kind: 'direct', executable: '/tools with space/node' });
    expect(classifyCommand('"C:\\Program Files\\nodejs\\node.exe" x', true)).toEqual({ kind: 'direct', executable: 'C:\\Program Files\\nodejs\\node.exe' });
  });
  it.each(['CI=1 pnpm test', 'pnpm test && echo ok', 'npm test > result', 'npm test | tee result', '$(tool) test', '"$TOOL" test', 'pnpm --filter app test', 'npm run test --workspace app', 'pnpm run "/^test/"', 'npm run', 'yarn --cwd app test', 'node "unterminated', 'node x\nnode y', 'node x;node y'])('[REQ-185] %sの対象を推測しない', (command) => {
    expect(classifyCommand(command)).toMatchObject({ kind: 'unsupported', reason: expect.any(String) });
  });
  it('[REQ-185] Windowsでは単一引用符をshellの引用として推測しない', () => {
    expect(classifyCommand("'a b' x", true).kind).toBe('unsupported');
  });
});
