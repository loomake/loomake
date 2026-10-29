import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { z } from 'zod';
import { CONTRACT_SCHEMAS, renderJsonSchemas } from '../src/json-schema.js';
import { preserveUnknownFields, toInputJsonSchema } from '../src/preserve-unknown-fields.js';

describe('保持アダプターと JSON Schema', () => {
  it('[REQ-307] 配布する全 JSON のバイトを変えない', () => {
    const rendered = renderJsonSchemas();
    expect(Object.keys(rendered)).toEqual(Object.keys(CONTRACT_SCHEMAS));
    for (const [file, text] of Object.entries(rendered)) {
      expect(Buffer.from(text)).toEqual(Buffer.from(readFileSync(join(import.meta.dirname, '../schema', file), 'utf8').replace(/\r\n/g, '\n')));
    }
  });

  it('[REQ-307] 保持処理の入れ子と元の入力型・出力型・metadata を保つ', () => {
    const child = z.looseObject({ value: z.string().default('value') }).describe('child');
    const adapted = preserveUnknownFields(child);
    expectTypeOf<z.input<typeof adapted>>().toEqualTypeOf<z.input<typeof child>>();
    expectTypeOf<z.output<typeof adapted>>().toEqualTypeOf<z.output<typeof child>>();
    expect(adapted.meta()).toEqual(child.meta());
    const wrapped = preserveUnknownFields(z.looseObject({ children: z.array(adapted) }));
    const structural = z.looseObject({ children: z.array(child) });
    expect(toInputJsonSchema(wrapped)).toEqual(z.toJSONSchema(structural, { target: 'draft-2020-12', io: 'input' }));
  });

  it('[REQ-307] 未登録の custom・単体transform・入れ子custom は生成を失敗させる', () => {
    for (const schema of [
      z.custom(), z.transform((value) => value), z.looseObject({ unknown: z.custom() }),
      preserveUnknownFields(z.looseObject({ unknown: z.custom() })),
    ]) expect(() => toInputJsonSchema(schema)).toThrow(/cannot be represented in JSON Schema/);
  });

  it('[REQ-307] io:input が出力側のtransformを省く既存の規則を変えない', () => {
    const schema = z.string().transform((value) => value.length);
    expect(toInputJsonSchema(schema)).toEqual(z.toJSONSchema(schema, { target: 'draft-2020-12', io: 'input' }));
    expect(toInputJsonSchema(schema).type).toBe('string');
  });
});
