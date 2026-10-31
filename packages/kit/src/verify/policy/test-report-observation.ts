import { parseTestReport, type Quality, type QualityMeasure } from '@loomake/core';
import type { QualityObservation } from './quality-conditions.js';

/** テストのレポートを出どころにする品質の source */
export const TEST_REPORT_SOURCE = 'ci.test_report';
/** 必須の要件のうち、失敗したテストを持つものの数 */
export const FAILED_SUBJECTS_METRIC = 'required_subjects_with_failed_tests';

/**
 * runVerify が品質コマンドの前後に集めた事実。adapter はこれを照合するだけで、ファイル・プロセス・時計を読まない。
 * target と basis は品質コマンドの前（before）とあと（after）の値。時刻はエポックからのミリ秒
 */
export type TestReportReceipt = {
  /** 解決できたテストランナー。解決できなければ null */
  producer: { name: string; version: string } | null;
  /** `git rev-parse HEAD` の結果。取れなければ null */
  target: { before: string | null; after: string | null };
  /** 基準（quality.yaml・差分仕様・trace.md）の hash */
  basis: { before: string; after: string };
  /**
   * 品質コマンドの開始と終了の時刻、前回のレポートを消してから実行したか、終了コード。
   * 終了コードは、すべての品質コマンドが 0 で終わったら 0、そうでなければ最初の 0 以外の値。終わらなかった（時間切れ・中断・起動の失敗）なら null
   */
  invocation: { startedAt: number; finishedAt: number; clearedBefore: boolean; exitCode: number | null };
  /** 実行のあとに読んだレポート。なければ null */
  report: { path: string; text: string; sha256: string } | null;
  /** 必須の要件 ID（差分仕様の ADDED・MODIFIED の Source） */
  required: readonly string[];
};

/** adapter に渡す道具。判定関数は node:* を読めないので、hash の計算は呼び出し側が渡す */
export type TestReportOptions = {
  /** 文字列の SHA-256 を小文字の 16 進で返す関数。kit の `sha256Hex` を渡す */
  sha256Hex: (text: string) => string;
};

const PRODUCERS = ['vitest', 'jest'];
const VERSION = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;
const TARGET = /^(<=|>=|==|<|>)\s*(-?[0-9]+(?:\.[0-9]+)?)$/;

// 実施が増えても値は減らないので、上限の目標は数えた値だけで違反が確定する
function violationSettled(target: string | undefined, value: number): boolean {
  const m = target === undefined ? null : TARGET.exec(target);
  if (!m) return false;
  const bound = Number(m[2]);
  return m[1] === '<=' || m[1] === '==' ? value > bound : m[1] === '<' ? value >= bound : false;
}

type Base = Pick<QualityObservation, 'subject' | 'source' | 'metric'>;
type Facts = Omit<QualityObservation, 'subject' | 'source' | 'metric'>;

