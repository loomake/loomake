import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ESLint, Linter } from 'eslint';

const root = join(import.meta.dirname, '..');
const policyFile = join(root, 'packages/kit/src/verify/policy/coverage-policy.ts');
const lint = new ESLint({ cwd: root });
const restrictions = new Set(['no-restricted-imports', 'no-restricted-globals', 'no-restricted-properties', 'no-restricted-syntax']);
const policyLint = new Linter({ cwd: root });
const violations = async (source: string, filePath = policyFile) => {
  const config = await lint.calculateConfigForFile(filePath) as Linter.Config | undefined;
  if (!config) throw new Error(`ESLint の設定が見つかりません: ${filePath}`);
  const rules: NonNullable<Linter.Config['rules']> = {};
  for (const name of restrictions) {
    const rule = config.rules?.[name];
    if (rule !== undefined) rules[name] = rule;
  }
  const languageOptions = config.languageOptions as Linter.LanguageOptions | undefined;
  // 各 fixture の parser と制限の適用範囲を保ち、TypeScript の型情報は初期化しない。
  return policyLint.verify(source, [{
    files: ['**/*.ts'],
    languageOptions: {
      ...languageOptions,
      parserOptions: { ...languageOptions?.parserOptions, project: false, projectService: false },
    },
    rules,
  }], { filename: filePath }).filter((message) => restrictions.has(message.ruleId ?? ''));
};

// optional/peer に移しても、配布物が依存するパッケージの予算から外れない
const budgets: Record<string, readonly string[]> = {
  core: ['zod'],
  kit: ['@loomake/core', 'yaml'],
  trace: ['@loomake/core', '@loomake/kit'],
  runner: ['@loomake/core', '@loomake/kit', '@loomake/trace'],
  cli: ['@loomake/core', '@loomake/kit', '@loomake/trace', '@loomake/runner'],
};

type Manifest = Partial<Record<'dependencies' | 'optionalDependencies' | 'peerDependencies', Record<string, string>>> & {
  bundledDependencies?: string[] | boolean;
  bundleDependencies?: string[] | boolean;
};

function overBudget(pkg: Manifest, allowed: readonly string[]): string[] {
  const names = ['dependencies', 'optionalDependencies', 'peerDependencies'].flatMap((field) =>
    Object.entries(pkg[field as 'dependencies'] ?? {}).flatMap(([name, version]) => {
      // npm: の別名で SDK を許可された名前に隠しても、実際の依存名を照合する
      const target = version.match(/^npm:((?:@[^/]+\/)?[^@]+)(?:@|$)/)?.[1];
      return target ? [name, target] : [name];
    }));
  for (const field of ['bundledDependencies', 'bundleDependencies'] as const) {
    const bundled = pkg[field];
    if (Array.isArray(bundled)) names.push(...bundled);
    // true は既存 dependencies 全体を束ねる。個別の名前は上で照合する
  }
  return [...new Set(names)].filter((name) => !allowed.includes(name)).sort();
}

