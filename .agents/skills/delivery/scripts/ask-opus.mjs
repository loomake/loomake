import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { closeSync, fsyncSync, mkdirSync, openSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { basename, isAbsolute, relative, resolve } from 'node:path';
import { StringDecoder } from 'node:string_decoder';
import { pathToFileURL } from 'node:url';

const ROLES = ['design', 'second-opinion', 'review'];
const TOOLS = ['Read', 'Glob', 'Grep'];
const MAX_OUTPUT = 8 * 1024 * 1024;
const MAX_REQUEST = 200 * 1024;
const MAX_FILE = 1024 * 1024;
const DIFF_BEGIN = '<!-- ask-opus:diff-begin -->';
const DIFF_END = '<!-- ask-opus:diff-end -->';

export function parseArgs(args) {
  const values = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i];
    if (!['--role', '--request', '--head', '--timeout-min', '--prior'].includes(key) || values[key] !== undefined || !args[i + 1]) {
      throw new Error('引数が不正です。--role、--request、--head、必要なら --timeout-min を指定してください。');
    }
    values[key] = args[i + 1];
  }
  const timeoutMin = Number(values['--timeout-min'] ?? '20');
  if (!ROLES.includes(values['--role']) || !values['--request'] || !/^[a-f0-9]{40}$/.test(values['--head'] ?? '') ||
      !Number.isInteger(timeoutMin) || timeoutMin < 1 || timeoutMin > 60) {
    throw new Error('工程・依頼ファイル・40桁のhead・1〜60分の上限を指定してください。');
  }
  if (values['--prior'] !== undefined && values['--role'] !== 'second-opinion') throw new Error('--priorはsecond-opinionだけに指定できます。');
  return { role: values['--role'], request: values['--request'], head: values['--head'], timeoutMs: timeoutMin * 60_000,
    ...(values['--prior'] !== undefined ? { prior: values['--prior'] } : {}) };
}

