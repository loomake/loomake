import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_TEST_REPORT } from '../verify/config.js';
import { unifiedDiff } from './diff.js';

// kit の templates/。src/init/ から読んでも dist/init/ から読んでも 2 つ上にある
const TEMPLATES = fileURLToPath(new URL('../../templates/', import.meta.url));
const SKILL = 'req-to-openspec';

export type PackageManager = 'pnpm' | 'npm' | 'yarn';

export type InitOptions = {
  root: string;
  /** Skill を .agents/skills/ にも置く（REQ-021） */
  codex?: boolean;
  /** .devcontainer/devcontainer.json を置く（REQ-022） */
  devcontainer?: boolean;
  /** 確認を受け付けられるか（標準入力が TTY か）。false のとき同名ファイルがあれば中止する（REQ-020） */
  interactive: boolean;
  /** 質問を出し、承諾されたら true を返す */
  confirm: (question: string) => Promise<boolean>;
  stdout: (text: string) => void;
};

/** 置くファイル。path はプロジェクトのルートからの / 区切りのパス */
export type InitFile = { path: string; content: string };

const toPosix = (p: string) => p.split(sep).join('/');
// 改行コード（CRLF と LF）だけの違いは、同じ内容とみなす
const lf = (t: string) => t.replace(/\r\n/g, '\n');

const listFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? listFiles(join(dir, e.name)) : [join(dir, e.name)]))
    .sort();

const readJson = (p: string): unknown => {
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    return undefined;
  }
};

/** package.json の packageManager、なければロックファイルで判定し、どれも無ければ npm */
export function detectPackageManager(root: string): PackageManager {
  const pkg = readJson(join(root, 'package.json'));
  const field = typeof pkg === 'object' && pkg !== null ? (pkg as { packageManager?: unknown }).packageManager : undefined;
  const name = typeof field === 'string' ? field.split('@')[0] : '';
  if (name === 'pnpm' || name === 'npm' || name === 'yarn') return name;
  if (existsSync(join(root, 'pnpm-lock.yaml'))) return 'pnpm';
  if (existsSync(join(root, 'yarn.lock'))) return 'yarn';
  return 'npm';
}

const COMMANDS: Record<PackageManager, Record<string, string>> = {
  pnpm: { lint: 'pnpm lint', typecheck: 'pnpm typecheck', test: 'pnpm test' },
  npm: { lint: 'npm run lint', typecheck: 'npm run typecheck', test: 'npm test' },
  yarn: { lint: 'yarn lint', typecheck: 'yarn typecheck', test: 'yarn test' },
};

const INSTALL: Record<PackageManager, string> = {
  pnpm: 'pnpm add -D loomake',
  npm: 'npm install -D loomake',
  yarn: 'yarn add -D loomake',
};

/** package.json の dependencies か devDependencies に loomake があるか */
function hasLoomake(root: string): boolean {
  const pkg = readJson(join(root, 'package.json'));
  if (typeof pkg !== 'object' || pkg === null) return false;
  const { dependencies, devDependencies } = pkg as { dependencies?: unknown; devDependencies?: unknown };
  return [dependencies, devDependencies].some((d) => typeof d === 'object' && d !== null && 'loomake' in d);
}

type Manifest = { scripts?: unknown; dependencies?: unknown; devDependencies?: unknown };
const manifest = (root: string): Manifest | undefined => {
  const pkg = readJson(join(root, 'package.json'));
  return typeof pkg === 'object' && pkg !== null && !Array.isArray(pkg) ? pkg : undefined;
};

/**
 * commands に書く品質コマンドの名前（REQ-196）。package.json に scripts があれば、空でない script がある名前だけ。
 * scripts がなければ有無を判断できないので、3 つとも書く
 */
export function availableCommands(root: string): string[] {
  const scripts = manifest(root)?.scripts;
  const names = Object.keys(COMMANDS.npm);
  if (typeof scripts !== 'object' || scripts === null || Array.isArray(scripts)) return names;
  return names.filter((n) => typeof (scripts as Record<string, unknown>)[n] === 'string' && (scripts as Record<string, string>)[n].trim() !== '');
}

/** 依存にあるテストランナー（REQ-197） */
function testRunners(root: string): { vitest: boolean; jest: boolean } {
  const pkg = manifest(root);
  const has = (name: string) => [pkg?.dependencies, pkg?.devDependencies].some((d) => typeof d === 'object' && d !== null && name in d);
  return { vitest: has('vitest'), jest: has('jest') };
}

