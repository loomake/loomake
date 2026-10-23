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

/** package.json の packageManager、なければロックファイルで判定し、どれも無ければ npm（add-init-cli の仮定 A-01） */
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

/** init が置く loomake.config.json の中身 */
export function configJson(pm: PackageManager): string {
  const config = {
    $comment: 'Loomake の検証設定。AI は人の承認なしにここを緩めないこと（AGENTS.md 4章）',
    openspecDir: 'openspec',
    openspecValidate: 'auto',
    // verify はテストランナーがこのファイルに書き出した JSON レポートを読む（add-init-cli の仮定 A-05）
    tests: { report: DEFAULT_TEST_REPORT },
    commands: COMMANDS[pm],
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
    { path: 'loomake.config.json', content: configJson(detectPackageManager(options.root)) },
    ...skill('.claude/skills'),
    ...(options.codex ? skill('.agents/skills') : []),
    ...(options.devcontainer ? [{ path: '.devcontainer/devcontainer.json', content: template('devcontainer/devcontainer.json') }] : []),
  ];
}

const REPORT_EXAMPLES = [
  `テストランナーが、テストの結果を JSON で ${DEFAULT_TEST_REPORT} に書き出すよう設定してください。loomake verify はこのファイルで要件ごとのテストを確かめます。`,
  '  Vitest（vitest.config.ts）:',
  `    test: { reporters: ['default', 'json'], outputFile: { json: '${DEFAULT_TEST_REPORT}' } }`,
  '  Jest（package.json の test スクリプト）:',
  `    jest --json --outputFile=${DEFAULT_TEST_REPORT}`,
];

const isSymlink = (p: string) => {
  try {
    return lstatSync(p).isSymbolicLink();
  } catch {
    return false;
  }
};

/**
 * 置き先が承諾なしに読み書きしてはいけない場所かを調べ、理由を返す（harden-init-and-trace-check の仮定 A-01）。
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
  const unsafe = files.map((f) => unsafeTarget(root, f.path)).filter((r): r is string => r !== null);
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
  stdout(['', 'loomake init の結果:', ...lines].join('\n'));

  if (!existsSync(join(root, 'openspec'))) {
    stdout('\nopenspec/ がありません。OpenSpec の仕様と change を置くために、openspec init を実行してください。');
  }
  stdout(`\n${REPORT_EXAMPLES.join('\n')}`);

  // package.json がなければ commands は npm の既定値のままなので、書き換えを促す（improve-init-guidance の仮定 A-02）
  if (!existsSync(join(root, 'package.json'))) {
    stdout('\npackage.json がありません。loomake.config.json の commands（lint・typecheck・test）を、このプロジェクトで使うコマンドに書き換えてください。');
  }
  // 検査に使う版を固定するため、プロジェクトに入れるよう促す。package.json は書き換えない（improve-init-guidance の仮定 A-01）
  if (!hasLoomake(root)) {
    stdout(`\nloomake を開発用の依存に足してください。npx loomake verify は、プロジェクトに入れた版を使います。\n  ${INSTALL[detectPackageManager(root)]}`);
  }
  return 0;
}
