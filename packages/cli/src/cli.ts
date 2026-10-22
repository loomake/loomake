#!/usr/bin/env node
import { createInterface } from 'node:readline/promises';
import { main } from './main.js';

process.exitCode = await main(process.argv.slice(2), {
  cwd: process.cwd(),
  stdout: (text) => console.log(text),
  stderr: (text) => console.error(text),
  interactive: Boolean(process.stdin.isTTY),
  prompt: async (question) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    try {
      return await rl.question(question);
    } finally {
      rl.close();
    }
  },
});
