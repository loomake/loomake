#!/usr/bin/env node
// Loomake verify — 依存なし（Node 20+）
//
//   node scripts/verify.mjs                          品質チェックだけ（lint / typecheck / test）
//   node scripts/verify.mjs --change <id> --spec-only 仕様ゲート：実装に入ってよいか
//   node scripts/verify.mjs --change <id> --done      完了ゲート：仕様ゲート + タスク + 要件テスト + 品質チェック
//
// オプション：--json（結果を JSON で出力）、--skip-commands（lint/typecheck/test を実行しない）
// 終了コード：0 = 合格 / 1 = 不合格 / 2 = 使い方の誤り

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

// ---------- 引数 ----------
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

const changeId = opt('--change');
const specOnly = flag('--spec-only');
const done = flag('--done');
const asJson = flag('--json');
const skipCommands = flag('--skip-commands');

if ((specOnly || done) && !changeId) usage('--spec-only / --done には --change <id> が必要です');
if (specOnly && done) usage('--spec-only と --done は同時に指定できません');
if (changeId && !specOnly && !done) usage('--change を指定するときは --spec-only か --done を付けてください');

function usage(msg) {
  console.error(`verify: ${msg}`);
  console.error('使い方: node scripts/verify.mjs [--change <id> (--spec-only | --done)] [--json] [--skip-commands]');
  process.exit(2);
}

// ---------- 設定 ----------
const root = process.cwd();
const config = loadConfig();

function loadConfig() {
  const defaults = {
    openspecDir: 'openspec',
    openspecValidate: 'auto',
    tests: { dirs: ['tests', 'test', 'src'], pattern: '\\.(test|spec)\\.(ts|tsx|js|mjs|cjs|vue)$' },
    commands: {},
  };
  const p = join(root, 'loomake.config.json');
  if (!existsSync(p)) return defaults;
  const c = JSON.parse(readFileSync(p, 'utf8'));
  return { ...defaults, ...c, tests: { ...defaults.tests, ...(c.tests ?? {}) } };
}

// ---------- 結果の記録 ----------
const results = []; // { check, status: 'pass'|'fail'|'warn'|'skip', detail }
const record = (check, status, detail = '') => results.push({ check, status, detail });

// ---------- Markdown ユーティリティ ----------
function section(md, heading) {
  const lines = md.split('\n');
  const start = lines.findIndex((l) => l.trim() === `## ${heading}`);
  if (start < 0) return null;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => /^## /.test(l));
  return (end < 0 ? rest : rest.slice(0, end)).join('\n');
}

function parseTable(text) {
  if (!text) return [];
  const rows = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('|'));
  if (rows.length < 2) return [];
  const cells = (row) => row.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
  const header = cells(rows[0]);
  return rows
    .slice(2) // ヘッダと区切り行を飛ばす
    .map(cells)
    .filter((r) => r.some((c) => c !== ''))
    .map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
}

const REQ_ID = /REQ-\d{3,}/g;

