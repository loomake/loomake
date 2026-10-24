# コードとドキュメントのレビュー

2026-10-22・対象コミット 0229826（行番号はこの時点のもの）

以下は初回レビューとその対応記録。現在の文書を見直した結果は末尾の「ドキュメントの再レビュー」に記載する。

> この文書は、MVP を作っている途中のレビューの記録として残している。指摘の多くは試作の `scripts/verify.mjs` と `scripts/test-files.mjs` に対するもので、どちらも add-verify-cli で `loomake verify` に置き換えて消したため、リンク先はもう無い。いまの使い方は [usage.md](usage.md)、いまの仕様は `openspec/specs/` を参照。

## コードのレビュー

`pnpm lint`・`pnpm typecheck`・`pnpm test`（12 件）と `verify --change setup-monorepo --done` は通りました。一方、`pnpm build` は失敗します。重大度の高い順に挙げます。

### 高

1. `pnpm build` が `packages/cli` で失敗する（[packages/cli/src/cli.ts:4](../packages/cli/src/cli.ts#L4)、TS2591: `process` が見つからない）
   - TypeScript 6 では `types` の既定値が空になりました。ルートの [tsconfig.json](../tsconfig.json) は `"types": ["node"]` を持ちますが、ビルド用の `tsconfig.build.json` が継ぐ [tsconfig.base.json](../tsconfig.base.json) にはありません。
   - typecheck はルートの tsconfig を使うので、CI では見つかりません。[release.yml](../.github/workflows/release.yml) は `pnpm build` を実行するので、公開の時点で初めて失敗します。
   - 対処：`tsconfig.base.json` に `"types": ["node"]` を入れ、CI に `pnpm build` を足す。

2. skip したテストが要件のテストとして数えられる（[scripts/verify.mjs:230-236](../scripts/verify.mjs#L230-L236)）
   - skip の判定は行単位です。`describe.skip('…', () => {` の行だけが除かれ、中の `it('[REQ-001] …')` は数えられます。
   - コメントの `// [REQ-001]` も数えられます。
   - 「テストを skip して完了ゲートを通す」ことを防ぐ検査なので、抜け道になります。add-core-parsers の spec（REQ-015）の Scenario も `it.skip` 単体しか扱っていないため、`describe.skip` の中のテストとコメントのシナリオを spec に足すのがよいと考えます。

### 中

3. ブランチ名が `archive` の PR で完了ゲートが必ず失敗する（[scripts/ci-gate.mjs:13-14](../scripts/ci-gate.mjs#L13-L14)）
   - `openspec/changes/archive/` もディレクトリなので、`--change archive --done` が実行されます。`archive` を除くか、`proposal.md` があるかで判定するとよいです。

4. 手動のリリースに安全策がない（[release.yml](../.github/workflows/release.yml)）
   - `workflow_dispatch` は任意のブランチから実行できます。`github.ref == 'refs/heads/main'` の条件がありません。
   - いまは各パッケージが `0.0.0` のままで、`.changeset/initial-packages.md` も残っています。この状態で実行すると、`changeset version` を経ずに `0.0.0` を公開します。`pnpm changeset status` で未消化の changeset があれば止める手順を入れるとよいです。
   - `id-token: write` を付けていますが、provenance を有効にしていないので使われていません。

5. Node 20.19 で動くことを確かめていない
   - `engines.node` は `>=20.19.0`（REQ-048、N-03「動作すること」）ですが、CI は Node 24 だけです。matrix に Node 20 を足さないと、宣言どおりに動くかが分かりません。

### 低

6. [verify.mjs](../scripts/verify.mjs) の細かい点
   - `parseTable` は `|` で単純に分けるので、セルの中のコードに `|` があると列がずれます（[verify.mjs:77](../scripts/verify.mjs#L77)）。
   - `spawnSync` の出力上限（既定 1MB）を超えると、コマンドが成功していても不合格になります（[verify.mjs:255](../scripts/verify.mjs#L255)）。
   - `loomake.config.json` の JSON が壊れていると、終了コード 2 ではなくスタックトレースで終わります。
   - いずれも add-core-parsers / add-verify-cli で core に移すときに直せば十分です。

7. CI の `gate` ジョブで `@fission-ai/openspec` の版を固定していない（[ci.yml:45](../.github/workflows/ci.yml#L45)）。OpenSpec の更新で `validate` の結果が変わると、コードを変えていない PR が落ちます。

8. [devcontainer.json](../.devcontainer/devcontainer.json) のコメントが古い（「Node.js 22」、「(gh)p」の誤字、使っていない image の行）。

## ドキュメントのレビュー

### 実際と食い違っているもの

1. [README.md](../README.md) が、モノレポになる前の「キット単体」の説明のままです。
   - 題が「Loomake kit（最小セット）」で、「将来はモノレポ `loomake/loomake` の `packages/kit` になる」と書いていますが、このリポジトリはすでにそのモノレポです。
   - ファイル一覧に `packages/`、`tests/`、`scripts/ci-gate.mjs`、`.github/`、`.changeset/`、`docs/flow.md` がありません。
   - 「導入」の「このフォルダの中身をプロジェクトのルートにコピー」は、利用者向けの手順です。このリポジトリで開発する人向けの手順（`pnpm install`、品質コマンド、CI、リリース）がありません。

2. [docs/flow.md:106](flow.md#L106) の `git commit -am` では、archive の結果を取りこぼします。`openspec archive` は `openspec/specs/` と `changes/archive/` に新しいファイルを作りますが、`-a` は追跡していないファイルを含めません。`git add -A openspec && git commit` にする必要があります。

3. [docs/flow.md:123](flow.md#L123) の `pnpm loomake verify` は、このままでは動きません。ルートの package.json は `loomake` に依存しておらず、`loomake` という script もありません。build も前提になります。

4. JSON スキーマの版のキー名が食い違っています。[docs/architecture.md:71](architecture.md#L71) は `version`、要件定義書の F-CORE-06・N-08 と add-core-parsers は `schemaVersion` です。

5. change の一覧に add-kit-assets がありません。[docs/flow.md](flow.md) 7 章の表は 4 つの change だけですが、実際は 5 つあり、add-init-cli は add-kit-assets を前提にしています。[docs/architecture.md](architecture.md) 4 章の構成図にも `packages/cli` がありません。

6. Skill の置き場所が change の文書と合っていません。コミット 6b54386 で実体を `.agents/skills/` に移し、`.claude/skills/` はシンボリックリンクにしました。一方、add-init-cli の spec（REQ-019・REQ-021）と A-02 は「`.claude/skills/` に置き、`--codex` のときだけ `.agents/skills/` にも置く」となっています。REQ-062 の反映先と add-kit-assets のタスク 1.1 も `.claude/skills/req-to-openspec/` を指しています。どちらの配置を `init` で配るかを決め、change の文書を直す必要があります。

### 要件の読み方で確認したいもの

7. CLI のパッケージ名 `loomake` はスコープなしですが、N-11（REQ-056）は「npm の `@loomake` スコープで公開すること」です。Q-01 の回答（独立パッケージ）とこの要件の関係を、確認事項として残すとよいです。

8. setup-monorepo の A-07（読み取り用ツールを pandoc・poppler-utils・xlsx2csv にする）が未承認です。ゲートは警告で通りますが、REQ-061 の実装がこの仮定に依っているので、PR の前に承認するのがよいです。

9. setup-monorepo の spec の「engines が宣言されている」の Scenario は、ルート・core・kit の 3 つしか挙げていません。テストは `packages/cli` も確かめているので、Scenario に cli を足すと合います。

### 細かいもの

- 要件定義書の「前提資料：Project 資料『loomake-architecture.md』」は、リポジトリでは `docs/architecture.md` です。
- [docs/flow.md](flow.md) の「試作キット（loomake-kit.zip の中身）」と `mkdir -p packages/{core,kit}` は、いまの構成（cli あり、zip なし）と合いません。初回の手順として残すなら、当時の手順だと注記するとよいです。
- README は verify.mjs を「Node 20.19+」、verify.mjs の冒頭は「Node 20+」と書いています。
- setup-monorepo の trace.md の仮定の並びが A-05、A-07、A-06 の順になっています。


## 対応状況

| 指摘 | 対応 |
|---|---|
| コード 1 | `tsconfig.base.json` に `"types": ["node"]` を入れ、ルートの `tsconfig.json` から同じ設定を外した。CI の quality ジョブに `pnpm build` を足した |
| コード 2 | `verify.mjs` で、コメントと、skip・todo を指定した呼び出しの括弧の中（`describe.skip` の中身を含む）を数えないようにした。add-core-parsers の spec（REQ-015）に、`describe.skip` の中とコメントの Scenario を足した。回帰テストは `tests/verify.test.ts` |
| コード 3 | `ci-gate.mjs` でブランチ名 `archive` を change として扱わないようにし、テストを足した |
| コード 4 | release を main だけで動かす条件と、未消化の changeset があれば止める手順を足し、使っていない `id-token: write` を外した |
| コード 5 | CI に node20 ジョブを足した。vitest・eslint・changesets は Node 22 以上を求めるので、インストールとビルドは Node 24 で行い、Node 20.19.0 でビルドした CLI と `verify.mjs --spec-only` を動かす |
| コード 6 | 表のセルの `\|` を文字として読むようにした。コマンドの出力上限を 64MB にした。`loomake.config.json` が読めないときは終了コード 2 で終わるようにした |
| コード 7 | CI の OpenSpec を 1.14.3 に固定した |
| コード 8 | コメントを Node 24 に直し、誤字と使っていない image の行を消した |
| ドキュメント 1 | README をモノレポ向けに書き直した |
| ドキュメント 2・3 | flow.md の archive の手順を `git add -A openspec` に直した。CLI の実行方法を `node packages/cli/dist/cli.js` に直した |
| ドキュメント 4・5 | architecture.md を `schemaVersion` にそろえ、構成図に `packages/cli` を足した。flow.md の change の表に add-kit-assets を足した |
| ドキュメント 6 | add-init-cli の Q-09 で、spec のまま（`.claude/skills/` に置き、`--codex` のときは `.agents/skills/` にも複製する）と決まった。add-init-cli の spec と A-02 は変えていない。REQ-062 の反映先、add-kit-assets の proposal・design・タスク 1.1 は、Skill の実体がある `.agents/skills/req-to-openspec/` を指すように直した |
| ドキュメント 7 | setup-monorepo の Q-10 で、`loomake` を例外とすると決まった。要件書 v0.3 で N-11 を改訂し、REQ-056 の出典を v0.3 にした |
| ドキュメント 8 | 要件書 v0.4 で、要件書を Markdown に限った（製品としても）。読み取り用ツールは devcontainer から外し、A-07 は取り下げた。setup-monorepo の spec とテスト、add-kit-assets の spec（REQ-025・REQ-059）も合わせて直した |
| ドキュメント 9 | setup-monorepo の spec の Scenario に `packages/cli` を足した |
| 細かいもの | 要件書 v0.3 で、前提資料の参照先を `docs/architecture.md` に直した。flow.md の 0 章には、立ち上げ時の記録だと書き足した。verify.mjs の冒頭を「Node 20.19+」にした。仮定の並びを A-06、A-07 の順にした |


## ドキュメントの再レビュー

2026-10-22・対象コミット 66cb0da と今回の文書修正。

### 修正した内容

- README：最新の要件書 v0.4 へのリンクを追加し、パッケージの役割が実装予定であることを明記しました。開発環境は Node 24、配布物の実行環境の下限は Node 20.19 と区別しました。
- README・flow：完了ゲートを実行する条件を、PR のブランチ名が change-id と一致する場合と明記しました。不一致の場合と `archive` は品質コマンドだけを実行します。flow には、必須チェックの設定を人が行うことも追記しました。
- README：完了ゲートの品質コマンドに build が含まれないことと、release を main から実行し、未消化の changeset があれば止まることを明記しました。
- flow：要件書の例を v0.4 に更新しました。仕様ゲートが失敗したときは、確認事項への回答を trace と差分仕様に反映する手順に直しました。5 つの change が作成済みで、setup-monorepo 以外は未実装と追記しました。
- architecture：将来の構成を含むことと、trace・runner が MVP の範囲外であることを明記しました。`init` は未実装と追記しました。

### 要件書に残る不整合

1. **中：N-02 と承認済みの依存関係が一致しません。** [要件書 v0.4 の 6 章](requirements/mvp-v0.4.md#6-非機能要件)は、kit と loomake の実行時依存を core のみとしています。一方、[add-verify-cli の Q-08](../openspec/changes/add-verify-cli/trace.md#確認事項)では loomake は core と kit に依存してよいと回答済みで、[差分仕様](../openspec/changes/add-verify-cli/specs/verify/spec.md#requirement-実行時依存の範囲)にも反映されています。次の改版で N-02 にこの回答を反映することを推奨します。
2. **中：8 章が回答済みの事項も未決と説明しています。** [要件書 v0.4 の 8 章](requirements/mvp-v0.4.md#8-未決事項)は「次の 5 件は本書の時点で決めていない」としていますが、Q-01 は [setup-monorepo の trace](../openspec/changes/setup-monorepo/trace.md#確認事項)、Q-04・Q-05 は [add-verify-cli の trace](../openspec/changes/add-verify-cli/trace.md#確認事項)で回答済みです。Q-02 は v0.4 で不要になりました。Q-03 の回答欄は空で、非ブロッキングの確認事項として残っています。次の改版で回答状況と参照先を整理することを推奨します。
3. **低：Markdown に限定した後も「シート」が残っています。** [要件書 v0.4 の F-REQ-02](requirements/mvp-v0.4.md#52-req-to-openspec-skill)と [add-kit-assets の REQ-026](../openspec/changes/add-kit-assets/specs/req-to-openspec-skill/spec.md#requirement-台帳づくりの手順)は、出典を「文書名・章またはシートと行」としています。Markdown の出典表記をどう定めるか、要件書と差分仕様を合わせて整理することを推奨します。

過去版の要件書は trace の出典なので書き換えていません。上記の指摘は要件書と change の整合性を直すための記録であり、今回、規範文や承認内容は変更していません。

### 予定済みの作業と前提

- [req-to-openspec の試作 Skill](../.agents/skills/req-to-openspec/SKILL.md)には Word・Excel・PDF の読み取り手順が残っています。これは Markdown だけを扱う確定済みの仕様と異なりますが、[add-kit-assets のタスク 1.2・1.6](../openspec/changes/add-kit-assets/tasks.md)で修正する予定です。最新版の製品仕様を確認するときは、試作 Skill と差分仕様を区別します。
- ブランチ保護の設定は setup-monorepo の仮定 A-03 に従って人が行います。今回、GitHub 上の設定状態は確認していません。

### 対応状況

| 指摘 | 対応 |
|---|---|
| 要件書 1 | 要件書 v0.5 で N-02 を直し、`loomake` の実行時依存を core と kit にしました。add-verify-cli の REQ-047 の出典を v0.5 にしました |
| 要件書 2 | v0.5 の 8 章を、回答状況と参照先の表にしました。Q-03 は未回答（非ブロッキング）のまま残しています |
| 要件書 3 | v0.5 の F-REQ-02 と、add-kit-assets の REQ-026（台帳と差分仕様）の出典の書き方を「文書名・章と行」にしました |

README・flow・architecture にある最新の要件書へのリンクも v0.5 に直しました。


## コードの再レビュー

2026-10-22・対象コミット 66cb0da。実装済みの `scripts/`、パッケージの雛形、テスト、CI・release の設定を確認した。未実装の core・kit・CLI の機能は不具合として数えていない。修正コードは加えていない。

### 指摘

1. **[P1] テスト名以外の文字列も要件のテストとして数える。** [scripts/verify.mjs の 278 行目](../scripts/verify.mjs#L278)は、コメントと一部の skip 呼び出しを除いたソース全体から要件 ID を抽出する。例えば `const fixture = '[REQ-001]'; it('fixture', () => expect(fixture).toBeTruthy());` だけでも REQ-001 をテスト済みとする。要件 ID を名前に持つテストがなくても完了ゲートが通るため、AGENTS.md の DoD と REQ-038 の判定を満たさない。抽出対象を有効なテストの名前に限定する必要がある。
2. **[P1] `describe.skip.each` 内のテストが除外されない。** [scripts/verify.mjs の 161 行目](../scripts/verify.mjs#L161)は、`skip`・`todo` の直後に開き括弧がある呼び出しだけを除外する。`describe.skip.each([1])('skipped %s', () => { it('[REQ-001] skipped', () => expect(true).toBe(false)); });` は残る。無関係の正常なテストを併記すると、Vitest は 1 件成功・1 件 skip で終了コード 0、verify も終了コード 0 になる。skip をテストとして数えないという既存の決まりを守るため、修飾子が連なる呼び出しも扱う必要がある。
3. **[P1] verify の走査対象と Vitest の実行対象が一致しない。** [scripts/verify.mjs の 275 行目](../scripts/verify.mjs#L275)は `loomake.config.json` の dirs・pattern でファイルを選ぶが、[vitest.config.ts の 5 行目](../vitest.config.ts#L5)は `tests/**/*.test.ts` と `packages/*/test/**/*.test.ts` だけを実行する。例えば `packages/core/src/ignored.test.ts` に、名前が `[REQ-001]` で必ず失敗するテストを置いても実行されず、別の正常なテストだけで test コマンドは成功する。verify はその未実行ファイルを REQ-001 のテストとして数えて合格する。実行されるテストと要件対応の走査対象を一致させる必要がある。
4. **[P2] CRLF の正常な差分仕様を解析できない。** [scripts/verify.mjs の 103〜109 行目](../scripts/verify.mjs#L103)は改行を `\n` だけで分割し、末尾の `\r` を残したまま `^### Requirement:…$` と照合する。そのため CRLF の Requirement が取り出せず、「反映済の要件が仕様にある」で不合格になる。同じ仕様を LF にすると合格し、CRLF のままでも `openspec validate c1 --strict` は成功した。Windows の改行で保存した正常な change を拒否するため、行末を正規化してから解析する必要がある。Source 行にも同じ末尾の問題がある。

### 再現と検証

一時ディレクトリに REQ-001 の仕様・台帳・完了済みタスクを持つ最小の change を作り、実際の verify とインストール済みの Vitest を実行した。リポジトリのテストや設定は変更していない。再現用の設定では、OpenSpec 検証と品質コマンドを切り分けるため `openspecValidate: false`、commands は test だけにした。CRLF の仕様は別途 OpenSpec の strict 検証を実行し、成功を確認した。

| ケース | verify の終了コード | Vitest の結果 | 判定 |
|---|---|---|---|
| 対照：名前に REQ-001 を持つ通常のテスト | 0 | 2 件成功 | 正常 |
| 要件 ID がデータ文字列にだけ存在 | 0 | 2 件成功 | 要件のテストがないのに合格 |
| `describe.skip.each` の中にだけ要件のテストが存在 | 0 | 1 件成功・1 件 skip | skip した要件のテストを数える |
| Vitest の対象外ファイルにだけ要件のテストが存在 | 0 | 無関係の 1 件だけ成功 | 実行していない要件のテストを数える |
| 対照と同じ差分仕様を CRLF に変更 | 1 | 2 件成功 | 正常な仕様を誤って拒否 |

既存の `node scripts/verify.mjs --change setup-monorepo --done` と `pnpm build` はどちらも exit 0。既存の回帰テストは上記のケースを含んでいない。再現スクリプトは今回の環境の `/tmp/loomake-code-review/reproduce.mjs` に保存した。

### 次の対応

修正時は、既存 change の仕様と照合し、必要な Scenario を追加してから、上記ケースの回帰テストを用意する。設定の変更には AGENTS.md 4 章の規約が適用される。今回、新しい仕様や仮定は加えていない。


## 修正後のコードレビュー

2026-10-22・対象コミット 0b2e45d。主に 6f9ccf1 の修正と、それ以降の承認済みの方針を確認した。コードと設定は変更していない。

### 新たに確認した指摘

1. **[P1] skip の呼び出しに修飾子や改行が入ると、skip したテストを数える。** [scripts/verify.mjs の 228〜240 行目](../scripts/verify.mjs#L228)は `describe.skipIf(true)` の閉じ括弧まで進むが、次の `.each` を読まずに終了する。そのため `describe.skipIf(true).each([1])('skip %s', () => { it('[REQ-001] skipped', () => expect(true).toBe(false)); });` の中の要件 ID が残る。無関係の正常なテストを併記すると、Vitest は 1 件成功・1 件 skip で終了コード 0、verify も終了コード 0 になる。また、[223 行目の正規表現](../scripts/verify.mjs#L223)は `describe` と `.skip` の間の空白や改行を扱わないため、`describe` の次の行を `.skip(...)` にした場合も同じ誤集計を再現した。通常の `describe.skip.each` は修正されているが、これらの書き方では完了ゲートが誤って合格する。
2. **[P2] if の直後の正規表現を割り算とみなし、後続の有効なテストまで除外する。** [scripts/verify.mjs の 177〜180 行目](../scripts/verify.mjs#L177)は `/` の前が `)` の場合に正規表現ではないと判定する。`describe.skip('skipped', () => { if (true) /\(/.test('('); });` の後に、正常な `it('[REQ-001] active', ...)` を置くと、正規表現中の開き括弧を skip 呼び出しの括弧として数える。その結果、skip の終わりを見つけられず、後続の有効なテストも消してしまう。Vitest は 2 件成功で終了コード 0 だが、verify は「テストが無い要件：REQ-001」として終了コード 1 になった。

### 前回の指摘の状態

| 前回の指摘 | 再確認した結果 |
|---|---|
| テスト名以外の文字列を数える | 残っている。Q-11 と作業記録の方針に従い、add-core-parsers・add-verify-cli の JSON レポート方式への移行で対応予定。今回の新規指摘には数えていない |
| `describe.skip.each` を除外しない | 通常の書き方では要件 ID が除外され、verify が終了コード 1 になることを確認。上記の修飾子・改行のケースは残る |
| リポジトリの走査対象と Vitest の実行対象のずれ | 現行の vitest.config.ts をコピーした一時プロジェクトで再確認。`packages/core/src/ignored.test.ts` の失敗するテストも実行され、verify が不合格になる。利用者が独自に実行対象を変更する場合の判定は JSON レポート方式で対応予定 |
| CRLF の仕様を拒否する | LF と CRLF の両方で対照ケースが合格し、修正を確認 |

### 検証と次の対応

- `node scripts/verify.mjs --change setup-monorepo --done` と `pnpm build` はどちらも exit 0。
- 再現は Linux の一時ディレクトリで実施し、現在の Vitest 設定を使用した。リポジトリのテストや設定は変更していない。再現用の設定は commands を test だけ、OpenSpec 検証を無効にし、テスト対応の判定を切り分けた。
- 再現スクリプトと結果は `/tmp/loomake-code-rereview/` に保存した。コードの修正時は、上記ケースを回帰テストに追加するか、既に承認済みの JSON レポート方式への移行で解消したことを確認する。


## タスク 1.11 の修正後レビュー

2026-10-22・対象コミット 8998430。共有ファイル探索処理・設定の検証・skip 判定の変更を確認した。コードと設定は変更していない。

### 新たに確認した指摘

1. **[P2] テスト用の dist 除外が差分仕様の探索にも適用される。** [scripts/test-files.mjs の 50 行目](../scripts/test-files.mjs#L50)で `dist` を無条件に探索対象から外しているが、[scripts/verify.mjs の 293 行目](../scripts/verify.mjs#L293)もこの `walk` を仕様ファイルの探索に使う。そのため、capability 名が `dist` の正常な `openspec/changes/c1/specs/dist/spec.md` を読めず、仕様ゲートが「specs/<capability>/spec.md がありません」と「反映済の要件が仕様にある」で不合格になる。同じ入力で OpenSpec の strict 検証と変更前の verify は終了コード 0、変更後の verify は 1 になることを確認した。ビルド出力の除外はテストファイルを選ぶ場合に限定し、仕様ファイルの探索には適用しないようにする必要がある。

### 既知の指摘と修正の確認

- 前回の P1（`describe.skipIf(true).each(...)` と、describe と .skip の間の改行）は未修正。今回も Vitest が 1 件成功・1 件 skip、verify が誤って合格することを確認した。
- 前回の P2（if の直後の正規表現を誤解析し、skip 呼び出しの後の有効なテストまで除外する）も未修正。今回も Vitest が 2 件成功、verify が不合格になった。
- テスト名以外の文字列を数える既知の問題は残る。JSON レポート方式への移行で対応する方針は変更されていない。
- 通常の skip.each と CRLF のケースは期待どおりの結果だった。現行の共有ファイル選択処理では、以前実行されなかった `packages/core/src/ignored.test.ts` も実行され、失敗を検出した。
- glob の記号を含むパス（`tests/[id]/`・`tests/(group)/`・`tests/{a,b}/`）でも実行漏れを疑って確認したが、どのケースも失敗するテストを実行して不合格になった。これらは指摘として残していない。

### 検証と次の対応

- `node scripts/verify.mjs --change setup-monorepo --done` と `pnpm build` はどちらも exit 0。
- 再現は Linux の一時プロジェクトで、現行の vitest.config.ts と scripts/test-files.mjs をコピーして行った。再現用の品質コマンドは test だけとし、OpenSpec 検証は切り分けて実行した。リポジトリのテスト・設定は変更していない。
- 再現スクリプトと結果は `/tmp/loomake-review-8998430/` に保存した。新規の指摘は、仕様探索とテスト探索で除外条件を分ける修正と回帰テストが必要。前回の指摘を試作で直すか JSON レポート方式への移行で解消するかは、作業記録 14 節の残件のまま。


## /code-review（タスク 1.11 の修正後）

2026-10-22・対象コミット 8998430。Claude Code の /code-review で出た10件の指摘を、重い順に記録する。上の「タスク 1.11 の修正後レビュー」と重なるものは、その旨を書いた。

### 指摘

1. **テストファイルのパスを、エスケープせずに Vitest の include に渡している。** [vitest.config.ts の 12 行目](../vitest.config.ts#L12)。`tests/pages/[id].test.ts` のような名前が glob の文字クラスとして読まれ、実行されないのに verify は数える、という指摘。Vitest 5.0.5 で `tests/zz/[id].test.ts` と `tests/zz/(g)/x.test.ts` を置いて確かめたところ、どちらも実行された。上の「タスク 1.11 の修正後レビュー」の確認とも合うので、再現しないものとして扱う。
2. **dist の除外が、差分仕様の探索にも掛かる。** [scripts/test-files.mjs の 50 行目](../scripts/test-files.mjs#L50)。上の「タスク 1.11 の修正後レビュー」の指摘1と同じ。
3. **Vitest のオプションで skip したテストを数える。** [scripts/verify.mjs の 202 行目](../scripts/verify.mjs#L202)。`it('[REQ-012] ...', { skip: true }, fn)`、`{ todo: true }`、`ctx.skip()` を呼ぶテストは、実行されないのに要件のテストとして数えられる。
4. **テンプレートの `${...}` の中の正規表現とコメントを読めない。** [scripts/verify.mjs の 139 行目](../scripts/verify.mjs#L139)。``const s = `${v.replace(/'/g, '')}`;`` では、正規表現の中の `'` を文字列の始まりとみなし、テンプレートが閉じないまま次のバッククォートまで opaque になる。その範囲の `it.skip` を見逃す。
5. **後置の `++`・`--` のあとの `/` を、正規表現の始まりとみなす。** [scripts/verify.mjs の 157 行目](../scripts/verify.mjs#L157)。`n++ / 2; it.skip('[REQ-021] x', () => {}); const r = a / b;` では、`it.skip` が opaque に入って見逃される。
6. **skip の呼び出しの次の行の文まで空白にする。** [scripts/verify.mjs の 208 行目](../scripts/verify.mjs#L208)。セミコロンを書かないコードで、`it.skip(...)` の次の行が `(` やテンプレートリテラルで始まると、その文を skip の続きとみなして消す。中に有効なテストがあれば、その要件 ID を数えず、`--done` が誤って失敗する。
7. **`openspecValidate` の値を確かめていない。** [scripts/test-files.mjs の 42 行目](../scripts/test-files.mjs#L42)。`"openspecValidate": "false"`（文字列）は検査を通り、ほかの形の誤りと違って終了コード 2 にならない。
8. **設定ファイルがないとき、既定値のオブジェクトを複製せずに返す。** [scripts/test-files.mjs の 19 行目](../scripts/test-files.mjs#L19)。呼び出し側が返された設定を変えると、同じプロセスのあとの `loadConfig` にも変更が残る。
9. **テストの一時ディレクトリを `try/finally` で消していない。** [tests/verify.test.ts の 14 行目](../tests/verify.test.ts#L14)。途中で例外が起きると、`loomake-verify-*` が tmpdir に残る。
10. **changeset の比較で、古いローカルの `main` を優先する。** [tests/monorepo.test.ts の 84 行目](../tests/monorepo.test.ts#L84)。ローカルの `main` が `origin/main` より古いと、REQ-056 のテストの結果が CI と変わる。

### 修正の対象

指摘1は再現しないので直さない。指摘6も直さない。JavaScript は、行末にセミコロンがなく次の行が `(` やテンプレートリテラルで始まるとき、セミコロンを補わずに前の行の続きとして読む。今の verify の動きはこの仕様どおりである。指摘2〜5・7〜10と、上の「修正後のコードレビュー」の未修正の2件（skipIf のあとの each と describe と .skip のあいだの改行、if の直後の正規表現）を、setup-monorepo のタスク 1.12 として直す。テスト名以外の文字列を数える問題は、これまでどおり JSON レポート方式への移行で対応する。

### 対応

setup-monorepo のタスク 1.12 で直した。

| 指摘 | 対応 |
|---|---|
| 2（dist の除外が仕様の探索に掛かる） | `walk` に、飛ばすディレクトリの名前を渡せるようにした。`dist` を飛ばすのはテストファイルを選ぶときだけ。回帰テストは、capability `dist` の spec.md を読めることを確かめる |
| 3（オプションの skip・todo、ctx.skip()） | `{ skip: true }`・`{ todo: true }` を渡した呼び出しと、中で `skip()` を呼ぶテストを数えない。`{ skip: false }` は数える |
| 4（テンプレートの中の正規表現） | `${...}` の中のコメントと正規表現リテラルを読み飛ばす |
| 5（後置の `++`・`--`） | そのあとの `/` を割り算とみなす |
| 7（`openspecValidate`） | true・false・`"auto"` 以外なら終了コード 2 |
| 8（既定値を複製しない） | 呼ぶたびに新しい既定値のオブジェクトを作る |
| 9（一時ディレクトリが残る） | `try/finally` で消す |
| 10（古いローカルの `main`） | `origin/main` を優先し、ないときだけ `main` と比べる |
| 前回の P1（skipIf のあとの each、改行してからの .skip） | 閉じ括弧のあとの `.each` なども skip の続きとして空白にする。`describe` と `.skip` のあいだの空白と改行も扱う |
| 前回の P2（if の直後の正規表現） | 閉じ括弧の対の開き括弧の前が if・while・for・with なら、続く `/` を正規表現とみなす |

再現ケースは tests/fixtures/verify-project/tests/skip.case.txt の REQ-017〜025。修正前の verify は REQ-017〜022 を数え、REQ-023・024 を数えなかった。修正後は、数えるべき REQ-023・024 だけを新たに数える。`node scripts/verify.mjs --change setup-monorepo --done` は exit 0（lint・typecheck・test 18件も合格）。


## 2026-10-23 全体レビュー（コード・ドキュメント・セキュリティ）

対象：現行の core・kit・CLI、テスト、CI・release、配布テンプレート、README・利用ガイド・開発手順・仕様。開始時の HEAD は 526f207、レビュー中に文書の更新が入り、最終確認時の HEAD は 93cbbda。利用者の文書編集は保全し、コードと設定は変更していない。今回は差分だけでなくリポジトリ全体を対象にした。

### 指摘

1. **[P1・セキュリティ／文書] CI の例がブランチ名をシェルへ直接埋め込む。** [docs/usage.md:214](usage.md#L214) の `run: npx loomake verify --change "${{ github.head_ref }}" --done` は、GitHub の式がシェルの実行前に置換される。Git が許可するブランチ名にコマンド置換を含めると、二重引用符の中でも実行される。実行されるコマンドを printf に置き換え、Git のブランチ名の検証と、一時マーカーファイルの作成を確認した。この例を PR のワークフローにコピーした利用者の CI で意図しないコマンドが動くため、実際の ci.yml と同じようにブランチ名を env に渡し、run 内では `--change "$HEAD_REF"` と参照する必要がある。現行の ci.yml 自体は env 経由になっている。
2. **[P1・セキュリティ／コード] init がシンボリックリンクをたどり、プロジェクト外へ読み書きする。** [packages/kit/src/init/init.ts:106](../packages/kit/src/init/init.ts#L106) の existsSync はリンク先が無いと false を返し、後段の writeFileSync はリンクをたどる。そのため、AGENTS.md をプロジェクト外の未作成ファイルへのリンクにすると、確認を求めず、終了コード 0 でそのファイルを作る。既存ファイルへのリンクの場合も、承認前にその外部ファイルの内容を差分へ出すことを、合成した無害な文字列で確認した。リンク自体と親ディレクトリを検査し、読み書き先がプロジェクト外へ出る場合や、リンク先が存在しない場合は処理を止める必要がある。
3. **[P1・コード／仕様ゲート] trace の解析エラーを捨て、未回答の確認事項を見落とす。** [packages/kit/src/verify/run.ts:111](../packages/kit/src/verify/run.ts#L111) は parseTrace の value だけを使い、errors を結果に反映しない。未回答のブロッキング確認事項を持つ trace.md は通常不合格だが、節名を `## 確認事項（未回答）` に変えるだけで、core が「確認事項の節がない」とエラーを返しているのに、verify は「未回答 0 件」で合格する。parseTrace の errors をゲートの失敗として記録する必要がある。同じく parseSpec の errors も呼び出し側で捨てられているため、併せて扱いを確認する。関連する規約：[AGENTS.md:20](../AGENTS.md#L20)「ブロッキングな確認事項が未回答なら、ここで失敗する」。

### 検証結果

- `pnpm lint`・`pnpm typecheck`・`pnpm test`（118 件）・`pnpm build` がすべて exit 0。
- `pnpm audit --json` が exit 0。照合時点の既知の脆弱性は info・low・moderate・high・critical がいずれも 0 件。これだけで未知の脆弱性がないとは判断していない。
- 一時プロジェクトの仕様ゲート：通常の未回答 trace は不合格、節名を変更した trace は core がエラーを返すにもかかわらず合格。
- init：外部への存在しないリンク先を作ることと、既存のリンク先の内容を差分に含めることを確認。実際の秘密情報は使っていない。
- CI の例：Git が受け付けるブランチ名で、シェルのコマンド置換により一時ファイルが作成されることを確認。GitHub Actions 上では実行していない。
- 再現コード・結果・audit の出力は `/tmp/loomake-full-review/` に保存した。Windows 上の実行は検証していない。

### 既知の問題と次の対応

過去に指摘したテストソースの静的解析と dist 除外の問題は、現在は試作コード自体が廃止され、テストランナーの JSON レポートを読む実装になっている。今回、それらを現在の指摘として再掲していない。修正時は各指摘を既存仕様と照合し、必要な Scenario と回帰テストを用意する。新しい要件や仮定は今回追加していない。

### 対応

| 指摘 | 対応 |
|---|---|
| 1（CI の例のブランチ名） | docs/usage.md の例を、ブランチ名を `env` の `HEAD_REF` で渡し、`run` では `--change "$HEAD_REF"` と参照する形に直した。`${{ github.head_ref }}` を `run` に直接書かない理由も書き添えた |
| 2（init がシンボリックリンクをたどる） | change harden-init-and-trace-check で直した。置き先（途中のディレクトリを含む）がリンクを通ってプロジェクトの外を指すときと、リンク先の無いリンクのときは、既存ファイルを読まず、差分も出さずに、何も置かずに終了コード 1 で中止する。プロジェクトの中を指すリンクは、これまでどおりたどる（仮定 A-01） |
| 3（trace の解析エラーを捨てる） | 同じ change で直した。仕様ゲートに「trace.md の解析」「spec.md の解析」の検査を足し、core が返す解析エラーをファイル名・行番号つきで不合格にする（仮定 A-02） |

回帰テストは packages/cli/test/init.test.ts と packages/kit/test/verify.test.ts に足した。修正前のコードでは新しいテストのうち 6 件が落ちることを確かめた（プロジェクトの中を指すリンクの 1 件は、修正前後とも合格する）。`pnpm -s verify --change harden-init-and-trace-check --done` は exit 0（test 125 件）。仮定 A-01・A-02 は 2026-10-23 に承認された。

## 2026-10-23 試験プロジェクトでの kit の試用

対象：`.trial/`（loomake とは別の git リポジトリ）に、ビルドした CLI で `loomake init` と `openspec init` をかけ、利用者が置いた `.trial/docs/requirements/kit-v1.0.md` を、init が配った req-to-openspec Skill の手順で change にした。作った change は add-kit-init・add-req-to-openspec-skill・add-kit-verify の 3 つ（`.trial` の 03e9d9c）。経過は [作業記録 2026-10-22 の 35 節](worklog/2026-10-22.md) にある。

### 指摘

1. **init が案内する `npx loomake verify` が動かない。** AGENTS.md・Skill・tasks.md の雛形は `npx loomake verify` を使うよう書いているが、init はプロジェクトに loomake を入れず、案内もしない。公開前の試験では npm の 404 で失敗した。公開後も、プロジェクトに入れていなければ実行のたびに最新版を取りにいき、検査に使う版が固まらない。
2. **package.json がなくても、init は commands に `npm run lint` などを書く。** そのままでは完了ゲートの commands が必ず失敗するが、init は何も知らせない。
3. **Skill に、フェーズが後の要件の扱いがない。** 今回は作らないが範囲外でもない要件（kit-v1.0.md のフェーズ「次」の 12 行）を、どの状態にするかが Skill から決まらない。
4. **Skill に、複数の change に分けるときの番号の振り方がない。** REQ・Q・A を change ごとに振るか要件書で通すかと、複数の change にかかわる非機能要件の載せ方が決まらない。今回は loomake 本体の change にならい、通し番号にして、かかわる change の台帳それぞれに同じ行を載せた。
5. **同じ Q を 2 つの change の trace.md に載せると、回答の食い違いに気づけない。** verify は change ごとに trace.md を読むので、片方だけに回答を書いても、もう片方と食い違っても報告しない。
6. **Skill に、要件書の中の未決事項の章の扱いがない。** kit-v1.0.md §5 の KIT-Q-01〜04 を、確認事項にするかどうかが Skill から決まらない。

7. **1 つのリポジトリに要件書が 2 冊以上あると、REQ の番号がぶつかる。** Skill は「要件書 1 冊の中で REQ-001 から通し番号」としている。trace-v0.1.md を change にするとき、mvp の要件書がすでに REQ-001〜062 を使っていた。同じ番号を振ると、完了ゲートが mvp 側の `[REQ-012]` のテストを trace 側の REQ-012 のテストとして数える。trace-v0.1.md では REQ-063 から振って避けた（2026-10-23、作業記録 2026-10-23 の 8 節）。

### 対応

利用者が 2026-10-23 に、次の直し方を承認した。

| 指摘 | 直し方 | change |
|---|---|---|
| 1 | init の最後に、loomake を開発用の依存に足す案内（例：`npm i -D loomake`）を出す。package.json は書き換えない。usage.md にも同じ手順を書く | improve-init-guidance |
| 2 | package.json がないときは、commands を既定値のまま書き、loomake.config.json の commands を書き換えるよう案内する | improve-init-guidance |
| 3 | 状態は「範囲外」を使い、要約の末尾に「（フェーズ：〇〇）」と書き、Non-goals では後のフェーズの要件を分けて書く | improve-skill-for-multi-change |
| 4 | REQ・Q・A は要件書 1 冊の中で通し番号にする。複数の change にかかわる要件と確認事項は、かかわる change それぞれに同じ番号・同じ行で載せる | improve-skill-for-multi-change |
| 5 | 仕様ゲートに、進行中のほかの change の trace.md にある同じ ID の確認事項と、回答が食い違っていないかの検査を足す | add-shared-question-check |
| 6 | 要件書の未決事項は、すべて確認事項にし、質問に要件書側の ID を書く。ブロッキングかどうかはふだんの決まりで決め、関係する要件がすべて後のフェーズならブロッキングにしない | improve-skill-for-multi-change |
| 7 | REQ の番号は、リポジトリにある trace.md（進行中と archive）の最大の番号の次から振る。初めての要件書なら REQ-001 から。Q・A は要件書の中の通し番号のままにする | fix-req-numbering |

## 2026-10-23 /code-review（yomiyasu のスクリプトの未コミットの変更）

対象：`.agents/skills/yomiyasu/scripts/` の未コミットの変更（Windows で、ロック・記録の読み書き・閉じた出力先を扱う処理の追加）。利用者が Claude Code の `/code-review` で実行した。loomake 本体のコード（core・kit・trace・runner・CLI）は対象外。

### 指摘

1. **[yomiyasu_check.py:4964] 別のエラーを「出力先が閉じた」と誤って報告する。** Windows で `_closed_output_on_windows` は、errno が EINVAL でファイル名のない OSError を、すべて標準出力のパイプが閉じたものとみなす。失敗したのが標準出力かどうかは確かめていない。内部の処理（不正な fd への `os.read`／`os.write`、子プロセスのパイプ、時刻やロケールの API など）が同じ形の OSError を出すと、main() は「出力先が閉じた」と表示してトレースバックを隠し、3 を返す。本当の内部エラーなのに原因を調べられない。同じコードが `yomiyasu_diff.py:10610` と `yomiyasu_lint.py:3991` にもある。
2. **[yomiyasu_check.py:4476] 実行の回数を多く数えすぎる。** Windows で `_managed_run_count` は、stat が PermissionError になった記録ファイルを、すべて 1 回として数える。ふだんなら飛ばす、期限切れの空の予約も数える。読めないファイル（ほかの OS ユーザーのファイルや、1 秒の `_SETTLE_BUDGET` を使い切ったあとのファイル）があると、回数の上限（run_limit）に早く達し、枠が残っているのに新しい実行を断る。
3. **[yomiyasu_check.py:4277] ロックを取れなかった回数が、別々の出来事をまたいでたまる。** `_ArmedLock.__enter__` は、断られた回数（refused）を、新しいロックを見たときにしか 0 に戻さない。古いロックを消せたときや、`os.open` が PermissionError になったときは戻さない。Windows で複数のフックが古いロックの片付けを取り合うと、削除待ちのロックにぶつかるたびに refused が 1 ずつ増え、6 回目で期限よりずっと前に PermissionError を出す。実際には、ずっと消せないロックはない。
4. **[yomiyasu_check.py:4272] 同じ「削除待ち」の状態でも、待つ時間が呼び出しによって違う。** 既存のロックへの stat か unlink が PermissionError になると、約 120 ms（`_REPLACE_TRIES`）であきらめる。一方、すぐ横の `os.open` の PermissionError の分岐は、名前が残っていれば期限まで待つ。ウイルス対策や検索のインデックス作成が削除待ちのロックを 120 ms より長くつかんでいると、stat の経路ではフックに PermissionError が出るが、`os.open` の経路なら 2 秒か 12 秒の期限まで待てていた。
5. **[yomiyasu_check.py:4296] ロックを手放すときの stat の失敗を扱っていない。** この変更で、`__enter__` では Windows の stat の PermissionError を一時的な状態として扱うようにした。しかし `_ArmedLock.__exit__` の `os.stat` は、PermissionError をまだ扱っていない。with の範囲を抜けるときに、ほかのプロセスが古いロックを消している最中だと、`__exit__` で PermissionError が出る。本体の結果や例外がそれに置き換わり、フックか CLI が内部エラーで終わる。
6. **[yomiyasu_check.py:438] 待ち時間の枠がプロセス全体で 1 つしかない。** `_SETTLE_BUDGET` は、プロセス全体で共有する再試行の待ち時間の枠で、長い CLI の実行（多くの記録の一覧など）の一部で使い切ると、それ以降の一時的な PermissionError は再試行されない。約 19 回待つと枠がなくなり、置き換えの最中なだけの記録を `_read_record_status` が「bad」と判断して、`_managed_run_count` がそれを数える。正しい記録が壊れているように見え、回数も多くなる。
7. **[yomiyasu_check.py:446] 小数の誤差で、待てる回数が 1 回少ない。** 1.0 秒から 0.05 秒ずつ引くと、浮動小数点の誤差で、待てるのは 20 回ではなく 19 回（0.95 秒）になる。19 回引いたあとの値は 0.049999999999999684 で、`_REPLACE_WAIT`（0.05）より小さいので、20 回目の再試行が断られる。待った回数を整数で数えるか、比べるときに小さな許容差を入れると直る。
8. **[yomiyasu_check.py:430] Windows かどうかの判定が 2 通りの書き方になっている。** `_busy_on_windows()` は `os.name == 'nt'` を包んだだけの関数だが、同じ変更で足した `_closed_output_on_windows` と、既存の `_temporary_name_taken` は `os.name` を直接見ている。Windows を再現するためにテストで `_busy_on_windows` を差し替えても、ほかの 2 つには効かず、Windows の分岐を一部しか試せない。
9. **[yomiyasu_lint.py:3991] 同じ処理が 3 つのファイルにそのまま写されている。** `_closed_output_on_windows` と、main() の「出力先が閉じた」ときの処理が、`yomiyasu_check.py`・`yomiyasu_diff.py`・`yomiyasu_lint.py` に一字一句同じに写されている。指摘 1 を直すときは 3 か所を直す必要がある。近くには、ほかにも 3 つに写した関数（`_use_utf8`、`_silence_stdout`）があり、少しずつ食い違っていくおそれがある。3 つのスクリプトが読み込む共通のモジュールに出せば防げる。

### 対応

未対応。対象は利用者の未コミットの変更で、直すかどうかは利用者が決める。


# リポジトリ全体のレビュー

レビュー日：2026-10-23（ブランチ `archive-fix-review-findings`、コミット 0720a88）

前回の review.md にあった 6 件は、fix-review-findings ですべて直っていることをコードで確かめました。今回は、それとは別に修正したほうがよい点を **8 件**見つけました。優先度順に挙げます。

対象は loomake 本体（core・kit・trace・runner・CLI・CI のスクリプト）です。yomiyasu のスクリプトの未コミットの変更は、[docs/review.md](docs/review.md) の「2026-10-23 /code-review」で扱っているので対象外にしました。

1. **[P1] エンジンが tasks.md や差分仕様を書き換えても止まりません。** [guards.ts:23](packages/runner/src/guards.ts#L23) が守っているのは `openspec/specs/` と trace.md だけです。エンジンが tasks.md から未完了のタスクの行を消したり、差分仕様から Requirement を消したりすると、完了ゲートの「tasks.md」と「要件ごとのテスト」の検査が、実装しないままでも合格します。REQ-099 は「タスクを完了にするのは run であり、エンジンではない」と定めていますが、run はそれを確かめていません。一時的なリポジトリで tasks.md の行を消し、差分仕様を空にして `findViolations` を呼ぶと、違反は 0 件でした。仕様（run-guards）に検出の対象を足す change が必要です。

2. **[P1] `openspecDir` を変えたプロジェクトでは、仕様と trace.md の書き換えを見逃します。** [guards.ts:23](packages/runner/src/guards.ts#L23) は `openspec/` という名前を直接書いていて、loomake.config.json の `openspecDir` を見ていません。`"openspecDir": "spec"` のリポジトリで `spec/specs/x/spec.md` と `spec/changes/c1/trace.md` を書き換えても、違反は 0 件でした。`loadConfig(root).openspecDir` から判定する必要があります。

3. **[P2] verify の実行中は、実行時間の上限が効きません。** run が時間の上限を確かめるのは、エンジンを呼ぶときだけです（[run.ts:241](packages/runner/src/run.ts#L241)）。完了ゲートの品質コマンドは [verify/run.ts:293](packages/kit/src/verify/run.ts#L293) の `spawnSync` で時間の上限なしに実行されます。止まらないテストがあると、`run.timeoutMinutes` を過ぎても run は止まりません（REQ-105）。残り時間を `spawnSync` の `timeout` に渡す必要があります。コードを読んで見つけた点で、再現はしていません。

4. **[P2] `.loomake/test-report.json` を .gitignore に入れていないと、run がテストのレポートをコミットし、そのあと記録で止まります。** init の案内（[init.ts:106](packages/kit/src/init/init.ts#L106)）は、レポートの出し方を説明しますが、`.loomake/` を .gitignore に入れることには触れていません（[docs/usage.md](docs/usage.md) の 3 章にだけ書いてあります）。入れていないと、エンジンがテストを実行したときに、[guards.ts:43](packages/runner/src/guards.ts#L43) の `git add -A` でレポートがタスクのコミットに入ります。そのあと完了ゲートがレポートを消して作り直すため、作業ツリーが変わったままになります。`runRecord` は未コミットの変更を見つけて止まり、run は「証拠の記録で完了ゲートに不合格になりました」という、実際の原因と違う理由を報告します。init の案内に .gitignore の手順を足すか、run が始める前に確かめる必要があります。コードを読んで見つけた点で、再現はしていません。

5. **[P2] skip の検出が Vitest のほかの書き方を見逃します。** [guards.ts:10](packages/runner/src/guards.ts#L10) の正規表現は `it.skip` などを見ますが、`it.skipIf(true)`・`describe.skipIf`・`it.runIf(false)`・`it.concurrent.skip` を見逃します。テストファイルにこれらの行を足しても、違反は 0 件でした。REQ-109 が挙げる書き方には合っていますが、AGENTS.md 4 章の「テストを skip する」を防ぐには足りません。仕様に書き方を足すかどうかを決める必要があります。

6. **[P3] change-id にパスの区切りを含めても、そのまま受け付けます。** run（[run.ts:138](packages/runner/src/run.ts#L138)）・verify・trace record（[record.ts:52](packages/trace/src/record.ts#L52)）は `--change` の値をそのまま `resolve` に渡します。`../../packages` のように実在するディレクトリを指すと、trace record は `.loomake/evidence/` の外（[record.ts:79](packages/trace/src/record.ts#L79)）に記録を書き出します。ci-gate.mjs と同じように、`/`・`\`・`..` を含む change-id を UsageError にする必要があります。コードを読んで見つけた点で、再現はしていません。

7. **[P3] 証拠の記録の JSON が壊れていると、trace report がスタックトレースを出して終了コード 1 で終わります。** [report.ts:74](packages/trace/src/report.ts#L74) は `JSON.parse` の例外を捕まえていません。[main.ts:38](packages/cli/src/main.ts#L38) は UsageError でない例外をそのまま投げ直すので、「証拠の記録がない」場合と同じ終了コード 1 になり、日本語のメッセージも出ません。どのファイルが読めないかを UsageError で示す必要があります。

8. **[P3] AGENTS.md のプロジェクト固有の情報が古くなっています。** [AGENTS.md](AGENTS.md) は「`loomake` は core と kit だけに保つ」と書いています。しかし REQ-047（[openspec/specs/verify/spec.md:175](openspec/specs/verify/spec.md#L175)）は trace と runner も認めていて、[packages/cli/package.json](packages/cli/package.json) も 4 つに依存しています。主なディレクトリの一覧にも、`packages/trace/` と `packages/runner/` がありません。エージェントが AGENTS.md に従って依存を減らそうとするおそれがあります。

## 確かめたこと

- `pnpm -s verify`（lint・typecheck・test）は合格しました。テストは **238 件すべて成功**しました。
- 1・2・5 は一時的なリポジトリでビルド済みの `findViolations` を呼んで再現しました。一時的なファイルは scratchpad の中だけに作り、リポジトリには残していません。
- 3・4・6・7 はコードを読んで見つけた点で、再現はしていません。
- 実際の Claude Code・GitHub への接続は未検証です。


## 2026-10-24 設計・実装・テスト・動作・TDD・アーキテクチャ・OSS品質の評価

### 対象と総評

対象は HEAD `3905704` と現在の作業ツリー。評価作業のため、新規 change-id と実装タスク番号はない。既存の未コミット変更を維持し、実装・仕様・テスト・設定は変更していない。

要件台帳、仕様ゲート、テスト結果、コミット、仕様の内容を証拠で結び付ける設計は良い。core の実行時依存ゼロと、一方向のパッケージ依存も保たれている。ただし、安定版として勧める前に、変更検出と停止処理の不具合を直す必要がある。

次の5件を一時ディレクトリで再現した。P1は安全機構の不具合として優先、P2は入力境界の品質として対応する。

| 優先度 | 問題・根拠 | 再現した結果 | 対応案 |
|---|---|---|---|
| P1 | [packages/runner/src/guards.ts:48](../packages/runner/src/guards.ts#L48) が Git の引用済みパスをそのまま判定する | `core.quotepath=true` で `openspec/specs/x/日本語.md` を変更し、`tests/日本語.ts` を削除しても findings は空。仕様変更とテスト削除の両方を見逃した | `git diff --name-status -z` を使い、NUL区切りでパスを読む。日本語・タブ・改行を含むパスを回帰テストにする |
| P1 | [packages/runner/src/engine.ts:59](../packages/runner/src/engine.ts#L59) の POSIX 停止処理は親プロセスへの SIGTERM のみ | 標準出力を引き継ぐ子を持つ偽エンジンに上限150msを設定したところ、runClaude が返るまで約1,637msかかった。子は自分のタイマーで終了した | プロセスグループの停止、猶予後の強制終了、終了待ちの上限を設ける。子プロセスとSIGTERMを無視するプロセスを検査する |
| P1 | [packages/runner/src/run.ts:457](../packages/runner/src/run.ts#L457) から呼ぶ runRecord と [packages/trace/src/record.ts:74](../packages/trace/src/record.ts#L74) の再検証には残り時間が渡らない | 上限300ms、2回目の品質コマンドだけ1,100ms待つ構成で、約1,255ms後に終了コード0。偽ghによるPR作成段階まで進んだ | 証拠記録の再検証にもdeadlineと中断を伝える。外部コマンドを含む時間制限の範囲を仕様で明確にする |
| P2 | [packages/runner/src/run.ts:68](../packages/runner/src/run.ts#L68) が run のオブジェクト形状を検証しない | `{"run":null}` を指定すると TypeError が発生し、UsageErrorとしての日本語案内と終了コード2にならない | 設定の読み取りと検証をまとめ、run の型・有限数・回数の整数制約を定義する |
| P2 | [packages/trace/src/report.ts:65](../packages/trace/src/report.ts#L65) は証拠を JSON.parse 後に型アサーションするだけ | 正常なtrace.mdと証拠 `{}` で、coverage参照時にTypeError。JSON構文が正しい不正データを分類できない | 証拠のschemaVersion・必須値・日時・changeの対応を実行時に検証する。ハッシュと内容の一致確認も設計する |

再現にはビルド済みモジュールと偽claude・偽gh・ローカルbareリポジトリを使った。GitHubへのアクセスや実際のAI実行はしていない。直前の評価でコード上の懸念だった証拠記録の時間上限と証拠JSONの検証不足についても、今回は再現できた。

### 100点満点での評価

点数は、今回確認できた実装・仕様・テスト・履歴に基づくレビュー上の判断で、テストの成功率や外部認証の値ではない。90点以上は主要な異常系と配布・運用まで確認できる状態、80点台は構成と検証が充実した状態、70点台は基盤があり重要な不足が残る状態、60点台は重要な保証の検証や実装に不足がある状態を目安とする。60点未満は、その観点の手順や検証の根拠が十分に確認できない状態とする。未検証を不具合として数えず、評価の確かさを制限する要因として扱った。

| 観点 | 点数 | 評価の理由 | 点数を上げるために優先すること |
|---|---:|---|---|
| 設計 | 82 / 100 | 要件の出典から仕様・テスト・コミット・証拠までのつながりが明確。証拠に仕様の内容を保存する設計も良い。一方、時間上限をどの段階まで保証するか、ガードと人のレビューの分担を、実装全体で揃える必要がある | 実行全体の停止条件と、ガードが保証する範囲を仕様に明記する |
| 実装 | 74 / 100 | strictな型検査、純粋パーサ、機能ごとの分割は良い。Gitのパス処理、子プロセスの停止、JSONの型検証という外部との境界で5件を再現した | P1の3件を直し、設定と証拠JSONの実行時検証を追加する |
| テスト | 78 / 100 | 17ファイル304件が成功し、要件IDとの対応や失敗系、一時Gitリポジトリによる試験もある。ただし今回の見逃しや停止処理の不具合は検出できていなかった。Scenarioごとの検証の十分さと、コードカバレッジは未評価 | 日本語パス・子プロセス・証拠記録中の時間切れを回帰テストにし、重要な判定のテストの強さを確認する |
| 動作の信頼性 | 68 / 100 | 既存の完了ゲートと配布物の起動・テンプレート展開は確認できた。停止条件の不具合を再現したため減点した。実際のClaude Code・GitHubを使う一連の動作と、別OS・別Nodeでの実行は今回未検証 | 時間切れと中断を確実に扱い、実エンジンによる一連の動作を確認する |
| TDD | 45 / 100 | 回帰テストと要件の対応付けはあるが、確認した直近のコミットは実装→テストで、タスクも同じ順。失敗を確認してから実装する手順の証拠は確認できない。この点数は確認できる手順と記録の評価であり、ローカルでTDDをしていなかったという断定ではない | 今回の不具合でRed→Green→Refactorを実施し、修正前に失敗したテストと確認結果をPRに残す |
| アーキテクチャ | 84 / 100 | coreの実行時依存ゼロ、I/Oを持たないパーサ、一方向の依存関係は明確で、規模に合っている。プロセス・時刻・Git操作の差し替えが限定的で、停止と中断の検証を難しくしている | 異常系の検証が必要な境界に絞って、プロセス実行・時刻・Git操作を差し替え可能にする |
| OSSとしての整備 | 65 / 100 | MIT、changesets、3OSのCI、導入ガイドがある。配布物の試験のCI化、Node下限での主要コマンドの検証、貢献・脆弱性報告・互換性の方針が不足する。npm公開権限や実公開は今回未確認 | 配布物の試験をCIに追加し、CONTRIBUTING・SECURITY・互換性方針と古い設計文書を整える |

点数が高い設計・アーキテクチャでも、安全機構のP1を残したまま安定版として勧める判断にはしない。修正は、変更検出と停止処理の3件、JSON検証、配布物のCI、TDDの手順とOSS向け文書の整備の順に進める。

TDDの改善では、今回の再現条件を失敗するテストにし、現行実装で失敗を確認してから修正し、整理後も成功することを確認する。コミットの順番だけではローカルの作業順序までは断定できないため、過去にTDDを行っていないとは断定しない。

### レビュー時の検証結果

- `pnpm lint`・`pnpm typecheck`・`pnpm test` は exit 0。17ファイル304件すべて成功。
- `pnpm -s verify --change tell-engine-not-to-commit --done` は exit 0。ビルド・仕様・タスク・品質コマンド・要件とテストの対応が合格した。これは既存changeの検査であり、今回の指摘が解消したことを示すものではない。
- 5パッケージを `pnpm pack` で一時領域に出力し、別の新規プロジェクトへ `npm install --offline --ignore-scripts` で導入できた。`--version` と `init --codex` は exit 0。doctor は未作成のOpenSpecディレクトリとGitリポジトリを検出してexit 1となり、想定した結果だった。

### 残っている確認事項・仮定

実際のClaude Code・GitHub・npm公開、別OS・別Nodeでの実行、カバレッジ測定・mutation testingは今回未実施。配布物の試験は現在のホストだけで行った。P1・P2は本レビューでの優先度であり、公開済み環境の事故を確認したものではない。

### 推奨する対応順

まずガードと停止処理の3件をOpenSpec changeにまとめ、回帰テストを先に書いて修正する。次に設定・証拠JSONの検証を揃え、配布物の試験をCIへ追加する。仕様の追加が必要な対応案は、仕様を確定してから実装する。

## 2026-10-24 追加評価と全項目90点以上に向けた改善計画

### 評価の前提

前節の7項目に、ドメイン駆動設計、セキュリティ、供給網と公開、互換性、保守性、使いやすさ、性能、障害対応を追加する。対象は同じHEAD `3905704` と作業ツリー。今回追加した観点はコードと文書の確認による暫定評価で、侵入試験・脆弱性データベースとの照合・利用者テスト・追加ベンチマークは行っていない。

点数はレビュー上の判断で、作業項目を実施すれば自動的に90点になるものではない。以下の到達基準を満たす証拠を集めて再評価する。基準と対応案は改善提案であり、現在の仕様や確定済みの実装タスクではない。

### 追加した観点の点数

| 観点 | 現在の点数 | 根拠と不足 |
|---|---:|---|
| ドメイン駆動設計 | 70 / 100 | 要件・確認事項・仮定・検証・証拠という用語が仕様とコードで対応し、機能の責務も分かれている。一方、モデルはMarkdown表とJSONの構造に近く、検証ルールがI/Oや実行の制御と混在する |
| セキュリティ | 60 / 100 | エンジンへの許可一覧、権限確認を省く際の環境変数の条件、ログ保存時の既知の秘密情報の置換、initのシンボリックリンク対策はある。変更ガードの見逃しと停止処理の不具合を再現済み。通信・資格情報・出力の保護範囲は十分に確認できていない |
| 供給網と公開 | 64 / 100 | lockfile、手動公開、main限定、未消化changesetの確認がある。公開ジョブ自体はbuild中心で、同じSHAの品質検査と配布物の試験を必須にしていない。Actionsはタグ参照で、NPM_TOKENを用いる構成。実際の権限や保護設定は未確認 |
| 互換性 | 70 / 100 | 3OSのCI、Node下限の起動検査、JSONの版と過去スキーマのfixtureがある。下限Nodeでの主要コマンド、古い証拠の読み取り、公開APIの型と動作を配布物から横断する検査は不足する |
| 保守性 | 78 / 100 | 小さな純粋パーサ、機能ごとの分割、named exportは良い。設定の読み取りやGit・プロセス処理が複数箇所にあり、規則を変更するときの確認範囲が広い。設計文書にも古い説明がある |
| 使いやすさ | 74 / 100 | help・version・doctor、上書き前の差分と確認、JSONレポートの設定例、クイックスタートは良い。導入時の手作業と、停止後の差分確認・コミット・再実行に利用者の判断が多い。初見の利用者による検証は未実施 |
| 性能と資源制限 | 65 / 100 | 要件500件・テストファイル1,000個を扱う性能テストがある。一方、runClaudeは標準出力全体を文字列に蓄積し、明示的な出力サイズ上限はない。大きな証拠・長時間実行時のメモリとディスクの上限は未測定 |
| 障害対応と復旧 | 66 / 100 | summary.json、完了・残タスク、途中の変更を残す仕組みと案内がある。子プロセスの残存、証拠記録中の時間超過が復旧を難しくする。同時実行、強制終了、証拠記録後のPR作成失敗からの再実行は、シナリオとして整理し直したい |

### ドメイン駆動設計の評価

Loomakeの業務上の中心は「合意した要件について、実装と検証の根拠を追えるようにすること」と捉える。これは現在の仕様と実装からの解釈であり、新しい製品要件ではない。

役割の境界は、要件と合意、検証、証拠と検収、自動実装の4つに整理できる。既存のkit・trace・runnerはこれらの一部に対応するが、npmパッケージの境界がそのままドメインの境界を表すとは限らない。まず、それぞれがどの情報を正として持ち、何を受け渡すかを文書化する。

具体的には、[core/src/trace.ts](../packages/core/src/trace.ts#L11) のRowは列名をキーとする文字列の組で、台帳の状態や質問のブロッキング値も文字列として扱う。[kit/src/verify/run.ts](../packages/kit/src/verify/run.ts#L119) では、未回答のブロッキング質問や未参照の要件の判定と、ファイル読み取り・コマンド実行が同じ処理に置かれている。[trace/src/record.ts](../packages/trace/src/record.ts#L51) でも、証拠を記録できる条件とGit・ファイル操作がまとまっている。

90点を目指すなら、次の順に整理する。

1. 用語と識別子を定義する。Requirement、台帳のREQ-ID、change、検証結果、証拠、検収結果の違いと対応を明記する。
2. Markdown表とJSONを入出力用の型として扱い、解析結果から検証済みのモデルへ変換する境界を作る。IDや状態は、仕様で許される値を表現する型と生成関数で扱う。
3. 既存のルールを副作用のない関数へ移す。例は「仕様ゲートで止める条件」「必要な要件に成功したテストが対応する条件」「同じSHAと文書を検査した証拠として記録できる条件」。CLIは読み取り・実行・保存・表示を担当する。
4. 証拠と文書の内容をひとまとまりとして検証する単位、実行状態の遷移と中断時の扱いを定義し、直接テストする。

クラス・Repository・ドメインイベント・CQRSを一律に追加することは到達条件にしない。この規模では、型と純粋関数でルールを表現し、I/Oから分離する構成をまず検討する。coreの依存ゼロと既存のパッケージ依存制約は保つ。公開されている型を変える場合は互換性への影響を扱い、新しい振る舞いはchangeの仕様を確定してから実装する。

### セキュリティで確認する範囲

信頼するリポジトリを利用者が動かす場合と、外部から受け取った仕様・コードを扱う場合を分け、守る資産をソース、資格情報、作業ツリー、証拠、公開権限として整理する。commandsを実行できること自体は製品の機能なので、shellの使用だけで脆弱性と判定しない。

[runner/src/engine.ts](../packages/runner/src/engine.ts#L65) は環境変数をエンジンへ渡し、標準エラーを継承する。[runner/src/run.ts](../packages/runner/src/run.ts#L311) の保存処理はmaskSecretsを使うが、端末への出力をすべて同じ経路で処理しているわけではない。[runner/src/mask.ts](../packages/runner/src/mask.ts) の置換対象も既知の形式に限られる。秘密情報が流出した事実は確認していない。受け渡す資格情報、保存する内容、端末やCIへ出す内容を区別して設計し、実際の秘密情報を使わず、テスト専用の識別文字列で保護範囲を検査する。

`LOOMAKE_SANDBOX=1`は利用者の環境宣言で、通信制限の強制機構ではない。コンテナの判定も通信の制限を保証しない。外部の実行環境が担う制限と、Loomake自身が担う検査を明記し、推奨環境で通信制限が機能することを別に確認する。

証拠のハッシュは内容の一致確認に使えるが、証拠そのものを編集できる主体に対する真正性の保証にはならない。第三者の改ざんまで防ぐ必要があるかを先に決め、必要な場合に署名・保護されたCIでの生成・検証可能な公開記録を検討する。

### 使いやすさの評価

初回導入は、initがファイルを用意し設定例を示す点が良い。一方、OpenSpecの初期化、テストレポートの設定、品質コマンド、Gitの除外設定に手作業がある。クイックスタートの「.loomake/を除外し、evidenceは除外しない」という説明には、そのまま貼れる設定例を添えたい。

普段の利用では、helpとdoctorがあり、日本語で次の行動を案内する点が良い。ただし、[doctor.ts](../packages/kit/src/doctor/doctor.ts#L65) が品質コマンドについて確認するのは主に実行ファイルの存在で、npmがあってもscripts.testがあることまでは確認しない。認証やレポートの生成可否を含め、どこまで診断したかが分かる表示が必要になる。新しい診断を追加する場合は仕様を更新する。

失敗からの復旧では、差分や残タスクが残る点は良いが、どのブランチで何を承認・コミットして再実行するかの判断負担がある。質問、ガード違反、時間切れ、認証不足、PR作成失敗を分けて、次のコマンドと、再実行時に何が起こるかを一貫して説明したい。

90点の判断材料として、初見の利用者3人に、文書だけで「導入→サンプルchangeの検証」と「意図した失敗→原因確認→復旧」を試してもらうことを提案する。完了可否、所要時間、助言が必要だった箇所、誤操作を記録し、全員が追加の口頭説明なしで完了できる状態を目安とする。3人は今回の改善計画上の目安で、利用者全体への使いやすさを統計的に保証する人数ではない。

### 全項目を90点以上と評価するための到達基準

| 観点・現在点 | 90点を判断するために確認すること |
|---|---|
| 設計・82 | 実行の開始から証拠とPRまでの状態・停止・失敗・再実行を仕様で定義し、各境界の失敗シナリオが実装と一致する |
| 実装・74 | 再現済みの5件を回帰テスト付きで解消し、不正な入力を定義したエラーへ変換する。既知の重要な指摘を未対応で残さない |
| テスト・78 | RequirementだけでなくScenarioとテストの対応を確認する。安全上重要な判定には正常・異常・境界の試験があり、選んだ条件を壊すmutationが検出されるか、検出しない理由をレビューできる |
| 動作の信頼性・68 | 実際のエンジンと専用の試験リポジトリで、成功・質問・権限不足・時間切れ・中断・PR失敗を確認する。中断後の子プロセスとGitの状態も確認する |
| TDD・45 | 今後の不具合修正と機能変更で、変更前のRed、必要な実装後のGreen、整理後の成功を記録する。単発の例だけでなく複数のchangeで継続し、テストの弱体化をレビューする |
| アーキテクチャ・84 | 依存制約を守り、プロセス・Git・時刻を必要な箇所で差し替えられる。ルールの試験は外部ツールを必要とせず、外部ツールとの接続は別に検査できる |
| OSSとしての整備・65 | 公開予定SHAに対して品質・配布物の検査が成功し、貢献・脆弱性報告・サポート・互換性の方針と現行の文書が揃う |
| ドメイン駆動設計・70 | 用語、責務の境界、モデルの整合性条件を定義し、主要ルールをI/Oから分離して直接検査できる。表やJSONの書式変更が業務ルールへ波及しにくい |
| セキュリティ・60 | 脅威と信頼境界を定義し、パス・権限・資格情報・ログ・停止を検証する。外部監査や独立したレビューで出た重要な指摘を解消または理由付きで受容する |
| 供給網と公開・64 | 公開対象と検査対象のSHAを一致させ、配布物から検査する。CIと公開の権限を必要範囲に絞り、Actionsの不変参照、認証、公開元の検証と依存更新方針を整える |
| 互換性・70 | 対応OSとNodeの範囲を決め、配布物から主要コマンドを実行する。サポート対象の古い文書・証拠・APIのfixtureを通し、破壊的変更を検出する |
| 保守性・78 | 設定・Git・プロセスの規則を変更する場所が明確で、不要な重複を減らす。設計文書を同期し、変更がどの仕様と試験に影響するか追える |
| 使いやすさ・74 | 初見の利用者による導入・普段の操作・失敗からの復旧の試験を行い、説明の不足と誤操作を解消する。help・doctor・実際の挙動が一致する |
| 性能と資源制限・65 | 対象規模ごとの時間・メモリ・出力・ディスクの予算を定義し、測定する。過大な入力や出力で予算を超えた際も、理由を示して止まり、作業状態を確認できる |
| 障害対応と復旧・66 | 同時実行、中断、強制終了、証拠保存失敗、push失敗、PR作成失敗からの再実行を検証する。完了済みの変更や証拠を重複・上書きせず、復旧手順が実際に通る |

カバレッジ率、クラス数、テスト件数だけを90点の根拠にはしない。実行環境と運用を含む項目は、その環境での確認結果が必要になる。

### 実施順序と検証

1. 変更ガード、子プロセス停止、証拠記録の時間制限、設定と証拠JSONの検証を扱うchangeを作る。仕様ゲートを通し、失敗する回帰テストから修正する。
2. 信頼境界、秘密情報、実行状態、証拠の整合性条件を整理する。既存ルールの振る舞いを保ちながらモデルとI/Oを分離し、必要な仕様追加を確定する。
3. Scenarioとの対応、重要な判定へのmutation testing、配布物からの主要コマンド、OSとNodeの組合せを検査する。以降のchangeでもTDDの記録を継続する。
4. 公開対象SHAの検査と公開経路を整え、互換性・脆弱性報告・貢献の方針を文書化する。
5. 専用の試験環境で実エンジン・障害復旧・性能を確認し、初見の利用者による試験を行う。結果を根拠として全項目を再採点する。

新しいchangeはまだ作成していない。今回は評価と改善計画の文書化のみで、verifyは再実行していない。前節の304件成功は前回の実行結果であり、追加観点の達成を示す結果ではない。

## 2026-10-24 改善の進捗：harden-run-safety

再現済みの5件を修正した。特殊文字のパスはNUL区切りで読み、POSIXのエンジンは子プロセスを含めて停止する。証拠記録へ残り時間を渡し、run設定と証拠JSONは不正な入力を日本語で説明する。文書のハッシュと対象changeの対応も検証する。

各修正で現行実装のRedを確認し、修正後のGreenと既存テストの成功を記録した。詳細は[changeのTDD記録](../openspec/changes/archive/2026-10-24-harden-run-safety/tdd.md)にある。`pnpm -s verify --change harden-run-safety --done`はexit 0、343件が成功した。

この結果だけで全項目を90点以上とは判定しない。配布物のCI、ドメインルールの分離、公開経路、実エンジン・利用者による確認などは継続して進める。実際のClaude CodeやGitHubを使った検証は、今回の結果に含まない。

## 2026-10-24 改善の進捗：verify-package-artifacts

配布物の準備と検査をスクリプト化した。5パッケージのtarballを空白を含むパスの独立したプロジェクトへオフライン導入し、公開API、スキーマ、インストールしたbin、help・version・init・doctor・verify・証拠記録とレポートを確認した。テンプレートを欠いた配布物は失敗として検出する。

公開するexportsから、同梱しない開発用ソース条件を除いた。CIの3OSとNode下限に検査を追加し、公開ジョブでも同じコミットの品質と配布物を検査する。`pnpm -s verify --change verify-package-artifacts --done`はexit 0、346件が成功した。詳細は[changeのTDD記録](../openspec/changes/archive/2026-10-24-verify-package-artifacts/tdd.md)にある。

これは現在のホストでの成功とCIの設定変更であり、別OS・別NodeのCI成功やnpm公開を確認した結果ではない。全15項目の再採点は、残る検証結果を集めてから行う。

## 2026-10-24 改善の進捗：separate-verification-policy

coreへAgreement、RequirementId、LedgerStateと、モデル変換・合意判定・成功テストとの対応判定を追加した。verifyはこれらの純粋関数を使い、不正な要件IDを不合格にする。従来のTraceの型とverify JSONの版は維持した。用語と責務を[architecture.md](architecture.md)に記載した。

`pnpm -s verify --change separate-verification-policy --done`はexit 0、357件が成功した。モデル7件、テスト対応3件、verify接続1件はRedからGreenの順で検証した。詳細は[changeのTDD記録](../openspec/changes/archive/2026-10-24-separate-verification-policy/tdd.md)にある。

利用者は、実エンジン検証に使える専用GitHubリポジトリはなく、使いやすさはAIで試験するよう回答した。そのため、使いやすさの到達基準はAIによる初回導入・普段の操作・失敗からの復旧の試験で確認する。人による試験を行ったとは扱わない。GitHub接続そのものは、ローカルGitや代替のPRコマンドによる検査と区別して未確認として残す。

全15項目は引き続き改善中。資源制限、AIによる操作試験、セキュリティと公開経路、復旧シナリオ、再評価を進める。

## 2026-10-24 改善の進捗：出力予算と診断保護

`bound-engine-output`で、エンジンのstdoutとstderrの合計を既定64MiBに制限した。run.maxOutputBytesに正の安全な整数を設定できる。超過時はエンジンと子を停止し、タスクと途中の変更を未完了のまま残して、理由を記録する。UTF-8の途中で切れる文字は保持しない。完了ゲートはexit 0、366件が成功した。

`protect-run-diagnostics`で、stderrのチャンクをまたぐ既知のトークンを転送前に置換した。runnerの質問・停止理由・差分・進捗も同じ保護を通す。未確定な単語の保持を4096文字までに制限し、長い単語は省略する。完了ゲートはexit 0、377件が成功した。

これは既知のトークン形式の診断保護で、任意の秘密情報や個人情報の識別を保証しない。出力予算はエンジンが直接書くファイルやrun全体の累積ディスク容量を制限するものではない。残る資源と実行環境の境界は引き続き改善する。

## 2026-10-24 AIによる操作試験の結果

`exercise-ai-user-journeys`で、配布物を使う3シナリオを実行した。操作結果は[results.json](../openspec/changes/archive/2026-10-24-exercise-ai-user-journeys/results.json)、再現手順と限界は[TDD記録](../openspec/changes/archive/2026-10-24-exercise-ai-user-journeys/tdd.md)にある。

| シナリオ | 操作数 | 意図した終了コード1 | 結果 |
|---|---:|---:|---|
| 初回導入と再実行 | 11 | 0 | 期待した終了コードと一致 |
| 既存ファイルの保護と通常操作 | 15 | 1 | 期待した終了コードと一致 |
| 質問・テスト対応不足・未コミット変更からの復旧 | 16 | 3 | 期待した終了コードと一致 |

合計42操作を確認した。完全な操作記録は`.loomake/quality/ai-journeys-zgp6ap7c/trial/journeys.json`に保持した。ワークスペース内の試験でコピーしたfixtureをGitが読めない失敗を見つけたため、コピー処理を明示的な読み書きへ変更した。同じ保存先と一時ディレクトリを回帰テストで確認し、完了ゲートはexit 0、379件が成功した。

AIが作成して実行したシナリオであり、人の利用者や独立した3人分の評価ではない。サンプルのレポートはfixtureであり、顧客アプリケーションの機能を確認したものではない。実際のエンジン・GitHub接続もこの試験には含まない。

全15項目の改善は継続する。次は同時実行とPR作成失敗後の復旧、ドメイン判定のmutation試験、公開経路とOSS運用文書、診断の範囲と資源予算を確認する。今回の成功だけで全項目を90点以上とは判定しない。


## 2026-10-24 改善の進捗：serialize-run-execution

同じGit作業ツリーのrunを排他し、dry-runを含む二重起動を開始前に止める。通常終了・中断・例外では自分の所有トークンのロックだけを解放する。同じホストの終了済み所有者は回復し、不明・別ホスト・生存中・回復処理中の場合は削除せず確認手順を表示する。同秒の再実行も別のディレクトリへ記録する。

二重起動とログ上書きは修正前の2件の失敗で再現した。実プロセスを強制終了した後の回復、別のGit worktreeでの独立した取得も確認した。関連70件が成功し、完了ゲートはexit 0、全389件が成功した。初回ゲートの未チェックタスクによる失敗と再実行も[TDD記録](../openspec/changes/archive/2026-10-24-serialize-run-execution/tdd.md)に記載した。復旧の手順と対象外の環境は[run-recovery.md](run-recovery.md)を参照する。

### 改善途中の再採点

以下は今回までの7つのchangeの仕様・実装・検証記録に基づく暫定評価である。初回の点数を更新するが、全項目90点の達成判定ではない。点数はレビュー上の判断で、外部認証やテスト成功率ではない。

| 観点 | 初回 | 現時点 | 主な根拠と残る不足 |
|---|---:|---:|---|
| 設計 | 82 | 87 | 停止・出力・排他の仕様を追加。PR失敗後の再試行と状態の整理が残る |
| 実装 | 74 | 88 | 重要な再現済み指摘と入力・表示を修正。再試行と資源制限の境界を継続確認する |
| テスト | 78 | 86 | 配布物・AI操作・安全上の境界を確認。Scenario対応の棚卸しとmutation試験が残る |
| 動作の信頼性 | 68 | 76 | 実プロセス停止・Git・配布物で検証。実エンジンとGitHubの接続は未確認 |
| TDD | 45 | 90 | 7つのchangeでRedとGreenを継続記録。既存の期待値を弱めず完了ゲートを確認 |
| アーキテクチャ | 84 | 88 | 純粋な判定とI/Oを分離し依存制約を維持。実行状態と外部操作の整理が残る |
| OSSとしての整備 | 65 | 78 | 配布物と公開対象の品質ゲートを追加。貢献・脆弱性報告・サポート方針が不足 |
| ドメイン駆動設計 | 70 | 85 | Agreementと整合性条件、用語と責務を明示。状態遷移と証拠・再試行のモデルを改善する |
| セキュリティ | 60 | 78 | パス・子プロセス停止・既知トークンの診断保護を修正。脅威モデルと独立した確認が残る |
| 供給網と公開 | 64 | 78 | 配布物からの検査と公開前ゲートを追加。Actionsの不変参照と公開元の検証が残る |
| 互換性 | 70 | 75 | 公開exportsと下限Node・3OSのCIを整備。別環境の実行結果と旧形式の棚卸しは不足 |
| 保守性 | 78 | 85 | 設定・証拠・合意の判定を分離。実行制御と文書全体の同期を継続する |
| 使いやすさ | 74 | 87 | AIによる3シナリオ42操作と復旧手順を確認。doctorの診断範囲と説明を改善する |
| 性能と資源制限 | 65 | 72 | 出力予算と期限を追加。入力・累積ディスク・規模別測定が残る |
| 障害対応と復旧 | 66 | 80 | 同時実行・中断・強制終了・記録衝突を確認。証拠保存・push・PR失敗後の再試行が残る |

TDDの90点は今回の継続した開発手順への評価であり、過去の全実装がTDDだったという主張ではない。使いやすさは利用者の指示によりAI試験で評価し、人による試験や独立した3人分の評価として扱わない。

次はPR作成失敗後の再試行、純粋な判定のmutation試験、公開経路とOSS運用文書、診断の範囲、残る資源予算を改善する。


## 2026-10-24 改善の進捗：verify-domain-mutations

合意・モデル変換・テスト対応の13条件を、それぞれコピー上で変更し、既存の10テストで確認した。変更のない実装は成功し、13条件すべてで同じテスト群のassertionが失敗した。要件IDの桁数と終端、状態、ブロッキング値と条件、回答、確認待ち、承認、出典、対応不足、ファイル順序、対応するファイル名、要件IDの重複を対象にした。

正常な実装とのテスト名・件数の一致を確認し、タイムアウト・構文や読み込みの失敗・レポートの欠損や矛盾は検出へ数えない。未検出や試験エラーは検査全体を不合格にする。元のソースとテスト12ファイルはハッシュが一致し、通常のレポートも試行中に変更しないことを確認した。

結果は[results.json](../openspec/changes/archive/2026-10-24-verify-domain-mutations/results.json)、RedからGreenと途中の修正は[TDD記録](../openspec/changes/archive/2026-10-24-verify-domain-mutations/tdd.md)、対象条件と再現手順は[testing.md](testing.md)にある。判定と保護の追加16件、型検査、lintが成功し、完了ゲートはexit 0、全405件が成功した。

テスト品質の暫定評価を86点から88点へ更新する。選んだ条件を既存テストが検出する根拠は得られたが、全コードのmutation scoreや全Scenarioの網羅を示す結果ではない。全Scenarioとテストの対応の棚卸し、実エンジン・GitHub・別OSとNodeの検証は残る。他14項目は前節の暫定評価を維持する。

次はPR作成失敗後の再試行、公開経路とOSS運用文書、診断の範囲、残る資源予算を改善する。


## 2026-10-24 改善の進捗：resume-pr-publication

pushやPR作成が失敗した後の再実行で、今回の完了ゲートを省略せず、直前の合格証拠とコミットを再利用する。再利用は証拠だけの追加コミットに限定し、親SHA・change・形式・合格結果・現在の文書との一致を確認する。不正な候補は消さず増やさず止まり、実装の変更を追加した場合は新しい証拠を記録する。

push後は同じリポジトリとbase/headのopen PRを検索する。作成後の応答を失った場合も、再実行で既存PRを見つければ新規作成しない。検索の失敗、不正な結果、複数の候補では作成へ進まない。品質コマンドがHEAD・ブランチ・作業ファイルを変更した場合も、状態を保ったまま停止する。

修正前に追加21件のうち20件の失敗を確認した。検証中の状態変更についても4件を追加し、HEADとブランチの2件の失敗を確認して修正した。関連94件が成功し、完了ゲートはexit 0、全430件が成功した。詳細は[TDD記録](../openspec/changes/archive/2026-10-24-resume-pr-publication/tdd.md)、操作の手順は[run-recovery.md](run-recovery.md)にある。

ローカルGitのbareリポジトリと代替ghでの試験結果であり、実際のGitHubで認証・通信・権限・障害復旧を確認した結果ではない。

### 現時点の暫定点

| 観点 | 点数 / 100 | 90点へ向けて残る主な確認 |
|---|---:|---|
| 設計 | 89 | 証拠保存の失敗と資源制限を含む全段階の状態・停止・再開の整合性 |
| 実装 | 89 | 入力の境界と残る資源制限、重要な不具合の再確認 |
| テスト | 88 | 全Scenarioとテストの対応の棚卸し、残る重要条件の試験 |
| 動作の信頼性 | 78 | 実エンジンとGitHubの認証・通信・異常系の動作 |
| TDD | 90 | 今回までの手順を継続し、期待値を弱めないレビューを維持する |
| アーキテクチャ | 89 | 入力・実行・記録の資源制限と外部操作の境界を整理する |
| OSSとしての整備 | 78 | 貢献・脆弱性報告・サポート・互換性の方針と公開時の証拠 |
| ドメイン駆動設計 | 87 | 資源と記録の整合性条件、実行状態と責務の文書化 |
| セキュリティ | 80 | 脅威モデル、入力・権限の境界、独立した確認 |
| 供給網と公開 | 78 | Actionsの不変参照、公開元の検証、依存更新方針 |
| 互換性 | 75 | 別OS・別Nodeの実行結果、旧形式の対応範囲とfixtureの棚卸し |
| 保守性 | 87 | 文書全体の同期、残る入力・実行の規則の集約 |
| 使いやすさ | 88 | doctorの診断範囲と、help・文書・動作の一致 |
| 性能と資源制限 | 72 | 入力・累積ディスク・規模別の時間とメモリの予算と測定 |
| 障害対応と復旧 | 87 | 証拠保存失敗からの再開、残る環境と資源の異常系 |

点数は実装と証拠を読んだレビュー上の判断であり、テスト成功率や外部認証の値ではない。全項目90点は未達。次は公開経路とOSS運用文書、入力・診断と資源予算、Scenario対応と互換性を改善する。


## 2026-10-24 改善の進捗：harden-release-workflow

CIと公開の外部Actionsを、公式リポジトリのv4参照から取得した完全なSHAへ固定した。現行の参照元は[.github/action-pins.json](../.github/action-pins.json)、取得時の記録はchange内にも保存した。checkoutは資格情報を保存しない。ワークフローの既定はcontents readとし、公開ジョブだけにタグ送信とprovenanceの権限を付けた。npm公開とGitの認証情報は、それぞれ対応するステップへ限定した。ジョブの権限自体はそのジョブ全体に及ぶ。

5パッケージにrepositoryと各ディレクトリ、provenanceの設定を追加した。公開ステップもprovenanceを要求し、独立したプロジェクトへ導入した配布物の同じメタデータを確認する。出典が違う配布物は検査で拒否する。npmの前提と設定は[公式文書](https://docs.npmjs.com/generating-provenance-statements/)で確認したが、実際の公開とattestationの検証は未実施である。

[CONTRIBUTING.md](../CONTRIBUTING.md)、[SECURITY.md](../SECURITY.md)、[SUPPORT.md](../SUPPORT.md)、[信頼境界](security.md)、[互換性](compatibility.md)、[公開の手順](publishing.md)を追加した。秘密情報の引き継ぎ、外部隔離への依存、診断の保護範囲、残る資源制限を実装と照合した。連絡先やSLA、未検証の保護を作っていない。非公開の脆弱性報告機能とリポジトリの可視性は、接続したコネクタでは確認できなかった。

追加10件が修正前に失敗し、修正後は既存2件を含めて成功した。配布物を含む関連13件も成功した。初回lintの正規表現の表記3件を直した後、完了ゲートはexit 0、全440件と型・lint・全REQの対応が成功した。詳細は[TDD記録](../openspec/changes/archive/2026-10-24-harden-release-workflow/tdd.md)にある。

| 観点 | 前回 | 今回の暫定点 / 100 | 残る確認 |
|---|---:|---:|---|
| OSSとしての整備 | 78 | 85 | 公開とサポート・非公開報告の実際の利用経路 |
| セキュリティ | 80 | 85 | 入力と全資源の境界、独立した確認、実環境 |
| 供給網と公開 | 78 | 86 | 公開後のattestation・公開元・registryから取得した版の確認 |
| 互換性 | 75 | 78 | 別OS・Nodeの実行結果、旧形式と全Scenarioの棚卸し |
| 保守性 | 87 | 88 | 残る入力・実行規則の集約と文書全体の同期 |

他10項目は前節の暫定点を維持する。全項目90点には未達。次は過大な入力・シンボリックリンクの循環・累積ディスクなどの資源制限と測定、doctorの診断範囲、Scenario対応を改善する。


## 2026-10-24 改善の進捗：bound-input-resources

kitに共通readerを追加し、verify・trace・runの重複する探索と読み取りを置き換えた。文書は1ファイル1MiB・同じ処理の合計16MiB、JSONは1ファイル64MiB・証拠の合計128MiB、探索は4096項目・深さ32までとする。逐次探索と実際の読み取り量で確認し、子のリンクと非通常ファイルを拒否する。既存のルートのリンク互換性とverifyの除外は維持した。

ファイルから読む文書だけでなく、検証失敗情報を含めて組み立てた指示全体も16MiBまでに制限した。trace reportは全証拠のオブジェクトを並べて保持せず、検証しながら最新だけを残す。UsageErrorの既存exportとJSONの版を維持し、coreへI/Oを持ち込んでいない。

共通reader16件、統合12件、除外リンク1件、指示超過2件の失敗を修正前に確認し、境界や互換性の追加も含めて検証した。関連284件、最終の入力34件が成功し、完了ゲートはexit 0、全474件と型・lint・OpenSpec・全REQの対応が成功した。詳細は[TDD記録](../openspec/changes/archive/2026-10-24-bound-input-resources/tdd.md)にある。

9条件を独立したプロセスで測り、想定した受理・拒否と事前の測定予算をすべて満たした。結果は[results.json](../openspec/changes/archive/2026-10-24-bound-input-resources/results.json)、再現手順と互換性への影響は[resources.md](resources.md)を参照する。以前は読めた過大入力も拒否するため、changesetは対象4パッケージのminorとした。

| 条件 | 入力処理の時間 | プロセスのピークRSS | 結果 |
|---|---:|---:|---|
| 小規模の文書 | 3.41ms | 59.64MiB | 読み取り成功 |
| 中規模の文書 | 9.83ms | 78.84MiB | 読み取り成功 |
| 文書の合計16MiBちょうど | 14.92ms | 120.21MiB | 読み取り成功 |
| 証拠JSONの合計超過 | 91.21ms | 367.61MiB | 超過を拒否 |
| 検証失敗情報で指示が超過 | 23.34ms | 136.83MiB | 超過を拒否 |

ピークRSSはモジュールの読み込みとfixture作成も含む。ファイルを作成した後の、キャッシュのあるLinux・Node 24ホストの結果である。別OS、ネットワークファイルシステム、CLI全体や顧客の全規模での性能を保証しない。残る4条件の数値と測定対象ソースのハッシュもresults.jsonにある。

| 観点 | 前回 | 今回の暫定点 / 100 | 残る確認 |
|---|---:|---:|---|
| テスト | 88 | 89 | 全Scenarioとの対応と残る重要条件の棚卸し |
| セキュリティ | 85 | 87 | 対象外の入力経路、環境と独立した確認 |
| 性能と資源制限 | 72 | 82 | 累積ディスク、外部操作の期限、全体の規模別測定 |
| 保守性 | 88 | 89 | プロセス・実行状態の規則と文書全体の同期 |

他11項目は前節までの暫定点を維持する。全項目90点は未達。次は累積の実行記録・生成する証拠と読み取り上限の整合性、Gitとghを含む外部操作の期限、doctorとScenario対応を改善する。


## 2026-10-24 改善の進捗：publish-evidence-atomically

生成する証拠を保存前に形式検証し、整形と末尾改行を含めてUTF-8で64MiBまでに制限した。JSONにした後の形も同じ検証へ通す。実際のrunRecordで過大な結果や不正なschemaVersionを保存する2件と、変換後の形式・文字列の境界の失敗を確認して修正した。不合格の検証結果も記録する既存の動作と、証拠の版・ファイル名は維持した。

保存は同じディレクトリの専用一時ファイルへ完全に書き、同期して閉じてから、ハードリンクで上書きせず公開する。部分書き込み・同期・公開の失敗では不完全な最終名を残さず、既存名と他の所有者の一時名を保つ。保存先の作成失敗をUsageErrorへ変換し、runが実装コミットと停止記録を残して再開できるようにした。

公開後の片付け失敗では、完全な証拠をtrace reportでも確認し、一時名の削除・証拠のコミット・再検証から、証拠・実装・PRを重複させず完了することを試験した。さらに実際のwriterソースを別プロセスで実行し、書き込み途中・公開直前・公開直後にSIGKILLした。最終名が存在しない状態か、完全な最終JSONだけが残り、所有者の終了後に自分の一時名を片付けて再実行できた。

最終の完了ゲートはexit 0。全504件、型・lint・OpenSpecと全REQの対応が成功した。詳細は[TDD記録](../openspec/changes/archive/2026-10-24-publish-evidence-atomically/tdd.md)、実行した復旧手順と残る一時ファイルの扱いは[run-recovery.md](run-recovery.md)にある。保存先に必要なハードリンクは[互換性](compatibility.md)へ記載し、対象3パッケージのminor changesetとした。

### 現時点の暫定点

| 観点 | 点数 / 100 | 主な根拠・残る確認 |
|---|---:|---|
| 設計 | 89 | 開始から証拠公開・PRまでの失敗を整備。累積の資源と外部操作の期限が残る |
| 実装 | 89 | 入力・出力形式と保存失敗を修正。実行記録と外部操作の残る境界を確認する |
| テスト | 89 | 異常・境界・mutation・実プロセス停止を検証。全Scenario対応の棚卸しが残る |
| 動作の信頼性 | 78 | 配布物と実プロセス・Gitは確認。実エンジンとGitHub接続は未確認 |
| TDD | 90 | 複数のchangeで失敗から修正を継続し、既存の期待値を弱めていない |
| アーキテクチャ | 89 | モデル、共通I/O、シリアライズと公開を分離。外部プロセスの期限の規則を集約する |
| OSSとしての整備 | 85 | 貢献・報告・サポート・公開の方針を整備。実際の利用経路と公開の確認が残る |
| ドメイン駆動設計 | 88 | 合意と証拠の整合性条件をI/Oから分離。実行状態と資源のモデルを引き続き整理する |
| セキュリティ | 88 | 予算・型・診断・保存の境界を検証。対象外の経路と独立した確認が残る |
| 供給網と公開 | 86 | 不変参照と資格情報の範囲、出典とprovenanceを設定。公開後の検証は未実施 |
| 互換性 | 78 | API・JSONと既存のリンク互換性を維持。別OS・Nodeの実行結果と旧形式の棚卸しが残る |
| 保守性 | 89 | 共通readerと形式・公開の境界を集約。プロセスと文書全体の同期が残る |
| 使いやすさ | 88 | AI操作42件と復旧手順を確認。doctorの診断範囲が残る |
| 性能と資源制限 | 82 | 入力の予算と9条件を測定。累積ディスク・全体時間・規模別の全体測定が残る |
| 障害対応と復旧 | 90 | 同時実行・中断・強制終了・証拠保存・push・PR失敗と再実行、重複と上書きの防止を検証 |

復旧90点は、定義した停止・再試行の条件を、実プロセス・ローカルGit・代替ghとI/Oの障害注入で検証した結果に基づくレビュー上の判断である。実際のGitHub接続、別OSや電源断での成功を示す点数ではない。全項目90点は未達。次は実行記録の累積予算、Gitとghを含む外部操作の期限、doctorとScenario対応を改善する。


## 2026-10-24 改善の進捗：bound-run-records

実行記録の予算を、既定128MiB/回・履歴全体512MiBとした。履歴は内容を読まずサイズと項目を調べ、4096項目・深さ32までに制限する。開始前に予算が不足する場合は、ブランチやタスクを変更する前に止まる。dry-runは記録を作らず、この予算だけでは拒否しない。

予算判定をI/Oから分離し、秘密情報の置換後のUTF-8量を計上する。データ保存には64KiB・1項目の停止情報を残す。途中の超過では先のコミットと作業中の変更を保ち、後続のコミットやPRへ進まない。過去の記録と既存名を上書きせず、履歴を自動削除しない。

通常のsummary.jsonの契約を維持し、summary自体が予約に収まらなければ、件数と短い理由を持つ別形式のstop.jsonを保存する。実際のI/O失敗後には書き込みを続けず、停止情報も保存できない場合はコンソールへ保存不可を明示する。実ディスク領域の事前確保や、外部プロセスの書き込みの制限は行わない。

設定とstoreの25件、runへの統合の修正前4件の失敗を確認してから実装した。履歴の途中超過も含めて追加31件、runner関連184件が成功した。最終の完了ゲートはexit 0、全535件と型・lint・OpenSpec・要件対応が成功した。[TDD記録](../openspec/changes/archive/2026-10-24-bound-run-records/tdd.md)、[資源予算](resources.md)、[復旧手順](run-recovery.md)に詳細を記載した。

### 現時点の暫定点

| 観点 | 点数 / 100 | 残る主な確認 |
|---|---:|---|
| 設計 | 89 | Git・ghを含む外部操作の期限と停止の境界 |
| 実装 | 89 | 外部操作と対象外の入力経路のエラー境界 |
| テスト | 89 | 全Scenarioとの対応と重要条件の棚卸し |
| 動作の信頼性 | 78 | 実エンジン・GitHub接続での動作 |
| TDD | 90 | 今後の変更でもRed・Greenと期待値の維持を継続 |
| アーキテクチャ | 89 | 外部プロセスの期限の規則を集約する |
| OSSとしての整備 | 85 | 公開対象でのCIと配布・利用経路の確認 |
| ドメイン駆動設計 | 89 | 合意・証拠に加え資源の純粋な判定を分離。実行状態の規則の整理が残る |
| セキュリティ | 88 | 対象外の入力・外部操作と独立した確認 |
| 供給網と公開 | 86 | 公開後の出典とprovenanceの確認 |
| 互換性 | 78 | 別OS・Nodeの実行と旧形式fixtureの棚卸し |
| 保守性 | 89 | プロセスの規則と文書全体の同期 |
| 使いやすさ | 88 | AI操作試験に加えdoctorの診断範囲の改善 |
| 性能と資源制限 | 85 | 記録の累積予算を追加。全体時間と規模別のCLI全体の測定が残る |
| 障害対応と復旧 | 90 | 定義した範囲の復旧を継続検証。実接続・別OS・電源断は未検証 |

全項目90点は未達。AIによる操作試験は人による独立した検証として扱わない。専用の試験用GitHubリポジトリはないため実接続は未実施のままとし、次は外部操作の期限、doctor、Scenario対応と互換性を改善する。


## 2026-10-24 改善の進捗：bound-external-operations

kitへ同期外部操作の監視を集約し、runnerのGit・gh・エンジンの存在確認、traceのGit、verifyのOpenSpec検証と期限つきの品質コマンドへ接続した。Git・ghなどは1操作30秒、出力はstdoutとstderrの合計64MiBを既定の上限とする。runはロック取得前からの実時間の予算を共有し、準備・エンジン・証拠・PRへ残り時間を渡す。品質コマンドには従来の合計残り時間を使う。

制限による停止を、通常の非ゼロ終了や実行ファイルの不存在と区別した。POSIXでは子グループを停止し、親が先に終わった場合も出力を握る子を待ち続けない。中断状態は同じ共有予算に残し、次の操作を始めない。別の非同期実行へ予算や中断状態が漏れず、ネストで外側の期限を延ばさないことも確認した。

接続の8件は修正前にすべて失敗し、接続後に成功した。追加の失敗から、準備で使った時間のエンジンへの反映と、中断後の操作の拒否も修正した。既存の時間切れ試験では、一時的なタスクの完了印をGitで戻せない不具合を再現した。期待値を維持し、仕様を補足して、外部操作なしで自分の印だけを戻すようにした。検証中にtasks.mdが変わった場合は上書きせず停止する。

pushとghの認証・検索・作成を止め、作成後に応答が失われた場合も再実行した。既存の証拠とPRの確認を通り、実装・証拠・PRを重複させずに完了した。共通境界10件、接続11件、既存run62件が成功し、最終の完了ゲートはexit 0。全556件と型・lint・OpenSpec・要件対応が成功した。詳細は[TDD記録](../openspec/changes/archive/2026-10-24-bound-external-operations/tdd.md)、対象範囲は[resources.md](resources.md)、再試行は[run-recovery.md](run-recovery.md)に記載した。

### 現時点の暫定点

| 観点 | 点数 / 100 | 主な根拠・残る確認 |
|---|---:|---|
| 設計 | 90 | 開始前から証拠・PRまでの状態と期限、失敗・再実行を仕様化し、各段階の停止と保全を検証 |
| 実装 | 89 | 既知の期限と後片付けを修正。doctorなど残る入力・操作の境界を確認する |
| テスト | 89 | 全Scenarioとの対応と重要条件の棚卸しが残る |
| 動作の信頼性 | 78 | 実エンジン・GitHub接続での動作が未確認 |
| TDD | 90 | Red・Greenと既存期待値の維持を複数のchangeで継続 |
| アーキテクチャ | 89 | 共通I/Oへ期限と監視を集約。doctorなど未接続の操作を整理する |
| OSSとしての整備 | 85 | 公開対象でのCIと配布・利用経路の確認が残る |
| ドメイン駆動設計 | 89 | 合意・証拠・資源判定を分離。実行状態の規則の整理が残る |
| セキュリティ | 88 | 対象外の入力・外部操作と独立した確認が残る |
| 供給網と公開 | 86 | 公開後の出典とprovenanceの確認が残る |
| 互換性 | 78 | 別OS・Nodeの実行、信号と試験fixtureの対応、旧形式の棚卸しが残る |
| 保守性 | 89 | 共通の監視を導入。未接続の規則と文書全体の同期が残る |
| 使いやすさ | 88 | AI操作試験に加えdoctorの診断範囲を改善する |
| 性能と資源制限 | 87 | 入力・記録・出力・共有時間を制限。規模別のCLI全体の測定が残る |
| 障害対応と復旧 | 90 | 各公開段階の時間切れも検証。実接続・別OS・電源断は未検証 |

設計90点は、定義した状態と失敗境界を仕様とLinux上の試験で確認したレビュー上の判断である。全OSでの停止や、OSが応答しない場合の厳密な期限を保証する点数ではない。Windowsはtaskkillによる停止を試みる実装であり、新しい信号・子孫停止の試験とfixtureを含め、実行結果の確認が必要である。全項目90点は未達。次はdoctorの診断・外部操作の境界、Scenario対応、別OS向けの試験経路と旧形式の互換性を改善する。


## 2026-10-24 改善の進捗：clarify-doctor-diagnostics

doctorの品質コマンドの分類をI/Oから分離し、単純なnpm・pnpmの呼び出しではpackage.jsonのscriptの存在も確認する。欠落・空・不正・過大なmanifest、実行権限のないファイル、導入パスの種類の違いを問題とする。以前はパッケージマネージャーがあるだけで合格していた誤設定を検出できるようにした。

シェル構文や対象を変えるオプションは推測せず、未確認の注意として次に確認する場所を表示する。Yarnには別の解決経路があるため、ルートにscriptがないだけでは問題と断定しない。npm run envなどの組み込み処理も誤認しない。出力末尾へ、静的な確認範囲と、品質コマンドの成功・レポート生成・認証・ネットワーク接続が未確認であることを表示した。

Gitの診断も共通境界へ接続し、診断全体30秒と外側の短い共有期限を守る。制限や異常終了をGit不存在や単なる未除外と混同しない。品質コマンド・認証確認・ネットワーク接続は起動せず、診断前後でファイルが変わらないことも確認した。変更と移行は[doctor.md](doctor.md)、共通境界は[architecture.md](architecture.md)に記載した。

分類の30件を未実装の失敗から実装し、診断の22件も失敗から修正した。公式の呼び出し規則との照合で見つけた2件も、失敗を確認してから直した。既存CLI試験の期待値は維持し、健康なfixtureに品質scriptと実行権限を追加した。最終の関連65件と完了ゲートが成功し、全610件、型・lint・OpenSpec・要件対応も成功した。詳細は[TDD記録](../openspec/changes/archive/2026-10-24-clarify-doctor-diagnostics/tdd.md)にある。

ビルドしたCLIで、script欠落・未対応のコマンド・壊れたpackage.jsonから診断・修正・再確認する3シナリオ12操作が成功した。[結果と出力](../openspec/changes/archive/2026-10-24-clarify-doctor-diagnostics/results.json)には終了コード、ソースとビルド済みコードのハッシュを記録した。現在のファイルとの一致も確認した。従来の配布物でのAI操作42件と合わせて評価するが、今回の12操作はビルドしたCLIの結果であり、新たな公開物や人の試験を示すものではない。

### 現時点の暫定点

| 観点 | 点数 / 100 | 主な根拠・残る確認 |
|---|---:|---|
| 設計 | 90 | 開始から公開・停止・復旧と、診断の確認範囲を定義して検証 |
| 実装 | 89 | 既知の診断の誤認を修正。対象外の入力と別OSの境界の確認が残る |
| テスト | 89 | 全Scenarioとの対応と重要条件の棚卸しが残る |
| 動作の信頼性 | 78 | 実エンジン・GitHub接続での動作が未確認 |
| TDD | 90 | 失敗から修正し、既存の期待値を維持する変更を継続 |
| アーキテクチャ | 90 | 共通readerと外部操作境界へ集約し、診断の分類もI/Oから分離。依存方向と公開APIを維持 |
| OSSとしての整備 | 85 | 公開対象でのCIと配布・利用経路の確認が残る |
| ドメイン駆動設計 | 89 | 合意・証拠・資源の主要ルールを分離。実行状態の規則の整理が残る |
| セキュリティ | 88 | 対象外の入力と環境、独立した確認が残る |
| 供給網と公開 | 86 | 公開後の出典とprovenanceの確認が残る |
| 互換性 | 78 | 別OS・Nodeの実行、信号とfixture、旧形式の棚卸しが残る |
| 保守性 | 89 | 共通の境界と診断の責務を整理。文書全体と仕様・試験の同期が残る |
| 使いやすさ | 90 | AI操作42件に加え診断と復旧12操作、次の確認方法と未確認の表示を検証 |
| 性能と資源制限 | 87 | 入力・出力・記録・共有時間を制限。規模別のCLI全体の測定が残る |
| 障害対応と復旧 | 90 | 定義した停止と再試行を検証。実接続・別OS・電源断は未検証 |

使いやすさ90点は、依頼者の「AIで試験して」に沿った操作試験と、文書・CLI・診断範囲の整合性を根拠にした判断である。人の初見利用者による試験や、利用者全体への使いやすさを示す結果ではない。アーキテクチャの点数も、各OSで外部ツールが動作することの確認とは区別する。全項目90点は未達。次はScenarioと試験の対応、旧形式と別OSの試験経路、実行状態の規則と対象外の入力を改善する。


## 2026-10-24 改善の進捗：audit-scenario-evidence

Scenarioと試験の対応を確認するリポジトリ用の監査を追加した。REQ-IDが一致する試験を候補として示し、内容を読んだ対応理由・仕様のハッシュ・選択する試験・試験ソースのハッシュ・成功した実行結果が揃った行だけを確認済みにする。失敗・skip・古い根拠や不明な参照を、成功した一部で覆い隠さない。

主仕様と進行中の変更32文書から360件を一覧化した。冒頭の概数355には見出しの説明中の文字列1件が含まれており、厳密な対象は既存354件と今回追加した6件である。コード例の見出しは数えず、コード例自体の変更はハッシュで検出する。上書きされたScenarioも黙って消さず、確認済みの置換先と理由を記録する。

初回はcoreの解析、doctor、監査自身の条件とassertionを読み、44件と置換2件を記録した。Git設定そのものの破損や、破壊的なスキーマを拒否する回帰の確認などは、既存の別条件の試験で充足したと扱わず未確認に残した。残る314件には、対応する試験の内容をまだ精査していないものも含まれる。

| 最終の監査 | 件数 |
|---|---:|
| 対象Scenario | 360 |
| 内容をレビューして根拠が有効 | 44 |
| 確認済みのScenarioへ置換 | 2 |
| 未確認 | 314 |
| 無効な根拠・参照のエラー | 0 |

監査自身の26件は、未実装、古いコード例のハッシュ、HTMLの表示の失敗から修正した。最終の完了ゲートはexit 0、全636件、型・lint・OpenSpec・要件対応が成功した。一方、その全体レポートを使ったScenario監査は、未確認が残るためexit 1だった。[対応表](quality/scenario-audit.md)、[レビューの記録](quality/scenarios.json)、[手順と限界](scenario-audit.md)、[実行結果と入力ハッシュ](../openspec/changes/audit-scenario-evidence/results.json)、[TDD記録](../openspec/changes/audit-scenario-evidence/tdd.md)に根拠を残した。

全15項目の暫定点は前節のままとする。テスト89点は、全体の成功と一部の内容レビューだけでは90点へ上げない。保守性89点も、残る対応と文書の同期を確認するまで維持する。全項目90点は未達であり、次は未確認のScenarioを順に読み、実際に試験が不足する条件を補う。入力ハッシュと対応表の整合性の検査を、試験内容の十分さや別OS・実接続の成功の保証として扱わない。


## 2026-10-24 Scenario対応の継続レビュー：verifyとtrace

検証ゲート、証拠の記録、検収レポートについて、Scenarioの条件・結果と試験の準備・assertionを読んだ。既存の対応へ83件を追加し、内容をレビューして根拠が有効なScenarioは127件、置換2件、未確認231件となった。対応を無効にする古いハッシュや、未知・重複の参照は0件である。[現在の対応表](quality/scenario-audit.md)と[入力と実行結果](../openspec/changes/audit-scenario-evidence/results.json)を更新した。

確認不足だった2件を補った。新しい証拠のSHAだけでなく、テストファイルと要件の結果も新しい記録から取ることを、異なる結果を持つ新旧の証拠で試験する。doctorには実際に壊れたGit設定を渡し、Git不存在や未除外と誤案内せず、診断できなかったことを説明する試験を追加した。性能試験はJSON上の1000件だけでなく、1000個の実ファイルを置く形へ補った。既存の期待値と3秒の上限は維持した。

これらは既存実装が満たしていた振る舞いの試験追加であり、未実装の失敗からの修正とは記録しない。関連88件が成功した。完了ゲートは初回に638件中5件が5秒の上限で時間切れになり、設定と期待値を変えずに再実行すると全638件、型・lint・OpenSpec・要件対応が成功した。最初の失敗も結果へ保存し、原因を特定したとは報告しない。

監査は未確認231件があるためexit 1である。Node 20.19の実行を、engines宣言の検査だけで確認済みにしない。ネットワーク不通での実行も、通信モジュールを使わないという静的検査だけでは確認済みにしない。実環境での検証が必要な行には、その不足を理由として残した。

全15項目の暫定点は前節までのままとする。テスト89点と互換性78点は、残るScenarioと環境の検証を確認するまで維持する。全項目90点は未達。次はrunとinitなどの未確認の対応、下限Node・別OS・オフラインでの実行、スキーマ変更などの残る試験を確認する。


## 継続レビュー：runとinit

init、run、変更検出、PR連携のScenarioと試験のassertionを読み、対応を94件追加した。通常のテスト追加と依存だけの変更について、終了コードに加えて、HEADの変更内容とタスクコミットを直接比較するよう2件の試験を補った。既存の期待値と品質設定は維持し、変更検出の27件が成功した。

独立した作業コピーの完了ゲートはexit 0、全657件・型・lint・OpenSpec・要件対応が成功した。その時点では37文書382件中、確認済み221件・置換2件・未確認159件・無効0件だった。未確認が残るためScenario監査はexit 1である。[対応表](quality/scenario-audit.md)と[結果](../openspec/changes/audit-scenario-evidence/results.json)に検証時点を残した。

通常の作業ディレクトリで行った初回ゲートは、657件中1件が通常レポートの不変比較で失敗した。同時に別の検証も動いており、レポートが削除・再生成されていた。初回のログを保存し、設定や期待値を変えずに独立したコピーで再検証した。さらに検証中には後続の変更も進んだため、その変更の成功まで今回の結果から推測しない。

代替エンジンによる処理と、実際のGitHub・Claude Codeの成功は区別した。PR作成、OSからのSIGINT、下限Node、カスタムopenspecDirでのrun全体の停止、未追跡ファイル名の表示など、assertionや環境の不足は未確認として残す。全15項目の暫定点は維持し、全項目90点には未達である。次は残る条件の試験と、後続変更を含む安定した時点での再照合を進める。


## 継続レビュー：中断とカスタムディレクトリ

未追跡ファイル名の表示と、カスタムopenspecDirでのrun全体の停止を、自動試験で確認するよう補った。カスタムディレクトリの試験は、検出関数だけでなく、Scenarioと同じ現行仕様パスの変更をrunへ渡し、終了コード・HEAD・変更保持・タスク未完了を比較する。

SIGINTは、packしてインストールしたCLIのプロセスへ実際に送った。2つ目の代替エンジンが途中のファイルを書いた後に中断し、先行コミットが1件残り、途中の変更はコミットされず、summaryが中断状態となり、タスクが未完了で残ることをassertする。エンジンが終了したことも確認する。この検証を配布物の自動試験へ組み込み、Linux・Node 24で成功した。Windowsでは対象外の表示の確認だけで、中断動作の成功は主張しない。

独立した作業コピーの最終完了ゲートはexit 0、全676件・型・lint・OpenSpec・要件対応が成功した。初回の検証スクリプトの項目名の誤りと、試験ヘルパーの必須引数不足による型検査の失敗も記録へ残した。既存の期待値と品質設定は維持した。[個別検証の結果](../openspec/changes/audit-scenario-evidence/sigint-results.json)と[全体の結果](../openspec/changes/audit-scenario-evidence/results.json)を参照する。

その時点の監査は全388件中、確認済み224件・置換2件・未確認162件・無効0件だった。前回から別の変更で対象が6件増え、今回3件の不足を補った。未確認が残るため監査はexit 1である。後続の変更を含む現在の作業ツリー全体の合格を示す結果ではない。

全15項目の暫定点は維持し、全項目90点には未達である。次は残るScenarioの確認、下限Node・オフライン・別OSの実行と、後続変更を含む再照合を進める。


## 継続レビュー：下限Nodeとオフライン実行

公式のNode 20.19.0 Linux ARM64版をチェックサムと照合し、Node24で準備した配布物を実行した。主要コマンドと公開API、trace recordの保存とreportの25行、runのタスクコミットとSIGINT後の変更保持が成功した。Nodeの宣言を読むだけの確認から、下限Nodeでの実行結果を持つ状態へ進んだ。

子プロセスの通信とio_uringのシステムコールをLinux seccompで拒否した。同じNode20のローカル接続が、制限なしではECONNREFUSED、制限下ではEPERMになることを確認し、同じ制限を継承したCLIでtraceが成功した。静的検査だけでは不足していた実行根拠を補った。

通常の配布物テストとNode20のCIにも同じ検証経路を追加した。既存の検査は維持した。最終の完了ゲートはexit 0で、Node24の全677件・型・lint・OpenSpec・要件対応が成功した。これと別に、Node20の実行確認4件が成功した。検証コピーと現在のコード・テスト・設定・CIの151ファイルが一致することも確認した。別OSとx86_64のCI実行成功は未確認である。[実行結果](../openspec/changes/audit-scenario-evidence/runtime20-results.json)と[照合結果](../openspec/changes/audit-scenario-evidence/results.json)に入力ハッシュと範囲を保存した。

Scenarioは確認済み230件・置換2件・未確認156件・無効0件である。監査は未確認があるためexit 1だった。Node20の結果には、配布物用の実行チェックを使っており、開発用Vitest全体をNode20で実行した結果ではない。

| 観点 | 前回 / 100 | 今回 / 100 | 根拠と残る確認 |
|---|---:|---:|---|
| 互換性 | 78 | 84 | 下限Nodeの配布物と通信拒否下の実行を確認。別OS、旧形式・APIの棚卸しと破壊的変更の検出が残る |

他14項目の暫定点は維持する。全項目90点は未達であり、次は残るScenarioと旧形式の契約、別OSの実行結果を確認する。実際のClaude Code・GitHub接続は引き続き未確認である。


## 継続レビュー：スキーマと公開型の契約

スキーマの履歴を比べる試験に加え、その試験が壊したスキーマを実際に拒否するかを確認した。検査コードを変更せず、一時コピーでルート・配列要素の必須プロパティを削除・改名する。minor更新だけでは拒否され、major更新を伴う変更は許可される8ケースが成功した。検査の起動エラーを検出として数えず、元ファイルの不変性も確認する。

公開型は、packした4ライブラリを利用するTypeScriptのfixtureを厳密にコンパイルした。配布されたVerifyResult.okの宣言をbooleanからstringに変えた対照はTS2322となり、復元すると再び成功した。ワークスペース用のsource条件を使わず、配布物のd.tsを読んでいることを、この対照でも確認できる。開発側のsource条件は、Nodeの実際のresolveで4ライブラリのsrcを指すことを確認した。[スキーマの記録](../openspec/changes/audit-scenario-evidence/schema-contract-results.json)と[公開型の記録](../openspec/changes/audit-scenario-evidence/public-types-results.json)に範囲と結果を残した。

最終の完了ゲートはexit 0で、全680件・型・lint・OpenSpec・要件対応が成功した。別実行のNode20確認4件も、新しい配布物で再実行して成功した。最初のゲートでは、利用側fixtureが通常の型検査に含まれてimportを解決できなかった。fixtureをテストデータに移し、専用のstrictコンパイルを維持して解消した。既存の検査設定と期待値は緩めていない。

対応表は確認済み233件・置換2件・未確認153件・無効0件で、未確認があるため監査はexit 1である。現在のコード・テスト・設定・CIの156ファイルが検証コピーと一致することも確認した。

| 観点 | 前回 / 100 | 今回 / 100 | 根拠と残る確認 |
|---|---:|---:|---|
| 互換性 | 84 | 86 | 必須プロパティと版、主な公開型、sourceと配布物の区別を実行検証。全API・JSON Schema全体・旧形式と別OSの棚卸しは残る |

他14項目の暫定点は維持する。全項目90点は未達である。次は残るScenarioと公開契約の棚卸し、別OSの実行結果を確認する。


## 継続レビュー：診断の漏れと資源制限

既知形式の診断を確認したところ、チャンクをまたぐBearerと秘密鍵、別のトークンに隣接する秘密鍵、JSONの改行・Unicodeエスケープと上限で切れた文字列に、秘匿処理の不足があった。失敗を再現するテストを先に追加し、有限の状態でチャンクを処理し、保存するJSONは値を復号してから置換するように修正した。未知のパスワードや任意の符号化まで検出するという保証はない。

全分割位置と1文字ずつの転送、実際のエンジンstderrと保存されたJSONを確認した。32MiBのold-space制限で64MiBの診断を処理し、通常の出力に戻る試験は、実ソースと配布物の両方で成功した。stdout・stderrの上限超過では、終了要求を無視する実際のエンジンと子の停止も確認した。Gitフックの試験では、runのコミットで既存フックが動いたことのassertionを補った。

protect-run-diagnostics・guard-git-internals・audit-scenario-evidenceの完了ゲートは、8bc0dedの隔離コピーでいずれもexit 0、全725件が成功した。追加の検出機能を含む228b1c9でもaudit-scenario-evidenceの完了ゲートはexit 0で、全728件・型・lint・OpenSpec・要件対応が成功した。同じコピーで作り直した配布物は、Node20.19.0・Linux ARM64の通信拒否下でも4件が成功した。[診断の実行記録](../openspec/changes/protect-run-diagnostics/diagnostic-results.json)と[監査の記録](../openspec/changes/audit-scenario-evidence/results.json)に範囲と入力ハッシュを保存した。

仕様のarchiveによる整理と追加変更も含む検証対象390件のうち、確認済み253件・未確認137件・無効0件となった。今回20件の内容を確認した。未確認が残るため監査はexit 1である。コード等164ファイルを比べると、検証開始後に更新されたguards.tsだけがコピーと異なった。その後続修正と未コミットの文書まで全体検証済みとは扱わない。

元のメモリ試験を削除してから代替試験を追加する操作は、自動承認レビューにテスト弱体化のおそれを理由に拒否された。元の試験とassertionを残してモジュールの読み込みを直し、配布物の試験を別に追加して解消した。途中のローダーエラーは秘匿処理のRedに数えていない。時間制限試験が準備中に期限へ達した実行も成功とは扱わず、個別再実行と後続の全体ゲートで成功を確認した。

### 現時点の暫定点

| 観点 | 点数 / 100 | 90点までに残る主な確認 |
|---|---:|---|
| 設計 | 90 | 既定の到達基準を満たす。後続仕様も維持する |
| 実装 | 89 | 対象外の入力経路と別OSの境界 |
| テスト | 89 | 未確認137件の条件とassertionの照合 |
| 動作の信頼性 | 78 | 実Claude Code・GitHub接続、別OSでの動作 |
| TDD | 90 | 失敗から修正する手順と期待値を維持する |
| アーキテクチャ | 90 | 依存方向と共通境界を維持する |
| OSSとしての整備 | 85 | 公開対象のCI・配布・利用経路の実行確認 |
| ドメイン駆動設計 | 89 | 実行状態に関する規則の整理と検証 |
| セキュリティ | 89 | 対象外の入力・環境と独立した確認 |
| 供給網と公開 | 86 | 公開後の出典とprovenanceの確認 |
| 互換性 | 86 | 全API・旧形式・別OSの契約 |
| 保守性 | 89 | 文書全体と仕様・試験の同期 |
| 使いやすさ | 90 | AI操作試験に基づく到達。人による試験とは区別する |
| 性能と資源制限 | 87 | 規模別のCLI全体の測定 |
| 障害対応と復旧 | 90 | 定義した基準を維持する。実接続・別OS・電源断は未検証 |

セキュリティは、実際の漏れの修正と、実ソース・配布物・統合試験の根拠を補ったため88点から89点へ見直した。他14項目は維持する。全項目90点には未達である。次は後続修正の再照合、残るScenario、実行状態の規則と規模別の測定を進める。


## 継続レビュー：実行判断の分離と今回の区切り

isolate-run-decisionsで、エンジン終了後と完了ゲート後の判断を、観測済みの値だけを受け取る純粋関数へ分離した。読み取り専用の観測値と、続行・停止・中断、合格・再修正を表す型を使う。エンジン・Git・時計・記録・タスク更新とコミットは呼び出し側が担当する。公開APIとスキーマ、既存の停止理由・終了コード・副作用の順序は維持した。

直接試験24件のうち20件が仮実装で失敗してから実装した。中断、作業状態の変更、修正回数の境界の3条件をコピーで壊し、同じ直接試験のassertionで検出した。入力の不変性も確認した。既存の合意・テスト対応のモデルと、証拠の形式検証に加え、自動実装の主要な判断もI/Oから分離して直接検査できるようになった。これを根拠に、ドメイン駆動設計を89点から90点へ見直した。

036acf3の隔離コピーで、isolate-run-decisionsとaudit-scenario-evidenceの完了ゲートはいずれもexit 0。全764件・型・lint・OpenSpec・要件対応が成功した。同じコピーの配布物は、Node20.19.0・Linux ARM64の通信拒否下でも4件が成功した。現在のコード・テスト・設定・CIの171ファイルがコピーと一致した。未コミットの文書とスキルの変更は、全体検証の対象外である。[実行判断の結果](../openspec/changes/isolate-run-decisions/results.json)、[逆転した条件の検出結果](../openspec/changes/isolate-run-decisions/mutation-results.json)、[対応監査](../openspec/changes/audit-scenario-evidence/results.json)に根拠を保存した。

今回、実行判断・既存のドメイン変異試験・テスト弱体化検出の16シナリオを照合した。archiveと別の追加変更も含む全401件は、確認済み269件・未確認132件・無効0件である。未確認が残るため監査はexit 1。件数の増減だけでテストの点数は上げない。

### この区切りでの評価

| 観点 | 点数 / 100 | 90点までに残る主な確認 |
|---|---:|---|
| 設計 | 90 | 到達基準を満たす。後続仕様でも維持する |
| 実装 | 89 | 対象外の入力経路と別OSの境界 |
| テスト | 89 | 未確認132件の条件とassertionの照合 |
| 動作の信頼性 | 78 | 実Claude Code・GitHub接続、別OSでの動作 |
| TDD | 90 | 失敗から修正する手順と期待値を維持する |
| アーキテクチャ | 90 | 依存方向と共通境界を維持する |
| OSSとしての整備 | 85 | 公開対象のCI・配布・利用経路の実行確認 |
| ドメイン駆動設計 | 90 | 用語と責務、主要な整合性条件と実行判断を分離し、直接試験と統合試験で確認 |
| セキュリティ | 89 | 対象外の入力・環境と独立した確認 |
| 供給網と公開 | 86 | 公開後の出典とprovenanceの確認 |
| 互換性 | 86 | 全API・旧形式・別OSの契約 |
| 保守性 | 89 | 文書全体と仕様・試験の同期 |
| 使いやすさ | 90 | AI操作試験に基づく到達。人による試験とは区別する |
| 性能と資源制限 | 87 | 規模別のCLI全体の測定 |
| 障害対応と復旧 | 90 | 定義した基準を維持する。実接続・別OS・電源断は未検証 |

90点以上は6／15項目で、全項目90点には未達である。利用者の「今の修正が終わったら区切りにして」という指示に従い、この修正の検証と記録更新を終えて改善を一時停止する。再開時は残る132シナリオ、入力経路と規模別の測定、実接続・別OSなどを確認する。


## PR #47のmain取り込み

mainのc8cd4d8と、18ファイルの競合を解消して統合した。事前認証・品質コマンドの中断・設定キーの警告・テスト書き換え検出・証拠の不合格表示を、PR側の資源制限と実行判断に接続した。公開の検証と書き込み権限を持つ処理を別ジョブにし、配布物の検査とSHA固定も維持した。

統合後の完了ゲートは全827件・lint・型・OpenSpec・要件対応が成功した。配布物の宣言する下限はmainに合わせてNode22.12とし、公式アーカイブをチェックサムと照合したLinux ARM64版で、通信拒否下の確認4件も成功した。根拠は[統合記録](../openspec/changes/isolate-run-decisions/merge-results.json)に保存した。

点数とScenarioの確認件数は、前節までのレビュー時点の評価として残す。統合後のScenarioを再照合した結果や、別OSの実行成功として扱わない。品質改善ループの一時停止は維持し、今回の作業はPRの競合解消を対象とした。

## 継続レビュー：マージ後のテンプレートとCLIの対応

97e61baの実装を対象に、AGENTS.mdと要件変換スキルの23シナリオ、CLIとNode22の版宣言の13シナリオを精査した。テスト名のREQ-IDだけでなく、入力の準備とassertionを読み、全838件が成功した同じ作業コピーのレポートと照合した。36件の対応をscenarios.jsonへ記録した。31件は以前の表で未確認、5件は後続変更で追加されたScenarioである。根拠は[テンプレートの確認結果](../openspec/changes/audit-scenario-evidence/post-merge-template-review-results.json)と[CLIの確認結果](../openspec/changes/audit-scenario-evidence/post-merge-cli-review-results.json)に保存した。

CLIの使い方の誤りについては、既存試験が終了コード2と日本語をassertしていても、対応するSourceのREQ-192が試験名になかったため、確認済みにしなかった。外部操作の期限によるCLI失敗も未確認に残した。Node22のCIジョブについて確認したのは記述であり、GitHub上での実行成功ではない。

全体のScenario監査は、正常なREMOVED Requirementsの解析で停止している。ここで示した36件は部分的な照合結果であり、以前の401件から単純に差し引いた件数や、マージ後の全体件数は示さない。全15項目の点数は据え置く。削除の節を扱う仕様への追記案は確認待ちであり、実装はまだ変更していない。

## 継続レビュー：削除指示の監査とマージ後の再照合

承認済みの仕様に従い、audit-scenario-evidenceの10.1〜10.3を実装した。REMOVED Requirementsの削除指示を一覧から除外し、削除のみの文書は空の一覧を返す。通常要件のScenario欠落と未所属のScenarioの拒否、既存のID・内容ハッシュの計算は維持した。

回帰テストを10件追加し、変更前は36件中4件が対象の解析とassertionで失敗、修正後は36件すべて成功した。コピーで削除の識別を壊すと4件、通常要件の欠落を許すと3件、空文書を許すと2件が失敗し、元のコードと試験は不変だった。最終の完了ゲートはexit 0で、全848件・lint・型・OpenSpec・要件対応が成功した。[結果と入力ハッシュ](../openspec/changes/audit-scenario-evidence/removal-results.json)と[条件を壊した検出結果](../openspec/changes/audit-scenario-evidence/removal-mutation-results.json)に記録した。

全体監査は455件を一覧化し、確認済み137件・置換2件・未確認123件・無効193件でexit 1だった。無効は、主にマージで変わった仕様・試験へ古い内容ハッシュが残っているもので、再レビューするまで成功の根拠にしない。今回、監査自身の9件、入力境界5件、外部操作7件、CLIの失敗1件の計22件を内容と最新の成功結果で照合し、変更後の差分仕様への置換2件も記録した。

以前の401件の確認済み269件・未確認132件は、以前のコピーの結果として残す。今回の455件の内訳は後続仕様とマージ後の再照合を含むため、単純な増減でテストの十分さを判断しない。現在の内訳は[対応表](quality/scenario-audit.md)へ反映した。全15項目の点数は据え置き、90点以上は6／15項目。残る未確認と無効の根拠、実接続・別OS・公開後の検証などを継続する。

## 継続レビュー：実行判断とCLIの再照合・規模別の測定

実行判断の9シナリオとCLIの5シナリオを読み直した。中断の優先順位、状態変更と合格、修正回数の境界、入力の不変性と3変異の検出、JSONのスキーマ・テスト対応、依存範囲と性能のassertionを、同じ848件の成功結果と照合した。中断は純粋関数の結果に加え、実プロセスによるゲート中断で再修正のエンジンを呼ばない統合試験も確認した。根拠は[再照合結果](../openspec/changes/audit-scenario-evidence/policy-cli-recheck-results.json)に保存した。

全体監査は455件中、確認済み151件・置換2件・未確認122件・無効180件でexit 1。コード・試験など167ファイルと全体レポートのハッシュが、848件の完了ゲート時点から変わっていないことも確認した。未確認と古い根拠が残るため、テストの点数は89点を維持する。

ビルド済みCLIを別プロセスとして起動し、OpenSpec 1.14.3の実際の検証を含めて、10要件・20ファイル、100要件・200ファイル、500要件・1000ファイルを各3回測定した。品質コマンドは省略し、照合用の成功レポートを事前生成した。ファイルのassertionを1000件実行したという意味ではない。

| 要件数・ファイル数 | CLI全体の時間 | CLI本体の最大RSS | 標準出力 |
|---|---:|---:|---:|
| 10・20 | 約0.77〜1.71秒 | 約60MiB | 3,097バイト |
| 100・200 | 約0.81〜0.86秒 | 約61MiB | 10,130バイト |
| 500・1000 | 約0.77〜1.52秒 | 約68MiB | 41,731バイト |

500要件・1000ファイルは既存の3秒基準内で、全9回とも入力と既存レポートを変更せず、fixture内の論理バイト数も増えなかった。時間はNodeの起動とOpenSpec検証を含み、準備を除く。RSSはCLI本体だけでOpenSpec子プロセスを含まない。fixtureの論理サイズも、ファイルシステムの割り当てやfixture外のキャッシュの大きさを示さない。Linux ARM64の同じホストで3回ずつの結果であり、全環境の性能保証ではない。[測定結果・スクリプト・入力ハッシュ](../openspec/changes/audit-scenario-evidence/cli-scale-results.json)に範囲を保存した。

規模別の測定を入力処理の関数から実際のCLIの起動・終了まで広げたため、性能と資源制限を87点から88点へ見直した。他14項目は据え置き、90点以上は6／15項目。子プロセスを含むメモリ、run・traceなどの規模別の測定、未確認と無効の根拠、実接続・別OS・公開後の検証は残る。

## 継続レビュー：証拠レポートの再照合とCLIの実測

trace reportの38シナリオを、現在の仕様・試験内容・成功結果と再照合した。仕様例のREQ-070とtests/report.test.tsをそのまま使い、全列の対応と保存後の要約変更を確認する試験を追加した。既存の期待値は維持した。これは既存の正しい振る舞いの検証を補うもので、未実装からのRed・Greenとは記録しない。

mainへ入った#54・#55を取り込んだ。全体ゲートでは、packages内の試験追加に必要なchangesetがなく1件失敗した。配布コードを変えない検証追加を空のchangesetで明示してコミットすると、最終の完了ゲートはexit 0、全849件・lint・型・OpenSpec・要件対応が成功した。期待値と検査設定は緩めていない。[再照合・実行結果](../openspec/changes/audit-scenario-evidence/trace-review-results.json)に検証したSHAと入力ハッシュを保存した。

監査は455件中、確認済み189件・置換2件・未確認114件・無効150件でexit 1。異常な証拠の形式・対象change・内容ハッシュ、旧形式の注意、最新の証拠の選択、合意の一覧と警告、出力形式と範囲の説明などを確認した。オフラインは、通信拒否の対照と配布物から25行を出す既存の実行試験も確認した。Node20の古い動作環境Scenarioは、この結果から有効には戻していない。

さらに、通信を拒否した実CLIで、10要件・1証拠、100要件・5証拠、500要件・20証拠を、MarkdownとJSONで各3回、計18回測定した。500要件では約43〜46ms、CLI本体のピークRSSは約69〜70MiB、標準出力はMarkdownで52,892バイト、JSONで135,443バイトだった。既存の5秒基準内で、入力・証拠・論理バイト数は不変、各形式の出力も3回一致した。測定はPythonの通信拒否設定とNodeの起動を含み、fixture準備を除く。RSSはCLI本体だけで、PythonやOS全体の値ではない。見本の証拠を使うLinux ARM64の単一ホストでの結果である。[測定結果とスクリプト](../openspec/changes/audit-scenario-evidence/trace-cli-scale-results.json)に範囲を残した。

verifyに加えてreportのCLI全体を複数の規模・形式で測定し、通信拒否下の作業状態も確認できたため、性能と資源制限を88点から89点へ見直した。他14項目は維持する。runの規模別測定、子プロセスを含むメモリと実ディスクの予算・測定は残る。全項目90点には未達である。

### 最新の暫定評価

| 観点 | 点数／100 | 主に残る確認 |
|---|---:|---|
| 設計 | 90 | 後続仕様でも到達基準を維持する |
| 実装 | 89 | 対象外の入力と別OSの境界 |
| テスト | 89 | 未確認114件・古い根拠150件の再照合 |
| 動作の信頼性 | 78 | 実エンジン・GitHub接続・別OS |
| TDD | 90 | Red・Greenと既存期待値の維持を継続する |
| アーキテクチャ | 90 | 依存方向と共通境界を維持する |
| OSSとしての整備 | 85 | 公開対象のCI・配布・利用経路 |
| ドメイン駆動設計 | 90 | 主要ルールとI/Oの分離を維持する |
| セキュリティ | 89 | 対象外の入力・環境と独立した確認 |
| 供給網と公開 | 86 | 公開後の出典とprovenance |
| 互換性 | 86 | 下限Node・全API・旧形式・別OSの再確認 |
| 保守性 | 89 | 文書全体と仕様・試験の同期 |
| 使いやすさ | 90 | AI操作試験に基づく評価。人の試験とは区別する |
| 性能と資源制限 | 89 | run・全体RSS・実ディスクの予算と測定 |
| 障害対応と復旧 | 90 | 実接続・別OS・電源断は未確認 |

90点以上は6／15項目。過去の検証結果はその時点の記録として残し、現在のコードへ無条件に引き継がない。

## 継続レビュー：現在の配布物をNode22.12で確認

公式配布時のチェックサムを保存したアーカイブと照合し、展開済みのNode22.12.0のバイナリもアーカイブ内と一致することを確認した。現在のコードをビルドして5パッケージをpackし、独立した利用先へオフラインでインストールした。実行時はNode22のbinをPATHの先頭へ置き、通信を拒否した。主要コマンド・公開API、証拠の保存とレポート25行、runのタスクコミットと実SIGINT後の変更保持を含む4チェックが成功した。実Gitを使うが、エンジンとghは見本のコマンドで、実接続の検証ではない。

追加で開発用テストもNode22から実行すると、849件中845件成功・4件失敗だった。3件は証拠公開の強制終了試験で、開発用Node24のstripTypeScriptTypesがNode22.12にないため、待機点に到達する前に失敗した。1件はClaude未導入の試験がPATHをNodeのbinだけに絞り、Gitを見つけられなかった。子のシェルコマンドは元の開発用PATHを継承しているため、この診断を全プロセスがNode22の実行結果として扱わない。失敗をskipしたり期待値を変えたりしていない。

コード・試験・設定など168ファイルと通常の成功レポートのハッシュは、Node24で全849件が成功した完了ゲートの記録と一致した。今回は実装変更がなく、そのゲートの再実行とは区別する。[現在の配布物と診断の結果](../openspec/changes/audit-scenario-evidence/current-runtime22-results.json)に、入力ハッシュ・実行条件・失敗内容を保存した。

配布物の下限環境での成功と開発用試験の制約を分けて記録し、Scenarioの確認済み件数と全15項目の点数は変更しない。互換性は86点、90点以上は6／15項目のままである。別OS、実エンジンとGitHub、全APIと旧形式の契約の検証は残る。

## 継続レビュー：証拠記録の変更検出と再照合

trace recordの15シナリオを再照合した。成功・不合格の記録、コミット案内、不正なchange、未コミット・除外ファイル、既存記録の不変性、保存する文書、検査中の変更、依存制約と通信拒否下の配布物の試験について、入力とassertionを確認した。同じ試験ファイルを参照するtrace reportの依存制約も読み直した。Node20の古い動作環境Scenarioは今回も確認済みにしていない。

未コミットの追跡済み・未追跡ファイルがあるときに品質コマンドを呼ばない2件と、検証中にHEADだけが変わる場合、Gitが除外する保存対象文書だけが変わる場合の2件を追加した。後者は作業ツリーがきれいなこととHEADの状態もassertし、異なる検出条件が拒否理由を隠さないようにした。既存の期待値と製品コードは変更していない。

追加分を含む21件は成功した。一時的に各検出条件を無効にすると、新しい試験が未コミット条件で2件、HEAD条件で1件、文書条件で1件失敗した。各実験後に元の製品コードへ戻した。追加時点で正しい実装が成功したため、製品修正のRed・Greenとは記録しない。

仕様ゲートと最終の完了ゲートはexit 0、全853件・lint・型・OpenSpec・要件対応が成功した。監査は455件中、確認済み204件・置換2件・未確認114件・無効135件でexit 1。[再照合・変異試験・入力ハッシュ](../openspec/changes/audit-scenario-evidence/record-review-results.json)に根拠を保存した。実行環境はNode24・Linux ARM64で、別OSと実エンジン・GitHub接続を確認したという意味ではない。

全15項目の点数は維持する。テストは89点、90点以上は6／15項目。未確認114件と無効135件の再照合、対象外の入力境界、runの規模別資源測定、実接続・別OS・公開後の確認は残る。

## 継続レビュー：合意の書き込みと診断の範囲

trace agreementの5シナリオとdoctorの16シナリオを、現在の仕様・入力・assertion・全体の成功結果で再照合した。合意コマンドには7件を追加した。回答と承認の両方で、対象行だけを置換した全文との一致、LF・CRLFの保持、区切り文字のエスケープ、実在する閏日を確認した。不正日付、値の改行、不存在のID、既存の合意は、終了コード2と理由・全文不変を確認し、古い仮定表の不足列案内も試験した。

doctorでは既存のassertionを補い、診断範囲・シェル構文やYarnの手動確認方法を確認した。共有予算切れでは時間超過の理由とgit statusの案内に加え、外部操作境界への呼び出しが最初のgit --versionだけで、後続のrev-parse・check-ignoreへ進まないことを完全一致で確認した。ファイル不変更、品質scriptを実行しないこと、導入パスの種類、Gitの異常終了、未知キーの警告も読み直した。

仕様ゲートと最終の完了ゲートはexit 0。全860件・lint・型・OpenSpec・要件対応が成功した。対象を絞った試験は合意関連21件とdoctor関連35件が成功した。製品コード、既存の期待値、品質設定は変更していない。追加した試験は正しい実装で最初から成功したため、製品修正のRed・Greenとは記録しない。[再照合と実行結果](../openspec/changes/audit-scenario-evidence/agreement-doctor-review-results.json)に、各対応理由・実行範囲・入力ハッシュを残した。

全体監査は455件中、確認済み217件・置換2件・未確認108件・無効128件でexit 1。今回の21件には以前から有効だった8件も含むので、確認済みの純増は13件である。全15項目の点数は据え置き、90点以上は6／15項目。Node24・Linux ARM64の範囲を越えた成功や、未確認と古い根拠の解消は主張しない。

## 継続レビュー：verifyの49シナリオ

verifyの現行49シナリオを、仕様・試験の準備・assertion・成功結果で再照合した。ブロッキング質問、解析エラー、Sourceと台帳の整合、警告、実OpenSpec検証、完了条件、品質コマンド、JSON、終了コード、依存制約、共有質問、品質コマンド省略の表示を確認した。一部の終了コードScenarioは、runVerifyの詳細とokの検証に、CLIが合否を終了コードへ変換する別試験を組み合わせた根拠であり、同じ入力をCLIで実行したとは記載していない。

不正なchange-idを拒否する既存試験は、OpenSpecを実行した表示がないことを確認していた。外部操作そのものがないことを確かめる試験を1件追加し、c1&echoを含む6種類の入力で終了コード2・日本語・標準出力なし・外部操作境界の呼び出しゼロをassertした。製品コードや既存の期待値・設定は変更していない。最初から正しい実装で成功する検証追加であり、製品修正のRed・Greenではない。

it.skip、describe.skip.each、テスト名以外のREQ-ID、実行対象外ファイルの除外は、一時プロジェクトで実際のVitestが生成したレポートを使う試験で確認した。過去のレポートだけが残る場合の拒否も確認した。性能試験は500要件・1000ファイルと成功レポートを事前生成し、commandsを省いたmainの実行が3秒未満であることを確認する。1000個のテストを実行した測定や、CLIプロセス全体の測定とは区別する。

仕様ゲートと完了ゲートはexit 0、全861件・lint・型・OpenSpec・要件対応が成功した。関連80件も成功した。全体監査は455件中、確認済み261件・置換2件・未確認98件・無効94件でexit 1。以前から有効な5件を含めて49件を確認し、確認済みの純増は44件である。[各対応理由と実行結果](../openspec/changes/audit-scenario-evidence/verify-review-results.json)に入力ハッシュと検証範囲を保存した。

全15項目の点数は維持し、90点以上は6／15項目。対象はNode24・Linux ARM64であり、別OS・実接続・公開後の確認は残る。未確認98件と古い根拠94件、runの規模別資源測定と対象外の入力境界を引き続き確認する。

## 継続レビュー：runのガードとコミットの停止

run-guardsの主仕様31シナリオと、進行中の変更の9シナリオを照合した。テスト削除・skip・条件付きskip、設定とscripts、仕様とchange文書、未承認時の再開拒否、エンジンによるコミットとブランチ変更、アサーション変更、Git設定・フックを確認した。assertionの数え方からimportとコメントを除く後続仕様の3件は、主仕様の旧Scenarioから置換先を明示した。

特殊文字のパスは既存の検出関数の試験に加え、run全体の3件を追加した。日本語と空白・タブ・改行を含む名前で、仕様変更とテスト削除を正しい対象パスで表示し、終了コード1、エンジンの起動1回、HEAD不変、indexが空、変更と削除の残存、タスク未完了をassertした。Windowsでは日本語と空白だけを対象にする試験だが、今回実行したのはLinuxの3ケースである。

正常なアサーション移動・正規表現の呼び出し変更・テスト追加・壊れたフック・importとコメントの削除について、既存の試験へ実Gitの履歴にrunのタスクコミットがあることをassertする行を補った。製品コードと既存の期待値・品質設定は変更していない。追加試験は正しい実装で最初から成功したため、製品修正のRed・Greenではない。

仕様ゲートと完了ゲートはexit 0、全864件・lint・型・OpenSpec・要件対応が成功した。先に実行した関連51件も成功したが、既存のassertionを補う前の結果であり、最終の全体ゲートと区別して記録した。実Gitを使う一方、エンジンとghは子プロセスで動く試験用の見本で、実サービスの検証ではない。[対応理由・実行結果・入力ハッシュ](../openspec/changes/audit-scenario-evidence/guards-review-results.json)に範囲を保存した。

全体監査は455件中、確認済み297件・置換5件・未確認86件・無効67件でexit 1。全15項目の点数は据え置き、90点以上は6／15項目。対象外の入力、run本体の未確認と資源測定、別OS・実接続・公開後の確認は残る。

## 継続レビュー：run全体の規模別資源測定

ビルド済みCLIのrunを別プロセスで起動し、1・10・50タスクを各3回、通信を拒否した状態で測定した。Gitは実際にコミットし、同じ試験ディレクトリ内のbareリポジトリへpushする。エンジンとghは試験用の見本で、品質コマンドは1要件の成功レポートを生成する。実Claudeの応答時間・トークン・実GitHubやネットワーク輸送の測定ではない。

| タスク数 | CLIの起動から終了 | 観測したプロセス群のRSS合計の最大値 | 割り当て容量の増加 | 標準出力と標準エラーの合計 |
|---|---:|---:|---:|---:|
| 1 | 約0.95〜1.08秒 | 約150〜158MiB | 約0.52MiB | 589バイト |
| 10 | 約3.38〜3.72秒 | 約145〜157MiB | 約1.45〜1.48MiB | 879バイト |
| 50 | 約11.96〜22.75秒 | 約148〜166MiB | 約2.77〜2.78MiB | 2,239バイト |

全9回で終了コード0、予定どおりのエンジン起動数、タスク数に2を足したコミット数、実行の完了記録、未完了タスクなし、作業ツリーがきれいなこと、見本のPR作成1回を確認した。50タスクの1回目と後の2回には時間差があり、単一ホストで3回ずつの測定から一般の速度は保証しない。準備と終了後の検証は時間に含めない。測定用の2分の期限内で、ほかは既定の予算を使った。

RSSは約10ms間隔でCLIと到達できる子プロセスを観測した合計で、Pythonの観測プロセスを含めない。共有ページは各プロセスで数えるため重複があり、短命な子を見落とす可能性もある。厳密なピークやOS全体の使用量ではない。容量は重複inodeを除いたst_blocks×512の実行前後の差で、Git履歴・bareのorigin・見本の実行ファイル・呼び出し記録・証拠と実行記録を含む。測定結果ファイルは対象の外に置いた。物理デバイスの専有量や実行中の最大容量ではない。

コード・試験・設定など170ファイルと通常の成功レポートは、全864件が成功した完了ゲートの記録とハッシュが一致した。今回のゲート再実行とは扱わない。[測定結果・スクリプト全文・入力ハッシュ](../openspec/changes/audit-scenario-evidence/run-cli-scale-results.json)に再現に使った資料を保存した。Scenarioの対応表は変更していない。

run全体と子プロセス・ファイルシステムの観測を追加したが、メモリ・ディスクの予算定義と超過時の検証、実接続・別OS・別の負荷条件は残る。性能と資源制限は89点を維持し、全15項目の90点達成とは判断しない。

## 継続レビュー：導入済み配布物と公開設定の契約

実tarballを独立したconsumerへ導入する既存試験を補い、5パッケージのREADME全文が元と一致すること、MITライセンス、homepage・bugs・非空description・openspecキーワードが残ることをassertした。CLIの5サブコマンドの説明、内部パッケージの用途と0.y.zのAPI変更方針も導入後に確認した。製品コードと既存の期待値・設定は変更していない。

パッケージ認識、CLI名、開発環境の宣言、3OSマトリクス、changesets、ライセンス、公開exports、配布メタデータ、README、公開手順と設定、Actionsの固定参照とCodeQLの記述を含め、29シナリオを再照合した。古いNode20のengines宣言1件は、確認済みのNode22宣言へ明示して置換した。古いNode20の実行条件を合格としたわけではない。

公開物の型は、選んだAPIを使うconsumerのコンパイル、型を壊したときのTS2322、復元後の成功を確認する既存試験も読んだ。開発用source条件は実際の解決先を確かめ、配布物はsource条件なしで同梱exportsを使う。通信拒否とSIGINTの既存試験は、呼ばれる補助スクリプトのassertionも確認した。

初回の完了ゲートは863件成功・1件失敗だった。既存の巨大な停止理由を保存する試験が5000msの期限で時間切れとなった。制限時間・期待値・コードを変えず、同じファイルの単独実行は6件成功、その後の全体ゲートは全864件成功だった。原因は確定しておらず、修正済みの不具合や安定性の証明とは扱わない。仕様ゲートと最終の完了ゲートはexit 0、lint・型・OpenSpec・要件対応も成功した。配布物関連27件も成功した。[対応理由・初回失敗・再検証結果](../openspec/changes/audit-scenario-evidence/package-review-results.json)に範囲と入力ハッシュを保存した。

全体監査は455件中、確認済み320件・置換6件・未確認63件・無効66件でexit 1。ワークフローを読むScenarioの成功は、GitHub上のCI・CodeQL解析、実npm公開、認証やprovenanceの成功を意味しない。動的なCIの条件は未確認に残した。全15項目の点数は据え置き、90点以上は6／15項目である。

## 継続レビュー：runの条件と下限Nodeの全runner試験

run本体の開始拒否、ブランチ、タスク順、コミット、完了ゲート、質問、権限、表示と設定など44シナリオを再照合した。品質コマンドの中断から再修正へ進まない既存の判断モデルの対応も読み直した。指示全文の一致、既存ブランチでの新しいコミット、時間切れ後の子PIDなど、今回のassertionだけでは十分でない点は今後の確認に残した。

Node22.12でClaude未導入の試験を再実行すると、修正前はGitの不在で1件失敗した。PATHをNodeの配置先だけにするfixtureが原因だった。Git自身のexec-pathにGitの実行ファイルがあることを確かめ、その場所だけをPATHにするfixtureへ直した。終了コード2とClaude未導入の日本語という既存の期待値は維持した。修正後は同じNode22の1件が成功した。製品コードは変えておらず、これは試験環境の修正のRed・Greenである。

最初の全体ゲートは862件成功・2件が時間切れだった。並列2ファイルの比較でも別の2件が失敗したため、並列数だけが原因とは判断していない。失敗した3ファイルの順次実行は44件成功し、その後、元の設定の全体ゲートは全864件成功した。仕様ゲートと最終の完了ゲートはexit 0で、lint・型・OpenSpec・要件対応も成功した。並列数・タイムアウト・期待値・品質設定は変更していない。負荷とディスク使用率99%も観測したが、原因の確定とは扱わない。

さらに、確認済みの公式Node22.12.0を使い、子のnodeも同じ版になるようPATHを指定して、runnerの全300件を1ファイルずつ実行し、全件成功した。Node24の全体864件とNode22のrunner300件は別の実行結果である。Node22の配布物のrunとSIGINTの以前の成功も、製品src・manifest・templates・supervisor・ロックファイルなどの差分がなく、実行スクリプトが同一であることを確認した上で参照した。無条件の引き継ぎではない。

監査には、環境を付けた[集約レポート](../openspec/changes/audit-scenario-evidence/run-executions.json)を使った。再実行は `node scripts/scenario-audit.mjs <新しい出力先> docs/quality/scenarios.json openspec/changes/audit-scenario-evidence/run-executions.json` とする。通常のNode24レポートだけではNode22の根拠を満たさない。集約時には、名前が汎用的な古いNode20の対応3件がNode22の結果でも合格になることが分かったため、誤用しないよう古い対応を外して未確認へ戻した。runの古い動作環境は、確認したNode22の差分仕様へ置換した。

全体監査は455件中、確認済み363件・置換7件・未確認61件・無効24件でexit 1。[再照合・初回失敗・Node22の実行条件](../openspec/changes/audit-scenario-evidence/run-review-results.json)に範囲と入力ハッシュを残した。実Gitと試験用エンジン・ghでの結果であり、実ClaudeやGitHub接続の成功ではない。

下限Nodeでのrunnerの検証を300件へ広げ、以前の環境依存も期待値を維持して解消したため、互換性を86点から87点へ見直した。全API・旧形式・別OSと、Node22のtrace全体の確認は残る。ほかの14項目は据え置き、90点以上は6／15項目。テストの時間切れは未解明の検証上の懸念として残す。

### 現在の評価

| 観点 | 点数／100 | 主に残る確認 |
|---|---:|---|
| 設計 | 90 | 後続仕様でも到達基準を維持する |
| 実装 | 89 | 対象外の入力と別OSの境界 |
| テスト | 89 | 未確認61件・無効24件、実行の不安定さ |
| 動作の信頼性 | 78 | 実エンジン・GitHub接続・別OS |
| TDD | 90 | Red・Greenと既存期待値の維持を継続する |
| アーキテクチャ | 90 | 依存方向と共通境界を維持する |
| OSSとしての整備 | 85 | 公開対象のCI・配布・利用経路 |
| ドメイン駆動設計 | 90 | 主要ルールとI/Oの分離を維持する |
| セキュリティ | 89 | 対象外の入力・環境と独立した確認 |
| 供給網と公開 | 86 | 公開後の出典とprovenance |
| 互換性 | 87 | 全API・旧形式・別OSとNode22のtrace全体 |
| 保守性 | 89 | 文書全体と仕様・試験の同期 |
| 使いやすさ | 90 | AI操作試験に基づく評価。人の試験とは区別する |
| 性能と資源制限 | 89 | メモリ・ディスクの予算と超過時の確認 |
| 障害対応と復旧 | 90 | 実接続・別OS・電源断は未確認 |

## 継続レビュー：下限Nodeで全体を実行し、証拠保存を再照合

Node22.12で証拠公開中の強制終了試験を実行し、3件とも型除去APIがないため待機点へ到達せず失敗することを再現した。既存の開発依存TypeScriptで実際のpublication.tsとerrors.tsをJavaScriptへ変換してから、子プロセスで実行する形に直した。製品コード・実行時依存・品質設定は変更していない。ファイル操作の待機位置以降は、子の起動・SIGKILL・assertion・期限・後片付けまで修正前と同一であることをハッシュでも確認した。修正後、同じNode22の3件が成功した。製品修正ではなく、試験環境のRed・Greenとして記録する。

最初の通常設定の完了ゲートは858件成功・6件失敗だった。5件はテスト全体の時間切れ、1件は外部操作の共有期限に達した失敗である。修正した強制終了3件は成功していた。失敗結果は保存し、期限・期待値・設定を緩めていない。その後、公式アーカイブと照合したNode22.12.0をPATHの先頭に指定し、子のnodeも同じ版にして全体を1ファイルずつ実行すると、traceの106件を含む全864件が成功した。さらに通常設定のNode24で完了ゲートを再実行し、全864件・lint・型・OpenSpec・要件対応が成功、exit 0だった。仕様ゲートもexit 0である。最初の失敗原因は確定しておらず、実行の不安定さは残る。

証拠保存の6シナリオについて、過大な証拠の拒否、マルチバイトと整形・末尾改行を含むバイト数の境界、部分書き込み・同期の失敗、既存の最終名の保護、保存先の復旧後に完了済み実装を繰り返さないことを、入力とassertionから確認した。UTF-8の境界は小さい上限を引数に渡す試験で、64MiBちょうどの巨大fixtureを実行したという意味ではない。実Gitと試験用エンジン・ghの結果であり、実ClaudeやGitHub接続の成功ではない。

Node22のtrace record・reportの2シナリオも確認し、古いNode20の2項目は差分仕様に従って置換した。Node24とNode22の全体結果は別の実行として[環境別レポート](../openspec/changes/audit-scenario-evidence/trace22-executions.json)へ保存した。以前のNode22配布物の4チェックは、製品ソースなどの差分がなく、実行スクリプトが同一であることを再確認して参照したもので、今回の再実行とは区別する。対応表の再検査は `node scripts/scenario-audit.mjs <新しい出力先> docs/quality/scenarios.json openspec/changes/audit-scenario-evidence/trace22-executions.json` とする。

全体監査は455件中、確認済み371件・置換9件・未確認51件・無効24件でexit 1。[失敗・修正・全体実行・対応の根拠](../openspec/changes/audit-scenario-evidence/trace22-review-results.json)に実行条件と入力ハッシュを保存した。下限Nodeでの確認をrunnerから全体へ広げ、traceの試験環境の制約も解消したため、互換性を87点から88点へ見直す。ほかの14項目は据え置き、90点以上は6／15項目。別OS・全APIと旧形式の棚卸し・実接続・公開後の確認は残り、全項目90点には未達である。

## 継続レビュー：指示全文・既存ブランチ・保存記録の検証

runの既存試験では、指示文の一部の見出しと、実装ブランチの過去のコミットだけを確認していた。既存の期待値を維持し、AGENTS.mdとtrace.mdの末尾を含む全文、異なる階層の差分仕様2件の全文、対象行をassertした。ブランチの再開では、新しいタスクコミットの親が以前の実装ブランチのHEADであること、過去のファイルと新しい実装の内容、mainのHEAD不変も確認する。停止表示の残タスク一覧、秘密情報を各々***へ変換した結果の全文、不正な状態のエラーのファイルと行番号も追加でassertした。

通常タスク1つと完了ゲートを持つ入力に対し、同じ実行ディレクトリへ最初の指示・出力・検証結果・summaryを保存する試験を1件追加した。初稿では、私が仕様にない「4ファイルだけ」という条件と、公開型と異なるpassedを期待値に入れて1件失敗した。これは製品の不具合を示すRedではない。訂正は自動承認レビューに拒否されたため適用せず、ユーザーの「この2点の修正を承認する」という回答後、必要な4ファイルの存在とcompletedへ直した。既存テストの期待値や品質設定は緩めていない。訂正後のrun関連70件、追加の秘密情報の1件、タスク解析・合意モデル・initの関連60件は成功した。

隔離したコピーで、AGENTSの末尾欠落、2つ目の差分仕様の欠落、traceを見出しだけにする変更、既存ブランチで何もしない変更、残タスクの表示欠落、秘密情報を置換せず削除する変更をそれぞれ試した。6変異すべてを対応する試験が1件ずつ検出し、元の製品コードは不変だった。既存の正しい実装は追加したassertionで成功するため、今回も製品修正のRed・Greenとは記録しない。

タスク解析3シナリオ、合意モデル3シナリオ、initのscript・テストランナー案内6シナリオと、変更したrun関連の対応を読み直した。保存した人工トークンがないことだけでなく、各変換結果が仕様どおりかも確認した。一方、時間切れの2シナリオは経過時間や終了理由を確認していても、その試験自体に子PIDの消滅のassertionがないため未確認に戻した。ハッシュだけを更新して確認済みにはしていない。

仕様ゲートと通常設定のNode24での完了ゲートはexit 0、全865件・lint・型・OpenSpec・要件対応が成功した。子のnodeも同じ版のPATHにしたNode22.12.0の全体の順次実行も、別の実行として全865件成功した。実Gitと試験用エンジン・ghの結果であり、実Claude・GitHub接続や別OSの成功ではない。[環境別レポート](../openspec/changes/audit-scenario-evidence/contracts-executions.json)と[修正・承認・変異・対応の根拠](../openspec/changes/audit-scenario-evidence/contracts-review-results.json)へ保存した。

以前に失敗した共有期限の試験と同じ350msの予算・180msの待機を使い、実際のビルド済み外部操作で、単独3回と7並列21回を測定した。最初の操作は全24回成功し、約211〜227msだった。次の操作は期限で止まり、期限後の操作でファイルは作られなかった。この診断では過去の失敗を再現できず、並列数が原因だとは結論しない。ホストと時点を限定した診断であり、安定性の保証や通常のテスト設定の変更ではない。

全体監査は455件中、確認済み389件・置換9件・未確認43件・無効14件でexit 1。再検査は `node scripts/scenario-audit.mjs <新しい出力先> docs/quality/scenarios.json openspec/changes/audit-scenario-evidence/contracts-executions.json` とする。古い配布物の結果は、製品ソースなどの差分がなく実行スクリプトが同一である条件を再確認して参照した。全15項目の点数は据え置く。テストの不足と実行の不安定さ、実接続・別OS・公開後の確認が残り、全項目90点には未達である。

### 現在の評価

| 観点 | 点数／100 |
|---|---:|
| 設計 | 90 |
| 実装 | 89 |
| テスト | 89 |
| 動作の信頼性 | 78 |
| TDD | 90 |
| アーキテクチャ | 90 |
| OSSとしての整備 | 85 |
| ドメイン駆動設計 | 90 |
| セキュリティ | 89 |
| 供給網と公開 | 86 |
| 互換性 | 88 |
| 保守性 | 89 |
| 使いやすさ | 90 |
| 性能と資源制限 | 89 |
| 障害対応と復旧 | 90 |

90点以上は6／15項目。使いやすさは、ユーザーが指定したAI操作試験に基づく評価である。

## 継続レビュー：時間切れ後のPIDと再試行の外部操作

時間切れの2シナリオについて、エンジンと品質コマンドが自身のPIDを書いてから待機する入力を用意した。既存の期限・終了コード・理由・経過時間などの期待値を維持し、PIDファイルの存在、正の整数であること、runから戻った時点でそのプロセスが生存していないことをassertした。試験自身が残ったプロセスを片付けるのはassertion後のfinallyであり、後片付けの結果を製品の停止成功として数えていない。起動しなかった場合も成功にはならない。製品コードや品質設定は変更していない。

二重起動では、先の実行の記録ファイルの名前と内容が前後で一致することを追加で確認した。不明・別ホストのロックでは、元のロック全文、HEAD、作業ツリーを保つことと、日本語の終了確認・再実行の案内を確認する。同じ秒に再実行する試験では、両summaryの理由に加え、両方の出力JSONの内容が別々に残ることもassertした。

再試行の検証不合格・HEADやブランチの変更・作業ファイルの変更では、PR検索が増えないことに加え、pushが実際に呼ばれないことを確認する。実Gitを呼ぶ関数をspyで包み、各試験で初回のpushを正の対照として確認してから呼び出し履歴を消し、再試行のpushが空であることをassertした。品質コマンドが変えたHEADやブランチを取り消さないことも追加で確認する。隔離したコピーで、不合格の後にもローカルbare originへpushする変異を入れると、新しいassertionが1件失敗した。元の製品コードは不変である。

対象3ファイルの診断は103件成功した。その後、試験ごとにspyを初期化するbeforeEachを追加した際、私がmockClearの戻り値である関数を返してしまい、最初の全体ゲートでは再試行の25件が後片付けのTypeErrorで失敗した。値を返さないブロックへ直すと対象25件は成功した。期待値は変更していない。これは追加した試験フックの不具合であり、製品の不具合を示すRedとは記録しない。

仕様ゲートと最終の完了ゲートはexit 0。通常設定のNode24で全865件・lint・型・OpenSpec・要件対応が成功し、子のnodeも同じ版のPATHへ揃えたNode22.12.0の順次実行でも、別の実行として全865件が成功した。[環境別レポート](../openspec/changes/audit-scenario-evidence/stop-retry-executions.json)と[PID・フック修正・変異・対応の根拠](../openspec/changes/audit-scenario-evidence/stop-retry-review-results.json)に保存した。実Gitと試験用エンジン・ghを使うLinux ARM64の結果で、実Claude・GitHub接続や別OSの成功ではない。

時間切れ・ロックと記録・証拠の再利用とPR再試行・壊れた設定の15シナリオを再照合し、全体監査は455件中、確認済み404件・置換9件・未確認28件・無効14件でexit 1となった。再検査は `node scripts/scenario-audit.mjs <新しい出力先> docs/quality/scenarios.json openspec/changes/audit-scenario-evidence/stop-retry-executions.json` とする。以前の配布物の結果は、製品ソースなどの差分がなく実行スクリプトが同一である条件を再確認して参照した。

全15項目の点数は据え置き、90点以上は6／15項目。エンジンの子孫停止や開始前中断の既存試験には、経過時間やファイル不作成だけを確認するものもあり、今回のPID確認と同じ根拠とは扱わない。これらの検証不足、残るScenarioと古い根拠、過去の時間切れの原因、実接続・別OS・公開後の確認は残る。

## 継続レビュー：CIの実スクリプト・PR呼出時点・通常runの入力予算

`audit-scenario-evidence`の3.1〜3.3・4.1〜4.3として、既存の期待値を維持し、CI・PR・入力・エンジン停止の検証を追加した。製品コード・依存・品質設定は変更していない。

CIでは、実際のci-gate.mjsを一時Gitリポジトリで起動する15試験を追加した。呼び出すverifyの引数、複数change、明示の優先、文書だけの変更、コードの対象不明、archive、失敗の伝播を確認する。呼出先CLIは引数と終了コードを記録する代替実装であり、その中の検証やGitHubのジョブの成功を示すものではない。既存のワークフロー設定試験も組み合わせ、CIからこのスクリプトを呼ぶ接続を確認した。

PRでは、代替ghがcreateを受けた時点の実GitのHEAD、証拠コミットの内容、ローカルbare originの先端を記録し、証拠のコミットと送信が先に終わっていることをassertした。引数全体、本文ファイルの内容、実行中のログアウト、dry-runで認証を呼ばないことも確認する。GitHub上のPR作成と再開は引き続き未確認である。

通常runでtrace・tasks・specsが各1MiBを超える3試験と、入力文書が上限以内でも品質コマンドの失敗情報で指示が16MiBを超える1試験を追加した。対象と上限の表示、エンジンと公開の未実行、HEADの不変、記録とタスクの状態を確認する。既存の過大な証拠と合計予算の試験には、対象ファイルの表示と部分出力なしのassertionを足した。AI操作試験は導入・通常操作・失敗と復旧のassertionを再照合し、人による試験や実接続の結果とは区別する。

エンジンの停止では、後片付け前に採取した親子PIDの状態、SIGTERMの受信、起動前中断でspawnが0回であることを確認する。他の試験のspawnが1回であることを正の対照とした。Linuxのzombieは実行が止まっている根拠として扱い、OSによる回収の完了とは扱わない。

入力関連の最初の診断は43件成功・2件時間切れで、同じ条件で失敗した2件を再実行すると成功した。原因は未確定で、期限・期待値・設定は緩めていない。最初の完了ゲートはテストが成功したが、追加したテストのfinally内のthrowがlintに違反した。後片付けを関数へ移した後の通常設定の完了ゲートはexit 0、全884件・lint・型・OpenSpec・要件対応が成功した。これは製品の不具合を示すRed・Greenではない。

Node22.12.0で子のnodeも同じ版に揃えた全体の順次実行は881件成功・3件失敗だった。AI操作試験1件が60秒、配布物の準備1件が30秒の期限に達し、公開型のコンパイル1件も失敗した。型の失敗は約30秒後だったが、保存した結果から原因を確定していない。同じ2ファイルを設定変更なしで再実行すると7件すべて成功した。再実行は部分的な診断であり、Node22の全体成功とは記録しない。

32件の対応を追加・更新し、変更したテストファイルを参照する既存26件も再照合した。全体監査は455件中、確認済み430件・置換9件・未確認10件・無効6件でexit 1。無効には、対応するNode22の実行で失敗があったものも含む。失敗を含めた[環境別レポート](../openspec/changes/audit-scenario-evidence/parallel-contracts-executions.json)と[対応・実行・診断の根拠](../openspec/changes/audit-scenario-evidence/parallel-contracts-review-results.json)を保存した。再検査は `node scripts/scenario-audit.mjs <新しい出力先> docs/quality/scenarios.json openspec/changes/audit-scenario-evidence/parallel-contracts-executions.json` とする。過去のNode22配布物の4チェックは、製品ソースなどの差分と実行スクリプトの同一性を確認して参照した結果で、今回の再実行ではない。

別のAIによる静的セキュリティレビューの指摘を読み、Linux ARM64の一時リポジトリで、正常終了後の子による遅延書き込み、FIFOのフックでスナップショットが戻らないこと、既存フックのリンク先変更を検出しないことの3件を再現した。FIFOは通常ファイルなら戻る対照も確認した。リンク先の検出範囲はREQ-204で意図的に定めたもので、仕様違反と区別する。実Claude・GitHub・本番環境の被害を確認した結果ではない。[静的レビューと再現結果](../openspec/changes/audit-scenario-evidence/independent-security-review-results.json)には、ソースとビルド結果のハッシュ、試験スクリプト、後片付けの結果、限界を残した。

`docs/security.md`の「権限確認の省略にはコンテナ判定が必須」という説明は、REQ-121・REQ-122と実装に合わせて訂正した。実際には環境変数の宣言を確認し、コンテナ外の通常実行では別途警告・対話確認を行う。新しく確認した子の残留と同期読み込みの停止待ちは未解消のため、この時点のセキュリティを89点から85点、性能と資源制限を89点から87点へ見直す。ほかの13項目は据え置き、90点以上は6／15項目。新しい仕様を追加して修正する方針はユーザー承認済みで、[具体案](../openspec/changes/audit-scenario-evidence/security-followup-proposal.md)に記載した。

## 継続レビュー：通常終了後の子と特殊フックの拒否

承認された方針を`close-engine-and-hook-safety-gaps`のREQ-207〜REQ-209として仕様化し、仕様ゲートexit 0の後で実装した。POSIXのエンジンが終了した時点で同じプロセスグループの後処理を始め、出力の終了と後処理を待ってから戻る。通常の終了コードと出力、既存の時間切れ・中断・出力上限の判定を保つ。フックはリンク文字列の分岐を保ち、通常ファイル以外を内容の読み込み前にUsageErrorで拒否する。設定・上限・実行時依存は変えていない。

エンジンの新規5試験は修正前に3件失敗・対照2件成功、修正後は既存の停止・出力予算を含む17件が成功した。標準出力を共有しない子、SIGTERMを無視する子、出力を保持する子について、起動完了・PID・終了要求の受信・後片付け前の停止状態と遅延書き込みなしを確認する。コード0のJSONとコード1の通常出力も保った。

特殊フックの8試験は修正前4件失敗・対照4件成功、修正後は全8件が成功した。実FIFOとUnixソケットを拒否し、通常runの開始前とエンジン実行後の両方で、タスク全文とHEAD、FIFOと実装の保持、停止summary、公開なしを確認する。修正前は外側の期限で回収したもので、製品が正常に拒否した結果ではない。通常フックと、リンク先のないリンク・FIFOを含むディレクトリへのリンクの対照は引き続き成功する。文書の2試験もRed・Greenを確認した。対応する[エンジン](../openspec/changes/close-engine-and-hook-safety-gaps/engine-regression-results.json)・[フック](../openspec/changes/close-engine-and-hook-safety-gaps/hooks-regression-results.json)・[文書](../openspec/changes/close-engine-and-hook-safety-gaps/docs-regression-results.json)の記録を保存した。

Node22.12.0の全体実行は2回とも899件中898件成功・1件失敗だった。初回は既存のtrace変更検出の表示が期待と異なり、再実行は別の既存の要件対応テストが30秒で時間切れになった。初回の失敗を時間切れと混同しない。ガード40件の再実行、同じtraceケース25回、時間切れになった1件の再確認は、期待値・設定・製品コードを変えずに成功した。原因は未確定で、Node22全体の成功とは記録しない。一時的な25回の診断は全体899件の一部として加算していない。

現在のソースから作り直した5パッケージを、公式アーカイブと照合したNode22.12.0で使い、通信拒否の対照、主要CLIと公開API、traceの全25行、runとSIGINTの4チェックがすべて成功した。制限前の対照はECONNREFUSED、制限下ではEPERMであった。製品コードが変わったため、過去の配布物の結果を今回の根拠として持ち越していない。ビルドした実装で修正前の再現手順を再実行すると、子は戻り時点で消滅し遅延ファイルもなく、FIFOは約63msでUsageErrorになった。リンク先をたどらない挙動は承認された境界として残り、保護範囲を文書と試験で確認した。

新規10シナリオの対応を追加した監査は、465件中、確認済み443件・置換8件・未確認10件・無効4件でexit 1。無効4件は通常の並列実行かNode22の全体実行に失敗がある対応で、CPUを限定した成功や部分的な再確認で隠していない。[環境別レポート](../openspec/changes/close-engine-and-hook-safety-gaps/executions.json)と[統合の根拠](../openspec/changes/close-engine-and-hook-safety-gaps/integration-results.json)へ保存した。再検査は `node scripts/scenario-audit.mjs <新しい出力先> docs/quality/scenarios.json openspec/changes/close-engine-and-hook-safety-gaps/executions.json` とする。

公開文書にも、NPM_TOKENの有無とOIDCの説明に食い違いがあったため、現在のワークフローに合わせた。secretが空であることから認証成功を断定せず、実際のOIDC公開とprovenanceの発行・検証は未確認と明記した。

最終の完了ゲートは、使用するCPUを1つに限定した環境でexit 0、全899件・lint・型・OpenSpec・要件対応が成功した。テストの設定・期限・期待値は同じである。この結果は、CPUを8つ使える通常の並列実行の成功ではない。別OS・実Claude・GitHub接続は確認していない。独立したコードレビューでは今回の範囲のブロッキングな指摘はなかったが、通常終了後の猶予中に期限・中断が起きる境界の直接試験、initやGit内部の残る入力経路、全体の資源予算の証明は改善対象である。全15項目90点には未達である。

通常の完了ゲートの初回は849件成功・50件失敗で、実際のENOSPCが多く出た。ディスクの空きは約85MBであった。変更がなく、使用中でなく、コミットが既存の参照に残る過去のレビュー用checkout7件と、再作成できるキャッシュを整理すると約365MBになった。同じ設定での再実行は894件成功・5件失敗で、外部操作の期限関連4件と新しいソケットの試験の時間切れが残った。空き容量の観測では約224MiB以上を保っており、この5件をENOSPCの解消で成功したとは扱わない。また、過去の原因不明の表示不一致や時間切れも、今回の容量不足が原因だと結論しない。

独立レビューと修正前後の直接試験で、今回再現した子の残留と特殊フックの停止待ちは解消したことを確認した。セキュリティを85点から89点、性能と資源制限を87点から89点へ戻す。通常の並列実行の安定性、initとGit内部の入力の残る上限、全体のメモリ・ディスク予算、別OS・実接続と公開の証明が足りないため、90点にはしない。ほかの13項目は据え置く。

### この変更後の評価

| 観点 | 点数／100 |
|---|---:|
| 設計 | 90 |
| 実装 | 89 |
| テスト | 89 |
| 動作の信頼性 | 78 |
| TDD | 90 |
| アーキテクチャ | 90 |
| OSSとしての整備 | 85 |
| ドメイン駆動設計 | 90 |
| セキュリティ | 89 |
| 供給網と公開 | 86 |
| 互換性 | 88 |
| 保守性 | 89 |
| 使いやすさ | 90 |
| 性能と資源制限 | 89 |
| 障害対応と復旧 | 90 |

90点以上は6／15項目。使いやすさはユーザーが指定したAI操作試験に基づく。次は、通常の並列実行の失敗を完全な出力と状態を残して切り分け、残るローカルのScenarioを照合する。initとGit内部の入力上限や全体の資源制限を追加する場合は、別のchangeで仕様を先に定める。

## 継続レビュー：監視役の起動時間と区切りの検証

`count-supervisor-startup-budget`として、監視役の起動時間が外部操作の予算から抜ける問題を修正した。既存のREQ-180・REQ-182に沿い、仕様ゲートexit 0の後で回帰を追加した。監視役だけを600ms遅らせると、150msの共有予算後でも対象が起動し、約624msで成功する再現が得られた。これは以前の並列実行の失敗原因を特定した結果ではない。

最初の回帰は対照1件成功・3件失敗だった。修正案の独立レビューで、開始時点と後から測った残り時間を組み合わせると経過時間を二度引く問題も見つかった。実際のgetterで準備を遅らせる追加試験も失敗したため、共有予算・呼び出し元・監視役で同じOSの単調時計による絶対期限を使う形に直した。修正後の関連31件は成功した。通常の結果・出力・環境・untilDeadline・停止処理を保ち、設定・既存の期限・期待値・実行時依存は変えていない。監視役自身の起動待ちに対するOS全体の強制上限を追加したものではない。

`audit-scenario-evidence`の3.2・4.1〜4.2では、一時的なゲート完了印の復元と、初回成功後の2回目の検証の停止を直接確かめる2試験を追加した。実品質プロセスが読んだタスク全文、起動合図とPID、後片付け前の停止、保存した検証結果と停止理由、コミット・実装の保持、後続のGit起動と公開がないことを確認する。特殊フックの試験は、snapshotに必要な実ソースだけを読み込むようにし、3秒・10秒の外側の期限と期待値を保った。停止検出の既存試験には全文の出力を失敗説明として付けた。

Node22.12.0の関連81件は77件成功・4件失敗だった。pushの試験は証拠ディレクトリがなく失敗し、createと遅いフックの試験は準備中の時間上限で止まった。変更検出の1件も、不正変更の表示より先にGitの時間上限で止まった。後者の所要時間は約105秒で、同期処理を含むため試験の60秒タイマーだけでは実時間の上限を保証できない。どのGit操作・起動段階で遅れたかはこの実行では未採取である。後から監視役と代替コマンドの段階を記録して同じ4ケースを実行すると成功したが、部分的な再確認であり、Node22の全体成功や以前の失敗原因の解明とは扱わない。

最終のNode24の完了ゲートはexit 0、906件すべて成功し、lint・型・OpenSpec・要件ごとのテスト対応と全タスクの完了も確認した。利用可能なCPUは8つで、CPU数を限定していない。設定・期限・期待値を維持し、試験用の任意の段階ログを有効にした実行である。この1回の成功から、過去の並列失敗がすべて解消したとは結論しない。

7件の対応を追加し、観測の追加でソースハッシュが変わった既存41件の対応も再照合した。現在のNode24全体成功とNode22の失敗を含む監査は、469件中、確認済み448件・置換5件・未確認7件・無効9件でexit 1。kitの製品コードが変わったため、過去のNode22配布物の成功を今回の根拠として持ち越していない。このため無効には配布物の再実行待ちも含む。[環境別レポート](../openspec/changes/count-supervisor-startup-budget/executions.json)・[統合結果](../openspec/changes/count-supervisor-startup-budget/integration-results.json)・[対応のレビュー](../openspec/changes/count-supervisor-startup-budget/scenario-review-results.json)・[段階ごとの診断](../openspec/changes/audit-scenario-evidence/parallel-diagnostics-results.json)に記録した。

実40秒のフック、CIの失敗時の公開停止と認証情報の動的な確認、別OS・実接続・公開後の証明は残る。REQ-144の配布物CIにはNode20.19.0が残り、承認済みのREQ-142のNode22.12.0への変更との仕様整理も必要である。今回は区切りでコミット・PRを作成する依頼に合わせ、新たな改善には着手しない。全15項目の点数は据え置き、90点以上は6／15項目である。

PRの準備時に取得したmainは`7627fe3`で、このブランチと分岐した後に50コミット進んでいた。作業ツリーを変えないmerge-treeの確認では、archiveに伴う記録ファイルの移動、対応表、既存試験に競合がある。今回の906件成功と評価はmainを統合する前の作業ブランチの結果であり、最新mainへ統合した結果ではない。区切りの依頼に合わせて検証済みの状態を保存し、競合とNode22の失敗を明記したドラフトPRにする。mainとの統合と再検証は残る。

この区切りの変更は[ドラフトPR #65](https://github.com/loomake/loomake/pull/65)へ送信した。GitHub上でもmainとの競合を確認しており、統合・再検証は未実施である。
