import { createAgreement, parseTrace } from '../packages/core/src/index.js';
import { evaluateAgreement } from '../packages/kit/src/index.js';
import { describe, expect, it } from 'vitest';
import { blockingFinder, CSV_HEADER, formatJst, issueRows, AGENT_MARKER, decisionSection, needsDecision, OWNER_MENTION, pendingApprovalsCsv, prRows, readTraces, shortTitle, stripHtmlComments, toCsv, traceRows, waitingHours } from '../scripts/pending-approvals.mjs';

const now = new Date('2026-10-31T12:00:00Z');
// via_app は REST の performed_via_github_app の slug。直接の投稿は null
const CODEX = 'chatgpt-codex-connector';
const comment = (login: string, body: string, created_at: string, n = 1, via_app: string | null = CODEX) => ({ login, body, created_at, html_url: `https://github.com/loomake/loomake/issues/121#issuecomment-${n}`, via_app });
const pr = (number: number, body: string, createdAt = '2026-10-31T00:00:00Z') => ({ number, title: `題名${number}`, url: `https://github.com/loomake/loomake/pull/${number}`, body, createdAt });
// PR のテンプレートの「人の判断が必要な項目」の節（説明の HTML コメントつき）と、そのあとの節
const TEMPLATE_COMMENT = '<!-- ADR 0006 の 4 項目（npm 公開・public 化・リリース・規則の変更）と、L3 で 2 往復しても重大な指摘が残った場合だけ、Issue #121 にまとめて @rrr-xxx を呼ぶ。 -->';
const withDecision = (content: string, before = '## 変える問題と結果\n\n本文') => `${before}\n\n## 人の判断が必要な項目\n\n${TEMPLATE_COMMENT}\n\n${content}\n\n## 未確認の環境と検証の制約\n\n承認待ちの話はここにも書ける\n`;
// PR #200 の本文にあった実際の文
const PR200_PROSE = 'メンションは依頼の目印として残す（ダッシュボードの承認待ち一覧が検出する）。';
const PR200_NONE = 'なし（規則の変更は上記のとおり承認済み）。';
// verify の仕様ゲートと同じ関数（src を vitest の alias で読む）
const findBlocking = blockingFinder({ parseTrace, createAgreement, evaluateAgreement });
const traceText = (rows: string[]) => ['# trace', '', '## 要件台帳', '', '| ID | 出典 | 種別 | 要約（原文に忠実に） | 状態 | 反映先 |', '|---|---|---|---|---|---|', '', '## 確認事項', '',
  '| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 | 回答者 | 回答日 |', '|---|---|---|---|---|---|---|---|---|', ...rows, '', '## 仮定', '', '| ID | 関連 | 仮定の内容 | 理由 | 承認 | 承認者 | 承認日 |', '|---|---|---|---|---|---|---|', ''].join('\n');

describe('Issue #121 の呼びかけ', () => {
  it('利用者を呼んだコメントを、URL・先頭 60 文字・投稿時刻で返す', () => {
    const body = `@rrr-www 判断をお願いします\n${'あ'.repeat(80)}`;
    expect(issueRows([comment('agent', body, '2026-10-30T00:00:00Z')])).toEqual([
      { kind: 'issue121', source_url: 'https://github.com/loomake/loomake/issues/121#issuecomment-1', title: shortTitle(body), asked_at: '2026-10-30T00:00:00Z' },
    ]);
    expect(Array.from(shortTitle(body))).toHaveLength(60);
    expect(shortTitle(body)).not.toContain('\n');
    expect(shortTitle('a\r\nb\nc')).toBe('a b c');
  });

  it('誤ったハンドル @rrr-xxx も利用者への呼びかけとして扱う', () => {
    expect(issueRows([comment('agent', '確認を @rrr-xxx に依頼', '2026-10-30T00:00:00Z')])).toHaveLength(1);
  });

  it('呼びかけのあとに App を通さない投稿があれば回答済みとして除き、前にしかなければ残す', () => {
    const before = comment('rrr-www', '前のコメント', '2026-10-29T00:00:00Z', 1, null);
    const ask = comment('rrr-www', '@rrr-www 承認を', '2026-10-30T00:00:00Z', 2);
    const answer = comment('rrr-www', 'OK', '2026-10-30T01:00:00Z', 3, null);
    expect(issueRows([before, ask, answer])).toEqual([]);
    expect(issueRows([before, ask])).toHaveLength(1);
    // 取得順が時刻順でなくても、時刻で前後を決める
    expect(issueRows([answer, ask])).toEqual([]);
  });

  it('あとの投稿が App を通したもの（Codex など）なら、投稿者が利用者でも回答とみなさない', () => {
    const ask = comment('rrr-www', '@rrr-www 承認を', '2026-10-30T00:00:00Z', 1);
    const codex = comment('rrr-www', '状況の報告', '2026-10-30T01:00:00Z', 2, CODEX);
    const other = comment('rrr-www', '別の App', '2026-10-30T02:00:00Z', 3, 'unknown');
    expect(issueRows([ask, codex, other])).toHaveLength(1);
    expect(issueRows([ask, codex, comment('rrr-www', '了解', '2026-10-30T03:00:00Z', 4, null)])).toEqual([]);
  });

  it('目印 <!-- loomake-agent: claude --> を付けた直接の投稿は回答とみなさない', () => {
    // 2026-10-30 22:47Z の実例：App を通した呼びかけのあと、Claude が利用者のトークンで直接投稿した
    const ask = comment('rrr-www', '@rrr-www Draft PR #185 の判断を', '2026-10-30T22:47:08Z', 1);
    const claude = comment('rrr-www', `進み具合の報告\n${AGENT_MARKER}`, '2026-10-30T23:12:27Z', 2, null);
    expect(issueRows([ask, claude])).toHaveLength(1);
    expect(issueRows([ask, claude, comment('rrr-www', '進めてよい', '2026-10-30T23:39:27Z', 3, null)])).toEqual([]);
  });

  it('呼びかけの投稿者は問わず、ほかのアカウント名の一部に当たるものは呼びかけにしない', () => {
    expect(issueRows([comment('rrr-www', '@rrr-www 承認を', '2026-10-30T00:00:00Z', 1, null)])).toHaveLength(1);
    for (const text of ['@rrr-www-bot へ', 'x@rrr-www', '@rrr-wwwx', '@rrr-xxx_y', 'rrr-www だけ']) expect(OWNER_MENTION.test(text), text).toBe(false);
    for (const text of ['@rrr-www', '(@rrr-www)', '`@rrr-www` へ', '@rrr-xxx、', '行末 @rrr-xxx']) expect(OWNER_MENTION.test(text), text).toBe(true);
  });
});

