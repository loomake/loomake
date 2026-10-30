import { EventEmitter } from 'node:events';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import { afterEach, describe, expect, it } from 'vitest';
import { collectionSafetyStatus, diagnosticEnvironmentSignals, probeCollectionSettings, summarizeCollectionSettings } from '../scripts/claude-result-preflight.mjs';
import { inspectResultProcess, refuseUnprovedResultCollection, resultCollectionPlan, validResultCollectionPlan } from '../scripts/claude-result-collector.mjs';

const roots: string[] = [];
async function temp() { const root = await mkdtemp(join(tmpdir(), 'loomake-e3-control-')); roots.push(root); return root; }
afterEach(async () => { await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))); });
const metadata = () => ({ cli: { version: '2.1.308', nativeSha256: 'f'.repeat(64) }, case: 'success', attempt: 1 });
const raw = (fields = {}) => JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result: 'OK', ...fields });
function fake() {
  const child = new EventEmitter() as EventEmitter & { stdout: PassThrough; stderr: PassThrough; kill: (signal: string) => boolean; kills: string[] };
  child.stdout = new PassThrough(); child.stderr = new PassThrough(); child.kills = [];
  child.kill = (signal) => { child.kills.push(signal); child.emit('killed', signal); return true; };
  return child;
}

// All input in this file is synthetic. No process is spawned and no slot is collected.
describe('採集制御の限定読取と拒否', () => {
  it.each(['DEBUG', 'ANTHROPIC_LOG', 'CLAUDE_CODE_DIAGNOSTICS_FILE', 'CLAUDE_CODE_SESSION_LOG', 'OTEL_LOG_RAW_API_BODIES', 'CLAUDE_CODE_DEBUG_PRIVATE_SUFFIX'])('[REQ-340][REQ-341] 診断名は固定booleanだけを返す %s', (key) => {
    expect(diagnosticEnvironmentSignals({ [key]: 'private_marker' })).toEqual({ set: true, nonempty: true });
    expect(diagnosticEnvironmentSignals({ [key]: '' })).toEqual({ set: true, nonempty: false });
    expect(diagnosticEnvironmentSignals({ [key]: undefined })).toEqual({ set: false, nonempty: false });
    expect(JSON.stringify(diagnosticEnvironmentSignals({ [key]: 'private_marker' }))).not.toContain('private_marker');
  });
  it('[REQ-340][REQ-341] 設定のhook/plugin/env原文と名前を返さない', () => {
    const result = summarizeCollectionSettings({ hooks: { private_marker: [{ command: 'private_marker' }] }, enabledPlugins: { private_marker: true }, env: { OTEL_LOG_RAW_API_BODIES: 'private_marker' } });
    expect(result).toMatchObject({ hooksConfigured: true, pluginsConfigured: true, settingsEnvConfigured: true, diagnosticEnvironmentSet: true });
    expect(JSON.stringify(result)).not.toContain('private_marker');
  });
  it.each([null, [], 123, { env: 1 }, { hooks: [] }, { enabledPlugins: [] }, { env: { DEBUG: true } }])('[REQ-340][REQ-341] 不正な設定構造をunknownとして拒否する %j', (input) => {
    expect(summarizeCollectionSettings(input)).toMatchObject({ status: 'settings-invalid', unknownStructure: true, hooksConfigured: null });
  });
  it('[REQ-340][REQ-341] 深すぎる設定と過大node数を拒否する', () => {
    let nested: unknown = 'private_marker'; for (let i = 0; i < 40; i++) nested = { nested };
    expect(summarizeCollectionSettings({ nested }).status).toBe('settings-structure-limit');
    expect(summarizeCollectionSettings({ many: Array.from({ length: 4200 }, () => 1) }).status).toBe('settings-structure-limit');
  });
  it('[REQ-340][REQ-341] 無効pluginと空hookから設定側の固定合図だけを得る', () => {
    expect(summarizeCollectionSettings({ hooks: {}, enabledPlugins: { synthetic: false }, env: {} })).toEqual({
      status: 'settings-read', hooksConfigured: false, pluginsConfigured: false, settingsEnvConfigured: false,
      diagnosticEnvironmentSet: false, diagnosticEnvironmentNonempty: false, unknownStructure: false,
    });
    expect(summarizeCollectionSettings({ model: 'private_marker' }).unknownStructure).toBe(true);
  });
  it('[REQ-340][REQ-341] known loaderの3JSONだけを読みauthを触らない', async () => {
    const root = await temp(); const cwd = join(root, 'cwd'); const config = join(root, 'config');
    await mkdir(join(cwd, '.claude'), { recursive: true }); await mkdir(config);
    const settings = JSON.stringify({ hooks: { synthetic: [] } });
    await writeFile(join(config, 'settings.json'), settings); await writeFile(join(config, '.credentials.json'), 'private_marker');
    await writeFile(join(cwd, '.claude', 'settings.local.json'), '{}');
    const result = await probeCollectionSettings({ environment: { CLAUDE_CONFIG_DIR: config }, cwd });
    expect(result.user).toMatchObject({ status: 'settings-read', hooksConfigured: true });
    expect(result.project.status).toBe('settings-absent'); expect(result.local.status).toBe('settings-read');
    expect(await readFile(join(config, 'settings.json'), 'utf8')).toBe(settings);
    expect(JSON.stringify(result)).not.toContain(root); expect(JSON.stringify(result)).not.toContain('private_marker');
  });
  it('[REQ-340][REQ-341] 任意filenameを受けずsymlinkとサイズ超過と不正JSONを固定理由へする', async () => {
    const root = await temp(); const config = join(root, 'config'); await mkdir(config);
    await writeFile(join(root, 'private_marker'), '{}'); await symlink(join(root, 'private_marker'), join(config, 'settings.json'));
    const probe = () => probeCollectionSettings({ environment: { CLAUDE_CONFIG_DIR: config } });
    expect((await probe()).user.status).toBe('settings-symlink');
    await rm(join(config, 'settings.json')); await writeFile(join(config, 'settings.json'), 'private_marker');
    expect((await probe()).user.status).toBe('settings-invalid');
    await writeFile(join(config, 'settings.json'), 'x'.repeat(1048577));
    expect((await probe()).user.status).toBe('settings-size-limit');
  });
  it('[REQ-340][REQ-341] 読取成功や偽booleanでmanaged/state未証明を通過しない', async () => {
    const root = await temp(); await writeFile(join(root, 'settings.json'), '{}');
    const report = await refuseUnprovedResultCollection({ environment: { CLAUDE_CONFIG_DIR: root }, cwd: root });
    expect(report).toMatchObject({ outcome: 'preflight-refused', spawnAllowed: false, conversationInvocations: 0, collectedSlots: 0, requiredSlots: 4 });
    expect(report.reasonCodes).toContain('managed-policy-unproved'); expect(report.reasonCodes).toContain('cli-state-nonpersistence-unproved');
    const forged = { user: { ...summarizeCollectionSettings({}), managedPolicyAbsenceProved: true, rawAndSecretNonPersistenceProved: true } };
    expect(collectionSafetyStatus(forged, {}).spawnAllowed).toBe(false);
  });
  it.each(['success', 'error_max_turns'])('[REQ-340][REQ-341] 固定argv/promptと承認2環境だけの差分を維持する %s', (resultCase) => {
    const environment = { DEBUG: 'private_marker', AUTH_SYNTHETIC: 'private_marker' };
    const plan = resultCollectionPlan('2.1.307', resultCase, 1, environment)!;
    expect(validResultCollectionPlan(plan, environment)).toBe(true);
    expect(plan.environment).toEqual({ ...environment, DISABLE_AUTOUPDATER: '1', CLAUDE_CODE_DISABLE_AUTO_MEMORY: '1' });
    expect(plan.argv).not.toContain('--settings'); expect(plan.argv).not.toContain('--setting-sources');
    expect(plan.argv.includes('--max-turns')).toBe(resultCase === 'error_max_turns');
    expect(validResultCollectionPlan({ ...plan, argv: [...plan.argv, '--verbose'] }, environment)).toBe(false);
    expect(validResultCollectionPlan({ ...plan, environment: { DISABLE_AUTOUPDATER: '1' } }, environment)).toBe(false);
  });
  it.each([0, 3, 100])('[REQ-340][REQ-341] 最大2試行を超える計画を拒否する %i', (attempt) => {
    expect(resultCollectionPlan('2.1.308', 'success', attempt, {})).toBeUndefined();
  });
});

