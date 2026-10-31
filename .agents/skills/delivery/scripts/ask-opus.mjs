import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROLES = ['design', 'second-opinion', 'review'];
const TOOLS = ['Read', 'Glob', 'Grep'];
const MAX_OUTPUT = 8 * 1024 * 1024;
const MAX_REQUEST = 200 * 1024;
const DIFF_BEGIN = '<!-- ask-opus:diff-begin -->';
const DIFF_END = '<!-- ask-opus:diff-end -->';

export function parseArgs(args) {
  const values = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i];
    if (!['--role', '--request', '--head', '--timeout-min'].includes(key) || values[key] !== undefined || !args[i + 1]) {
      throw new Error('引数が不正です。--role、--request、--head、必要なら --timeout-min を指定してください。');
    }
    values[key] = args[i + 1];
  }
  const timeoutMin = Number(values['--timeout-min'] ?? '20');
  if (!ROLES.includes(values['--role']) || !values['--request'] || !/^[a-f0-9]{40}$/.test(values['--head'] ?? '') ||
      !Number.isInteger(timeoutMin) || timeoutMin < 1 || timeoutMin > 60) {
    throw new Error('工程・依頼ファイル・40桁のhead・1〜60分の上限を指定してください。');
  }
  return { role: values['--role'], request: values['--request'], head: values['--head'], timeoutMs: timeoutMin * 60_000 };
}

export function buildClaudeArgs(sessionId, requestDir) {
  return ['--print', '--model', 'opus', '--permission-mode', 'plan',
    '--tools', TOOLS.join(','), '--allowedTools', 'Read(./**)',
    '--setting-sources', '', '--settings', '{"disableAllHooks":true,"autoMemoryEnabled":false,"permissions":{"blockReadsOutsideWorkingDirectories":true}}',
    '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}',
    '--no-session-persistence', '--session-id', sessionId,
    '--add-dir', requestDir, '--output-format', 'stream-json', '--verbose'];
}

export function evaluateEvents(raw, sessionId) {
  let events;
  try { events = raw.trim().split('\n').map((line) => JSON.parse(line)); }
  catch { throw new Error('Claudeの応答をJSONとして読めませんでした。'); }
  const inits = events.filter((event) => event?.type === 'system' && event.subtype === 'init');
  const results = events.filter((event) => event?.type === 'result');
  if (inits.length !== 1 || results.length !== 1) throw new Error('Claudeの開始情報または最終結果が不足・重複しています。');
  const init = inits[0];
  const result = results[0];
  if (!Array.isArray(init.tools) || init.tools.some((tool) => !TOOLS.includes(tool)) ||
      !Array.isArray(init.mcp_servers) || init.mcp_servers.length !== 0) {
    throw new Error('Claudeの実行ツールが読取専用の範囲を満たしていません。');
  }
  if (init.session_id !== sessionId || result.session_id !== sessionId) throw new Error('Claudeのセッションが指定した新規セッションと一致しません。');
  if (!/^claude-opus-/.test(init.model ?? '')) throw new Error('開始情報のモデルがOpusではありません。');
  const responses = events.filter((event) => event?.type === 'assistant');
  if (responses.length === 0) throw new Error('assistantの応答がありません。');
  const responseModels = [...new Set(responses.map((event) => event.message?.model))];
  const invalidModel = responseModels.find((model) => typeof model !== 'string' || !/^claude-opus-/.test(model));
  if (responseModels.some((model) => typeof model !== 'string' || !/^claude-opus-/.test(model))) {
    throw new Error(`本体の応答にOpus以外のモデル（${invalidModel ?? '不明'}）が含まれます。`);
  }
  const models = Object.keys(result.modelUsage ?? {});
  if (!models.some((model) => /^claude-opus-/.test(model))) throw new Error('modelUsageにOpusの実行記録がありません。');
  const helperModels = models.filter((model) => !/^claude-opus-/.test(model)).map((model) => ({
    model, inputTokens: result.modelUsage[model]?.inputTokens ?? null, outputTokens: result.modelUsage[model]?.outputTokens ?? null,
  }));
  if (result.subtype !== 'success' || result.is_error !== false || typeof result.result !== 'string' || !result.result.trim()) {
    throw new Error('Claudeが工程の成功結果を返していません。');
  }
  if (!Array.isArray(result.permission_denials) || result.permission_denials.length !== 0) throw new Error('権限拒否があるか、拒否の有無を確認できませんでした。');
  return { result: result.result, models, responseModels, helperModels, tools: init.tools, mcpServers: init.mcp_servers,
    authenticationSource: init.apiKeySource ?? '不明', sessionId, permissionDenials: 0,
    durationMs: result.duration_ms ?? null, costUsd: result.total_cost_usd ?? null };
}

