import { describe, it, expect } from 'vitest';
import { parseTasks } from '../src/index.js';

const tasks = `## 1. 実装
- [x] 1.1 一つ目
- [ ] 1.2 二つ目
- [X] 1.3 三つ目
`;

describe('parseTasks', () => {
  it('[REQ-014] チェック済みと未チェックのタスクを、行番号つきで返す', () => {
    const { value, errors } = parseTasks('tasks.md', tasks);
    expect(errors).toEqual([]);
    expect(value).toEqual([
      { checked: true, text: '1.1 一つ目', line: 2 },
      { checked: false, text: '1.2 二つ目', line: 3 },
      { checked: true, text: '1.3 三つ目', line: 4 },
    ]);
  });

  it('[REQ-014] 行末が CRLF でも同じタスクを返し、文に \\r が残らない', () => {
    expect(parseTasks('tasks.md', tasks.replace(/\n/g, '\r\n'))).toEqual(parseTasks('tasks.md', tasks));
  });
});
