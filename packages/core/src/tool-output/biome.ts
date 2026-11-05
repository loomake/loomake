import type { ParseResult } from '../parse.js';
import { readJson } from './json.js';
import type { ToolFinding, ToolObservation } from './types.js';

const SEVERITIES: readonly ToolFinding['severity'][] = ['fatal', 'error', 'warning', 'info', 'hint'];

export function parseBiomeReport(file: string, text: string): ParseResult<ToolObservation | null> {
  const { reader: r, value } = readJson(file, text);
  const report = r.object(value, 'report');
  const inputSummary = r.object(report.summary, 'summary');
  const summary = {
    errors: r.integer(inputSummary.errors, 'summary.errors'),
    warnings: r.integer(inputSummary.warnings, 'summary.warnings'),
    infos: r.integer(inputSummary.infos, 'summary.infos'),
    diagnosticsNotPrinted: r.integer(inputSummary.diagnosticsNotPrinted, 'summary.diagnosticsNotPrinted'),
  };
  const findings: ToolFinding[] = [];
  for (const [i, input] of r.array(report.diagnostics, 'diagnostics').entries()) {
    const path = `diagnostics[${i}]`;
    const diagnostic = r.object(input, path);
    const severity = r.enumValue(diagnostic.severity, SEVERITIES, `${path}.severity`);
    const message = r.string(diagnostic.message, `${path}.message`);
    const category = r.optionalString(diagnostic.category, `${path}.category`);
    let file: string | null = null; let line: number | null = null; let column: number | null = null;
    if (diagnostic.location != null) {
      const locationPath = `${path}.location`;
      const location = r.object(diagnostic.location, locationPath);
      file = r.string(location.path, `${locationPath}.path`);
      const start = r.object(location.start, `${locationPath}.start`);
      const startLine = r.integer(start.line, `${locationPath}.start.line`);
      const startColumn = r.integer(start.column, `${locationPath}.start.column`);
      const end = r.object(location.end, `${locationPath}.end`);
      r.integer(end.line, `${locationPath}.end.line`);
      r.integer(end.column, `${locationPath}.end.column`);
      if ((startLine === 0) !== (startColumn === 0)) r.fail(`${locationPath}.start`);
      else if (startLine > 0) { line = startLine; column = startColumn; }
    }
    findings.push({ severity, category, message, file, line, column });
    if (r.errors.length) break;
  }
  return r.finish({ tool: 'biome', kind: 'diagnostics', findings, summary });
}
