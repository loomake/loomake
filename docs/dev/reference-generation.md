# quality.yamlリファレンスの生成

利用者向けの全項目リファレンスは、`packages/core/schema/quality.schema.json` から `docs/guide/3.reference/4.quality-yaml.md` へ生成する。生成ページを直接編集せず、coreのスキーマとdescriptionを正として更新する。現行の生成対象はquality.yamlだけで、CLIの共通定義とリファレンス生成はIssue #104の後続作業である。

## 更新する順序

リポジトリのルートで、スキーマを変えたときは最初にJSON Schemaを書き出す。

```sh
pnpm --filter @loomake/core schema:write
node scripts/generate-quality-reference.mjs
node scripts/generate-quality-reference.mjs --check
pnpm exec vitest run --project unit tests/quality-reference.test.ts packages/core/test/json-schema.test.ts tests/doc-links.test.ts
```

`--check` は生成済みページの欠落・不一致・入力の読取/生成エラーを非0で返す。成功は0である。check中はファイルの作成・修復・上書きを行わない。LFとCRLFの違いだけを正規化して比較し、本文や空白の差は不一致にする。引数なしでは生成ページだけを書き出す。

## 表と元データの対応

objectの子、recordの値とキー制約、配列要素、oneOfの各分岐をたどる。requiredは親objectや配列要素が入力されたときの条件であり、任意の親を常に必須にするものではない。NAのreason/confirmed_byは、not_applicableの分岐だけで必須と表示する。

表のdefaultは入力スキーマの注記である。evidenceの親のdefault:{}と、親省略後に適用する子の既定値を区別する。試験で実際のqualityスキーマの解析結果とも照合する。descriptionがない項目は「説明未記載」とし、metric/sourceの未確定の意味を補わない。

未対応のスキーマ構造は、項目を黙って落とさず生成エラーにする。スキーマへ新しい構造を加えたときは、rendererとその期待結果を同じ変更で更新する。制約の変更には通常どおりchangeを用い、文書だけの都合でスキーマの受理範囲を変えない。

## 既存CIへの接続

`tests/quality-reference.test.ts` は既存のunitプロジェクトに含まれ、`pnpm test` で保存済みページと再生成内容を照合する。専用のCIジョブや既存のskip条件は追加しない。文書だけのPRでもgateのverifyが品質コマンドを実行するため、生成ページだけを手編集したずれを検出できる。

TSスキーマだけを変更して保存済みJSONを残した場合は、既存のcore JSON Schema一致試験が失敗する。JSONも更新して生成ページを残した場合は、リファレンス一致試験が失敗する。checkモードを試験内で使うときも読み取り専用とし、失敗を再生成で隠さない。
