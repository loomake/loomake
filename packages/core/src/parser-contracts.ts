// Markdown 解析結果の構造のバージョン（REQ-299）。Markdown や返却データのフィールドではない。
/** traceSchema の公開初版。パッケージのバージョンとは独立する。 */
export const TRACE_SCHEMA_VERSION = '1.0.0';
/** specSchema の公開初版。パッケージのバージョンとは独立する。 */
export const SPEC_SCHEMA_VERSION = '1.0.0';
/** tasksSchema の公開初版。パッケージのバージョンとは独立する。 */
export const TASKS_SCHEMA_VERSION = '1.0.0';

/** 解析結果の Zod スキーマを、必要になったときに初めて読む。 */
export function loadParserSchemas() {
  return import('./parser-schemas.js');
}
