import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { parseSpec } from '../packages/core/src/index.js';
import { sha256Hex } from '../packages/kit/src/verify/hash.js';
import { checkInitialBaselineStructure } from '../packages/kit/src/verify/trusted/baseline.js';
import type { AdoptionRef, ApprovedBaseline, BaselineRow } from '../packages/kit/src/verify/trusted/baseline-types.js';
import { readGitDocuments } from '../packages/kit/src/verify/trusted/git-objects.js';
import { reconstructOriginalContracts } from '../packages/kit/src/verify/trusted/original-contracts.js';
import { reconstructOriginalScope } from '../packages/kit/src/verify/trusted/original-cross-conditions.js';
import { ORIGINAL_C001_SNAPSHOT_DIR, verifyOriginalSnapshot } from '../packages/kit/src/verify/trusted/original-snapshot.js';
import { buildMainSpecManifest, buildSpecManifest } from '../packages/kit/src/verify/trusted/spec-manifest.js';

const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const original = verifyOriginalSnapshot(readGitDocuments(process.cwd(), head, ORIGINAL_C001_SNAPSHOT_DIR), sha256Hex).documents!;
const index = reconstructOriginalContracts(original, sha256Hex).index!;
const scope = reconstructOriginalScope(original, sha256Hex).scope!;
const by: AdoptionRef[] = [{ trace: { change: 'fixture-owner', id: 'Q-FIXTURE-ONLY' } }];
const reference = (key: string) => ({ file: 'tests/fixture.test.ts', name: `[${key.split('/').at(-1)}] ${key}` });