export function buildClaudeArgs(sessionId, requestDir, prior = false) {
  const args = ['--print', '--model', 'opus', '--permission-mode', 'plan',
    '--tools', TOOLS.join(','), '--allowedTools', 'Read(./**)',
    '--setting-sources', '', '--settings', '{"disableAllHooks":true,"autoMemoryEnabled":false,"permissions":{"blockReadsOutsideWorkingDirectories":true}}',
    '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}',
    '--no-session-persistence', '--session-id', sessionId,
    '--add-dir', requestDir, '--output-format', 'stream-json', '--verbose'];
  if (prior) {
    const index = args.indexOf('--settings') + 1;
    const settings = JSON.parse(args[index]);
    settings.permissions.deny = ['Read(./.loomake/prior/**)'];
    args[index] = JSON.stringify(settings);
    args.push('--input-format', 'stream-json');
  }
  return args;
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

function priorEvents(raw, sessionId) {
  let events;
  try { events = raw.trim().split('\n').map((line) => JSON.parse(line)); }
  catch { throw new Error('Claudeの応答をJSONとして読めませんでした。'); }
  if (events.some((event) => event?.session_id !== undefined && event.session_id !== sessionId)) {
    throw new Error('Claudeのセッションが指定した新規セッションと一致しません。');
  }
  return events;
}

function rejectPriorAccess(events, prior, cwd) {
  const markers = ['.loomake/prior', basename(prior)];
  const calls = new Map();
  for (const event of events) {
    for (const block of event?.message?.content ?? []) {
      if (block?.type !== 'tool_use' && block?.type !== 'tool_result') continue;
      if (block.type === 'tool_use' && typeof block.id === 'string') calls.set(block.id, block);
      if (block.type === 'tool_use' && block.name === 'Read' && typeof block.input?.file_path === 'string') {
        let target = resolve(cwd, block.input.file_path);
        try { target = realpathSync(target); } catch { /* 存在しないRead対象も字面で確認する。 */ }
        const path = target.replaceAll('\\', '/');
        if (target === prior || path.includes('/.loomake/prior/') || path.endsWith('/.loomake/prior')) {
          throw new Error('独立見解の保存前に先行仮説を参照しました。');
        }
        continue;
      }
      const source = block.type === 'tool_result' ? calls.get(block.tool_use_id) : undefined;
      // 許可された別ファイルのRead本文にある使用例は、仮説ファイルの参照とは区別する。
      if (source?.name === 'Read' && typeof source.input?.file_path === 'string') continue;
      const value = JSON.stringify(block.type === 'tool_use' ? block.input : block.content).replaceAll('\\\\', '/');
      if (markers.some((marker) => value.includes(marker))) throw new Error('独立見解の保存前に先行仮説を参照しました。');
    }
  }
}

function evaluatePriorPhase(events, sessionId) {
  const evidence = evaluateEvents(events.map((event) => JSON.stringify(event)).join('\n'), sessionId);
  const init = events.findIndex((event) => event?.type === 'system' && event.subtype === 'init');
  const assistant = events.findIndex((event) => event?.type === 'assistant');
  if (init > assistant) throw new Error('Claudeの開始情報より前に応答があります。');
  return evidence;
}

export function evaluatePriorEvents(raw, sessionId) {
  const events = priorEvents(raw, sessionId);
  const ends = events.flatMap((event, index) => event?.type === 'result' ? [index] : []);
  if (ends.length !== 2) throw new Error('Claudeの2段階の最終結果が不足・重複しています。');
  const first = evaluatePriorPhase(events.slice(0, ends[0] + 1), sessionId);
  const second = evaluatePriorPhase(events.slice(ends[0] + 1), sessionId);
  const inits = events.filter((event) => event?.type === 'system' && event.subtype === 'init');
  if (inits[0].model !== inits[1].model ||
      JSON.stringify([...first.responseModels].sort()) !== JSON.stringify([...second.responseModels].sort()) ||
      JSON.stringify([...first.tools].sort()) !== JSON.stringify([...second.tools].sort())) {
    throw new Error('Claudeの2段階でモデルまたは実行ツールが変わりました。');
  }
  return { ...second, independentResult: first.result, turns: 2 };
}

function saveIndependentView(dir, content, sync = fsyncSync) {
  const fd = openSync(resolve(dir, 'independent-view.md'), 'wx', 0o600);
  try { writeFileSync(fd, content, 'utf8'); sync(fd); }
  finally { closeSync(fd); }
  if (process.platform !== 'win32') {
    const directory = openSync(dir, 'r');
    try { sync(directory); }
    finally { closeSync(directory); }
  }
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
// 区切り行の判定にだけ行末の\rを外し、返す差分は元の文字列（begin行の次の行の先頭から、end行の直前の改行の前まで）とする。
export function extractDiff(content) {
  const starts = [0];
  for (let index = content.indexOf('\n'); index !== -1; index = content.indexOf('\n', index + 1)) starts.push(index + 1);
  const lineAt = (index) => content.slice(starts[index], index + 1 < starts.length ? starts[index + 1] - 1 : content.length).replace(/\r$/, '');
  const begins = [];
  const ends = [];
  for (let index = 0; index < starts.length; index += 1) {
    const line = lineAt(index);
    if (line === DIFF_BEGIN) begins.push(index);
    if (line === DIFF_END) ends.push(index);
  }
  if (begins.length !== 1 || ends.length !== 1 || begins[0] > ends[0]) return null;
  if (ends[0] === begins[0] + 1) return '';
  return content.slice(starts[begins[0] + 1], starts[ends[0]] - 1).replace(/\r$/, '');
}

// 上限はADR 0006のレビュー規則（2026-10-31 Q1）に従い、reviewでは差分だけに掛ける。
// 差分の区切りがない依頼とreview以外の工程は、安全側として依頼全体に掛ける。
// 別に、全工程で読む前に依頼全体へ1MiBの安全弁を掛ける（差分を区切り行の外に貼る抜け道への天井）。
export function checkRequestSize(role, content) {
  // 読む前のファイルサイズに加え、読んだ内容にも1MiBを掛ける（不正なUTF-8の置換で大きくなる場合を含む）。
  if (Buffer.byteLength(content, 'utf8') > MAX_FILE) throw new Error('依頼ファイルが1MiBを超えています。');
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
    const decoder = new StringDecoder('utf8');
    let pending = '';
    const phase = [];
    let results = 0;
    function receive(text) {
      pending += text;
      let index;
      while ((index = pending.indexOf('\n')) !== -1 && !reason) {
        const line = pending.slice(0, index);
        pending = pending.slice(index + 1);
        if (!line.trim()) continue;
        let event;
        try { event = JSON.parse(line); }
        catch { stop('Claudeの応答をJSONとして読めませんでした。'); return; }
        try {
          phase.push(event);
          if (event?.type === 'result') {
            results += 1;
            if (results === 1) {
              const next = prompt.onFirstResult(phase.map((item) => JSON.stringify(item)).join('\n'));
              if (!reason) child.stdin.end(JSON.stringify({ type: 'user', message: { role: 'user', content: next } }) + '\n');
            } else if (results > 2) throw new Error('Claudeの2段階の最終結果が不足・重複しています。');
          }
        } catch (error) { stop(error.code ? '独立見解を保存できませんでした。' : error.message); }
      }
    }
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
        } else {
          chunks[stream].push(chunk);
          if (stream === 'stdout' && typeof prompt !== 'string' && !reason) receive(decoder.write(chunk));
        }
      });
    }
    child.on('error', () => { reason = 'Claude Codeを起動できませんでした。既存のインストールと認証を確認してください。'; });
    child.stdin.on('error', () => { if (typeof prompt !== 'string') stop('Claudeへ先行仮説を送信できませんでした。'); });
    child.on('close', (exitCode) => {
      clearTimeout(timer);
      clearTimeout(killTimer);
      process.removeListener('SIGINT', interrupt);
      process.removeListener('SIGTERM', interrupt);
      resolvePromise({ exitCode, reason, stdout: Buffer.concat(chunks.stdout).toString('utf8'), stderr: Buffer.concat(chunks.stderr).toString('utf8') });
    });
    if (typeof prompt === 'string') child.stdin.end(prompt);
    else child.stdin.write(JSON.stringify({ type: 'user', message: { role: 'user', content: prompt.first } }) + '\n');
  });
}

