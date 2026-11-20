// REQ-477：振る舞いを変えないリファクタを change なしで受け付ける機械的な条件。
// 振る舞いが変わっていないことと、レビューの重大ゼロ・担当の独立性はレビューで確かめる。
import { declaredRoutes } from './ci-spec-fix.mjs';
import { caseTwins } from './ci-tier.mjs';
import { evidenceSection } from './process-evidence.mjs';

const ROUTE = 'refactor';
// ファイルを変えてよい範囲（許可リスト）。根拠は accept-refactor-ci-route の design.md
const EDITABLE = /^(?:packages\/[^/]+\/src\/|docs\/)/;
const DELETABLE = /^packages\/[^/]+\/src\//;
const ADDABLE = /^(?:packages\/[^/]+\/(?:src|test)\/|tests\/|docs\/|\.changeset\/)/;
// 範囲の中でも変えない。試験が照合する正本、検査を左右する設定ファイル、パッケージの解決先
const REFERENCE = /^docs\/guide\/3\.reference\//;
const CONFIG_NAMES = [
  String.raw`(?:eslint|vitest|vite)\.config\..*`, String.raw`vitest\.workspace\..*`, String.raw`tsconfig.*\.json`,
  String.raw`package\.json`, String.raw`\.npmrc`, String.raw`\.pnpmfile\.cjs`, String.raw`\.gitattributes`,
];
const CONFIG_NAME = new RegExp(`^(?:${CONFIG_NAMES.join('|')})$`, 'i');
const NODE_MODULES = /(?:^|\/)node_modules\//i;

/** 経路の宣言のどれかが refactor ならリファクタの判定に進む。大文字小文字は区別しない */
export const isRefactorRoute = (routes) => routes.some((value) => value.toLowerCase() === ROUTE);

const baseName = (path) => path.slice(path.lastIndexOf('/') + 1);
const isProtectedPath = (path) => REFERENCE.test(path) || CONFIG_NAME.test(baseName(path)) || NODE_MODULES.test(path);

/** 既存のファイルを変更してよい場所か */
export const isEditablePath = (path) => EDITABLE.test(path) && !isProtectedPath(path);

/** 既存のファイルを削除してよい場所か。改名の元もこの範囲に限る */
export const isDeletablePath = (path) => DELETABLE.test(path) && !isProtectedPath(path);

/** ファイルを足してよい場所か。改名の先もこの範囲に限る */
export const isAddablePath = (path) => ADDABLE.test(path) && !isProtectedPath(path);

const SHOWN = 3;
const restCount = (paths) => (paths.length > SHOWN ? ` ほか ${paths.length - SHOWN} 件` : '');
const summarize = (paths) => `${paths.slice(0, SHOWN).join('、')}${restCount(paths)}`;
// 経路の宣言のうち refactor 以外のもの。空の宣言は「（空）」と書く
const isOtherRoute = (value) => value.toLowerCase() !== ROUTE;
const otherRoutes = (body) => declaredRoutes(body).filter(isOtherRoute).map((value) => value || '（空）');

function routeProblems(body) {
  const others = otherRoutes(body);
  return others.length ? [`loomake-route: の宣言が食い違っています（refactor と ${others.join('、')}）`] : [];
}

const touchedPaths = (entries) => [...new Set(entries.flatMap((entry) => entry.paths))];
const specPaths = (entries) => touchedPaths(entries).filter((path) => path.startsWith('openspec/'));

function specProblems(entries) {
  const specs = specPaths(entries);
  return specs.length ? [`openspec/ の下のファイルを変えています（${summarize(specs)}）`] : [];
}

// 改名・複写（R・C）は、元を削除してよい範囲、先を足してよい範囲に限る。追加（A）は addedProblems で見る
const movable = ([from, to]) => isDeletablePath(from) && isAddablePath(to);
const allowedChange = {
  A: () => true,
  D: ([path]) => isDeletablePath(path),
  R: movable,
  C: movable,
};
const editsAllowedPath = ([path]) => isEditablePath(path);
const isAllowedChange = ({ status, paths }) => (allowedChange[status[0]] ?? editsAllowedPath)(paths);

function scopeProblems(entries) {
  const touched = entries.filter((entry) => !isAllowedChange(entry)).map((entry) => entry.paths.join(' → '));
  if (!touched.length) return [];
  return [`変えてはいけない既存のファイルを変更・削除・改名しています（${summarize(touched)}）。`
    + '変更は packages/*/src/ と docs/ の下、削除と改名の元は packages/*/src/ の下に限ります'
    + '（docs/guide/3.reference/・設定ファイル・node_modules/ は除く）。試験は新しいファイルとして足してください'];
}

const addsOutside = ({ status, paths }) => status === 'A' && !isAddablePath(paths[0]);

function addedProblems(entries) {
  const outside = entries.filter(addsOutside).map(({ paths }) => paths[0]);
  if (!outside.length) return [];
  return [`足してはいけない場所にファイルを足しています（${summarize(outside)}）。`
    + '足してよいのは packages/*/src/・packages/*/test/・tests/・docs/・.changeset/ の下です'
    + '（docs/guide/3.reference/・設定ファイル・node_modules/ は除く）'];
}

// 足したパス（改名・複写なら後のパス）
const addsPath = ({ status }) => /^[ARC]/.test(status);
const addedPaths = (entries) => entries.filter(addsPath).map(({ paths }) => paths.at(-1));

// ツリーを読めなかったときの理由。git の失敗の詳細か、一覧が NUL で終わっていないこと
const unreadTree = ({ detail }) => (detail === undefined ? '一覧が NUL で終わっていません' : detail);

function caseProblems(entries, headTreeResult) {
  const added = addedPaths(entries);
  if (!added.length) return [];
  const tree = headTreeResult();
  if (tree.paths === undefined) return [`HEAD のツリーを読めないので、足したパスの大文字小文字の重なりを確かめられません（${unreadTree(tree)}）`];
  const twins = added.filter(caseTwins(tree.paths));
  return twins.length ? [`HEAD にある別のパスと大文字小文字だけが違うパスを足しています（${summarize(twins)}）`] : [];
}

const REVIEW_DONE = /^review:[ \t]*実施済み(?:[ \t]|$)/;
const evidenceLines = (body) => evidenceSection(body).flatMap((section) => section.split('\n'));

function reviewProblems(body) {
  if (evidenceLines(body).some((line) => REVIEW_DONE.test(line))) return [];
  return ['## 証跡 に独立レビューの「review: 実施済み」の行がありません'];
}

/** リファクタの経路の判定。不足する条件をすべて返す */
export function refactorDecision({ body, entries, headTreeResult }) {
  const problems = [
    ...routeProblems(body), ...specProblems(entries), ...scopeProblems(entries), ...addedProblems(entries),
    ...caseProblems(entries, headTreeResult), ...reviewProblems(body),
  ];
  return { route: true, problems };
}
