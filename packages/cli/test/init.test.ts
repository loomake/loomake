import { describe, it, expect } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, sep } from 'node:path';
import { unifiedDiff } from '@loomake/kit';
import { main } from '../src/main.js';

const template = (p: string) => readFileSync(join(import.meta.dirname, '..', '..', 'kit', 'templates', p), 'utf8');

// シンボリックリンクはたどらない（リンク先は実体の側で数える）
const listFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isSymbolicLink() ? [] : e.isDirectory() ? listFiles(join(dir, e.name)) : [join(dir, e.name)],
  );

type InitRun = {
  code: number;
  stdout: string;
  /** 確認で出された質問 */
  prompts: string[];
  /** 実行後のファイル（ルートからの / 区切りのパス → 中身） */
  files: Record<string, string>;
};

/**
 * 一時ディレクトリに files を置いて loomake init を実行し、実行後のファイルを読んでから消す。
 * answers を与えると確認を受け付けられる環境（TTY）とみなし、確認に順に答える。与えなければ TTY でない環境とみなす。
 * setup は files を置いたあと、実行の前に呼ぶ（シンボリックリンクを作るなど）
 */
async function runInit(
  args: string[] = [],
  { files = {}, answers, setup }: { files?: Record<string, string>; answers?: string[]; setup?: (root: string) => void } = {},
): Promise<InitRun> {
  const root = mkdtempSync(join(tmpdir(), 'loomake-init-'));
  try {
    for (const [p, text] of Object.entries(files)) {
      mkdirSync(dirname(join(root, p)), { recursive: true });
      writeFileSync(join(root, p), text);
    }
    setup?.(root);
    const out: string[] = [];
    const prompts: string[] = [];
    const queue = [...(answers ?? [])];
    const code = await main(['init', ...args], {
      cwd: root,
      stdout: (t) => out.push(t),
      stderr: (t) => out.push(t),
      interactive: answers !== undefined,
      prompt: async (q) => {
        prompts.push(q);
        return queue.shift() ?? '';
      },
    });
    const after = Object.fromEntries(listFiles(root).map((f) => [relative(root, f).split(sep).join('/'), readFileSync(f, 'utf8')]));
    return { code, stdout: out.join('\n'), prompts, files: after };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

const config = (r: InitRun) => JSON.parse(r.files['loomake.config.json']);
const MINE = '# 自分の AGENTS.md\n';

describe('基本ファイルの配置', () => {
  it('[REQ-019] 空のプロジェクトで AGENTS.md・CLAUDE.md・loomake.config.json・.claude/skills/req-to-openspec/SKILL.md を作る', async () => {
    const r = await runInit();
    expect(r.code).toBe(0);
    expect(Object.keys(r.files)).toEqual(expect.arrayContaining(['AGENTS.md', 'CLAUDE.md', 'loomake.config.json', '.claude/skills/req-to-openspec/SKILL.md']));
    expect(r.files['AGENTS.md']).toBe(template('AGENTS.md'));
    expect(r.files['CLAUDE.md']).toBe(template('CLAUDE.md'));
    expect(r.files['.claude/skills/req-to-openspec/SKILL.md']).toBe(template('skills/req-to-openspec/SKILL.md'));
    // Skill の参照ファイルとテンプレートも一緒に置く
    expect(r.files['.claude/skills/req-to-openspec/references/ambiguity-checklist.md']).toBeDefined();
    expect(r.files['.claude/skills/req-to-openspec/templates/trace.md']).toBeDefined();
  });

  it('[REQ-019] loomake.config.json の tests.report が .loomake/test-report.json になり、Vitest と Jest の設定例を表示する', async () => {
    const r = await runInit();
    expect(config(r).tests.report).toBe('.loomake/test-report.json');
    expect(r.stdout).toContain("outputFile: { json: '.loomake/test-report.json' }");
    expect(r.stdout).toContain('jest --json --outputFile=.loomake/test-report.json');
  });

  it('置いた loomake.config.json を verify が読める', async () => {
    const r = await runInit();
    expect(config(r)).toMatchObject({ openspecDir: 'openspec', openspecValidate: 'auto' });
  });
});

describe('既存ファイルの保護', () => {
  it('[REQ-020] 内容の異なる AGENTS.md があり、確認で拒否すると、差分を表示して AGENTS.md を変えない', async () => {
    const r = await runInit([], { files: { 'AGENTS.md': MINE }, answers: ['n'] });
    expect(r.code).toBe(0);
    expect(r.prompts).toEqual(['AGENTS.md を上書きしますか [y/N] ']);
    expect(r.stdout).toContain('--- AGENTS.md（いまのファイル）');
    expect(r.stdout).toContain('-# 自分の AGENTS.md');
    expect(r.files['AGENTS.md']).toBe(MINE);
    expect(r.stdout).toContain('上書きしなかった：AGENTS.md');
  });

  it('[REQ-020] 何も入力せずに Enter を押すと、上書きしない', async () => {
    const r = await runInit([], { files: { 'AGENTS.md': MINE }, answers: [''] });
    expect(r.files['AGENTS.md']).toBe(MINE);
  });

  it('[REQ-020] 内容の異なる AGENTS.md があり、確認で承諾すると、テンプレートの内容に置き換える', async () => {
    const r = await runInit([], { files: { 'AGENTS.md': MINE }, answers: ['y'] });
    expect(r.code).toBe(0);
    expect(r.files['AGENTS.md']).toBe(template('AGENTS.md'));
    expect(r.stdout).toContain('上書き：AGENTS.md');
  });

  it('[REQ-020] 標準入力が TTY でないとき、内容の異なる AGENTS.md があれば差分を表示し、何も作成・変更せずに終了コード 1', async () => {
    const r = await runInit([], { files: { 'AGENTS.md': MINE } });
    expect(r.code).toBe(1);
    expect(r.prompts).toEqual([]);
    expect(r.stdout).toContain('-# 自分の AGENTS.md');
    expect(r.files).toEqual({ 'AGENTS.md': MINE });
  });

  it('[REQ-020] テンプレートと同じ内容の AGENTS.md があれば、確認を求めず、変更しない', async () => {
    const r = await runInit([], { files: { 'AGENTS.md': template('AGENTS.md') }, answers: [] });
    expect(r.code).toBe(0);
    expect(r.prompts).toEqual([]);
    expect(r.files['AGENTS.md']).toBe(template('AGENTS.md'));
    expect(r.stdout).toContain('変更なし：AGENTS.md');
  });

  it('[REQ-020] 改行コードだけが違う AGENTS.md は同じ内容とみなし、確認を求めず、変更しない', async () => {
    const crlf = template('AGENTS.md').replace(/\r?\n/g, '\r\n');
    const r = await runInit([], { files: { 'AGENTS.md': crlf }, answers: [] });
    expect(r.prompts).toEqual([]);
    expect(r.files['AGENTS.md']).toBe(crlf);
  });

  it('[REQ-020] TTY でなくても、同名ファイルがすべて同じ内容なら、残りのファイルを置いて終了コード 0', async () => {
    const r = await runInit([], { files: { 'AGENTS.md': template('AGENTS.md') } });
    expect(r.code).toBe(0);
    expect(r.files['CLAUDE.md']).toBe(template('CLAUDE.md'));
  });
});

describe('既存ファイルの保護：シンボリックリンク', () => {
  // プロジェクトの外の場所。テストごとに作って消す
  const withOutside = async (fn: (outside: string) => Promise<void>) => {
    const outside = mkdtempSync(join(tmpdir(), 'loomake-outside-'));
    try {
      await fn(outside);
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  };
  const SECRET = '外のファイルの中身\n';

  it('[REQ-020] AGENTS.md がプロジェクトの外のファイルを指すリンクなら、中身を表示せず、何も置かずに終了コード 1', () =>
    withOutside(async (outside) => {
      writeFileSync(join(outside, 'target.md'), SECRET);
      const r = await runInit([], { answers: ['y'], setup: (root) => symlinkSync(join(outside, 'target.md'), join(root, 'AGENTS.md'), 'file') });
      expect(r.code).toBe(1);
      expect(r.prompts).toEqual([]);
      expect(r.stdout).not.toContain('外のファイルの中身');
      expect(r.stdout).toContain('AGENTS.md はシンボリックリンクを通ってプロジェクトの外を指しています');
      expect(r.files).toEqual({});
      expect(readFileSync(join(outside, 'target.md'), 'utf8')).toBe(SECRET);
    }));

  it('[REQ-020] .claude がプロジェクトの外のディレクトリを指すリンクなら、リンク先に何も作らず、何も置かずに終了コード 1', () =>
    withOutside(async (outside) => {
      const r = await runInit([], { setup: (root) => symlinkSync(outside, join(root, '.claude'), 'dir') });
      expect(r.code).toBe(1);
      expect(r.files).toEqual({});
      expect(readdirSync(outside)).toEqual([]);
    }));

  it('[REQ-020] AGENTS.md がリンク先の無いリンクなら、リンク先を作らず、何も置かずに終了コード 1', () =>
    withOutside(async (outside) => {
      const missing = join(outside, 'missing.md');
      const r = await runInit([], { setup: (root) => symlinkSync(missing, join(root, 'AGENTS.md'), 'file') });
      expect(r.code).toBe(1);
      expect(r.stdout).toContain('AGENTS.md はリンク先の無いシンボリックリンクです');
      expect(r.files).toEqual({});
      expect(existsSync(missing)).toBe(false);
    }));

  it('[REQ-020] .claude/skills がプロジェクトの中の .agents/skills を指すリンクなら、これまでどおりリンク先に Skill を置く', async () => {
    const r = await runInit([], {
      setup: (root) => {
        mkdirSync(join(root, '.agents', 'skills'), { recursive: true });
        mkdirSync(join(root, '.claude'));
        symlinkSync(join(root, '.agents', 'skills'), join(root, '.claude', 'skills'), 'dir');
      },
    });
    expect(r.code).toBe(0);
    expect(r.files['.agents/skills/req-to-openspec/SKILL.md']).toBe(template('skills/req-to-openspec/SKILL.md'));
  });

  it('[REQ-020] リンク先がプロジェクトの中の .. で始まる名前のディレクトリなら、外とはみなさずに Skill を置く', async () => {
    const r = await runInit([], {
      setup: (root) => {
        mkdirSync(join(root, '..claude-real'));
        symlinkSync(join(root, '..claude-real'), join(root, '.claude'), 'dir');
      },
    });
    expect(r.code).toBe(0);
    expect(r.files['..claude-real/skills/req-to-openspec/SKILL.md']).toBe(template('skills/req-to-openspec/SKILL.md'));
  });
});

describe('Codex 向けの Skill 配置', () => {
  it('[REQ-021] --codex を指定すると、.claude/skills/ と .agents/skills/ の両方に Skill を置く', async () => {
    const r = await runInit(['--codex']);
    const skill = template('skills/req-to-openspec/SKILL.md');
    expect(r.files['.claude/skills/req-to-openspec/SKILL.md']).toBe(skill);
    expect(r.files['.agents/skills/req-to-openspec/SKILL.md']).toBe(skill);
  });

  it('[REQ-021] --codex を指定しなければ、.agents/skills/ を作らない', async () => {
    const r = await runInit();
    expect(Object.keys(r.files).filter((p) => p.startsWith('.agents/'))).toEqual([]);
  });
});

describe('devcontainer の配置', () => {
  it('[REQ-022] --devcontainer を指定すると、.devcontainer/devcontainer.json を作る', async () => {
    const r = await runInit(['--devcontainer']);
    expect(r.files['.devcontainer/devcontainer.json']).toBe(template('devcontainer/devcontainer.json'));
    // Node 24 のイメージを使い、OpenSpec CLI を入れる（add-init-cli の仮定 A-04）
    expect(r.files['.devcontainer/devcontainer.json']).toMatch(/typescript-node:(\d+-)?24(-|")/);
    expect(r.files['.devcontainer/devcontainer.json']).toContain('@fission-ai/openspec');
  });

  it('[REQ-022] --devcontainer を指定しなければ、.devcontainer/ を作らない', async () => {
    const r = await runInit();
    expect(Object.keys(r.files).filter((p) => p.startsWith('.devcontainer/'))).toEqual([]);
  });
});

describe('OpenSpec 初期化の案内', () => {
  it('[REQ-023] openspec/ が無ければ、openspec init の実行を案内する', async () => {
    const r = await runInit();
    expect(r.stdout).toContain('openspec init を実行してください');
  });

  it('[REQ-023] openspec/ があれば、openspec init を案内しない', async () => {
    const r = await runInit([], { files: { 'openspec/project.md': '# project\n' } });
    expect(r.stdout).not.toContain('openspec init');
  });
});

describe('パッケージマネージャの判定', () => {
  const pkg = (packageManager: string) => ({ 'package.json': JSON.stringify({ packageManager }) });

  it('[REQ-024] packageManager が pnpm@9.0.0 なら、commands は pnpm lint・pnpm typecheck・pnpm test', async () => {
    const r = await runInit([], { files: pkg('pnpm@9.0.0') });
    expect(config(r).commands).toEqual({ lint: 'pnpm lint', typecheck: 'pnpm typecheck', test: 'pnpm test' });
  });

  it('[REQ-024] packageManager が npm@10.0.0 なら、commands は npm run lint・npm run typecheck・npm test', async () => {
    const r = await runInit([], { files: pkg('npm@10.0.0') });
    expect(config(r).commands).toEqual({ lint: 'npm run lint', typecheck: 'npm run typecheck', test: 'npm test' });
  });

  it('[REQ-024] packageManager が yarn@4.0.0 なら、commands は yarn lint・yarn typecheck・yarn test', async () => {
    const r = await runInit([], { files: pkg('yarn@4.0.0') });
    expect(config(r).commands).toEqual({ lint: 'yarn lint', typecheck: 'yarn typecheck', test: 'yarn test' });
  });

  it('packageManager が無ければロックファイルで判定し、どれも無ければ npm にする（仮定 A-01）', async () => {
    expect(config(await runInit([], { files: { 'package.json': '{}', 'pnpm-lock.yaml': '' } })).commands.test).toBe('pnpm test');
    expect(config(await runInit([], { files: { 'package.json': '{}', 'yarn.lock': '' } })).commands.test).toBe('yarn test');
    expect(config(await runInit([], { files: { 'package.json': '{}' } })).commands.test).toBe('npm test');
  });
});

describe('package.json がないときの案内', () => {
  it('[REQ-024] package.json がなければ、commands を npm の既定値で書き、書き換えるよう案内する', async () => {
    const r = await runInit();
    expect(config(r).commands).toEqual({ lint: 'npm run lint', typecheck: 'npm run typecheck', test: 'npm test' });
    expect(r.stdout).toContain('package.json がありません。loomake.config.json の commands');
  });

  it('[REQ-024] package.json があれば、commands の書き換えを案内しない', async () => {
    const r = await runInit([], { files: { 'package.json': '{}' } });
    expect(r.stdout).not.toContain('package.json がありません');
  });
});

describe('開発用の依存の案内', () => {
  const pkg = (body: object) => ({ 'package.json': JSON.stringify(body) });

  it('[REQ-019] loomake が依存になければ、pnpm add -D loomake を案内し、package.json は変えない', async () => {
    const files = pkg({ packageManager: 'pnpm@9.0.0' });
    const r = await runInit([], { files });
    expect(r.stdout).toContain('pnpm add -D loomake');
    expect(r.files['package.json']).toBe(files['package.json']);
  });

  it('[REQ-019] npm と yarn では、それぞれ npm install -D loomake・yarn add -D loomake を案内する', async () => {
    expect((await runInit([], { files: pkg({ packageManager: 'npm@10.0.0' }) })).stdout).toContain('npm install -D loomake');
    expect((await runInit([], { files: pkg({ packageManager: 'yarn@4.0.0' }) })).stdout).toContain('yarn add -D loomake');
  });

  it('[REQ-019] devDependencies に loomake があれば、依存に足す案内を出さない', async () => {
    const r = await runInit([], { files: pkg({ devDependencies: { loomake: '^0.1.0' } }) });
    expect(r.stdout).not.toContain('-D loomake');
  });

  it('dependencies に loomake があっても、依存に足す案内を出さない（仮定 A-01）', async () => {
    const r = await runInit([], { files: pkg({ dependencies: { loomake: '^0.1.0' } }) });
    expect(r.stdout).not.toContain('-D loomake');
  });
});

describe('日本語のメッセージ', () => {
  it('[REQ-055] 配置したファイルの一覧と案内を日本語で出す', async () => {
    const r = await runInit();
    expect(r.stdout).toContain('loomake init の結果:');
    expect(r.stdout).toContain('作成：AGENTS.md');
    expect(r.stdout).toContain('openspec/ がありません。');
    expect(r.stdout).toContain('書き出すよう設定してください');
  });

  it('[REQ-055] 知らないオプションには、日本語の使い方を出して終了コード 2', async () => {
    const r = await runInit(['--force']);
    expect(r.code).toBe(2);
    expect(r.stdout).toContain('知らないオプションです：--force');
    expect(r.stdout).toContain('使い方: loomake init [--codex] [--devcontainer]');
    expect(r.files).toEqual({});
  });
});

describe('差分の表示', () => {
  it('変わった行の前後 3 行を、行番号つきの塊で出す', () => {
    const before = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'].join('\n') + '\n';
    const after = before.replace('e\n', 'E\n');
    expect(unifiedDiff('x.md', before, after)).toBe(
      ['--- x.md（いまのファイル）', '+++ x.md（loomake のテンプレート）', '@@ -2,7 +2,7 @@', ' b', ' c', ' d', '-e', '+E', ' f', ' g', ' h'].join('\n'),
    );
  });

  it('内容が同じなら空文字を返し、改行コードの違いは差分にしない', () => {
    expect(unifiedDiff('x.md', 'a\nb\n', 'a\nb\n')).toBe('');
    expect(unifiedDiff('x.md', 'a\r\nb\r\n', 'a\nb\n')).toBe('');
  });
});
