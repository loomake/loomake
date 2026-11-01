import { canonicalJson, isSafeRepoPath } from './canonical.js';
import type { GitDocument } from './git-objects.js';

export const ORIGINAL_C001_SNAPSHOT_DIR = 'scripts/trusted/original-c001/specs' as const;
// 原文書そのものと別に、Aから構築したコードへ全14件の固定値を置く。
const documents = [
  {
    "file": "openspec/changes/verify-v2-c001/specs/cli/spec.md",
    "bytes": 3407,
    "sha256": "3120c21f84577edd4fa226bb5ad6146d508254a7ee4a0f786bdb56c9459197ce",
    "blob": "6f105eaa5293bf7c767fa45150f1a23c0bd5d57b",
    "copy": "scripts/trusted/original-c001/specs/cli/spec.md"
  },
  {
    "file": "openspec/changes/verify-v2-c001/specs/core-parsers/spec.md",
    "bytes": 14771,
    "sha256": "da531b680a9a905e9e79c1822a07230897e9e307d998f7c46f4de02136f7f28c",
    "blob": "5a8fca9c4155b20dfda64823b03f1e1f6283d204",
    "copy": "scripts/trusted/original-c001/specs/core-parsers/spec.md"
  },
  {
    "file": "openspec/changes/verify-v2-c001/specs/external-process-budget/spec.md",
    "bytes": 938,
    "sha256": "fc808ddfb32f4d74e6d8ef63a77f963adbfda8347a80e03f35d6f21c7d415eae",
    "blob": "0058256fc024577c334925cecc57b2a1d4ce1be0",
    "copy": "scripts/trusted/original-c001/specs/external-process-budget/spec.md"
  },
  {
    "file": "openspec/changes/verify-v2-c001/specs/monorepo/spec.md",
    "bytes": 1191,
    "sha256": "9aa09ff34a0b892dd3139c205a4bc5dbc7f1b1014e13e68649eeece6f4ab8812",
    "blob": "3dcee4e871d07379b3c8257432479c4b57d2ddd2",
    "copy": "scripts/trusted/original-c001/specs/monorepo/spec.md"
  },
  {
    "file": "openspec/changes/verify-v2-c001/specs/reference-docs/spec.md",
    "bytes": 6141,
    "sha256": "e916ddabb3b816eda5b05b96a274d2ec86dacbb8dfd6cefef436cf75022d43e0",
    "blob": "9f50bb673b2e6962be27af8748b794cbbdd335db",
    "copy": "scripts/trusted/original-c001/specs/reference-docs/spec.md"
  },
  {
    "file": "openspec/changes/verify-v2-c001/specs/req-to-openspec-skill/spec.md",
    "bytes": 799,
    "sha256": "61341f80649db27293aa31fcba717ff4ce1a98732e19db1c0a866ca85eea5611",
    "blob": "f2372b679a6608c1ac2ad8e4d9baf1284c5c1c42",
    "copy": "scripts/trusted/original-c001/specs/req-to-openspec-skill/spec.md"
  },
  {
    "file": "openspec/changes/verify-v2-c001/specs/run-decision-policy/spec.md",
    "bytes": 5464,
    "sha256": "496184fdaea191ad8749c61e6cbf62e5c38b48a57021f503dcd22d43a797bfa9",
    "blob": "1df4e26eb1f4a9cddf3d7bb5118d26fc035bb950",
    "copy": "scripts/trusted/original-c001/specs/run-decision-policy/spec.md"
  },
  {
    "file": "openspec/changes/verify-v2-c001/specs/run-pr/spec.md",
    "bytes": 2995,
    "sha256": "c06867128048dabacb9512821b34f93aea426d489e1cc0a8d79e585083732a26",
    "blob": "72bd40d840db66e440536d0006ff1e82ea5b4533",
    "copy": "scripts/trusted/original-c001/specs/run-pr/spec.md"
  },
  {
    "file": "openspec/changes/verify-v2-c001/specs/run/spec.md",
    "bytes": 6517,
    "sha256": "4310328532c3b9e4bb69f17cad17a3a83e883b67dfc412742f92e3783c1097f0",
    "blob": "da44332f0b4a8d83b4052dd3b76233d3b3e7107e",
    "copy": "scripts/trusted/original-c001/specs/run/spec.md"
  },
  {
    "file": "openspec/changes/verify-v2-c001/specs/trace-agreement/spec.md",
    "bytes": 825,
    "sha256": "fd72276df143ed838e46f41e22d22c430cfb1d806b6e63d767e70039bcad4327",
    "blob": "7ce95e4941b87fe56c498b19cad7d332749d1084",
    "copy": "scripts/trusted/original-c001/specs/trace-agreement/spec.md"
  },
  {
    "file": "openspec/changes/verify-v2-c001/specs/trace-record/spec.md",
    "bytes": 4117,
    "sha256": "94e365e9c8901e891813ccbfbca0645d39f59ad774e1e665c9b1dae5bec443a2",
    "blob": "5fa05239bd542e46027c5d1b419cf9883414c5fc",
    "copy": "scripts/trusted/original-c001/specs/trace-record/spec.md"
  },
  {
    "file": "openspec/changes/verify-v2-c001/specs/trace-report/spec.md",
    "bytes": 3915,
    "sha256": "9f787bf619136e05929da8025e1d7bb814cc929d73ef85095c41347074fa1808",
    "blob": "56d2d79e5cd78c43e26da355e1c8bef1b402c859",
    "copy": "scripts/trusted/original-c001/specs/trace-report/spec.md"
  },
  {
    "file": "openspec/changes/verify-v2-c001/specs/verification-policy/spec.md",
    "bytes": 5026,
    "sha256": "4d1232f9b0f935ca83a57a6e93dc8e2e67633fa63e24b38115ed87be24df93df",
    "blob": "8dd913e46ecf18e01d5b143c8bd999c6df9e799a",
    "copy": "scripts/trusted/original-c001/specs/verification-policy/spec.md"
  },
  {
    "file": "openspec/changes/verify-v2-c001/specs/verify/spec.md",
    "bytes": 22257,
    "sha256": "b258709d2c29be9b5eb82cd161b9252eca6a093c40a73c7120fb294a8dd0b46e",
    "blob": "c0e8dc662954f727c26f6de08c1abbdf29e2869c",
    "copy": "scripts/trusted/original-c001/specs/verify/spec.md"
  }
] as const;
export const ORIGINAL_C001_DOCUMENTS = Object.freeze(documents.map((document) => Object.freeze(document)));

