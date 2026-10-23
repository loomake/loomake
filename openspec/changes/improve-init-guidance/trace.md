# Trace: improve-init-guidance

<!--
このファイルは loomake verify が読む。表の列の順番と見出し名は変えないこと。
状態の値：反映済 / 確認待ち / 範囲外 / 既存仕様で充足
REQ の採番は要件定義書の登場順（全 change で共通）。F-xxx / N-xx は要件書側の ID。
-->

## 入力文書

| 文書 | 版 | 日付 |
|---|---|---|
| docs/requirements/mvp-v0.7.md（Loomake MVP 要件定義書（core・kit）） | v0.7 | 2026-10-22 |
| docs/review.md「2026-10-23 試験プロジェクトでの kit の試用」の指摘 1・2 | - | 2026-10-23 |

## 要件台帳

| ID | 出典 | 種別 | 要約（原文に忠実に） | 状態 | 反映先 |
|---|---|---|---|---|---|
| REQ-019 | 要件定義書 v0.7 §5.1 F-INIT-01 | 機能 | `npx loomake init` で、AGENTS.md・CLAUDE.md・loomake.config.json・req-to-openspec Skill をプロジェクトに配置すること | 反映済 | specs/init/spec.md |
| REQ-024 | 要件定義書 v0.7 §5.1 F-INIT-06 | 機能 | package.json から pnpm・npm・yarn のどれを使っているかを判定し、loomake.config.json の commands の既定値に反映すること | 反映済 | specs/init/spec.md |

## 確認事項

<!-- 回答 欄が空で ブロッキング = yes の行があると、verify の仕様ゲートは失敗する -->

| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 |
|---|---|---|---|---|---|---|

## 仮定

<!-- 承認 欄が空の仮定は verify で警告になる（失敗にはしない） -->

| ID | 関連 | 仮定の内容 | 理由 | 承認 |
|---|---|---|---|---|
| A-01 | REQ-019 | package.json の dependencies と devDependencies に loomake がないとき、init は最後に、loomake を開発用の依存に足すコマンドを案内する。コマンドは判定したパッケージマネージャに合わせる（pnpm：`pnpm add -D loomake`、yarn：`yarn add -D loomake`、npm：`npm install -D loomake`）。package.json は書き換えない | 配った AGENTS.md と Skill は `npx loomake verify` を使う。プロジェクトに入れていないと、実行のたびに最新版を取りにいき、検査に使う版が固まらない。package.json の書き換えは既存ファイルの上書きにあたる。試用の指摘 1 | 承認（2026-10-23） |
| A-02 | REQ-024 | package.json がないとき、init は commands を npm の既定値のまま書き、loomake.config.json の commands をこのプロジェクトのコマンドに書き換えるよう案内する | 書き換えないと完了ゲートの commands が必ず失敗する。試用の指摘 2 | 承認（2026-10-23） |
