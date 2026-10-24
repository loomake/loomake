import { describe, it, expect, vi } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { formatVerifyResult, INTERRUPTED, runVerify } from '@loomake/kit';
import { CHANGE, INTERRUPT_SCRIPT, alive, ledgerRow, reportJson, requirement, specMd, traceMd, vitestCommand, withProject } from './project.js';

// git やコマンドのプロセスを何度も起動するので、マシンの負荷が高いと既定の 5 秒を超えることがある
vi.setConfig({ testTimeout: 60_000 });

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

  it('[REQ-034] ブロッキング列が はい で回答が空なら、ブロッキングとみなして不合格', () => {
    const r = withProject({ trace: traceMd({ questions: [question('Q-01', 'はい', '')] }) }, specOnly);
    expect(r.ok).toBe(false);
    expect(check(r, 'ブロッキング確認事項')).toEqual({ check: 'ブロッキング確認事項', status: 'fail', detail: 'Q-01（REQ-012）何回ですか' });
  });

  it('[REQ-034] ブロッキング列が yes・no・はい・いいえ のどれでもなければ、ID と値を出して不合格', () => {
    for (const value of ['要', '']) {
      const r = withProject({ trace: traceMd({ questions: [question('Q-01', value, '5 回'), question('Q-02', 'いいえ', '')] }) }, specOnly);
      expect(r.ok, value).toBe(false);
      expect(check(r, 'ブロッキングの値')).toEqual({ check: 'ブロッキングの値', status: 'fail', detail: `Q-01: "${value}"` });
    }
  });
});

describe('ブロッキング確認事項の検査：解析エラー', () => {
  it('[REQ-034] 確認事項の節名が崩れていると、未回答のブロッキング確認事項を見落とさず、trace.md の解析エラーで不合格', () => {
    const trace = traceMd({ questions: [question('Q-01', 'yes', '')] }).replace('## 確認事項', '## 確認事項（未回答）');
    const r = withProject({ trace }, specOnly);
    expect(r.ok).toBe(false);
    expect(check(r, 'trace.md の解析')).toEqual({ check: 'trace.md の解析', status: 'fail', detail: 'trace.md:1 「## 確認事項」の節がありません' });
  });

  it('[REQ-034] 差分仕様に解析エラーがあると、ファイル名と行番号を出して不合格', () => {
    const spec = `${specMd()}\n## RENAMED Requirements\n\n- FROM: \`### Requirement: 古い名前\`\n`;
    const r = withProject({ spec }, specOnly);
    expect(r.ok).toBe(false);
    expect(check(r, 'spec.md の解析')?.status).toBe('fail');
    expect(check(r, 'spec.md の解析')?.detail).toMatch(/^specs\/x\/spec\.md:\d+ RENAMED の FROM「古い名前」に対応する TO がありません$/);
  });

  it('[REQ-034] 解析エラーが無ければ、解析の検査は合格', () => {
    const r = withProject({}, specOnly);
    expect(check(r, 'trace.md の解析')?.status).toBe('pass');
    expect(check(r, 'spec.md の解析')?.status).toBe('pass');
  });
});