function git(cwd, args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8', shell: false, maxBuffer: MAX_OUTPUT });
  if (result.status !== 0) throw new Error('Gitの対象コミット・作業状態を確認できませんでした。');
  return result.stdout.trim();
}

function checkTree(cwd, head) {
  if (git(cwd, ['rev-parse', 'HEAD']) !== head) throw new Error('対象headが現在のコミットと一致しません。');
  if (git(cwd, ['status', '--porcelain', '--untracked-files=normal'])) throw new Error('未コミットの変更があります。専用worktreeで対象の変更をコミットしてください。');
}

function stopChild(child, signal) {
  if (!child.pid) return;
  try {
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore', shell: false });
    } else process.kill(-child.pid, signal);
  } catch { child.kill(signal); }
}

// レビュー依頼で上限を数える差分の部分を返す。区切り行が1組だけ、begin・endの順にない場合はnull。
// 差分の行は先頭に空白・+・-が付くため、行全体が区切りと一致するのはテンプレートの区切り行だけ。
export function extractDiff(content) {
  const lines = content.split('\n').map((line) => line.replace(/\r$/, ''));
  const begins = lines.flatMap((line, index) => (line === DIFF_BEGIN ? [index] : []));
  const ends = lines.flatMap((line, index) => (line === DIFF_END ? [index] : []));
  if (begins.length !== 1 || ends.length !== 1 || begins[0] > ends[0]) return null;
  return lines.slice(begins[0] + 1, ends[0]).join('\n');
}

// 上限はADR 0006のレビュー規則（2026-10-31 Q1）に従い、reviewでは差分だけに掛ける。
// 差分の区切りがない依頼とreview以外の工程は、安全側として依頼全体に掛ける。
export function checkRequestSize(role, content) {
  const diff = role === 'review' ? extractDiff(content) : null;
  if (diff === null) {
    if (Buffer.byteLength(content, 'utf8') > MAX_REQUEST) throw new Error('依頼ファイルが200KiBを超えています。');
  } else if (Buffer.byteLength(diff, 'utf8') > MAX_REQUEST) {
    throw new Error('依頼に貼った差分が200KiBを超えています。PRを分けてください。');
  }
}

async function invoke(cwd, prompt, args, options) {
  return new Promise((resolvePromise) => {
    const child = spawn(options.executable ?? 'claude', [...(options.prefixArgs ?? []), ...args], {
      cwd, env: { ...(options.env ?? process.env), CLAUDE_CODE_DISABLE_AUTO_MEMORY: '1' }, shell: false, detached: process.platform !== 'win32', stdio: ['pipe', 'pipe', 'pipe'],
    });
    const chunks = { stdout: [], stderr: [] };
    const sizes = { stdout: 0, stderr: 0 };
    let reason = '';
    let killTimer;
    function stop(message) {
      if (reason) return;
      reason = message;
      stopChild(child, 'SIGTERM');
      killTimer = setTimeout(() => stopChild(child, 'SIGKILL'), 5000);
    }
    const timer = setTimeout(() => stop('Claudeの実行時間が上限に達しました。'), options.timeoutMs);
    const interrupt = () => stop('Claudeの実行を中断しました。');
    process.once('SIGINT', interrupt);
    process.once('SIGTERM', interrupt);
    for (const stream of ['stdout', 'stderr']) {
      child[stream].on('data', (chunk) => {
        sizes[stream] += chunk.length;
        if (sizes[stream] > (stream === 'stdout' ? (options.maxOutputBytes ?? MAX_OUTPUT) : 64 * 1024)) {
          stop('Claudeの出力が上限に達しました。');
        } else chunks[stream].push(chunk);
      });
    }
    child.on('error', () => { reason = 'Claude Codeを起動できませんでした。既存のインストールと認証を確認してください。'; });
    child.stdin.on('error', () => {});
    child.on('close', (exitCode) => {
      clearTimeout(timer);
      clearTimeout(killTimer);
      process.removeListener('SIGINT', interrupt);
      process.removeListener('SIGTERM', interrupt);
      resolvePromise({ exitCode, reason, stdout: Buffer.concat(chunks.stdout).toString('utf8'), stderr: Buffer.concat(chunks.stderr).toString('utf8') });
    });
    child.stdin.end(prompt);
  });
}

