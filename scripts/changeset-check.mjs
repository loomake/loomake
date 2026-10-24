// pnpm changeset version で版を上げるだけの変更かを見分ける（REQ-056）。
// 版を上げる PR は changeset を消化するので、changeset status が「changeset がない」で失敗する
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const isChangeset = (file) => /^\.changeset\/[^/]+\.md$/.test(file) && file !== '.changeset/README.md';
const isChangelog = (file) => /^(packages\/[^/]+\/)?CHANGELOG\.md$/.test(file);
const isManifest = (file) => /^(packages\/[^/]+\/)?package\.json$/.test(file);

// version と、ワークスペースの中の依存の版を除いた package.json
function withoutVersions(text) {
  const manifest = JSON.parse(text);
  delete manifest.version;
  for (const key of ['dependencies', 'devDependencies', 'peerDependencies']) {
    for (const name of Object.keys(manifest[key] ?? {})) if (name === 'loomake' || name.startsWith('@loomake/')) delete manifest[key][name];
  }
  return JSON.stringify(manifest);
}

/**
 * 変更が版の上げ下げだけなら null、そうでなければ理由を返す。
 * changes は { file, status（A・M・D）, before?, after? }（package.json は変更前後の中身）の配列
 */
export function versionOnlyProblem(changes) {
  let bumped = false;
  for (const { file, status, before, after } of changes) {
    if (status === 'D' && isChangeset(file)) continue;
    if (isChangelog(file) && status !== 'D') continue;
    if (status === 'M' && isManifest(file) && before !== undefined && after !== undefined) {
      if (withoutVersions(before) !== withoutVersions(after)) return `${file} で version のほかの項目も変わっています`;
      if (JSON.parse(before).version !== JSON.parse(after).version) bumped = true;
      continue;
    }
    return `${file} は版の上げ下げの変更ではありません`;
  }
  return bumped ? null : 'どの package.json の version も変わっていません';
}

const git = (root, args) => spawnSync('git', args, { cwd: root, encoding: 'utf8' }).stdout ?? '';

/** base と作業ツリーの差分を、versionOnlyProblem に渡す形にする */
export function diffSince(root, base) {
  const fields = git(root, ['diff', '--name-status', '--no-renames', '-z', base]).split('\0').filter(Boolean);
  const changes = [];
  for (let i = 0; i + 1 < fields.length; i += 2) {
    const status = fields[i];
    const file = fields[i + 1];
    const change = { file, status };
    if (status === 'M' && isManifest(file)) {
      change.before = git(root, ['show', `${base}:${file}`]);
      change.after = readFileSync(join(root, file), 'utf8');
    }
    changes.push(change);
  }
  return changes;
}
