# Loomake MVP 要件定義書（core・kit）

Oct 22, 2026 · @r

## 1. 概要

Loomake MVP は、要件書から OpenSpec change を作り、仕様ゲートと完了ゲートで AI 駆動開発の品質を守るための `@loomake/core` と `@loomake/kit` を提供する。

- **背景**：AI に要件書を渡して実装させると、曖昧な点が推測で埋められ、要件とテストの対応も追えなくなる。OpenSpec は「何を作るか」を管理するが、要件書からの取り込みと「守らせる仕組み」は持っていない。
- **目的**：受託開発の要件書を出典つきで OpenSpec に落とし込み、未確定の要件が残る間は実装させず、全要件にテストがあることを機械的に確かめられるようにする。
- **この文書の使い方**：本書自体を `req-to-openspec` Skill に通して Loomake の OpenSpec change を作り、Loomake で Loomake を作る。そのため各要件には `F-CORE-01` のような番号を振り、1 文に 1 つの要求だけを書く。
- **前提資料**：全体設計は `docs/architecture.md` を参照。

## 2. 対象範囲

MVP は「要件書 → OpenSpec change → 仕様ゲート → 実装（人または AI）→ 完了ゲート」が 1 つのリポジトリで回るところまでを対象とする。

| 区分 | 内容 |
| --- | --- |
| 対象 | `@loomake/core`（契約・パーサ・JSON スキーマ） |
| 対象 | `@loomake/kit`（req-to-openspec Skill・AGENTS.md・verify・init） |
| 対象 | CLI 本体 `loomake` の `init` と `verify` サブコマンド |
| 対象 | モノレポ `loomake/loomake` の雛形と devcontainer |
| 範囲外 | `@loomake/trace`（検収レポート）— 次フェーズ |
| 範囲外 | `@loomake/runner`（実装の自動実行）— 次フェーズ |
| 範囲外 | CLI の `trace` と `run` サブコマンド |
| 範囲外 | 見積・工数管理、GUI、Web ダッシュボード |
| 範囲外 | OpenSpec 以外の仕様フォーマットへの対応 |
| 範囲外 | Markdown 以外の形式（.docx・.xlsx・.pdf など）の要件書の読み取りと変換 |

## 3. 利用者と利用場面

主な利用者は、受託開発で AI コーディングエージェントを使う開発者（1〜5 人規模のチーム）である。

| 利用者 | 利用場面 |
| --- | --- |
| 開発者 | 顧客から届いた要件書を AI に渡し、確認事項と OpenSpec change を作らせる |
| 開発者 | 顧客の回答を trace.md に書き込み、仕様ゲートを通してから実装に入る |
| AI エージェント（Claude Code・Codex） | AGENTS.md に従って実装し、完了ゲートが通るまで直す |
| CI | プルリクエストごとに完了ゲートを実行し、不合格ならマージを止める |
| 将来の trace・runner | verify の JSON 出力を読んで検収レポートや実装ループに使う |

## 4. 機能要件：core

`@loomake/core` は、kit・trace・runner が共有する「契約」を読み書きするライブラリである。CLI は持たない。

| ID | 要求 |
| --- | --- |
| F-CORE-01 | trace.md の「要件台帳」「確認事項」「仮定」の 3 つの表を読み、型付きのオブジェクトとして返すこと |
| F-CORE-02 | 要件台帳の「状態」が 反映済・確認待ち・範囲外・既存仕様で充足 のいずれでもない行を、エラーとして報告すること |
| F-CORE-03 | OpenSpec の差分仕様（spec.md）から、Requirement ごとに 操作（ADDED・MODIFIED・REMOVED・RENAMED）、名前、Source の要件 ID、Scenario 数を取り出すこと |
| F-CORE-04 | tasks.md から、チェック済みと未チェックのタスクを取り出すこと |
| F-CORE-05 | テストランナーの JSON レポートから、成功したテストの名前にある `[REQ-xxx]` 形式の要件 ID を取り出し、skip・todo のテストと失敗したテストは数えないこと |
| F-CORE-06 | verify 結果の JSON スキーマを公開し、スキーマに `schemaVersion` を含めること |
| F-CORE-07 | trace.md の空のテンプレートを生成する関数を提供すること |
| F-CORE-08 | 解析エラーには、ファイル名と行番号を含めること |

## 5. 機能要件：kit と CLI

