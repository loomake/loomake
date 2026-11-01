import { canonicalJson } from './canonical.js';
import { originalDocumentsDigest } from './original-snapshot.js';
import { ORIGINAL_C001_REF, reconstructOriginalContracts, type ContractKey, type OriginalContract } from './original-contracts.js';

export type CrossGroup = 'G1' | 'G2' | 'G3' | 'G4';
export type OriginalCrossCondition = { no: number; title: string; group: CrossGroup; rows: ContractKey[] };
export type OriginalScope = {
  version: 1; ref: typeof ORIGINAL_C001_REF; documents: string;
  counts: { contracts: number; scenarios: number; uniqueSources: number; cross: number };
  contracts: OriginalContract[]; cross: OriginalCrossCondition[]; sha256: string;
};

// 原47契約と16条件の対応索引。旧PR割当てを現在のownerへ流用しない。
const groups: Record<CrossGroup, readonly ContractKey[]> = {
  "G1": [
    "cli/modified/REQ-135",
    "cli/modified/REQ-194",
    "cli/modified/REQ-041",
    "core-parsers/modified/REQ-274",
    "core-parsers/modified/REQ-302",
    "core-parsers/modified/REQ-303",
    "core-parsers/modified/REQ-304",
    "core-parsers/modified/REQ-275",
    "core-parsers/modified/REQ-276",
    "core-parsers/modified/REQ-305",
    "core-parsers/modified/REQ-307",
    "core-parsers/added/REQ-308",
    "core-parsers/added/REQ-309",
    "external-process-budget/modified/REQ-183",
    "monorepo/added/REQ-318",
    "reference-docs/modified/REQ-322",
    "reference-docs/modified/REQ-323",
    "reference-docs/modified/REQ-324",
    "req-to-openspec-skill/modified/REQ-136"
  ],
  "G2": [
    "run/modified/REQ-164",
    "run/modified/REQ-100",
    "run/modified/REQ-093",
    "run-decision-policy/modified/REQ-205",
    "run-decision-policy/added/REQ-317",
    "run-pr/modified/REQ-114",
    "run-pr/modified/REQ-115",
    "trace-agreement/modified/REQ-203",
    "trace-record/added/REQ-315",
    "verify/added/REQ-311"
  ],
  "G3": [
    "trace-record/modified/REQ-066",
    "trace-record/added/REQ-315",
    "trace-report/modified/REQ-073",
    "trace-report/added/REQ-316"
  ],
  "G4": [
    "core-parsers/added/REQ-309",
    "monorepo/added/REQ-318",
    "trace-record/added/REQ-315",
    "verification-policy/modified/REQ-306",
    "verification-policy/added/REQ-313",
    "verification-policy/added/REQ-314",
    "verify/modified/REQ-036",
    "verify/modified/REQ-037",
    "verify/modified/REQ-042",
    "verify/modified/REQ-038",
    "verify/modified/REQ-039",
    "verify/modified/REQ-191",
    "verify/modified/REQ-040",
    "verify/modified/REQ-041",
    "verify/modified/REQ-050",
    "verify/added/REQ-310",
    "verify/added/REQ-311",
    "verify/added/REQ-312",
    "verify/added/REQ-319"
  ]
};
const conditions: readonly { no: number; title: string; group: CrossGroup }[] = [
  {
    "no": 1,
    "title": "具体別承認/生成基準/過去回答",
    "group": "G1"
  },
  {
    "no": 2,
    "title": "正常旧証拠/破損と記録",
    "group": "G2"
  },
  {
    "no": 3,
    "title": "構造NAと品質NA/guard",
    "group": "G4"
  },
  {
    "no": 4,
    "title": "bare/scopeとusage境界",
    "group": "G4"
  },
  {
    "no": 5,
    "title": "scopeとtrace記録",
    "group": "G4"
  },
  {
    "no": 6,
    "title": "独立S1/実証跡/受入",
    "group": "G4"
  },
  {
    "no": 7,
    "title": "typed観測と純粋判断",
    "group": "G2"
  },
  {
    "no": 8,
    "title": "正常local完了/停止とrunner射影",
    "group": "G2"
  },
  {
    "no": 9,
    "title": "REQ205とREQ-105保持",
    "group": "G2"
  },
  {
    "no": 10,
    "title": "REQ205とREQ-124保持",
    "group": "G2"
  },
  {
    "no": 11,
    "title": "REQ205とREQ-182保持",
    "group": "G2"
  },
  {
    "no": 12,
    "title": "NoChangeとlocal再gate",
    "group": "G2"
  },
  {
    "no": 13,
    "title": "REQ205とREQ-204保持",
    "group": "G2"
  },
  {
    "no": 14,
    "title": "REQ205とREQ-208保持",
    "group": "G2"
  },
  {
    "no": 15,
    "title": "REQ205とREQ-250保持",
    "group": "G2"
  },
  {
    "no": 16,
    "title": "REQ205とREQ-337保持",
    "group": "G2"
  }
];

/** 原契約の実体と、基準側に固定した元の横断条件を一つの索引へ結ぶ。 */
export function reconstructOriginalScope(files: readonly { file: string; text: string }[], sha256Hex: (text: string) => string):
  { scope: OriginalScope | null; problems: string[] } {
  const result = reconstructOriginalContracts(files, sha256Hex);
  if (!result.index) return { scope: null, problems: result.problems };
  const keys = new Set(result.index.contracts.map((row) => row.key));
  const referenced = new Set(Object.values(groups).flat());
  if (keys.size !== referenced.size || [...referenced].some((key) => !keys.has(key))) {
    return { scope: null, problems: ['原横断条件と原契約の集合が一致しません'] };
  }
  const cross = conditions.map((condition) => ({ ...condition, rows: [...groups[condition.group]] }));
  const body = { version: 1 as const, ref: ORIGINAL_C001_REF, documents: originalDocumentsDigest(sha256Hex),
    counts: { ...result.index.counts, cross: cross.length }, contracts: result.index.contracts, cross };
  return { scope: { ...body, sha256: `sha256:${sha256Hex(canonicalJson(body))}` }, problems: [] };
}
