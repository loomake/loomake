import { describe, it, expect } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runVerify } from '@loomake/kit';
import { CHANGE, ledgerRow, reportJson, requirement, specMd, traceMd, vitestCommand, withProject } from './project.js';

const specOnly = (root: string) => runVerify({ root, changeId: CHANGE, gate: 'spec-only' });
const done = (root: string, skipCommands = false) => runVerify({ root, changeId: CHANGE, gate: 'done', skipCommands });
const check = (result: ReturnType<typeof runVerify>, name: string) => result.results.find((r) => r.check === name);

const question = (id: string, blocking: string, answer: string) => `| ${id} | REQ-012 | 何回ですか | 3 / 5 | 5 | ${blocking} | ${answer} |`;

describe('ブロッキング確認事項の検査', () => {
  it('[REQ-034] 未回答のブロッキング確認事項があると、ID・関連・質問を出して不合格', () => {
    const r = withProject({ trace: traceMd({ questions: [question('Q-01', 'yes', '')] }) }, specOnly);
    expect(r.ok).toBe(false);
    expect(check(r, 'ブロッキング確認事項')).toEqual({ check: 'ブロッキング確認事項', status: 'fail', detail: 'Q-01（REQ-012）何回ですか' });
  });

  it('[REQ-034] ブロッキングの確認事項がすべて回答済みなら合格', () => {
    const r = withProject({ trace: traceMd({ questions: [question('Q-01', 'YES', '5 回')] }) }, specOnly);
    expect(check(r, 'ブロッキング確認事項')?.status).toBe('pass');
    expect(r.ok).toBe(true);
  });

  it('[REQ-034] ブロッキングでない確認事項は、回答が空でも合格', () => {
    const r = withProject({ trace: traceMd({ questions: [question('Q-01', 'no', '')] }) }, specOnly);
    expect(check(r, 'ブロッキング確認事項')?.status).toBe('pass');
  });
});

describe('仕様の整合性の検査', () => {
  it('[REQ-035] Source の無い Requirement の名前を出して不合格', () => {
    const r = withProject({ spec: specMd(requirement('出所不明', { source: '' })) }, specOnly);
    expect(check(r, 'Requirement の Source')).toMatchObject({ status: 'fail', detail: 'specs/x/spec.md: 出所不明' });
    expect(r.ok).toBe(false);
  });

  it('[REQ-035] 台帳に無い要件 ID を Source に持つと、Requirement → ID を出して不合格', () => {
    const r = withProject({ spec: specMd(requirement('振る舞い', { source: 'Source: REQ-012, REQ-999' })) }, specOnly);
    expect(check(r, 'Source が台帳にある')).toMatchObject({ status: 'fail', detail: '振る舞い → REQ-999' });
  });

  it('[REQ-035] Scenario の無い Requirement の名前を出して不合格', () => {
    const r = withProject({ spec: specMd(requirement('場面なし', { scenario: false })) }, specOnly);
    expect(check(r, 'Scenario の有無')).toMatchObject({ status: 'fail', detail: '場面なし' });
  });

  it('[REQ-035] 反映済なのにどの Requirement からも参照されない要件を出して不合格', () => {
    const r = withProject({ trace: traceMd({ ledger: [ledgerRow('REQ-012'), ledgerRow('REQ-007')] }) }, specOnly);
    expect(check(r, '反映済の要件が仕様にある')).toMatchObject({ status: 'fail', detail: 'REQ-007' });
  });
});

describe('仕様ゲートの警告', () => {
  it('[REQ-036] 未承認の仮定と確認待ちの要件は警告になり、合格のまま', () => {
    const trace = traceMd({
      ledger: [ledgerRow('REQ-012'), ledgerRow('REQ-002', '確認待ち')],
      assumptions: ['| A-01 | REQ-012 | 8 文字以上 | 記載なし | |'],
    });
    const r = withProject({ trace }, specOnly);
    expect(check(r, '仮定の承認')).toMatchObject({ status: 'warn', detail: '未承認：A-01 8 文字以上' });
    expect(check(r, '確認待ちの要件')).toMatchObject({ status: 'warn', detail: 'REQ-002' });
    expect(r.ok).toBe(true);
  });
});

