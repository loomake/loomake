import { describe, it, expect } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { diffSince, versionOnlyProblem } from '../scripts/changeset-check.mjs';
import { selectChanges, verifyArgs } from '../scripts/ci-gate.mjs';

const root = join(import.meta.dirname, '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const readJson = (p: string) => JSON.parse(read(p));
// Windows のチェックアウトでは行末が CRLF になるので、行の正規表現で読むファイルは LF にそろえる
const readLf = (p: string) => read(p).replace(/\r\n/g, '\n');
const jobBlock = (workflow: string, start: string, end?: string) => {
  const from = workflow.indexOf(`\n  ${start}:`);
  expect(from, start).toBeGreaterThanOrEqual(0);
  const to = end ? workflow.indexOf(`\n  ${end}:`) : workflow.length;
  expect(to, end ?? 'end of workflow').toBeGreaterThan(from);
  return workflow.slice(from, to);
};
const run = (cmd: string) => spawnSync(cmd, { cwd: root, shell: true, encoding: 'utf8' });

const packageJsons = ['package.json', 'packages/core/package.json', 'packages/kit/package.json', 'packages/cli/package.json'];

describe('モノレポのパッケージ構成', () => {
  it('[REQ-001][REQ-002][REQ-003][REQ-060] pnpm workspaces で core・kit・loomake の 3 つが認識される', () => {
    expect(read('pnpm-workspace.yaml')).toMatch(/["']?packages\/\*["']?/);
    const r = run('pnpm -r ls --depth -1 --json');
    expect(r.status).toBe(0);
    const names = (JSON.parse(r.stdout) as { name: string }[]).map((p) => p.name);
    expect(names).toEqual(expect.arrayContaining(['@loomake/core', '@loomake/kit', 'loomake']));
  });

  it('[REQ-003] CLI のパッケージ名は loomake で、bin.loomake を宣言している', () => {
    const pkg = readJson('packages/cli/package.json');
    expect(pkg.name).toBe('loomake');
    expect(pkg.bin?.loomake).toBeTruthy();
  });
});

describe('devcontainer', () => {
  const devcontainer = read('.devcontainer/devcontainer.json');
  const postCreate = devcontainer.match(/"postCreateCommand":\s*"([^"]*)"/)?.[1] ?? '';

  it('postCreateCommand で OpenSpec CLI を入れる', () => {
    expect(postCreate).toContain('@fission-ai/openspec');
  });

  it('Node 24 系のイメージを使う', () => {
    const image = devcontainer.match(/^\s*"image":\s*"([^"]*)"/m)?.[1] ?? '';
    expect(image).toMatch(/typescript-node:(\d+-)?24(-|$)/);
  });
});

describe('Node.js のバージョン宣言', () => {
  it('[REQ-142] ルートと 5 つのパッケージの engines.node が >=22.12.0', () => {
    const all = ['package.json', ...['core', 'kit', 'trace', 'runner', 'cli'].map((d) => `packages/${d}/package.json`)];
    for (const p of all) expect(readJson(p).engines?.node, p).toBe('>=22.12.0');
  });

  it('[REQ-142] CI に、Node 22.12.0 でビルドした CLI を動かすジョブがある', () => {
    const ci = readLf('.github/workflows/ci.yml');
    const job = ci.match(/^ {2}node22:\n((?: {4}.*\n|\s*\n)*)/m)?.[1] ?? '';
    const setup = job.indexOf('node-version: 22.12.0');
    expect(setup).toBeGreaterThanOrEqual(0);
    expect(job.indexOf('packages/cli/dist/cli.js', setup)).toBeGreaterThan(setup);
  });
});

describe('CI', () => {
  const ci = read('.github/workflows/ci.yml');
  // archive したあとも動くよう、本物の change ではなく検査用プロジェクトの changes/ を使う
  const changes = join(root, 'tests', 'fixtures', 'verify-project', 'openspec', 'changes');

  // GitHub Actions の式を、ci.yml の quality ジョブの OS の式が使う範囲（||・&&・!・==・文字列・文脈の参照・.*・contains・fromJSON）だけ評価する
  type ExprCtx = Record<string, unknown>;
  const evalGithubExpr = (source: string, ctx: ExprCtx): unknown => {
    const tokens = source.match(/'(?:[^']|'')*'|\|\||&&|==|!=|!|\(|\)|,|[A-Za-z_][\w-]*(?:\.(?:\*|[A-Za-z_][\w-]*))*/g) ?? [];
    expect(tokens.join('').replace(/\s+/g, ''), `テストが評価できない式です：${source}`).toBe(source.replace(/\s+/g, ''));
    let pos = 0;
    const peek = () => tokens[pos];
    const take = (expected?: string) => {
      const token = tokens[pos++];
      if (expected !== undefined && token !== expected) throw new Error(`式の ${expected} がありません：${source}`);
      return token!;
    };
    const lookup = (path: string): unknown =>
      path.split('.').reduce<unknown>((value, key) => {
        if (key === '*') return Array.isArray(value) ? value : [];
        if (Array.isArray(value)) return value.map((item) => (item as ExprCtx | undefined)?.[key]);
        return (value as ExprCtx | undefined)?.[key];
      }, ctx);
    const functions: Record<string, (...args: unknown[]) => unknown> = {
      contains: (haystack, needle) =>
        Array.isArray(haystack)
          ? haystack.some((item) => String(item).toLowerCase() === String(needle).toLowerCase())
          : String(haystack).toLowerCase().includes(String(needle).toLowerCase()),
      fromJSON: (text) => JSON.parse(String(text)),
    };
    const primary = (): unknown => {
      const token = take();
      if (token === '!') return !primary();
      if (token === '(') {
        const value = or();
        take(')');
        return value;
      }
      if (token.startsWith("'")) return token.slice(1, -1).replace(/''/g, "'");
      if (peek() === '(') {
        const fn = functions[token];
        if (!fn) throw new Error(`テストが評価できない関数です：${token}`);
        take('(');
        const args = [or()];
        while (peek() === ',') {
          take(',');
          args.push(or());
        }
        take(')');
        return fn(...args);
      }
      return lookup(token);
    };
    const equality = (): unknown => {
      const left = primary();
      if (peek() === '==' || peek() === '!=') {
        const op = take();
        const right = primary();
        return op === '==' ? left === right : left !== right;
      }
      return left;
    };
    const and = (): unknown => {
      let value = equality();
      while (peek() === '&&') {
        take();
        const right = equality();
        value = value ? right : value;
      }
      return value;
    };
    const or = (): unknown => {
      let value = and();
      while (peek() === '||') {
        take();
        const right = and();
        value = value ? value : right;
      }
      return value;
    };
    const result = or();
    expect(pos, `式を最後まで読めませんでした：${source}`).toBe(tokens.length);
    return result;
  };

  // quality ジョブのマトリクスから、イベントごとにできるジョブ（os と shard の組み合わせ）を、GitHub Actions と同じ順で展開する。
  // 組み合わせを作り、exclude に当たるものを除き、include のうち既存の組み合わせに足せないものを新しい組み合わせとして足す
  const qualityJobs = (ctx: ExprCtx) => {
    const lf = readLf('.github/workflows/ci.yml');
    const quality = jobBlock(lf, 'quality', 'node22');
    const matrix = quality.match(/^ {6}matrix:\n((?: {8}.*\n)*)/m)?.[1] ?? '';
    const osLine = matrix.match(/^ {8}os: (.+)$/m)?.[1];
    expect(osLine, 'マトリクスの os').toBeTruthy();
    const whole = osLine!.match(/^\$\{\{(.*)\}\}$/);
    expect(whole, 'os は式で決める').not.toBeNull();
    const oses = evalGithubExpr(whole![1]!.trim(), ctx) as string[];
    const shards = JSON.parse((matrix.match(/^ {8}shard: (.+)$/m)?.[1] ?? '[]').replace(/'/g, '"')) as string[];
    const entries = (key: string) => [...(matrix.split(new RegExp(`^ {8}${key}:\\n`, 'm'))[1] ?? '').matchAll(/^ {10}- os: (\S+)$/gm)].map((m) => ({ os: m[1]! }));
    let jobs: { os: string; shard?: string }[] = oses.flatMap((os) => shards.map((shard) => ({ os, shard })));
    jobs = jobs.filter((job) => !entries('exclude').some((ex) => ex.os === job.os));
    for (const add of entries('include')) if (!jobs.some((job) => job.os === add.os)) jobs.push(add);
    return jobs.map((job) => (job.shard ? `${job.os} ${job.shard}` : job.os));
  };
  const githubCtx = (event_name: string, labels: string[] = []): ExprCtx => ({
    github: { event_name, event: event_name === 'pull_request' ? { pull_request: { labels: labels.map((name) => ({ name })) } } : {} },
  });
  const allOsJobs = ['macos-latest 1/2', 'macos-latest 2/2', 'windows-latest 1/2', 'windows-latest 2/2', 'ubuntu-latest'];

  it('[REQ-049] ラベルのない PR では、quality ジョブを ubuntu-latest の 1 つだけで実行する', () => {
    expect(qualityJobs(githubCtx('pull_request'))).toEqual(['ubuntu-latest']);
    // ci:all-os 以外のラベルでは、3 つの OS にならない
    expect(qualityJobs(githubCtx('pull_request', ['documentation', 'ci:all-os-later']))).toEqual(['ubuntu-latest']);
    // ubuntu のジョブは、lint・typecheck・カバレッジ付きのテスト・build・配布物の検査を実行する
    const lf = readLf('.github/workflows/ci.yml');
    const quality = jobBlock(lf, 'quality', 'node22');
    expect(quality).toMatch(/runs-on: \$\{\{ matrix\.os \}\}/);
    for (const step of ['run: pnpm lint', 'run: pnpm typecheck', 'run: pnpm test --coverage', 'run: pnpm build', 'package-smoke.mjs prepare', 'package-smoke.mjs check']) expect(quality, step).toContain(step);
  });

  it('[REQ-049] main への push と定期実行では、quality ジョブを ubuntu・macos・windows の 3 つで実行し、macOS と Windows では 2 つのシャードに分ける', () => {
    expect(qualityJobs(githubCtx('push'))).toEqual(allOsJobs);
    expect(qualityJobs(githubCtx('schedule'))).toEqual(allOsJobs);
    // OS の式には 3 つの OS が書いてある
    const lf = readLf('.github/workflows/ci.yml');
    const osLine = lf.match(/^ {8}os: (.+)$/m)?.[1] ?? '';
    for (const os of ['ubuntu-latest', 'macos-latest', 'windows-latest']) expect(osLine).toContain(os);
  });

  it('[REQ-273] ci:all-os ラベルの付いた PR では、quality ジョブを 3 つの OS で実行する', () => {
    expect(qualityJobs(githubCtx('pull_request', ['ci:all-os']))).toEqual(allOsJobs);
    expect(qualityJobs(githubCtx('pull_request', ['documentation', 'ci:all-os']))).toEqual(allOsJobs);
  });

  it('[REQ-049][REQ-273] PR にラベルを付けたときにも起動し、毎日 1 回、定期実行する', () => {
    const lf = readLf('.github/workflows/ci.yml');
    const on = lf.slice(lf.indexOf('\non:\n'), lf.indexOf('\npermissions:'));
    // 既定の種類（opened・synchronize・reopened）を残したまま、labeled を足す
    expect(on).toMatch(/^ {2}pull_request:\n {4}types: \[opened, synchronize, reopened, labeled\]\n/m);
    expect(on).toMatch(/^ {2}push:\n {4}branches: \[main\]\n/m);
    // cron は 1 つだけで、分と時を固定し、日・月・曜日は * にする（1 日 1 回）
    const crons = [...on.matchAll(/^ {4}- cron: '(.+)'$/gm)].map((m) => m[1]!);
    expect(crons).toHaveLength(1);
    expect(crons[0]).toMatch(/^\d{1,2} \d{1,2} \* \* \*$/);
    expect(on).toMatch(/^ {2}schedule:\n/m);
  });

  it('[REQ-273] node22・gate のジョブは、OS の切り替えの影響を受けない', () => {
    const lf = readLf('.github/workflows/ci.yml');
    expect(lf).not.toContain('\n  node20:');
    expect(lf).not.toContain('20.19.0');
    const jobs = {
      node22: jobBlock(lf, 'node22', 'gate'),
      gate: jobBlock(lf, 'gate'),
    };
    for (const [name, job] of Object.entries(jobs)) {
      expect(job, name).toMatch(/^ {4}runs-on: ubuntu-latest$/m);
      expect(job, name).not.toContain('matrix');
      expect(job, name).not.toContain('ci:all-os');
      expect(job, name).not.toContain('labels');
    }
    // node22 には条件がなく、gate は今までどおり pull_request のときだけ動く
    expect(jobs.node22).not.toMatch(/^ {4}if:/m);
    expect(jobs.gate).toMatch(/^ {4}if: github\.event_name == 'pull_request'$/m);
    // OS の切り替えの式は、quality ジョブの os の行の 1 か所だけ
    expect(lf.replace(/^ *#.*\n/gm, '').match(/ci:all-os/g)).toHaveLength(1);
  });

  it('[REQ-214] macOS と Windows ではテストを 2 つのシャードに分け、ubuntu ではカバレッジ付きで 1 回だけ実行する', () => {
    const lf = readLf('.github/workflows/ci.yml');
    const quality = jobBlock(lf, 'quality', 'node22');
    // ubuntu はシャードの組み合わせから外し、シャードのない 1 つだけを足す。macOS と Windows には 1/2 と 2/2 が残る。
    // os の行はイベントとラベルで切り替える式なので（REQ-049・REQ-273）、ここでは os の行のほかを比べ、展開したジョブは 3 つの OS で動くときで確かめる
    expect(qualityJobs(githubCtx('push'))).toEqual(['macos-latest 1/2', 'macos-latest 2/2', 'windows-latest 1/2', 'windows-latest 2/2', 'ubuntu-latest']);
    const matrix = quality.match(/^ {6}matrix:\n((?: {8}.*\n)*)/m)?.[1];
    expect(matrix?.replace(/^ {8}os: \$\{\{ .+ \}\}\n/m, '        os: <OS の式>\n')).toBe(
      [
        '        os: <OS の式>',
        "        shard: ['1/2', '2/2']",
        '        exclude:',
        '          - os: ubuntu-latest',
        '        include:',
        '          - os: ubuntu-latest',
        '',
      ].join('\n'),
    );
    expect(quality).toContain('fail-fast: false');
    // テストの実行は、シャードのあるジョブとないジョブで 1 つずつ。ほかにすべてのテストを実行するステップはない
    expect(quality.match(/run: pnpm test\b.*/g)).toEqual(['run: pnpm test --shard=${{ matrix.shard }}', 'run: pnpm test --coverage']);
    // 文書だけの PR の条件（REQ-270）は、シャードの条件に足したもの。その条件は REQ-270 の試験で確かめる
    const docsOnly = "steps.changes.outputs.docs_only != 'true'";
    expect(quality).toContain(`- if: matrix.shard && ${docsOnly}\n        run: pnpm test --shard=\${{ matrix.shard }}\n`);
    expect(quality).toContain(`- if: \${{ !matrix.shard && ${docsOnly} }}\n        run: pnpm test --coverage\n`);
    expect(quality).not.toContain('test:coverage');
    // シャードで変わる条件はテストの 2 つだけ。品質コマンドは文書だけの PR の条件を保ち、診断の 2 ステップは失敗後にも実行する
    const conditions = [...quality.matchAll(/^ {6}(?:- | {2})if: (.*)$/gm)].map((match) => match[1]);
    expect(conditions.filter((condition) => condition.includes('matrix'))).toEqual([`matrix.shard && ${docsOnly}`, `\${{ !matrix.shard && ${docsOnly} }}`]);
    const diagnostics = "${{ !cancelled() && steps.checkout.outcome == 'success' && steps.node.outcome == 'success' && steps.changes.outputs.docs_only != 'true' }}";
    // 品質コマンドの条件は維持し、失敗後にも動く診断の2ステップだけを追加する（REQ-291）
    expect(conditions.filter((condition) => !condition.includes('matrix'))).toEqual([
      ...Array(5).fill(docsOnly), diagnostics, diagnostics, ...Array(3).fill(docsOnly),
    ]);
    for (const step of ['run: pnpm lint', 'run: pnpm typecheck', 'run: pnpm build', 'package-smoke.mjs prepare', 'package-smoke.mjs check']) expect(quality, step).toContain(step);
  });

  // quality ジョブのステップを、先頭から順に取り出す。コメントの行は除く
  const qualitySteps = () => {
    const lf = readLf('.github/workflows/ci.yml');
    const quality = jobBlock(lf, 'quality', 'node22').replace(/^ *#.*\n/gm, '');
    return quality.slice(quality.indexOf('\n    steps:\n') + '\n    steps:\n'.length).split(/\n(?= {6}- )/).filter((step) => /^ {6}- /.test(step));
  };
  const docsOnlyCondition = "steps.changes.outputs.docs_only != 'true'";

  it('[REQ-270] 文書だけかの判定は、paths フィルタではなく quality ジョブの中のステップで行う', () => {
    const lf = readLf('.github/workflows/ci.yml');
    // ワークフローの on に paths・paths-ignore がなく、quality ジョブそのものに条件がない
    expect(lf).not.toMatch(/^\s*paths(-ignore)?:/m);
    const quality = jobBlock(lf, 'quality', 'node22');
    expect(quality).not.toMatch(/^ {4}if:/m);

    const steps = qualitySteps();
    const index = steps.findIndex((step) => /^ {6}(- | {2})id: changes$/m.test(step));
    expect(index, '判定のステップ').toBeGreaterThan(0);
    // 判定は同梱のスクリプトで行い、新しい外部の Action を使わない。イベントの種類と PR の向き先を渡す
    const decide = steps[index]!;
    expect(decide).toContain('run: node scripts/ci-docs-only.mjs');
    expect(decide).not.toContain('uses:');
    expect(decide).toContain('EVENT_NAME: ${{ github.event_name }}');
    expect(decide).toContain('BASE_REF: ${{ github.base_ref }}');
    // 判定より前のステップ（checkout と main の用意）には条件がない
    for (const step of steps.slice(0, index + 1)) expect(step).not.toMatch(/^ {6}(- | {2})if:/m);
    // 判定より後のステップは、すべて文書だけでないときだけ実行する。品質コマンドのステップがすべて含まれる
    const after = steps.slice(index + 1);
    for (const step of after) expect(step, step).toContain(docsOnlyCondition);
    for (const command of ['pnpm/action-setup@', 'actions/setup-node@', 'run: pnpm install', 'run: pnpm lint', 'run: pnpm typecheck', 'run: pnpm test --shard=', 'run: pnpm test --coverage', 'run: pnpm build', 'package-smoke.mjs prepare', 'package-smoke.mjs check']) {
      expect(after.some((step) => step.includes(command)), command).toBe(true);
    }
  });

  it('[REQ-270] main への push では、判定が docs_only=false になり、すべてのステップを実行する', () => {
    // ci.yml は push でも同じ判定のステップを実行し、イベントの種類をスクリプトに渡す。ci.yml の on は pull_request と main への push と定期実行（REQ-049）だけ
    const lf = readLf('.github/workflows/ci.yml');
    const on = lf.slice(lf.indexOf('\non:\n') + 1, lf.indexOf('\npermissions:'));
    expect(on.match(/^ {2}[a-z_]+:/gm)).toEqual(['  pull_request:', '  push:', '  schedule:']);
    expect(on).toMatch(/^ {2}push:\n {4}branches: \[main\]\n/m);
    // main への push でも定期実行でも、判定は docs_only=false になる
    for (const eventName of ['push', 'schedule']) {
      const r = spawnSync(process.execPath, [join(root, 'scripts', 'ci-docs-only.mjs')], {
        cwd: root,
        encoding: 'utf8',
        env: { ...process.env, EVENT_NAME: eventName, BASE_REF: '', GITHUB_OUTPUT: '' },
      });
      expect(r.status, r.stderr).toBe(0);
      expect(r.stdout, eventName).toBe('docs_only=false\n');
    }
    // 条件は「true でない」なので、false のときも、判定の出力がないときも、ステップを実行する
    for (const step of qualitySteps().filter((step) => step.includes('docs_only'))) expect(step).toContain(docsOnlyCondition);
  });

  it('同じ PR の古い実行を取り消し、main への push の実行は取り消さない', () => {
    const lf = readLf('.github/workflows/ci.yml');
    const block = lf.match(/^concurrency:\n {2}group: (.+)\n {2}cancel-in-progress: (.+)\n/m);
    expect(block, 'ワークフローの concurrency').not.toBeNull();
    const [, group, cancel] = block!;
    // ジョブごとの concurrency で上書きしない
    expect(lf.match(/^\s*concurrency:/gm)).toHaveLength(1);

    // GitHub Actions の式を、ci.yml の concurrency が使う範囲（||・==・文字列・文脈の参照）だけ評価する
    type Ctx = Record<string, unknown>;
    const evalExpr = (expr: string, ctx: Ctx): unknown => {
      const ors = expr.split('||').map((e) => e.trim());
      if (ors.length > 1) return ors.map((e) => evalExpr(e, ctx)).find(Boolean) ?? evalExpr(ors.at(-1)!, ctx);
      const eq = expr.split('==').map((e) => e.trim());
      if (eq.length === 2) return evalExpr(eq[0]!, ctx) === evalExpr(eq[1]!, ctx);
      const literal = expr.match(/^'(.*)'$/);
      if (literal) return literal[1];
      if (!/^[a-z_][\w.]*$/i.test(expr)) throw new Error(`テストが評価できない式です：${expr}`);
      return expr.split('.').reduce<unknown>((v, k) => (v as Ctx | undefined)?.[k], ctx);
    };
    const render = (template: string, ctx: Ctx) => {
      const whole = template.match(/^\$\{\{(.*)\}\}$/);
      if (whole) return evalExpr(whole[1]!.trim(), ctx);
      return template.replace(/\$\{\{(.*?)\}\}/g, (_, e: string) => String(evalExpr(e.trim(), ctx)));
    };
    const pr = (number: number, runId: number): Ctx => ({
      github: { event_name: 'pull_request', ref: `refs/pull/${number}/merge`, run_id: runId, event: { pull_request: { number } } },
    });
    const push = (runId: number): Ctx => ({ github: { event_name: 'push', ref: 'refs/heads/main', run_id: runId, event: {} } });

    // 同じ PR の実行は同じ group に入り、古い実行を取り消す
    expect(render(group!, pr(11, 101))).toBe(render(group!, pr(11, 102)));
    expect(String(render(group!, pr(11, 101)))).toContain('11');
    expect(render(cancel!, pr(11, 101))).toBe(true);
    expect(render(group!, pr(12, 103))).not.toBe(render(group!, pr(11, 101)));

    // main に続けて push しても、実行ごとに group が分かれる。実行中の実行も、待機中の実行も取り消されない
    const mainGroups = [201, 202, 203].map((id) => render(group!, push(id)));
    expect(new Set(mainGroups).size).toBe(3);
    expect(render(cancel!, push(201))).toBe(false);
    for (const g of mainGroups) expect(g).not.toBe(render(group!, pr(11, 101)));
  });

  it('[REQ-010][REQ-054] PR ごとに完了ゲートを実行する', () => {
    expect(ci).toMatch(/if: github\.event_name == 'pull_request'/);
    expect(ci).toContain('node scripts/ci-gate.mjs "$HEAD_REF"');
    expect(ci).toContain('${{ github.head_ref }}');
  });

  it('[REQ-010] PR ごとに、change の完了ゲートより前に、いまの仕様を openspec validate --specs --strict で検証する', () => {
    const gate = ci.slice(ci.indexOf('\n  gate:'));
    const validate = gate.indexOf('- run: openspec validate --specs --strict');
    expect(validate).toBeGreaterThan(gate.indexOf('npm install -g @fission-ai/openspec@'));
    expect(validate).toBeLessThan(gate.indexOf('node scripts/ci-gate.mjs'));
  });

  it('[REQ-010][REQ-054] ブランチ名が change-id と一致すれば --change <id> --done で検査する', () => {
    expect(verifyArgs('sample', changes)).toEqual(['--change', 'sample', '--done']);
  });

  it('[REQ-010][REQ-054] run のブランチ名 loomake/<id> からも change-id を取り出す', () => {
    expect(verifyArgs('loomake/sample', changes)).toEqual(['--change', 'sample', '--done']);
    expect(verifyArgs('loomake/fix-typo', changes)).toEqual([]);
    expect(verifyArgs('loomake/archive', changes)).toEqual([]);
  });

  it('[REQ-010][REQ-054] ブランチ名が change-id と一致しなければ品質コマンドだけを実行する', () => {
    expect(verifyArgs('fix-typo', changes)).toEqual([]);
    expect(verifyArgs('', changes)).toEqual([]);
    // changes/ の直下の change だけを対象にする。archive と、/ を含む名前は change ではない
    expect(verifyArgs('archive', changes)).toEqual([]);
    expect(verifyArgs('sample/specs', changes)).toEqual([]);
  });
});

describe('CI の対象の change の決め方', () => {
  // c1・c2 と archive を持つ changes/ を一時ディレクトリに作る
  const withChanges = (fn: (changesDir: string) => void) => {
    const dir = mkdtempSync(join(tmpdir(), 'loomake-ci-'));
    try {
      for (const d of ['c1', 'c2', 'archive/2026-10-23-c3']) mkdirSync(join(dir, d), { recursive: true });
      fn(dir);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };

  it('[REQ-132] gate のジョブに、向き先のブランチと PR の番号と、PR 本文を読む権限を渡す', () => {
    const ci = read('.github/workflows/ci.yml');
    expect(ci).toContain('BASE_REF: ${{ github.base_ref }}');
    expect(ci).toContain('PR_NUMBER: ${{ github.event.pull_request.number }}');
    expect(ci).toMatch(/pull-requests: read/);
  });

  it('[REQ-010][REQ-132] 明示がなければ、ブランチ名とブランチ名 loomake/<id> からも change を決める', () =>
    withChanges((changesDir) => {
      expect(selectChanges({ ref: 'c1', changesDir })).toEqual({ changes: ['c1'] });
      expect(selectChanges({ ref: 'loomake/c1', changesDir })).toEqual({ changes: ['c1'] });
    }));

  it('[REQ-132] PR 本文の loomake-change: に書いた change を、それぞれ検査する', () =>
    withChanges((changesDir) => {
      expect(selectChanges({ ref: 'fix-typo', body: '概要\n\nloomake-change: c1, c2\n', files: ['packages/a.ts'], changesDir })).toEqual({ changes: ['c1', 'c2'] });
      // 明示があれば、ブランチ名と変えたファイルは使わない
      expect(selectChanges({ ref: 'c2', body: 'loomake-change: c1\r\n', files: ['openspec/changes/c2/tasks.md'], changesDir })).toEqual({ changes: ['c1'] });
    }));

  it('[REQ-132] 明示した change がなければ失敗にする', () =>
    withChanges((changesDir) => {
      expect(selectChanges({ ref: 'fix-typo', body: 'loomake-change: nothing', changesDir })).toEqual({ error: 'PR 本文の loomake-change: に書いた change がありません：nothing' });
      expect(selectChanges({ body: 'loomake-change: archive', changesDir })).toHaveProperty('error');
    }));

  it('[REQ-132] 明示した change がなければ、ci-gate は日本語で表示して終了コード 1 を返す', () => {
    const r = spawnSync(process.execPath, ['scripts/ci-gate.mjs', 'fix-typo'], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, PR_BODY: 'loomake-change: nothing', BASE_REF: '' },
    });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('PR 本文の loomake-change: に書いた change がありません：nothing');
  });

  it('[REQ-132] loomake-change: none なら、コードを変えていても品質コマンドだけを実行する', () =>
    withChanges((changesDir) => {
      expect(selectChanges({ ref: 'fix-typo', body: 'loomake-change: none', files: ['packages/a.ts'], changesDir })).toHaveProperty('qualityOnly');
    }));

  it('[REQ-132] 明示がなければ、変えたファイルの change とブランチ名の change を合わせて検査する', () =>
    withChanges((changesDir) => {
      expect(selectChanges({ ref: 'feature-x', files: ['openspec/changes/c1/tasks.md', 'packages/a.ts'], changesDir })).toEqual({ changes: ['c1'] });
      expect(selectChanges({ ref: 'c2', files: ['openspec/changes/c1/tasks.md'], changesDir })).toEqual({ changes: ['c1', 'c2'] });
    }));

  it('[REQ-132] コードを変えていて change を特定できなければ、loomake-change: の行を書くよう案内して失敗にする', () =>
    withChanges((changesDir) => {
      const r = selectChanges({ ref: 'fix-typo', files: ['packages/a.ts', 'docs/usage.md'], changesDir });
      expect(r.error).toContain('PR 本文に「loomake-change: <change-id>」の行を書いてください');
    }));

  it('[REQ-010][REQ-132] ブランチ名が change-id と一致せず、文書だけを変えた PR は、品質コマンドだけを実行する', () =>
    withChanges((changesDir) => {
      expect(selectChanges({ ref: 'fix-typo', files: ['docs/usage.md', 'README.md', '.changeset/x.md'], changesDir })).toHaveProperty('qualityOnly');
    }));

  it('[REQ-132] README.md と .changeset/ だけを変えた PR は、品質コマンドだけを実行する', () =>
    withChanges((changesDir) => {
      expect(selectChanges({ ref: 'fix-typo', files: ['README.md', '.changeset/x.md'], changesDir })).toHaveProperty('qualityOnly');
    }));

  it('[REQ-132] archive の PR は、品質コマンドだけを実行する', () =>
    withChanges((changesDir) => {
      const files = ['openspec/changes/c4/tasks.md', 'openspec/changes/archive/2026-10-23-c4/tasks.md', 'openspec/specs/x/spec.md'];
      expect(selectChanges({ ref: 'archive-c4', files, changesDir })).toHaveProperty('qualityOnly');
    }));
});

describe('changesets', () => {
  it('[REQ-056] .changeset/config.json があり、changeset status がエラーなく終わる', () => {
    expect(existsSync(join(root, '.changeset', 'config.json'))).toBe(true);
    // CI と同じ基準で比べるため origin/main を優先する。ローカルの main は古いことがある。origin が無い checkout では main と比べる
    const base = run('git rev-parse --verify --quiet origin/main').status === 0 ? 'origin/main' : 'main';
    const r = run(`pnpm changeset status --since=${base}`);
    // pnpm changeset version で版を上げるだけの PR は、changeset がなくても通す
    if (r.status !== 0) expect(versionOnlyProblem(diffSince(root, base)), r.stdout + r.stderr).toBeNull();
    // Windows では changeset status に 10 秒を超えることがある（split-ci-gate-requirement の仮定 A-01）
  }, 60_000);
});

describe('版を上げるだけの変更', () => {
  const pkg = (version: string, extra: object = {}) => JSON.stringify({ name: '@loomake/kit', version, dependencies: { '@loomake/core': 'workspace:*' }, ...extra });

  it('[REQ-056] version・CHANGELOG・消化した changeset だけの変更は合格にする', () => {
    expect(versionOnlyProblem([
      { file: 'packages/kit/package.json', status: 'M', before: pkg('0.0.0'), after: pkg('0.1.0') },
      { file: 'packages/kit/CHANGELOG.md', status: 'A' },
      { file: '.changeset/close-cli-gaps.md', status: 'D' },
    ])).toBeNull();
  });

  it('[REQ-056] version のほかに scripts も変えた変更は不合格にする', () => {
    expect(versionOnlyProblem([
      { file: 'packages/kit/package.json', status: 'M', before: pkg('0.0.0'), after: pkg('0.1.0', { scripts: { build: 'x' } }) },
    ])).toContain('packages/kit/package.json');
  });

  it('[REQ-056] ほかのファイルの変更と、config.json の削除は不合格にする', () => {
    expect(versionOnlyProblem([{ file: 'packages/kit/src/index.ts', status: 'M' }])).toContain('packages/kit/src/index.ts');
    expect(versionOnlyProblem([{ file: '.changeset/config.json', status: 'D' }])).toContain('.changeset/config.json');
  });

  it('[REQ-056] version が変わっていなければ、版を上げる変更とみなさない', () => {
    expect(versionOnlyProblem([{ file: '.changeset/x.md', status: 'D' }])).not.toBeNull();
  });
});

describe('ライセンス', () => {
  it('[REQ-057] LICENSE が MIT で、すべての package.json の license が MIT', () => {
    const license = read('LICENSE');
    expect(license).toMatch(/^MIT License/);
    expect(license).toContain('Permission is hereby granted, free of charge');
    for (const p of packageJsons) expect(readJson(p).license, p).toBe('MIT');
  });
});

describe('npm への公開の準備', () => {
  const publishDirs = ['core', 'kit', 'trace', 'runner', 'cli'];
  const repoUrl = 'https://github.com/loomake/loomake';

  it('[REQ-138] 5 つのパッケージに、GitHub のリポジトリを指す repository・homepage・bugs と、description・keywords がある', () => {
    for (const d of publishDirs) {
      const pkg = readJson(`packages/${d}/package.json`);
      expect(pkg.repository, d).toEqual({ type: 'git', url: `git+${repoUrl}.git`, directory: `packages/${d}` });
      expect(pkg.homepage, d).toBe(`${repoUrl}#readme`);
      expect(pkg.bugs?.url, d).toBe(`${repoUrl}/issues`);
      expect(pkg.description, d).toBeTruthy();
      expect(pkg.keywords, d).toContain('openspec');
    }
  });

  it('[REQ-138] CLI の description は init・verify・trace・run・doctor をすべて挙げる', () => {
    const description = readJson('packages/cli/package.json').description;
    for (const c of ['init', 'verify', 'trace', 'run', 'doctor']) expect(description).toContain(c);
  });

  it('[REQ-139] 5 つのパッケージで、pnpm pack の tarball に README.md が入る', () => {
    for (const d of publishDirs) {
      const r = spawnSync('pnpm pack --dry-run --json', { cwd: join(root, 'packages', d), shell: true, encoding: 'utf8' });
      expect(r.status, r.stderr).toBe(0);
      const files = (JSON.parse(r.stdout) as { files: { path: string }[] }).files.map((f) => f.path);
      expect(files, d).toContain('README.md');
    }
  });

  it('[REQ-139] CLI の README に、npx loomake init・リポジトリへのリンク・openspec と gh の案内がある', () => {
    const readme = read('packages/cli/README.md');
    expect(readme).toContain('npx loomake init');
    expect(readme).toContain(repoUrl);
    expect(readme).toContain('`openspec`');
    expect(readme).toContain('`gh`');
  });

  it('[REQ-139] 内部のパッケージの README に、内部用であることと 0.y.z のあいだは API が変わりうることが書いてある', () => {
    for (const d of ['core', 'kit', 'trace', 'runner']) {
      const readme = read(`packages/${d}/README.md`);
      expect(readme, d).toContain('内部用');
      expect(readme, d).toContain('`0.y.z` のあいだは、API が予告なく変わることがある');
    }
  });

  describe('release ワークフロー', () => {
    const release = readLf('.github/workflows/release.yml');
    const at = (s: string) => {
      const i = release.indexOf(s);
      expect(i, s).toBeGreaterThanOrEqual(0);
      return i;
    };

    it('[REQ-140] pnpm changeset publish の前に lint・typecheck・test を実行する', () => {
      const publish = at('run: pnpm changeset publish');
      for (const c of ['run: pnpm lint', 'run: pnpm typecheck', 'run: pnpm test']) expect(at(c)).toBeLessThan(publish);
    });

    it('[REQ-140] concurrency を指定し、実行中のものを取り消さない', () => {
      expect(release).toMatch(/^concurrency:\n(?:\s+.*\n)*?\s+cancel-in-progress: false$/m);
    });

    it('[REQ-141] id-token: write を持ち、公開の前に 11.5.1 以上の npm を入れ、NPM_TOKEN があればそれも使う', () => {
      expect(release).toMatch(/^ *permissions:\n(?:\s+.*\n)*?\s+id-token: write$/m);
      const install = release.match(/run: npm install -g npm@(\d+)\.(\d+)\.(\d+)/);
      expect(install).not.toBeNull();
      const [major, minor, patch] = install!.slice(1).map(Number);
      expect(major * 1e6 + minor * 1e3 + patch).toBeGreaterThanOrEqual(11 * 1e6 + 5 * 1e3 + 1);
      expect(at('run: npm install -g npm@')).toBeLessThan(at('run: pnpm changeset publish'));
      expect(release).toContain('NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}');
    });

    // jobs: の下を、ジョブの名前ごとの本文に分ける
    const jobs = new Map<string, string>();
    for (const part of release.slice(release.indexOf('\njobs:\n')).split(/^ {2}(?=[\w-]+:$)/m).slice(1)) {
      jobs.set(part.slice(0, part.indexOf(':')), part);
    }
    const jobRunning = (command: string) => {
      const found = [...jobs].filter(([, body]) => body.includes(`run: ${command}`));
      expect(found, command).toHaveLength(1);
      return found[0]!;
    };

    it('[REQ-143] ワークフロー全体の権限は contents: read だけで、書き込みの権限は公開のジョブだけが持つ', () => {
      expect(release).toMatch(/^permissions:\n {2}contents: read\n(?! )/m);
      const [publish] = jobRunning('pnpm changeset publish');
      expect(jobs.size).toBeGreaterThanOrEqual(2);
      for (const [name, body] of jobs) {
        const has = (p: string) => new RegExp(`^ {6}${p}$`, 'm').test(body);
        expect(has('id-token: write'), name).toBe(name === publish);
        expect(has('contents: write'), name).toBe(name === publish);
      }
    });

    it('[REQ-143] 公開のジョブは品質のジョブのあとに動き、スクリプトを実行せずにインストールし、ビルドせずにビルドの結果を受け取る', () => {
      const [, publish] = jobRunning('pnpm changeset publish');
      const [check, checkBody] = jobRunning('pnpm test');
      for (const c of ['pnpm lint', 'pnpm typecheck']) expect(jobRunning(c)[0]).toBe(check);
      expect(publish).toMatch(new RegExp(`^ {4}needs: \\[?${check}\\]?$`, 'm'));
      expect(publish).toContain('run: pnpm install --frozen-lockfile --ignore-scripts');
      expect(publish).not.toContain('run: pnpm build');
      expect(checkBody).toContain('uses: actions/upload-artifact@');
      expect(publish).toContain('uses: actions/download-artifact@');
    });

    it('[REQ-143] action をすべてコミットの SHA で指定する', () => {
      const uses = [...release.matchAll(/uses: (\S+)/g)].map((m) => m[1]!);
      expect(uses.length).toBeGreaterThan(0);
      for (const u of uses) expect(u).toMatch(/@[0-9a-f]{40}$/);
    });
  });

  it('[REQ-141] docs/release.md に、初回を NPM_TOKEN で公開し、Trusted Publisher を登録して NPM_TOKEN を外す手順がある', () => {
    const doc = read('docs/release.md');
    const first = doc.indexOf('初回の公開：');
    const next = doc.indexOf('2 回目以降の公開：');
    expect(first).toBeGreaterThanOrEqual(0);
    expect(next).toBeGreaterThan(first);
    expect(doc.slice(first, next)).toContain('`NPM_TOKEN` として登録する');
    const after = doc.slice(next);
    expect(after).toContain('Trusted Publisher を登録する');
    expect(after).toContain('`NPM_TOKEN` を外し');
  });
});
