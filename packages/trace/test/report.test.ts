import { describe, it, expect, vi } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { SCOPE_NOTE, buildReport, runReport, type Evidence, type Report } from '@loomake/trace';
import { main } from '../../cli/src/main.js';
import { readDocuments } from '../src/documents.js';
import { CHANGE, ledgerRow, requirement, specMd, traceMd } from '../../kit/test/project.js';

// git やコマンドのプロセスを何度も起動するので、マシンの負荷が高いと既定の 5 秒を超えることがある
vi.setConfig({ testTimeout: 60_000 });

type Project = { trace?: string; spec?: string; evidence?: Partial<Evidence>[]; archived?: boolean };

const evidence = (e: Partial<Evidence> = {}): Evidence => ({
  schemaVersion: 1,
  change: CHANGE,
  sha: '0123456789abcdef0123456789abcdef01234567',
  committedAt: '2026-10-23T09:00:00+09:00',
  recordedAt: '2026-10-23T01:00:00.000Z',
  verify: { schemaVersion: '1.0.0', mode: 'done', change: CHANGE, ok: true, results: [], coverage: { 'REQ-012': ['tests/x.test.ts'] } },
  ...e,
});

/** 一時ディレクトリに change と証拠の記録を置いて fn を実行し、終わったら消す。fn が Promise を返したら、終わるのを待つ */
function withProject<T>({ trace = traceMd(), spec = specMd(), evidence: records = [{}], archived = false }: Project, fn: (root: string) => T): T {
  const root = mkdtempSync(join(tmpdir(), 'loomake-report-'));
  const cleanup = () => rmSync(root, { recursive: true, force: true });
  let result: T;
  try {
    const write = (p: string, text: string) => {
      mkdirSync(dirname(join(root, p)), { recursive: true });
      writeFileSync(join(root, p), text);
    };
    const dir = archived ? `openspec/changes/archive/2026-10-23-${CHANGE}` : `openspec/changes/${CHANGE}`;
    write('loomake.config.json', '{}');
    write(`${dir}/trace.md`, trace);
    write(`${dir}/specs/x/spec.md`, spec);
    // 記録には、書いた trace.md と差分仕様を保存しておく。r に documents: undefined を渡すと、文書のない古い形式になる
    const documents = readDocuments(join(root, dir));
    records.forEach((r, i) => write(`.loomake/evidence/${CHANGE}/${i}.json`, JSON.stringify(evidence({ documents, ...r }))));
    result = fn(root);
  } catch (e) {
    cleanup();
    throw e;
  }
  // fn が Promise を返したら、終わるのを待ってから消す
  if (result instanceof Promise) return result.finally(cleanup) as T;
  cleanup();
  return result;
}

const report = (root: string) => buildReport(root, CHANGE) as Report;
const markdown = (root: string, format: 'md' | 'json' = 'md') => {
  const out: string[] = [];
  const code = runReport({ root, changeId: CHANGE, format, stdout: (t) => out.push(t) });
  return { code, text: out.join('\n') };
};
const cli = async (root: string, ...args: string[]) => {
  const out: string[] = [];
  const err: string[] = [];
  const code = await main(['trace', 'report', '--change', CHANGE, ...args], { cwd: root, stdout: (t) => out.push(t), stderr: (t) => err.push(t) });
  return { code, stdout: out.join('\n'), stderr: err.join('\n') };
};

// 回答者・回答日・承認者・承認日の列を持つ trace.md
const agreementTrace = (question: string, assumption: string) =>
  traceMd({ assumptions: [assumption] })
    .replace('| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 |\n|---|---|---|---|---|---|---|', `| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 | 回答者 | 回答日 |\n|---|---|---|---|---|---|---|---|---|\n${question}`)
    .replace('| ID | 関連 | 仮定の内容 | 理由 | 承認 |\n|---|---|---|---|---|', '| ID | 関連 | 仮定の内容 | 理由 | 承認 | 承認者 | 承認日 |\n|---|---|---|---|---|---|---|');

