import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { evidenceSection, formatProcessProblems, processEvidenceProblems, PROCESS_LINES, STATES } from '../scripts/process-evidence.mjs';

const session = '12345678-1234-1234-1234-123456789abc';
const reviewer = '87654321-4321-4321-4321-cba987654321';
const head = 'a'.repeat(40);
const run = 'https://github.com/loomake/loomake/actions/runs/123';
const rows = [
  'route: normal（開発基盤の機能追加）',
  `survey: 実施済み by=opus session=${session} model=claude-opus-5-5`,
  'second-opinion: 対象外',
  `design: 実施済み by=opus session=${session} model=claude-opus-5-5`,
  'implement: 実施済み by=codex',
  `review: 実施済み round=1 by=opus session=${reviewer} model=claude-opus-5-5 head=${head} critical=0 minor=1 info=2`,
  `quality: 実施済み verify=対象外 ci=${run}（change none。品質コマンドのみ）`,
];
const body = (lines = rows) => `loomake-change: none\n\n## 証跡\n\n\`\`\`text\nhead: ${head}\n${lines.join('\n')}\nprocess: self-review=codex\n\`\`\`\n`;
const replace = (name: string, value: string) => rows.map((line) => line.startsWith(`${name}:`) ? `${name}: ${value}` : line);
const problems = (name: string, value: string) => processEvidenceProblems(body(replace(name, value)));

