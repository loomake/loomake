# Design: setup-monorepo

## 決めること

要件書は実行基盤（言語・テストランナー・lint）を指定していない。次の案で進めてよいか、仮定 A-01 として承認を求める。

| 項目 | 案 | 理由 |
|---|---|---|
| 言語 | TypeScript（`tsc --noEmit` で typecheck） | AGENTS.md の例と、config のテスト拡張子（ts）に合う |
| テスト | vitest | 名前に `[REQ-xxx]` を入れた `it(...)` を書く AGENTS.md の例に合う。devDependency なので N-01・N-02（実行時依存）に影響しない |
| lint | ESLint | 一般的な既定 |

## CI と verify

- 試作の `node scripts/verify.mjs` で完了ゲートを実行する。`loomake verify` ができたら置き換える（add-verify-cli 以降）
- 全 change を毎回 `--done` にかけると、未着手の change で必ず不合格になる。PR のブランチ名が `openspec/changes/<id>` と一致するときだけ `--change <id> --done` を実行し、一致しないときは品質コマンドだけ実行する（A-03、F-VER-09 と同じ挙動）