// 適格性と実施を、決めた順に確かめる。最初に見つかった問題をその観測の状態にする
function judge(receipt: TestReportReceipt | null, target: string | undefined, options: TestReportOptions): Facts {
  if (!receipt) return { status: 'not_run', detail: '品質コマンドを実行していません' };
  const { producer, report, invocation } = receipt;
  const evidence = [
    ...(report ? [`report:sha256:${report.sha256}`] : []),
    `basis:sha256:${receipt.basis.after}`,
    ...(receipt.target.after ? [`target:${receipt.target.after}`] : []),
    ...(producer ? [`producer:${producer.name}@${producer.version}`] : []),
  ];
  if (receipt.required.length === 0) return { status: 'unavailable', evidence, detail: '必須の要件がありません' };
  if (!producer || !PRODUCERS.includes(producer.name) || !VERSION.test(producer.version)) {
    return { status: 'ineligible', evidence, detail: producer ? `知らないテストランナーか版です（${producer.name}@${producer.version}）` : 'テストランナーと版を確かめられません' };
  }
  if (!report) return { status: 'not_run', evidence, detail: 'テストのレポートがありません' };
  if (!receipt.target.before || !receipt.target.after) return { status: 'unverified', evidence, detail: '対象のコミットを確かめられません' };
  if (receipt.target.before !== receipt.target.after) return { status: 'stale', evidence, detail: '実行中に対象のコミットが変わりました' };
  if (receipt.basis.before !== receipt.basis.after) return { status: 'stale', evidence, detail: '実行中に基準（quality.yaml・仕様・trace.md）が変わりました' };
  if (options.sha256Hex(report.text) !== report.sha256) {
    return { status: 'unverified', evidence, detail: 'レポートの hash が本文と一致しません' };
  }
  if (!invocation.clearedBefore) return { status: 'unverified', evidence, detail: '前回のレポートを消してから実行していません' };
  if (invocation.exitCode !== 0) return { status: 'unverified', evidence, detail: '品質コマンドが非 0 で終わりました' };
  const parsed = parseTestReport(report.path, report.text);
  if (parsed.errors.length > 0) return { status: 'unverified', evidence, detail: `レポートを読めません（${parsed.errors[0].message}）` };
  const { startTime, tests, files } = parsed.value;
  if (startTime === null) return { status: 'unverified', evidence, detail: 'レポートに開始時刻がありません' };
  if (startTime < invocation.startedAt || startTime > invocation.finishedAt) return { status: 'stale', evidence, detail: 'この実行で作られたレポートではありません' };
  // 読み込みに失敗したファイルはテストが 0 件になり、失敗を数えられない。数えた値を信頼できないので未照合にする
  const broken = files.find((f) => f.status === 'failed' && f.tests === 0);
  if (broken) {
    const reason = broken.message ? `：${broken.message.split('\n')[0].slice(0, 200)}` : '';
    return { status: 'unverified', evidence, detail: `テストを実行できなかったファイルがあります（${broken.file}${reason}）` };
  }

  const required = new Set(receipt.required);
  const executed = new Set<string>();
  const failed = new Set<string>();
  const samples = new Set<string>();
  for (const test of tests) {
    if (test.status !== 'passed' && test.status !== 'failed') continue;
    const hits = test.requirements.filter((id) => required.has(id));
    if (hits.length === 0) continue;
    samples.add(JSON.stringify([test.file, test.fullName]));
    for (const id of hits) {
      executed.add(id);
      if (test.status === 'failed') failed.add(id);
    }
  }
  const value = failed.size;
  const missing = receipt.required.filter((id) => !executed.has(id));
  if (missing.length > 0 && !violationSettled(target, value)) {
    const shown = missing.slice(0, 5).join('・') + (missing.length > 5 ? ` ほか ${missing.length - 5} 件` : '');
    return { status: 'incomplete', value, samples: samples.size, evidence, detail: `実施したテストのない必須の要件があります（${shown}）` };
  }
  return { status: 'measured', value, samples: samples.size, evidence };
}

type Item = { evidence: QualityMeasure[]; applicability?: string };

/**
 * ci.test_report の adapter（REQ-319）。quality の適用対象のうち、source が ci.test_report で
 * metric が required_subjects_with_failed_tests の必須証拠ごとに観測を 1 つ返す。
 * producer と版・対象のコミット・基準の hash・レポートの hash・同じ実行で作られたレポートか・テストを実行できなかったファイルがないかを照合し、
 * 通らなければ measured にしない。
 * receipt が null なら未実施にする。レポートの hash は options.sha256Hex で計算する。入力を変えず、I/O・環境・時計を読まない
 */
export function observeTestReport(quality: Quality, receipt: TestReportReceipt | null, options: TestReportOptions): QualityObservation[] {
  const items = [...Object.entries(quality.objectives), ...Object.entries(quality.product)] as [string, Item][];
  const observations: QualityObservation[] = [];
  for (const [subject, item] of items) {
    if (item.applicability === 'not_applicable') continue;
    const measures = item.evidence.filter((m) => m.source === TEST_REPORT_SOURCE && m.metric === FAILED_SUBJECTS_METRIC);
    if (measures.length === 0) continue;
    // 同じ指標を 2 つ書いても観測は 1 つにする。目標は最初のものを違反の確定に使う
    const base: Base = { subject, source: TEST_REPORT_SOURCE, metric: FAILED_SUBJECTS_METRIC };
    observations.push({ ...base, ...judge(receipt, measures[0].target, options) });
  }
  return observations;
}
