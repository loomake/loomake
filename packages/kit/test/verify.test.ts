import { describe, it, expect, vi } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { formatVerifyResult, INTERRUPTED, NOTICE, OPENSPEC_NA_CONFIRMER, isAbortedResult, runVerify, verifyExitCode } from '@loomake/kit';
import { CHANGE, COPY_REPORT, INTERRUPT_SCRIPT, interruptScript, alive, ledgerRow, reportJson, requirement, specMd, traceMd, vitestCommand, withProject } from './project.js';

// git やコマンドのプロセスを何度も起動するので、マシンの負荷が高いと既定の 5 秒を超えることがある
vi.setConfig({ testTimeout: 60_000 });

const specOnly = (root: string) => runVerify({ root, changeId: CHANGE, gate: 'spec-only' });
const done = (root: string, skipCommands = false) => runVerify({ root, changeId: CHANGE, gate: 'done', skipCommands });
type Result = ReturnType<typeof runVerify>;
// 2.0.0 の checks を、検査ごとの観測（名前・状態・説明）として読む。案内つきの合格は warn、不足は insufficient、対象外は na（仮定 A-01・A-02）
const view = (result: Result) => (isAbortedResult(result) ? [] : result.checks).map((c) => {
  const notice = c.result === 'PASS' && c.reason.startsWith(NOTICE);
  const status = notice ? 'warn' : ({ PASS: 'pass', FAIL: 'fail', INSUFFICIENT_EVIDENCE: 'insufficient', NOT_APPLICABLE: 'na' } as const)[c.result];
  return { check: c.id, status, detail: notice ? c.reason.slice(NOTICE.length) : c.reason };
});
const check = (result: Result, name: string) => view(result).find((r) => r.check === name);
// 終了コード 0。仕様ゲートと change なしは local の完了、完了ゲートは ci の PASS（REQ-311）
const ok = (result: Result) => verifyExitCode(result) === 0;

const question = (id: string, blocking: string, answer: string) => `| ${id} | REQ-012 | 何回ですか | 3 / 5 | 5 | ${blocking} | ${answer} |`;

describe('ブロッキング確認事項の検査', () => {
  it('[REQ-034] 未回答のブロッキング確認事項があると、ID・関連・質問を出して不合格', () => {
    const r = withProject({ trace: traceMd({ questions: [question('Q-01', 'yes', '')] }) }, specOnly);
    expect(ok(r)).toBe(false);
    expect(check(r, 'ブロッキング確認事項')).toEqual({ check: 'ブロッキング確認事項', status: 'fail', detail: 'Q-01（REQ-012）何回ですか' });
  });

  it('[REQ-034] ブロッキングの確認事項がすべて回答済みなら合格', () => {
    const r = withProject({ trace: traceMd({ questions: [question('Q-01', 'YES', '5 回')] }) }, specOnly);
    expect(check(r, 'ブロッキング確認事項')?.status).toBe('pass');
    expect(ok(r)).toBe(true);
  });

  it('[REQ-034] ブロッキングでない確認事項は、回答が空でも合格', () => {
    const r = withProject({ trace: traceMd({ questions: [question('Q-01', 'no', '')] }) }, specOnly);
    expect(check(r, 'ブロッキング確認事項')?.status).toBe('pass');
  });

  it('[REQ-034] ブロッキング列が はい で回答が空なら、ブロッキングとみなして不合格', () => {
    const r = withProject({ trace: traceMd({ questions: [question('Q-01', 'はい', '')] }) }, specOnly);
    expect(ok(r)).toBe(false);
    expect(check(r, 'ブロッキング確認事項')).toEqual({ check: 'ブロッキング確認事項', status: 'fail', detail: 'Q-01（REQ-012）何回ですか' });
  });

  it('[REQ-034] ブロッキング列が yes・no・はい・いいえ のどれでもなければ、ID と値を出して不合格', () => {
    for (const value of ['要', '']) {
      const r = withProject({ trace: traceMd({ questions: [question('Q-01', value, '5 回'), question('Q-02', 'いいえ', '')] }) }, specOnly);
      expect(ok(r), value).toBe(false);
      expect(check(r, 'ブロッキングの値')).toEqual({ check: 'ブロッキングの値', status: 'fail', detail: `Q-01: "${value}"` });
    }
  });
});

