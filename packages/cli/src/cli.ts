#!/usr/bin/env node
import { createInterface } from 'node:readline/promises';
import { main } from './main.js';

// loomake run は SIGINT・SIGTERM・SIGHUP で、エンジンを止めて記録を書いてから止まる（REQ-124・REQ-208）。
// 2 回目は記録を待たず終了する。初回HUPから100ms未満の同HUPだけは重複として数えない（REQ-427）。
// ほかのサブコマンドでは、ふだんどおり止まる
const controller = new AbortController();
if (process.argv[2] === 'run') {
  const exitCodes = { SIGINT: 130, SIGTERM: 143, SIGHUP: 129 } as const;
  let firstSignal: 'SIGINT' | 'SIGTERM' | 'SIGHUP' | undefined;
  let firstAt = 0n;
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) process.on(signal, () => {
    const now = process.hrtime.bigint();
    if (firstSignal === undefined) {
      firstSignal = signal;
      firstAt = now;
      controller.abort();
      return;
    }
    if (firstSignal === 'SIGHUP' && signal === 'SIGHUP' && now - firstAt < 100_000_000n) return;
    process.exit(exitCodes[signal]);
  });
}

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
