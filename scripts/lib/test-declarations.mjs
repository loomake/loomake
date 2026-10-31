import ts from 'typescript';
import { posix } from 'node:path';
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
function conditionalFactory(node) {
  if (!ts.isVariableDeclaration(node) || !ts.isIdentifier(node.name) || !TEST_NAME.test(node.name.text)) return false;
  const list = node.parent; const statement = list.parent;
  if (!ts.isVariableDeclarationList(list) || !(list.flags & ts.NodeFlags.Const) || !ts.isVariableStatement(statement) || statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) return false;
  const call = node.initializer;
  return call && ts.isCallExpression(call) && call.arguments.length === 1 && !ts.isSpreadElement(call.arguments[0]) && ts.isPropertyAccessExpression(call.expression) && ts.isIdentifier(call.expression.expression) && ['it', 'test'].includes(call.expression.expression.text) && ['runIf', 'skipIf'].includes(call.expression.name.text);
}
function parse(source, file) {
  const text = source.replace(/\r\n/g, '\n');
  const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const calls = []; const factories = new Set(); const factoryCandidates = new Set();
  walk(ast, (node) => {
    if (conditionalFactory(node)) { factories.add(node.initializer); factoryCandidates.add(node.name.getStart(ast)); factoryCandidates.add(node.initializer.getStart(ast)); }
  });
  walk(ast, (node) => { if (ts.isCallExpression(node) && !factories.has(node) && TEST_NAME.test(rootName(node) ?? '') && !chainParent(node)) calls.push(node); });
  return { text, ast, calls, factoryCandidates };
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
      let table = expression.arguments[0];
      while (table && (ts.isParenthesizedExpression(table) || ts.isAsExpression(table) || ts.isSatisfiesExpression(table) || ts.isNonNullExpression(table))) table = table.expression;
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
  return { ordinaryHelper, testValue, declarationOf };
}


function unwrap(node) {
  while (node && (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node) || ts.isNonNullExpression(node))) node = node.expression;
  return node;
}
function literalRow(node) {
  node = unwrap(node);
  if (!node) return false;
  if (ts.isStringLiteralLike(node) || ts.isNumericLiteral(node) || [ts.SyntaxKind.TrueKeyword, ts.SyntaxKind.FalseKeyword, ts.SyntaxKind.NullKeyword].includes(node.kind)) return true;
  if (ts.isPrefixUnaryExpression(node)) return node.operator === ts.SyntaxKind.MinusToken && ts.isNumericLiteral(node.operand);
  if (ts.isArrayLiteralExpression(node)) return node.elements.every(literalRow);
  return ts.isObjectLiteralExpression(node) && node.properties.every((item) => ts.isPropertyAssignment(item) && !ts.isComputedPropertyName(item.name) && literalRow(item.initializer));
}
function partitionRowsSource(node) {
  if (!node || !ts.isImportSpecifier(node) || (node.propertyName ?? node.name).text !== 'eachRows') return false;
  const path = literal(node.parent.parent.parent.moduleSpecifier);
  return path !== undefined && /(?:^|\/)partition-part\.js$/.test(path);
}
function partitionRowsImport(node, file) {
  if (!partitionRowsSource(node) || node.isTypeOnly || node.parent.parent.isTypeOnly || node.propertyName) return false;
  if (posix.isAbsolute(file) || /^[A-Za-z]:/.test(file) || file.includes('\\') || file.split('/').includes('..')) return false;
  const relative = posix.relative(posix.dirname(file), 'tests/helpers/partition-part.js');
  const expected = relative.startsWith('.') ? relative : `./${relative}`;
  return literal(node.parent.parent.parent.moduleSpecifier) === expected;
}