describe('配布パッケージの依存予算（W0-3）', () => {
  it.each(Object.entries(budgets))('%s の実行時依存は許可された範囲だけで、外部ツールの SDK を含まない', (pkg, allowed) => {
    const manifest = JSON.parse(readFileSync(join(root, 'packages', pkg, 'package.json'), 'utf8')) as Manifest;
    expect(overBudget(manifest, allowed)).toEqual([]);
  });

  it.each(['dependencies', 'optionalDependencies', 'peerDependencies', 'bundledDependencies', 'bundleDependencies'] as const)(
    '%s に追加した外部 SDK も予算外として検出する', (field) => {
      for (const sdk of ['openai', '@anthropic-ai/sdk', '@anthropic-ai/claude-agent-sdk', '@openai/codex-sdk', '@playwright/test', '@octokit/rest']) {
        const manifest = { [field]: field === 'bundledDependencies' || field === 'bundleDependencies' ? [sdk] : { [sdk]: '*' } };
        expect(overBudget(manifest, budgets.kit), `${field}: ${sdk}`).toEqual([sdk]);
      }
    },
  );

  it.each(['dependencies', 'optionalDependencies', 'peerDependencies'] as const)(
    '%s の npm 別名で許可された名前に隠した SDK を拒否する', (field) => {
      expect(overBudget({ [field]: { yaml: 'npm:openai@1.0.0' } }, budgets.kit)).toEqual(['openai']);
      expect(overBudget({ [field]: { yaml: 'npm:@anthropic-ai/sdk@1.0.0' } }, budgets.kit)).toEqual(['@anthropic-ai/sdk']);
      expect(overBudget({ [field]: { yaml: 'npm:yaml@2.0.0' } }, budgets.kit)).toEqual([]);
    },
  );

  it('kit が yaml を使える場合も、ほかの外部パッケージと逆向きの内部依存を拒否する', () => {
    expect(overBudget({ dependencies: { '@loomake/core': 'workspace:*', yaml: '*', '@loomake/runner': 'workspace:*', axios: '*' } }, budgets.kit))
      .toEqual(['@loomake/runner', 'axios']);
  });
});

describe('判定ディレクトリの外部状態の補助検査（W0-3）', () => {
  it.each([
    "import { readFileSync } from 'node:fs';",
    "import fs from 'fs';",
    "export { readFile } from 'node:fs/promises';",
    "import 'child_process';",
    "import { spawn } from 'node:child_process';",
    "import { request } from 'https';",
    "import { createRequire } from 'node:module';",
    "export * from 'node:worker_threads';",
  ])('Node の実行時 import・再exportを拒否する: %s', async (source) => {
    expect((await violations(source)).some((message) => message.ruleId === 'no-restricted-imports')).toBe(true);
  });

  it.each([
    'Date.now()', 'new Date()', 'process.env.MODE', 'process["env"]',
    'globalThis.Date.now()', 'global.process.env', 'window.fetch("/")', 'self.fetch("/")',
    'fetch("/")', 'performance.now()', 'Math.random()', 'Math["random"]()',
    'setTimeout(() => {}, 1)', 'setInterval(() => {}, 1)', 'setImmediate(() => {})',
    'queueMicrotask(() => {})', 'console.log("x")', 'crypto.randomUUID()',
    'new WebSocket("/")', 'new XMLHttpRequest()', 'require("fs")', 'eval("x")', 'new Function("return 1")',
  ])('外部状態・副作用の入口を拒否する: %s', async (expression) => {
    expect(await violations(`export const result = ${expression};`)).not.toEqual([]);
  });

  it.each(['import("node:fs")', 'import(name)'])('動的な import を拒否する: %s', async (expression) => {
    expect((await violations(`export const result = ${expression};`)).some((message) => message.ruleId === 'no-restricted-syntax')).toBe(true);
  });

  it('import = require を拒否する', async () => {
    expect((await violations('import fs = require("fs");')).some((message) => message.ruleId === 'no-restricted-syntax')).toBe(true);
  });

  it('型だけの import と、引数による時刻・環境の受け渡しを認める', async () => {
    expect(await violations(`
      import type { Agreement } from '@loomake/core';
      import type { Stats } from 'node:fs';
      export function decide(model: Agreement, now: number, env: { mode: string }, file: Stats) {
        const metadata = { Date: now, process: env.mode };
        return { metadata, ids: model.requirements.map((r) => r.id), size: file.size };
      }
    `)).toEqual([]);
  });

  it('判定の外側の収集モジュールにはこの制限を掛けない', async () => {
    expect(await violations("import { readFileSync } from 'node:fs'; export const value = readFileSync(process.env.FILE!);",
      join(root, 'packages/kit/src/runtime/input.ts'))).toEqual([]);
  });
});