// Synthetic anchor with original clauses, not the currently adopted owner data or an eligible execution.
function fixture() {
  const texts = new Map<string, string>();
  const rows: BaselineRow[] = index.contracts.map((contract) => {
    const { ref, path, line, name, scenarios } = contract.original;
    const document = original.find((doc) => doc.file === path)!;
    const parsed = parseSpec(path, document.text).value;
    const next = parsed.find((requirement) => requirement.line > line)?.line;
    const body = document.text.replace(/\r\n?/g, '\n').split('\n').slice(line - 1, next ? next - 1 : undefined).join('\n')
      .replace(/\s+## (?:ADDED|MODIFIED|REMOVED|RENAMED) Requirements\s*$/, '').trimEnd();
    const changes = contract.key === 'reference-docs/modified/REQ-324' ? ['verify-v2-evidence', 'verify-v2-scope'] : ['fixture-owner'];
    const owners = changes.map((change) => {
      const main = contract.key === 'verify/modified/REQ-042';
      const file = main ? 'openspec/specs/verify/spec.md'
        : `openspec/changes/${change}/specs/${contract.key.split('/').slice(0, -2).join('/')}/spec.md`;
      const text = (texts.get(file) ?? '') + '\n' + (main ? '' : `## ${parsed.find((r) => r.line === line)!.op} Requirements\n`) + body + '\n';
      texts.set(file, text);
      return { kind: main ? 'main-unchanged' as const : 'delta' as const, ...(main ? {} : { change }), file, name, block: '', scenarios: [...scenarios] };
    });
    return { key: contract.key, original: { ref, path, line, name, scenarios: [...scenarios] }, owners,
      scenarioMap: scenarios.map((scenario) => ({ original: scenario, current: { file: owners[0].file, name, scenario }, status: 'kept' as const })),
      adoption: structuredClone(by), tests: [reference(contract.key)],
      ...(['verify/modified/REQ-038', 'verify/modified/REQ-042'].includes(contract.key)
        ? { open: [{ clause: 'Synthetic public boundary remains open', owner: 'parent-1.3' as const }] } : {}) };
  });
  const anchor = [...texts].map(([file, text]) => ({ file, text }));
  for (const row of rows) for (const owner of row.owners) {
    const text = texts.get(owner.file)!;
    const result = owner.kind === 'main-unchanged' ? buildMainSpecManifest([{ file: owner.file, text }], sha256Hex)
      : buildSpecManifest(owner.change!, [{ file: owner.file, text }], sha256Hex);
    expect(result.problems).toEqual([]);
    owner.block = `sha256:${result.manifest!.blocks.find((block) => block.name === owner.name)!.sha256}`;
  }
  const baseline: ApprovedBaseline = { version: 1, originalIndexSha256: index.sha256,
    counts: { contracts: 47, scenarios: 158, uniqueSources: 46, cross: 16 }, rows,
    cross: scope.cross.map((condition) => ({ ...structuredClone(condition), tests: [reference(condition.rows[0])] })) };
  return { baseline, context: { original, anchor, sha256Hex } };
}

const check = (f: ReturnType<typeof fixture>) => checkInitialBaselineStructure(f.baseline, f.context);
const find = (b: ApprovedBaseline, key: string) => b.rows.find((row) => row.key === key)!;

describe('初回47契約の構造と所有の照合', () => {
  it('[REQ-377] 成功した照合は入力と共有prototypeを変更しない', () => {
    const f = fixture(), before = structuredClone(f.baseline);
    expect(Object.isFrozen(f.baseline)).toBe(false);
    expect(Object.isFrozen(Object.prototype)).toBe(false);
    expect(Object.isFrozen(Array.prototype)).toBe(false);
    const result = check(f);
    expect(result.problems).toEqual([]);
    expect(result.baseline).not.toBeNull();
    expect(result.adoptionsVerified).toBe(false);
    expect(f.baseline).toEqual(before);
    expect(Object.isFrozen(f.baseline)).toBe(false);
    expect(Object.isFrozen(Object.prototype)).toBe(false);
    expect(Object.isFrozen(Array.prototype)).toBe(false);
  });

  it('[REQ-377][REQ-371] 原47/158/46/16と042 unchanged・324の両所有を照合し、採否検証済みとはしない', () => {
    const f = fixture(), result = check(f);
    expect(result.problems).toEqual([]);
    expect(result.baseline?.rows).toHaveLength(47);
    expect(result.baseline?.rows.reduce((sum, row) => sum + row.scenarioMap.length, 0)).toBe(158);
    expect(result.baseline?.cross).toHaveLength(16);
    expect(result.sha256).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(result.adoptionsVerified).toBe(false);
    const reordered = { cross: f.baseline.cross, rows: f.baseline.rows, counts: f.baseline.counts,
      originalIndexSha256: f.baseline.originalIndexSha256, version: 1 };
    expect(checkInitialBaselineStructure(reordered, f.context).sha256).toBe(result.sha256);
    f.baseline.rows[0].adoption = [{ trace: { change: 'fixture-owner', id: 'Q-DIFFERENT' } }];
    expect(check(f).sha256).not.toBe(result.sha256);
  });

  it('[REQ-377][REQ-371] 入力を変更しても返した基準は変わらず、返した全階層も固定する', () => {
    const f = fixture(), result = check(f), before = JSON.stringify(result.baseline);
    f.baseline.rows[0].tests[0].name = 'changed';
    expect(JSON.stringify(result.baseline)).toBe(before);
    expect(Object.isFrozen(result.baseline!.rows[0].scenarioMap[0].current)).toBe(true);
    expect(() => { result.baseline!.rows[0].owners[0].scenarios.push('changed'); }).toThrow(TypeError);
  });

  it.each([
    ['identity欠落', (b: ApprovedBaseline) => { b.rows.pop(); }],
    ['同じ041が残る別契約の重複', (b: ApprovedBaseline) => { b.rows[b.rows.findIndex((r) => r.key === 'cli/modified/REQ-041')] = structuredClone(find(b, 'verify/modified/REQ-041')); }],
    ['原Scenarioの改名', (b: ApprovedBaseline) => { b.rows[0].original.scenarios[0] += 'changed'; }],
    ['原本文indexの改変', (b: ApprovedBaseline) => { b.originalIndexSha256 = 'sha256:' + '0'.repeat(64); }],
    ['対応Scenarioの欠落', (b: ApprovedBaseline) => { b.rows[0].scenarioMap.pop(); }],
    ['対応Scenarioの重複', (b: ApprovedBaseline) => { const r = b.rows.find((r) => r.scenarioMap.length > 1)!; r.scenarioMap[1] = structuredClone(r.scenarioMap[0]); }],
    ['currentも置換も無い', (b: ApprovedBaseline) => { b.rows[0].scenarioMap[0].current = null; }],
    ['置換の採否が空', (b: ApprovedBaseline) => { const m = b.rows[0].scenarioMap[0]; m.current = null; m.status = 'superseded'; m.by = []; }],
    ['所有先の採否が空', (b: ApprovedBaseline) => { b.rows[0].adoption = []; }],
    ['句の置換の採否が空', (b: ApprovedBaseline) => { b.rows[0].supersessions = [{ clause: 'missing decision', by: [] }]; }],
    ['試験IDの欠落', (b: ApprovedBaseline) => { b.rows[0].tests[0].name = 'tagless'; }],
    ['同じ試験参照の重複', (b: ApprovedBaseline) => { b.rows[0].tests.push(structuredClone(b.rows[0].tests[0])); }],
    ['所有本文hashの改変', (b: ApprovedBaseline) => { b.rows[0].owners[0].block = 'sha256:' + '0'.repeat(64); }],
    ['所有Scenarioの自己申告', (b: ApprovedBaseline) => { b.rows[0].owners[0].scenarios.push('invented'); }],
    ['所有changeの取り違え', (b: ApprovedBaseline) => { b.rows[0].owners[0].change = 'other'; }],
    ['対応先Requirementの取り違え', (b: ApprovedBaseline) => { b.rows[0].scenarioMap[0].current!.name = 'other'; }],
    ['042の公開open削除', (b: ApprovedBaseline) => { delete find(b, 'verify/modified/REQ-042').open; }],
    ['038の公開open削除', (b: ApprovedBaseline) => { delete find(b, 'verify/modified/REQ-038').open; }],
    ['042をdeltaへ再割当', (b: ApprovedBaseline) => { find(b, 'verify/modified/REQ-042').owners[0].kind = 'delta'; }],
    ['324の片方を削除', (b: ApprovedBaseline) => { find(b, 'reference-docs/modified/REQ-324').owners.pop(); }],
    ['16条件の欠落', (b: ApprovedBaseline) => { b.cross.pop(); }],
    ['16条件の重複', (b: ApprovedBaseline) => { b.cross[1] = structuredClone(b.cross[0]); }],
    ['横断条件の所属改変', (b: ApprovedBaseline) => { b.cross[0].rows.pop(); }],
    ['横断条件の試験無し', (b: ApprovedBaseline) => { b.cross[0].tests = []; }],
  ] as const)('[REQ-377][REQ-371] %sを初回基準として受理しない', (_name, mutate) => {
    const f = fixture(); mutate(f.baseline);
    const result = check(f);
    expect(result.baseline).toBeNull();
    expect(result.sha256).toBeNull();
    expect(result.problems.length).toBeGreaterThan(0);
    expect(result.adoptionsVerified).toBe(false);
  });

  it('[REQ-377][REQ-371] 件数が同じでもanchorのScenario本文が変われば照合しない', () => {
    const f = fixture(), file = f.baseline.rows[0].owners[0].file;
    const doc = f.context.anchor.find((doc) => doc.file === file)!;
    doc.text = doc.text.replace('**THEN**', '**THEN** changed');
    expect(check(f).baseline).toBeNull();
  });

  it('[REQ-377][REQ-371] archiveの実pathと元changeを結び、誤ったchangeを拒否する', () => {
    const f = fixture(), row = f.baseline.rows.find((r) => r.owners[0].change === 'fixture-owner')!, owner = row.owners[0];
    const previous = owner.file, archived = previous.replace('changes/fixture-owner/', 'changes/archive/2026-11-01-fixture-owner/');
    f.context.anchor.push({ file: archived, text: f.context.anchor.find((doc) => doc.file === previous)!.text });
    owner.kind = 'archived'; owner.file = archived;
    for (const mapping of row.scenarioMap) mapping.current!.file = archived;
    expect(check(f).problems).toEqual([]);
    owner.change = 'other';
    expect(check(f).baseline).toBeNull();
  });

  it('[REQ-377][REQ-371] 他契約のScenarioには明示した補完を要求する', () => {
    const f = fixture(), row = f.baseline.rows[0], other = f.baseline.rows.find((r) => r.key !== row.key)!;
    const scenario = other.owners[0].scenarios[0];
    row.scenarioMap[0].status = 'moved';
    row.scenarioMap[0].current = { file: other.owners[0].file, name: other.owners[0].name, scenario };
    expect(check(f).baseline).toBeNull();
    row.supplements = [{ key: other.key, scenario }];
    expect(check(f).problems).toEqual([]);
  });

  it('[REQ-377] 同じ補完参照の重複を初回基準として受理しない', () => {
    const f = fixture(), row = f.baseline.rows[0], other = f.baseline.rows.find((entry) => entry.key !== row.key)!;
    const supplement = { key: other.key, scenario: other.owners[0].scenarios[0] };
    row.supplements = [supplement];
    expect(check(f).problems).toEqual([]);
    row.supplements.push({ ...supplement });
    const result = check(f);
    expect(result.baseline).toBeNull();
    expect(result.sha256).toBeNull();
    expect(result.problems.length).toBeGreaterThan(0);
    expect(result.adoptionsVerified).toBe(false);
  });

  it('[REQ-377][REQ-371] 現対応のない元Scenarioはopenに残し、実装済みや採否検証済みにしない', () => {
    const f = fixture(), row = f.baseline.rows[0];
    row.scenarioMap[0].current = null;
    expect(check(f).baseline).toBeNull();
    row.open = [{ clause: `${row.scenarioMap[0].original}: current contract still missing`, owner: 'parent-1.2' }];
    const result = check(f);
    expect(result.problems).toEqual([]);
    expect(result.baseline!.rows[0].scenarioMap[0].current).toBeNull();
    expect(result.baseline!.rows[0].open).toEqual(row.open);
    expect(result.baseline!.rows.reduce((sum, entry) => sum + entry.scenarioMap.length, 0)).toBe(158);
    expect(result.adoptionsVerified).toBe(false);
  });

  it('[REQ-377][REQ-371] 私的基準の未知欄・旧string試験名・fullName欄・壊れた採否を受理しない', () => {
    for (const mutate of [
      (b: Record<string, unknown>) => { b.extra = true; },
      (b: Record<string, unknown>) => { (b.rows as Record<string, unknown>[])[0].tests = ['[REQ-041] old']; },
      (b: Record<string, unknown>) => { (b.rows as Record<string, unknown>[])[0].tests = [{ file: 'tests/a.test.ts', fullName: '[REQ-041] old' }]; },
      (b: Record<string, unknown>) => { (b.rows as Record<string, unknown>[])[0].adoption = [{ trace: { change: 'fixture-owner', id: 'Q', extra: true } }]; },
    ]) {
      const f = fixture(), input = structuredClone(f.baseline) as unknown as Record<string, unknown>;
      mutate(input);
      expect(checkInitialBaselineStructure(input, f.context).baseline).toBeNull();
    }
  });

  it('[REQ-377][REQ-376][REQ-371] getterを実行せず拒否し、固定件数の自己申告だけでも受理しない', () => {
    const f = fixture(); let called = false;
    expect(checkInitialBaselineStructure({ get rows() { called = true; return []; } }, f.context).baseline).toBeNull();
    expect(called).toBe(false);
    expect(checkInitialBaselineStructure({ ...f.baseline, counts: { ...f.baseline.counts, contracts: 46 } }, f.context).baseline).toBeNull();
    f.context.anchor.push(f.context.anchor[0]);
    expect(check(f).baseline).toBeNull();
  });

  it.each(['symbol', 'hidden', 'array-extra'] as const)('[REQ-377][REQ-376][REQ-371] JSONから落ちる未知欄を黙って処理しない %s', (kind) => {
    const f = fixture();
    const input = kind === 'symbol' ? Object.assign(f.baseline, { [Symbol('extra')]: true })
      : kind === 'hidden' ? Object.defineProperty(f.baseline, 'hidden', { value: true })
        : { ...f.baseline, rows: Object.assign([...f.baseline.rows], { extra: true }) };
    expect(checkInitialBaselineStructure(input, f.context).baseline).toBeNull();
  });

  it('[REQ-377][REQ-376][REQ-371] 配列のgetterを実行せず拒否する', () => {
    const f = fixture();
    let called = false;
    const rows = [...f.baseline.rows];
    Object.defineProperty(rows, '0', { get() { called = true; return f.baseline.rows[0]; } });
    expect(checkInitialBaselineStructure({ ...f.baseline, rows }, f.context).baseline).toBeNull();
    expect(called).toBe(false);
  });
});
