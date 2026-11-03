import { describe, expect, it } from 'vitest';
import { loadVerifyQualitySchema, runVerify, verifyExitCode } from '../src/index.js';
import { CHANGE, ledgerRow, traceMd, withProject } from './project.js';

const qualitySchema = await loadVerifyQualitySchema();
const issue = 'https://github.com/example/project/issues/12';

describe('Issue 出典と既存仕様ゲートの互換', () => {
  it.each([
    ['本文 §1 2行目', '', 1], ['本文 §1 2行目', '5回', 0],
    ['コメント #issuecomment-34 作成者sample 2026-11-01 §1 3行目', '', 1],
    ['コメント #issuecomment-34 作成者sample 2026-11-01 §1 3行目', '5回', 0],
  ])('[REQ-403][REQ-034] %s 回答=%s なら終了コード%d', (source, answer, expected) => {
    const trace = traceMd({ ledger: [ledgerRow('REQ-012').replace('要件書 §1', `${issue} ${source}`)],
      questions: [`| Q-01 | REQ-012 | 何回ですか | 3 / 5 | 5 | yes | ${answer} |`] });
    const result = withProject({ trace }, (root) => runVerify({ root, qualitySchema, changeId: CHANGE, gate: 'spec-only' }));
    expect(result.run.status).toBe('completed');
    expect('checks' in result && result.checks.find((check) => check.id === '要件台帳')).toMatchObject({ result: 'PASS' });
    expect(verifyExitCode(result)).toBe(expected);
  });
});
