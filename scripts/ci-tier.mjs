// PR の工程の段階（L1 文書・L2 試験と開発基盤・L3 製品コード）を、変えたファイルのパスと spec の差分から決める（REQ-342）。
// ci-gate.mjs（完了ゲート）と ci-docs-only.mjs（quality ジョブの docs_only 判定）の両方がこのモジュールを使い、
// 「文書だけ」と「段階 L1」が同じ入力・同じ関数で一致するようにする。
//
// 段階の規則は AGENTS.md 2 章。パスの判定は順に行い、どれにも当たらなければ安全側の L2 にする。
// Requirement の本文の変更は「`### Requirement:` の行か RFC 2119 の語を含む行の追加・削除」で近似する（tier-ci-gate の仮定 A-01）

const TIERS = ['L1', 'L2', 'L3'];
const rank = (tier) => TIERS.indexOf(tier);

/**
 * 文書として扱うファイルか。ここに挙げたものだけを文書とし、ほかはすべて quality の対象に残す
 * （設定・実行用のファイル・tests/ の下・packages/ の下は、拡張子が .md でも文書ではない）（REQ-270）
 * @param {string} path リポジトリの根からの、/ で区切ったパス
 */
export function isDocumentPath(path) {
  if (typeof path !== 'string' || !path || path.includes('\\')) return false;
  const parts = path.split('/');
  if (parts.some((part) => part === '' || part === '.' || part === '..')) return false;
  // Windows で checkout できない名前は、文書の置き場所にあっても文書として扱わない（REQ-281）。
  // git の出力を UTF-8 として読むと、正しくないバイトは U+FFFD になる
  if (/[<>:"|?*�]/.test(path) || [...path].some((char) => char.charCodeAt(0) < 0x20)) return false;
  if (parts.some((part) => /[. ]$/.test(part) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i.test(part))) return false;
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

// Requirement の本文とみなす行：見出しか、RFC 2119 の語（単語境界）を含む
const isRequirementLine = (line) => /^### Requirement:/.test(line) || /\b(SHALL|MUST|SHOULD|MAY)\b/.test(line);

/**
 * `git diff -U0` の出力から、Requirement の本文（`### Requirement:` の行か RFC 2119 の語を含む行）を足すか消した spec.md を返す。
 * spec.md 以外のファイルの差分は数えない
 * @param {string} unifiedDiff
 * @returns {string[]}
 */
export function requirementChangedSpecs(unifiedDiff) {
  if (typeof unifiedDiff !== 'string' || !unifiedDiff) return [];
  const changed = [];
  let current = '';
  for (const line of unifiedDiff.split('\n')) {
    const header = /^diff --git a\/(.*) b\/(.*)$/.exec(line);
    if (header) {
      current = header[2];
      continue;
    }
    if (/^(\+\+\+|---) /.test(line)) continue;
    if (!/^[+-]/.test(line) || !isSpecPath(current)) continue;
    if (isRequirementLine(line.slice(1)) && !changed.includes(current)) changed.push(current);
  }
  return changed;
}

/** Requirement の本文を足すか消した spec.md が 1 つでもあるか */
export function requirementBodyChanged(unifiedDiff) {
  return requirementChangedSpecs(unifiedDiff).length > 0;
}

/** PR 本文の `loomake-tier:` の行の値。行がなければ undefined */
export function declaredTier(body) {
  const m = (body ?? '').match(/^[ \t]*loomake-tier:[ \t]*(.*?)[ \t]*\r?$/m);
  return m ? m[1] : undefined;
}

/**
 * PR の段階を決める。
 * @param {{ entries?: { status: string; paths: string[] }[]; specDiff?: string; body?: string }} options
 *   entries は `git diff --raw -z -M` を parseRawDiff で読んだもの（名前の変更は変更前と変更後の両方のパスを持つ）。
 *   specDiff は spec.md に対する `git diff -U0` の出力。body は PR 本文
 * @returns {{ tier: 'L1'|'L2'|'L3'; detected: 'L1'|'L2'|'L3'; reasons: string[]; override?: { from: string; to: string }; error?: undefined } | { error: string }}
 */
export function decideTier({ entries = [], specDiff = '', body = '' } = {}) {
  const paths = [...new Set(entries.flatMap((entry) => entry.paths))];
  let detected = 'L1';
  let reasons = [];
  if (!paths.length) {
    detected = 'L2';
    reasons = ['変えたファイルがありません'];
  } else {
    for (const path of paths) {
      const tier = classifyPath(path);
      if (rank(tier) > rank(detected)) {
        detected = tier;
        reasons = [path];
      } else if (tier === detected) reasons.push(path);
    }
    const specs = requirementChangedSpecs(specDiff);
    // archive の PR は Requirement を実装 PR の --done で検査済みなので L1 のまま（仮定 A-02）
    const archive = detected === 'L1' && paths.some((path) => path.startsWith('openspec/changes/archive/'));
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
