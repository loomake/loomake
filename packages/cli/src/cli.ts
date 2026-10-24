#!/usr/bin/env node
import { createInterface } from 'node:readline/promises';
import { main } from './main.js';

// loomake run は SIGINT・SIGTERM・SIGHUP で、エンジンを止めて記録を書いてから止まる（REQ-124・REQ-208）。
// ほかのサブコマンドでは、ふだんどおり止まる
const controller = new AbortController();
if (process.argv[2] === 'run') for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) process.on(signal, () => controller.abort());

process.exitCode = await main(process.argv.slice(2), {
  signal: controller.signal,
  cwd: process.cwd(),
  stdout: (text) => console.log(text),
  stderr: (text) => console.error(text),
  // 型は boolean だが、端末でないときは undefined になる
  interactive: (process.stdin.isTTY as boolean | undefined) === true,
  prompt: async (question) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    try {
      return await rl.question(question);
    } finally {
      rl.close();
    }
  },
});