describe('判断待ちの PR', () => {
  it('「## 人の判断が必要な項目」の節に中身がある PR を、#番号と題名と作成時刻で返す', () => {
    expect(prRows([pr(5, withDecision('- npm 公開の承認'), '2026-10-30T00:00:00Z'), pr(7, '## 変える問題と結果\n本文')])).toEqual([
      { kind: 'pr', source_url: 'https://github.com/loomake/loomake/pull/5', title: '#5 題名5', asked_at: '2026-10-30T00:00:00Z' },
    ]);
    expect(prRows([{ ...pr(8, withDecision('リリースの判断')), title: 'い'.repeat(100) }])[0].title).toHaveLength(60);
    expect(decisionSection(withDecision('一行目\n\n二行目'))).toBe('一行目\n\n二行目');
  });

  it('節の外の文に「承認待ち」とあっても数えない（PR #200 の実際の文）', () => {
    expect(needsDecision(withDecision(PR200_NONE, `## 変える問題と結果\n\n${PR200_PROSE}`))).toBe(false);
    expect(needsDecision(`## 変える問題と結果\n\n${PR200_PROSE}\n利用者の判断待ち`)).toBe(false);
  });

  it('テンプレートの説明の HTML コメントだけの節・空の節は待ちにしない', () => {
    expect(needsDecision(withDecision(''))).toBe(false);
    expect(needsDecision('## 人の判断が必要な項目\n')).toBe(false);
    expect(needsDecision('## 人の判断が必要な項目\n<!-- 閉じていない\n承認の依頼')).toBe(false);
    expect(stripHtmlComments('a<!-- x -->b<!-- y\nz -->c')).toBe('abc');
  });

  it('「なし」「特になし」で始まる節と「-」だけの節は、説明が続いても待ちにしない。「- 項目」の箇条書きは待ちにする', () => {
    for (const content of ['なし', 'なし。', '-', '特になし', PR200_NONE, 'なし (理由)', '特になし。', '- ', '- なし', '-\n補足'])
      expect(needsDecision(withDecision(content)), content).toBe(false);
    for (const content of ['なしにはできない判断がある', '- npm 公開', 'リリースの判断をお願いします', '-- 区切り'])
      expect(needsDecision(withDecision(content)), content).toBe(true);
  });

  it('見出しの下位の節（###）は同じ節の中身として扱う', () => {
    expect(decisionSection('## 人の判断が必要な項目\n### npm 公開\n内容\n## 証跡\nx')).toBe('### npm 公開\n内容');
  });
});