// 証拠の i 番目のファイルの先頭に、項目を足して書き直す（JSON の項目の順を変える）
const prependField = (root: string, i: number, field: Record<string, unknown>) => {
  const file = join(root, `.loomake/evidence/${CHANGE}/${i}.json`);
  writeFileSync(file, JSON.stringify({ ...field, ...JSON.parse(readFileSync(file, 'utf8')) }, null, 2));
};

// 実際の証拠のファイル名は、記録した日時と SHA から作る。最新はファイル名の日時で決める（REQ-209）
const renameEvidence = (root: string, names: string[]) =>
  names.forEach((name, i) => renameSync(join(root, `.loomake/evidence/${CHANGE}/${i}.json`), join(root, `.loomake/evidence/${CHANGE}/${name}`)));

describe('要件ごとの結果の表', () => {
  it('[REQ-070] 要件ごとに、出典・状態・対応する Requirement・テストファイル・最後の検査結果を並べる', () => {
    withProject({ spec: specMd(requirement('表の出力')) }, (root) => {
      expect(report(root).rows).toEqual([
        { id: 'REQ-012', source: '要件書 §1', state: '反映済', summary: '要約', requirements: ['表の出力'], tests: ['tests/x.test.ts'], result: '合格' },
      ]);
      expect(markdown(root).text).toContain('| REQ-012 | 要件書 §1 | 反映済 | 要約 | 表の出力 | tests/x.test.ts | 合格 |');
    });
  });

  it('[REQ-070][REQ-213] change-id にパスの区切りを含めると、日本語で表示して終了コード 2 を返す', () =>
    withProject({}, async (root) => {
      const err: string[] = [];
      const code = await main(['trace', 'report', '--change', '../c1'], { cwd: root, stdout: () => {}, stderr: (t) => err.push(t) });
      expect(code).toBe(2);
      expect(err.join('\n')).toContain('パスの区切り');
    }));

  it('[REQ-070][REQ-213] change-id が change 名の形でないか archive なら、日本語で表示して終了コード 2 を返す', () =>
    withProject({}, async (root) => {
      for (const id of ['C1', 'archive']) {
        const err: string[] = [];
        const code = await main(['trace', 'report', '--change', id], { cwd: root, stdout: () => {}, stderr: (t) => err.push(t) });
        expect(code, id).toBe(2);
        expect(err.join('\n'), id).toMatch(/英小文字・数字|archive は change-id に使えません/);
      }
    }));

  it('[REQ-070][REQ-209] 記録した日時がいちばん新しい記録を使う', () => {
    const records = [
      { recordedAt: '2026-10-23T02:00:00.000Z', sha: 'b'.repeat(40) },
      { recordedAt: '2026-10-23T01:00:00.000Z', sha: 'a'.repeat(40) },
    ];
    withProject({ evidence: records }, (root) => {
      renameEvidence(root, ['20261023T020000Z-bbbbbbbbbbbb.json', '20261023T010000Z-aaaaaaaaaaaa.json']);
      expect(report(root).evidence.sha).toBe('b'.repeat(40));
    });
  });

  it('[REQ-209] 同じ秒に記録した証拠が複数あれば、記録した日時（ミリ秒）がいちばん新しいものを使う', () => {
    const newer = evidence({ recordedAt: '2026-10-23T02:00:00.900Z', sha: 'a'.repeat(40) });
    newer.verify = { ...newer.verify, ok: false };
    const older = evidence({ recordedAt: '2026-10-23T02:00:00.100Z', sha: 'b'.repeat(40) });
    withProject({ evidence: [newer, older] }, (root) => {
      // SHA の辞書順では古いほうが後ろに来る名前にする
      renameEvidence(root, ['20261023T020000Z-aaaaaaaaaaaa.json', '20261023T020000Z-bbbbbbbbbbbb.json']);
      expect(report(root).evidence).toMatchObject({ sha: 'a'.repeat(40), ok: false });
    });
  });

  it('[REQ-209] 同じ秒の新しい証拠で、記録した日時が先頭の 4KiB より後ろにあっても、その証拠を使う', () => {
    const newer = evidence({ recordedAt: '2026-10-23T02:00:00.900Z', sha: 'a'.repeat(40) });
    newer.verify = { ...newer.verify, ok: false };
    const older = evidence({ recordedAt: '2026-10-23T02:00:00.100Z', sha: 'b'.repeat(40) });
    withProject({ evidence: [newer, older] }, (root) => {
      prependField(root, 0, { padding: 'x'.repeat(5000) });
      renameEvidence(root, ['20261023T020000Z-aaaaaaaaaaaa.json', '20261023T020000Z-bbbbbbbbbbbb.json']);
      expect(report(root).evidence).toMatchObject({ sha: 'a'.repeat(40), ok: false });
    });
  });

  it('[REQ-209] 入れ子の項目の recordedAt を、証拠の記録した日時と取り違えない', () => {
    // 古い証拠の先頭に、新しい日時を持つ入れ子の項目を置く
    const older = evidence({ recordedAt: '2026-10-23T02:00:00.100Z', sha: 'b'.repeat(40) });
    const newer = evidence({ recordedAt: '2026-10-23T02:00:00.900Z', sha: 'a'.repeat(40) });
    newer.verify = { ...newer.verify, ok: false };
    withProject({ evidence: [newer, older] }, (root) => {
      prependField(root, 1, { meta: { recordedAt: '2099-01-01T00:00:00.000Z' } });
      renameEvidence(root, ['20261023T020000Z-aaaaaaaaaaaa.json', '20261023T020000Z-bbbbbbbbbbbb.json']);
      expect(report(root).evidence).toMatchObject({ sha: 'a'.repeat(40), ok: false });
    });
  });

  it('[REQ-070] 新しい記録からテストファイルと結果を取り、古い記録の値を混ぜない', () => {
    const old = evidence({ recordedAt: '2026-10-23T01:00:00.000Z', sha: 'a'.repeat(40) });
    old.verify = { ...old.verify, ok: false, coverage: { 'REQ-012': [] } };
    const latest = evidence({ recordedAt: '2026-10-23T02:00:00.000Z', sha: 'b'.repeat(40) });
    latest.verify = { ...latest.verify, ok: true, coverage: { 'REQ-012': ['tests/latest.test.ts'] } };
    withProject({ evidence: [old, latest] }, (root) => {
      const result = report(root);
      expect(result.evidence).toMatchObject({ sha: 'b'.repeat(40), ok: true });
      expect(result.rows[0]).toMatchObject({ tests: ['tests/latest.test.ts'], result: '合格' });
      expect(result.attention.noPassingTests).toEqual([]);
    });
  });

  it('[REQ-070][REQ-213] archive した change でも、archive の trace.md と差分仕様からレポートを作る', () => {
    withProject({ archived: true, spec: specMd(requirement('表の出力')) }, (root) => {
      expect(report(root).rows[0].requirements).toEqual(['表の出力']);
    });
  });

  it('[REQ-070] 証拠の記録がなければ、trace record を先に実行するよう案内し、終了コード 1 を返す', () => {
    withProject({ evidence: [] }, (root) => {
      const r = markdown(root);
      expect(r.code).toBe(1);
      expect(r.text).toContain(`loomake trace record --change ${CHANGE}`);
    });
  });
});

