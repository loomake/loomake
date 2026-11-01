/** 私的な基準の JSON。配列の順序を保ち、object の key だけを辞書順にする。 */
export function canonicalJson(value: unknown): string {
  const ancestors = new Set<object>();
  const encode = (item: unknown): string => {
    if (item === null || typeof item === 'string' || typeof item === 'boolean') return JSON.stringify(item);
    if (typeof item === 'number' && Number.isFinite(item)) return JSON.stringify(item);
    if (typeof item !== 'object') throw new Error('基準には JSON の値だけを使用してください');
    if (ancestors.has(item)) throw new Error('基準に循環する参照は使用できません');
    ancestors.add(item);
    try {
      if (Array.isArray(item)) {
        if (Reflect.ownKeys(item).length !== item.length + 1) throw new Error('基準の配列に追加の property は使用できません');
        const entries: string[] = [];
        for (let i = 0; i < item.length; i++) {
          const property = Object.getOwnPropertyDescriptor(item, String(i));
          if (!property) throw new Error('基準の配列に空の要素は使用できません');
          if (!('value' in property)) throw new Error('基準の配列に getter は使用できません');
          entries.push(encode(property.value));
        }
        return `[${entries.join(',')}]`;
      }
      if (Object.getPrototypeOf(item) !== Object.prototype && Object.getPrototypeOf(item) !== null) {
        throw new Error('基準には JSON の object だけを使用してください');
      }
      if (Reflect.ownKeys(item).some((key) => typeof key !== 'string' || !Object.getOwnPropertyDescriptor(item, key)?.enumerable)) {
        throw new Error('基準の object に JSON から落ちる property は使用できません');
      }
      return `{${Object.keys(item).sort().map((key) => {
        const property = Object.getOwnPropertyDescriptor(item, key);
        if (!property || !('value' in property)) throw new Error('基準に getter は使用できません');
        return `${JSON.stringify(key)}:${encode(property.value)}`;
      }).join(',')}}`;
    } finally { ancestors.delete(item); }
  };
  return encode(value);
}

/** Git の repository 相対 path。正規化によって危険な入力を隠さない。 */
export function isSafeRepoPath(file: string): boolean {
  for (let i = 0; i < file.length; i++) {
    const code = file.charCodeAt(i);
    if (code < 32 || code === 127) return false;
  }
  return file.length > 0 && !/[\\:]/.test(file)
    && file.split('/').every((part) => part !== '' && part !== '.' && part !== '..' && part.toLowerCase() !== '.git');
}
