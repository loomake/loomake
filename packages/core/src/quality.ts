// quality.yaml の形式の版と、Zod スキーマ（quality-schema.ts）から導出した型（REQ-283・REQ-284）。
// 型は import type だけで参照するので、このファイルを読んでも zod は読まない
import type { z } from 'zod';
import type { qualityEvidencePolicySchema, qualityMeasureSchema, qualityObjectiveSchema, qualityProductSchema, qualitySchema } from './quality-schema.js';

/** core が対応する quality.yaml の形式の版。これ以外の version は拒否する */
export const QUALITY_SCHEMA_VERSION = 2;

/** 解析したあとの quality.yaml（既定値を補ったもの） */
export type Quality = z.output<typeof qualitySchema>;
/** 解析する前の quality.yaml（YAML として読んだ値） */
export type QualityInput = z.input<typeof qualitySchema>;
export type QualityMeasure = z.output<typeof qualityMeasureSchema>;
export type QualityObjective = z.output<typeof qualityObjectiveSchema>;
export type QualityProduct = z.output<typeof qualityProductSchema>;
export type QualityEvidencePolicy = z.output<typeof qualityEvidencePolicySchema>;

/** quality.yaml の Zod スキーマを読む。zod は、解析で使うときに初めて読む */
export const loadQualitySchema = () => import('./quality-schema.js');
