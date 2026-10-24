import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { main } from '../src/main.js';
import { CHANGE, traceMd, withProject } from '../../kit/test/project.js';

async function run(root: string, ...argv: string[]) {
  const out: string[] = [];
  const err: string[] = [];
  const code = await main(argv, { cwd: root, stdout: (t) => out.push(t), stderr: (t) => err.push(t) });
  return { code, stdout: out.join('\n'), stderr: err.join('\n') };
}

const tracePath = (root: string) => join(root, 'openspec', 'changes', CHANGE, 'trace.md');
const read = (root: string) => readFileSync(tracePath(root), 'utf8');

// 回答者・回答日・承認者・承認日の列がある trace.md
const fullTrace = (answer = '', approval = '') =>
  traceMd({
    questions: [`| Q-01 | REQ-012 | 何回ですか | 3 / 5 | 5 | yes | ${answer} | | |`],
    assumptions: [`| A-01 | REQ-012 | 8 文字以上 | 一般的 | ${approval} | | |`],
  })
    .replace('| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 |\n|---|---|---|---|---|---|---|', '| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 | 回答者 | 回答日 |\n|---|---|---|---|---|---|---|---|---|')
    .replace('| ID | 関連 | 仮定の内容 | 理由 | 承認 |\n|---|---|---|---|---|', '| ID | 関連 | 仮定の内容 | 理由 | 承認 | 承認者 | 承認日 |\n|---|---|---|---|---|---|---|');

describe('確認事項の回答を書く', () => {
  it('[REQ-202] 回答・回答者・回答日を書き、仕様ゲートが通るようになる', async () => {
    await withProject({ trace: fullTrace() }, async (root) => {
      expect((await run(root, 'verify', '--change', CHANGE, '--spec-only')).code).toBe(1);
      const r = await run(root, 'trace', 'answer', '--change', CHANGE, '--question', 'Q-01', '--answer', '5 回', '--by', '顧客担当', '--date', '2026-10-24');
      expect(r.code, r.stderr).toBe(0);
      expect(read(root)).toContain('| Q-01 | REQ-012 | 何回ですか | 3 / 5 | 5 | yes | 5 回 | 顧客担当 | 2026-10-24 |');
      expect(r.stdout).toContain('--spec-only');
      expect((await run(root, 'verify', '--change', CHANGE, '--spec-only')).code).toBe(0);
    });
  });

  it('[REQ-202] 日付を省くと、その日の日付を書く', async () => {
    await withProject({ trace: fullTrace() }, async (root) => {
      await run(root, 'trace', 'answer', '--change', CHANGE, '--question', 'Q-01', '--answer', '5 回', '--by', '顧客担当');
      const d = new Date();
      const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      expect(read(root)).toContain(`| 5 回 | 顧客担当 | ${today} |`);
    });
  });

  it('[REQ-202] すでに回答があれば、変えずに終了コード 2', async () => {
    await withProject({ trace: fullTrace('3 回') }, async (root) => {
      const before = read(root);
      const r = await run(root, 'trace', 'answer', '--change', CHANGE, '--question', 'Q-01', '--answer', '5 回', '--by', 'x');
      expect(r.code).toBe(2);
      expect(r.stderr).toContain('すでに値があります');
      expect(read(root)).toBe(before);
    });
  });

  it('[REQ-202] ID がない・日付の形が違う・--by がないときは、変えずに終了コード 2', async () => {
    await withProject({ trace: fullTrace() }, async (root) => {
      const before = read(root);
      const base = ['trace', 'answer', '--change', CHANGE, '--answer', '5 回'];
      expect((await run(root, ...base, '--question', 'Q-09', '--by', 'x')).code).toBe(2);
      expect((await run(root, ...base, '--question', 'Q-01', '--by', 'x', '--date', '2026/10/24')).code).toBe(2);
      expect((await run(root, ...base, '--question', 'Q-01')).code).toBe(2);
      expect(read(root)).toBe(before);
    });
  });

  it('[REQ-202] 回答者・回答日の列がない古い表では、回答だけを書き、列がないことを示す', async () => {
    await withProject({ trace: traceMd({ questions: ['| Q-01 | REQ-012 | 何回ですか | 3 / 5 | 5 | yes | |'] }) }, async (root) => {
      const r = await run(root, 'trace', 'answer', '--change', CHANGE, '--question', 'Q-01', '--answer', '5 回', '--by', 'x', '--date', '2026-10-24');
      expect(r.code).toBe(0);
      expect(read(root)).toContain('| Q-01 | REQ-012 | 何回ですか | 3 / 5 | 5 | yes | 5 回 |');
      expect(r.stdout).toContain('回答者・回答日の列がない');
    });
  });
});

describe('仮定を承認する', () => {
  it('[REQ-203] 承認・承認者・承認日を書き、未承認の警告が消える', async () => {
    await withProject({ trace: fullTrace('5 回') }, async (root) => {
      expect((await run(root, 'verify', '--change', CHANGE, '--spec-only')).stdout).toContain('未承認：A-01');
      const r = await run(root, 'trace', 'approve', '--change', CHANGE, '--assumption', 'A-01', '--by', 'PM', '--date', '2026-10-24');
      expect(r.code, r.stderr).toBe(0);
      expect(read(root)).toContain('| A-01 | REQ-012 | 8 文字以上 | 一般的 | 承認 | PM | 2026-10-24 |');
      expect((await run(root, 'verify', '--change', CHANGE, '--spec-only')).stdout).not.toContain('未承認：A-01');
    });
  });
});

