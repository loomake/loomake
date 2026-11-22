import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { beforeAll, expect, it } from 'vitest';
import { loadSummarySchemas } from '../packages/core/src/index.js';
import { checkBodyReceipt } from '../packages/kit/src/index.js';
import { appendBodyReceipt, bodyReceiptProblem, resolveArtifactBody } from '../packages/trace/src/index.js';
import { hash, now, policy, receiptFixture, receiptPath, summaryPath } from './fixtures/body-index/fixture.js';

const valid = new Ajv2020({ strict: false }).compile(JSON.parse(readFileSync(
  join(import.meta.dirname, '../packages/core/schema/summary/body-receipt-1.schema.json'), 'utf8',
)));
let schema: Awaited<ReturnType<typeof loadSummarySchemas>>['bodyReceiptSchema'];
beforeAll(async () => { schema = (await loadSummarySchemas()).bodyReceiptSchema; });
const commitCases = [40, 64].flatMap((length) => [
  ['lower', 'abcdef0123456789'.repeat(4).slice(0, length)],
  ['upper', 'ABCDEF0123456789'.repeat(4).slice(0, length)],
  ['mixed', 'aBcDeF0123456789'.repeat(4).slice(0, length)],
].map(([kind, sha]) => ({ label: `${length}-${kind}`, sha })));

it.each(commitCases)('[REQ-470][REQ-471] $label のコミットSHAを構造・同期・結付け・resolverで受理する', ({ sha }) => {
  const { receipt, summary, body } = receiptFixture();
  summary.sha = sha;
  const bytes = Buffer.from(JSON.stringify(summary) + '\n');
  receipt.summary.sha = sha;
  receipt.summary.sha256 = hash(bytes);
  receipt.summary.bytes = bytes.length;
  receipt.execution.checkoutSha = sha;
  receipt.execution.workflowHeadSha = sha;
  expect(bodyReceiptProblem(receipt)).toBeUndefined();
  expect(schema.safeParse(receipt).success).toBe(true);
  expect(valid(receipt), JSON.stringify(valid.errors)).toBe(true);
  expect(checkBodyReceipt(bytes, receipt, body).matches).toBe(true);
  const original = JSON.stringify(receipt);
  const root = mkdtempSync(join(tmpdir(), 'loomake-sha-contract-'));
  try {
    mkdirSync(dirname(join(root, summaryPath)), { recursive: true });
    writeFileSync(join(root, summaryPath), bytes);
    expect(appendBodyReceipt(root, receipt)).toBe(true);
    const saved = JSON.parse(readFileSync(join(root, receiptPath(receipt)), 'utf8'));
    expect(saved).toEqual(receipt);
    expect(valid(saved)).toBe(true);
    expect(resolveArtifactBody({ root, summaryPath, policy, now }).status).toBe('resolved');
    expect(readFileSync(join(root, summaryPath))).toEqual(bytes);
    expect(JSON.stringify(receipt)).toBe(original);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

const commitFields = ['summary.sha', 'execution.checkoutSha', 'execution.workflowHeadSha'] as const;
it.each(commitFields)('[REQ-470] %s の大文字40/64桁を単独でも公開Schemaが受理する', (field) => {
  const [section, key] = field.split('.');
  for (const length of [40, 64]) {
    const receipt = receiptFixture().receipt;
    (receipt[section] as Record<string, unknown>)[key] = 'A'.repeat(length);
    expect(bodyReceiptProblem(receipt)).toBeUndefined();
    expect(schema.safeParse(receipt).success).toBe(true);
    expect(valid(receipt), JSON.stringify(valid.errors)).toBe(true);
  }
});

it.each(commitFields)('[REQ-470] %s の不正文字・桁数を同期と両Schemaで拒否する', (field) => {
  const [section, key] = field.split('.');
  for (const sha of [39, 41, 63, 65].map((n) => 'a'.repeat(n)).concat(['g'.repeat(40), ` ${'a'.repeat(40)}`, `${'a'.repeat(40)} `])) {
    const receipt = receiptFixture().receipt;
    (receipt[section] as Record<string, unknown>)[key] = sha;
    expect(bodyReceiptProblem(receipt)).toBeDefined();
    expect(schema.safeParse(receipt).success).toBe(false);
    expect(valid(receipt)).toBe(false);
  }
});

it.each(['body.sha256', 'summary.sha256', 'archive.sha256', 'archive.apiDigest'])('[REQ-470][REQ-471] %s のSHA-256は小文字契約を保ち大文字を拒否する', (field) => {
  const { receipt, summaryBytes, body } = receiptFixture();
  const [section, key] = field.split('.');
  (receipt[section] as Record<string, unknown>)[key] = key === 'apiDigest' ? `sha256:${'C'.repeat(64)}` : 'C'.repeat(64);
  expect(bodyReceiptProblem(receipt)).toBeDefined();
  expect(schema.safeParse(receipt).success).toBe(false);
  expect(valid(receipt)).toBe(false);
  expect(checkBodyReceipt(summaryBytes, receipt, body).matches).toBe(false);
  const root = mkdtempSync(join(tmpdir(), 'loomake-hash-contract-'));
  try {
    mkdirSync(dirname(join(root, summaryPath)), { recursive: true });
    writeFileSync(join(root, summaryPath), summaryBytes);
    // body hashが不正な場合も、元の本体hashの探索先で壊れた候補として検査する。
    const file = join(root, receiptPath(receiptFixture().receipt));
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(receipt));
    expect(resolveArtifactBody({ root, summaryPath, policy, now }).status).toBe('invalid-index');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('[REQ-471] コミットSHAの大小文字を正規化して別checkoutとの一致を作らない', () => {
  const { receipt, summaryBytes, body } = receiptFixture();
  receipt.execution.checkoutSha = receipt.execution.checkoutSha.toUpperCase();
  expect(bodyReceiptProblem(receipt)).toBeUndefined();
  expect(schema.safeParse(receipt).success).toBe(true);
  expect(valid(receipt)).toBe(true);
  expect(checkBodyReceipt(summaryBytes, receipt, body).matches).toBe(false);
  const root = mkdtempSync(join(tmpdir(), 'loomake-checkout-case-'));
  try {
    mkdirSync(dirname(join(root, summaryPath)), { recursive: true });
    writeFileSync(join(root, summaryPath), summaryBytes);
    expect(appendBodyReceipt(root, receipt)).toBe(true);
    expect(resolveArtifactBody({ root, summaryPath, policy, now }).status).toBe('mismatch');
  } finally { rmSync(root, { recursive: true, force: true }); }
});
