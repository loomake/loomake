import type { z } from 'zod';
import type { effortRecordSchema, effortMinutesSchema, effortCostSchema } from './effort-schema.js';
export const EFFORT_SCHEMA_VERSION = 1;
export type EffortRecord = z.output<typeof effortRecordSchema>;
export type EffortMinutes = z.output<typeof effortMinutesSchema>;
export type EffortCost = z.output<typeof effortCostSchema>;
/** 構造スキーマを必要時に読む。core の入口では zod を読まない。 */
export const loadEffortSchema = () => import('./effort-schema.js');