/** init が置く loomake.config.json の中身。names を省くと 3 つのコマンドを書く */
export function configJson(pm: PackageManager, names: readonly string[] = Object.keys(COMMANDS[pm])): string {
  const config = {
    $comment: 'Loomake の検証設定。AI は人の承認なしにここを緩めないこと（AGENTS.md 4章）',
    openspecDir: 'openspec',
    openspecValidate: 'auto',
    // verify はテストランナーがこのファイルに書き出した JSON レポートを読む
    tests: { report: DEFAULT_TEST_REPORT },
    commands: Object.fromEntries(Object.entries(COMMANDS[pm]).filter(([n]) => names.includes(n))),
  };
  return `${JSON.stringify(config, null, 2)}\n`;
}

/** init が置くファイルの一覧（REQ-019・REQ-021・REQ-022） */
export function initFiles(options: Pick<InitOptions, 'root' | 'codex' | 'devcontainer'>): InitFile[] {
  const template = (p: string) => readFileSync(join(TEMPLATES, p), 'utf8');
  const skillDir = join(TEMPLATES, 'skills', SKILL);
  const skill = (base: string) =>
    listFiles(skillDir).map((f) => ({ path: `${base}/${SKILL}/${toPosix(relative(skillDir, f))}`, content: readFileSync(f, 'utf8') }));
  return [
    { path: 'AGENTS.md', content: template('AGENTS.md') },
    { path: 'CLAUDE.md', content: template('CLAUDE.md') },
    { path: 'loomake.config.json', content: configJson(detectPackageManager(options.root), availableCommands(options.root)) },
    ...skill('.claude/skills'),
    ...(options.codex ? skill('.agents/skills') : []),
    ...(options.devcontainer ? [{ path: '.devcontainer/devcontainer.json', content: template('devcontainer/devcontainer.json') }] : []),
  ];
}

/** テストのレポートの設定例。使っているテストランナーが分かれば、その例だけにする（REQ-197） */
function reportExamples(root: string): string[] {
  const { vitest, jest } = testRunners(root);
  const both = vitest === jest;
  return [
    `テストランナーが、テストの結果を JSON で ${DEFAULT_TEST_REPORT} に書き出すよう設定してください。loomake verify はこのファイルで要件ごとのテストを確かめます。`,
    ...(both || vitest ? ['  Vitest（vitest.config.ts）:', `    test: { reporters: ['default', 'json'], outputFile: { json: '${DEFAULT_TEST_REPORT}' } }`] : []),
    ...(both || jest ? ['  Jest（package.json の test スクリプト）:', `    jest --json --outputFile=${DEFAULT_TEST_REPORT}`] : []),
  ];
}

/**
 * .gitignore に path の行を足し、init の結果に出す 1 行を返す（REQ-133）。
 * 既存の行は変えない。前後の空白と先頭の / を除いて同じ行があれば足さない
 */
