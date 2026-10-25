import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const security = readFileSync(join(import.meta.dirname, '../docs/security.md'), 'utf8');

describe('セキュリティ文書の保護範囲', () => {
  it('[REQ-209] フックのリンク先と呼び出すコード、実行する権限を明記する', () => {
    expect(security).toContain('リンク先の内容と、フックから呼び出すコードは検査の対象外');
    expect(security).toContain('既存のフックと設定した品質コマンドは利用者の権限で実行する');
    expect(security).toContain('内容と依存先を信頼して確認したものを使う');
  });

  it('[REQ-209] 同じPOSIXグループと離脱した子、Windowsの保証範囲を明記する', () => {
    expect(security).toContain('同じPOSIXプロセスグループが対象');
    expect(security).toContain('別のセッションへ離脱した子は対象外');
    expect(security).toContain('Windowsでの通常終了後の子に同等の停止を保証するものではなく');
    expect(security).toContain('未実行のWindows・macOSや実Claude・GitHub接続での成功の根拠にはしない');
  });
});
