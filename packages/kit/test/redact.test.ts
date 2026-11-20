import { describe, expect, it } from 'vitest';
import { maskSecrets, maskValue } from '../src/runtime/redact.js';
import { UsageError } from '../src/runtime/errors.js';
import * as kit from '../src/index.js';
import { maskSecrets as runnerMask, createDiagnosticRedactor as runnerDiagnostic } from '../../runner/src/mask.js';
import { createPrivateKeyFilter as runnerPrivate } from '../../runner/src/private-key-stream.js';
import { maskSecrets as runnerPublicMask } from '../../runner/src/index.js';

// 認証に使えない合成文字列だけを使う。
const token = 'ghp_' + 'x'.repeat(24);

function rejected(value: unknown): Error {
  try { maskValue(value); } catch (error) {
    expect(error).toBeInstanceOf(UsageError);
    expect((error as Error).message).not.toContain(token);
    expect((error as Error).cause).toBeUndefined();
    return error as Error;
  }
  throw new Error('対象外入力が拒否されませんでした。');
}

describe('kitとrunnerの公開元の互換性', () => {
  it('[REQ-447] 4つのnamed exportとrunnerの既存公開元が同じ関数を共有する', () => {
    expect(kit.maskValue).toBe(maskValue);
    expect(kit.maskSecrets).toBe(runnerMask);
    expect(runnerPublicMask).toBe(runnerMask);
    expect(kit.createDiagnosticRedactor).toBe(runnerDiagnostic);
    expect(kit.createPrivateKeyFilter).toBe(runnerPrivate);
  });

  it('[REQ-447] 既知の形とBearer・JSON・途中出力を従来どおり置換する', () => {
    const tokens = [
      'sk-' + 'x'.repeat(24), token, 'github_pat_' + 'x'.repeat(24), 'AKIA' + 'X'.repeat(16),
      'npm_' + 'x'.repeat(36), 'xoxb-' + 'x'.repeat(24), 'glpat-' + 'x'.repeat(24),
      'AIza' + 'x'.repeat(35), ['eyJ' + 'x'.repeat(20), 'y'.repeat(20), 'z'.repeat(20)].join('.'),
    ];
    for (const secret of tokens) {
      expect(kit.maskSecrets(`前 ${secret} 後`)).toBe('前 *** 後');
      expect(JSON.parse(kit.maskSecrets(JSON.stringify({ value: secret })))).toEqual({ value: '***' });
    }
    expect(kit.maskSecrets(`Authorization: Bearer ${'Z'.repeat(24)}`)).toBe('Authorization: Bearer ***');
    expect(JSON.parse(kit.maskSecrets('{"value":"\\u0067hp_' + 'x'.repeat(24) + '"}'))).toEqual({ value: '***' });
    const partial = JSON.stringify({ value: 'before\n' + token }).slice(0, -2);
    expect(kit.maskSecrets(partial)).not.toContain(token);
    expect(kit.maskSecrets(partial)).toContain('***');
    expect(kit.maskSecrets('npm_install と AIza、Bearerの方式')).toBe('npm_install と AIza、Bearerの方式');
  });

  it('[REQ-447] 秘密鍵と診断の全チャンク境界・長い保留・終端を維持する', () => {
    const key = '-----BEGIN PGP PRIVATE KEY BLOCK-----\nDUMMY_BODY\n-----END PGP PRIVATE KEY BLOCK-----';
    for (const create of [kit.createPrivateKeyFilter, runnerPrivate, kit.createDiagnosticRedactor, runnerDiagnostic]) {
      const text = `before ${key} after\n`;
      for (let at = 0; at <= text.length; at++) {
        const output: string[] = []; const filter = create((part) => output.push(part));
        filter.write(text.slice(0, at)); filter.write(text.slice(at)); filter.end();
        expect(output.join('')).toBe('before *** after\n');
      }
      const output: string[] = []; const filter = create((part) => output.push(part));
      filter.write('-----BEGIN PRIVATE KEY-----\nDUMMY_BODY'); filter.end();
      expect(output.join('')).toBe('***');
    }
    const output: string[] = []; const filter = kit.createDiagnosticRedactor((part) => output.push(part));
    filter.write('Q'.repeat(5000)); filter.write(' '); filter.end();
    expect(output.join('')).toBe('*** ');
  });
});