describe('範囲外と既存仕様で充足の要件', () => {
  it('[REQ-071] 範囲外と既存仕様で充足の要件も、状態を付けて表に含める', () => {
    const trace = traceMd({ ledger: [ledgerRow('REQ-012'), ledgerRow('REQ-075', '範囲外'), ledgerRow('REQ-090', '既存仕様で充足')] });
    withProject({ trace }, (root) => {
      const rows = report(root).rows;
      expect(rows.map((r) => [r.id, r.state, r.result])).toEqual([
        ['REQ-012', '反映済', '合格'],
        ['REQ-075', '範囲外', null],
        ['REQ-090', '既存仕様で充足', null],
      ]);
      expect(markdown(root).text).toMatch(/^\| REQ-075 \| 要件書 §1 \| 範囲外 \|/m);
    });
  });
});

describe('冒頭の要注意の一覧', () => {
  it('[REQ-072] 反映済で合格したテストのない要件を、冒頭の一覧に挙げる', () => {
    const trace = traceMd({ ledger: [ledgerRow('REQ-012'), ledgerRow('REQ-070')] });
    withProject({ trace, spec: specMd(requirement('a'), requirement('b', { source: 'Source: REQ-070' })) }, (root) => {
      expect(report(root).attention.noPassingTests).toEqual(['REQ-070']);
      const text = markdown(root).text;
      expect(text.indexOf('合格したテストのない要件：REQ-070')).toBeLessThan(text.indexOf('## 要件ごとの結果'));
    });
  });

  it('[REQ-072] 確認待ちの要件を、冒頭の一覧に挙げる', () => {
    withProject({ trace: traceMd({ ledger: [ledgerRow('REQ-012'), ledgerRow('REQ-072', '確認待ち')] }) }, (root) => {
      expect(report(root).attention.pending).toEqual(['REQ-072']);
      expect(markdown(root).text).toContain('確認待ちの要件：REQ-072');
    });
  });

  it('[REQ-072] 証拠の検査が不合格なら、冒頭に不合格の検査を挙げ、要注意の要件がないとは書かない', () => {
    const verify = {
      schemaVersion: '1.0.0' as const,
      mode: 'done' as const,
      change: CHANGE,
      ok: false,
      results: [
        { check: 'command: lint', status: 'fail' as const, detail: 'エラー' },
        { check: 'tasks.md', status: 'pass' as const, detail: '' },
      ],
      coverage: { 'REQ-012': ['tests/x.test.ts'] },
    };
    withProject({ evidence: [{ verify }] }, (root) => {
      expect(report(root).attention.failedChecks).toEqual(['command: lint']);
      const text = markdown(root).text;
      expect(text).toContain('- 不合格の検査：command: lint');
      expect(text.indexOf('不合格の検査')).toBeLessThan(text.indexOf('## 要件ごとの結果'));
      expect(text).not.toContain('要注意の要件はありません。');
    });
  });

  it('[REQ-072] どちらもなければ、要注意の要件がないと書く', () => {
    withProject({}, (root) => {
      expect(markdown(root).text).toContain('要注意の要件はありません。');
    });
  });
});

