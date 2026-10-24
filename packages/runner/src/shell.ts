// Windows では npm で入れたコマンドは .cmd なので、シェル経由で呼ぶ。そのときの引数の囲み方
export const isWindows = process.platform === 'win32';

/** Windows では引数を二重引用符で囲む。ほかの OS ではそのまま */
export const quote = (a: string) => (isWindows ? `"${a.replace(/"/g, '""')}"` : a);
