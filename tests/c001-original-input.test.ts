import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseSpec } from '../packages/core/src/index.js';

// 固定値は原文書14件の実測値。採用済みの原契約を減らさないために本文を固定する。
const originalRef = 'bb88fe238ab0254e34d25dd8caeb19e8d0155cc4';
const prefix = 'scripts/trusted/original-c001/specs';
const documents = [
  {
    "file": "cli/spec.md",
    "bytes": 3407,
    "sha256": "3120c21f84577edd4fa226bb5ad6146d508254a7ee4a0f786bdb56c9459197ce",
    "blob": "6f105eaa5293bf7c767fa45150f1a23c0bd5d57b"
  },
  {
    "file": "core-parsers/spec.md",
    "bytes": 14771,
    "sha256": "da531b680a9a905e9e79c1822a07230897e9e307d998f7c46f4de02136f7f28c",
    "blob": "5a8fca9c4155b20dfda64823b03f1e1f6283d204"
  },
  {
    "file": "external-process-budget/spec.md",
    "bytes": 938,
    "sha256": "fc808ddfb32f4d74e6d8ef63a77f963adbfda8347a80e03f35d6f21c7d415eae",
    "blob": "0058256fc024577c334925cecc57b2a1d4ce1be0"
  },
  {
    "file": "monorepo/spec.md",
    "bytes": 1191,
    "sha256": "9aa09ff34a0b892dd3139c205a4bc5dbc7f1b1014e13e68649eeece6f4ab8812",
    "blob": "3dcee4e871d07379b3c8257432479c4b57d2ddd2"
  },
  {
    "file": "reference-docs/spec.md",
    "bytes": 6141,
    "sha256": "e916ddabb3b816eda5b05b96a274d2ec86dacbb8dfd6cefef436cf75022d43e0",
    "blob": "9f50bb673b2e6962be27af8748b794cbbdd335db"
  },
  {
    "file": "req-to-openspec-skill/spec.md",
    "bytes": 799,
    "sha256": "61341f80649db27293aa31fcba717ff4ce1a98732e19db1c0a866ca85eea5611",
    "blob": "f2372b679a6608c1ac2ad8e4d9baf1284c5c1c42"
  },
  {
    "file": "run-decision-policy/spec.md",
    "bytes": 5464,
    "sha256": "496184fdaea191ad8749c61e6cbf62e5c38b48a57021f503dcd22d43a797bfa9",
    "blob": "1df4e26eb1f4a9cddf3d7bb5118d26fc035bb950"
  },
  {
    "file": "run-pr/spec.md",
    "bytes": 2995,
    "sha256": "c06867128048dabacb9512821b34f93aea426d489e1cc0a8d79e585083732a26",
    "blob": "72bd40d840db66e440536d0006ff1e82ea5b4533"
  },
  {
    "file": "run/spec.md",
    "bytes": 6517,
    "sha256": "4310328532c3b9e4bb69f17cad17a3a83e883b67dfc412742f92e3783c1097f0",
    "blob": "da44332f0b4a8d83b4052dd3b76233d3b3e7107e"
  },
  {
    "file": "trace-agreement/spec.md",
    "bytes": 825,
    "sha256": "fd72276df143ed838e46f41e22d22c430cfb1d806b6e63d767e70039bcad4327",
    "blob": "7ce95e4941b87fe56c498b19cad7d332749d1084"
  },
  {
    "file": "trace-record/spec.md",
    "bytes": 4117,
    "sha256": "94e365e9c8901e891813ccbfbca0645d39f59ad774e1e665c9b1dae5bec443a2",
    "blob": "5fa05239bd542e46027c5d1b419cf9883414c5fc"
  },
  {
    "file": "trace-report/spec.md",
    "bytes": 3915,
    "sha256": "9f787bf619136e05929da8025e1d7bb814cc929d73ef85095c41347074fa1808",
    "blob": "56d2d79e5cd78c43e26da355e1c8bef1b402c859"
  },
  {
    "file": "verification-policy/spec.md",
    "bytes": 5026,
    "sha256": "4d1232f9b0f935ca83a57a6e93dc8e2e67633fa63e24b38115ed87be24df93df",
    "blob": "8dd913e46ecf18e01d5b143c8bd999c6df9e799a"
  },
  {
    "file": "verify/spec.md",
    "bytes": 22257,
    "sha256": "b258709d2c29be9b5eb82cd161b9252eca6a093c40a73c7120fb294a8dd0b46e",
    "blob": "c0e8dc662954f727c26f6de08c1abbdf29e2869c"
  }
] as const;
const root = resolve(import.meta.dirname, '..');
const temporaryRoots: string[] = [];
afterEach(() => { for (const temporaryRoot of temporaryRoots.splice(0)) rmSync(temporaryRoot, { recursive: true, force: true }); });
const git = (repository: string, ...args: string[]) => execFileSync('git', ['--no-replace-objects', '--literal-pathspecs', '-C', repository, ...args],
  { stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 512 * 1024 });
