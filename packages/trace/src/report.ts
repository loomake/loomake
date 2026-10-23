import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { parseSpec, parseTrace } from '@loomake/core';
import { UsageError, assertChangeId, loadConfig } from '@loomake/kit';
import { EVIDENCE_DIR, type Evidence } from './record.js';
import { changedDocuments, readDocuments, type EvidenceDocument } from './documents.js';

/** レポートの JSON の形の版 */
export const REPORT_SCHEMA_VERSION = 2;

export type ReportFormat = 'md' | 'json';

export type ReportRow = {
  id: string;
  source: string;
  state: string;
  summary: string;
  /** その要件を Source に持つ Requirement の名前 */
  requirements: string[];
  /** 証拠の記録で、その要件の合格したテストがあるファイル */
  tests: string[];
  /** 反映済の要件だけ「合格」か「合格したテストなし」。文書のない古い記録では「合格（仕様との対応は未確認）」。ほかの状態では null */
  result: '合格' | '合格（仕様との対応は未確認）' | '合格したテストなし' | null;
};

export type Report = {
  schemaVersion: number;
  change: string;
  /** documents は、検証した時点の文書を記録に保存しているか */
  evidence: { recordedAt: string; sha: string; committedAt: string; ok: boolean; documents: boolean };
  /** changedDocuments は、記録のあとで変わった文書のパス */
  attention: { noPassingTests: string[]; pending: string[]; changedDocuments: string[] };
  rows: ReportRow[];
  questions: { id: string; question: string; answer: string; answeredBy: string; answeredAt: string }[];
  assumptions: { id: string; content: string; approval: string; approvedBy: string; approvedAt: string }[];
  warnings: string[];
};

export type ReportOptions = {
  root: string;
  changeId: string;
  format?: ReportFormat;
  stdout: (text: string) => void;
};

const toPosix = (p: string) => p.split(sep).join('/');

/** 進行中の change を先に、なければ archive の <日付>-<change-id> を探す（add-trace-report の仮定 A-05） */
function findChange(changesDir: string, changeId: string): string | undefined {
  const active = join(changesDir, changeId);
  if (changeId !== 'archive' && existsSync(join(active, 'trace.md'))) return active;
  const archiveDir = join(changesDir, 'archive');
  if (!existsSync(archiveDir)) return undefined;
  return readdirSync(archiveDir)
    .filter((d) => d.replace(/^\d{4}-\d{2}-\d{2}-/, '') === changeId)
    .sort()
    .reverse()
    .map((d) => join(archiveDir, d))
    .find((d) => existsSync(join(d, 'trace.md')));
}

// 読めない記録があれば、どのファイルかを示して止める（fix-review-findings-2 の仮定 A-06）
function readEvidence(root: string, file: string): Evidence {
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as Evidence;
  } catch {
    throw new UsageError(`証拠の記録 ${toPosix(relative(root, file))} を JSON として読めません`);
  }
}

/** 記録した日時がいちばん新しい証拠の記録（add-trace-report の仮定 A-06） */
function latestEvidence(root: string, dir: string): Evidence | undefined {
  if (!existsSync(dir)) return undefined;
  const all = readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => readEvidence(root, join(dir, f)));
  return all.sort((a, b) => Date.parse(b.recordedAt) - Date.parse(a.recordedAt))[0];
}

const reqNumber = (id: string) => Number(id.match(/\d+/)?.[0] ?? Number.MAX_SAFE_INTEGER);

/** 検査の範囲の説明（REQ-131） */
export const SCOPE_NOTE = '自動検査は、要件 ID を含む成功したテストの存在を確認しています。テスト内容の妥当性と、要件を満たしているかの判断にはレビューが必要です。';

