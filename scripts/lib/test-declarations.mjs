import ts from 'typescript';
import { extractTestBlocks } from '../scenario-audit.mjs';
import { includeCase, PARTITION_PLATFORMS } from './test-partition.mjs';

const TEST_NAME = /^(?:it|test|[a-z][\w$]*(?:It|Test))$/;
const literal = (node) => node && ts.isStringLiteralLike(node) ? node.text : undefined;
function walk(node, visit) { visit(node); ts.forEachChild(node, (child) => walk(child, visit)); }
function rootName(node) {
  if (ts.isIdentifier(node)) return node.text;
  if (ts.isPropertyAccessExpression(node) || ts.isCallExpression(node)) return rootName(node.expression);
  if (ts.isTaggedTemplateExpression(node)) return rootName(node.tag);
}
function chainParent(node) {
  const parent = node.parent;
  return parent && (((ts.isCallExpression(parent) || ts.isPropertyAccessExpression(parent)) && parent.expression === node) || (ts.isTaggedTemplateExpression(parent) && parent.tag === node));
}
function parse(source, file) {
  const text = source.replace(/\r\n/g, '\n');
  const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const calls = [];
  walk(ast, (node) => { if (ts.isCallExpression(node) && TEST_NAME.test(rootName(node) ?? '') && !chainParent(node)) calls.push(node); });
  return { text, ast, calls };
}
function declarationKind(call) {
  let result = 'direct';
  let expression = call.expression;
  while (expression) {
    if (ts.isPropertyAccessExpression(expression) && expression.name.text === 'each') return 'each';
    if (ts.isPropertyAccessExpression(expression) && expression.name.text === 'runIf') result = 'runIf';
    expression = ts.isPropertyAccessExpression(expression) || ts.isCallExpression(expression) ? expression.expression : ts.isTaggedTemplateExpression(expression) ? expression.tag : undefined;
  }
  return result;
}
function parameterizedGroup(call) {
  for (let parent = call.parent; parent; parent = parent.parent) {
    if (ts.isCallExpression(parent) && rootName(parent) === 'describe' && declarationKind(parent) === 'each') return true;
  }
  return false;
}
function rowCount(call) {
  let expression = call.expression;
  while (expression) {
    if (ts.isCallExpression(expression) && ts.isPropertyAccessExpression(expression.expression) && expression.expression.name.text === 'each') {
      const table = expression.arguments[0];
      return table && ts.isArrayLiteralExpression(table) && !table.elements.some(ts.isSpreadElement) ? table.elements.length : undefined;
    }
    if (ts.isTaggedTemplateExpression(expression) && ts.isPropertyAccessExpression(expression.tag) && expression.tag.name.text === 'each') {
      const template = expression.template;
      const chunks = ts.isNoSubstitutionTemplateLiteral(template) ? template.text : template.head.text + template.templateSpans.map((span) => `VALUE${span.literal.text}`).join('');
      const lines = chunks.trim().split('\n').filter((line) => line.trim());
      return lines.length > 1 && lines.every((line) => line.split('|').length === lines[0].split('|').length) ? lines.length - 1 : undefined;
    }
    expression = ts.isPropertyAccessExpression(expression) || ts.isCallExpression(expression) ? expression.expression : undefined;
  }
  return 1;
}

