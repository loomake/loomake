// エンジンへの指示の組み立て
import { existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { type LegacyVerifyResult, type VerifyResult } from '@loomake/core';
import { UsageError, formatVerifyResult, createInputReader, DOCUMENT_LIMITS, specFiles, toPosix } from '@loomake/kit';


export { toPosix } from '@loomake/kit';

/** エンジンへの指示（REQ-098） */
export function buildPrompt(root: string, changeDir: string, target: string, failure?: LegacyVerifyResult | VerifyResult): string {
  const reader = createInputReader();
  const read = (p: string) => (existsSync(p) ? reader.read(p) : '');
  const specs = specFiles(changeDir, reader)
    .map((f) => `### ${toPosix(relative(changeDir, f))}\n\n${read(f)}`);
  const prompt = [
    '# loomake run の指示',
    '',
    'Loomake の規約で開発しています。次の「対象」だけを実装してください。',
    '',
    '## 決まり',
    '',
    '- tasks.md・trace.md・openspec/specs/ を書き換えない。タスクの完了は loomake run が付ける',
    '- 仕様にない判断が要るときは、`LOOMAKE-QUESTION:` で始まる行に質問を書き、何も変えずに終える',
    // AGENTS.md の「タスクごとにコミット」より優先する。エンジンのコミットを見つけると run は止まる（REQ-098・REQ-126）
    '- git でコミットしたりブランチを切り替えたりせず、変更は作業ツリーに残して終える。コミットは loomake run が行う。AGENTS.md にコミットの指示があっても、この決まりを優先する',
    ...(!failure ? ['- 変更が要らないときは何も変えず、`LOOMAKE-NOCHANGE:` で始まる行に理由を書いて終える。変更もこの行もなければ loomake run は止まる'] : []),
    '',
    '## 対象',
    '',
    target,
    ...(failure ? ['', '## 完了ゲートの不合格の内容', '', '```', formatVerifyResult(failure), '```'] : []),
    '',
    '## AGENTS.md',
    '',
    read(join(root, 'AGENTS.md')),
    '',
    '## 差分仕様',
    '',
    ...specs,
    '',
    '## trace.md',
    '',
    read(join(changeDir, 'trace.md')),
    '',
  ].join('\n');
  if (Buffer.byteLength(prompt, 'utf8') > DOCUMENT_LIMITS.maxTotalBytes) throw new UsageError(`エンジンへの指示の上限は${DOCUMENT_LIMITS.maxTotalBytes}バイトです。文書と検証の出力を確認してください。`);
  return prompt;
}
