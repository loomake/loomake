import { Buffer } from 'node:buffer';
import { TextDecoder } from 'node:util';
import { constants } from 'node:fs';
import { lstat, open } from 'node:fs/promises';
import { homedir } from 'node:os';
import { isAbsolute, join, parse, resolve } from 'node:path';

const MAX_SETTINGS_BYTES = 1024 * 1024;
const DIAGNOSTIC_NAMES = new Set([
  'DEBUG', 'DEBUG_AUTH', 'DEBUG_CLAUDE_AGENT_SDK', 'NODE_DEBUG', 'ANTHROPIC_LOG', 'CLAUDE_DEBUG',
  'AUTOMODE_DECISION_LOG', 'CLAUDE_GATEWAY_LOG_LEVEL', 'ENABLE_ENHANCED_TELEMETRY_BETA',
  'CLAUDE_CODE_ENABLE_TELEMETRY', 'CLAUDE_CODE_ENHANCED_TELEMETRY_BETA', 'CLAUDE_CODE_PROFILE_STARTUP',
  'CLAUDE_CODE_DIAGNOSTICS_FILE', 'CLAUDE_CODE_FRAME_TIMING_LOG', 'CLAUDE_CODE_SESSION_LOG',
]);
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const diagnostics = (key) => DIAGNOSTIC_NAMES.has(key) || key.startsWith('OTEL_') || key.startsWith('CLAUDE_CODE_DEBUG') || key.startsWith('CLAUDE_CODE_OTEL_');

/** Values and dynamic variable names never leave this function. Presence is not proof of activation. */
export function diagnosticEnvironmentSignals(environment) {
  let set = false, nonempty = false;
  for (const key of Object.keys(environment)) {
    if (!diagnostics(key) || environment[key] === undefined) continue;
    set = true;
    if (String(environment[key]).length > 0) nonempty = true;
  }
  return { set, nonempty };
}

const unknown = (reason) => ({
  status: reason, hooksConfigured: null, pluginsConfigured: null, settingsEnvConfigured: null,
  diagnosticEnvironmentSet: null, diagnosticEnvironmentNonempty: null, unknownStructure: true,
});

/** Inspect only a non-auth settings JSON object. Never return keys, values, paths or parse errors. */
export function summarizeCollectionSettings(value) {
  if (!object(value)) return unknown('settings-invalid');
  let nodes = 0;
  const bounded = (entry, depth) => {
    if (++nodes > 4096 || depth > 32) return false;
    return entry === null || typeof entry !== 'object' || Object.values(entry).every((child) => bounded(child, depth + 1));
  };
  if (!bounded(value, 0)) return unknown('settings-structure-limit');
  const hooks = value.hooks;
  const plugins = value.enabledPlugins;
  const env = value.env;
  const malformed = (hooks !== undefined && !object(hooks)) || (plugins !== undefined && !object(plugins)) ||
    (env !== undefined && (!object(env) || Object.values(env).some((item) => typeof item !== 'string')));
  if (malformed) return unknown('settings-invalid');
  const d = diagnosticEnvironmentSignals(env ?? {});
  return {
    status: 'settings-read', hooksConfigured: hooks !== undefined && Object.keys(hooks).length > 0,
    pluginsConfigured: plugins !== undefined && Object.values(plugins).some((item) => item !== false),
    settingsEnvConfigured: env !== undefined && Object.keys(env).length > 0,
    diagnosticEnvironmentSet: d.set, diagnosticEnvironmentNonempty: d.nonempty,
    // Only these three structures are interpreted. All other keys keep the preflight conservative.
    unknownStructure: Object.keys(value).some((key) => !['$schema', 'hooks', 'enabledPlugins', 'env'].includes(key)),
  };
}

async function noSymlinkComponents(target) {
  const absolute = resolve(target);
  let current = parse(absolute).root;
  for (const component of absolute.slice(current.length).split(/[\\/]/).filter(Boolean)) {
    current = join(current, component);
    try { if ((await lstat(current)).isSymbolicLink()) return false; }
    catch (error) { if (error?.code === 'ENOENT') return true; throw error; }
  }
  return true;
}

