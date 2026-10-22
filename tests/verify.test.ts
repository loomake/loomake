// 試作の scripts/verify.mjs の回帰テスト。change の要件ではないので、テスト名に要件 ID を入れない
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const verify = join(import.meta.dirname, '..', 'scripts', 'verify.mjs');

const trace = `# Trace: c1

## 要件台帳

| ID | 出典 | 種別 | 要約（原文に忠実に） | 状態 | 反映先 |
|---|---|---|---|---|---|
| REQ-001 | 1 行目 | 機能 | a | 反映済 | specs/x/spec.md |
| REQ-002 | 2 行目 | 機能 | b | 反映済 | specs/x/spec.md |
| REQ-003 | 3 行目 | 機能 | c | 反映済 | specs/x/spec.md |
| REQ-004 | 4 行目 | 機能 | \`a \\| b\` を返す | 反映済 | specs/x/spec.md |

## 確認事項

| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 |
|---|---|---|---|---|---|---|

## 仮定

| ID | 関連 | 仮定の内容 | 理由 | 承認 |
|---|---|---|---|---|
`;

const spec = `## ADDED Requirements

### Requirement: x
x は動く SHALL。

Source: REQ-001, REQ-002, REQ-003, REQ-004

#### Scenario: x
- **WHEN** x
- **THEN** y
`;

const testFile = `
describe.skip('skip した describe', () => {
  it('[REQ-001] 中のテスト', () => {});
});
// it('[REQ-002] 行コメント', () => {});
/* it('[REQ-002] ブロックコメント', () => {}); */
it.skip(
  '[REQ-003] 複数行の skip',
  () => {},
);
it('[REQ-004] 有効なテスト', () => {
  const s = 'it.skip( // ではない';
  expect(s).toBeTruthy();
});
`;

let root: string;

function write(path: string, text: string) {
  mkdirSync(join(root, path, '..'), { recursive: true });
  writeFileSync(join(root, path), text);
}

function run(...args: string[]) {
  return spawnSync(process.execPath, [verify, ...args], { cwd: root, encoding: 'utf8' });
}

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'loomake-verify-'));
  write('loomake.config.json', JSON.stringify({ openspecValidate: false, tests: { dirs: ['tests'] }, commands: {} }));
  write('openspec/changes/c1/proposal.md', '# c1\n');
  write('openspec/changes/c1/tasks.md', '- [x] 1.1 done\n');
  write('openspec/changes/c1/trace.md', trace);
  write('openspec/changes/c1/specs/x/spec.md', spec);
  write('tests/x.test.ts', testFile);
});

afterAll(() => rmSync(root, { recursive: true, force: true }));

describe('verify.mjs', () => {
  it('skip・todo の中とコメントの要件 ID は数えず、有効なテストだけを数える', () => {
    const r = run('--change', 'c1', '--done', '--json');
    const out = JSON.parse(r.stdout);
    expect(out.coverage).toEqual({
      'REQ-001': [],
      'REQ-002': [],
      'REQ-003': [],
      'REQ-004': [join('tests', 'x.test.ts')],
    });
    expect(r.status).toBe(1);
  });

  it('表のセルの \\| は区切りではなく文字として読む', () => {
    const out = JSON.parse(run('--change', 'c1', '--spec-only', '--json').stdout);
    const failed = out.results.filter((x: { status: string }) => x.status === 'fail').map((x: { check: string }) => x.check);
    expect(failed).toEqual([]);
  });

  it('loomake.config.json が壊れているときは終了コード 2', () => {
    const dir = mkdtempSync(join(tmpdir(), 'loomake-verify-'));
    writeFileSync(join(dir, 'loomake.config.json'), '{');
    const r = spawnSync(process.execPath, [verify], { cwd: dir, encoding: 'utf8' });
    rmSync(dir, { recursive: true, force: true });
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('loomake.config.json を読めません');
  });
});