/** いちばん新しい証拠の記録と、それに保存した trace.md・差分仕様から、レポートの中身を作る。証拠の記録がなければ undefined */
export function buildReport(root: string, changeId: string): Report | undefined {
  const config = loadConfig(root);
  assertChangeId(changeId);
  const changeDir = findChange(resolve(root, config.openspecDir, 'changes'), changeId);
  if (!changeDir) throw new UsageError(`change「${changeId}」がありません（進行中にも archive にもありません）`);

  const evidence = latestEvidence(root, join(root, EVIDENCE_DIR, changeId));
  if (!evidence) return undefined;

  // 表は記録に保存した文書から作る。いまの文書は、記録のあとで変わったかを示すためだけに読む（REQ-070・REQ-129）。
  // 文書のない古い記録では、いまの文書を使い、仕様との対応は未確認と示す（REQ-130）
  const current = readDocuments(changeDir);
  const saved = Boolean(evidence.documents);
  const documents: EvidenceDocument[] = evidence.documents ?? current;
  const traceDoc = documents.find((d) => d.path === 'trace.md');
  if (!traceDoc) throw new UsageError('証拠の記録に trace.md がありません');
  const parsed = parseTrace('trace.md', traceDoc.content);
  if (parsed.errors.length) {
    throw new UsageError(`trace.md を読めません：${parsed.errors.map((e) => `${e.line} 行目 ${e.message}`).join('、')}`);
  }

  const requirementsOf = new Map<string, string[]>();
  for (const d of documents.filter((x) => x.path.startsWith('specs/'))) {
    const spec = parseSpec(d.path, d.content);
    for (const r of spec.value) for (const id of r.sources) requirementsOf.set(id, [...(requirementsOf.get(id) ?? []), r.name]);
  }
  const coverage = evidence.verify.coverage ?? {};

  // 同じ入力からは同じレポートになるよう、行は REQ の番号順に並べる（REQ-085）
  const rows: ReportRow[] = [...parsed.value.ledger]
    .sort((a, b) => reqNumber(a.ID) - reqNumber(b.ID) || a.ID.localeCompare(b.ID))
    .map((r) => {
      const tests = coverage[r.ID] ?? [];
      return {
        id: r.ID,
        source: r['出典'],
        state: r['状態'],
        summary: r['要約（原文に忠実に）'],
        requirements: requirementsOf.get(r.ID) ?? [],
        tests,
        result: r['状態'] === '反映済' ? (tests.length ? (saved ? '合格' : '合格（仕様との対応は未確認）') : '合格したテストなし') : null,
      };
    });

  const questions = parsed.value.questions.map((q) => ({
    id: q.ID,
    question: q['質問'],
    answer: q['回答'],
    answeredBy: q['回答者'],
    answeredAt: q['回答日'],
  }));
  const assumptions = parsed.value.assumptions.map((a) => ({
    id: a.ID,
    content: a['仮定の内容'],
    approval: a['承認'],
    approvedBy: a['承認者'],
    approvedAt: a['承認日'],
  }));
  // 回答や承認があるのに、誰がいつ決めたかが空の行を警告する（REQ-079）
  const warnings = [
    ...questions
      .filter((q) => q.answer)
      .flatMap((q) => [!q.answeredBy && `${q.id}：回答者が空です`, !q.answeredAt && `${q.id}：回答日が空です`]),
    ...assumptions
      .filter((a) => a.approval)
      .flatMap((a) => [!a.approvedBy && `${a.id}：承認者が空です`, !a.approvedAt && `${a.id}：承認日が空です`]),
  ].filter((w): w is string => Boolean(w));

  return {
    schemaVersion: REPORT_SCHEMA_VERSION,
    change: changeId,
    evidence: { recordedAt: evidence.recordedAt, sha: evidence.sha, committedAt: evidence.committedAt, ok: evidence.verify.ok, documents: saved },
    attention: {
      noPassingTests: rows.filter((r) => r.result === '合格したテストなし').map((r) => r.id),
      pending: rows.filter((r) => r.state === '確認待ち').map((r) => r.id),
      changedDocuments: saved ? changedDocuments(documents, current) : [],
    },
    rows,
    questions,
    assumptions,
    warnings,
  };
}

const cell = (s: string) => (s === '' ? '' : s.replace(/\|/g, '\\|'));
const table = (head: string[], rows: string[][]) =>
  [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.map(cell).join(' | ')} |`)].join('\n');

/** レポートを Markdown にする。作った日時は入れない（REQ-085、仮定 A-08） */
export function formatReportMarkdown(r: Report): string {
  const list = (ids: string[]) => (ids.length ? ids.join('、') : 'なし');
  const attention =
    r.attention.noPassingTests.length || r.attention.pending.length || r.attention.changedDocuments.length || !r.evidence.documents
      ? [
          `- 合格したテストのない要件：${list(r.attention.noPassingTests)}`,
          `- 確認待ちの要件：${list(r.attention.pending)}`,
          ...(r.evidence.documents
            ? [`- 記録のあとで変わった文書：${list(r.attention.changedDocuments)}`]
            : ['- 仕様との対応：この証拠の記録は検証した時点の trace.md と差分仕様を持たない古い形式なので、いまの文書と検査結果の対応は確かめていません']),
        ].join('\n')
      : '要注意の要件はありません。';
  return [
    `# 検収レポート：${r.change}`,
    '',
    '## 要注意の要件',
    '',
    attention,
    '',
    '## 検査の範囲',
    '',
    SCOPE_NOTE,
    '',
    '## 使った証拠',
    '',
    table(['記録した日時', 'コミット', 'コミットの日時', '検査の結果'], [[r.evidence.recordedAt, r.evidence.sha, r.evidence.committedAt, r.evidence.ok ? '合格' : '不合格']]),
    '',
    '## 要件ごとの検収',
    '',
    table(
      ['ID', '出典', '状態', '要約', 'Requirement', 'テスト', '最後の検査結果'],
      r.rows.map((x) => [x.id, x.source, x.state, x.summary, x.requirements.join('<br>'), x.tests.join('<br>'), x.result ?? '－']),
    ),
    '',
    '## 確認事項',
    '',
    table(['ID', '質問', '回答', '回答者', '回答日'], r.questions.map((q) => [q.id, q.question, q.answer, q.answeredBy, q.answeredAt])),
    '',
    '## 仮定',
    '',
    table(['ID', '内容', '承認', '承認者', '承認日'], r.assumptions.map((a) => [a.id, a.content, a.approval, a.approvedBy, a.approvedAt])),
    '',
    '## 合意の記録の警告',
    '',
    r.warnings.length ? r.warnings.map((w) => `- ${w}`).join('\n') : 'なし',
    '',
  ].join('\n');
}

/** 検収レポートを出力する。終了コード（出力した 0・証拠の記録がない 1）を返す */
export function runReport(options: ReportOptions): number {
  const { changeId, stdout, format = 'md' } = options;
  const report = buildReport(resolve(options.root), changeId);
  if (!report) {
    stdout(`${EVIDENCE_DIR}/${changeId}/ に証拠の記録がありません。先に loomake trace record --change ${changeId} を実行してください。`);
    return 1;
  }
  stdout(format === 'json' ? `${JSON.stringify(report, null, 2)}\n` : formatReportMarkdown(report));
  return 0;
}