async function readSettings(target) {
  let handle;
  try {
    if (!(await noSymlinkComponents(target))) return unknown('settings-symlink');
    const before = await lstat(target);
    if (!before.isFile()) return unknown('settings-not-file');
    if (before.size > MAX_SETTINGS_BYTES) return unknown('settings-size-limit');
    handle = await open(target, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const after = await handle.stat();
    if (!after.isFile() || before.dev !== after.dev || before.ino !== after.ino) return unknown('settings-changed');
    const bytes = Buffer.alloc(MAX_SETTINGS_BYTES + 1);
    let count = 0;
    while (count < bytes.length) {
      const read = await handle.read(bytes, count, bytes.length - count, null);
      if (read.bytesRead === 0) break;
      count += read.bytesRead;
    }
    if (count > MAX_SETTINGS_BYTES) return unknown('settings-size-limit');
    let value;
    try { value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, count))); }
    catch { return unknown('settings-invalid'); }
    return summarizeCollectionSettings(value);
  } catch (error) {
    return error?.code === 'ENOENT'
      ? { ...summarizeCollectionSettings({}), status: 'settings-absent' }
      : unknown('settings-unreadable');
  } finally { if (handle) await handle.close().catch(() => {}); }
}

/**
 * Probe three paths from native nK/K_n/FT only; parent/managed/flag/plugin sources remain unproved.
 * @param {{ environment?: NodeJS.ProcessEnv, cwd?: string }} [options]
 */
export async function probeCollectionSettings({ environment = process.env, cwd } = {}) {
  try {
    const configDir = environment.CLAUDE_CONFIG_DIR ?? join(homedir(), '.claude');
    if (typeof configDir !== 'string' || !isAbsolute(configDir) || (cwd !== undefined && !isAbsolute(cwd))) {
      return { user: unknown('settings-source-unknown'), project: unknown('settings-source-unknown'), local: unknown('settings-source-unknown') };
    }
    const user = await readSettings(join(configDir.normalize('NFC'), 'settings.json'));
    // An omitted cwd is unknown, never an assertion that project/local sources are absent.
    const project = cwd === undefined ? unknown('settings-source-unknown') : await readSettings(join(cwd, '.claude', 'settings.json'));
    const local = cwd === undefined ? unknown('settings-source-unknown') : await readSettings(join(cwd, '.claude', 'settings.local.json'));
    return { user, project, local };
  } catch {
    return { user: unknown('settings-unreadable'), project: unknown('settings-unreadable'), local: unknown('settings-unreadable') };
  }
}

/** A settings read cannot establish managed-policy, plugin-code or CLI-state non-persistence. */
export function collectionSafetyStatus(settings, environment) {
  const reasons = new Set(['settings-source-coverage-unproved', 'managed-policy-unproved', 'cli-state-nonpersistence-unproved', 'plugin-code-unproved']);
  for (const scope of ['user', 'project', 'local']) {
    const entry = settings?.[scope];
    if (!entry || !['settings-read', 'settings-absent'].includes(entry.status)) reasons.add('settings-unproved');
    if (entry?.hooksConfigured !== false) reasons.add('hook-safety-unproved');
    if (entry?.pluginsConfigured !== false) reasons.add('plugin-safety-unproved');
    if (entry?.settingsEnvConfigured !== false || entry?.unknownStructure !== false) reasons.add('settings-effects-unproved');
    if (entry?.diagnosticEnvironmentSet !== false) reasons.add('diagnostics-unproved');
  }
  if (diagnosticEnvironmentSignals(environment).set) reasons.add('diagnostics-unproved');
  // These unresolved controls have no proof adapter yet. Self-asserted evidence cannot enable spawn.
  return { outcome: 'preflight-refused', spawnAllowed: false, reasonCodes: [...reasons] };
}
