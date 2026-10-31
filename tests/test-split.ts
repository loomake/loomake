export type SplitPlatform = 'linux' | 'darwin' | 'win32';
export type SplitPart = 'fast' | 'slow';
export type SplitRegistry = Readonly<Record<string, {
  slow: string;
  cases: Readonly<Record<string, readonly SplitPlatform[]>>;
}>>;

// OSごとの割当は、統合後の同head・3sampleの測定を受けて追加する。
export const SPLIT_FILES: SplitRegistry = {};

const platforms = new Set<string>(['linux', 'darwin', 'win32']);

export function isPullRequestRun(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.GITHUB_ACTIONS === 'true' && env.GITHUB_EVENT_NAME === 'pull_request';
}

export function includeCase(file: string, part: SplitPart, id: string, platform: string = process.platform, registry: SplitRegistry = SPLIT_FILES): boolean {
  if (!Object.hasOwn(registry, file)) throw new Error(`分割対象のファイルが登録されていません：${file}`);
  const entry = registry[file]!;
  if (!Object.hasOwn(entry.cases, id)) throw new Error(`分割対象のケースが登録されていません：${file} ${id}`);
  const slowPlatforms = entry.cases[id]!;
  if (slowPlatforms.some((os) => !platforms.has(os))) throw new Error(`分割対象に不明なOSがあります：${file} ${id}`);
  const slow = slowPlatforms.some((os) => os === platform);
  return part === 'slow' ? slow : !slow;
}

export function filesFor(part: SplitPart, platform: string = process.platform, registry: SplitRegistry = SPLIT_FILES): { include: string[]; exclude: string[] } {
  const include: string[] = [];
  const exclude: string[] = [];
  for (const [file, entry] of Object.entries(registry)) {
    const selected = Object.keys(entry.cases).map((id) => includeCase(file, part, id, platform, registry)).some(Boolean);
    const path = part === 'slow' ? entry.slow : file;
    (selected ? include : exclude).push(path);
  }
  return { include, exclude };
}
