// @loomake/kit：要件書の取り込み・共通ルール・検証ゲート
export { runVerify, INTERRUPTED, TIMED_OUT } from './verify/run.js';
export type { VerifyOptions } from './verify/run.js';
export { CHANGE_ID, KNOWN_CONFIG_KEYS, assertChangeId, loadConfig, RuntimeFailure, UsageError, DEFAULT_TEST_REPORT } from './verify/config.js';
export type { LoomakeConfig } from './verify/config.js';
export { formatVerifyResult } from './verify/format.js';
export { runInit, initFiles, configJson, availableCommands, detectPackageManager } from './init/init.js';
export { findChangeDir, specFiles, toPosix } from './runtime/change-files.js';
export type { InitOptions, InitFile, PackageManager } from './init/init.js';
export { unifiedDiff } from './init/diff.js';
export { runDoctor, diagnose } from './doctor/doctor.js';
export type { DoctorCheck, DoctorLevel, DoctorOptions } from './doctor/doctor.js';
export { createInputReader, DOCUMENT_LIMITS, JSON_LIMITS } from './runtime/input.js';
export type { InputLimits, InputEntry, InputReader } from './runtime/input.js';
export { runExternal, withProcessBudget, remainingProcessTime, hasProcessBudget, ProcessLimitError, EXTERNAL_TIMEOUT_MS, EXTERNAL_OUTPUT_BYTES } from './runtime/process.js';
export type { ExternalOptions, ExternalResult, ProcessBudget, ProcessLimitKind } from './runtime/process.js';
export type { CleanupReport } from './runtime/process.js';
