import { z } from 'zod';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

// 各 clone 自身のオブジェクトだけを戻し、record や未知値の内部は触らない。
function restoreOwnProto(input: unknown, output: unknown): void {
  if (input === output || !isObject(input) || !isObject(output)) return;
  if (Object.hasOwn(input, '__proto__') && !Object.hasOwn(output, '__proto__')) {
    Object.defineProperty(output, '__proto__', {
      value: input.__proto__, enumerable: true, writable: true, configurable: true,
    });
  }
}

/** 元スキーマの構造・検証を保ち、成功した出力の own property を復元する（REQ-307）。 */
export function preserveUnknownFields<S extends z.ZodType>(schema: S): S {
  const adapted = schema.clone();
  // Zod Core の内部 parser に依存する。版を更新するときは診断・JSON・非同期の回帰を確認する。
  // 元スキーマとライブラリは変更せず、この新しい clone の run だけを装飾する。
  const nativeRun = adapted._zod.run.bind(adapted._zod);
  adapted._zod.run = (payload, context) => {
    const input: unknown = payload.value;
    const finish = (result: typeof payload) => {
      if (result.issues.length === 0) restoreOwnProto(input, result.value);
      return result;
    };
    const result = nativeRun(payload, context);
    return result instanceof Promise ? result.then(finish) : finish(result);
  };
  return adapted;
}

/** 従来と同じ入力契約を生成し、非表現スキーマは Zod の例外に任せる。 */
export function toInputJsonSchema(schema: z.ZodType): z.core.JSONSchema.BaseSchema {
  return z.toJSONSchema(schema, { target: 'draft-2020-12', io: 'input' });
}