describe('使った証拠の記載', () => {
  it('[REQ-073] 使った記録の、記録した日時・SHA・コミットの日時を載せる', () => {
    withProject({}, (root) => {
      expect(markdown(root).text).toContain('| 2026-10-23T01:00:00.000Z | 0123456789abcdef0123456789abcdef01234567 | 2026-10-23T09:00:00+09:00 | 合格 |');
    });
  });
});

describe('読めない証拠の記録', () => {
  it('[REQ-073] JSON として壊れた記録があれば、そのファイルを日本語で示し、スタックトレースを出さずに終了コード 2 を返す', () =>
    withProject({}, async (root) => {
      writeFileSync(join(root, `.loomake/evidence/${CHANGE}/broken.json`), '{ 壊れた');
      const r = await cli(root);
      expect(r.code).toBe(2);
      expect(r.stderr).toContain(`証拠の記録 .loomake/evidence/${CHANGE}/broken.json を JSON として読めません`);
      expect(r.stderr).not.toContain('    at ');
    }));

  const file = `.loomake/evidence/${CHANGE}/0.json`;

  it('[REQ-073] schemaVersion が読める版でない記録があれば、そのファイルと版を日本語で示し、終了コード 2 を返す', () =>
    withProject({ evidence: [{ schemaVersion: 2 }] }, async (root) => {
      const r = await cli(root);
      expect(r.code).toBe(2);
      expect(r.stderr).toContain(`証拠の記録 ${file} は、この版の loomake では読めない形式です（schemaVersion 2。読めるのは 1）`);
    }));

  it('[REQ-073] verify.results のない記録があれば、そのファイルと欄を日本語で示し、スタックトレースを出さずに終了コード 2 を返す', () =>
    withProject({ evidence: [{ verify: { ok: true } as unknown as Evidence['verify'] }] }, async (root) => {
      const r = await cli(root);
      expect(r.code).toBe(2);
      expect(r.stderr).toContain(`証拠の記録 ${file} の verify.results の形が違います`);
      expect(r.stderr).not.toContain('    at ');
    }));

  it('[REQ-073] sha や日時の形が違う記録も、その欄を示して終了コード 2 を返す', () =>
    withProject({ evidence: [{ sha: 'abc' }, { recordedAt: '昨日' }] }, async (root) => {
      const r = await cli(root);
      expect(r.code).toBe(2);
      expect(r.stderr).toMatch(/の (sha|recordedAt) の形が違います/);
    }));

  it('[REQ-073] change がほかの change の記録があれば、そのファイルを日本語で示し、終了コード 2 を返す', () =>
    withProject({ evidence: [{ change: 'c2' }] }, async (root) => {
      const r = await cli(root);
      expect(r.code).toBe(2);
      expect(r.stderr).toContain(`証拠の記録 ${file} は、ほかの change（c2）の記録です`);
    }));

  it('[REQ-209] 古い証拠が壊れていても、ファイル名の日時が最新の証拠だけを読んでレポートを出す', () =>
    withProject({}, async (root) => {
      renameEvidence(root, ['20261024T010000Z-0123456789ab.json']);
      writeFileSync(join(root, `.loomake/evidence/${CHANGE}/20261023T000000Z-000000000000.json`), '{ 壊れた');
      const r = await cli(root);
      expect(r.code, r.stderr).toBe(0);
    }));

  it('[REQ-209] ファイル名の日時が最新の証拠が壊れていれば、そのファイルを示して終了コード 2 を返す', () =>
    withProject({}, async (root) => {
      writeFileSync(join(root, `.loomake/evidence/${CHANGE}/99991231T235959Z-ffffffffffff.json`), '{ 壊れた');
      const r = await cli(root);
      expect(r.code).toBe(2);
      expect(r.stderr).toContain(`証拠の記録 .loomake/evidence/${CHANGE}/99991231T235959Z-ffffffffffff.json を JSON として読めません`);
    }));

  it('欄を足しただけの記録は読める（validate-evidence-records の仮定 A-01）', () =>
    withProject({ evidence: [{ extra: 'x' } as Partial<Evidence>] }, async (root) => {
      const r = await cli(root);
      expect(r.code).toBe(0);
    }));
});

