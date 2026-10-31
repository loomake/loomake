const FIELDS = ['type', 'subtype', 'is_error', 'result'];
const VERSIONS = ['2.1.307', '2.1.308'];
const CASES = ['success', 'error_max_turns'];
const TYPES = ['null', 'string', 'number', 'boolean', 'array', 'object'];
const DISPLAYABLE = /^error_[a-z0-9_]{1,64}$/;
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const exact = (value, required, optional = []) => object(value) && required.every((key) => Object.hasOwn(value, key)) && Object.keys(value).every((key) => required.includes(key) || optional.includes(key));
const integer = (value) => Number.isSafeInteger(value) && value >= 0;
const jsonType = (value) => value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
const literal = (field, value) => value === null || (field === 'type' ? value === 'result' : field === 'subtype' ? value === 'success' || value === 'error_max_turns' : field === 'is_error' ? typeof value === 'boolean' : value === 'OK');

function fixedValue(field, value) {
  const type = jsonType(value);
  if (type === 'null') return null;
  if (type === 'string') {
    if (field === 'subtype' && value.startsWith('error_')) return DISPLAYABLE.test(value) ? 'error_withheld' : 'error_X';
    return 'withheld';
  }
  if (type === 'number') return 0;
  if (type === 'boolean') return field === 'is_error' ? value : false;
  return type === 'array' ? [] : {};
}

function validFixed(field, value) {
  const type = jsonType(value);
  if (type === 'string') return field === 'subtype' ? ['withheld', 'error_withheld', 'error_X'].includes(value) : value === 'withheld';
  if (type === 'number') return value === 0;
  if (type === 'boolean') return value === false;
  if (type === 'array') return value.length === 0;
  return type === 'object' && Object.keys(value).length === 0;
}

function presence(value) {
  return Object.fromEntries(FIELDS.map((field) => [field, Object.hasOwn(value, field)
    ? { present: true, jsonType: jsonType(value[field]) } : { present: false }]));
}

/** Signals contain only presence/types and classification flags, never source values. */
export function resultSignals(value) {
  const topLevel = jsonType(value);
  if (!object(value)) return { topLevel };
  return {
    topLevel, fields: presence(value), isError: value.is_error === true,
    errorSubtype: typeof value.subtype === 'string' && value.subtype.startsWith('error_'),
    displayableSubtype: typeof value.subtype === 'string' && DISPLAYABLE.test(value.subtype),
  };
}

function validMetadata(value) {
  return exact(value, ['cli', 'case', 'attempt', 'exit', 'stderrBytes']) &&
    exact(value.cli, ['version', 'nativeSha256']) && VERSIONS.includes(value.cli.version) &&
    typeof value.cli.nativeSha256 === 'string' && /^[a-f0-9]{64}$/.test(value.cli.nativeSha256) &&
    CASES.includes(value.case) && [1, 2].includes(value.attempt) && integer(value.stderrBytes) && value.stderrBytes <= 65536 &&
    exact(value.exit, ['code', 'signal', 'timedOut', 'stdoutLimitHit']) &&
    (value.exit.code === null || integer(value.exit.code)) &&
    [null, 'SIGTERM', 'SIGKILL', 'SIGINT', 'SIGHUP'].includes(value.exit.signal) &&
    typeof value.exit.timedOut === 'boolean' && typeof value.exit.stdoutLimitHit === 'boolean';
}

function validFields(fields, input) {
  if (!exact(fields, FIELDS)) return false;
  return FIELDS.every((field) => {
    const description = fields[field];
    if (!object(description) || typeof description.present !== 'boolean') return false;
    if (!description.present) return exact(description, ['present']) && (input === undefined || !Object.hasOwn(input, field));
    return exact(description, ['present', 'jsonType']) && TYPES.includes(description.jsonType) &&
      (input === undefined || (Object.hasOwn(input, field) && jsonType(input[field]) === description.jsonType));
  });
}

function jsonValue(value, seen = new Set()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (!object(value) && !Array.isArray(value)) return false;
  if (seen.has(value)) return false;
  seen.add(value);
  const valid = Object.values(value).every((item) => jsonValue(item, seen));
  seen.delete(value);
  return valid;
}