describe('ブロッキング確認事項の検査：解析エラー', () => {
  it('[REQ-034] 確認事項の節名が崩れていると、未回答のブロッキング確認事項を見落とさず、trace.md の解析エラーで不合格', () => {
    const trace = traceMd({ questions: [question('Q-01', 'yes', '')] }).replace('## 確認事項', '## 確認事項（未回答）');
    const r = withProject({ trace }, specOnly);
    expect(ok(r)).toBe(false);
    expect(check(r, 'trace.md の解析')).toEqual({ check: 'trace.md の解析', status: 'fail', detail: 'trace.md:1 「## 確認事項」の節がありません' });
  });

  it('[REQ-034] 差分仕様に解析エラーがあると、ファイル名と行番号を出して不合格', () => {
    const spec = `${specMd()}\n## RENAMED Requirements\n\n- FROM: \`### Requirement: 古い名前\`\n`;
    const r = withProject({ spec }, specOnly);
    expect(ok(r)).toBe(false);
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
    expect(ok(r)).toBe(true);
  });

  it('[REQ-034] 参照先の change と回答が違えば、両方の回答を出して不合格', () => {
    const r = withProject({ trace: shared('5 回'), files: { 'openspec/changes/a/trace.md': other('3 回') } }, specOnly);
    expect(check(r, NAME)).toEqual({
      check: NAME,
      status: 'fail',
      detail: 'Q-01：回答が a の Q-01 と違います（c1：「5 回」、a：「3 回」）',
    });
    expect(ok(r)).toBe(false);
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
    expect(ok(r)).toBe(false);
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
    expect(ok(r)).toBe(true);
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

  it('[REQ-037] OpenSpec CLI が見つからず openspecValidate が auto なら、local は理由と確認者つきの対象外にして不合格にしない', () => {
    const empty = mkdtempSync(join(tmpdir(), 'loomake-empty-path-'));
    const saved = process.env.PATH;
    process.env.PATH = empty;
    try {
      const r = withProject({ config: { openspecValidate: 'auto', commands: {} } }, specOnly);
      expect(check(r, 'openspec validate')).toMatchObject({ status: 'na' });
      expect(check(r, 'openspec validate')?.detail).toContain('OpenSpec CLI が見つかりません');
      expect(check(r, 'openspec validate')?.detail).toContain(`確認者：${OPENSPEC_NA_CONFIRMER}`);
      expect(ok(r)).toBe(true);
    } finally {
      process.env.PATH = saved;
      rmSync(empty, { recursive: true, force: true });
    }
  });
});

describe('完了ゲート', () => {
  const passedReport = (root: string) => reportJson(root, { 'tests/a.test.ts': [['[REQ-012] 動く', 'passed']] });
  // 今回の test コマンドがレポートを書き出す（REQ-040。前回のレポートは今回の証拠にしない）
  const withReport = (files: Parameters<typeof withProject>[0], fn: (root: string) => ReturnType<typeof runVerify>) =>
    withProject({ config: { openspecValidate: false, commands: { test: COPY_REPORT } }, ...files }, (root) => {
      writeFileSync(join(root, 'report-src.json'), passedReport(root));
      return fn(root);
    });

  it('[REQ-038] 未完了のタスクがあると、その行を出して不合格', () => {
    const r = withReport({ tasks: '## 1. 実装\n- [x] 1.1 済み\n- [ ] 1.2 残り\n' }, (root) => done(root));
    expect(check(r, 'tasks.md')).toMatchObject({ status: 'fail', detail: '- [ ] 1.2 残り' });
    expect(ok(r)).toBe(false);
  });

  it('[REQ-038] tasks.md にタスクが 1 つも無いと、タスクが無いことを出して不合格', () => {
    const r = withReport({ tasks: '## 1. 実装\n' }, (root) => done(root));
    expect(check(r, 'tasks.md')).toMatchObject({ status: 'fail', detail: 'タスクがありません' });
    expect(ok(r)).toBe(false);
  });

  it('[REQ-038] 確認待ちの要件が残ると、その ID を出して不合格', () => {
    const trace = traceMd({ ledger: [ledgerRow('REQ-012'), ledgerRow('REQ-002', '確認待ち')] });
    const r = withReport({ trace }, (root) => done(root));
    expect(check(r, '確認待ちが残っていない')).toMatchObject({ status: 'insufficient', detail: 'REQ-002' });
  });

  it('[REQ-038] 仕様で参照される要件を名前に含むテストが無いと不合格', () => {
    const r = withProject({ config: { openspecValidate: false, commands: { test: COPY_REPORT } } }, (root) => {
      writeFileSync(join(root, 'report-src.json'), reportJson(root, { 'tests/a.test.ts': [['[REQ-001] 別の要件', 'passed']] }));
      return done(root);
    });
    expect(check(r, '要件ごとのテスト')).toMatchObject({ status: 'fail', detail: 'テストが無い要件：REQ-012' });
  });

  it('[REQ-038] 要件のテストがあれば合格し、全体も合格', () => {
    const r = withReport({}, (root) => done(root));
    expect(check(r, '要件ごとのテスト')?.status).toBe('pass');
    expect(ok(r)).toBe(true);
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
    const r = withProject({ config: { openspecValidate: false, commands: { test: COPY_REPORT } } }, (root) => {
      const link = join(mkdtempSync(join(tmpdir(), 'loomake-link-')), 'project');
      symlinkSync(root, link, 'dir');
      try {
        writeFileSync(join(link, 'report-src.json'), reportJson(link, { 'tests/a.test.ts': [['[REQ-012] 動く', 'passed']] }));
        return done(link);
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
    expect(ok(r)).toBe(false);
  });

  it('[REQ-039] loomake.config.json に知らないキーがあれば、そのキーを警告にし、不合格にはしない', () => {
    const config = { openspecValidate: false, comands: { test: 'node -e "process.exit(1)"' }, tests: { report: '.loomake/test-report.json', reprot: 'x' }, run: { maxFix: 1 }, commands: {} };
    for (const r of withProject({ config }, (root) => [runVerify({ root }), specOnly(root)])) {
      expect(check(r, 'loomake.config.json')).toEqual({ check: 'loomake.config.json', status: 'warn', detail: '知らないキー：comands、tests.reprot、run.maxFix（打ち間違いなら直してください）' });
      expect(ok(r)).toBe(true);
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
    expect(view(r).filter((x) => x.check.startsWith('command:'))).toEqual([
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
      expect(check(r, 'command: test')).toEqual({ check: 'command: test', status: 'insufficient', detail: INTERRUPTED });
      expect(r.run).toMatchObject({ status: 'partial', errors: [{ kind: 'runtime', target: 'command: test', message: INTERRUPTED }] });
      expect(check(r, 'command: after')).toBeUndefined();
      const pids: number[] = JSON.parse(readFileSync(join(root, 'pids.json'), 'utf8'));
      expect(pids.filter(alive)).toEqual([]);
      expect(existsSync(join(root, 'after.txt'))).toBe(false);
    });
  });
  it.runIf(process.platform !== 'win32')('[REQ-333] 品質コマンドの監視役へのSIGHUPを理由のない中断で記録し、後続を実行しない', () => {
    const config = { openspecValidate: false, commands: { test: 'node interrupt.cjs', after: 'node -e "require(\'fs\').writeFileSync(\'after.txt\', \'\')"' } };
    withProject({ config, files: { 'interrupt.cjs': interruptScript('SIGHUP') } }, (root) => {
      const start = Date.now();
      const result = runVerify({ root, timeoutMs: 60_000 });
      expect(Date.now() - start).toBeLessThan(10_000);
      expect(check(result, 'command: test')).toEqual({ check: 'command: test', status: 'insufficient', detail: INTERRUPTED });
      expect(result.run).toMatchObject({ status: 'partial', errors: [{ kind: 'runtime', target: 'command: test', message: INTERRUPTED }] });
      expect(check(result, 'command: after')).toBeUndefined();
      const pids: number[] = JSON.parse(readFileSync(join(root, 'pids.json'), 'utf8'));
      expect(pids.filter(alive)).toEqual([]);
      expect(existsSync(join(root, 'after.txt'))).toBe(false);
    });
  });
});

describe('change の省略', () => {
  it('[REQ-042] change を省略すると commands だけを実行し、仕様の検査はしない', () => {
    const r = withProject({ config: { commands: { lint: 'node -e ""' } } }, (root) => runVerify({ root }));
    expect(r).toMatchObject({ schemaVersion: '2.0.0', scope: 'local', change: null, run: { status: 'completed', errors: [] } });
    expect(r).not.toHaveProperty('verdict');
    expect(view(r).map((x) => x.check)).toEqual(['command: lint']);
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
    expect(ok(result)).toBe(false);
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

  it('[REQ-191][REQ-040] --skip-commands の完了ゲートは、品質コマンドの不足の項目と最後の行で省いたことを示し、前回のレポートを使わない', () => {
    const r = withReport((root) => done(root, true));
    expect(check(r, '品質コマンド')).toMatchObject({ status: 'insufficient' });
    expect(check(r, '品質コマンド')?.detail).toContain('--skip-commands を付けずに');
    expect(check(r, '要件ごとのテスト')).toMatchObject({ status: 'insufficient' });
    expect(r).not.toHaveProperty('coverage');
    expect(ok(r)).toBe(false);
    expect(verifyExitCode(r)).toBe(1);
    expect(formatVerifyResult(r).split('\n').at(-1)).toContain('品質コマンドを実行していません');
  });

  it('[REQ-191] 品質コマンドを実行するときは、skip の項目を加えない', () => {
    const r = withReport((root) => done(root));
    expect(check(r, '品質コマンド')).toBeUndefined();
    expect(formatVerifyResult(r).split('\n').at(-1)).not.toContain('品質コマンドを実行していません');
  });
});

// C001 3/6（verify-v2-gates）：warn・skip・未承認・確認待ちの分類（R-C001-08 B・R-C001-10 A）
describe('ゲート別の分類', () => {
  const pendingTrace = traceMd({
    ledger: [ledgerRow('REQ-012'), ledgerRow('REQ-002', '確認待ち')],
    assumptions: ['| A-01 | REQ-012 | 8 文字以上 | 記載なし | |'],
  });
  const passedReport = (root: string) => reportJson(root, { 'tests/a.test.ts': [['[REQ-012] 動く', 'passed']] });
  const doneWith = (files: Parameters<typeof withProject>[0], scope: 'local' | 'ci') =>
    withProject({ config: { openspecValidate: false, commands: { test: COPY_REPORT } }, ...files }, (root) => {
      writeFileSync(join(root, 'report-src.json'), passedReport(root));
      return runVerify({ root, changeId: CHANGE, gate: 'done', scope });
    });
  const withoutOpenspec = <T>(fn: () => T): T => {
    const empty = mkdtempSync(join(tmpdir(), 'loomake-empty-path-'));
    const saved = process.env.PATH;
    process.env.PATH = empty;
    try { return fn(); } finally { process.env.PATH = saved; rmSync(empty, { recursive: true, force: true }); }
  };
  const decisionOf = (r: Result) => (isAbortedResult(r) ? undefined : r.decision);

  it('[REQ-036] spec-only の未承認の仮定と確認待ちは、案内つきの合格で、pending も要判断も立てず 0', () => {
    for (const scope of ['local', 'ci'] as const) {
      const r = withProject({ trace: pendingTrace }, (root) => runVerify({ root, changeId: CHANGE, gate: 'spec-only', scope }));
      expect(check(r, '仮定の承認')?.status).toBe('warn');
      expect(check(r, '確認待ちの要件')?.status).toBe('warn');
      expect(decisionOf(r)).toEqual({ required: false, reasons: [] });
      if (!isAbortedResult(r) && r.scope === 'local') expect(r.summary.pending).toBe(0);
      expect(verifyExitCode(r)).toBe(0);
    }
  });

  it('[REQ-036][REQ-038] done の未承認の仮定と確認待ちは、不足と要判断理由になり、local も ci も 1', () => {
    for (const scope of ['local', 'ci'] as const) {
      const r = doneWith({ trace: pendingTrace }, scope);
      expect(check(r, '仮定の承認')).toMatchObject({ status: 'insufficient', detail: '未承認：A-01 8 文字以上' });
      expect(check(r, '確認待ちが残っていない')).toMatchObject({ status: 'insufficient', detail: 'REQ-002' });
      expect(check(r, '確認待ちの要件')).toBeUndefined();
      expect(decisionOf(r)).toEqual({
        required: true,
        reasons: [
          { code: 'APPROVAL_REQUIRED', target: 'A-01', message: '仮定 A-01 が未承認です' },
          { code: 'APPROVAL_REQUIRED', target: 'REQ-002', message: '要件 REQ-002 が確認待ちです' },
        ],
      });
      expect(verifyExitCode(r)).toBe(1);
      expect(formatVerifyResult(r)).toContain('人の判断が必要です');
    }
  });

  it('[REQ-038] 確認待ちと未承認がなければ done の要判断は立たない', () => {
    const r = doneWith({}, 'ci');
    expect(decisionOf(r)).toEqual({ required: false, reasons: [] });
    expect(verifyExitCode(r)).toBe(0);
  });

  it('[REQ-037] auto で OpenSpec CLI が無いと、local は理由と確認者つきの対象外、ci は不足になる', () => {
    withoutOpenspec(() => {
      const config = { openspecValidate: 'auto', commands: {} };
      const local = withProject({ config }, (root) => runVerify({ root, changeId: CHANGE, gate: 'spec-only', scope: 'local' }));
      if (isAbortedResult(local)) throw new Error('aborted');
      expect(local.checks.find((c) => c.id === 'openspec validate')).toMatchObject({ result: 'NOT_APPLICABLE' });
      expect(check(local, 'openspec validate')?.detail).toContain(OPENSPEC_NA_CONFIRMER);
      expect(local.summary.not_applicable).toBe(1);
      expect(verifyExitCode(local)).toBe(0);
      const ci = withProject({ config }, (root) => runVerify({ root, changeId: CHANGE, gate: 'spec-only', scope: 'ci' }));
      expect(check(ci, 'openspec validate')).toMatchObject({ status: 'insufficient' });
      expect(check(ci, 'openspec validate')?.detail).toContain('OpenSpec CLI が見つかりません');
      expect(verifyExitCode(ci)).toBe(1);
    });
  });

  it('[REQ-037] 明示 true で OpenSpec CLI が無いと、local でも不合格のまま', () => {
    withoutOpenspec(() => {
      const r = withProject({ config: { openspecValidate: true, commands: {} } }, (root) => runVerify({ root, changeId: CHANGE, gate: 'spec-only', scope: 'local' }));
      expect(check(r, 'openspec validate')?.status).toBe('fail');
      expect(verifyExitCode(r)).toBe(1);
    });
  });

  it('[REQ-039] 未知キーは spec-only・done・change なしの local/ci で、理由つきの合格の案内になり、それだけでは 0', () => {
    const config = { openspecValidate: false, comands: {}, commands: { test: COPY_REPORT } };
    for (const scope of ['local', 'ci'] as const) {
      const results = withProject({ config }, (root) => {
        writeFileSync(join(root, 'report-src.json'), passedReport(root));
        return [
          runVerify({ root, scope }),
          runVerify({ root, changeId: CHANGE, gate: 'spec-only', scope }),
          runVerify({ root, changeId: CHANGE, gate: 'done', scope }),
        ];
      });
      for (const r of results) {
        expect(check(r, 'loomake.config.json')?.status).toBe('warn');
        expect(check(r, 'loomake.config.json')?.detail).toContain('comands');
        expect(isAbortedResult(r) ? undefined : r.checks.find((c) => c.id === 'loomake.config.json')?.result).toBe('PASS');
      }
      expect(verifyExitCode(results[1])).toBe(0);
    }
  });

  it('[REQ-191] --skip-commands の完了ゲートは local も ci も不足で 1 になり、spec-only は品質項目を数えない', () => {
    for (const scope of ['local', 'ci'] as const) {
      const r = withProject({ config: { openspecValidate: false, commands: { test: 'node -e ""' } } }, (root) =>
        runVerify({ root, changeId: CHANGE, gate: 'done', skipCommands: true, scope }));
      expect(check(r, '品質コマンド')?.status).toBe('insufficient');
      expect(verifyExitCode(r)).toBe(1);
    }
  });

  it('[REQ-036] spec-only は local でも ci でも品質項目（quality:）を checks に作らない', () => {
    for (const scope of ['local', 'ci'] as const) {
      const r = withProject({}, (root) => runVerify({ root, changeId: CHANGE, gate: 'spec-only', scope }));
      expect(isAbortedResult(r) ? [] : r.checks.filter((c) => c.id.startsWith('quality:'))).toEqual([]);
    }
  });

  it('[REQ-203] 仮定を承認すると、spec-only の案内と done の不足・要判断理由から未承認が消える', () => {
    const approved = traceMd({
      ledger: [ledgerRow('REQ-012')],
      assumptions: ['| A-01 | REQ-012 | 8 文字以上 | 記載なし | 承認 |'],
    });
    const spec = withProject({ trace: approved }, specOnly);
    expect(check(spec, '仮定の承認')).toBeUndefined();
    const r = doneWith({ trace: approved }, 'ci');
    expect(check(r, '仮定の承認')).toBeUndefined();
    expect(decisionOf(r)).toEqual({ required: false, reasons: [] });
    expect(verifyExitCode(r)).toBe(0);
  });
});