describe('出力の形式', () => {
  it('[REQ-074] --format md で Markdown を出し、終了コード 0 を返す', async () => {
    await withProject({}, async (root) => {
      const r = await cli(root, '--format', 'md');
      expect(r.code).toBe(0);
      expect(r.stdout).toMatch(/^# リリースレポート：c1$/m);
    });
  });

  it('[REQ-074] --format json で、要件ごとの行と使った証拠を含む JSON を出す', async () => {
    await withProject({}, async (root) => {
      const r = await cli(root, '--format', 'json');
      const json = JSON.parse(r.stdout);
      expect(json.rows[0].id).toBe('REQ-012');
      expect(json.evidence.sha).toBe('0123456789abcdef0123456789abcdef01234567');
    });
  });

  it('[REQ-074] --format html は、次の版で対応する旨を出して終了コード 2 を返す', async () => {
    await withProject({}, async (root) => {
      const r = await cli(root, '--format', 'html');
      expect(r.code).toBe(2);
      expect(r.stderr).toContain('HTML の形式は次の版で対応します');
    });
  });

  it('--format を省くと Markdown を出す（仮定 A-07）', async () => {
    await withProject({}, async (root) => {
      expect((await cli(root)).stdout).toMatch(/^# リリースレポート：c1$/m);
    });
  });
});

describe('確認事項と仮定の一覧', () => {
  const question = '| Q-01 | REQ-012 | 何回ですか | 3 / 5 | 5 | yes | 5 回 | プロダクト責任者 | 2026-10-23 |';
  const assumption = '| A-01 | REQ-012 | 8 文字以上 | 記載なし | 承認 | 開発リーダー | 2026-10-23 |';

  it('[REQ-077] 確認事項ごとに、ID・質問・回答・回答者・回答日を並べる', () => {
    withProject({ trace: agreementTrace(question, assumption) }, (root) => {
      expect(report(root).questions).toEqual([{ id: 'Q-01', question: '何回ですか', answer: '5 回', answeredBy: 'プロダクト責任者', answeredAt: '2026-10-23' }]);
      expect(markdown(root).text).toContain('| Q-01 | 何回ですか | 5 回 | プロダクト責任者 | 2026-10-23 |');
    });
  });

  it('[REQ-078] 仮定ごとに、ID・内容・承認者・承認日を並べる', () => {
    withProject({ trace: agreementTrace(question, assumption) }, (root) => {
      expect(report(root).assumptions).toEqual([{ id: 'A-01', content: '8 文字以上', approval: '承認', approvedBy: '開発リーダー', approvedAt: '2026-10-23' }]);
      expect(markdown(root).text).toContain('| A-01 | 8 文字以上 | 承認 | 開発リーダー | 2026-10-23 |');
    });
  });
});

describe('合意の欄が空のときの警告', () => {
  it('[REQ-079] 回答はあるが回答者が空の確認事項を警告する', () => {
    const trace = agreementTrace('| Q-02 | REQ-012 | 何回ですか | 3 / 5 | 5 | yes | 5 回 |  | 2026-10-23 |', '| A-01 | REQ-012 | 内容 | 理由 |  |  |  |');
    withProject({ trace }, (root) => {
      expect(report(root).warnings).toEqual(['Q-02：回答者が空です']);
      expect(markdown(root).text).toContain('- Q-02：回答者が空です');
    });
  });

  it('[REQ-079] 列のない古い trace.md でもレポートを作り、回答のある確認事項の回答者と回答日が空だと警告する', () => {
    const trace = traceMd({ questions: ['| Q-01 | REQ-012 | 何回ですか | 3 / 5 | 5 | yes | 5 回 |'], assumptions: ['| A-01 | REQ-012 | 内容 | 理由 | 承認（2026-10-23） |'] });
    withProject({ trace }, (root) => {
      expect(report(root).warnings).toEqual(['Q-01：回答者が空です', 'Q-01：回答日が空です', 'A-01：承認者が空です', 'A-01：承認日が空です']);
    });
  });

  it('[REQ-079] 回答が空の確認事項と承認が空の仮定は、警告の対象にしない', () => {
    const trace = traceMd({ questions: ['| Q-03 | REQ-012 | 何回ですか | 3 / 5 | 5 | yes | |'], assumptions: ['| A-02 | REQ-012 | 内容 | 理由 | |'] });
    withProject({ trace }, (root) => {
      expect(report(root).warnings).toEqual([]);
    });
  });
});

describe('同じ入力からは同じレポート', () => {
  it('[REQ-085] 入力を変えずに 2 回出力すると、1 文字も違わない', async () => {
    const trace = traceMd({ ledger: [ledgerRow('REQ-070'), ledgerRow('REQ-012'), ledgerRow('REQ-071', '範囲外')] });
    await withProject({ trace }, async (root) => {
      const first = markdown(root).text;
      await new Promise((r) => setTimeout(r, 1100));
      expect(markdown(root).text).toBe(first);
      expect(report(root).rows.map((r) => r.id)).toEqual(['REQ-012', 'REQ-070', 'REQ-071']);
    });
  });
});

describe('report の性能と日本語', () => {
  it('[REQ-086] 要件 500 件の change のレポートを 5 秒以内に出す', () => {
    const ids = Array.from({ length: 500 }, (_, i) => `REQ-${String(i + 1).padStart(3, '0')}`);
    const trace = traceMd({ ledger: ids.map((id) => ledgerRow(id)) });
    const spec = specMd(...ids.map((id) => requirement(`振る舞い ${id}`, { source: `Source: ${id}` })));
    const coverage = Object.fromEntries(ids.map((id) => [id, [`tests/${id}.test.ts`]]));
    withProject({ trace, spec, evidence: [{ verify: { schemaVersion: '1.0.0', mode: 'done', change: CHANGE, ok: true, results: [], coverage } }] }, (root) => {
      const start = performance.now();
      const r = markdown(root);
      expect(r.code).toBe(0);
      expect(performance.now() - start).toBeLessThan(5000);
    });
  });

  it('[REQ-088] レポートの見出しと表の列名は日本語', () => {
    withProject({}, (root) => {
      const text = markdown(root).text;
      for (const h of ['# リリースレポート', '## 要注意の要件', '## 使った証拠', '## 要件ごとの結果', '## 確認事項', '## 仮定', '## 合意の記録の警告']) expect(text).toContain(h);
      expect(text).toContain('| ID | 出典 | 状態 | 要約 | Requirement | テスト | 最後の検査結果 |');
    });
  });

  it('[REQ-070] 題と見出しの固定文言に検収の語はなく、要約の検収は原文のまま載る', () => {
    const row = '| REQ-012 | 要件書 §1 | 機能 | 検収数値を確かめる | 反映済 | specs/x/spec.md |';
    withProject({ trace: traceMd({ ledger: [row] }) }, (root) => {
      const text = markdown(root).text;
      expect(text).toMatch(/^# リリースレポート：c1$/m);
      expect(text).toMatch(/^## 要件ごとの結果$/m);
      for (const heading of text.split('\n').filter((l) => l.startsWith('#'))) expect(heading).not.toContain('検収');
      expect(text).toContain('| REQ-012 | 要件書 §1 | 反映済 | 検収数値を確かめる |');
    });
  });
});

describe('記録した文書からのレポート', () => {
  const rewrite = (root: string, path: string, fn: (text: string) => string) => {
    const p = join(root, `openspec/changes/${CHANGE}`, path);
    writeFileSync(p, fn(readFileSync(p, 'utf8')));
  };

  it('[REQ-070][REQ-129] 記録のあとで要約を変えても、表には記録したときの要約が載り、変わった文書として trace.md を示す', () => {
    withProject({}, (root) => {
      rewrite(root, 'trace.md', (t) => t.replace('| 要約 |', '| 書き換えた要約 |'));
      const r = report(root);
      expect(r.rows[0]).toMatchObject({ id: 'REQ-012', summary: '要約', result: '合格' });
      expect(r.attention.changedDocuments).toEqual(['trace.md']);
      expect(markdown(root).text).not.toContain('書き換えた要約');
    });
  });

  it('[REQ-129] 記録のあとで差分仕様を変えたら、冒頭の「記録のあとで変わった文書」に挙げる', () => {
    withProject({}, (root) => {
      rewrite(root, 'specs/x/spec.md', (t) => `${t}\n`);
      expect(report(root).attention.changedDocuments).toEqual(['specs/x/spec.md']);
      expect(markdown(root).text).toContain('- 記録のあとで変わった文書：specs/x/spec.md');
    });
  });

  it('[REQ-129] 文書を変えていなければ、変わった文書は挙がらない', () => {
    withProject({}, (root) => {
      expect(report(root).attention.changedDocuments).toEqual([]);
      expect(markdown(root).text).toContain('要注意の要件はありません。');
    });
  });

  it('[REQ-130] 文書のない古い形式の記録では、合格したテストのある要件を「合格（仕様との対応は未確認）」とし、冒頭に示す', () => {
    withProject({ evidence: [{ documents: undefined }] }, (root) => {
      const r = report(root);
      expect(r.evidence.documents).toBe(false);
      expect(r.rows[0].result).toBe('合格（仕様との対応は未確認）');
      const text = markdown(root).text;
      expect(text).toContain('| 合格（仕様との対応は未確認） |');
      expect(text).toContain('- 仕様との対応：この証拠の記録は検証した時点の trace.md と差分仕様を持たない古い形式');
    });
  });

  it('[REQ-131] 要件ごとの結果の表より前に、検査の範囲の説明を載せる', () => {
    withProject({}, (root) => {
      const text = markdown(root).text;
      expect(SCOPE_NOTE).toBe('自動検査は、要件 ID を含む成功したテストの存在を確認しています。テスト内容の妥当性と、要件を満たしているかの判断にはレビューが必要です。');
      expect(text.indexOf(SCOPE_NOTE)).toBeGreaterThan(-1);
      expect(text.indexOf(SCOPE_NOTE)).toBeLessThan(text.indexOf('## 要件ごとの結果'));
    });
  });
});

describe('証拠の実行時検証', () => {
  const invalid: { name: string; mutate: (e: Evidence) => unknown }[] = [
    { name: 'null', mutate: () => null },
    { name: '配列', mutate: () => [] },
    { name: '空のオブジェクト', mutate: () => ({}) },
    { name: '未対応の版', mutate: (e) => ({ ...e, schemaVersion: 999 }) },
    { name: '不正なSHAの長さ', mutate: (e) => ({ ...e, sha: 'a'.repeat(41) }) },
    { name: 'trace文書なし', mutate: (e) => ({ ...e, documents: [] }) },
    { name: '不正な文書の形', mutate: (e) => ({ ...e, documents: [{}] }) },
    { name: '不正なSHA', mutate: (e) => ({ ...e, sha: 'invalid' }) },
    { name: '不正な記録日時', mutate: (e) => ({ ...e, recordedAt: 'invalid' }) },
    { name: '不正なコミット日時', mutate: (e) => ({ ...e, committedAt: 'invalid' }) },
    { name: '別のchange', mutate: (e) => ({ ...e, change: 'other' }) },
    { name: '別の検証change', mutate: (e) => ({ ...e, verify: { ...e.verify, change: 'other' } }) },
    { name: '別の検証モード', mutate: (e) => ({ ...e, verify: { ...e.verify, mode: 'quality' } }) },
    { name: '検証結果なし', mutate: (e) => ({ ...e, verify: null }) },
    { name: '未対応の検証結果の版', mutate: (e) => ({ ...e, verify: { ...e.verify, schemaVersion: '999.0.0' } }) },
    { name: '不正な検査状態', mutate: (e) => ({ ...e, verify: { ...e.verify, results: [{ check: 'test', status: 'unknown', detail: '' }] } }) },
    { name: '不正なcoverage', mutate: (e) => ({ ...e, verify: { ...e.verify, coverage: { 'REQ-012': [3] } } }) },
    { name: '文書の内容の不一致', mutate: (e) => ({ ...e, documents: e.documents?.map((d) => ({ ...d, content: `${d.content}changed` })) }) },
    { name: '文書のパスの重複', mutate: (e) => ({ ...e, documents: [...(e.documents ?? []), ...(e.documents ?? [])] }) },
  ];
  it.each(invalid)('[REQ-142] $name はファイル名を示す日本語の使い方エラーになる', ({ mutate }) =>
    withProject({}, async (root) => {
      const file = join(root, '.loomake/evidence', CHANGE, '0.json');
      const saved = JSON.parse(readFileSync(file, 'utf8')) as Evidence;
      writeFileSync(file, JSON.stringify(mutate(saved)));
      const result = await cli(root);
      expect(result.code).toBe(2);
      expect(result.stderr).toContain('.loomake/evidence/c1/0.json');
      expect(result.stderr).toContain('証拠');
    }),
  );

  it('[REQ-142] documentsのない既存の証拠は読み続けられる', () =>
    withProject({ evidence: [{ documents: undefined }] }, (root) => {
      expect(report(root).evidence.documents).toBe(false);
      expect(report(root).rows[0].result).toBe('合格（仕様との対応は未確認）');
    }));
});
