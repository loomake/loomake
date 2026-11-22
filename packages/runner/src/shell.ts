// Windows では npm で入れたコマンドは .cmd なので、シェル経由で呼ぶ。そのときの引数の囲み方
export const isWindows = process.platform === 'win32';

/** Windows では引数を二重引用符で囲む。ほかの OS ではそのまま */
// 2 段の解釈に合わせて逃がす。CommandLineToArgvW では " は \"、直前と末尾の \ は倍にする。
// cmd /c は引用符の中でも %VAR% を展開するので % は %% にする（遅延展開の !VAR! は既定で無効）。
export const quote = (a: string) => {
  if (!isWindows) return a;
  const argv = a.replace(/(\\*)("|$)/g, (_m, bs: string, ch: string) => bs + bs + (ch === '"' ? '\\"' : ''));
  return `"${argv.replace(/%/g, '%%')}"`;
};
