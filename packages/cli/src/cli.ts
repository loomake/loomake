#!/usr/bin/env node
import { main } from './main.js';

process.exitCode = main(process.argv.slice(2), {
  cwd: process.cwd(),
  stdout: (text) => console.log(text),
  stderr: (text) => console.error(text),
});
