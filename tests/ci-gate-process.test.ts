import { describe, expect, it, vi } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join } from 'node:path';

// どのテストも git とゲートの子プロセスを何度も起動する。Windows の CI では 1 件で最大 5 秒ほどかかり、
// 既定の 5000ms で時間切れすることがある（Issue #5）。Windows でだけ上限を延ばし、ほかの OS は既定のまま
if (process.platform === 'win32') vi.setConfig({ testTimeout: 15_000 });

const gate = join(import.meta.dirname, '..', 'scripts', 'ci-gate.mjs');
// 呼び出しを記録して、CI_STATUSES の終了コードで終わる偽のコマンド。name は記録の先頭と、終了コードの鍵
const recorder = (name: string, key = name) => `import { appendFileSync } from 'node:fs';
const args = process.argv.slice(2);
appendFileSync(process.env.CI_CALLS_FILE, JSON.stringify([${JSON.stringify(name)}, ...args]) + '\\n');
process.exit(JSON.parse(process.env.CI_STATUSES)[${JSON.stringify(key)}] ?? 0);
`;

function withProject(check: (project: {
  dir: string;
  git: (...args: string[]) => void;
  commitFiles: (files: string[] | Record<string, string>) => void;
  run: (branch: string, body?: string, statuses?: Record<string, number>) => { status: number | null; stdout: string; stderr: string; calls: string[][]; output: string };
}) => void) {
  const dir = mkdtempSync(join(tmpdir(), 'loomake-ci-process-'));
  const callsFile = join(dir, 'calls.jsonl');
  const outputFile = join(dir, 'github-output.txt');
  const git = (...args: string[]) => {
    const result = spawnSync('git', ['-c', 'core.hooksPath=', ...args], { cwd: dir, encoding: 'utf8' });
    expect(result.status, result.stderr).toBe(0);
  };
  try {
    writeFileSync(join(dir, 'package.json'), '{"type":"module"}\n');
    // verify の偽物。--change <id> の id か quality を鍵にする
    const cli = join(dir, 'packages', 'cli', 'dist', 'cli.js');
    mkdirSync(dirname(cli), { recursive: true });
    writeFileSync(cli, `import { appendFileSync } from 'node:fs';
const args = process.argv.slice(2);
appendFileSync(process.env.CI_CALLS_FILE, JSON.stringify(args) + '\\n');
const id = args.includes('--change') ? args[args.indexOf('--change') + 1] : 'quality';
process.exit(JSON.parse(process.env.CI_STATUSES)[id] ?? 0);
`);
    // L1 の lint は loomake.config.json の commands.lint で偽物に差し替える
    writeFileSync(join(dir, 'loomake.config.json'), JSON.stringify({ commands: { lint: 'node lint.js' } }) + '\n');
    writeFileSync(join(dir, 'lint.js'), recorder('lint'));
    // L1 の文書のリンクの試験は pnpm exec vitest で呼ぶので、PATH の先頭に偽の pnpm を置く
    const bin = join(dir, 'bin');
    mkdirSync(bin);
    writeFileSync(join(bin, 'pnpm.js'), recorder('pnpm', 'doc-links'));
    writeFileSync(join(bin, 'pnpm'), '#!/bin/sh\nexec node "$(dirname "$0")/pnpm.js" "$@"\n', { mode: 0o755 });
    writeFileSync(join(bin, 'pnpm.cmd'), '@node "%~dp0pnpm.js" %*\r\n');
    for (const id of ['c1', 'c2', 'setup-monorepo']) {
      const change = join(dir, 'openspec', 'changes', id);
      mkdirSync(change, { recursive: true });
      writeFileSync(join(change, 'tasks.md'), '- [x] baseline\n');
    }
    git('init', '-q');
    git('config', 'user.name', 'Loomake Test');
    git('config', 'user.email', 'test@example.invalid');
    git('add', '.');
    git('commit', '-qm', 'baseline');
    git('update-ref', 'refs/remotes/origin/main', 'HEAD');
    const pathKey = Object.keys(process.env).find((key) => key.toUpperCase() === 'PATH') ?? 'PATH';
    check({
      dir,
      git,
      commitFiles(files) {
        const entries = Array.isArray(files) ? files.map((file) => [file, 'changed\n'] as const) : Object.entries(files);
        for (const [file, content] of entries) {
          mkdirSync(dirname(join(dir, file)), { recursive: true });
          writeFileSync(join(dir, file), content);
        }
        git('add', '-A');
        git('commit', '-qm', 'change');
      },
      run(branch, body = '', statuses = {}) {
        rmSync(outputFile, { force: true });
        const result = spawnSync(process.execPath, [gate, branch], {
          cwd: dir,
          encoding: 'utf8',
          env: {
            ...process.env,
            [pathKey]: bin + delimiter + (process.env[pathKey] ?? ''),
            BASE_REF: 'main',
            PR_BODY: body,
            PR_NUMBER: '',
            GITHUB_OUTPUT: outputFile,
            CI_CALLS_FILE: callsFile,
            CI_STATUSES: JSON.stringify(statuses),
          },
        });
        const calls = existsSync(callsFile) ? readFileSync(callsFile, 'utf8').trim().split('\n').map((line) => JSON.parse(line) as string[]) : [];
        const output = existsSync(outputFile) ? readFileSync(outputFile, 'utf8') : '';
        return { status: result.status, stdout: result.stdout, stderr: result.stderr, calls, output };
      },
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const done = (id: string) => ['verify', '--change', id, '--done'];
// L1 で、tasks.md に完了した印がない change は仕様ゲートで検査する（commitFiles が tasks.md を書き換えると印がなくなる）
const specOnly = (id: string) => ['verify', '--change', id, '--spec-only'];
const lintOnly = [['lint'], ['pnpm', 'exec', 'vitest', 'run', 'tests/doc-links.test.ts']];

describe('実際のCIゲートの子プロセスの契約', () => {
  it.each(['setup-monorepo', 'loomake/c1'])('[REQ-010][REQ-054][REQ-132] ブランチ%sで指定どおりの完了ゲートを呼び、失敗を伝える', (branch) => {
    withProject(({ run }) => {
      const id = branch.replace(/^loomake\//, '');
      const result = run(branch, '', { [id]: 9 });
      expect(result.calls).toEqual([done(id)]);
      expect(result.status).toBe(1);
    });
  });

  it('[REQ-010][REQ-132] 複数のchangeの明示で両方の完了ゲートを呼ぶ', () => {
    withProject(({ commitFiles, run }) => {
      commitFiles(['packages/a.ts']);
      const result = run('fix-typo', 'loomake-change: c1, c2');
      expect(result.calls).toEqual([done('c1'), done('c2')]);
      expect(result.status).toBe(0);
    });
  });

  it('[REQ-010][REQ-132] 最初のchangeが失敗しても次を検査し、全体を不合格にする', () => {
    withProject(({ run }) => {
      const result = run('fix-typo', 'loomake-change: c1, c2', { c1: 7 });
      expect(result.calls).toEqual([done('c1'), done('c2')]);
      expect(result.status).toBe(1);
    });
  });

  it('[REQ-010][REQ-132] 明示したchangeがなければverifyを呼ぶ前に日本語で止まる', () => {
    withProject(({ run }) => {
      const result = run('fix-typo', 'loomake-change: nothing');
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('PR 本文の loomake-change: に書いた change がありません：nothing');
      expect(result.calls).toEqual([]);
    });
  });

  it('[REQ-010][REQ-132][REQ-343] L2 で none の明示があれば、コードの変更でも品質コマンドだけを呼ぶ', () => {
    withProject(({ commitFiles, run }) => {
      commitFiles(['packages/a.ts']);
      const result = run('fix-typo', 'loomake-change: none');
      expect(result.stdout).toContain('loomake-tier: L2（packages/a.ts）');
      expect(result.calls).toEqual([['verify']]);
      expect(result.status).toBe(0);
    });
  });

  it('[REQ-010][REQ-132][REQ-343] L2 で変更したchangeのファイルから完了ゲートを選ぶ', () => {
    withProject(({ commitFiles, run }) => {
      commitFiles(['openspec/changes/c1/tasks.md', 'packages/a.ts']);
      const result = run('feature-x');
      expect(result.stdout).toContain('loomake-tier: L2（packages/a.ts）');
      expect(result.calls).toEqual([done('c1')]);
      expect(result.status).toBe(0);
    });
  });

  it.each([{ files: ['packages/a.ts'] }, { files: ['docs/usage.md', 'packages/a.ts'] }, { files: ['scripts/x.mjs'] }])('[REQ-010][REQ-132] 対象未指定のコードファイル $files があればverifyを呼ぶ前に止まる', ({ files }) => {
    withProject(({ commitFiles, run }) => {
      commitFiles(files);
      const result = run('fix-typo');
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('PR 本文に「loomake-change: <change-id>」の行を書いてください');
      expect(result.calls).toEqual([]);
    });
  });

  it.each([{ files: ['docs/usage.md'] }, { files: ['README.md', '.changeset/x.md'] }])('[REQ-010][REQ-132][REQ-343] 文書ファイル $files の変更は L1 で、lint と文書のリンクの試験だけを呼び verify を呼ばない', ({ files }) => {
    withProject(({ commitFiles, run }) => {
      commitFiles(files);
      const result = run('fix-typo');
      // 理由のパスは git の差分の順（パス名の順）で並ぶ
      expect(result.stdout).toContain(`loomake-tier: L1（${[...files].sort().join('、')}）`);
      expect(result.calls).toEqual(lintOnly);
      expect(result.status).toBe(0);
    });
  });

  it('[REQ-343] L1 の段階と出力行を GITHUB_OUTPUT に書く', () => {
    withProject(({ commitFiles, run }) => {
      commitFiles(['docs/usage.md']);
      const result = run('fix-typo');
      expect(result.output).toBe('tier=L1\ntier_line<<LOOMAKE_TIER_EOF\nloomake-tier: L1（docs/usage.md）\nLOOMAKE_TIER_EOF\n');
    });
  });

  it('[REQ-010][REQ-132][REQ-342] archive時の削除とarchive・specの追加は、Requirement を足していても L1 で lint だけを呼ぶ', () => {
    withProject(({ dir, commitFiles, run }) => {
      rmSync(join(dir, 'openspec', 'changes', 'c1'), { recursive: true });
      commitFiles({ 'openspec/changes/archive/2026-10-24-c1/tasks.md': '- [x] done\n', 'openspec/specs/x/spec.md': '### Requirement: 反映した振る舞い\n本文 SHALL。\n' });
      const result = run('archive-c1');
      expect(result.stdout).toContain('loomake-tier: L1（');
      expect(result.calls).toEqual(lintOnly);
      expect(result.status).toBe(0);
    });
  });

  it('[REQ-343] L1 で lint が失敗したら、文書のリンクの試験も呼んだうえで非ゼロ終了を伝える', () => {
    withProject(({ commitFiles, run }) => {
      commitFiles(['README.md']);
      const result = run('fix-typo', '', { lint: 7 });
      expect(result.calls).toEqual(lintOnly);
      expect(result.status).toBe(7);
      // 文書のリンクの試験の失敗も伝える
      expect(run('fix-typo', '', { 'doc-links': 3 }).status).toBe(3);
    });
  });

  it('[REQ-342][REQ-343] Requirement の本文を変えた spec.md は L3 で、change があれば --done を呼び stdout に段階の行を書く', () => {
    withProject(({ commitFiles, run }) => {
      // L3 なので、tasks.md に完了した印がなくても --done
      commitFiles({ 'openspec/changes/c1/specs/x/spec.md': '### Requirement: 新しい振る舞い\n- 本文の箇条書き\n', 'openspec/changes/c1/tasks.md': '- [ ] 1.1\n- [ ] 2.1\n' });
      const result = run('fix-x');
      expect(result.stdout).toContain('loomake-tier: L3（openspec/changes/c1/specs/x/spec.md）');
      expect(result.output).toContain('tier=L3\n');
      expect(result.calls).toEqual([done('c1')]);
      expect(result.status).toBe(0);
    });
  });

  it('[REQ-342][REQ-343] Scenario の文言だけを変えた spec.md は L1 で、change のファイルなので --done も呼ぶ', () => {
    withProject(({ commitFiles, run }) => {
      commitFiles({ 'openspec/changes/c1/specs/x/spec.md': '#### Scenario: 場面\n- **WHEN** 条件\n- **THEN** 結果\n' });
      const result = run('fix-x');
      expect(result.stdout).toContain('loomake-tier: L1（');
      expect(result.calls).toEqual([...lintOnly, done('c1')]);
    });
  });

  it('[REQ-343] L3 で loomake-change: none なら、verify を呼ばずに失敗する', () => {
    withProject(({ commitFiles, run }) => {
      commitFiles(['packages/kit/src/a.ts']);
      const result = run('fix-x', 'loomake-change: none');
      expect(result.stdout).toContain('loomake-tier: L3（packages/kit/src/a.ts）');
      expect(result.stderr).toContain('L3 では change が必須です');
      expect(result.calls).toEqual([]);
      expect(result.status).toBe(1);
    });
  });

  it('[REQ-343] L3 で change を特定できなければ、案内を表示して失敗する', () => {
    withProject(({ commitFiles, run }) => {
      commitFiles(['packages/kit/src/a.ts']);
      const result = run('fix-x');
      expect(result.stderr).toContain('PR 本文に「loomake-change: <change-id>」の行を書いてください');
      expect(result.calls).toEqual([]);
      expect(result.status).toBe(1);
    });
  });

  it('[REQ-343] L3 で change があれば --done を呼ぶ', () => {
    withProject(({ commitFiles, run }) => {
      commitFiles(['openspec/changes/c1/tasks.md', 'packages/kit/src/a.ts']);
      const result = run('fix-x');
      expect(result.stdout).toContain('loomake-tier: L3（packages/kit/src/a.ts）');
      expect(result.calls).toEqual([done('c1')]);
      expect(result.status).toBe(0);
    });
  });

  it('[REQ-342][REQ-343] 本文で段階を上げれば、文書だけの PR でも verify を呼ぶ', () => {
    withProject(({ commitFiles, run }) => {
      commitFiles(['README.md']);
      const result = run('fix-typo', 'loomake-tier: L2\nloomake-change: none');
      expect(result.stdout).toContain('loomake-tier: L2（本文の指定 L1→L2、README.md）');
      expect(result.calls).toEqual([['verify']]);
      expect(result.status).toBe(0);
    });
  });

  it('[REQ-342] 本文で段階を下げる指定は、verify を呼ばずに失敗する', () => {
    withProject(({ commitFiles, run }) => {
      commitFiles(['packages/kit/src/a.ts']);
      const result = run('c1', 'loomake-tier: L2');
      expect(result.stderr).toContain('段階は上げる方向にだけ上書きできます：判定 L3、指定 L2');
      expect(result.calls).toEqual([]);
      expect(result.status).toBe(1);
    });
  });

  it('[REQ-132][REQ-343] 明示した選択を変更ファイルとブランチの選択より優先する。L1 でも change があれば --done を呼ぶ', () => {
    withProject(({ commitFiles, run }) => {
      commitFiles(['openspec/changes/c2/tasks.md']);
      const result = run('c2', 'loomake-change: c1');
      expect(result.calls).toEqual([...lintOnly, done('c1')]);
      expect(result.status).toBe(0);
    });
  });

  it('[REQ-132][REQ-343] 変更ファイルとブランチの選択を合わせて両方のゲートを呼ぶ。L1 でも change があれば --done を呼ぶ', () => {
    withProject(({ commitFiles, run }) => {
      commitFiles(['openspec/changes/c1/tasks.md']);
      const result = run('c2');
      // c1 の tasks.md は印のない内容に書き換わるので仕様ゲート、c2 は印が残るので完了ゲート
      expect(result.calls).toEqual([...lintOnly, specOnly('c1'), done('c2')]);
      expect(result.status).toBe(0);
    });
  });

  it('[REQ-343] L1 で change があり lint が失敗すれば、--done も呼んだうえで失敗を伝える', () => {
    withProject(({ commitFiles, run }) => {
      commitFiles(['openspec/changes/c2/tasks.md']);
      const result = run('c2', '', { lint: 5 });
      expect(result.stdout).toContain('loomake-tier: L1（openspec/changes/c2/tasks.md）');
      expect(result.calls).toEqual([...lintOnly, specOnly('c2')]);
      expect(result.status).toBe(5);
    });
  });

  it('[REQ-343] L1 で tasks.md に完了した印がない change（提案だけの PR）は --done ではなく --spec-only で検査する', () => {
    withProject(({ commitFiles, run }) => {
      commitFiles({ 'openspec/changes/c1/tasks.md': '- [ ] 1.1 仕様を書く\n- [ ] 2.1 実装する\n', 'openspec/changes/c1/proposal.md': '# Proposal\n' });
      const result = run('c1');
      expect(result.stdout).toContain('loomake-tier: L1（');
      expect(result.calls).toEqual([...lintOnly, specOnly('c1')]);
      expect(result.status).toBe(0);
      // 1 つでも完了していれば --done
      commitFiles({ 'openspec/changes/c1/tasks.md': '- [x] 1.1 仕様を書く\n- [ ] 2.1 実装する\n' });
      expect(run('c1').calls.at(-1)).toEqual(done('c1'));
    });
  });

  it.each([{ tier: 'L3', file: 'packages/kit/src/a.ts' }, { tier: 'L2', file: 'scripts/x.mjs' }])('[REQ-343] $tier では tasks.md に完了した印がなくても --done で検査する', ({ tier, file }) => {
    withProject(({ commitFiles, run }) => {
      commitFiles({ 'openspec/changes/c1/tasks.md': '- [ ] 1.1 仕様を書く\n', [file]: 'changed\n' });
      const result = run('fix-x');
      expect(result.stdout).toContain(`loomake-tier: ${tier}（`);
      expect(result.calls).toEqual([done('c1')]);
      expect(result.status).toBe(0);
    });
  });

  it('[REQ-342] 規則の文書 AGENTS.md だけを変えた PR は L2', () => {
    withProject(({ commitFiles, run }) => {
      commitFiles(['AGENTS.md']);
      const result = run('fix-rules', 'loomake-change: none');
      expect(result.stdout).toContain('loomake-tier: L2（AGENTS.md）');
      expect(result.calls).toEqual([['verify']]);
    });
  });

  it.each(['refs/tags/origin/main', 'refs/heads/origin/main'])('[REQ-272] ベースと同じ名前の参照 %s が PR のコミットの途中を指していても、リモートの追跡ブランチとの差分で change を選ぶ', (name) => {
    withProject(({ git, commitFiles, run }) => {
      // 1 つ目のコミットで change を、2 つ目でコードを変え、そのあいだを同じ名前の参照に指させる
      commitFiles(['openspec/changes/c1/tasks.md']);
      git('update-ref', name, 'HEAD');
      commitFiles(['packages/a.ts']);
      const result = run('fix-x');
      expect(result.stderr).not.toContain('対象の change を特定できませんでした');
      expect(result.calls).toEqual([done('c1')]);
      expect(result.status).toBe(0);
    });
  });

  it('[REQ-010][REQ-132] 品質コマンドだけの検査でも非ゼロ終了を伝える', () => {
    withProject(({ commitFiles, run }) => {
      commitFiles(['scripts/x.mjs']);
      const result = run('fix-typo', 'loomake-change: none', { quality: 7 });
      expect(result.calls).toEqual([['verify']]);
      expect(result.status).toBe(7);
    });
  });
});

describe('完了ゲートの JSON を合格として受け入れるか', () => {
  const ci = (patch: Record<string, unknown> = {}) => ({
    schemaVersion: '2.0.0', change: 'c1', run: { status: 'completed', errors: [] }, scope: 'ci',
    checks: [{ id: 'command: test', result: 'PASS', reason: '', evidence: [] }],
    summary: { fail: 0, insufficient: 0, not_applicable: 0, evaluated: 1 }, decision: { required: false, reasons: [] }, verdict: 'PASS', ...patch,
  });
  it('2.0.0 は ci・completed・要判断なし・PASS・終了コード 0 だけを受け入れ、local・partial・要判断・不足・aborted を受け入れない。1.0.0 はこれまでどおり受け入れる', async () => {
    const { ciGateProblem } = await import('../scripts/ci-gate.mjs');
    const ok = (value: unknown, code = 0) => ciGateProblem(JSON.stringify(value), code);
    expect(ok(ci())).toBeUndefined();
    expect(ok(ci(), 1)).toMatch(/終了コードが 0 ではありません/);
    expect(ok({ ...ci(), scope: 'local', verdict: undefined })).toMatch(/scope が ci ではありません/);
    expect(ok(ci({ run: { status: 'partial', errors: [{ kind: 'runtime', target: 'x', message: 'y', next: 'z' }] } }))).toMatch(/一部の証拠を取得できませんでした/);
    expect(ok(ci({ decision: { required: true, reasons: [] } }))).toMatch(/人の判断が必要です/);
    expect(ok(ci({ verdict: 'INSUFFICIENT_EVIDENCE' }))).toMatch(/verdict が PASS ではありません/);
    expect(ok(ci({ checks: [{ id: '品質コマンド', result: 'INSUFFICIENT_EVIDENCE', reason: 'skip', evidence: [] }] }))).toMatch(/証拠不足の検査があります（品質コマンド）/);
    expect(ok({ schemaVersion: '2.0.0', change: 'c1', run: { status: 'aborted', errors: [{ kind: 'config', target: 'c1', message: '不正', next: '直す' }] } })).toMatch(/実行エラーで中止されました/);
    expect(ok({ schemaVersion: '3.0.0' })).toMatch(/版に対応していません/);
    expect(ciGateProblem('not json', 0)).toMatch(/JSON として読めません/);
    const legacy = { schemaVersion: '1.0.0', mode: 'done', change: 'c1', ok: true, results: [{ check: 'command: test', status: 'pass', detail: '' }] };
    expect(ok(legacy)).toBeUndefined();
    expect(ok({ ...legacy, ok: false })).toMatch(/1\.0\.0）が合格ではありません/);
    expect(ok(legacy, 1)).toMatch(/終了コードが 0 ではありません/);
  });
});
