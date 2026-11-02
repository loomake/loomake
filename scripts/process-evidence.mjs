#!/usr/bin/env node
// 開発用 PR の工程行の形式だけを検査する。担当・独立性・実際の実行結果は照合しない（Issue #256、ADR 0005）。
import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';

export const PROCESS_LINES = ['route', 'survey', 'second-opinion', 'design', 'implement', 'review', 'quality'];
export const STATES = ['実施済み', '未実施', '対象外', '再利用', '省略', '代替'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const HEAD = /^[0-9a-f]{40}$/;
const ACTORS = ['opus', 'codex', 'claude', 'human'];
const ROUTES = ['normal', 'hard-bug'];
const RUN = /^https:\/\/github\.com\/[^/\s]+\/[^/\s]+\/actions\/runs\/[0-9]+$/;
const INTEGER = /^(?:0|[1-9][0-9]*)$/;
const COMPLETED_KEYS = {
  survey: ['by', 'session', 'record', 'model'],
  'second-opinion': ['by', 'session', 'model', 'independent-view'],
  design: ['by', 'session', 'model'],
  implement: ['by'],
  review: ['round', 'by', 'session', 'model', 'head', 'critical', 'minor', 'info'],
  quality: ['verify', 'ci'],
};
const STATE_KEYS = { 未実施: [], 対象外: [], 再利用: ['source'], 省略: ['approval'], 代替: ['by', 'approval'] };

/** コメントとコード内の見出しを除いて見つけた、各「## 証跡」節の本文。 */
export function evidenceSection(body) {
  const visible = body.replace(/\r/g, '').replace(/<!--[\s\S]*?(?:-->|$)/g, (comment) => comment.replace(/[^\n]/g, ''));
  const sections = [];
  let current;
  let fence;
  for (const line of visible.split('\n')) {
    const marker = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (fence) {
      if (marker && marker[1][0] === fence[0] && marker[1].length >= fence.length && !marker[2].trim()) fence = undefined;
      else if (current) current.push(line);
      continue;
    }
    if (marker) {
      fence = marker[1];
      continue;
    }
    if (/^##[ \t]+/.test(line)) {
      current = undefined;
      if (/^##[ \t]+証跡[ \t]*$/.test(line)) {
        current = [];
        sections.push(current);
      }
      continue;
    }
    if (current) current.push(line);
  }
  return sections.map((section) => section.join('\n'));
}

function isUrl(value) {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && Boolean(url.hostname);
  } catch { return false; }
}

function parseValue(value) {
  if (/[<>]/.test(value)) return { error: '雛形の <…> が残っています' };
  const description = value.match(/^(.*?)(?:（([^（）]*)）)?$/);
  if (!description) return { error: '理由は行末の全角括弧に一つだけ書いてください' };
  const tokens = description[1].trim().split(/[ \t]+/);
  const state = tokens.shift();
  const fields = {};
  for (const token of tokens) {
    const field = token.match(/^([a-z][a-z-]*)=([^\s（）]+)$/);
    if (!field) return { error: `項目の形が不正です：${token}` };
    if (Object.hasOwn(fields, field[1])) return { error: `項目 ${field[1]} が重複しています` };
    fields[field[1]] = field[2];
  }
  return { state, fields, reason: description[2] };
}