// Only an unconditional chain of plain describe callbacks can contain a row block.
// hasAny guards may select a group, but arbitrary control flow cannot multiply it.
function rowContainer(container, bindings) {
  if (ts.isSourceFile(container)) return true;
  if (!ts.isBlock(container)) return false;
  const callback = container.parent;
  if (!(ts.isArrowFunction(callback) || ts.isFunctionExpression(callback)) || callback.body !== container) return false;
  const call = callback.parent;
  if (!namedCall(call, 'describe') || call.arguments[1] !== callback || literal(call.arguments[0]) === undefined) return false;
  const declaration = bindings.declarationOf(call.expression);
  if (declaration && !(ts.isImportSpecifier(declaration) && !declaration.propertyName && !declaration.isTypeOnly && !declaration.parent.parent.isTypeOnly && literal(declaration.parent.parent.parent.moduleSpecifier) === 'vitest')) return false;
  const statement = call.parent;
  if (!ts.isExpressionStatement(statement)) return false;
  const guard = guardOf(statement);
  if (guard) {
    if (!namedCall(guard, 'hasAny') || guard.arguments.length !== 1 || !arrayIds(guard.arguments[0])) return false;
    const branch = ts.isBlock(statement.parent) ? statement.parent.parent : statement.parent;
    return rowContainer(branch.parent, bindings);
  }
  return rowContainer(statement.parent, bindings);
}

// Both entry points use the same closed structural rule. A rejected shape remains an error,
// rather than being classified as an ordinary local fixture helper.
function rowBindings(ast, bindings, error) {
  const rows = new Map(); const candidates = new Set();
  walk(ast, (node) => {
    if (!ts.isCallExpression(node)) return;
    const expression = node.expression;
    const imported = ts.isIdentifier(expression) && partitionRowsImport(bindings.declarationOf(expression), ast.fileName);
    const helperReference = (item) => ts.isIdentifier(item) ? item.text === 'eachRows' || partitionRowsSource(bindings.declarationOf(item)) : ts.isPropertyAccessExpression(item) ? item.name.text === 'eachRows' || helperReference(item.expression) : false;
    const attempted = helperReference(expression);
    if (!attempted) return;
    const declaration = node.parent;
    const list = ts.isVariableDeclaration(declaration) ? declaration.parent : undefined;
    const statement = list && ts.isVariableDeclarationList(list) ? list.parent : undefined;
    const block = statement && ts.isVariableStatement(statement) ? statement.parent : undefined;
    const callStatement = block && ts.isBlock(block) ? block.statements[1] : undefined;
    const call = callStatement && ts.isExpressionStatement(callStatement) ? callStatement.expression : undefined;
    const each = call && ts.isCallExpression(call) && ts.isCallExpression(call.expression) ? call.expression : undefined;
    const access = each && ts.isPropertyAccessExpression(each.expression) ? each.expression : undefined;
    const name = ts.isVariableDeclaration(declaration) && ts.isIdentifier(declaration.name) ? declaration.name : undefined;
    const references = [];
    if (name) walk(block ?? ast, (item) => { if (ts.isIdentifier(item) && item !== name && bindings.declarationOf(item) === declaration) references.push(item); });
    const constBinding = name && ['it', 'test'].includes(name.text) && list && (list.flags & ts.NodeFlags.Const) && list.declarations.length === 1 && statement && !statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);
    const barePair = block && ts.isBlock(block) && block.statements.length === 2 && block.statements[0] === statement && rowContainer(block.parent, bindings);
    const rowArguments = node.arguments.length === 2 && ts.isIdentifier(node.arguments[0]) && node.arguments[0].text === 'has';
    const directEach = each && access && access.name.text === 'each' && ts.isIdentifier(access.expression) && name && access.expression.text === name.text && each.arguments.length === 1 && references.length === 1 && references[0] === access.expression;
    const valid = imported && constBinding && barePair && rowArguments && directEach && !parameterizedGroup(call);
    if (!valid) { error('unsupportedRowForm', node, '行単位の登録の構造を検査できません'); return; }
    const ids = arrayIds(node.arguments[1]);
    if (!ids) error('dynamicGuard', node, '行単位の ID を一覧と照合できません');
    if (ids?.length === 0) error('unsupportedRowForm', node, '行単位の登録には1件以上の行が必要です');
    const table = unwrap(each.arguments[0]);
    const literalTable = table && ts.isArrayLiteralExpression(table) && table.elements.every(literalRow);
    const count = rowCount(call);
    if (!literalTable) error('unsupportedRowForm', each, '行単位の表を静的に照合できません');
    if (count === undefined || (ids && count !== ids.length)) error('rowIdsMismatch', each, '行 ID の数と表の行数が一致しません');
    candidates.add(name.getStart(ast));
    rows.set(call.getStart(ast), { ids, texts: literalTable ? table.elements.map((item) => item.getText(ast)) : undefined });
  });
  return { rows, candidates };
}

