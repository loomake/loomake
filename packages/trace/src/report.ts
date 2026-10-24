import { join, relative, resolve } from 'node:path';
import { parseSpec, parseTrace } from '@loomake/core';
import { UsageError, assertChangeId, loadConfig, findChangeDir, toPosix, createInputReader, JSON_LIMITS, type InputReader } from '@loomake/kit';
import { EVIDENCE_DIR, EVIDENCE_SCHEMA_VERSION, type Evidence } from './record.js';
import { changedDocuments, readDocuments, type EvidenceDocument } from './documents.js';
import { evidenceProblem } from './evidence.js';

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
  attention: { noPassingTests: string[]; pending: string[]; changedDocuments: string[]; failedChecks: string[] };
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


const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isString = (v: unknown): v is string => typeof v === 'string';
const isDate = (v: unknown) => isString(v) && !Number.isNaN(Date.parse(v));
const isArrayOf = (v: unknown, item: (x: unknown) => boolean) => Array.isArray(v) && v.every(item);

/** レポートと PR 本文が使う欄の形が違えば、その欄の名前を返す（validate-evidence-records の仮定 A-01） */
function wrongField(e: Record<string, unknown>): string | undefined {
  const verify = isObject(e.verify) ? e.verify : undefined;
  const checks: [string, boolean][] = [
    ['change', isString(e.change)],
    ['sha', isString(e.sha) && /^[0-9a-f]{40}$/.test(e.sha)],
    ['committedAt', isDate(e.committedAt)],
    ['recordedAt', isDate(e.recordedAt)],
    ['verify', verify !== undefined],
    ['verify.ok', typeof verify?.ok === 'boolean'],
    ['verify.results', isArrayOf(verify?.results, (r) => isObject(r) && isString(r.check) && isString(r.status))],
    ['verify.coverage', verify?.coverage === undefined || (isObject(verify.coverage) && Object.values(verify.coverage).every((f) => isArrayOf(f, isString)))],
    ['documents', e.documents === undefined || isArrayOf(e.documents, (d) => isObject(d) && isString(d.path) && isString(d.sha256) && isString(d.content))],
  ];
  return checks.find(([, ok]) => !ok)?.[0];
}

// 読めない記録があれば、どのファイルかを示して止める
function readEvidence(root: string, file: string, change: string, reader: InputReader): Evidence {
  let value: unknown;
  try {
    value = JSON.parse(reader.read(file));
  } catch (error) {
    if (error instanceof UsageError) throw error;
    throw new UsageError(`証拠の記録 ${toPosix(relative(root, file))} を JSON として読めません`);
  }
  const problem = evidenceProblem(value, change);
  if (problem) {
    const name = `証拠の記録 ${toPosix(relative(root, file))}`;
    if (!isObject(value)) throw new UsageError(`${name} は JSON のオブジェクトではありません`);
    if (value.schemaVersion !== EVIDENCE_SCHEMA_VERSION) throw new UsageError(`${name} は、この版の loomake では読めない形式です（schemaVersion ${JSON.stringify(value.schemaVersion)}。読めるのは ${EVIDENCE_SCHEMA_VERSION}）`);
    const field = wrongField(value);
    if (field) throw new UsageError(`${name} の ${field} の形が違います`);
    if (value.change !== change) throw new UsageError(`${name} は、ほかの change（${String(value.change)}）の記録です`);
    throw new UsageError(`${name} が不正です：${problem}`);
  }
  return value as Evidence;
}

/**
 * ファイル名の日時（YYYYMMDDTHHMMSSZ。辞書順で時刻順になる）がいちばん新しい証拠の記録（REQ-209）。
 * レポートに使うものだけを読んで検証し、ほかの証拠は読まない。読む量が証拠の数に比例しない
 */
function latestEvidence(root: string, dir: string, change: string, reader: InputReader): Evidence | undefined {
  let latest: string | undefined;
  for (const entry of reader.entries(dir)) {
    if (entry.kind !== 'file' || !entry.name.endsWith('.json')) continue;
    if (latest === undefined || entry.name > latest) latest = entry.name;
  }
  return latest === undefined ? undefined : readEvidence(root, join(dir, latest), change, reader);
}

const reqNumber = (id: string) => Number(id.match(/\d+/)?.[0] ?? Number.MAX_SAFE_INTEGER);

/** 検査の範囲の説明（REQ-131） */
export const SCOPE_NOTE = '自動検査は、要件 ID を含む成功したテストの存在を確認しています。テスト内容の妥当性と、要件を満たしているかの判断にはレビューが必要です。';

/** いちばん新しい証拠の記録と、それに保存した trace.md・差分仕様から、レポートの中身を作る。証拠の記録がなければ undefined */
export function buildReport(root: string, changeId: string): Report | undefined {
  const reader = createInputReader(JSON_LIMITS);
  const config = loadConfig(root);
  assertChangeId(changeId);
  const changeDir = findChangeDir(resolve(root, config.openspecDir, 'changes'), changeId, 'trace.md', reader);
  if (!changeDir) throw new UsageError(`change「${changeId}」がありません（進行中にも archive にもありません）`);

  const evidence = latestEvidence(root, join(root, EVIDENCE_DIR, changeId), changeId, reader);
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
      failedChecks: evidence.verify.results.filter((r) => r.status === 'fail').map((r) => r.check),
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

/** レポートを Markdown にする。作った日時は入れない（REQ-085） */
export function formatReportMarkdown(r: Report): string {
  const list = (ids: string[]) => (ids.length ? ids.join('、') : 'なし');
  const attention =
    r.attention.noPassingTests.length || r.attention.pending.length || r.attention.changedDocuments.length || !r.evidence.documents || !r.evidence.ok
      ? [
          ...(r.evidence.ok ? [] : [`- 不合格の検査：${list(r.attention.failedChecks)}（使った証拠の検査は不合格です）`]),
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