// executable/prefixArgsと短い上限は偽プロセスによる試験用。CLIから任意の実行コマンドは渡せない。
export async function askOpus(input, options = {}) {
  const cwd = resolve(options.cwd ?? process.cwd());
  let dir;
  let execution;
  const sessionId = randomUUID();
  try {
    if (!ROLES.includes(input.role) || !/^[a-f0-9]{40}$/.test(input.head)) throw new Error('工程またはheadが不正です。');
    checkTree(cwd, input.head);
    const root = realpathSync(cwd);
    const requestRoot = realpathSync(resolve(cwd, '.loomake'));
    const request = realpathSync(resolve(cwd, input.request));
    const inside = (parent, child) => {
      const path = relative(parent, child);
      return path !== '' && path !== '..' && !path.startsWith('../') && !path.startsWith('..\\') && !isAbsolute(path);
    };
    if (!inside(root, requestRoot) || !inside(requestRoot, request)) {
      throw new Error('依頼ファイルの実パスは作業ツリーの.loomake/配下に置いてください。');
    }
    const requestStat = statSync(request);
    if (!requestStat.isFile()) throw new Error('依頼ファイルには通常ファイルを指定してください。');
    if (input.role !== 'review' && requestStat.size > MAX_REQUEST) throw new Error('依頼ファイルが200KiBを超えています。');
    const content = readFileSync(request, 'utf8');
    if (!content.trim()) throw new Error('依頼ファイルが空です。');
    checkRequestSize(input.role, content);
    const outputRoot = resolve(requestRoot, 'claude');
    let realOutputRoot;
    try { realOutputRoot = realpathSync(outputRoot); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (realOutputRoot && !inside(requestRoot, realOutputRoot)) {
      throw new Error('成果物の保存先の実パスは作業ツリーの.loomake/配下に置いてください。');
    }
    const outputDir = resolve(outputRoot, sessionId);
    const ignored = spawnSync('git', ['check-ignore', '-q', '--', outputDir], { cwd, shell: false });
    if (ignored.status === 1) throw new Error('成果物の保存先がGitの除外対象になっていません。');
    if (ignored.status !== 0) throw new Error('成果物の保存先がGitの除外対象か確認できませんでした。');
    mkdirSync(outputDir, { recursive: true, mode: 0o700 });
    dir = outputDir;
    const prompt = `担当工程: ${input.role}\n対象コミット: ${input.head}\n` +
      '最初にAGENTS.mdとdocs/dev/agent-workflow.mdを読んでください。Read/Glob/Grepだけで依頼を処理してください。計画ファイルの作成、編集、ExitPlanMode、承認・投稿はしないでください。成果物は最終メッセージの本文で返してください。\n\n' + content;
    writeFileSync(resolve(dir, 'request.md'), prompt, { mode: 0o600 });
    execution = await invoke(cwd, prompt, buildClaudeArgs(sessionId, dir), { ...options, timeoutMs: input.timeoutMs });
    writeFileSync(resolve(dir, 'events.jsonl'), execution.stdout, { mode: 0o600 });
    writeFileSync(resolve(dir, 'stderr.txt'), execution.stderr, { mode: 0o600 });
    if (execution.reason) throw new Error(execution.reason);
    if (execution.exitCode !== 0) throw new Error('Claude Codeが成功以外の終了コードを返しました。');
    checkTree(cwd, input.head);
    const evidence = evaluateEvents(execution.stdout, sessionId);
    writeFileSync(resolve(dir, 'result.md'), evidence.result, { mode: 0o600 });
    const { result: _result, ...metadata } = evidence;
    const summary = { ok: true, status: '実施済み', role: input.role, head: input.head, ...metadata, dir };
    writeFileSync(resolve(dir, 'manifest.json'), JSON.stringify({ ...summary, exitCode: 0 }, null, 2) + '\n', { mode: 0o600 });
    return summary;
  } catch (error) {
    const summary = { ok: false, status: '未実施', role: input.role, head: input.head, sessionId, dir: dir ?? null,
      reason: error instanceof Error && !error.code ? error.message : '依頼または成果物のファイルを処理できませんでした。' };
    if (dir) {
      try { writeFileSync(resolve(dir, 'manifest.json'), JSON.stringify({ ...summary, exitCode: execution?.exitCode ?? null }, null, 2) + '\n', { mode: 0o600 }); }
      catch { /* 保存先自体が使えない場合も成功として返さない。 */ }
    }
    return summary;
  }
}

async function main() {
  let input;
  try { input = parseArgs(process.argv.slice(2)); }
  catch (error) { console.log(JSON.stringify({ ok: false, status: '未実施', reason: error.message })); process.exitCode = 2; return; }
  const summary = await askOpus(input);
  console.log(JSON.stringify(summary));
  process.exitCode = summary.ok ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
