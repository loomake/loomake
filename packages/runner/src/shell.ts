// Windows では npm で入れたコマンドは .cmd なので、シェル経由で呼ぶ。そのときの引数の囲み方
export const isWindows = process.platform === 'win32';

/** Windows では引数を二重引用符で囲む。ほかの OS ではそのまま */
// 2 段の解釈に合わせて逃がす。CommandLineToArgvW では " は \"、直前と末尾の \ は倍にする。
// cmd /c は引用符の中でも %VAR% を展開するので % は %% にする（遅延展開の !VAR! は既定で無効）。
export const quote = (a: string) => {
  if (!isWindows) return a;
  // 連続する \ は " の直前か引数の末尾でのみ倍にする。繰り返しを持つ入力でも線形になるよう走査で処理する
  let argv = '';
  for (let i = 0; i < a.length; i++) {
    if (a[i] === '"') {
      argv += '\\"';
    } else if (a[i] === '\\') {
      let end = i;
      while (end + 1 < a.length && a[end + 1] === '\\') end++;
      const run = end - i + 1;
      argv += '\\'.repeat(end + 1 === a.length || a[end + 1] === '"' ? run * 2 : run);
      i = end;
    } else argv += a[i];
  }
  return `"${argv.replace(/%/g, '%%')}"`;
};