function ensureIgnored(root: string, path: string): string {
  const p = join(root, '.gitignore');
  if (!existsSync(p)) {
    writeFileSync(p, `${path}\n`);
    return `作成：.gitignore（${path}）`;
  }
  const text = readFileSync(p, 'utf8');
  if (text.split(/\r?\n/).some((l) => l.trim().replace(/^\//, '') === path)) return '変更なし：.gitignore';
  writeFileSync(p, `${text}${text === '' || text.endsWith('\n') ? '' : '\n'}${path}\n`);
  return `追記：.gitignore（${path}）`;
}

const isSymlink = (p: string) => {
  try {
    return lstatSync(p).isSymbolicLink();
  } catch {
    return false;
  }
};

/**
 * 置き先が承諾なしに読み書きしてはいけない場所かを調べ、理由を返す。
 * 途中のディレクトリも含めて、リンク先の無いリンクと、リンクを通ってプロジェクトの外を指すものを拒む
 */
function unsafeTarget(root: string, path: string): string | null {
  const parts = path.split('/');
  let existing = root;
  for (let i = 0; i < parts.length; i++) {
    const p = join(root, ...parts.slice(0, i + 1));
    if (existsSync(p)) existing = p;
    else if (isSymlink(p)) return `${parts.slice(0, i + 1).join('/')} はリンク先の無いシンボリックリンクです`;
    else break;
  }
  const inside = relative(realpathSync(root), realpathSync(existing));
  if (inside === '..' || inside.startsWith(`..${sep}`) || isAbsolute(inside)) return `${path} はシンボリックリンクを通ってプロジェクトの外を指しています`;
  return null;
}

/** AGENTS.md・CLAUDE.md・loomake.config.json・Skill を置く。終了コード（成功 0・中止 1）を返す */
export async function runInit(options: InitOptions): Promise<number> {
  const { root, stdout } = options;
  const files = initFiles(options);
  // プロジェクトの外を読み書きしないよう、既存ファイルを読む前に調べ、1 つでもあれば何も置かずに中止する
  const unsafe = [...files.map((f) => f.path), '.gitignore'].map((p) => unsafeTarget(root, p)).filter((r): r is string => r !== null);
  if (unsafe.length) {
    stdout(unsafe.join('\n'));
    stdout('プロジェクトの外のファイルを読み書きしないよう、どのファイルも置かずに中止しました。シンボリックリンクを外すか、プロジェクトの中を指すように直してください。');
    return 1;
  }
  const status = files.map((f) => {
    const p = join(root, f.path);
    if (!existsSync(p)) return 'new' as const;
    return lf(readFileSync(p, 'utf8')) === lf(f.content) ? ('same' as const) : ('differs' as const);
  });
  const conflicts = files.filter((_, i) => status[i] === 'differs');
  const showDiff = (f: InitFile) => stdout(unifiedDiff(f.path, readFileSync(join(root, f.path), 'utf8'), f.content));

  // 確認できない環境では、一部だけ置かれた状態を避けるため何も置かない（Q-06 の回答）
  if (conflicts.length && !options.interactive) {
    for (const f of conflicts) showDiff(f);
    stdout(`\n同名で内容の異なるファイルが ${conflicts.length} 個あります：${conflicts.map((f) => f.path).join('、')}`);
    stdout('確認を受け付けられない環境なので、どのファイルも置かずに中止しました。端末から loomake init を実行し、上書きするかを答えてください。');
    return 1;
  }

  const overwrite = new Set<string>();
  for (const f of conflicts) {
    showDiff(f);
    if (await options.confirm(`${f.path} を上書きしますか [y/N] `)) overwrite.add(f.path);
  }

  const lines: string[] = [];
  files.forEach((f, i) => {
    if (status[i] === 'same') return lines.push(`  変更なし：${f.path}`);
    if (status[i] === 'differs' && !overwrite.has(f.path)) return lines.push(`  上書きしなかった：${f.path}`);
    const p = join(root, f.path);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, f.content);
    lines.push(`  ${status[i] === 'new' ? '作成' : '上書き'}：${f.path}`);
  });
  // テストのレポートを git の追跡から外す。証拠の置き場（.loomake/evidence/）はコミットするので除外しない（REQ-133）。
  // 実行ログの置き場は、loomake run が自分で除外する
  const config = readJson(join(root, 'loomake.config.json')) as { tests?: { report?: unknown } } | undefined;
  const report = typeof config?.tests?.report === 'string' ? config.tests.report.replace(/^\.\//, '') : DEFAULT_TEST_REPORT;
  lines.push(`  ${ensureIgnored(root, report)}`);
  stdout(['', 'loomake init の結果:', ...lines].join('\n'));

  if (!existsSync(join(root, 'openspec'))) {
    stdout('\nopenspec/ がありません。OpenSpec の仕様と change を置くために、openspec init を実行してください。');
  }
  stdout(`\n${reportExamples(root).join('\n')}`);

  // scripts にない品質コマンドは commands に書かなかったので、足すときの手順を示す（REQ-196）
  const available = availableCommands(root);
  const missing = Object.keys(COMMANDS.npm).filter((n) => !available.includes(n));
  const wroteConfig = lines.some((l) => /^ {2}(作成|上書き)：loomake\.config\.json$/.test(l));
  if (missing.length && wroteConfig) {
    stdout(`\npackage.json の scripts に ${missing.join('・')} がないので、loomake.config.json の commands に書きませんでした。script を足したら、commands にも書いてください。`);
  }

  // package.json がなければ commands は npm の既定値のままなので、書き換えを促す
  if (!existsSync(join(root, 'package.json'))) {
    stdout('\npackage.json がありません。loomake.config.json の commands（lint・typecheck・test）を、このプロジェクトで使うコマンドに書き換えてください。');
  }
  // 検査に使う版を固定するため、プロジェクトに入れるよう促す。package.json は書き換えない
  if (!hasLoomake(root)) {
    stdout(`\nloomake を開発用の依存に足してください。npx loomake verify は、プロジェクトに入れた版を使います。\n  ${INSTALL[detectPackageManager(root)]}`);
  }
  return 0;
}
