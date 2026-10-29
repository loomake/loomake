// quality.yaml（要件定義 7.1）を YAML として解析した値の Zod スキーマ（REQ-283・REQ-285・REQ-286）。
// packages/core/schema/quality.schema.json は、このスキーマから書き出す（REQ-287）。
// CLI の起動で zod を読まないように、@loomake/core の入口からは loadQualitySchema() で遅れて読む（REQ-284）
import { z } from 'zod';
import { QUALITY_SCHEMA_VERSION } from './quality.js';
import { preserveUnknownFields } from './preserve-unknown-fields.js';

const text = z.string().min(1);
/** 期間。正の整数と d（日）・w（週）・y（年）のどれか。例：14d、90d、5y */
const duration = z.string().regex(/^[1-9][0-9]*[dwy]$/).describe('期間。正の整数と d・w・y のどれか（例：14d、90d、5y）');
/** 目標値。比較の記号と数値の組。例：<= 1800 */
const target = z
  .string()
  .regex(/^(<=|>=|==|<|>)\s*-?[0-9]+(\.[0-9]+)?$/)
  .describe('目標値。<=・>=・==・<・> のどれかと数値の組（例：<= 1800）');
const ids = z.array(text);

export const qualityMeasureSchema = preserveUnknownFields(z.looseObject({
  metric: text.describe('指標の名前'),
  source: text.describe('指標の出どころ（ci.*、e2e.*、telemetry.*、observation.* など）'),
  target: target.optional(),
  min_samples: z.int().positive().optional(),
}));

const itemShape = {
  characteristic: text.describe('品質特性'),
  evidence: z.array(qualityMeasureSchema).default([]).describe('合格に必要な証拠'),
  indicators: z.array(qualityMeasureSchema).default([]).describe('参考指標。これだけで PASS にしない'),
  blocking: z.boolean().optional().describe('true の未達は、ほかの達成で相殺せず、公開を阻止する'),
  applicability: z.enum(['applicable', 'not_applicable']).optional(),
  reason: text.optional().describe('対象外にする理由'),
  confirmed_by: text.optional().describe('対象外を確認した人'),
  linked_requirements: ids.optional(),
};

// 対象外の必須項目を分岐で表し、JSON Schema にも同じ条件を書き出す（REQ-286・REQ-287）
function withApplicability<T extends z.ZodRawShape>(shape: T) {
  return z.discriminatedUnion('applicability', [
    z.looseObject({ ...shape, applicability: z.literal('applicable').optional() }),
    z.looseObject({ ...shape, applicability: z.literal('not_applicable'), reason: text, confirmed_by: text }),
  ]);
}

export const qualityObjectiveSchema = preserveUnknownFields(withApplicability({
  ...itemShape,
  context: text.optional().describe('対象利用者、作業、端末、環境の定義への参照'),
  task: text.optional(),
  guardrails: ids.optional().describe('悪化を防ぐ目標'),
}));

export const qualityProductSchema = preserveUnknownFields(withApplicability({
  ...itemShape,
  subcharacteristic: text.optional().describe('品質副特性'),
  objectives: ids.optional().describe('支える利用時品質目標'),
}));

// 証跡の保管方針。省いたキーには既定値を補う（REQ-285、要件定義 7.1 の最小スキーマ）
export const qualityEvidencePolicySchema = preserveUnknownFields(z.looseObject({
  artifact_retention: duration.default('90d').describe('開発中の本体に要求する保持期間'),
  long_term_store: z.enum(['github-release', 'manual']).default('github-release').describe('リリースに採用した本体の保管先'),
  long_term_retention: duration.default('5y').describe('長期保管の保持期間'),
  access: z.enum(['project-members', 'owner']).default('project-members').describe('取得確認に使う閲覧者の権限'),
  delete_policy: z.enum(['owner-approval', 'never']).default('owner-approval').describe('削除条件'),
}));

export const qualitySchema = preserveUnknownFields(z
  .looseObject({
    version: z.literal(QUALITY_SCHEMA_VERSION).describe('quality.yaml の形式の版'),
    model: text.describe('品質モデルの識別子と版（例：iso-iec-25010-2011）'),
    defaults: z
      .looseObject({
        window: duration.optional().describe('利用時の指標の比較期間'),
        min_samples: z.int().positive().optional().describe('判定に必要な最低サンプル数'),
      })
      .optional(),
    report: z
      .looseObject({
        status: z.enum(['weekly', 'daily']).optional().describe('品質状況レポートの頻度'),
        publish: z.enum(['discussion', 'issue', 'none']).optional().describe('投稿先'),
      })
      .optional(),
    objectives: z.record(z.string().regex(/^UQ-[0-9]{3,}$/), qualityObjectiveSchema).default({}).describe('利用時品質目標'),
    product: z.record(z.string().regex(/^PQ-[0-9]{3,}$/), qualityProductSchema).default({}).describe('製品品質要件'),
    automation: z
      .looseObject({
        level: z.enum(['A0', 'A1', 'A2', 'A3']).optional().describe('自動化レベル'),
        allowed_paths: z.array(z.string()).optional(),
        protected_paths: z.array(z.string()).optional(),
        max_diff_lines: z.int().nonnegative().optional(),
        require_rollback: z.boolean().optional(),
      })
      .optional()
      .describe('自動実行条件'),
    evidence: qualityEvidencePolicySchema.prefault({}).describe('証跡の保管方針'),
  })
  .meta({
    $id: 'https://loomake.dev/schema/quality.schema.json',
    title: 'Loomake quality.yaml',
    description: 'quality.yaml を YAML として解析した値。破壊的変更を入れるときは version を上げる',
  }));