function localBindings(ast, file) {
  const options = { noLib: true, noResolve: true };
  const host = ts.createCompilerHost(options);
  host.getSourceFile = (name) => name === file ? ast : undefined;
  host.writeFile = () => {};
  const checker = ts.createProgram([file], options, host).getTypeChecker();
  const declarationOf = (node) => {
    const symbol = ts.isShorthandPropertyAssignment(node.parent) && node.parent.name === node ? checker.getShorthandAssignmentValueSymbol(node.parent) : checker.getSymbolAtLocation(node);
    return symbol?.valueDeclaration ?? symbol?.declarations?.[0];
  };
  const namespace = (node, seen = new Set()) => {
    while (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node) || ts.isNonNullExpression(node)) node = node.expression;
    if (!ts.isIdentifier(node)) return false;
    const declaration = declarationOf(node);
    if (!declaration || seen.has(declaration)) return false;
    seen.add(declaration);
    if (ts.isNamespaceImport(declaration)) return literal(declaration.parent.parent.moduleSpecifier) === 'vitest';
    return ts.isVariableDeclaration(declaration) && declaration.initializer ? namespace(declaration.initializer, seen) : false;
  };
  const testValue = (node, seen = new Set()) => {
    if (ts.isIdentifier(node)) {
      const declaration = declarationOf(node);
      if (declaration && ts.isVariableDeclaration(declaration) && declaration.initializer) {
        if (seen.has(declaration)) return true;
        seen.add(declaration); return testValue(declaration.initializer, seen);
      }
      if (declaration && ts.isImportSpecifier(declaration) && ['it', 'test'].includes((declaration.propertyName ?? declaration.name).text)) return true;
      return TEST_NAME.test(node.text);
    }
    if (ts.isPropertyAccessExpression(node)) return (namespace(node.expression) && ['it', 'test'].includes(node.name.text)) || testValue(node.expression, seen);
    if (ts.isElementAccessExpression(node)) return (namespace(node.expression) && ['it', 'test'].includes(literal(node.argumentExpression))) || testValue(node.expression, seen);
    if (ts.isCallExpression(node)) return testValue(node.expression, seen);
    if (ts.isTaggedTemplateExpression(node)) return testValue(node.tag, seen);
    if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node) || ts.isNonNullExpression(node)) return testValue(node.expression, seen);
    return false;
  };
  const ordinaryHelper = (node) => {
    const declaration = declarationOf(node);
    return declaration && ts.isVariableDeclaration(declaration) && ts.isIdentifier(declaration.name) && declaration.initializer && ts.isVariableDeclarationList(declaration.parent) && Boolean(declaration.parent.flags & ts.NodeFlags.Const) && !testValue(declaration.initializer);
  };
  return { ordinaryHelper, testValue };
}

/** scanner に依存せず宣言を集め、最後に候補と照合する。コードは実行しない。 */
export function inventoryDeclarations(source, file) {
  const { text, ast, calls } = parse(source, file);
  const errors = []; const nonCall = [];
  const bindings = localBindings(ast, file);
  const error = (code, node, message) => errors.push({ code, file, line: ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1, message });
  const diagnostics = ts.transpileModule(text, { fileName: file, reportDiagnostics: true, compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext } }).diagnostics ?? [];
  if (diagnostics.some((item) => item.category === ts.DiagnosticCategory.Error)) error('syntax', ast, '試験の構文が不正です');
  const scannerCandidates = extractTestBlocks(text);
  const declarations = calls.map((call) => {
    const start = call.getStart(ast); const block = scannerCandidates.find((item) => item.start === start);
    if (!block || block.end < 0 || block.end !== call.end || block.text !== call.getText(ast)) error('scannerMismatch', call, '宣言と本文ブロックが一致しません');
    const title = call.arguments[0];
    if (!(title && (ts.isStringLiteralLike(title) || ts.isTemplateExpression(title))) || block?.pattern === undefined) error('dynamicTitle', call, '試験名を静的に照合できません');
    const rows = parameterizedGroup(call) ? undefined : rowCount(call);
    if (rows === undefined) error('dynamicRows', call, '表の展開行数を静的に確定できません');
    return { start, end: call.end, text: call.getText(ast), line: ast.getLineAndCharacterOfPosition(start).line + 1, kind: declarationKind(call), rows };
  });
  const starts = new Set(declarations.map((item) => item.start));
  const identifiers = new Map();
  walk(ast, (node) => { if (ts.isIdentifier(node)) identifiers.set(node.getStart(ast), node); });
  for (const candidate of scannerCandidates) {
    if (starts.has(candidate.start)) continue;
    const node = identifiers.get(candidate.start) ?? ast;
    if (candidate.end > 0) { error('scannerFalsePositive', node, '本文候補が試験の宣言ではありません'); continue; }
    const parent = node.parent;
    const kind = parent && ts.isImportSpecifier(parent) && parent.name === node && !parent.propertyName ? 'importSpecifier' : parent && ts.isPropertyAssignment(parent) && parent.name === node ? 'propertyKey' : undefined;
    const helper = !kind && ts.isIdentifier(node) && bindings.ordinaryHelper(node);
    const classified = kind ?? (helper ? 'localHelper' : undefined);
    if (classified) nonCall.push({ start: candidate.start, line: ast.getLineAndCharacterOfPosition(candidate.start).line + 1, kind: classified });
    else error('unclassifiedCandidate', node, '本文候補を分類できません');
  }
  walk(ast, (node) => {
    if (ts.isNamespaceImport(node)) {
      const declaration = node.parent.parent;
      if (ts.isImportDeclaration(declaration) && literal(declaration.moduleSpecifier) === 'vitest') error('alias', node, 'vitest の namespace を検査できません');
    }
    if (ts.isImportSpecifier(node) && node.propertyName && ['it', 'test', 'describe'].includes(node.propertyName.text)) {
      const declaration = node.parent.parent.parent;
      if (ts.isImportDeclaration(declaration) && literal(declaration.moduleSpecifier) === 'vitest') error('alias', node, 'vitest の別名を検査できません');
    }
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && bindings.testValue(node.initializer)) error('alias', node, '試験関数の別名を検査できません');
  });
  return { declarations, nonCall, scannerCandidates, expandedRows: declarations.some((item) => item.rows === undefined) ? undefined : declarations.reduce((sum, item) => sum + item.rows, 0), errors };
}