function lineProblems(name, value) {
  const parsed = parseValue(value.trimEnd());
  if (parsed.error) return [parsed.error];
  const { state, fields, reason } = parsed;
  const problems = [];
  const required = (keys) => {
    for (const key of keys) if (!Object.hasOwn(fields, key)) problems.push(`${key}= がありません`);
  };
  const known = (keys) => {
    for (const key of Object.keys(fields)) if (!keys.includes(key)) problems.push(`項目 ${key} には対応していません`);
  };
  if (name === 'route') {
    if (!ROUTES.includes(state)) problems.push('経路は normal か hard-bug を書いてください');
    if (!reason?.trim()) problems.push('経路を選んだ理由がありません');
    known(['from']);
    if (fields.from !== undefined && !ROUTES.includes(fields.from)) problems.push('from= は normal か hard-bug を書いてください');
    return problems;
  }
  if (!STATES.includes(state)) return ['状態は 実施済み・未実施・対象外・再利用・省略・代替 のいずれかを書いてください'];
  if (state !== '実施済み') {
    known(STATE_KEYS[state]);
    required(STATE_KEYS[state]);
  } else {
    known(COMPLETED_KEYS[name]);
    if (name === 'survey') {
      required(['by']);
      if (fields.by === 'opus') required(['session', 'model']);
      else if (!fields.session && !fields.record) problems.push('session= か record= がありません');
    } else required(COMPLETED_KEYS[name]);
    if (name === 'second-opinion' && fields['independent-view'] !== undefined && !['あり', 'なし'].includes(fields['independent-view'])) {
      problems.push('independent-view= は あり か なし を書いてください');
    }
    if (name === 'quality') {
      if (fields.verify !== undefined && !['pass', 'fail', '対象外'].includes(fields.verify)) problems.push('verify= は pass・fail・対象外 のいずれかを書いてください');
      if (fields.ci !== undefined && !RUN.test(fields.ci)) problems.push('ci= は GitHub Actions の run URL を書いてください');
      if (fields.verify === '対象外' && !reason?.trim()) problems.push('verify が対象外の理由がありません');
    }
  }
  if (fields.by !== undefined && !ACTORS.includes(fields.by)) problems.push('by= は opus・codex・claude・human のいずれかを書いてください');
  if (fields.session !== undefined && !UUID.test(fields.session)) problems.push('session= は小文字の36字 UUID を書いてください');
  if (fields.head !== undefined && !HEAD.test(fields.head)) problems.push('head= は小文字の40桁 SHA を書いてください');
  for (const key of ['critical', 'minor', 'info']) {
    if (fields[key] !== undefined && !INTEGER.test(fields[key])) problems.push(`${key}= は0以上の整数を書いてください`);
  }
  if (fields.round !== undefined && !/^[1-9][0-9]*$/.test(fields.round)) problems.push('round= は1以上の整数を書いてください');
  if (fields.source !== undefined && !UUID.test(fields.source) && !isUrl(fields.source)) problems.push('source= は UUID か URL を書いてください');
  if (fields.approval !== undefined && !isUrl(fields.approval) && !(state === '省略' && /^[^\s#]+#[^\s#]+$/.test(fields.approval))) {
    problems.push(state === '省略' ? 'approval= は規定のパス#見出しか URL を書いてください' : 'approval= は URL を書いてください');
  }
  return problems;
}

/** 工程の実施状況の正否を判定せず、欠落・重複・各値の形を日本語で返す。 */
export function processEvidenceProblems(body) {
  const sections = evidenceSection(body);
  if (sections.length !== 1) return [sections.length ? '## 証跡 が複数あります。一つにまとめてください' : '## 証跡 がありません'];
  const rows = new Map(PROCESS_LINES.map((name) => [name, []]));
  const problems = [];
  for (const line of sections[0].split('\n')) {
    const match = line.match(/^([a-z][a-z-]*):[ \t]*(.*)$/);
    if (!match) continue;
    if (['opus-review', 'opus-model', 'ci'].includes(match[1]) && (!match[2] || /^[ \t]/.test(line.slice(line.indexOf(':') + 1)))) {
      problems.push(`${match[1]}: は旧形式の行です。工程行へ移してください`);
    }
    if (rows.has(match[1])) rows.get(match[1]).push(match[2]);
  }
  for (const [name, values] of rows) {
    if (!values.length) problems.push(`${name}: がありません`);
    if (name !== 'review' && values.length > 1) problems.push(`${name}: が重複しています`);
    for (const value of values) problems.push(...lineProblems(name, value).map((problem) => `${name}: ${problem}`));
  }
  return problems;
}

export function formatProcessProblems(problems) {
  return problems.join(' / ');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const problems = processEvidenceProblems(readFileSync(0, 'utf8'));
    if (problems.length) console.error(`証跡の工程行：${formatProcessProblems(problems)}`);
    process.exitCode = problems.length ? 1 : 0;
  } catch (error) {
    console.error(`証跡の工程行：本文を読めませんでした（${error.message}）`);
    process.exitCode = 1;
  }
}
