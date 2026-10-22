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
