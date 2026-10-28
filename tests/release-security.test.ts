import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { actionReferenceProblem } from '../scripts/action-pins.mjs';

const root = join(import.meta.dirname, '..');
const workflowRoot = join(root, '.github/workflows');
const workflows = readdirSync(workflowRoot).filter((file) => /\.ya?ml$/.test(file));
// Windows のチェックアウトでは行末が CRLF になり、`\n` を書いた正規表現に合わないので、LF にそろえて読む
const read = (file: string) => readFileSync(join(workflowRoot, file), 'utf8').replace(/\r\n/g, '\n');

describe('公開経路の供給網と資格情報', () => {
  it.each(workflows)('[REQ-167] %sの外部Actionsは確認済みの完全なSHAに固定する', (file) => {
    const pins = JSON.parse(readFileSync(join(root, '.github/action-pins.json'), 'utf8'));
    const references = [...read(file).matchAll(/^\s*- uses:\s*(\S+)/gm)].map((match) => match[1]);
    expect(references.length).toBeGreaterThan(0);
    for (const reference of references) expect(actionReferenceProblem(reference, pins.actions), reference).toBeNull();
  });

  it('[REQ-167] サブパスを持つ参照も、リポジトリと完全な SHA で記録と照合する', () => {
    const sha = 'a'.repeat(40);
    const pins = [{ repository: 'github/codeql-action', ref: 'v4', sha }];
    expect(actionReferenceProblem(`github/codeql-action/init@${sha}`, pins)).toBeNull();
    expect(actionReferenceProblem(`github/codeql-action/analyze@${sha}`, pins)).toBeNull();
    expect(actionReferenceProblem(`github/codeql-action/init@${sha.slice(0, 7)}`, pins)).not.toBeNull();
    expect(actionReferenceProblem('github/codeql-action/init@v4', pins)).not.toBeNull();
    expect(actionReferenceProblem(`github/other/init@${sha}`, pins)).not.toBeNull();
    expect(actionReferenceProblem(`github/codeql-action@${'b'.repeat(40)}`, pins)).not.toBeNull();
  });

  it.each(workflows)('[REQ-168] %sの既定権限はreadでcheckoutに資格情報を保存しない', (file) => {
    const workflow = read(file);
    expect(workflow).toMatch(/^permissions:\n {2}contents: read\n/m);
    const checkouts = [...workflow.matchAll(/- uses: actions\/checkout@[^\n]+\n([\s\S]*?)(?=\n {6}- |$)/g)];
    expect(checkouts.length).toBeGreaterThan(0);
    for (const checkout of checkouts) expect(checkout[1]).toContain('persist-credentials: false');
    if (file !== 'release.yml') expect(workflow).not.toMatch(/^\s+(contents|id-token): write$/m);
  });

  it('[REQ-168][REQ-169] 公開とタグ送信の資格情報を品質コマンドの後の専用ステップだけに渡す', () => {
    const release = read('release.yml');
    expect(release).toContain("if: github.ref == 'refs/heads/main'");
    expect(release).toContain('workflow_dispatch:');
    expect(release).toMatch(/publish:\n(?:.*\n)*? {4}permissions:\n {6}contents: write\n {6}id-token: write\n/);
    const qualityEnd = release.indexOf('package-smoke.mjs check');
    const publish = release.indexOf('run: pnpm changeset publish');
    const auth = release.indexOf('NODE_AUTH_TOKEN:');
    const provenance = release.indexOf('NPM_CONFIG_PROVENANCE:');
    const tags = release.indexOf('gh auth setup-git');
    const gitAuth = release.indexOf('GH_TOKEN:');
    expect(publish).toBeGreaterThan(qualityEnd);
    expect(auth).toBeGreaterThan(publish);
    expect(provenance).toBeGreaterThan(publish);
    expect(release.slice(provenance)).toMatch(/^NPM_CONFIG_PROVENANCE: ['"]?true/);
    expect(tags).toBeGreaterThan(auth);
    expect(gitAuth).toBeGreaterThan(tags);
    expect(release.slice(0, publish)).not.toContain('secrets.NPM_TOKEN');
    expect(release.slice(0, tags)).not.toContain('GH_TOKEN:');
    expect(release.slice(tags)).toContain('git push --follow-tags');
  });

  it.each(['core', 'kit', 'trace', 'runner', 'cli'])('[REQ-169] %sのpackage.jsonはrepositoryを1つだけ持つ', (name) => {
    const text = readFileSync(join(root, 'packages', name, 'package.json'), 'utf8');
    expect(text.match(/^ {2}"repository":/gm)).toHaveLength(1);
  });

  it.each(['core', 'kit', 'trace', 'runner', 'cli'])('[REQ-169] %sの公開元とディレクトリを明示しprovenanceを要求する', (name) => {
    const manifest = JSON.parse(readFileSync(join(root, 'packages', name, 'package.json'), 'utf8'));
    expect(manifest.repository).toEqual({ type: 'git', url: 'git+https://github.com/loomake/loomake.git', directory: `packages/${name}` });
    expect(manifest.publishConfig.provenance).toBe(true);
  });
});

describe('コードの静的解析', () => {
  it('[REQ-200] CodeQL のワークフローは PR・main・定期実行で JavaScript と TypeScript を解析し、書き込みは解析のジョブの security-events だけ', () => {
    const workflow = read('codeql.yml');
    expect(workflow).toMatch(/^ {2}pull_request:/m);
    expect(workflow).toMatch(/^ {2}push:\n {4}branches: \[main\]/m);
    expect(workflow).toMatch(/^ {2}schedule:/m);
    expect(workflow).toContain('languages: javascript-typescript');
    expect(workflow).toMatch(/^permissions:\n {2}contents: read\n/m);
    expect([...workflow.matchAll(/^\s+([\w-]+): write$/gm)].map((m) => m[1])).toEqual(['security-events']);
    expect(workflow).toMatch(/- uses: github\/codeql-action\/init@[a-f0-9]{40}/);
    expect(workflow).toMatch(/- uses: github\/codeql-action\/analyze@[a-f0-9]{40}/);
  });
});