describe('openspec validate の実行', () => {
  it('[REQ-037] openspec validate --strict が失敗すると、出力を詳細に入れて不合格', () => {
    // SHALL・MUST の無い Requirement は strict の検証に通らない
    const spec = '## ADDED Requirements\n\n### Requirement: 弱い\nシステムは振る舞いを持つ。\n\nSource: REQ-012\n\n#### Scenario: 確かめる\n- **WHEN** 確かめる\n- **THEN** 結果が出る\n';
    const r = withProject({ spec, config: { openspecValidate: true, commands: {} } }, specOnly);
    const v = check(r, 'openspec validate');
    expect(v?.status).toBe('fail');
    expect(v?.detail).toMatch(/SHALL|MUST/);
  });

  it('[REQ-037] OpenSpec CLI が見つからず openspecValidate が auto なら、警告だけで不合格にしない', () => {
    const empty = mkdtempSync(join(tmpdir(), 'loomake-empty-path-'));
    const saved = process.env.PATH;
    process.env.PATH = empty;
    try {
      const r = withProject({ config: { openspecValidate: 'auto', commands: {} } }, specOnly);
      expect(check(r, 'openspec validate')).toMatchObject({ status: 'warn' });
      expect(check(r, 'openspec validate')?.detail).toContain('OpenSpec CLI が見つかりません');
      expect(r.ok).toBe(true);
    } finally {
      process.env.PATH = saved;
      rmSync(empty, { recursive: true, force: true });
    }
  });
});

describe('完了ゲート', () => {
  const passedReport = (root: string) => reportJson(root, { 'tests/a.test.ts': [['[REQ-012] 動く', 'passed']] });
  const withReport = (files: Parameters<typeof withProject>[0], fn: (root: string) => ReturnType<typeof runVerify>) =>
    withProject(files, (root) => {
      mkdirSync(join(root, '.loomake'), { recursive: true });
      writeFileSync(join(root, '.loomake', 'test-report.json'), passedReport(root));
      return fn(root);
    });

  it('[REQ-038] 未完了のタスクがあると、その行を出して不合格', () => {
    const r = withReport({ tasks: '## 1. 実装\n- [x] 1.1 済み\n- [ ] 1.2 残り\n' }, (root) => done(root, true));
    expect(check(r, 'tasks.md')).toMatchObject({ status: 'fail', detail: '- [ ] 1.2 残り' });
    expect(r.ok).toBe(false);
  });

  it('[REQ-038] 確認待ちの要件が残ると、その ID を出して不合格', () => {
    const trace = traceMd({ ledger: [ledgerRow('REQ-012'), ledgerRow('REQ-002', '確認待ち')] });
    const r = withReport({ trace }, (root) => done(root, true));
    expect(check(r, '確認待ちが残っていない')).toMatchObject({ status: 'fail', detail: 'REQ-002' });
  });

  it('[REQ-038] 仕様で参照される要件を名前に含むテストが無いと不合格', () => {
    const r = withProject({}, (root) => {
      mkdirSync(join(root, '.loomake'));
      writeFileSync(join(root, '.loomake', 'test-report.json'), reportJson(root, { 'tests/a.test.ts': [['[REQ-001] 別の要件', 'passed']] }));
      return done(root, true);
    });
    expect(check(r, '要件ごとのテスト')).toMatchObject({ status: 'fail', detail: 'テストが無い要件：REQ-012' });
  });

  it('[REQ-038] 要件のテストがあれば合格し、全体も合格', () => {
    const r = withReport({}, (root) => done(root, true));
    expect(check(r, '要件ごとのテスト')?.status).toBe('pass');
    expect(r.ok).toBe(true);
  });

  // 以下は一時プロジェクトで実際に Vitest を実行し、書き出されたレポートで判定する
  const withTests = (tests: Record<string, string>) =>
    withProject({ config: { openspecValidate: false, commands: { test: vitestCommand() } }, files: tests }, (root) => done(root));

  it('[REQ-038] it.skip のテストだけなら、テストが無い要件として不合格', () => {
    const r = withTests({ 'tests/a.test.ts': "it.skip('[REQ-012] skip', () => {});\nit('別のテスト', () => {});\n" });
    expect(check(r, '要件ごとのテスト')).toMatchObject({ status: 'fail', detail: 'テストが無い要件：REQ-012' });
  }, 30_000);

  it('[REQ-038] describe.skip.each の中にだけあるテストは数えない', () => {
    const r = withTests({
      'tests/a.test.ts': "describe.skip.each([1])('skip %s', () => { it('[REQ-012] 中', () => {}); });\nit('別のテスト', () => {});\n",
    });
    expect(check(r, '要件ごとのテスト')).toMatchObject({ status: 'fail', detail: 'テストが無い要件：REQ-012' });
  }, 30_000);

  it('[REQ-038] テスト名以外の文字列にだけある要件 ID は数えない', () => {
    const r = withTests({ 'tests/a.test.ts': "const fixture = '[REQ-012]';\nit('fixture', () => { expect(fixture).toBeTruthy(); });\n" });
    expect(check(r, '要件ごとのテスト')).toMatchObject({ status: 'fail', detail: 'テストが無い要件：REQ-012' });
  }, 30_000);

  it('[REQ-038] テストランナーが実行しないファイルのテストは数えない', () => {
    const r = withTests({
      'tests/a.case.ts': "it('[REQ-012] 実行されない', () => {});\n",
      'tests/b.test.ts': "it('別のテスト', () => {});\n",
    });
    expect(check(r, '要件ごとのテスト')).toMatchObject({ status: 'fail', detail: 'テストが無い要件：REQ-012' });
  }, 30_000);

  it('[REQ-038] 実際に成功したテストの名前にある要件 ID を数える', () => {
    const r = withTests({ 'tests/a.test.ts': "describe('[REQ-012] ログイン', () => { it('成功する', () => {}); });\n" });
    expect(check(r, '要件ごとのテスト')?.status).toBe('pass');
    expect(r.coverage).toEqual({ 'REQ-012': ['tests/a.test.ts'] });
  }, 30_000);

  it('[REQ-038] test コマンドがレポートを書き出さないと、前回のレポートが残っていても不合格', () => {
    const r = withReport({ config: { openspecValidate: false, commands: { test: 'node -e ""' } } }, (root) => done(root));
    const c = check(r, '要件ごとのテスト');
    expect(c?.status).toBe('fail');
    expect(c?.detail).toContain('テストのレポート（.loomake/test-report.json）がありません');
  });
});

