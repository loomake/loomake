import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = join(import.meta.dirname, '..');
const templates = join(root, 'packages/kit/templates');
const skillDir = join(templates, 'skills/req-to-openspec');
const read = (p: string) => readFileSync(p, 'utf8');

const listFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? listFiles(join(dir, e.name)) : [join(dir, e.name)],
  );

// 見出し（# の数を問わない）の行の一覧。コードブロックの中は除く
const headings = (md: string) => stripCodeBlocks(md).match(/^#{1,6} .+$/gm) ?? [];

// 指定した見出しから、同じか上のレベルの次の見出しまでの本文。コードブロックの中の # は見出しとみなさない
const section = (md: string, heading: RegExp) => {
  const lines = md.split('\n');
  let inCode = false;
  const isHeading = lines.map((l) => {
    if (l.startsWith('```')) inCode = !inCode;
    return !inCode && /^#{1,6} /.test(l);
  });
  const start = lines.findIndex((l, i) => isHeading[i] && heading.test(l));
  if (start < 0) return '';
  const level = lines[start].match(/^#+/)![0].length;
  const end = lines.findIndex((l, i) => i > start && isHeading[i] && new RegExp(`^#{1,${level}} `).test(l));
  return lines.slice(start, end < 0 ? undefined : end).join('\n');
};

const stripCodeBlocks = (md: string) => md.replace(/^```[\s\S]*?^```/gm, '');

const JA = /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u;

// コード・URL・front matter を除いた本文で、日本語の文字が英字より多いこと
const isMostlyJapanese = (md: string) => {
  const body = stripCodeBlocks(md)
    .replace(/^---\n[\s\S]*?\n---\n/, '')
    .replace(/`[^`]*`/g, '')
    .replace(/\]\([^)]*\)/g, ']');
  const ja = body.match(new RegExp(JA.source, 'gu'))?.length ?? 0;
  const latin = body.match(/[A-Za-z]/g)?.length ?? 0;
  return ja > latin;
};

// ファイル名だけの見出し（# AGENTS.md）は日本語にできないので除く
const nonFileNameHeadings = (md: string) => headings(md).filter((h) => !/^#+ [\w.-]+$/.test(h));

const agents = read(join(templates, 'AGENTS.md'));
const skill = read(join(skillDir, 'SKILL.md'));
const format = read(join(skillDir, 'references/openspec-format.md'));

describe('AGENTS.md のテンプレート', () => {
  it('[REQ-043] 仕様の正・作業の流れ・完了の定義・禁止事項・報告の形の見出しがある', () => {
    for (const name of ['仕様の正', '作業の流れ', '完了の定義', '禁止事項', '報告の形']) {
      expect(headings(agents).some((h) => h.includes(name)), name).toBe(true);
    }
  });

  it('[REQ-044] テストを弱める・skip する変更と、設定を緩める変更を、人の承認なしには行えないと書いてある', () => {
    const forbidden = section(agents, /禁止事項/);
    const lines = forbidden.split('\n');
    const testLine = lines.find((l) => l.includes('テストを弱める') && l.includes('skip'));
    const configLine = lines.find((l) => l.includes('loomake.config.json') && l.includes('lint・型・テストの設定を緩める'));
    expect(testLine).toContain('人の承認なしに');
    expect(configLine).toContain('人の承認なしに');
  });

  it('[REQ-045] 最後の節に技術スタック・パッケージマネージャ・主なディレクトリ・コーディング規約の欄がある', () => {
    const last = agents.slice(agents.lastIndexOf('\n## '));
    expect(last).toMatch(/^\n## プロジェクト固有/);
    for (const name of ['技術スタック', 'パッケージマネージャ', '主なディレクトリ', 'コーディング規約']) {
      expect(last, name).toMatch(new RegExp(`^- ${name}：`, 'm'));
    }
  });

  it('[REQ-055] 見出しと本文が日本語である', () => {
    expect(nonFileNameHeadings(agents).length).toBeGreaterThan(0);
    for (const h of nonFileNameHeadings(agents)) expect(h, h).toMatch(JA);
    expect(isMostlyJapanese(agents)).toBe(true);
  });

  it('CLAUDE.md のテンプレートは AGENTS.md を読み込む', () => {
    expect(read(join(templates, 'CLAUDE.md')).trim()).toBe('@AGENTS.md');
  });
});

describe('req-to-openspec Skill のテンプレート', () => {
  it('[REQ-025] 入力が Markdown（.md）の要件書だと書いてある', () => {
    expect(skill).toMatch(/^description: .*Markdown（\.md）の要件定義書/m);
    expect(section(skill, /要件書を読む/)).toContain('Markdown（.md）だけ');
  });

  it('[REQ-025] .docx・.xlsx・.pdf などを渡されたら読まずに、Markdown への変換を利用者に求める', () => {
    const lines = section(skill, /要件書を読む/).split('\n');
    const line = lines.find((l) => l.includes('.docx') && l.includes('.xlsx') && l.includes('.pdf'));
    expect(line).toContain('読まずに');
    expect(line).toMatch(/Markdown に変換して/);
    expect(line).toContain('利用者');
  });

  it('[REQ-026] REQ-001 から 1 文ずつ採番し、出典に文書名・章と行を書く', () => {
    const ledger = section(skill, /要件台帳を作る/);
    expect(ledger).toContain('`REQ-001` から採番');
    expect(ledger).toContain('文を 1 つずつ');
    expect(ledger).toContain('出典は「文書名・章と行」まで書く');
  });

  it('[REQ-027] 曖昧さチェックリストが同梱され、全要件にあてて Q か A に記録するよう指示している', () => {
    expect(existsSync(join(skillDir, 'references/ambiguity-checklist.md'))).toBe(true);
    const step = section(skill, /曖昧さを洗い出す/);
    expect(step).toContain('(references/ambiguity-checklist.md)');
    expect(step).toContain('全 REQ にあてる');
    expect(step).toContain('確認事項（Q-xx）');
    expect(step).toContain('仮定（A-xx）');
  });

  it('[REQ-028] お金・個人情報・権限・データ削除・外部連携・検収数値を、仮定にしてはいけないものとして列挙している', () => {
    const step = section(skill, /曖昧さを洗い出す/);
    expect(step).toContain('仮定にしてはいけない');
    expect(step).toContain('必ずブロッキングな確認事項');
    const items = step.match(/^\d+\. .+$/gm) ?? [];
    expect(items.map((l) => l.replace(/^\d+\. /, '').replace(/（.*$/, ''))).toEqual([
      'お金',
      '個人情報',
      '権限',
      'データ削除',
      '外部連携',
      '検収数値',
    ]);
  });

  it('[REQ-029] 1 change をリリース・検収の単位とし、分割案を人に示して合意を取る', () => {
    const step = section(skill, /change に分割する/);
    expect(step).toContain('リリース・検収される単位');
    expect(step).toContain('分割案');
    expect(step).toContain('人に示し、合意を取る');
  });

  it('[REQ-030] 書式の参照ファイルに規範文・Source: 行・Scenario の雛形があり、SKILL.md が 3 つを必須とする', () => {
    const req = section(format, /specs\/<capability>\/spec\.md/);
    expect(req).toMatch(/^### Requirement: /m);
    expect(req).toMatch(/SHALL|MUST/);
    expect(req).toMatch(/^Source: REQ-\d{3}/m);
    expect(req).toMatch(/^#### Scenario: /m);

    const step = section(skill, /change を書き出す/);
    expect(step).toContain('次の 3 つを必ず入れる');
    expect(step).toMatch(/^1\. `SHALL` または `MUST` を使った規範文/m);
    expect(step).toMatch(/^2\. .*`Source: REQ-012` 行/m);
    expect(step).toMatch(/^3\. 1 つ以上の `#### Scenario:`/m);
  });

  it('[REQ-031] 範囲外の要件は Requirement にせず proposal.md の Non-goals に書く', () => {
    expect(skill).toMatch(/範囲外.*の要件は Requirement にせず、proposal\.md の Non-goals に書く/);
  });

  it('[REQ-032] 報告の節に change 一覧・台帳の集計・ブロッキング確認事項・未承認の仮定がある', () => {
    const report = section(skill, /報告する/);
    for (const item of ['change 一覧', '台帳の集計', 'ブロッキング確認事項', '未承認の仮定']) {
      expect(report, item).toMatch(new RegExp(`^\\d+\\. .*${item}`, 'm'));
    }
  });

  it('[REQ-033] ブロッキング確認事項を顧客にそのまま送れる文面で出すよう指示している', () => {
    expect(section(skill, /報告する/)).toMatch(/^ブロッキング確認事項は顧客にそのまま送れる文面で出す。/m);
  });

  it('[REQ-059] kit のコードに pandoc・pdftotext・xlsx2csv を呼び出す処理が無い', () => {
    const src = listFiles(join(root, 'packages/kit/src'));
    expect(src.length).toBeGreaterThan(0);
    for (const f of src) expect(read(f), relative(root, f)).not.toMatch(/pandoc|pdftotext|xlsx2csv/);
  });

  it('[REQ-059] Skill に pandoc・pdftotext・xlsx2csv で要件書を変換する指示が無い', () => {
    for (const f of listFiles(skillDir)) expect(read(f), relative(root, f)).not.toMatch(/pandoc|pdftotext|xlsx2csv/);
  });

  it('[REQ-055] SKILL.md の見出しと指示文が日本語である', () => {
    expect(nonFileNameHeadings(skill).length).toBeGreaterThan(0);
    for (const h of nonFileNameHeadings(skill)) expect(h, h).toMatch(JA);
    expect(isMostlyJapanese(skill)).toBe(true);
  });

  it('リポジトリの .agents/skills/req-to-openspec/ は、verify の実行方法を除いてテンプレートと同じ内容である', () => {
    // このリポジトリでは、ビルドしてから loomake verify を実行する pnpm -s verify を使う
    const repoDir = join(root, '.agents/skills/req-to-openspec');
    const rel = (dir: string) => listFiles(dir).map((f) => relative(dir, f)).sort();
    expect(rel(repoDir)).toEqual(rel(skillDir));
    for (const f of rel(skillDir)) {
      const repo = read(join(repoDir, f)).replaceAll('pnpm -s verify', 'npx loomake verify');
      expect(repo, f).toBe(read(join(skillDir, f)));
    }
  });
});
