import type { ContractKey, OriginalContract } from './original-contracts.js';
import type { CrossGroup } from './original-cross-conditions.js';

export type TestRef = { file: string; name: string };
export type AdoptionRef =
  | { trace: { change: string; id: string } }
  | { comment: { id: number; pr: number; bodySha256: string } }
  | { prBody: { pr: number; line: number; sha256: string } };
export type BaselineOwner = {
  kind: 'delta' | 'main-unchanged' | 'archived'; change?: string;
  file: string; name: string; block: string; scenarios: string[];
};
export type BaselineRow = {
  key: ContractKey;
  original: Pick<OriginalContract['original'], 'ref' | 'path' | 'line' | 'name' | 'scenarios'>;
  owners: BaselineOwner[];
  scenarioMap: {
    original: string; current: { file: string; name: string; scenario: string } | null;
    status: 'kept' | 'renamed' | 'moved' | 'superseded'; by?: AdoptionRef[];
  }[];
  supplements?: { key: ContractKey; scenario: string }[];
  supersessions?: { clause: string; by: AdoptionRef[] }[];
  open?: { clause: string; owner: 'parent-1.2' | 'parent-1.3' }[];
  adoption: AdoptionRef[];
  tests: TestRef[];
};
export type ApprovedBaseline = {
  version: 1; originalIndexSha256: string;
  counts: { contracts: 47; scenarios: 158; uniqueSources: 46; cross: 16 };
  rows: BaselineRow[];
  cross: { no: number; title: string; group: CrossGroup; rows: ContractKey[]; tests: TestRef[] }[];
};