export function originalDocumentsDigest(sha256Hex: (text: string) => string): string {
  return `sha256:${sha256Hex(canonicalJson(ORIGINAL_C001_DOCUMENTS))}`;
}

/** AのGit objectを全バイトで照合し、歴史的な論理pathへ写す。来歴の暗号学的証明ではない。 */
export function verifyOriginalSnapshot(files: readonly GitDocument[], sha256Hex: (text: string) => string):
  { documents: { file: string; text: string }[] | null; problems: string[] } {
  const expected = new Map(ORIGINAL_C001_DOCUMENTS.map((document) => [document.copy as string, document]));
  const seen = new Set<string>();
  const output: { file: string; text: string }[] = [];
  const problems: string[] = [];
  for (const file of files) {
    if (!isSafeRepoPath(file.file) || !file.file.startsWith(`${ORIGINAL_C001_SNAPSHOT_DIR}/`)) {
      problems.push(`原文書のpathが不正です：${file.file}`); continue;
    }
    if (seen.has(file.file)) { problems.push(`原文書のpathが重複しています：${file.file}`); continue; }
    seen.add(file.file);
    const document = expected.get(file.file);
    if (!document) { problems.push(`原文書に未知のファイルがあります：${file.file}`); continue; }
    if (file.mode !== '100644' || file.oid !== document.blob
      || new TextEncoder().encode(file.text).length !== document.bytes || sha256Hex(file.text) !== document.sha256) {
      problems.push(`原文書の全バイト・mode・blobが一致しません：${file.file}`); continue;
    }
    output.push({ file: document.file, text: file.text });
  }
  if (seen.size !== expected.size || [...expected.keys()].some((file) => !seen.has(file))) problems.push('原文書14件の集合が一致しません');
  if (problems.length) return { documents: null, problems };
  output.sort((a, b) => a.file < b.file ? -1 : a.file > b.file ? 1 : 0);
  return { documents: output, problems };
}