describe('合成processのメモリ内変換', () => {
  it('[REQ-340][REQ-341] 許可外stdout/stderrを返却fixtureへ混入せず実収集と呼ばない', async () => {
    const child = fake(); const result = inspectResultProcess(child, metadata());
    child.stdout.write(raw({ result: 'private_marker', private_marker: 'private_marker' })); child.stderr.write('private_marker'); child.emit('close', 0, null);
    const record = await result;
    expect(record).toMatchObject({ outcome: 'case-matched', collected: false, fixture: { provenance: 'derived', input: { result: 'withheld' }, stderrBytes: 14 } });
    expect(JSON.stringify(record)).not.toContain('private_marker');
  });
  it.each(['stdout', 'stderr'])('[REQ-340][REQ-341] %sの容量超過で終了を要求し本文を捨てる', async (stream) => {
    const child = fake(); const result = inspectResultProcess(child, metadata(), { stdoutLimit: 32, stderrLimit: 32 });
    child[stream as 'stdout' | 'stderr'].write('private_marker'.repeat(3)); child.emit('close', null, 'SIGTERM');
    expect(await result).toEqual({ outcome: `${stream}-limit`, collected: false }); expect(child.kills).toEqual(['SIGTERM']);
  });
  it('[REQ-340][REQ-341] 期限後SIGTERMと猶予後SIGKILLを送り固定理由だけ残す', async () => {
    const child = fake(); const result = inspectResultProcess(child, metadata(), { timeoutMs: 5, killAfterMs: 5 });
    await new Promise<void>((resolve) => { child.on('killed', (signal: string) => { if (signal === 'SIGKILL') resolve(); }); }); child.emit('close', null, 'SIGKILL');
    expect(await result).toEqual({ outcome: 'timeout', collected: false }); expect(child.kills).toEqual(['SIGTERM', 'SIGKILL']);
  });
  it('[REQ-340][REQ-341] 中断で本文を捨てる', async () => {
    const child = fake(); const controller = new AbortController(); const result = inspectResultProcess(child, metadata(), { signal: controller.signal });
    child.stdout.write('private_marker'); controller.abort(); child.emit('close', null, 'SIGTERM');
    expect(await result).toEqual({ outcome: 'interrupted', collected: false });
  });
  it('[REQ-340][REQ-341] 不正UTF8は値なしmetarecordにする', async () => {
    const child = fake(); const result = inspectResultProcess(child, metadata()); child.stdout.write(Buffer.from([0xff])); child.emit('close', 0, null);
    expect(await result).toMatchObject({ outcome: 'invalid-utf8', collected: false, fixture: { provenance: 'observed-metarecord', topLevel: 'invalid-utf8' } });
  });
  it.each([
    { body: raw(), exit: 1, outcome: 'nonzero-exit' },
    { body: raw({ permission_denials: [{ tool: 'private_marker' }] }), exit: 0, outcome: 'permission-denied' },
    { body: raw({ permission_denials: 'private_marker' }), exit: 0, outcome: 'permission-denied' },
    { body: raw({ subtype: 'error_other', is_error: true }), exit: 0, outcome: 'case-mismatch' },
    { body: 'private_marker', exit: 0, outcome: 'case-mismatch' },
  ])('[REQ-340][REQ-341] 異常またはcase不一致を実収集へ数えない $outcome', async ({ body, exit, outcome }) => {
    const child = fake(); const result = inspectResultProcess(child, metadata()); child.stdout.write(body); child.emit('close', exit, null);
    expect(await result).toEqual({ outcome, collected: false });
  });
  it('[REQ-340][REQ-341] process errorの秘密入りmessageを返さない', async () => {
    const child = fake(); const result = inspectResultProcess(child, metadata()); child.emit('error', new Error('private_marker'));
    expect(await result).toEqual({ outcome: 'spawn-failed', collected: false });
  });
});