describe('共有の構造化データの置換', () => {
  it.each([null, true, false, 0, -0, 1.25, '', '通常の文'])('[REQ-447] プリミティブ %s の値と種類を保つ', (value) => {
    expect(Object.is(maskValue(value), value)).toBe(true);
  });

  it('[REQ-447] 空のArrayとobjectも新しく複製する', () => {
    for (const input of [[], {}]) {
      const result = maskValue(input);
      expect(result).toEqual(input);
      expect(result).not.toBe(input);
      expect(Object.getPrototypeOf(result)).toBe(Object.getPrototypeOf(input));
    }
  });

  it('[REQ-447] 入れ子の値とkeyを置換し、欠落とown undefinedを保つ', () => {
    const sourceList = Object.freeze([Object.freeze({ value: token, optional: undefined })]);
    const input = Object.freeze({ [token]: sourceList, absent: null });
    const output = maskValue(input);
    expect(output).toEqual({ '***': [{ value: '***', optional: undefined }], absent: null });
    expect(sourceList[0].value).toBe(token);
    expect(Object.keys(input)).toEqual([token, 'absent']);
    const nested = Object.values(output)[0] as { value: string; optional?: undefined }[];
    expect(nested).not.toBe(sourceList);
    expect(nested[0]).not.toBe(sourceList[0]);
    expect(Object.hasOwn(nested[0], 'optional')).toBe(true);
    expect(nested[0].optional).toBeUndefined();
    expect(Object.hasOwn(nested[0], 'missing')).toBe(false);
  });

  it('[REQ-447] optional undefinedをJSONへ変換せず、null・負の0と列挙順を保つ', () => {
    const input = { a: undefined, b: -0, c: null, z: 'last' };
    const output = maskValue(input);
    expect(Object.keys(output)).toEqual(['a', 'b', 'c', 'z']);
    expect(Object.is(output.b, -0)).toBe(true);
    expect(output.c).toBeNull();
    expect(Object.getOwnPropertyDescriptor(output, 'a')).toEqual({ value: undefined, enumerable: true, writable: true, configurable: true });
  });

  it.each([
    ['root undefined', undefined], ['Array undefined', [undefined]], ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY], ['-Infinity', Number.NEGATIVE_INFINITY],
    ['bigint', 1n], ['function', () => token], ['symbol', Symbol('dummy')],
    ['Date', new Date(0)], ['Map', new Map()], ['Set', new Set()],
    ['class', new class { value = token; }()],
  ])('[REQ-447] JSONの範囲外 %s を入力を引用せず拒否する', (_label, input) => {
    rejected(input);
    if (input !== undefined) rejected({ nested: input });
  });

  it('[REQ-447] getter・setter・toJSONを一度も実行しない', () => {
    let calls = 0;
    const getter = Object.defineProperty({}, 'value', { enumerable: true, get: () => { calls++; return token; } });
    const setter = Object.defineProperty({}, 'value', { enumerable: true, set: () => { calls++; } });
    const json = { toJSON: () => { calls++; return token; } };
    for (const input of [getter, setter, json]) rejected(input);
    expect(calls).toBe(0);
  });

  it('[REQ-447] symbol keyとnon-enumerableなobject propertyを捨てずに拒否する', () => {
    rejected({ [Symbol('dummy')]: token });
    rejected(Object.defineProperty({}, 'value', { value: token, enumerable: false }));
  });

  it('[REQ-447] Proxyを反射操作のtrapより前に拒否する', () => {
    let calls = 0;
    const trap = () => { calls++; throw new Error(token); };
    for (const target of [{}, []]) {
      const proxy = new Proxy(target, { get: trap, getPrototypeOf: trap, ownKeys: trap, getOwnPropertyDescriptor: trap });
      rejected(proxy);
      rejected({ child: proxy });
    }
    const revoked = Proxy.revocable({}, {});
    revoked.revoke();
    rejected(revoked.proxy);
    expect(calls).toBe(0);
  });

  it('[REQ-447] Arrayの穴・非列挙要素・accessor・追加propertyを拒否する', () => {
    const hole: unknown[] = []; hole.length = 1;
    const hidden = Object.defineProperty([token], '0', { enumerable: false });
    let getterCalls = 0;
    const accessor = Object.defineProperty([token], '0', { enumerable: true, get: () => { getterCalls++; return token; } });
    const extra = Object.assign([1], { extra: token });
    const symbol = Object.assign([1], { [Symbol('extra')]: token });
    const prototype = Object.setPrototypeOf([1], null);
    for (const input of [hole, hidden, accessor, extra, symbol, prototype]) rejected(input);
    expect(getterCalls).toBe(0);
  });

  it('[REQ-447] own __proto__・constructor・prototypeを安全なdata propertyとして複製する', () => {
    for (const prototype of [Object.prototype, null]) {
      const input = Object.create(prototype) as Record<string, unknown>;
      for (const key of ['__proto__', 'constructor', 'prototype']) {
        Object.defineProperty(input, key, { value: { value: token }, enumerable: true });
      }
      const output = maskValue(input);
      expect(Object.getPrototypeOf(output)).toBe(prototype);
      expect(Object.getPrototypeOf(input)).toBe(prototype);
      for (const key of ['__proto__', 'constructor', 'prototype']) {
        expect(Object.hasOwn(output, key)).toBe(true);
        expect(output[key]).toEqual({ value: '***' });
        expect(output[key]).not.toBe(input[key]);
        expect(Object.getOwnPropertyDescriptor(output, key)).toMatchObject({ enumerable: true, writable: true, configurable: true });
        expect(input[key]).toEqual({ value: token });
      }
    }
    expect(Object.hasOwn(Object.prototype, 'value')).toBe(false);
  });

  it('[REQ-447] 循環でない共有objectとArrayは出現ごとに独立して複製する', () => {
    const shared = { value: token }; const list = [shared];
    const input = { left: list, right: list, direct: shared };
    const output = maskValue(input);
    expect(output).toEqual({ left: [{ value: '***' }], right: [{ value: '***' }], direct: { value: '***' } });
    expect(output.left).not.toBe(list);
    expect(output.left).not.toBe(output.right);
    expect(output.left[0]).not.toBe(output.right[0]);
    expect(output.left[0]).not.toBe(output.direct);
    expect(shared.value).toBe(token);
  });

  it('[REQ-447] 自己参照とobject/Array相互参照を拒否する', () => {
    const object: Record<string, unknown> = { value: token }; object.self = object;
    const list: unknown[] = [token]; list.push(list);
    const mutual: Record<string, unknown> = { value: token }; mutual.list = [mutual];
    for (const input of [object, list, mutual]) rejected(input);
    expect(object.self).toBe(object);
    expect(list[1]).toBe(list);
  });

  it('[REQ-447] 置換後のkey衝突を拒否し、入力と値を上書きしない', () => {
    const other = 'ghp_' + 'y'.repeat(24);
    for (const input of [{ [token]: 1, [other]: 2 }, { '***': 1, [token]: 2 }]) {
      const keys = Object.keys(input); const values = Object.values(input);
      rejected(input);
      expect(Object.keys(input)).toEqual(keys);
      expect(Object.values(input)).toEqual(values);
    }
    expect(maskSecrets(token)).toBe(maskSecrets(other));
  });

  it('[REQ-447] 深い正常な入れ子をJavaScriptの再帰上限に依存せず複製する', () => {
    type Node = { child?: Node; value?: string };
    const input: Node = {}; let leaf = input;
    for (let depth = 0; depth < 20000; depth++) { leaf.child = {}; leaf = leaf.child; }
    leaf.value = token;
    let output = maskValue(input); let count = 0;
    expect(Object.is(output, input)).toBe(false);
    while (output.child) { output = output.child; count++; }
    expect(count).toBe(20000);
    expect(output.value).toBe('***');
    expect(leaf.value).toBe(token);
  });
});