it('[REQ-135][REQ-202][REQ-203] traceのヘルプに4操作を案内し文書を変えない', async () => {
  await withProject({ trace: fullTrace() }, async (root) => {
    const before = read(root);
    const result = await run(root, 'trace', '--help');
    expect(result.code).toBe(0);
    for (const name of ['record', 'report', 'answer', 'approve']) expect(result.stdout).toContain(`loomake trace ${name}`);
    expect(result.stderr).toBe('');
    expect(read(root)).toBe(before);
  });
});
it.each(['answer', 'approve'])('[REQ-135][REQ-202][REQ-203] %sのヘルプで用途と記録する人を案内する', async (name) => {
  await withProject({ trace: fullTrace() }, async (root) => {
    const before = read(root);
    const result = await run(root, 'trace', name, '--help');
    expect(result.code).toBe(0);
    expect(result.stdout).toContain(`使い方: loomake trace ${name}`);
    expect(result.stdout).toContain('--by <');
    expect(result.stdout).toContain(name === 'answer' ? '確認事項' : '仮定');
    expect(result.stderr).toBe('');
    expect(read(root)).toBe(before);
  });
});

describe('合意の書き込みの境界', () => {
  it.each([
    ['answer', '\n'], ['answer', '\r\n'], ['approve', '\n'], ['approve', '\r\n'],
  ])('[REQ-202][REQ-203] %sは改行コード%jと対象外の全行を保ち、区切り文字をエスケープする', async (kind, eol) => {
    const original = fullTrace().replace(
      '| Q-01 |', '| Q-02 | REQ-012 | 別の質問 | a / b | a | no | b | 別担当 | 2026-10-01 |\n| Q-01 |',
    ).replace(/\n/g, eol);
    await withProject({ trace: original }, async (root) => {
      const before = read(root);
      const args = kind === 'answer' ? ['--question', 'Q-01', '--answer', '3|5'] : ['--assumption', 'A-01'];
      const r = await run(root, 'trace', kind, '--change', CHANGE, ...args, '--by', 'PM|顧客', '--date', '2024-02-29');
      expect(r.code, r.stderr).toBe(0);
      const oldRow = kind === 'answer'
        ? '| Q-01 | REQ-012 | 何回ですか | 3 / 5 | 5 | yes |  | | |'
        : '| A-01 | REQ-012 | 8 文字以上 | 一般的 |  | | |';
      const newRow = kind === 'answer'
        ? '| Q-01 | REQ-012 | 何回ですか | 3 / 5 | 5 | yes | 3\\|5 | PM\\|顧客 | 2024-02-29 |'
        : '| A-01 | REQ-012 | 8 文字以上 | 一般的 | 承認 | PM\\|顧客 | 2024-02-29 |';
      expect(before).toContain(oldRow);
      expect(read(root)).toBe(before.replace(oldRow, newRow));
      expect(r.stdout).toContain(kind === 'answer' ? 'Q-01' : 'A-01');
      expect(r.stdout).toContain('--spec-only');
    });
  });

  it.each(['answer', 'approve'])('[REQ-202][REQ-203] %sの不正入力はファイルを一切変えない', async (kind) => {
    for (const problem of ['date', 'newline', 'missing', 'filled'] as const) {
      const trace = fullTrace(problem === 'filled' && kind === 'answer' ? '元の回答' : '', problem === 'filled' && kind === 'approve' ? '承認' : '');
      await withProject({ trace }, async (root) => {
        const before = read(root);
        const args = kind === 'answer'
          ? ['--question', problem === 'missing' ? 'Q-99' : 'Q-01', '--answer', '5 回']
          : ['--assumption', problem === 'missing' ? 'A-99' : 'A-01'];
        const r = await run(root, 'trace', kind, '--change', CHANGE, ...args,
          '--by', problem === 'newline' ? '担当\n別人' : '担当', '--date', problem === 'date' ? '2026-02-29' : '2026-10-24');
        expect(r.code, `${kind}:${problem}`).toBe(2);
        expect(r.stderr, problem).toContain({ date: '実在する日', newline: '改行', missing: 'の行がありません', filled: 'すでに値があります' }[problem]);
        expect(read(root), problem).toBe(before);
      });
    }
  });

  it('[REQ-203] 古い仮定の表では承認だけを書き、列の不足と仕様ゲートを案内する', async () => {
    await withProject({ trace: traceMd({ assumptions: ['| A-01 | REQ-012 | 仮定 | 理由 | |'] }) }, async (root) => {
      const before = read(root);
      const r = await run(root, 'trace', 'approve', '--change', CHANGE, '--assumption', 'A-01', '--by', 'PM', '--date', '2026-10-24');
      expect(r.code, r.stderr).toBe(0);
      expect(read(root)).toBe(before.replace('| A-01 | REQ-012 | 仮定 | 理由 | |', '| A-01 | REQ-012 | 仮定 | 理由 | 承認 |'));
      expect(r.stdout).toContain('承認者・承認日の列がない');
      expect(r.stdout).toContain('--spec-only');
    });
  });
});