describe('trace.md の未回答のブロッキングな確認事項', () => {
  const text = traceText([
    '| Q-01 | REQ-001 | 段階をどう決めるか | A / B | A | yes |  |  |  |',
    '| Q-02 | REQ-001 | 回答済みの問い | A / B | A | はい | A | 利用者 | 2026-10-30 |',
    '| Q-03 | REQ-001 | ブロッキングでない問い | A / B | A | no |  |  |  |',
  ]);

  it('verify と同じ判定で、回答のないブロッキングな問いだけを返す', () => {
    expect(findBlocking(text)).toEqual([{ id: 'Q-01', question: '段階をどう決めるか' }]);
  });

  it('change ごとに main の blob の URL・「change-id: 問い」の題名・最後のコミットの時刻を付ける', () => {
    expect(traceRows([{ changeId: 'c1', text, committedAt: '2026-10-29T03:00:00+09:00' }], findBlocking)).toEqual([
      { kind: 'trace', source_url: 'https://github.com/loomake/loomake/blob/main/openspec/changes/c1/trace.md', title: 'c1: 段階をどう決めるか', asked_at: '2026-10-29T03:00:00+09:00' },
    ]);
  });

  it('git の ref から archive を除いた change の trace.md を読む', () => {
    const calls: string[][] = [];
    const git = (args: string[]) => {
      calls.push(args);
      if (args[0] === 'ls-tree') return ['openspec/changes/c1/trace.md', 'openspec/changes/c1/tasks.md', 'openspec/changes/archive/2026-10-01-old/trace.md', 'openspec/changes/archive/trace.md', ''].join('\n');
      if (args[0] === 'show') return `本文 ${args[1]}`;
      // 足したコミットの時刻（足し直したときは新しい順に複数行）
      return '2026-10-29T03:00:00+09:00\n2026-10-20T00:00:00+09:00\n';
    };
    expect(readTraces('origin/main', git)).toEqual([{ changeId: 'c1', text: '本文 origin/main:openspec/changes/c1/trace.md', committedAt: '2026-10-29T03:00:00+09:00' }]);
    expect(calls.at(-1)).toEqual(['log', '--diff-filter=A', '--format=%cI', 'origin/main', '--', 'openspec/changes/c1/trace.md']);
  });

  it('足したコミットが見つからなければ、最後のコミットの時刻を使う', () => {
    const git = (args: string[]) => {
      if (args[0] === 'ls-tree') return 'openspec/changes/c1/trace.md\n';
      if (args[0] === 'show') return '本文';
      return args.includes('--diff-filter=A') ? '' : '2026-10-30T00:00:00+09:00\n';
    };
    expect(readTraces('HEAD', git)).toEqual([{ changeId: 'c1', text: '本文', committedAt: '2026-10-30T00:00:00+09:00' }]);
  });
});

describe('CSV', () => {
  it('時刻を日本時間の YYYY-MM-DD HH:MM にし、待ち時間を小数第 1 位で数える', () => {
    expect(formatJst('2026-10-31T15:30:59Z')).toBe('2026-11-01 00:30');
    expect(formatJst('2026-10-29T03:00:00+09:00')).toBe('2026-10-29 03:00');
    expect(waitingHours('2026-10-31T10:30:00Z', now)).toBe(1.5);
    expect(waitingHours('2026-10-31T11:57:00Z', now)).toBe(0.1);
  });

  it('3 種類をまとめ、待ち時間の長い順に並べる', () => {
    const csv = pendingApprovalsCsv({
      comments: [comment('agent', '@rrr-www 確認', '2026-10-31T06:00:00Z')],
      prs: [pr(9, withDecision('リリースの判断'), '2026-10-31T11:00:00Z')],
      traces: [{ changeId: 'c1', text: traceText(['| Q-01 | REQ-001 | 問い | A | A | yes |  |  |  |']), committedAt: '2026-10-30T12:00:00Z' }],
      findBlocking,
      now,
    });
    expect(csv.split('\n')).toEqual([
      'kind,source_url,title,asked_at_jst,waiting_hours',
      'trace,https://github.com/loomake/loomake/blob/main/openspec/changes/c1/trace.md,c1: 問い,2026-10-30 21:00,24.0',
      'issue121,https://github.com/loomake/loomake/issues/121#issuecomment-1,@rrr-www 確認,2026-10-31 15:00,6.0',
      'pr,https://github.com/loomake/loomake/pull/9,#9 題名9,2026-10-31 20:00,1.0',
      '',
    ]);
  });

  it('カンマ・引用符・改行を含む値は引用符で囲む', () => {
    expect(toCsv([{ kind: 'pr', source_url: 'u', title: 'a,"b"\nc', asked_at_jst: '2026-10-31 00:00', waiting_hours: 2 }])).toBe(`${CSV_HEADER.join(',')}\npr,u,"a,""b""\nc",2026-10-31 00:00,2.0\n`);
  });

  it('待ちがなければ見出しだけを書く', () => {
    expect(pendingApprovalsCsv({ now })).toBe('kind,source_url,title,asked_at_jst,waiting_hours\n');
    expect(pendingApprovalsCsv({ comments: [comment('agent', '呼びかけなし', '2026-10-31T00:00:00Z')], prs: [pr(1, withDecision('なし'))], traces: [{ changeId: 'c', text: traceText([]), committedAt: '2026-10-31T00:00:00Z' }], findBlocking, now }))
      .toBe('kind,source_url,title,asked_at_jst,waiting_hours\n');
  });
});