`@loomake/kit` は Skill・ルール・検証ゲートを提供し、CLI 本体 `loomake` から `init` と `verify` で呼び出す。

### 5.1 init

| ID | 要求 |
| --- | --- |
| F-INIT-01 | `npx loomake init` で、AGENTS.md・CLAUDE.md・loomake.config.json・req-to-openspec Skill をプロジェクトに配置すること |
| F-INIT-02 | 配置先に同名ファイルがある場合は上書きせず、差分を表示して確認を求めること |
| F-INIT-03 | `--codex` 指定時は、Skill を `.agents/skills/` にも配置すること |
| F-INIT-04 | `--devcontainer` 指定時は、`.devcontainer/devcontainer.json` を配置すること |
| F-INIT-05 | `openspec/` が無い場合は、`openspec init` の実行を案内すること |
| F-INIT-06 | package.json から pnpm・npm・yarn のどれを使っているかを判定し、loomake.config.json の commands の既定値に反映すること |

### 5.2 req-to-openspec Skill

| ID | 要求 |
| --- | --- |
| F-REQ-01 | Markdown（.md）の要件書を読めること |
| F-REQ-02 | 要件書の要求文を 1 文ずつ REQ-001 から採番し、出典（文書名・章と行）つきで要件台帳に載せること |
| F-REQ-03 | 曖昧さチェックリストを全要件にあて、確認事項（Q）または仮定（A）として記録すること |
| F-REQ-04 | お金・個人情報・権限・データ削除・外部連携・検収数値に関わる曖昧さは、必ずブロッキングな確認事項にすること |
| F-REQ-05 | 要件書をリリース・検収単位の change に分割し、分割案を人に示すこと |
| F-REQ-06 | 各 Requirement に SHALL または MUST の規範文、`Source:` 行、1 つ以上の Scenario を含めること |
| F-REQ-07 | 範囲外の要件は Requirement にせず、proposal.md の Non-goals に書くこと |
| F-REQ-08 | 作業の最後に、change 一覧・台帳の集計・ブロッキング確認事項・未承認の仮定を報告すること |
| F-REQ-09 | ブロッキング確認事項は、顧客にそのまま送れる文面で出力すること |

### 5.3 verify

| ID | 要求 |
| --- | --- |
| F-VER-01 | `loomake verify --change <id> --spec-only` で、未回答のブロッキング確認事項があれば不合格にすること |
| F-VER-02 | 仕様ゲートで、Source の無い Requirement、台帳に無い要件 ID、Scenario の無い Requirement、反映済なのに仕様に無い要件を不合格にすること |
| F-VER-03 | 仕様ゲートで、未承認の仮定と確認待ちの要件を警告として表示すること |
| F-VER-04 | OpenSpec CLI がある場合は `openspec validate --strict` を実行し、結果をゲートに含めること |
| F-VER-05 | `--done` で、仕様ゲートに加えて、未完了タスク・確認待ちの要件・テストの無い要件を不合格にすること |
| F-VER-06 | `--done` で、loomake.config.json の commands（lint・typecheck・test）を実行し、失敗を不合格にすること |
| F-VER-07 | `--json` で、core のスキーマに沿った結果と、要件ごとのテストファイル一覧を出力すること |
| F-VER-08 | 合格なら終了コード 0、不合格なら 1、使い方の誤りなら 2 を返すこと |
| F-VER-09 | `--change` を省略した場合は、commands だけを実行すること |

### 5.4 AGENTS.md

| ID | 要求 |
| --- | --- |
| F-AGT-01 | 仕様の正、作業の流れ、完了の定義、禁止事項、報告の形を定めること |
| F-AGT-02 | テストを弱める・skip する・設定を緩める変更を、人の承認なしに行うことを禁止すること |
| F-AGT-03 | 末尾に、プロジェクトごとに書き換える欄を設けること |

## 6. 非機能要件

数値目標は暫定値で、実案件で使ってから見直す（8 章 Q-04）。