describe('PR 証跡の工程行の形', () => {
  it('normal の実施済み工程と、レビュー・CI 前の正直な未実施を受け入れる', () => {
    expect(processEvidenceProblems(body())).toEqual([]);
    const pending = rows.map((line) => /^(review|quality):/.test(line) ? `${line.split(':')[0]}: 未実施（これから実行）` : line);
    expect(processEvidenceProblems(body(pending))).toEqual([]);
    expect(PROCESS_LINES).toEqual(['route', 'survey', 'second-opinion', 'design', 'implement', 'review', 'quality']);
    expect(STATES).toEqual(['実施済み', '未実施', '対象外', '再利用', '省略', '代替']);
  });

  it('hard-bug への経路切り替え、記録の場所、独立見解の有無と複数回のレビューを表せる', () => {
    const hard = rows.map((line) => {
      if (line.startsWith('route:')) return 'route: hard-bug from=normal（実行順序に依存する再現を確認）';
      if (line.startsWith('survey:')) return 'survey: 実施済み by=codex record=.loomake/handoff/investigation.md';
      if (line.startsWith('second-opinion:')) return `second-opinion: 実施済み by=opus session=${session} model=claude-opus-5-5 independent-view=あり`;
      return line;
    });
    hard.push(rows[5].replace('round=1', 'round=2'), rows[5].replace('round=1', 'round=3'));
    expect(processEvidenceProblems(body(hard))).toEqual([]);
    expect(processEvidenceProblems(body(hard.map((line) => line.replace('independent-view=あり', 'independent-view=なし'))))).toEqual([]);
  });

  it('6種類の状態を定められた項目で記録できる', () => {
    for (const value of [
      '未実施', '対象外', `再利用 source=${session}`, '再利用 source=https://example.invalid/design',
      '省略 approval=AGENTS.md#2-工程の-3-段階', '省略 approval=https://example.invalid/rule',
      '代替 by=human approval=https://example.invalid/approval（利用者の指定）',
    ]) expect(problems('design', value), value).toEqual([]);
  });

  it('CRLF、節の前後の引用、コメント中の行とコード中の見出しを区別する', () => {
    const quoted = `\`\`\`markdown\n## 証跡\nroute: invalid\n\`\`\`\n<!--\n## 証跡\nroute: invalid\n-->\n${body()}\n## 補足\nroute: invalid\n`;
    expect(processEvidenceProblems(quoted.replaceAll('\n', '\r\n'))).toEqual([]);
    expect(evidenceSection(quoted)).toHaveLength(1);
    expect(processEvidenceProblems(body().replace('route: normal', '<!-- route: invalid -->\nroute: normal'))).toEqual([]);
    expect(processEvidenceProblems(body().replace('implement: 実施済み by=codex', '<!-- implement: 実施済み by=codex -->'))).toContain('implement: がありません');
  });

  it('チルダと長いコードフェンスの中の見出しを節として数えない', () => {
    const text = `~~~~markdown\n## 証跡\n~~~\n## 証跡\n~~~~\n${body()}`;
    expect(processEvidenceProblems(text)).toEqual([]);
  });

  it.each(PROCESS_LINES)('%s の工程行が欠けたら行名を示す', (name) => {
    expect(processEvidenceProblems(body(rows.filter((line) => !line.startsWith(`${name}:`))))).toContain(`${name}: がありません`);
  });

  it.each(PROCESS_LINES.filter((name) => name !== 'review'))('%s の工程行が重複したら失敗する', (name) => {
    expect(processEvidenceProblems(body([...rows, rows.find((line) => line.startsWith(`${name}:`))!]))).toContain(`${name}: が重複しています`);
  });

  it('証跡の節がない・複数・引用内だけの場合は失敗する', () => {
    expect(processEvidenceProblems('route: normal（理由）')).toEqual(['## 証跡 がありません']);
    expect(processEvidenceProblems(`${body()}\n${body()}`)).toEqual(['## 証跡 が複数あります。一つにまとめてください']);
    expect(processEvidenceProblems('```markdown\n## 証跡\n```')).toEqual(['## 証跡 がありません']);
    expect(processEvidenceProblems(`<!-- ${body()} -->`)).toEqual(['## 証跡 がありません']);
  });

  it.each([
    ['route', 'normal|hard-bug（理由）', '経路'],
    ['route', 'normal', '理由'],
    ['route', 'normal from=unknown（理由）', 'from='],
    ['route', 'normal from=hard-bug from=normal（理由）', '重複'],
    ['design', '不明', '状態'],
    ['design', 'skip', '状態'],
    ['design', '未実施 session=abc', '対応していません'],
    ['design', '代替 by=codex', 'approval='],
    ['design', '再利用', 'source='],
    ['design', '再利用 source=.loomake/design.md', 'UUID か URL'],
    ['design', '省略 approval=AGENTS.md', 'パス#見出し'],
    ['design', '代替 by=codex approval=AGENTS.md#2', 'URL'],
    ['design', '実施済み by=opus session=<UUID> model=opus', '雛形'],
    ['design', `実施済み by=opus session=${session} model=opus unknown=x`, '対応していません'],
    ['design', `実施済み by=opus session=${session} model=opus model=other`, '重複'],
    ['design', '実施済み by=opus', 'session='],
    ['survey', '実施済み by=opus record=design.md', 'session='],
    ['survey', '実施済み by=codex', 'session= か record='],
    ['implement', '実施済み by=unknown', 'by='],
    ['second-opinion', `実施済み by=opus session=${session} model=opus independent-view=unknown`, 'independent-view='],
    ['quality', `実施済み verify=unknown ci=${run}`, 'verify='],
    ['quality', `実施済み verify=対象外 ci=${run}`, '理由'],
    ['quality', '実施済み verify=pass ci=https://example.invalid/actions/runs/123', 'run URL'],
    ['quality', `実施済み verify=pass ci=${run}?query=1`, 'run URL'],
  ])('%s: %s の不正な形を拒否する', (name, value, message) => {
    expect(problems(name, value).join('\n')).toContain(message);
  });

  it.each([session.slice(1), session.toUpperCase(), 'https://example.invalid/session'])('UUID の形が不正な %s を拒否する', (value) => {
    expect(problems('design', `実施済み by=opus session=${value} model=opus`).join('\n')).toContain('36字 UUID');
  });

  it.each([
    ['head', 'abc'], ['head', head.toUpperCase()], ['round', '0'], ['round', '-1'],
    ['critical', '-1'], ['minor', '1.5'], ['info', 'NaN'], ['minor', ''],
  ])('レビューの %s=%s の形を拒否する', (name, value) => {
    const line = rows[5].replace(new RegExp(`${name}=[^ ]+`), `${name}=${value}`);
    expect(processEvidenceProblems(body(rows.map((row) => row.startsWith('review:') ? line : row))).join('\n')).toContain('review:');
  });

  it.each(['opus-review', 'opus-model', 'ci'])('旧形式 %s: を拒否する', (name) => {
    expect(processEvidenceProblems(body([...rows, `${name}: 未実施`])).join('\n')).toContain(`${name}: は旧形式`);
  });

  it('ci:all-os は旧形式行として扱わない', () => {
    expect(processEvidenceProblems(body([...rows, 'ci:all-os']))).toEqual([]);
  });

  it('担当やセッションの一致・独立性・実結果は形式検査で判定しない', () => {
    const divergent = rows.map((line) => line
      .replace('survey: 実施済み by=opus', 'survey: 実施済み by=codex')
      .replace('design: 実施済み by=opus', 'design: 実施済み by=human')
      .replace(`session=${reviewer}`, `session=${session}`)
      .replace('critical=0', 'critical=3')
      .replace('verify=対象外', 'verify=fail'));
    expect(processEvidenceProblems(body(divergent))).toEqual([]);
  });

  it('独立調査・レビューの担当が規定と異なっていても、列挙された担当名なら形式として受け入れる', () => {
    expect(problems('second-opinion', `実施済み by=human session=${session} model=other independent-view=なし`)).toEqual([]);
    expect(processEvidenceProblems(body(rows.map((line) => line.replace('review: 実施済み round=1 by=opus', 'review: 実施済み round=1 by=claude'))))).toEqual([]);
  });


  it('実施済みの各工程は必要な項目をすべて要求する', () => {
    const required: Record<string, string[]> = {
      survey: ['by', 'session', 'model'],
      'second-opinion': ['by', 'session', 'model', 'independent-view'],
      design: ['by', 'session', 'model'],
      implement: ['by'],
      review: ['round', 'by', 'session', 'model', 'head', 'critical', 'minor', 'info'],
      quality: ['verify', 'ci'],
    };
    for (const [name, keys] of Object.entries(required)) {
      const value = name === 'second-opinion'
        ? `実施済み by=opus session=${session} model=opus independent-view=あり`
        : rows.find((line) => line.startsWith(`${name}:`))!.slice(name.length + 2);
      for (const key of keys) {
        const missing = value.replace(new RegExp(` ?${key}=[^ （]+`), '');
        expect(problems(name, missing).join(' / '), `${name}.${key}`).toContain(`${key}=`);
      }
    }
  });

  it('理由や項目が行をまたぐ形、入れ子や複数の理由を拒否する', () => {
    for (const value of [
      '実施済み by=codex（理由）（補足）',
      '実施済み by=codex（理由（補足））',
      '実施済み by=codex（理由）後置',
      '実施済み\nby=codex',
    ]) expect(problems('implement', value), value).not.toEqual([]);
  });

  it('日本語の診断をまとめる', () => {
    expect(formatProcessProblems(['route: がありません', 'design: がありません'])).toBe('route: がありません / design: がありません');
  });
});

