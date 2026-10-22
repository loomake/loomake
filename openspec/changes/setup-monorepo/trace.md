# Trace: setup-monorepo

<!--
このファイルは scripts/verify.mjs が読む。表の列の順番と見出し名は変えないこと。
状態の値：反映済 / 確認待ち / 範囲外 / 既存仕様で充足

REQ の採番は要件定義書の登場順（全 change で共通）。F-xxx / N-xx は要件書側の ID。
要件定義書 §1 の背景・目的、§3 の利用場面の表（CI 行以外）は説明文で要求ではないため、台帳に載せていない。
-->

## 入力文書

| 文書 | 版 | 日付 |
|---|---|---|
| docs/requirements/mvp-v0.1.md（Loomake MVP 要件定義書（core・kit）） | v0.1 | 2026-10-22 |
| docs/requirements/mvp-v0.2.md（同上。7 章の Node を 24 に改訂） | v0.2 | 2026-10-22 |
| docs/flow.md（開発の流れ。CI の実行方法の補足） | - | 2026-10-22 |

## 要件台帳

| ID | 出典 | 種別 | 要約（原文に忠実に） | 状態 | 反映先 |
|---|---|---|---|---|---|
| REQ-001 | 要件定義書 v0.1 §2 対象 1 行目 | 前提 | 対象：`@loomake/core`（契約・パーサ・JSON スキーマ） | 反映済 | specs/monorepo/spec.md |
| REQ-002 | 要件定義書 v0.1 §2 対象 2 行目 | 前提 | 対象：`@loomake/kit`（req-to-openspec Skill・AGENTS.md・verify・init） | 反映済 | specs/monorepo/spec.md |
| REQ-003 | 要件定義書 v0.1 §2 対象 3 行目 | 前提 | 対象：CLI 本体 `loomake` の `init` と `verify` サブコマンド | 反映済 | specs/monorepo/spec.md |
| REQ-004 | 要件定義書 v0.1 §2 対象 4 行目 | 前提 | 対象：モノレポ `loomake/loomake` の雛形と devcontainer | 反映済 | specs/monorepo/spec.md |
| REQ-005 | 要件定義書 v0.1 §2 範囲外 1 行目 | 範囲外 | `@loomake/trace`（検収レポート）は次フェーズ | 範囲外 | proposal.md Non-goals |
| REQ-006 | 要件定義書 v0.1 §2 範囲外 2 行目 | 範囲外 | `@loomake/runner`（実装の自動実行）は次フェーズ | 範囲外 | proposal.md Non-goals |
| REQ-007 | 要件定義書 v0.1 §2 範囲外 3 行目 | 範囲外 | CLI の `trace` と `run` サブコマンドは範囲外 | 範囲外 | proposal.md Non-goals |
| REQ-008 | 要件定義書 v0.1 §2 範囲外 4 行目 | 範囲外 | 見積・工数管理、GUI、Web ダッシュボードは範囲外 | 範囲外 | proposal.md Non-goals |
| REQ-009 | 要件定義書 v0.1 §2 範囲外 5 行目 | 範囲外 | OpenSpec 以外の仕様フォーマットへの対応は範囲外 | 範囲外 | proposal.md Non-goals |
| REQ-010 | 要件定義書 v0.1 §3 CI 行 | 機能 | CI はプルリクエストごとに完了ゲートを実行し、不合格ならマージを止める | 反映済 | specs/monorepo/spec.md |
| REQ-048 | 要件定義書 v0.1 §6 N-03 | 非機能 | Node.js 20.19 以上で動作すること | 反映済 | specs/monorepo/spec.md |
| REQ-049 | 要件定義書 v0.1 §6 N-04 | 非機能 | macOS・Linux・Windows（WSL を含む）で動作すること | 反映済 | specs/monorepo/spec.md |
| REQ-054 | 要件定義書 v0.1 §6 N-09 | 非機能 | 本書を変換して採番された各要件に、`[REQ-xxx]` を名前に含むテストを 1 つ以上用意すること | 反映済 | specs/monorepo/spec.md |
| REQ-056 | 要件定義書 v0.1 §6 N-11 | 非機能 | npm の `@loomake` スコープで、changesets によりパッケージごとに公開すること | 反映済 | specs/monorepo/spec.md |
| REQ-057 | 要件定義書 v0.1 §6 N-12 | 非機能 | MIT ライセンスで公開すること | 反映済 | specs/monorepo/spec.md |
| REQ-060 | 要件定義書 v0.1 §7 3 項目目 | 制約 | 開発は 1 人で行い、モノレポ `loomake/loomake`（pnpm workspaces）で core・kit・CLI を管理する | 反映済 | specs/monorepo/spec.md |
| REQ-061 | 要件定義書 v0.2 §7 4 項目目 | 制約 | 開発環境は devcontainer（Node 24）を標準とする | 反映済 | specs/monorepo/spec.md（Node は Q-07 の回答で 24） |
| REQ-062 | 要件定義書 v0.1 §7 5 項目目 | 前提 | 既存の verify.mjs と req-to-openspec Skill の試作版を出発点とする | 既存仕様で充足 | 既存：scripts/verify.mjs、.claude/skills/req-to-openspec/ |