/** scanner に依存せず宣言を集め、最後に候補と照合する。コードは実行しない。 */
export function inventoryDeclarations(source, file) {
  const { text, ast, calls, factoryCandidates } = parse(source, file);
  const errors = []; const nonCall = [];
  const bindings = localBindings(ast, file);
  const error = (code, node, message) => errors.push({ code, file, line: ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1, message });
  const diagnostics = ts.transpileModule(text, { fileName: file, reportDiagnostics: true, compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext } }).diagnostics ?? [];
  if (diagnostics.some((item) => item.category === ts.DiagnosticCategory.Error)) error('syntax', ast, '試験の構文が不正です');
  const rowRegistration = rowBindings(ast, bindings, error);
  const scannerCandidates = extractTestBlocks(text);
  const declarations = calls.map((call) => {
    const start = call.getStart(ast); const block = scannerCandidates.find((item) => item.start === start);
    if (!block || block.end < 0 || block.end !== call.end || block.text !== call.getText(ast)) error('scannerMismatch', call, '宣言と本文ブロックが一致しません');
    const title = call.arguments[0];
    if (!(title && (ts.isStringLiteralLike(title) || ts.isTemplateExpression(title))) || block?.pattern === undefined) error('dynamicTitle', call, '試験名を静的に照合できません');
    const rows = parameterizedGroup(call) ? undefined : rowCount(call);
    if (rows === undefined) error('dynamicRows', call, '表の展開行数を静的に確定できません');
    return { start, end: call.end, text: call.getText(ast), line: ast.getLineAndCharacterOfPosition(start).line + 1, kind: declarationKind(call), rows, ...(rowRegistration.rows.has(start) ? { rowIds: rowRegistration.rows.get(start).ids, rowTexts: rowRegistration.rows.get(start).texts } : {}) };
  });
  const starts = new Set(declarations.map((item) => item.start));
  const identifiers = new Map();
  walk(ast, (node) => { if (ts.isIdentifier(node)) identifiers.set(node.getStart(ast), node); });
  for (const candidate of scannerCandidates) {
    if (starts.has(candidate.start)) continue;
    const node = identifiers.get(candidate.start) ?? ast;
    if (rowRegistration.candidates.has(candidate.start)) { nonCall.push({ start: candidate.start, line: ast.getLineAndCharacterOfPosition(candidate.start).line + 1, kind: 'rowBinding' }); continue; }
    if (factoryCandidates.has(candidate.start)) { nonCall.push({ start: candidate.start, line: ast.getLineAndCharacterOfPosition(candidate.start).line + 1, kind: 'conditionalFactory' }); continue; }
    if (candidate.end > 0) { error('scannerFalsePositive', node, '本文候補が試験の宣言ではありません'); continue; }
    const parent = node.parent;
    const kind = parent && ts.isImportSpecifier(parent) && parent.name === node && !parent.propertyName ? 'importSpecifier' : parent && ts.isPropertyAssignment(parent) && parent.name === node ? 'propertyKey' : undefined;
    const helper = !kind && ts.isIdentifier(node) && !['it', 'test'].includes(node.text) && bindings.ordinaryHelper(node);
    const classified = kind ?? (helper ? 'localHelper' : undefined);
    if (classified) nonCall.push({ start: candidate.start, line: ast.getLineAndCharacterOfPosition(candidate.start).line + 1, kind: classified });
    else error('unclassifiedCandidate', node, '本文候補を分類できません');
  }
  walk(ast, (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && ['it', 'test'].includes(node.name.text) && !rowRegistration.candidates.has(node.name.getStart(ast))) error('shadowedTest', node, '試験関数名を通常の変数で隠せません');
    if (ts.isNamespaceImport(node)) {
      const declaration = node.parent.parent;
      if (ts.isImportDeclaration(declaration) && literal(declaration.moduleSpecifier) === 'vitest') error('alias', node, 'vitest の namespace を検査できません');
    }
    if (ts.isImportSpecifier(node) && node.propertyName && ['it', 'test', 'describe'].includes(node.propertyName.text)) {
      const declaration = node.parent.parent.parent;
      if (ts.isImportDeclaration(declaration) && literal(declaration.moduleSpecifier) === 'vitest') error('alias', node, 'vitest の別名を検査できません');
    }
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && !conditionalFactory(node) && bindings.testValue(node.initializer)) error('alias', node, '試験関数の別名を検査できません');
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
  const rowRegistration = rowBindings(ast, localBindings(ast, file), error);
  for (const call of calls) {
    const statement = call.parent;
    const guard = ts.isExpressionStatement(statement) ? guardOf(statement) : undefined;
    const id = namedCall(guard, 'has') && guard.arguments.length === 1 ? literal(guard.arguments[0]) : undefined;
    const row = rowRegistration.rows.get(call.getStart(ast));
    if (id === undefined && !row) { error('unprefixed', call, '宣言の直前に if (has(id)) が必要です'); continue; }
    const used = row ? row.ids ?? [] : [id];
    declarationIds.set(call, used);
    for (const id of used) {
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id) || id.startsWith('req-')) error('invalidId', call, 'case ID が不正です');
      if (ids.has(id)) error('duplicateId', call, 'case ID が重複しています');
      ids.set(id, call);
      if (!registered.has(id)) error('unknownId', call, 'case ID が一覧にありません');
    }
  }
  for (const id of registered) if (!ids.has(id)) error('missingId', ast, `case ID の宣言がありません：${id}`);
  walk(ast, (node) => {
    if (namedCall(node, 'has') || namedCall(node, 'hasAny')) {
      const used = namedCall(node, 'has') ? (literal(node.arguments[0]) === undefined ? undefined : [literal(node.arguments[0])]) : arrayIds(node.arguments[0]);
      if (node.arguments.length !== 1 || !used || used.some((id) => !registered.has(id))) error('dynamicGuard', node, 'ガードの ID を一覧と照合できません');
    }
    if (namedCall(node, 'includeCase') && literal(node.arguments[1]) !== file) error('includeCaseTarget', node, 'includeCase の対象 file が一致しません');
    if (!ts.isCallExpression(node) || rootName(node) !== 'describe' || chainParent(node)) return;
    const descendants = [...declarationIds].filter(([call]) => call.getStart(ast) > node.getStart(ast) && call.end < node.end).flatMap(([, ids]) => ids);
    const guard = ts.isExpressionStatement(node.parent) ? guardOf(node.parent) : undefined;
    const guarded = namedCall(guard, 'hasAny'); const used = guarded ? arrayIds(guard.arguments[0]) : undefined;
    if (guarded && (!used || used.length !== new Set(used).size || used.length !== new Set(descendants).size || descendants.some((id) => !used.includes(id)))) error('guardMismatch', node, 'describe のガードと子孫の ID が一致しません');
    const registry = { files: { [file]: { cases } } };
    const empty = PARTITION_PLATFORMS.some((platform) => ['fast', 'slow'].some((part) => [...registered].some((id) => includeCase(registry, file, part, id, platform)) && !descendants.some((id) => registered.has(id) && includeCase(registry, file, part, id, platform))));
    if (empty && !guarded) error('unguardedDescribe', node, '空になる describe に hasAny のガードが必要です');
  });
  return errors;
}