/** Validate the closed storage schema, including provenance and cross-field consistency. */
export function validateResultFixture(record) {
  if (!object(record) || record.schemaVersion !== 1) return false;
  if (record.provenance === 'synthetic') return exact(record, ['schemaVersion', 'provenance', 'input']) && jsonValue(record.input);
  if (!['observed-projection', 'derived', 'observed-metarecord'].includes(record.provenance)) return false;
  const common = ['schemaVersion', 'provenance', 'cli', 'case', 'attempt', 'exit', 'stderrBytes'];
  const metadata = Object.fromEntries(['cli', 'case', 'attempt', 'exit', 'stderrBytes'].map((key) => [key, record[key]]));
  if (!validMetadata(metadata)) return false;
  if (record.provenance === 'observed-metarecord') {
    if (!exact(record, [...common, 'topLevel'], ['fields'])) return false;
    if (![...TYPES, 'invalid-json', 'invalid-utf8'].includes(record.topLevel)) return false;
    return record.topLevel === 'object' ? validFields(record.fields, undefined) : !Object.hasOwn(record, 'fields');
  }
  const derived = record.provenance === 'derived';
  if (!exact(record, [...common, 'input', 'fields', ...(derived ? ['substitutions'] : [])])) return false;
  if (!object(record.input) || Object.keys(record.input).some((key) => !FIELDS.includes(key)) || !validFields(record.fields, record.input)) return false;
  const replaced = FIELDS.filter((field) => Object.hasOwn(record.input, field) && !literal(field, record.input[field]));
  if (!derived) return replaced.length === 0;
  if (!Array.isArray(record.substitutions) || !record.substitutions.length || record.substitutions.length !== replaced.length) return false;
  const names = new Set();
  for (const entry of record.substitutions) {
    if (!exact(entry, ['field', 'jsonType']) || !replaced.includes(entry.field) || names.has(entry.field) ||
      entry.jsonType !== jsonType(record.input[entry.field]) || !validFixed(entry.field, record.input[entry.field])) return false;
    names.add(entry.field);
  }
  return names.size === replaced.length;
}

/** Project directly from original in-memory stdout; metarecords never become observed inputs. */
export function createObservedResultFixture(raw, metadata) {
  if (typeof raw !== 'string' || !validMetadata(metadata)) return undefined;
  let value;
  try { value = JSON.parse(raw); }
  catch {
    const record = { schemaVersion: 1, provenance: 'observed-metarecord', ...metadata, topLevel: 'invalid-json' };
    return validateResultFixture(record) ? record : undefined;
  }
  if (!object(value)) {
    const record = { schemaVersion: 1, provenance: 'observed-metarecord', ...metadata, topLevel: jsonType(value) };
    return validateResultFixture(record) ? record : undefined;
  }
  const input = {};
  const substitutions = [];
  for (const field of FIELDS) {
    if (!Object.hasOwn(value, field)) continue;
    if (literal(field, value[field])) input[field] = value[field];
    else {
      input[field] = fixedValue(field, value[field]);
      substitutions.push({ field, jsonType: jsonType(value[field]) });
    }
  }
  if (JSON.stringify(resultSignals(value)) !== JSON.stringify(resultSignals(input))) return undefined;
  const record = { schemaVersion: 1, provenance: substitutions.length ? 'derived' : 'observed-projection', ...metadata, input, fields: presence(value), ...(substitutions.length ? { substitutions } : {}) };
  return validateResultFixture(record) ? record : undefined;
}

/** A shape-valid fixture cannot prove the omitted collection preflight or original values. */
export function matchesResultCase(record) {
  if (!validateResultFixture(record) || !['observed-projection', 'derived'].includes(record.provenance) ||
    record.exit.code !== 0 || record.exit.signal !== null || record.exit.timedOut || record.exit.stdoutLimitHit) return false;
  const input = record.input;
  return record.case === 'success'
    ? input.subtype === 'success' && input.is_error === false && typeof input.result === 'string'
    : input.subtype === 'error_max_turns';
}
