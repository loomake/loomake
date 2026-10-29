import { z } from 'zod';

const structuralSchemas = new WeakMap<object, z.ZodType>();

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

// Zod がコピーした検証対象だけをたどる。未知値は同じ参照なので触らない。
function restoreOwnProto(input: unknown, output: unknown): void {
  if (input === output || !isObject(input) || !isObject(output)) return;
  for (const key of Object.keys(output)) {
    if (Object.hasOwn(input, key)) restoreOwnProto(input[key], output[key]);
  }
  if (Object.hasOwn(input, '__proto__') && !Object.hasOwn(output, '__proto__')) {
    Object.defineProperty(output, '__proto__', {
      value: input.__proto__, enumerable: true, writable: true, configurable: true,
    });
  }
}

/** 元スキーマの検証・既定値に従い、失われた未知の own property を戻す（REQ-305）。 */
export function preserveUnknownFields<S extends z.ZodType>(schema: S) {
  const inputSchema = z.custom<z.input<S>>();
  structuralSchemas.set(inputSchema, schema);
  return inputSchema.transform((input, context): z.output<S> => {
    const result = schema.safeParse(input, { reportInput: true });
    if (!result.success) {
      for (const issue of result.error.issues) context.addIssue({ ...issue });
      return z.NEVER;
    }
    restoreOwnProto(input, result.data);
    return result.data;
  });
}

/** 登録したアダプターだけを展開する。未登録の非表現型は Zod の例外に任せる。 */
export function toInputJsonSchema(schema: z.ZodType): z.core.JSONSchema.BaseSchema {
  return z.toJSONSchema(schema, {
    target: 'draft-2020-12',
    io: 'input',
    unrepresentable: ({ zodSchema }) => {
      const structural = structuralSchemas.get(zodSchema);
      if (!structural) return 'throw';
      const body = toInputJsonSchema(structural);
      delete body.$schema;
      return body;
    },
  });
}
