# コードとドキュメントのレビュー

2026-10-22・対象コミット 0229826（行番号はこの時点のもの）

以下は初回レビューとその対応記録。現在の文書を見直した結果は末尾の「ドキュメントの再レビュー」に記載する。

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
