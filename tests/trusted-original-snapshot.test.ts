import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { ORIGINAL_C001_DOCUMENTS, ORIGINAL_C001_SNAPSHOT_DIR, originalDocumentsDigest, verifyOriginalSnapshot } from '../packages/kit/src/verify/trusted/original-snapshot.js';
import { ORIGINAL_C001_REF, reconstructOriginalContracts } from '../packages/kit/src/verify/trusted/original-contracts.js';
import { reconstructOriginalScope } from '../packages/kit/src/verify/trusted/original-cross-conditions.js';
import { readGitDocuments, type GitDocument } from '../packages/kit/src/verify/trusted/git-objects.js';
import { sha256Hex } from '../packages/kit/src/verify/hash.js';

const root = resolve(import.meta.dirname, '..');
const temporaryRoots: string[] = [];
afterEach(() => { for (const temporaryRoot of temporaryRoots.splice(0)) rmSync(temporaryRoot, { recursive: true, force: true }); });
const git = (repository: string, ...args: string[]) => execFileSync('git', ['--no-replace-objects', '--literal-pathspecs', '-C', repository, ...args],
  { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
let documents: GitDocument[];
beforeAll(() => { documents = readGitDocuments(root, git(root, 'rev-parse', 'HEAD'), ORIGINAL_C001_SNAPSHOT_DIR); });
const verify = (files = documents) => verifyOriginalSnapshot(files, sha256Hex);
const changedFirst = (edit: (file: GitDocument) => GitDocument) => [edit({ ...documents[0] }), ...documents.slice(1)];
const fixture = () => {
  const repository = mkdtempSync(join(tmpdir(), 'loomake-trusted-original-')); temporaryRoots.push(repository);
  git(repository, 'init', '-q');
  git(repository, 'config', 'user.name', 'Loomake fixture'); git(repository, 'config', 'user.email', 'fixture@loomake.invalid');
  git(repository, 'config', 'commit.gpgsign', 'false'); git(repository, 'config', 'core.autocrlf', 'false');
  const hooks = join(repository, '.empty-hooks'); mkdirSync(hooks); git(repository, 'config', 'core.hooksPath', hooks);
  for (const document of documents) {
    const file = join(repository, document.file); mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, document.text);
  }
  git(repository, 'add', '--', ORIGINAL_C001_SNAPSHOT_DIR); git(repository, 'commit', '-qm', 'A original documents');
  return { repository, a: git(repository, 'rev-parse', 'HEAD') };
};

describe('Aに固定した原14文書の全バイト照合', () => {
  it('[REQ-377][REQ-370][REQ-371] 原本の全pathを照合して歴史的な論理pathへ写す', () => {
    const result = verify();
    expect(result.problems).toEqual([]);
    expect(result.documents?.map((document) => document.file)).toEqual(ORIGINAL_C001_DOCUMENTS.map((document) => document.file));
    expect(result.documents).toHaveLength(14);
    expect(git(root, 'status', '--porcelain', '--', ORIGINAL_C001_SNAPSHOT_DIR)).toBe('');
    expect(verify([...documents].reverse())).toEqual(result);
  });

  it('[REQ-377][REQ-371] 独立実測した文書manifest・47契約index・16条件scopeのdigestを保持する', () => {
    const original = verify().documents!;
    expect(originalDocumentsDigest(sha256Hex)).toBe('sha256:5c5122cc2d4c654de965cb6c062bb5b6f3c339d1b5cbada74bfca436f4b8c194');
    expect(reconstructOriginalContracts(original, sha256Hex).index?.sha256).toBe('sha256:5fdcf896738f28bfbaee94ebeaf0a5ec19cfae82a01632b30d0441acd1b6eeaf');
    const scope = reconstructOriginalScope(original, sha256Hex).scope;
    expect(scope?.documents).toBe('sha256:5c5122cc2d4c654de965cb6c062bb5b6f3c339d1b5cbada74bfca436f4b8c194');
    expect(scope?.sha256).toBe('sha256:71d697a01c7affe7867fa44f6f138afaaf5149ac8e12dca8572e20112164ca8d');
    expect(scope?.counts).toEqual({ contracts: 47, scenarios: 158, uniqueSources: 46, cross: 16 });
  });

  it.each([
    ['欠落', () => documents.slice(1)],
    ['追加', () => [...documents, { ...documents[0], file: `${ORIGINAL_C001_SNAPSHOT_DIR}/unknown/spec.md` }]],
    ['重複', () => [...documents, { ...documents[0] }]],
    ['別path', () => changedFirst((file) => ({ ...file, file: `${ORIGINAL_C001_SNAPSHOT_DIR}/renamed/spec.md` }))],
    ['範囲外path', () => changedFirst((file) => ({ ...file, file: 'docs/spec.md' }))],
    ['親を含むpath', () => changedFirst((file) => ({ ...file, file: `${ORIGINAL_C001_SNAPSHOT_DIR}/../spec.md` }))],
    ['blobだけの不一致', () => changedFirst((file) => ({ ...file, oid: '0'.repeat(40) }))],
    ['実行可能mode', () => changedFirst((file) => ({ ...file, mode: '100755' }))],
    ['1バイト追加', () => changedFirst((file) => ({ ...file, text: `${file.text}x` }))],
    ['同じバイト長の本文変更', () => changedFirst((file) => ({ ...file, text: file.text.replace('##', '!#') }))],
    ['CRLFへの変換', () => changedFirst((file) => ({ ...file, text: file.text.replaceAll('\n', '\r\n') }))],
    ['BOMの追加', () => changedFirst((file) => ({ ...file, text: `\uFEFF${file.text}` }))],
  ] as const)('[REQ-377][REQ-370][REQ-371] %sを原文書の一致にしない', (_name, mutate) => {
    const result = verify(mutate());
    expect(result.documents).toBeNull();
    expect(result.problems.length).toBeGreaterThan(0);
  });

  it('[REQ-377][REQ-371] 原commit objectがないrepositoryからも元47契約と16条件を復元する', () => {
    const { repository, a } = fixture();
    expect(spawnSync('git', ['-C', repository, 'cat-file', '-e', `${ORIGINAL_C001_REF}^{commit}`], { stdio: 'pipe' }).status).not.toBe(0);
    const result = verify(readGitDocuments(repository, a, ORIGINAL_C001_SNAPSHOT_DIR));
    expect(result.problems).toEqual([]);
    expect(reconstructOriginalScope(result.documents!, sha256Hex).scope?.counts).toEqual({ contracts: 47, scenarios: 158, uniqueSources: 46, cross: 16 });
  });

  it('[REQ-377][REQ-370][REQ-371] 対象commitの改変で基準Aの原文書を選び直さない', () => {
    const { repository, a } = fixture();
    writeFileSync(join(repository, documents[0].file), documents[0].text.replace('##', '!#'));
    git(repository, 'commit', '-qam', 'target changes original');
    const target = git(repository, 'rev-parse', 'HEAD');
    expect(verify(readGitDocuments(repository, target, ORIGINAL_C001_SNAPSHOT_DIR)).documents).toBeNull();
    expect(verify(readGitDocuments(repository, a, ORIGINAL_C001_SNAPSHOT_DIR)).problems).toEqual([]);
  });

  it('[REQ-377][REQ-371] 呼出し側が固定manifestの配列や各行を書き換えられない', () => {
    expect(Object.isFrozen(ORIGINAL_C001_DOCUMENTS)).toBe(true);
    expect(ORIGINAL_C001_DOCUMENTS.every((document) => Object.isFrozen(document))).toBe(true);
  });
});
