// PR の工程の段階（L1 文書・L2 試験と開発基盤・L3 製品コード）を、変えたファイルのパスと spec の差分から決める（REQ-342）。
// ci-gate.mjs（完了ゲート）と ci-docs-only.mjs（quality ジョブの docs_only 判定）の両方がこのモジュールを使い、
// 「文書だけ」と「段階 L1」が同じ入力・同じ関数で一致するようにする。
//
// 段階の規則は AGENTS.md 2 章。パスの判定は順に行い、どれにも当たらなければ安全側の L2 にする。
// Requirement の変更は、変更行が属する節（`### Requirement:` の見出しから次の見出しまで）で判定する（tier-ci-gate の仮定 A-01）

const TIERS = ['L1', 'L2', 'L3'];
const rank = (tier) => TIERS.indexOf(tier);

/** Windows と POSIX の両方で扱える正規の相対パスか（REQ-281・362） */
function isPortablePath(path) {
  if (typeof path !== 'string' || !path || path.includes('\\')) return false;
  const parts = path.split('/');
  if (parts.some((part) => part === '' || part === '.' || part === '..')) return false;
  // Windows で checkout できない名前は、文書の置き場所にあっても文書として扱わない（REQ-281）。
  // git の出力を UTF-8 として読むと、正しくないバイトは U+FFFD になる
  if (/[<>:"|?*�]/.test(path) || [...path].some((char) => char.charCodeAt(0) < 0x20)) return false;
  if (parts.some((part) => /[. ]$/.test(part) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i.test(part))) return false;
  return true;
}

/**
 * 文書の許可リスト。設定・実行ファイル・tests/・packages/ は .md でも含めない（REQ-270）。
 * @param {string} path リポジトリの根からの、/ で区切ったパス
 */
export function isDocumentPath(path) {
  if (!isPortablePath(path)) return false;
  const parts = path.split('/');
  const markdown = path.endsWith('.md');
  // リポジトリの直下の .md（README.md・CONTRIBUTING.md など）
  if (parts.length === 1) return markdown;
  // docs/ の下の .md
  if (parts[0] === 'docs') return markdown;
  // changeset の本文（.changeset/ の直下の .md）。.changeset/config.json などの設定は含めない
  if (parts[0] === '.changeset') return parts.length === 2 && markdown;
  // 仕様と change の成果物（archive/ を含む）。change の spec-gate.txt も含める
  if (parts[0] === 'openspec' && parts[1] === 'specs') return markdown;
  if (parts[0] === 'openspec' && parts[1] === 'changes') return markdown || parts[parts.length - 1] === 'spec-gate.txt';
  return false;
}

/** 実在する YYYY-MM-DD- prefix。0〜99 年もその年のまま検査する（REQ-362） */
function datedPrefix(name) {
  const match = /^(\d{4})-(\d{2})-(\d{2})-/.exec(name);
  if (!match) return false;
  const [, year, month, day] = match.map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/**
 * 同じ archive の文書を伴い、完全 blob 同一が証明された metadata 移動の前後パス（REQ-362）。
 * 単独のパスの文書分類は変えず、この PR の文脈でだけ使う。
 * @param {{ status: string; modes?: string[]; paths: string[] }[]} entries
 * @param {(from: string, to: string) => boolean} sameBlob
 * @returns {Set<string>}
 */
export function archiveMetadataPaths(entries, sameBlob = () => false) {
  const paths = new Set();
  for (const entry of entries) {
    if (entry.status !== 'R100' || entry.paths.length !== 2 || entry.modes?.length !== 2 || !entry.modes.every((mode) => mode === '100644')) continue;
    const [from, to] = entry.paths;
    if (!isPortablePath(from) || !isPortablePath(to)) continue;
    const source = /^openspec\/changes\/([^/]+)\/\.openspec\.yaml$/.exec(from);
    const target = /^openspec\/changes\/archive\/([^/]+)\/\.openspec\.yaml$/.exec(to);
    if (!source || !target) continue;
    const id = source[1];
    const name = target[1];
    if (id === 'archive' || id.startsWith('.')) continue;
    if (/^\d{4}-\d{2}-\d{2}-/.test(id)) {
      if (name !== id || !datedPrefix(id)) continue;
    } else if (name.slice(11) !== id || !datedPrefix(name)) continue;
    const archiveDir = `openspec/changes/archive/${name}/`;
    if (!entries.some((other) => other !== entry && /^(A|R\d*)$/.test(other.status) && isDocumentPath(other.paths.at(-1)) && other.paths.at(-1).startsWith(archiveDir))) continue;
    if (sameBlob(from, to) !== true) continue;
    paths.add(from);
    paths.add(to);
  }
  return paths;
}

/** Requirement の本文の判定の対象にする spec.md か（いまの仕様と、archive でない change の差分仕様） */
export function isSpecPath(path) {
  return typeof path === 'string' && /^openspec\/(specs|changes\/(?!archive\/)[^/]+\/specs)\/.+\/spec\.md$/.test(path);
}

/**
 * 1 つのパスの段階。L3 → L2 → L1 の順に判定し、どれにも当たらなければ L2（安全側）
 * @param {string} path
 * @returns {'L1' | 'L2' | 'L3'}
 */
export function classifyPath(path) {
  if (typeof path !== 'string') return 'L2';
  if (/^packages\/[^/]+\/src\//.test(path)) return 'L3';
  if (/^(tests?|\.github|scripts|\.agents\/skills|packages\/[^/]+\/templates)\//.test(path)) return 'L2';
  if (path.startsWith('packages/') || path === '.changeset/config.json' || path === 'openspec/config.yaml') return 'L2';
  // 規則の文書は docs/ の下や直下の .md でも L2（AGENTS.md 2 章。利用者の承認が要る）
  if (path === 'AGENTS.md' || path.startsWith('docs/adr/') || path === 'docs/dev/agent-workflow.md') return 'L2';
  if (isDocumentPath(path)) return 'L1';
  return 'L2';
}

/**
 * spec.md の行がどの節に属するか。直前の見出しで決める。
 * `### Requirement:` の見出しとその本文（次の見出しまで）は 'requirement'、`#### Scenario:` の配下は 'scenario'、Purpose などは 'other'
 * @param {string[]} lines ファイルの行
 * @param {number} lineNo 1 始まりの行番号
 */
export function sectionOf(lines, lineNo) {
  for (let i = Math.min(lineNo, lines.length) - 1; i >= 0; i--) {
    const line = lines[i];
    if (/^### Requirement:/.test(line)) return 'requirement';
    if (/^#### Scenario:/.test(line)) return 'scenario';
    if (/^#{1,6}\s/.test(line)) return 'other';
  }
  return 'other';
}

/**
 * `git diff -U0` の出力から、Requirement の見出しか本文の行を足すか消した spec.md を返す（tier-ci-gate の仮定 A-01）。
 * 変更行の行番号をハンクから読み、足した行は変更後のファイル、消した行は変更前のファイルの節で判定する。
 * spec.md 以外のファイルの差分は数えない。ファイルを読めないときは安全側に Requirement の変更として数える
 * @param {string} unifiedDiff
 * @param {(side: 'old' | 'new', path: string) => string | undefined} readSpec 変更前（old）か変更後（new）のファイルの内容
 * @returns {string[]}
 */
export function requirementChangedSpecs(unifiedDiff, readSpec = () => undefined) {
  if (typeof unifiedDiff !== 'string' || !unifiedDiff) return [];
  const changed = [];
  const cache = new Map();
  const linesOf = (side, path) => {
    const key = `${side}\0${path}`;
    if (!cache.has(key)) {
      const text = readSpec(side, path);
      cache.set(key, typeof text === 'string' ? text.split('\n') : undefined);
    }
    return cache.get(key);
  };
  let oldPath = '';
  let newPath = '';
  let oldLine = 0;
  let newLine = 0;
  const hit = (side, path, lineNo) => {
    const lines = linesOf(side, path);
    const isRequirement = !lines || sectionOf(lines, lineNo) === 'requirement';
    const name = newPath || oldPath;
    if (isRequirement && !changed.includes(name)) changed.push(name);
  };
  for (const line of unifiedDiff.split('\n')) {
    const header = /^diff --git a\/(.*) b\/(.*)$/.exec(line);
    if (header) {
      [, oldPath, newPath] = header;
      continue;
    }
    const hunk = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
    if (hunk) {
      oldLine = Number(hunk[1]);
      newLine = Number(hunk[2]);
      continue;
    }
    if (/^(\+\+\+|---) /.test(line) || line.startsWith('\\')) continue;
    const target = isSpecPath(newPath) ? newPath : isSpecPath(oldPath) ? oldPath : '';
    if (line.startsWith('+')) {
      if (target) hit('new', newPath, newLine);
      newLine++;
    } else if (line.startsWith('-')) {
      if (target) hit('old', oldPath, oldLine);
      oldLine++;
    }
  }
  return changed;
}

/** Requirement の見出しか本文を足すか消した spec.md が 1 つでもあるか */
export function requirementBodyChanged(unifiedDiff, readSpec) {
  return requirementChangedSpecs(unifiedDiff, readSpec).length > 0;
}

/** PR 本文の `loomake-tier:` の行の値。行がなければ undefined */
export function declaredTier(body) {
  const m = (body ?? '').match(/^[ \t]*loomake-tier:[ \t]*(.*?)[ \t]*\r?$/m);
  return m ? m[1] : undefined;
}

/**
 * PR の段階を決める。
 * @param {{ entries?: { status: string; modes?: string[]; paths: string[] }[]; sameBlob?: (from: string, to: string) => boolean; specDiff?: string; body?: string; readSpec?: (side: 'old' | 'new', path: string) => string | undefined }} options
 *   entries は `git diff --raw -z -M` を parseRawDiff で読んだもの（名前の変更は変更前と変更後の両方のパスを持つ）。
 *   specDiff は spec.md に対する `git diff -U0` の出力、readSpec は変更前後の spec.md を読む関数。body は PR 本文
 * @returns {{ tier: 'L1'|'L2'|'L3'; detected: 'L1'|'L2'|'L3'; reasons: string[]; override?: { from: string; to: string }; error?: undefined } | { error: string }}
 */
export function decideTier({ entries = [], specDiff = '', body = '', readSpec, sameBlob } = {}) {
  const metadata = archiveMetadataPaths(entries, sameBlob);
  const paths = [...new Set(entries.flatMap((entry) => entry.paths))];
  let detected = 'L1';
  let reasons = [];
  if (!paths.length) {
    detected = 'L2';
    reasons = ['変えたファイルがありません'];
  } else {
    for (const path of paths) {
      const tier = metadata.has(path) ? 'L1' : classifyPath(path);
      if (rank(tier) > rank(detected)) {
        detected = tier;
        reasons = [path];
      } else if (tier === detected) reasons.push(path);
    }
    const specs = requirementChangedSpecs(specDiff, readSpec);
    // archive の PR（archive/ の下にファイルを足すか移す）は Requirement を実装 PR の --done で検査済みなので L1 のまま（仮定 A-02）
    const archive = detected === 'L1' && entries.some((entry) => /^(A|R\d*)$/.test(entry.status) && entry.paths.at(-1).startsWith('openspec/changes/archive/'));
    if (specs.length && !archive) {
      if (detected !== 'L3') reasons = [];
      detected = 'L3';
      for (const spec of specs) if (!reasons.includes(spec)) reasons.push(spec);
    }
  }
  const declared = declaredTier(body);
  if (declared === undefined || declared === 'L1|L2|L3') return { tier: detected, detected, reasons };
  if (!TIERS.includes(declared)) return { error: `PR 本文の loomake-tier: の値が読めません：${declared}（L1・L2・L3 のどれかを書いてください）` };
  if (rank(declared) < rank(detected)) return { error: `段階は上げる方向にだけ上書きできます：判定 ${detected}、指定 ${declared}` };
  if (declared === detected) return { tier: detected, detected, reasons };
  return { tier: declared, detected, reasons, override: { from: detected, to: declared } };
}

/**
 * 段階と理由の 1 行。理由はパス 3 件までと残りの件数。本文で上げたときはその指定を先に書く
 * @param {{ tier: string; reasons: string[]; override?: { from: string; to: string } }} decided
 */
export function formatTierLine({ tier, reasons, override }) {
  const parts = [];
  if (override) parts.push(`本文の指定 ${override.from}→${override.to}`);
  parts.push(...reasons.slice(0, 3));
  if (reasons.length > 3) parts.push(`ほか ${reasons.length - 3} 件`);
  return `loomake-tier: ${tier}（${parts.join('、')}）`;
}
