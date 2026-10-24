import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const workflowRoot = join(root, '.github/workflows');
const workflows = readdirSync(workflowRoot).filter((file) => /\.ya?ml$/.test(file));
const read = (file: string) => readFileSync(join(workflowRoot, file), 'utf8');

describe('公開経路の供給網と資格情報', () => {
  it.each(workflows)('[REQ-167] %sの外部Actionsは確認済みの完全なSHAに固定する', (file) => {
    const pins = JSON.parse(readFileSync(join(root, '.github/action-pins.json'), 'utf8'));
    const references = [...read(file).matchAll(/^\s*- uses:\s*(\S+)/gm)].map((match) => match[1]);
    expect(references.length).toBeGreaterThan(0);
    for (const reference of references) {
      expect(reference).toMatch(/^[\w-]+\/[\w-]+@[a-f0-9]{40}$/);
      const [repository, sha] = reference.split('@');
      expect(pins.actions).toContainEqual(expect.objectContaining({ repository, sha, ref: 'v4' }));
    }
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

  it.each(['core', 'kit', 'trace', 'runner', 'cli'])('[REQ-169] %sの公開元とディレクトリを明示しprovenanceを要求する', (name) => {
    const manifest = JSON.parse(readFileSync(join(root, 'packages', name, 'package.json'), 'utf8'));
    expect(manifest.repository).toEqual({ type: 'git', url: 'git+https://github.com/loomake/loomake.git', directory: `packages/${name}` });
    expect(manifest.publishConfig.provenance).toBe(true);
  });
});
