# Design: add-core-parsers

## API の形（仮定 A-04・A-05）

core は実行時依存ゼロ（REQ-046）で CLI を持たないため、ファイルを読む処理は持たない。パーサは「ファイル名とテキスト」を受け取り、結果とエラーを返す純粋関数にする。ファイルの走査は呼び出し側（kit）が行う。

```ts
type ParseError = { file: string; line: number; message: string };
type ParseResult<T> = { value: T; errors: ParseError[] };

parseTrace(file: string, text: string): ParseResult<Trace>
parseSpec(file: string, text: string): ParseResult<SpecRequirement[]>
parseTasks(file: string, text: string): ParseResult<Task[]>
extractTestRequirements(file: string, reportText: string): ParseResult<Record<string, string[]>> // テストファイル → 要件 ID
createTraceTemplate(options: { changeId: string }): string
```

## 試作からの引き継ぎ

`scripts/verify.mjs` の `parseTable`・`parseSpec` を出発点にする（REQ-062）。テスト走査の正規表現は引き継がない（次の節）。試作は `RENAMED` の見出しを操作として認識するが、FROM・TO の中身と行番号は扱わないため、ここで補う。

## 要件とテストの対応（Q-11・A-06）

試作はテストファイルを静的に読んで `[REQ-xxx]` を探していた。この方式では、テスト名以外の文字列、`describe.skip.each` の中のテスト、テストランナーが実行しないファイルのテストも数えてしまう（docs/review.md「コードの再レビュー」）。Q-11 の回答により、テストランナーの JSON レポートから、実際に実行して成功したテストの名前だけを読む。

`extractTestRequirements` はレポートのテキストを受け取る純粋関数とし、レポートを書き出させて読むのは呼び出し側（kit の verify）が行う（add-verify-cli の A-05）。行末の CRLF は、すべてのパーサで LF と同じに扱う。

## スキーマ

verify 結果の JSON スキーマは `packages/core/schema/verify-result.schema.json` として公開し、型定義と同じ内容にする。`schemaVersion` は `MAJOR.MINOR.PATCH` 形式の文字列で、初版は `1.0.0` とする（A-02）。
