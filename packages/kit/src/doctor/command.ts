export type CommandPlan =
  | { kind: 'unsupported'; reason: string }
  | { kind: 'direct'; executable: string }
  | { kind: 'script'; executable: string; manager: 'npm' | 'pnpm' | 'yarn'; script: string };

/** シェルを実行せず、静的に確認できる単純な呼び出しだけを分類する。 */
export function classifyCommand(command: string, windows = false): CommandPlan {
  const unsupported = (reason: string): CommandPlan => ({ kind: 'unsupported', reason });
  const tokens: string[] = [];
  let token = ''; let quote = ''; let started = false;
  for (const char of command.trim()) {
    if (char === '\n' || char === '\r' || char === '\0') return unsupported('改行などを含むコマンド');
    if (quote) {
      if (char === quote) quote = '';
      else {
        if (quote === '"' && /[$`%!^]/.test(char)) return unsupported('引用内の展開を含むコマンド');
        token += char;
      }
    } else if (char === '"' || char === "'") {
      if (windows && char === "'") return unsupported('Windowsの単一引用符');
      quote = char; started = true;
    } else if (/\s/.test(char)) {
      if (started) { tokens.push(token); token = ''; started = false; }
    } else {
      if (/[;&|<>$`(){}%!*?^]/.test(char)) return unsupported('シェル構文や展開を含むコマンド');
      token += char; started = true;
    }
  }
  if (quote) return unsupported('閉じていない引用');
  if (started) tokens.push(token);
  const [executable, action, ...tail] = tokens;
  if (!executable || executable.includes('=') || executable.endsWith('\\')) return unsupported('実行ファイルを特定できないコマンド');
  if (!['npm', 'pnpm', 'yarn'].includes(executable)) return { kind: 'direct', executable };
  const manager = executable as 'npm' | 'pnpm' | 'yarn';
  if ((manager === 'npm' && ['run', 'run-script'].includes(action) && tail[0] === 'env') || (manager === 'yarn' && action === 'run-script')) return unsupported('組み込み処理や別のscriptとして解釈される呼び出し');
  const explicit = action === 'run' || action === 'run-script';
  const script = explicit ? tail[0] : action;
  const rest = explicit ? tail.slice(1) : tail;
  if (!script || !/^[a-zA-Z0-9_.:-]+$/.test(script) || script.startsWith('-')) return unsupported('scriptの対象を特定できない呼び出し');
  if (!explicit && !(manager === 'npm' ? ['test'] : ['test', 'lint', 'typecheck']).includes(script)) return unsupported('確認対象外のパッケージマネージャーの呼び出し');
  if (rest.length && rest[0] !== '--') return unsupported('対象を変える可能性のあるオプション');
  return { kind: 'script', executable, manager, script };
}