describe('品質コマンドの実行', () => {
  it('[REQ-039] コマンドが失敗すると、出力の末尾を詳細に入れて不合格', () => {
    const config = { openspecValidate: false, commands: { test: 'node -e "console.log(\'テストの出力\'); process.exit(1)"' } };
    const r = withProject({ config }, (root) => done(root));
    expect(check(r, 'command: test')).toMatchObject({ status: 'fail', detail: 'テストの出力' });
    expect(r.ok).toBe(false);
  });

  it('[REQ-039] 3 つのコマンドがすべて成功すると、command: の検査はすべて合格', () => {
    const ok = 'node -e ""';
    const r = withProject({ config: { openspecValidate: false, commands: { test: ok, lint: ok, typecheck: ok } } }, (root) => done(root));
    // lint・typecheck・test の順に実行する（仮定 A-02）
    expect(r.results.filter((x) => x.check.startsWith('command:'))).toEqual([
      { check: 'command: lint', status: 'pass', detail: '' },
      { check: 'command: typecheck', status: 'pass', detail: '' },
      { check: 'command: test', status: 'pass', detail: '' },
    ]);
  });
});

describe('change の省略', () => {
  it('[REQ-042] change を省略すると commands だけを実行し、仕様の検査はしない', () => {
    const r = withProject({ config: { commands: { lint: 'node -e ""' } } }, (root) => runVerify({ root }));
    expect(r.mode).toBe('quality');
    expect(r.change).toBeNull();
    expect(r.results.map((x) => x.check)).toEqual(['command: lint']);
  });
});

describe('日本語のメッセージ', () => {
  it('[REQ-055] 存在しない change-id では、change の存在が日本語の説明つきで不合格', () => {
    const r = withProject({}, (root) => runVerify({ root, changeId: 'no-such-change', gate: 'spec-only' }));
    expect(check(r, 'change の存在')).toEqual({
      check: 'change の存在',
      status: 'fail',
      detail: 'openspec/changes/no-such-change がありません。change-id を確かめてください',
    });
  });
});