function guardOf(statement) {
  let parent = statement.parent;
  if (parent && ts.isBlock(parent) && parent.statements.length === 1) parent = parent.parent;
  return parent && ts.isIfStatement(parent) && !parent.elseStatement && (parent.thenStatement === statement || (ts.isBlock(parent.thenStatement) && parent.thenStatement.statements.length === 1 && parent.thenStatement.statements[0] === statement)) ? parent.expression : undefined;
}
const namedCall = (node, name) => node && ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === name;
const arrayIds = (node) => node && ts.isArrayLiteralExpression(node) && node.elements.every((item) => literal(item) !== undefined) ? node.elements.map(literal) : undefined;

/** 登録された file の宣言 ID と OS/part ごとの空 describe を確かめる。 */
export function checkRegistration(file, source, cases) {
  const { ast, calls } = parse(source, file); const errors = []; const registered = new Set(Object.keys(cases)); const ids = new Map(); const declarationIds = new Map();
  const error = (code, node, message) => errors.push({ code, file, line: ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1, message });
  for (const call of calls) {
    const statement = call.parent;
    const guard = ts.isExpressionStatement(statement) ? guardOf(statement) : undefined;
    const id = namedCall(guard, 'has') && guard.arguments.length === 1 ? literal(guard.arguments[0]) : undefined;
    if (id === undefined) { error('unprefixed', call, '宣言の直前に if (has(id)) が必要です'); continue; }
    declarationIds.set(call, id);
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id) || id.startsWith('req-')) error('invalidId', call, 'case ID が不正です');
    if (ids.has(id)) error('duplicateId', call, 'case ID が重複しています');
    ids.set(id, call);
    if (!registered.has(id)) error('unknownId', call, 'case ID が一覧にありません');
  }
  for (const id of registered) if (!ids.has(id)) error('missingId', ast, `case ID の宣言がありません：${id}`);
  walk(ast, (node) => {
    if (namedCall(node, 'has') || namedCall(node, 'hasAny')) {
      const used = namedCall(node, 'has') ? (literal(node.arguments[0]) === undefined ? undefined : [literal(node.arguments[0])]) : arrayIds(node.arguments[0]);
      if (node.arguments.length !== 1 || !used || used.some((id) => !registered.has(id))) error('dynamicGuard', node, 'ガードの ID を一覧と照合できません');
    }
    if (namedCall(node, 'includeCase') && literal(node.arguments[1]) !== file) error('includeCaseTarget', node, 'includeCase の対象 file が一致しません');
    if (!ts.isCallExpression(node) || rootName(node) !== 'describe' || chainParent(node)) return;
    const descendants = [...declarationIds].filter(([call]) => call.getStart(ast) > node.getStart(ast) && call.end < node.end).map(([, id]) => id);
    const guard = ts.isExpressionStatement(node.parent) ? guardOf(node.parent) : undefined;
    const guarded = namedCall(guard, 'hasAny'); const used = guarded ? arrayIds(guard.arguments[0]) : undefined;
    if (guarded && (!used || used.length !== new Set(used).size || used.length !== new Set(descendants).size || descendants.some((id) => !used.includes(id)))) error('guardMismatch', node, 'describe のガードと子孫の ID が一致しません');
    const registry = { files: { [file]: { cases } } };
    const empty = PARTITION_PLATFORMS.some((platform) => ['fast', 'slow'].some((part) => [...registered].some((id) => includeCase(registry, file, part, id, platform)) && !descendants.some((id) => registered.has(id) && includeCase(registry, file, part, id, platform))));
    if (empty && !guarded) error('unguardedDescribe', node, '空になる describe に hasAny のガードが必要です');
  });
  return errors;
}