// executable/prefixArgs・短い上限・syncIndependentViewは偽プロセスや保存失敗による試験用。CLIからは指定できない。
export async function askOpus(input, options = {}) {
  const cwd = resolve(options.cwd ?? process.cwd());
  let dir;
  let execution;
  const sessionId = randomUUID();
  try {
    if (!ROLES.includes(input.role) || !/^[a-f0-9]{40}$/.test(input.head)) throw new Error('工程またはheadが不正です。');
    if (input.prior !== undefined && input.role !== 'second-opinion') throw new Error('--priorはsecond-opinionだけに指定できます。');
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
    if (requestStat.size > MAX_FILE) throw new Error('依頼ファイルが1MiBを超えています。');
    if (input.role !== 'review' && requestStat.size > MAX_REQUEST) throw new Error('依頼ファイルが200KiBを超えています。');
    const content = readFileSync(request, 'utf8');
    if (!content.trim()) throw new Error('依頼ファイルが空です。');
    checkRequestSize(input.role, content);
    let prior;
    let priorContent;
    if (input.prior !== undefined) {
      prior = realpathSync(resolve(cwd, input.prior));
      const priorRoot = realpathSync(resolve(requestRoot, 'prior'));
      if (!inside(requestRoot, priorRoot) || !inside(priorRoot, prior) || prior === request) {
        throw new Error('先行仮説は依頼とは別の.loomake/prior/配下の通常ファイルにしてください。');
      }
      const priorStat = statSync(prior);
      if (!priorStat.isFile()) throw new Error('先行仮説には通常ファイルを指定してください。');
      if (priorStat.size > MAX_REQUEST) throw new Error('先行仮説が200KiBを超えています。');
      priorContent = readFileSync(prior, 'utf8');
      if (!priorContent.trim()) throw new Error('先行仮説が空です。');
      if (Buffer.byteLength(priorContent, 'utf8') > MAX_REQUEST) throw new Error('先行仮説が200KiBを超えています。');
    }
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
    let prompt = `担当工程: ${input.role}\n対象コミット: ${input.head}\n` +
      '最初にAGENTS.mdとdocs/dev/agent-workflow.mdを読んでください。Read/Glob/Grepだけで依頼を処理してください。計画ファイルの作成、編集、ExitPlanMode、承認・投稿はしないでください。成果物は最終メッセージの本文で返してください。\n\n' + content;
    writeFileSync(resolve(dir, 'request.md'), prompt, { mode: 0o600 });
    let independentViewSavedAt;
    let priorSentAt;
    if (prior) {
      prompt += '\n先行仮説はまだ渡していません。.loomake/prior/は読まず、検索・一覧にも含めないでください。このターンでは独立見解だけを最終メッセージで返してください。比較と設計は次の入力後に行います。';
      writeFileSync(resolve(dir, 'request.md'), prompt, { mode: 0o600 });
    }
    const invocation = prior ? {
      first: prompt,
      onFirstResult: (raw) => {
        const events = priorEvents(raw, sessionId);
        const first = evaluatePriorPhase(events, sessionId);
        rejectPriorAccess(events, prior, cwd);
        checkTree(cwd, input.head);
        try { saveIndependentView(dir, first.result, options.syncIndependentView); }
        catch { throw new Error('独立見解を保存できませんでした。'); }
        independentViewSavedAt = new Date().toISOString();
        priorSentAt = new Date().toISOString();
        return '独立見解の保存が完了しました。以下は先行担当の仮説です。ファイルから読み直さず、独立見解との合意点・相違点・相違を見分ける検証を比較し、原因と修正方針を設計してください。\n\n' + priorContent;
      },
    } : prompt;
    execution = await invoke(cwd, invocation, buildClaudeArgs(sessionId, dir, Boolean(prior)), { ...options, timeoutMs: input.timeoutMs });
    writeFileSync(resolve(dir, 'events.jsonl'), execution.stdout, { mode: 0o600 });
    writeFileSync(resolve(dir, 'stderr.txt'), execution.stderr, { mode: 0o600 });
    if (execution.reason) throw new Error(execution.reason);
    if (execution.exitCode !== 0) throw new Error('Claude Codeが成功以外の終了コードを返しました。');
    checkTree(cwd, input.head);
    const evidence = prior ? evaluatePriorEvents(execution.stdout, sessionId) : evaluateEvents(execution.stdout, sessionId);
    if (prior) {
      if (!independentViewSavedAt || readFileSync(resolve(dir, 'independent-view.md'), 'utf8') !== evidence.independentResult) {
        throw new Error('独立見解の保存が確認できませんでした。');
      }
      delete evidence.independentResult;
      Object.assign(evidence, { independentViewSavedAt, priorSentAt });
    }
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
