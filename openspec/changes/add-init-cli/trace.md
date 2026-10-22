# Trace: add-init-cli

<!--
このファイルは scripts/verify.mjs が読む。表の列の順番と見出し名は変えないこと。
状態の値：反映済 / 確認待ち / 範囲外 / 既存仕様で充足
REQ の採番は要件定義書の登場順（全 change で共通）。F-xxx / N-xx は要件書側の ID。
-->

## 入力文書

| 文書 | 版 | 日付 |
|---|---|---|
| docs/requirements/mvp-v0.1.md（Loomake MVP 要件定義書（core・kit）） | v0.1 | 2026-10-22 |

## 要件台帳

| ID | 出典 | 種別 | 要約（原文に忠実に） | 状態 | 反映先 |
|---|---|---|---|---|---|
| REQ-019 | 要件定義書 v0.1 §5.1 F-INIT-01 | 機能 | `npx loomake init` で、AGENTS.md・CLAUDE.md・loomake.config.json・req-to-openspec Skill をプロジェクトに配置すること | 反映済 | specs/init/spec.md |
| REQ-020 | 要件定義書 v0.1 §5.1 F-INIT-02 | 機能 | 配置先に同名ファイルがある場合は上書きせず、差分を表示して確認を求めること | 反映済 | specs/init/spec.md |
| REQ-021 | 要件定義書 v0.1 §5.1 F-INIT-03 | 機能 | `--codex` 指定時は、Skill を `.agents/skills/` にも配置すること | 反映済 | specs/init/spec.md |
| REQ-022 | 要件定義書 v0.1 §5.1 F-INIT-04 | 機能 | `--devcontainer` 指定時は、`.devcontainer/devcontainer.json` を配置すること | 反映済 | specs/init/spec.md |
| REQ-023 | 要件定義書 v0.1 §5.1 F-INIT-05 | 機能 | `openspec/` が無い場合は、`openspec init` の実行を案内すること | 反映済 | specs/init/spec.md |
| REQ-024 | 要件定義書 v0.1 §5.1 F-INIT-06 | 機能 | package.json から pnpm・npm・yarn のどれを使っているかを判定し、loomake.config.json の commands の既定値に反映すること | 反映済 | specs/init/spec.md |
| REQ-055 | 要件定義書 v0.1 §6 N-10 | 非機能 | エラーメッセージ・Skill・AGENTS.md を日本語で提供すること | 反映済 | specs/init/spec.md |

## 確認事項

<!-- 回答 欄が空で ブロッキング = yes の行があると、verify の仕様ゲートは失敗する -->

| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 |
|---|---|---|---|---|---|---|
| Q-06 | REQ-020 | 同名ファイルがあるとき「差分を表示して確認を求める」とありますが、CI やパイプなど、確認を受け付けられない環境では何をしますか。既存ファイルの上書きに関わるため、先に決めたいです | 上書きせず、そのファイルをスキップして続行し、終了コード 0 / 上書きせず、そのファイルをスキップして続行し、終了コード 1 / 上書きせず、何も配置せずに中止し、終了コード 1 / `--yes` で強制上書きできるようにする | 上書きせず、何も配置せずに中止し、終了コード 1。一部だけ置かれた中途半端な状態を避けられる | yes | 上書きせず、何も配置せずに中止し、終了コード 1（2026-10-22 回答） |

## 仮定

<!-- 承認 欄が空の仮定は verify で警告になる（失敗にはしない） -->

| ID | 関連 | 仮定の内容 | 理由 | 承認 |
|---|---|---|---|---|
| A-01 | REQ-024 | 判定の順は、package.json の `packageManager` フィールド、なければロックファイル（pnpm-lock.yaml・package-lock.json・yarn.lock）、どれも無ければ npm。commands の既定値は `<pm> lint`・`<pm> typecheck`・`<pm> test`（npm は `npm run lint`・`npm run typecheck`・`npm test`） | 要件書は「package.json から判定」としか書いていない。ロックファイルの利用は要件書にない追加 | 承認（2026-10-22） |
| A-02 | REQ-019 | Claude Code 向けの Skill は `.claude/skills/req-to-openspec/` に置く | 要件書に配置先の指定がない。現行リポジトリの構成に合わせる | 承認（2026-10-22） |
| A-03 | REQ-020 | 差分は unified diff 形式で標準出力に表示し、確認は「上書きしますか [y/N]」で、既定は N（上書きしない）。内容が同じファイルは確認せず変更しない | 要件書に表示形式の指定がない。安全側の既定 | 承認（2026-10-22） |
| A-04 | REQ-022 | `--devcontainer` が置く内容は、setup-monorepo の確定後の `.devcontainer/devcontainer.json` を元にしたテンプレートとする（Node バージョンと追加ツールは setup-monorepo の Q-02・Q-07 の回答に従う） | 要件書に内容の指定がない | 承認（2026-10-22） |