// spec.md から Requirement を取り出す
function parseSpec(md, file) {
  const reqs = [];
  let op = null;
  let cur = null;
  for (const line of md.split('\n')) {
    const opMatch = line.match(/^## (ADDED|MODIFIED|REMOVED|RENAMED) Requirements/);
    if (opMatch) {
      op = opMatch[1];
      continue;
    }
    const reqMatch = line.match(/^### Requirement:\s*(.+)$/);
    if (reqMatch) {
      cur = { name: reqMatch[1].trim(), op, file, sources: [], scenarios: 0, normative: false };
      reqs.push(cur);
      continue;
    }
    if (!cur) continue;
    if (/^#### Scenario:/.test(line)) cur.scenarios++;
    const src = line.match(/^\**Source\**:\**\s*(.+)$/);
    if (src) cur.sources.push(...(src[1].match(REQ_ID) ?? []));
    if (/\b(SHALL|MUST)\b/.test(line)) cur.normative = true;
  }
  return reqs;
}

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

// ---------- 仕様ゲート ----------
function checkSpec() {
  const changeDir = resolve(root, config.openspecDir, 'changes', changeId);
  if (!existsSync(changeDir)) {
    record('change の存在', 'fail', `${relative(root, changeDir)} がありません`);
    return null;
  }
  record('change の存在', 'pass', relative(root, changeDir));

  for (const f of ['proposal.md', 'tasks.md', 'trace.md']) {
    record(`${f} の存在`, existsSync(join(changeDir, f)) ? 'pass' : 'fail');
  }

  // openspec validate
  if (config.openspecValidate !== false) {
    const r = spawnSync('openspec', ['validate', changeId, '--strict'], { cwd: root, encoding: 'utf8', shell: process.platform === 'win32' });
    if (r.error && r.error.code === 'ENOENT') {
      record('openspec validate', config.openspecValidate === 'auto' ? 'warn' : 'fail', 'openspec CLI が見つかりません（pnpm add -g @fission-ai/openspec）');
    } else {
      record('openspec validate', r.status === 0 ? 'pass' : 'fail', r.status === 0 ? '' : (r.stdout + r.stderr).trim().slice(0, 2000));
    }
  }

  // trace.md
  const tracePath = join(changeDir, 'trace.md');
  const trace = existsSync(tracePath) ? readFileSync(tracePath, 'utf8') : '';
  const ledger = parseTable(section(trace, '要件台帳'));
  const questions = parseTable(section(trace, '確認事項'));
  const assumptions = parseTable(section(trace, '仮定'));

  if (ledger.length === 0) record('要件台帳', 'fail', 'trace.md に「## 要件台帳」の表がありません');
  else record('要件台帳', 'pass', `${ledger.length} 件`);

  const validStates = ['反映済', '確認待ち', '範囲外', '既存仕様で充足'];
  const badState = ledger.filter((r) => !validStates.includes(r['状態']));
  if (badState.length) record('台帳の状態値', 'fail', badState.map((r) => `${r.ID}: "${r['状態']}"`).join(', '));

  const noSource = ledger.filter((r) => !r['出典']);
  if (noSource.length) record('台帳の出典', 'fail', `出典が空：${noSource.map((r) => r.ID).join(', ')}`);

  // ブロッキング確認事項
  const openBlocking = questions.filter((q) => /^yes$/i.test(q['ブロッキング']) && !q['回答']);
  if (openBlocking.length) {
    record('ブロッキング確認事項', 'fail', openBlocking.map((q) => `${q.ID}（${q['関連']}）${q['質問']}`).join('\n'));
  } else {
    record('ブロッキング確認事項', 'pass', `未回答 0 件（全 ${questions.length} 件）`);
  }

  const unapproved = assumptions.filter((a) => !a['承認']);
  if (unapproved.length) record('仮定の承認', 'warn', `未承認：${unapproved.map((a) => `${a.ID} ${a['仮定の内容']}`).join(' / ')}`);

  const pending = ledger.filter((r) => r['状態'] === '確認待ち');
  if (pending.length) record('確認待ちの要件', 'warn', pending.map((r) => r.ID).join(', '));

  // specs
  const specFiles = walk(join(changeDir, 'specs')).filter((f) => f.endsWith('spec.md'));
  if (specFiles.length === 0) record('差分仕様', 'fail', 'specs/<capability>/spec.md がありません');
  const reqs = specFiles.flatMap((f) => parseSpec(readFileSync(f, 'utf8'), relative(changeDir, f)));

  const ledgerIds = new Set(ledger.map((r) => r.ID));
  const live = reqs.filter((r) => r.op === 'ADDED' || r.op === 'MODIFIED');

  const noSrc = reqs.filter((r) => r.op !== 'RENAMED' && r.sources.length === 0);
  record('Requirement の Source', noSrc.length ? 'fail' : 'pass', noSrc.map((r) => `${r.file}: ${r.name}`).join('\n'));

  const unknown = reqs.flatMap((r) => r.sources.filter((s) => !ledgerIds.has(s)).map((s) => `${r.name} → ${s}`));
  record('Source が台帳にある', unknown.length ? 'fail' : 'pass', unknown.join('\n'));

  const noScenario = live.filter((r) => r.scenarios === 0);
  record('Scenario の有無', noScenario.length ? 'fail' : 'pass', noScenario.map((r) => r.name).join(', '));

  const noNormative = live.filter((r) => !r.normative);
  if (noNormative.length) record('SHALL / MUST', 'fail', noNormative.map((r) => r.name).join(', '));

  // 反映済なのにどの Requirement からも参照されていない REQ
  const referenced = new Set(reqs.flatMap((r) => r.sources));
  const orphan = ledger.filter((r) => r['状態'] === '反映済' && !referenced.has(r.ID));
  record('反映済の要件が仕様にある', orphan.length ? 'fail' : 'pass', orphan.map((r) => r.ID).join(', '));

  return { changeDir, ledger, reqs, live };
}

// ---------- 完了ゲート ----------
function checkDone(spec) {
  const { changeDir, live, ledger } = spec;

  // 完了時に確認待ちの要件が残っていてはいけない
  const pending = ledger.filter((r) => r['状態'] === '確認待ち');
  record('確認待ちが残っていない', pending.length ? 'fail' : 'pass', pending.map((r) => r.ID).join(', '));

  // tasks.md
  const tasksPath = join(changeDir, 'tasks.md');
  if (existsSync(tasksPath)) {
    const tasks = readFileSync(tasksPath, 'utf8').split('\n').filter((l) => /^\s*- \[[ xX]\]/.test(l));
    const open = tasks.filter((l) => /^\s*- \[ \]/.test(l));
    record('tasks.md', open.length ? 'fail' : 'pass', open.length ? open.map((l) => l.trim()).join('\n') : `${tasks.length} 件すべて完了`);
  }

  // 要件 ↔ テスト
  const re = new RegExp(config.tests.pattern);
  const testFiles = config.tests.dirs.flatMap((d) => walk(join(root, d))).filter((f) => re.test(f));
  const covered = new Map(); // REQ → [file]
  for (const f of testFiles) {
    const text = readFileSync(f, 'utf8');
    // skip されたテストは数えない
    const active = text
      .split('\n')
      .filter((l) => !/\b(it|test|describe)\.(skip|todo)\s*\(|\bx(it|test|describe)\s*\(/.test(l))
      .join('\n');
    for (const m of active.matchAll(/\[(REQ-\d{3,})\]/g)) {
      covered.set(m[1], [...(covered.get(m[1]) ?? []), relative(root, f)]);
    }
  }
  const needed = [...new Set(live.flatMap((r) => r.sources))].sort();
  const missing = needed.filter((id) => !covered.has(id));
  record(
    '要件ごとのテスト',
    missing.length ? 'fail' : 'pass',
    missing.length ? `テストが無い要件：${missing.join(', ')}` : `${needed.length} 件すべてにテストあり（テストファイル ${testFiles.length} 個を走査）`,
  );

  return { coverage: Object.fromEntries(needed.map((id) => [id, covered.get(id) ?? []])) };
}

// ---------- 品質コマンド ----------
function runCommands() {
  if (skipCommands) return;
  for (const [name, cmd] of Object.entries(config.commands ?? {})) {
    if (!cmd) continue;
    if (!asJson) process.stderr.write(`… ${name}: ${cmd}\n`);
    const r = spawnSync(cmd, { cwd: root, shell: true, encoding: 'utf8' });
    const out = `${r.stdout ?? ''}${r.stderr ?? ''}`.trim();
    record(`command: ${name}`, r.status === 0 ? 'pass' : 'fail', r.status === 0 ? '' : out.split('\n').slice(-30).join('\n'));
  }
}

// ---------- 実行 ----------
let extra = {};
if (changeId) {
  const spec = checkSpec();
  if (spec && done) {
    extra = checkDone(spec);
    runCommands();
  }
} else {
  runCommands();
}

const failed = results.filter((r) => r.status === 'fail');
const mode = done ? 'done' : specOnly ? 'spec-only' : 'quality';

if (asJson) {
  console.log(JSON.stringify({ mode, change: changeId ?? null, ok: failed.length === 0, results, ...extra }, null, 2));
} else {
  const icon = { pass: '✔', fail: '✖', warn: '!', skip: '-' };
  console.log(`\nLoomake verify  mode=${mode}${changeId ? `  change=${changeId}` : ''}\n`);
  for (const r of results) {
    console.log(`${icon[r.status]} ${r.check}`);
    if (r.detail && r.status !== 'pass') console.log(r.detail.replace(/^/gm, '    '));
  }
  console.log(`\n${failed.length === 0 ? '合格' : `不合格（${failed.length} 件）`}`);
}
process.exit(failed.length === 0 ? 0 : 1);