describe('標準入力からの証跡の確認', () => {
  const script = join(import.meta.dirname, '..', 'scripts', 'process-evidence.mjs');
  it('妥当な本文は0で、欠落は日本語を標準エラーに出して1で終了する', () => {
    const pass = spawnSync(process.execPath, [script], { input: body(), encoding: 'utf8' });
    expect(pass.status).toBe(0);
    expect(pass.stderr).toBe('');
    const fail = spawnSync(process.execPath, [script], { input: '', encoding: 'utf8' });
    expect(fail.status).toBe(1);
    expect(fail.stderr).toContain('証跡の工程行：## 証跡 がありません');
  });
});


describe('工程行の文書の整合', () => {
  const root = join(import.meta.dirname, '..');
  const template = readFileSync(join(root, '.github', 'PULL_REQUEST_TEMPLATE.md'), 'utf8');
  const skill = readFileSync(join(root, '.agents', 'skills', 'delivery', 'SKILL.md'), 'utf8');
  const workflow = readFileSync(join(root, 'docs', 'dev', 'agent-workflow.md'), 'utf8');
  const block = (text: string) => text.match(/```text\n(head:[\s\S]*?)\n```/)?.[1] ?? '';
  const names = (text: string) => [...block(text).matchAll(/^([a-z][a-z-]*):/gm)].map((match) => match[1]);

  it('PR 雛形と delivery の共通欄が同じ並びで、7工程が揃っている', () => {
    expect(names(template)).toEqual(names(skill));
    expect(names(template).filter((name) => PROCESS_LINES.includes(name))).toEqual(PROCESS_LINES);
    for (const name of PROCESS_LINES) expect(workflow, name).toContain(`\`${name}:\``);
    expect(names(template)).not.toContain('ci');
    expect(names(template)).not.toContain('opus-review');
    expect(names(template)).not.toContain('opus-model');
  });

  it('雛形を未記入で貼り付けた本文は通らない', () => {
    expect(processEvidenceProblems(template).join(' / ')).toContain('雛形');
  });
});
