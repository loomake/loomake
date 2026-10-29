// quality.yaml の入力 JSON Schema から、文書に必要な構造を取り出す。
const keywords = new Set([
  '$schema', '$id', 'title', 'description', 'type', 'properties', 'required', 'additionalProperties', 'propertyNames',
  'items', 'oneOf', 'default', 'const', 'enum', 'minLength', 'maxLength', 'pattern',
  'minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'multipleOf', 'minItems', 'maxItems', 'uniqueItems',
]);
const primitiveTypes = new Set(['object', 'array', 'string', 'integer', 'number', 'boolean', 'null']);
const own = (value, key) => Object.hasOwn(value, key);
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const scalarConstraints = ['minLength', 'maxLength', 'pattern', 'minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'multipleOf', 'minItems', 'maxItems', 'uniqueItems'];

function schemaObject(value, path) {
  if (!object(value)) throw new Error(`${path}: 未対応のスキーマ構造です`);
  const unsupported = Object.keys(value).filter((key) => !keywords.has(key));
  if (unsupported.length) throw new Error(`${path}: 未対応のスキーマ項目です: ${unsupported.join(', ')}`);
  if (value.type !== undefined && !primitiveTypes.has(value.type)) throw new Error(`${path}: 未対応のtypeです`);
  if (value.properties !== undefined && !object(value.properties)) throw new Error(`${path}: propertiesが不正です`);
  if (value.required !== undefined && (!Array.isArray(value.required) || !value.required.every((key) => typeof key === 'string'))) {
    throw new Error(`${path}: requiredが不正です`);
  }
  if (value.oneOf !== undefined && (!Array.isArray(value.oneOf) || !value.oneOf.length)) throw new Error(`${path}: oneOfが不正です`);
  if (value.enum !== undefined && !Array.isArray(value.enum)) throw new Error(`${path}: enumが不正です`);
  return value;
}

function constraints(schema, path) {
  const values = [];
  if (own(schema, 'const')) values.push(`const: ${JSON.stringify(schema.const)}`);
  if (schema.enum) values.push(`enum: ${schema.enum.map((value) => JSON.stringify(value)).join(', ')}`);
  for (const key of scalarConstraints) if (own(schema, key)) values.push(`${key}: ${JSON.stringify(schema[key])}`);
  if (schema.propertyNames !== undefined) {
    const names = schemaObject(schema.propertyNames, `${path}のキー`);
    const nested = ['properties', 'required', 'additionalProperties', 'propertyNames', 'items', 'oneOf'].filter((key) => own(names, key));
    if (nested.length) throw new Error(`${path}: 未対応のキー制約です: ${nested.join(', ')}`);
    const fields = [names.type && `type: ${names.type}`, ...constraints(names, `${path}のキー`), names.description];
    values.push(`キー: ${fields.filter(Boolean).join(', ') || '制約なし'}`);
  }
  if (own(schema, 'additionalProperties')) {
    const extra = schema.additionalProperties;
    if (extra === false) values.push('未定義のキーを拒否');
    else if (extra === true || (object(extra) && !Object.keys(extra).length)) values.push('未定義のキーを許可');
    else if (object(extra)) values.push('キーごとの値は下位項目を参照');
    else throw new Error(`${path}: additionalPropertiesが不正です`);
  }
  return values;
}

function branchCondition(branch, index) {
  const required = branch.required ?? [];
  const literals = Object.entries(branch.properties ?? {}).filter(([, property]) => object(property) && own(property, 'const'));
  const conditions = literals.map(([name, property]) => required.includes(name)
    ? `${name} = ${JSON.stringify(property.const)}`
    : `${name}を省略、または${JSON.stringify(property.const)}`);
  return `分岐${index + 1}${conditions.length ? `: ${conditions.join('、')}` : ''}`;
}

/** @param {unknown} input */
export function describeQualitySchema(input) {
  const rows = [];
  function visit(value, path, presence, branch) {
    const schema = schemaObject(value, path);
    rows.push({
      path, branch: branch || '共通', type: schema.type ?? (schema.oneOf ? 'oneOf' : '制約なし'), presence,
      default: own(schema, 'default') ? JSON.stringify(schema.default) : '注記なし',
      constraints: constraints(schema, path).join(' / ') || 'なし', description: schema.description ?? '説明未記載',
    });
    for (const [index, value] of (schema.oneOf ?? []).entries()) {
      const option = schemaObject(value, `${path}の分岐${index + 1}`);
      const condition = [branch, branchCondition(option, index)].filter(Boolean).join(' / ');
      visit(option, path, '分岐条件', condition);
    }
    const properties = schema.properties ?? {};
    for (const name of Object.keys(properties).sort()) {
      visit(properties[name], path === '$' ? name : `${path}.${name}`, (schema.required ?? []).includes(name) ? '必須' : '省略可', branch);
    }
    const extra = schema.additionalProperties;
    if (object(extra) && Object.keys(extra).length) visit(extra, `${path}.<id>`, 'キーごとの値', branch);
    if (schema.items !== undefined) visit(schema.items, `${path}[]`, '配列要素', branch);
  }
  visit(input, '$', '入力全体', '');
  return rows;
}

// 表とHTMLの構文にせず、改行は見える \n 表記にする。
function cell(value) {
  return String(value).replace(/\r\n|\r|\n/g, '\\n')
    .replace(/[&<>\\`*_{}[\]()#+.!|~=:"'-]/g, (char) => `&#${char.codePointAt(0)};`);
}

/** @param {unknown} schema */
export function renderQualityReference(schema) {
  const rows = describeQualitySchema(schema);
  const lines = [
    '---', 'title: quality.yaml リファレンス', 'description: 現行スキーマから生成したquality.yamlの全項目・入力条件・既定値', '---', '',
    '<!-- scripts/generate-quality-reference.mjs で生成。直接編集せず、元スキーマから再生成してください。 -->', '',
    'このページは、coreの現行スキーマから書き出した [quality.schema.json](https://github.com/loomake/loomake/blob/main/packages/core/schema/quality.schema.json) を元に生成しています。定義元は [quality-schema.ts](https://github.com/loomake/loomake/blob/main/packages/core/src/quality-schema.ts) です。', '',
    '再生成はリポジトリのルートで `node scripts/generate-quality-reference.mjs`、照合は同じコマンドに `--check` を付けて実行します。', '',
    '## 表の読み方', '',
    '`<id>` はrecordのキー、`[]` は配列要素を表します。キーの制約は親の行にあります。「必須」は、その親objectや配列要素が入力されたときの条件です。任意の親objectそのものを常に必須とする意味ではありません。', '',
    '分岐は別々に表示します。applicabilityを省略できる分岐と、not_applicableのときにreasonとconfirmed_byが必須になる分岐を区別してください。', '',
    'defaultは入力スキーマの注記です。証跡保管方針の `evidence` の親にある `{}` は、補完後も空のままという意味ではありません。親を省略すると、子の `artifact_retention` などにも下表の既定値が適用されます。default注記のない任意項目へ独自の値は補いません。', '',
    '説明のない項目は「説明未記載」と表示します。metric/sourceの名前空間や未実装の判定規則を、この表で定義するものではありません。説明中の改行は `\\n` と表記します。', '',
    '## 全項目', '',
    '| パス | 分岐 | 型 | 入力時 | default注記 | 制約 | 説明 |',
    '| --- | --- | --- | --- | --- | --- | --- |',
  ];
  for (const row of rows) lines.push(`| ${[row.path, row.branch, row.type, row.presence, row.default, row.constraints, row.description].map(cell).join(' | ')} |`);
  return `${lines.join('\n')}\n`;
}