## 確認事項

<!-- 回答 欄が空で ブロッキング = yes の行があると、verify の仕様ゲートは失敗する -->

| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 |
|---|---|---|---|---|---|---|
| Q-01 | REQ-003 | CLI 本体 `loomake` を独立パッケージ（`packages/cli`）にしますか、`@loomake/kit` に同梱しますか（要件書 Q-01） | 独立パッケージ / kit に同梱 | 独立パッケージ。`npx loomake init` だけで始められ、architecture.md の案とも一致する | yes | 独立パッケージ（2026-10-22 回答） |
| Q-02 | REQ-061 | devcontainer に pdftotext など .pdf・.xlsx 読み取り用のツールを入れますか（要件書 Q-02） | 入れる / 利用者の環境に任せる | 入れる。Skill が .pdf を読めることを devcontainer 内で確かめられる | yes | 入れる（2026-10-22 回答） |
| Q-07 | REQ-061 | 現在の `.devcontainer/devcontainer.json` のイメージは Node 24 系（`typescript-node:5-24-bookworm`）ですが、要件書は Node 22 を標準としています。どちらに揃えますか | Node 22 に戻す / Node 24 のままにして要件書を直す | Node 22 に戻す。要件書の N-03（20.19 以上）の範囲内で、書かれた標準に従う | yes | Node 24 のままにする（2026-10-22 回答）。要件書 v0.2 で §7 を改訂済み |

## 仮定

<!-- 承認 欄が空の仮定は verify で警告になる（失敗にはしない） -->

| ID | 関連 | 仮定の内容 | 理由 | 承認 |
|---|---|---|---|---|
| A-01 | REQ-010, REQ-060 | 実行基盤は TypeScript・vitest・ESLint とする（design.md） | 要件書に指定がない。AGENTS.md の例とテスト拡張子に合う | 承認（2026-10-22） |
| A-02 | REQ-049 | 「WSL を含む」は ubuntu-latest での CI で確かめたものとみなす（WSL 自体は CI に載せない） | WSL は Linux 上で動くため。GitHub Actions に WSL ランナーが標準でない | 承認（2026-10-22） |
| A-03 | REQ-010 | CI は GitHub Actions を使う。change の特定は PR のブランチ名で行い、一致しないときは品質コマンドだけ実行する。「マージを止める」はワークフローの失敗までを実装し、必須チェックの設定（ブランチ保護）は人が GitHub 上で行う | docs/flow.md §4–5 に GitHub Actions とブランチ運用の記載がある。リポジトリ設定は AI が変更しない | 承認（2026-10-22） |
| A-04 | REQ-054 | `loomake.config.json` の `tests.dirs` に `packages` を追加する | パッケージ内のテストを要件ごとのテスト検査の対象にするため。設定の変更は AGENTS.md 4章により人の承認が必要 | 承認（2026-10-22） |
| A-05 | REQ-056 | changesets の設定とリリース用ワークフローまでを実装し、最初の npm 公開は人が行う | 外部へ公開する操作で、取り消しにくいため | 承認（2026-10-22） |
| A-07 | REQ-061 | Q-02 の「読み取り用ツール」は apt の pandoc（.docx）・poppler-utils（pdftotext、.pdf）・xlsx2csv（.xlsx）とする | 要件書は「pdftotext など」としか書いていない。Debian の標準パッケージで揃う | |
| A-06 | REQ-057 | `LICENSE` の著作権表示は「Copyright (c) 2026 Loomake contributors」とする | 要件書に著作権者名の指定がない | 承認（2026-10-22） |
