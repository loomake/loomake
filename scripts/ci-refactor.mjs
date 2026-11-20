// REQ-477：振る舞いを変えないリファクタを change なしで受け付ける機械的な条件。
// 振る舞いが変わっていないことと、レビューの重大ゼロ・担当の独立性はレビューで確かめる。
import { declaredRoutes } from './ci-spec-fix.mjs';
import { caseTwins } from './ci-tier.mjs';
import { evidenceSection } from './process-evidence.mjs';

const ROUTE = 'refactor';
// 既存のファイルを変えてよい範囲（許可リスト）。削除は src の中だけ。根拠は accept-refactor-ci-route の design.md
const EDITABLE = /^(?:packages\/[^/]+\/src\/|docs\/)/;
const DELETABLE = /^packages\/[^/]+\/src\//;

/** 経路の宣言のどれかが refactor ならリファクタの判定に進む。大文字小文字は区別しない */
export const isRefactorRoute = (routes) => routes.some((value) => value.toLowerCase() === ROUTE);

/** 既存のファイルを変更してよい場所か */
export const isEditablePath = (path) => EDITABLE.test(path);

/** 既存のファイルを削除してよい場所か */
export const isDeletablePath = (path) => DELETABLE.test(path);

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

// 追加（A）は範囲を問わない。改名・複写（R・C）は前後とも、変更（M・T）は変更してよい範囲に限る
const allowedChange = {
  A: () => true,
  D: ([path]) => isDeletablePath(path),
  R: (paths) => paths.every(isEditablePath),
  C: (paths) => paths.every(isEditablePath),
};
const editsAllowedPath = ([path]) => isEditablePath(path);
const isAllowedChange = ({ status, paths }) => (allowedChange[status[0]] ?? editsAllowedPath)(paths);

function scopeProblems(entries) {
  const touched = entries.filter((entry) => !isAllowedChange(entry)).map((entry) => entry.paths.join(' → '));
  if (!touched.length) return [];
  return [`変えてはいけない既存のファイルを変更・削除・改名しています（${summarize(touched)}）。`
    + 'リファクタで既存のファイルを変えてよいのは packages/*/src/ と docs/ の下だけです（削除は packages/*/src/ の下だけ）。'
    + '試験は新しいファイルとして足してください'];
}

// 足したパス（改名・複写なら後のパス）
const addsPath = ({ status }) => /^[ARC]/.test(status);
const addedPaths = (entries) => entries.filter(addsPath).map(({ paths }) => paths.at(-1));

function caseProblems(entries, headTree) {
  const added = addedPaths(entries);
  if (!added.length) return [];
  const tree = headTree();
  if (tree === undefined) return ['HEAD のツリーを読めないので、足したパスの大文字小文字の重なりを確かめられません'];
  const twins = added.filter(caseTwins(tree));
  return twins.length ? [`HEAD にある別のパスと大文字小文字だけが違うパスを足しています（${summarize(twins)}）`] : [];
}

const REVIEW_DONE = /^review:[ \t]*実施済み(?:[ \t]|$)/;
const evidenceLines = (body) => evidenceSection(body).flatMap((section) => section.split('\n'));

function reviewProblems(body) {
  if (evidenceLines(body).some((line) => REVIEW_DONE.test(line))) return [];
  return ['## 証跡 に独立レビューの「review: 実施済み」の行がありません'];
}

/** リファクタの経路の判定。不足する条件をすべて返す */
export function refactorDecision({ body, entries, headTree }) {
  const problems = [
    ...routeProblems(body), ...specProblems(entries), ...scopeProblems(entries),
    ...caseProblems(entries, headTree), ...reviewProblems(body),
  ];
  return { route: true, problems };
}
