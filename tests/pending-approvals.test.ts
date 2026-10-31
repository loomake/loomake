import { createAgreement, parseTrace } from '../packages/core/src/index.js';
import { evaluateAgreement } from '../packages/kit/src/index.js';
import { describe, expect, it } from 'vitest';
import { blockingFinder, CSV_HEADER, formatJst, issueRows, OWNER_MENTION, pendingApprovalsCsv, prRows, readTraces, shortTitle, stripHtmlComments, toCsv, traceRows, waitingHours } from '../scripts/pending-approvals.mjs';

const now = new Date('2026-10-31T12:00:00Z');
// via_app は REST の performed_via_github_app の slug。直接の投稿は null
const CODEX = 'chatgpt-codex-connector';
const comment = (login: string, body: string, created_at: string, n = 1, via_app: string | null = CODEX) => ({ login, body, created_at, html_url: `https://github.com/loomake/loomake/issues/121#issuecomment-${n}`, via_app });
const pr = (number: number, body: string, updatedAt = '2026-10-31T00:00:00Z') => ({ number, title: `題名${number}`, url: `https://github.com/loomake/loomake/pull/${number}`, body, updatedAt });
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

  it('呼びかけの投稿者は問わず、ほかのアカウント名の一部に当たるものは呼びかけにしない', () => {
    expect(issueRows([comment('rrr-www', '@rrr-www 承認を', '2026-10-30T00:00:00Z', 1, null)])).toHaveLength(1);
    for (const text of ['@rrr-www-bot へ', 'x@rrr-www', '@rrr-wwwx', '@rrr-xxx_y', 'rrr-www だけ']) expect(OWNER_MENTION.test(text), text).toBe(false);
    for (const text of ['@rrr-www', '(@rrr-www)', '`@rrr-www` へ', '@rrr-xxx、', '行末 @rrr-xxx']) expect(OWNER_MENTION.test(text), text).toBe(true);
  });
});

describe('判断待ちの PR', () => {
  it('本文の行に「承認待ち」か「利用者の判断待ち」がある PR を、#番号と題名で返す', () => {
    expect(prRows([pr(5, '## 状態\n承認待ち'), pr(6, '利用者の判断待ちです'), pr(7, '待ちなし')])).toEqual([
      { kind: 'pr', source_url: 'https://github.com/loomake/loomake/pull/5', title: '#5 題名5', asked_at: '2026-10-31T00:00:00Z' },
      { kind: 'pr', source_url: 'https://github.com/loomake/loomake/pull/6', title: '#6 題名6', asked_at: '2026-10-31T00:00:00Z' },
    ]);
    expect(prRows([{ ...pr(8, '承認待ち'), title: 'い'.repeat(100) }])[0].title).toHaveLength(60);
  });

  it('HTML コメントの中の語は数えない（PR のテンプレートの説明文に当たらないように）', () => {
    expect(prRows([pr(1, '<!-- 承認待ちのときは書く -->\n本文'), pr(2, '<!--\n利用者の判断待ち\n-->'), pr(3, '<!-- 閉じていない\n承認待ち')])).toEqual([]);
    expect(prRows([pr(4, '<!-- 説明 --> 承認待ち')])).toHaveLength(1);
    expect(stripHtmlComments('a<!-- x -->b<!-- y\nz -->c')).toBe('abc');
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
      return '2026-10-29T03:00:00+09:00\n';
    };
    expect(readTraces('origin/main', git)).toEqual([{ changeId: 'c1', text: '本文 origin/main:openspec/changes/c1/trace.md', committedAt: '2026-10-29T03:00:00+09:00' }]);
    expect(calls.at(-1)).toEqual(['log', '-1', '--format=%cI', 'origin/main', '--', 'openspec/changes/c1/trace.md']);
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
      prs: [pr(9, '承認待ち', '2026-10-31T11:00:00Z')],
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
    expect(pendingApprovalsCsv({ comments: [comment('agent', '呼びかけなし', '2026-10-31T00:00:00Z')], prs: [pr(1, '本文')], traces: [{ changeId: 'c', text: traceText([]), committedAt: '2026-10-31T00:00:00Z' }], findBlocking, now }))
      .toBe('kind,source_url,title,asked_at_jst,waiting_hours\n');
  });
});
