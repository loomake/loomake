import type { ParseError, ParseResult } from '../parse.js';
import { errorLine } from '../test-report.js';
import type { ToolObservation } from './types.js';

export function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** 入力由来の値や key を診断へ入れず、最初の誤りだけを残す。 */
export class OutputReader {
  readonly errors: ParseError[] = [];
  constructor(readonly file: string, readonly line = 1) {}

  fail(path: string, message = '出力の形が違います'): void {
    if (!this.errors.length) this.errors.push({ file: this.file, line: this.line, message: `${message}：${path}` });
  }

  object(value: unknown, path: string): Record<string, unknown> {
    if (isObject(value)) return value;
    this.fail(path); return {};
  }

  array(value: unknown, path: string, optional = false): unknown[] {
    if (optional && value == null) return [];
    if (Array.isArray(value)) return value as unknown[];
    this.fail(path); return [];
  }

  string(value: unknown, path: string): string {
    if (typeof value === 'string') return value;
    this.fail(path); return '';
  }

  optionalString(value: unknown, path: string): string | null {
    return value == null ? null : this.string(value, path);
  }

  integer(value: unknown, path: string): number {
    if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return value;
    this.fail(path); return 0;
  }

  enumValue<T extends string>(value: unknown, allowed: readonly T[], path: string): T {
    const found = allowed.find((item) => item === value);
    if (found !== undefined) return found;
    this.fail(path); return allowed[0];
  }

  finish(value: ToolObservation): ParseResult<ToolObservation | null> {
    return { value: this.errors.length ? null : value, errors: this.errors };
  }
}

export function readJson(file: string, text: string, line?: number): { reader: OutputReader; value: unknown } {
  const reader = new OutputReader(file, line);
  const input = text.replace(/^\uFEFF/, '');
  if (!input.trim()) {
    reader.errors.push({ file, line: line ?? 1, message: '出力が空です' });
    return { reader, value: null };
  }
  try { return { reader, value: JSON.parse(input) as unknown }; }
  catch (error) {
    const row = line ?? errorLine(input, error instanceof Error ? error.message : '');
    reader.errors.push({ file, line: row, message: 'JSON として読めません' });
    return { reader, value: null };
  }
}
