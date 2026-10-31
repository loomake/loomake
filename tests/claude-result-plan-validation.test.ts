import { describe, expect, it } from 'vitest';
import { resultCollectionPlan, validResultCollectionPlan } from '../scripts/claude-result-collector.mjs';

const controls = { DISABLE_AUTOUPDATER: '1', CLAUDE_CODE_DISABLE_AUTO_MEMORY: '1' };
const make = (environment: NodeJS.ProcessEnv = {}) => resultCollectionPlan('2.1.307', 'success', 1, environment)!;
const planKeys = ['version', 'case', 'attempt', 'nativeSha256', 'argv', 'prompt', 'note', 'environment'];

// Synthetic plan data only. No environment is sent to a process or written to evidence.
describe('採集planのownキーと文字列の検証', () => {
  it.each([undefined, null, [], 1])('照合元environmentの非辞書%sを暗黙の既定環境へ代用しない', (environment) => {
    expect(validResultCollectionPlan(make(), environment)).toBe(false);
  });

  it('undefinedキーを別名へ置き換えて件数を保つ旧経路を拒否する', () => {
    const caller = { K: undefined };
    const forged = { ...make(), environment: { ...controls, J: 'synthetic' } };
    expect(validResultCollectionPlan(forged, caller)).toBe(false);
    expect(resultCollectionPlan('2.1.307', 'success', 1, caller)).toBeUndefined();
  });

  it('同じ値がprototypeにあっても期待するownキーの代用にしない', () => {
    const caller = { K: 'synthetic' };
    const environment = Object.assign(Object.create({ K: 'synthetic' }) as Record<string, string>, controls, { J: 'other' });
    expect(Object.keys(environment).length).toBe(Object.keys(make(caller).environment).length);
    expect(Object.hasOwn(environment, 'K')).toBe(false);
    expect(validResultCollectionPlan({ ...make(caller), environment }, caller)).toBe(false);
  });

  it.each(['cwd', 'shell', 'raw'])('最上位の許可外キー%sを拒否する', (key) => {
    expect(validResultCollectionPlan({ ...make(), [key]: 'private_marker' }, {})).toBe(false);
  });

  it('最上位のsymbolや非enumerableの余分なキーも拒否する', () => {
    expect(validResultCollectionPlan({ ...make(), [Symbol('synthetic')]: true }, {})).toBe(false);
    const plan = Object.defineProperty({ ...make() }, 'cwd', { value: 'private_marker' });
    expect(validResultCollectionPlan(plan, {})).toBe(false);
  });

  it.each(planKeys)('最上位の%sをprototypeへ移してもownキーとして認めない', (key) => {
    const plan = { ...make() } as Record<string, unknown>;
    const value = plan[key]; delete plan[key]; Object.setPrototypeOf(plan, { [key]: value });
    expect(Object.hasOwn(plan, key)).toBe(false);
    expect(validResultCollectionPlan(plan, {})).toBe(false);
  });

  it.each([undefined, null, 1, false, {}, []])('文字列以外の環境値%sを生成と照合の両方で拒否する', (value) => {
    const environment = { K: value } as unknown as NodeJS.ProcessEnv;
    expect(resultCollectionPlan('2.1.307', 'success', 1, environment)).toBeUndefined();
    expect(validResultCollectionPlan({ ...make(), environment: { ...controls, K: value } }, environment)).toBe(false);
  });

  it('許可する環境の追加と削除を両方拒否する', () => {
    const caller = { K: 'synthetic' }, plan = make(caller);
    expect(validResultCollectionPlan({ ...plan, environment: { ...plan.environment, EXTRA: 'synthetic' } }, caller)).toBe(false);
    expect(validResultCollectionPlan({ ...plan, environment: { ...controls } }, caller)).toBe(false);
  });

  it('null prototypeの文字列辞書と空文字列を保持する', () => {
    const caller = Object.assign(Object.create(null) as Record<string, string>, { K: '' });
    const plan = make(caller);
    expect(plan.environment).toEqual({ K: '', ...controls });
    expect(validResultCollectionPlan(plan, caller)).toBe(true);
  });
});

describe('返却planのコピーと凍結', () => {
  it.each(['2.1.307', '2.1.308'])('%sの両case・両attemptが通り変更できない', (version) => {
    for (const resultCase of ['success', 'error_max_turns']) for (const attempt of [1, 2]) {
      const caller = { SYNTHETIC: 'kept', DISABLE_AUTOUPDATER: 'caller-value' };
      const plan = resultCollectionPlan(version, resultCase, attempt, caller)!;
      expect(Reflect.ownKeys(plan).sort()).toEqual([...planKeys].sort());
      expect(validResultCollectionPlan(plan, caller)).toBe(true);
      expect(Object.isFrozen(plan)).toBe(true); expect(Object.isFrozen(plan.argv)).toBe(true); expect(Object.isFrozen(plan.environment)).toBe(true);
      expect(plan.environment).not.toBe(caller); expect(Object.isFrozen(caller)).toBe(false);
      expect(Reflect.set(plan, 'prompt', 'private_marker')).toBe(false);
      expect(Reflect.set(plan.argv, '0', 'private_marker')).toBe(false);
      expect(Reflect.set(plan.environment, 'SYNTHETIC', 'private_marker')).toBe(false);
      expect(caller).toEqual({ SYNTHETIC: 'kept', DISABLE_AUTOUPDATER: 'caller-value' });
      caller.SYNTHETIC = 'changed';
      expect(plan.environment.SYNTHETIC).toBe('kept');
      expect(validResultCollectionPlan(plan, { SYNTHETIC: 'kept', DISABLE_AUTOUPDATER: 'caller-value' })).toBe(true);
    }
  });

  it('別々のplanでargv/environmentを共有しない', () => {
    const a = make(), b = make();
    expect(a.argv).not.toBe(b.argv); expect(a.environment).not.toBe(b.environment);
    expect(a.argv).toEqual(b.argv); expect(a.environment).toEqual(b.environment);
  });
});
