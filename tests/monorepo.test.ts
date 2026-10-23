import { describe, it, expect } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { selectChanges, verifyArgs } from '../scripts/ci-gate.mjs';

const root = join(import.meta.dirname, '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const readJson = (p: string) => JSON.parse(read(p));
// Windows のチェックアウトでは行末が CRLF になるので、行の正規表現で読むファイルは LF にそろえる
const readLf = (p: string) => read(p).replace(/\r\n/g, '\n');
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

  it('[REQ-004] postCreateCommand で OpenSpec CLI を入れる', () => {
    expect(postCreate).toContain('@fission-ai/openspec');
  });

  it('[REQ-061] Node 24 系のイメージを使う', () => {
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

  it('[REQ-049] ubuntu・macos・windows の 3 つで pnpm test を実行する', () => {
    expect(ci).toMatch(/os:\s*\[ubuntu-latest, macos-latest, windows-latest\]/);
    expect(ci).toMatch(/runs-on: \$\{\{ matrix\.os \}\}/);
    expect(ci).toContain('run: pnpm test');
  });

  it('[REQ-010][REQ-054] PR ごとに完了ゲートを実行する', () => {
    expect(ci).toMatch(/if: github\.event_name == 'pull_request'/);
    expect(ci).toContain('node scripts/ci-gate.mjs "$HEAD_REF"');
    expect(ci).toContain('${{ github.head_ref }}');
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
    expect(r.status, r.stdout + r.stderr).toBe(0);
    // Windows では changeset status に 10 秒を超えることがある（split-ci-gate-requirement の仮定 A-01）
  }, 60_000);
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
