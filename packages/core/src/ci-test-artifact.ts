import type { ParseResult } from './parse.js';
import { parseCiTestMetadata, type CiTestMetadataV1 } from './ci-test-metadata.js';
import { parseTestReport, type TestReport } from './test-report.js';

type FileText = { file: string; text: string };
export type CiTestArtifactInput = { metadata: FileText; report: FileText | null };
export type CiTestArtifact = { metadata: CiTestMetadataV1 | null; report: TestReport | null };

export function parseCiTestArtifact(input: CiTestArtifactInput): ParseResult<CiTestArtifact> {
  const metadata = parseCiTestMetadata(input.metadata.file, input.metadata.text);
  const report = input.report === null ? null : parseTestReport(input.report.file, input.report.text);
  return {
    value: { metadata: metadata.value, report: report?.errors.length === 0 ? report.value : null },
    errors: [...metadata.errors, ...(report?.errors ?? [])],
  };
}