let head: string;
beforeAll(() => { head = git(root, 'rev-parse', 'HEAD').toString('utf8').trim(); });
const blob = (repository: string, ref: string, file: string) => git(repository, 'cat-file', 'blob', `${ref}:${prefix}/${file}`);
const newRoot = () => { const result = mkdtempSync(join(tmpdir(), 'loomake-c001-original-')); temporaryRoots.push(result); return result; };
const fixture = () => {
  const repository = newRoot();
  git(repository, 'init', '-q');
  git(repository, 'config', 'user.name', 'Loomake fixture');
  git(repository, 'config', 'user.email', 'fixture@loomake.invalid');
  git(repository, 'config', 'commit.gpgsign', 'false');
  git(repository, 'config', 'core.autocrlf', 'false');
  const hooks = join(repository, '.empty-hooks'); mkdirSync(hooks);
  git(repository, 'config', 'core.hooksPath', hooks);
  for (const document of documents) {
    const file = join(repository, prefix, document.file); mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, blob(root, head, document.file));
  }
  git(repository, 'add', '--', prefix); git(repository, 'commit', '-qm', 'original documents');
  return { repository, ref: git(repository, 'rev-parse', 'HEAD').toString('utf8').trim() };
};
const expectOriginal = (repository: string, ref: string) => {
  for (const document of documents) {
    const data = blob(repository, ref, document.file);
    expect(data.length).toBe(document.bytes);
    expect(createHash('sha256').update(data).digest('hex')).toBe(document.sha256);
    expect(git(repository, 'rev-parse', `${ref}:${prefix}/${document.file}`).toString('utf8').trim()).toBe(document.blob);
  }
};

describe('C001 の原文書を通常の Git checkout に供給する', () => {
  it('原文書の path 集合が14件ちょうどである', () => {
    const paths = git(root, 'ls-tree', '-rz', '--name-only', head, '--', prefix).toString('utf8').split('\0').filter(Boolean).sort();
    expect(paths).toEqual(documents.map((document) => `${prefix}/${document.file}`).sort());
    expect(git(root, 'status', '--porcelain', '--', prefix).toString('utf8')).toBe('');
  });

  it.each(documents)('$file の全バイト・mode・blobを原本と照合する', (document) => {
    const data = blob(root, head, document.file);
    expect(data.length).toBe(document.bytes);
    expect(createHash('sha256').update(data).digest('hex')).toBe(document.sha256);
    const tree = git(root, 'ls-tree', head, '--', `${prefix}/${document.file}`).toString('utf8');
    expect(tree).toBe(`100644 blob ${document.blob}\t${prefix}/${document.file}\n`);
  });

  it('全47契約・158 Scenario・46 Sourceを保ち、同番号の別契約をまとめない', () => {
    const requirements = documents.flatMap((document) => {
      const result = parseSpec(document.file, blob(root, head, document.file).toString('utf8'));
      expect(result.errors).toEqual([]);
      return result.value.map((requirement) => ({ file: document.file, ...requirement }));
    });
    expect(requirements).toHaveLength(47);
    expect(requirements.reduce((sum, requirement) => sum + requirement.scenarios, 0)).toBe(158);
    expect(new Set(requirements.flatMap((requirement) => requirement.sources)).size).toBe(46);
    expect(requirements.filter((requirement) => requirement.sources.includes('REQ-041')).map((requirement) => requirement.file)).toEqual(['cli/spec.md', 'verify/spec.md']);
    expect(documents.reduce((sum, document) => sum + document.bytes, 0)).toBe(78363);
  });

  it('原commit objectのない新規repositoryでも同じ全原文書を読む', () => {
    const { repository, ref } = fixture();
    expect(spawnSync('git', ['-C', repository, 'cat-file', '-e', `${originalRef}^{commit}`], { stdio: 'pipe' }).status).not.toBe(0);
    expectOriginal(repository, ref);
  });

  it('dirtyな作業ファイルを基準Git objectの代わりに読まない', () => {
    const { repository, ref } = fixture();
    writeFileSync(join(repository, prefix, documents[0].file), '別の本文\r\n');
    expect(git(repository, 'status', '--porcelain', '--', prefix).toString('utf8')).not.toBe('');
    expectOriginal(repository, ref);
  });

  it('shallow cloneとautocrlfのcheckoutでもGit objectの全バイトを保持する', () => {
    const { repository } = fixture();
    const clone = join(newRoot(), 'clone');
    execFileSync('git', ['-c', 'core.autocrlf=true', 'clone', '--depth', '1', '--no-local', '--no-hardlinks', pathToFileURL(repository).href, clone], { stdio: ['ignore', 'pipe', 'pipe'] });
    expect(git(clone, 'rev-parse', '--is-shallow-repository').toString('utf8').trim()).toBe('true');
    const workingFile = readFileSync(join(clone, prefix, documents[0].file));
    expect(workingFile.includes('\r\n')).toBe(true);
    expect(workingFile.equals(blob(root, head, documents[0].file))).toBe(false);
    const ref = git(clone, 'rev-parse', 'HEAD').toString('utf8').trim();
    expect(spawnSync('git', ['-C', clone, 'cat-file', '-e', `${originalRef}^{commit}`], { stdio: 'pipe' }).status).not.toBe(0);
    expectOriginal(clone, ref);
  });
});
