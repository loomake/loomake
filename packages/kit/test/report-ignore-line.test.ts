import { it, expect } from 'vitest';
import { reportIgnoreLine } from '../src/verify/config.js';

it('[REQ-426] quotes literal backslashes before quoting gitignore patterns', () => {
  expect(reportIgnoreLine(String.raw`a\b*?[x].json`)).toBe(String.raw`/a\\b\*\?\[x].json`);
  expect(reportIgnoreLine(String.raw`a\*.json`)).toBe(String.raw`/a\\\*.json`);
  expect(reportIgnoreLine(String.raw`dir/a\b.json`)).toBe(String.raw`dir/a\\b.json`);
});