| ID | 種別 | 要求 |
| --- | --- | --- |
| N-01 | 依存 | `@loomake/core` は実行時の外部依存をゼロにすること |
| N-02 | 依存 | `@loomake/kit` の実行時依存は core のみ、`loomake` の実行時依存は core と kit のみとすること |
| N-03 | 環境 | Node.js 20.19 以上で動作すること |
| N-04 | 環境 | macOS・Linux・Windows（WSL を含む）で動作すること |
| N-05 | 性能 | テストファイル 1,000 個・要件 500 件の change で、commands を除く verify が 3 秒以内に終わること（暫定） |
| N-06 | 互換性 | OpenSpec 1.14 以上の change 書式を読めること |
| N-07 | 互換性 | Loomake の追加書式（`Source:` 行・trace.md）が `openspec validate --strict` を通ること |
| N-08 | 互換性 | verify の JSON スキーマに破壊的変更を入れるときは、`schemaVersion` のメジャー番号を上げること |
| N-09 | 品質 | 本書を変換して採番された各要件に、`[REQ-xxx]` を名前に含むテストを 1 つ以上用意すること（kit の規約を自身にも適用する） |
| N-10 | 文書 | エラーメッセージ・Skill・AGENTS.md を日本語で提供すること |
| N-11 | 配布 | npm の `@loomake` スコープで、changesets によりパッケージごとに公開すること（CLI 本体 `loomake` は、`npx loomake` で起動できるようにスコープなしで公開する） |
| N-12 | ライセンス | MIT ライセンスで公開すること |

## 7. 制約・前提

- 仕様の書式は OpenSpec に従い、Loomake 独自の仕様書式は作らない。
- 要件書は Markdown で受け取り、ほかの形式からの変換は利用者が行う。
- 開発は 1 人で行い、モノレポ `loomake/loomake`（pnpm workspaces）で core・kit・CLI を管理する。
- 開発環境は devcontainer（Node 24）を標準とする。
- 既存の verify.mjs と req-to-openspec Skill の試作版を出発点とする。

## 8. 未決事項

v0.4 までに挙げた次の 5 件の回答状況。回答は各 change の trace.md の確認事項にある。

| ID | 関連 | 論点 | 状態 | 参照先 |
| --- | --- | --- | --- | --- |
| Q-01 | 5 章 | CLI 本体 `loomake` を独立パッケージにするか、`@loomake/kit` に同梱するか | 回答済み：独立パッケージ | setup-monorepo の Q-01 |
| Q-02 | F-REQ-01 | .pdf・.xlsx の読み取りに必要なツール（pdftotext など）を devcontainer に入れるか | 不要：v0.4 で要件書を Markdown に限った | setup-monorepo・add-kit-assets の Q-02 |
| Q-03 | N-10 | 英語のメッセージと文書をいつ用意するか | 未回答（非ブロッキング）。候補：MVP から両方 / MVP は日本語のみ | add-verify-cli の Q-03 |
| Q-04 | N-05 | 性能目標（3 秒）の妥当性 | 回答済み：3 秒を合格基準にし、実案件の計測後に見直す | add-verify-cli の Q-04 |
| Q-05 | F-VER-05 | 確認待ちの要件が残っていても、範囲を限定して完了にできる例外を設けるか | 回答済み：設けない | add-verify-cli の Q-05 |

## 9. 改版履歴

| 版 | 日付 | 内容 |
| --- | --- | --- |
| v0.1 | 2026-10-22 | 初版（MVP：core・kit） |
| v0.2 | 2026-10-22 | 7 章：devcontainer の Node を 22 から 24 に変更（setup-monorepo の確認事項 Q-07 の回答） |
| v0.3 | 2026-10-22 | 6 章 N-11：CLI 本体 `loomake` をスコープの例外にした（setup-monorepo の確認事項 Q-10 の回答）。1 章：前提資料の参照先を `docs/architecture.md` に直した |
| v0.4 | 2026-10-22 | 要件書を Markdown に限った。2 章：範囲外に Markdown 以外の形式を追加。5.2 F-REQ-01：読める形式を .md だけにした。7 章 2 項目目：テキストの取り出しを、利用者による Markdown への変換に置き換えた。8 章 Q-02：不要と追記 |
| v0.5 | 2026-10-22 | 6 章 N-02：`loomake` の実行時依存を core と kit にした（add-verify-cli の確認事項 Q-08 の回答）。8 章：未決事項を回答状況と参照先の表にした。5.2 F-REQ-02：出典の書き方から「シート」を外した（v0.4 で要件書を Markdown に限ったため） |
| v0.6 | 2026-10-22 | 4 章 F-CORE-05：要件 ID をテストファイルではなく、テストランナーの JSON レポートから取り出すことにした（add-core-parsers の確認事項 Q-11 の回答） |
