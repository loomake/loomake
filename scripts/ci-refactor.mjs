// REQ-477：振る舞いを変えないリファクタを change なしで受け付ける機械的な条件。
// 振る舞いが変わっていないことと、レビューの重大ゼロ・担当の独立性はレビューで確かめる。
import { declaredRoutes } from './ci-spec-fix.mjs';
import { evidenceSection } from './process-evidence.mjs';

const ROUTE = 'refactor';
// vitest が実行する試験と、その結果を左右する補助・fixture・一覧の置き場。根拠は accept-refactor-ci-route の design.md
const TEST_SCOPE = /^(?:tests\/|packages\/[^/]+\/test\/|vitest\.config\.ts$)/;

/** 経路の宣言のどれかが refactor ならリファクタの判定に進む。大文字小文字は区別しない */
export const isRefactorRoute = (routes) => routes.some((value) => value.toLowerCase() === ROUTE);

/** 既存の試験を弱められる場所か */
export const isTestScopePath = (path) => TEST_SCOPE.test(path);

const summarize = (paths) => `${paths.slice(0, 3).join('、')}${paths.length > 3 ? ` ほか ${paths.length - 3} 件` : ''}`;

function routeProblems(body) {
  const others = declaredRoutes(body).filter((value) => value.toLowerCase() !== ROUTE);
  return others.length ? [`loomake-route: の宣言が食い違っています（refactor と ${others.map((value) => value || '（空）').join('、')}）`] : [];
}

function specProblems(entries) {
  const specs = [...new Set(entries.flatMap((entry) => entry.paths).filter((path) => path.startsWith('openspec/')))];
  return specs.length ? [`openspec/ の下のファイルを変えています（${summarize(specs)}）`] : [];
}

// 追加（A）以外で、変更前のパス（名前の変更なら元のパス）が範囲にあれば、既存のテストファイルを変えている
function testProblems(entries) {
  const touched = entries.filter((entry) => entry.status !== 'A' && isTestScopePath(entry.paths[0])).map((entry) => entry.paths[0]);
  return touched.length ? [`既存のテストファイルを変更・削除・改名しています（${summarize(touched)}）。リファクタで足せるのは新しいテストファイルだけです`] : [];
}

function reviewProblems(body) {
  const lines = evidenceSection(body).flatMap((section) => section.split('\n'));
  return lines.some((line) => /^review:[ \t]*実施済み(?:[ \t]|$)/.test(line)) ? [] : ['## 証跡 に独立レビューの「review: 実施済み」の行がありません'];
}

/** リファクタの経路の判定。不足する条件をすべて返す */
export function refactorDecision({ body, entries }) {
  const problems = [...routeProblems(body), ...specProblems(entries), ...testProblems(entries), ...reviewProblems(body)];
  return { route: true, problems };
}