describe('同じ確認事項の回答の照合', () => {
  const NAME = '同じ確認事項の回答';
  // CHANGE（c1）の Q-01 は、change a の Q-01 と同じ質問とする
  const shared = (answer: string, mark = '（a の Q-01 と同じ質問）') =>
    traceMd({ questions: [`| Q-01 | REQ-012 | 何回ですか${mark} | 3 / 5 | 5 | yes | ${answer} |`] });
  const other = (answer: string) => traceMd({ questions: [question('Q-01', 'yes', answer)] });

  it('[REQ-034] 参照先の change と回答が同じなら合格', () => {
    const r = withProject({ trace: shared('5 回'), files: { 'openspec/changes/a/trace.md': other('5 回') } }, specOnly);
    expect(check(r, NAME)).toEqual({ check: NAME, status: 'pass', detail: '1 件が参照先と一致' });
    expect(r.ok).toBe(true);
  });

  it('[REQ-034] 参照先の change と回答が違えば、両方の回答を出して不合格', () => {
    const r = withProject({ trace: shared('5 回'), files: { 'openspec/changes/a/trace.md': other('3 回') } }, specOnly);
    expect(check(r, NAME)).toEqual({
      check: NAME,
      status: 'fail',
      detail: 'Q-01：回答が a の Q-01 と違います（c1：「5 回」、a：「3 回」）',
    });
    expect(r.ok).toBe(false);
  });

  it('[REQ-034] 片方だけ回答があれば不合格', () => {
    const r = withProject({ trace: shared(''), files: { 'openspec/changes/a/trace.md': other('5 回') } }, specOnly);
    expect(check(r, NAME)?.status).toBe('fail');
  });

  it('[REQ-034] 参照先が archive にあれば、archive の trace.md と比べる', () => {
    const r = withProject({ trace: shared('5 回'), files: { 'openspec/changes/archive/2026-10-01-a/trace.md': other('5 回') } }, specOnly);
    expect(check(r, NAME)?.status).toBe('pass');
  });

  it('[REQ-034] 参照先の change が進行中にも archive にもなければ、change-id を出して不合格', () => {
    const r = withProject({ trace: shared('5 回') }, specOnly);
    expect(check(r, NAME)).toEqual({ check: NAME, status: 'fail', detail: 'Q-01：参照先の change a が見つかりません' });
  });

  it('[REQ-034] 印が無ければ、同じ ID の確認事項の回答が違っても不合格にしない', () => {
    const r = withProject({ trace: shared('5 回', ''), files: { 'openspec/changes/a/trace.md': other('3 回') } }, specOnly);
    expect(check(r, NAME)).toEqual({ check: NAME, status: 'pass', detail: 'ほかの change と同じ確認事項なし' });
  });

  it('参照先の trace.md に同じ ID の確認事項が無ければ不合格（仮定 A-02）', () => {
    const r = withProject({ trace: shared('5 回'), files: { 'openspec/changes/a/trace.md': traceMd() } }, specOnly);
    expect(check(r, NAME)).toEqual({ check: NAME, status: 'fail', detail: 'Q-01：a の trace.md に Q-01 がありません' });
  });

  it('括弧の中にほかの語があっても印とみなし、前後の空白の違いは同じ回答とみなす（仮定 A-01）', () => {
    const trace = shared('5 回', '（要件書 Q-03。a の Q-01 と同じ質問）');
    const r = withProject({ trace, files: { 'openspec/changes/a/trace.md': other('  5 回 ') } }, specOnly);
    expect(check(r, NAME)?.status).toBe('pass');
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

  it('[REQ-038] tasks.md にタスクが 1 つも無いと、タスクが無いことを出して不合格', () => {
    const r = withReport({ tasks: '## 1. 実装\n' }, (root) => done(root, true));
    expect(check(r, 'tasks.md')).toMatchObject({ status: 'fail', detail: 'タスクがありません' });
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

  // macOS の一時ディレクトリ（/var → /private/var）のように、ルートがシンボリックリンクを通るとき。
  // テストランナーはレポートに実パスを書くので、ルートも実パスにそろえないと相対パスがずれる
  it('[REQ-038] ルートがシンボリックリンクを通っても、要件 ID のテストをルートからのパスで数える', () => {
    const r = withProject(
      { config: { openspecValidate: false, commands: { test: vitestCommand() } }, files: { 'tests/a.test.ts': "it('[REQ-012] 成功する', () => {});\n" } },
      (root) => {
        const link = join(mkdtempSync(join(tmpdir(), 'loomake-link-')), 'project');
        symlinkSync(root, link, 'dir');
        try {
          return done(link);
        } finally {
          rmSync(dirname(link), { recursive: true, force: true });
        }
      },
    );
    expect(check(r, '要件ごとのテスト')?.status).toBe('pass');
    expect(r.coverage).toEqual({ 'REQ-012': ['tests/a.test.ts'] });
  }, 30_000);

  it('[REQ-038] ルートがシンボリックリンクを通り、レポートにリンクのままのパスが書かれていても、ルートからのパスで数える', () => {
    const r = withProject({}, (root) => {
      const link = join(mkdtempSync(join(tmpdir(), 'loomake-link-')), 'project');
      symlinkSync(root, link, 'dir');
      try {
        mkdirSync(join(link, '.loomake'), { recursive: true });
        writeFileSync(join(link, '.loomake', 'test-report.json'), reportJson(link, { 'tests/a.test.ts': [['[REQ-012] 動く', 'passed']] }));
        return done(link, true);
      } finally {
        rmSync(dirname(link), { recursive: true, force: true });
      }
    });
    expect(check(r, '要件ごとのテスト')?.status).toBe('pass');
    expect(r.coverage).toEqual({ 'REQ-012': ['tests/a.test.ts'] });
  });

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

  it('[REQ-039] loomake.config.json に知らないキーがあれば、そのキーを警告にし、不合格にはしない', () => {
    const config = { openspecValidate: false, comands: { test: 'node -e "process.exit(1)"' }, tests: { report: '.loomake/test-report.json', reprot: 'x' }, run: { maxFix: 1 }, commands: {} };
    for (const r of withProject({ config }, (root) => [runVerify({ root }), specOnly(root)])) {
      expect(check(r, 'loomake.config.json')).toEqual({ check: 'loomake.config.json', status: 'warn', detail: '知らないキー：comands、tests.reprot、run.maxFix（打ち間違いなら直してください）' });
      expect(r.ok).toBe(true);
    }
  });

  it('[REQ-039] 継承したプロパティと同じ名前のキー（toString・__proto__）も、例外を出さずに知らないキーとして示す', () => {
    const files = { 'loomake.config.json': '{ "openspecValidate": false, "toString": { "x": 1 }, "__proto__": { "y": 1 }, "commands": {} }' };
    const r = withProject({ files }, (root) => runVerify({ root }));
    expect(check(r, 'loomake.config.json')?.detail).toBe('知らないキー：toString、__proto__（打ち間違いなら直してください）');
  });

  it('[REQ-039] 知らないキーがなければ、loomake.config.json の検査は出さない', () => {
    const r = withProject({ config: { $comment: 'x', openspecValidate: false, commands: { e2e: 'node -e ""' }, run: { maxFixes: 1, timeoutMinutes: 5, maxOutputBytes: 1, maxLogBytes: 1, maxHistoryBytes: 1 } } }, (root) => runVerify({ root }));
    expect(check(r, 'loomake.config.json')).toBeUndefined();
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

describe('中断されたときの品質コマンド', () => {
  // Windows では品質コマンドを別のプロセスグループにしないので、Ctrl-C がコマンドに届く。SIGINT をまねる手段もない（stop-gate-on-interrupt の仮定 A-02）
  it.runIf(process.platform !== 'win32')('[REQ-124] 時間の上限つきの品質コマンドの途中で中断されたら、子のプロセスまで止め、中断で止めたと記録し、残りのコマンドを実行しない', () => {
    const config = { openspecValidate: false, commands: { test: 'node interrupt.cjs', after: 'node -e "require(\'fs\').writeFileSync(\'after.txt\', \'\')"' } };
    withProject({ config, files: { 'interrupt.cjs': INTERRUPT_SCRIPT } }, (root) => {
      const start = Date.now();
      const r = runVerify({ root, timeoutMs: 60_000 });
      expect(Date.now() - start).toBeLessThan(10_000);
      expect(check(r, 'command: test')).toEqual({ check: 'command: test', status: 'fail', detail: INTERRUPTED });
      expect(check(r, 'command: after')).toBeUndefined();
      const pids: number[] = JSON.parse(readFileSync(join(root, 'pids.json'), 'utf8'));
      expect(pids.filter(alive)).toEqual([]);
      expect(existsSync(join(root, 'after.txt'))).toBe(false);
    });
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

describe('要件モデルの整合性', () => {
  it('[REQ-150] 範囲外の要件でも不正なIDを台帳に通さない', () => {
    const result = withProject({ trace: traceMd({ ledger: [ledgerRow('REQ-012'), ledgerRow('REQ-12', '範囲外')] }) }, specOnly);
    expect(result.ok).toBe(false);
    expect(check(result, '要件モデルの整合性')?.status).toBe('fail');
    expect(check(result, '要件モデルの整合性')?.detail).toContain('REQ-12');
  });
});

describe('品質コマンドを省いたことの表示', () => {
  const withReport = <T>(fn: (root: string) => T) =>
    withProject({ config: { commands: { test: 'node -e "process.exit(1)"' } } }, (root) => {
      mkdirSync(join(root, '.loomake'), { recursive: true });
      writeFileSync(join(root, '.loomake', 'test-report.json'), reportJson(root, { 'tests/a.test.ts': [['[REQ-012] 動く', 'passed']] }));
      return fn(root);
    });

  it('[REQ-191] --skip-commands の完了ゲートは、品質コマンドの skip の項目と最後の行で省いたことを示す', () => {
    const r = withReport((root) => done(root, true));
    expect(check(r, '品質コマンド')).toMatchObject({ status: 'skip' });
    expect(check(r, '品質コマンド')?.detail).toContain('前回のテストのレポート');
    expect(check(r, '品質コマンド')?.detail).toContain('--skip-commands を付けずに');
    expect(r.ok).toBe(true);
    expect(formatVerifyResult(r).split('\n').at(-1)).toContain('品質コマンドを実行していません');
  });

  it('[REQ-191] 品質コマンドを実行するときは、skip の項目を加えない', () => {
    const r = withReport((root) => done(root));
    expect(check(r, '品質コマンド')).toBeUndefined();
    expect(formatVerifyResult(r).split('\n').at(-1)).not.toContain('品質コマンドを実行していません');
  });
});
