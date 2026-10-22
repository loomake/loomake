# Trace: add-kit-assets

<!--
このファイルは scripts/verify.mjs が読む。表の列の順番と見出し名は変えないこと。
状態の値：反映済 / 確認待ち / 範囲外 / 既存仕様で充足
REQ の採番は要件定義書の登場順（全 change で共通）。F-xxx / N-xx は要件書側の ID。
-->

## 入力文書

| 文書 | 版 | 日付 |
|---|---|---|
| docs/requirements/mvp-v0.1.md（Loomake MVP 要件定義書（core・kit）） | v0.1 | 2026-10-22 |
| docs/requirements/mvp-v0.4.md（同上。要件書を Markdown に限った） | v0.4 | 2026-10-22 |

## 要件台帳

| ID | 出典 | 種別 | 要約（原文に忠実に） | 状態 | 反映先 |
|---|---|---|---|---|---|
| REQ-025 | 要件定義書 v0.4 §5.2 F-REQ-01 | 機能 | Markdown（.md）の要件書を読めること | 反映済 | specs/req-to-openspec-skill/spec.md |
| REQ-026 | 要件定義書 v0.1 §5.2 F-REQ-02 | 機能 | 要件書の要求文を 1 文ずつ REQ-001 から採番し、出典（文書名・章またはシートと行）つきで要件台帳に載せること | 反映済 | specs/req-to-openspec-skill/spec.md |
| REQ-027 | 要件定義書 v0.1 §5.2 F-REQ-03 | 機能 | 曖昧さチェックリストを全要件にあて、確認事項（Q）または仮定（A）として記録すること | 反映済 | specs/req-to-openspec-skill/spec.md |
| REQ-028 | 要件定義書 v0.1 §5.2 F-REQ-04 | 機能 | お金・個人情報・権限・データ削除・外部連携・検収数値に関わる曖昧さは、必ずブロッキングな確認事項にすること | 反映済 | specs/req-to-openspec-skill/spec.md |
| REQ-029 | 要件定義書 v0.1 §5.2 F-REQ-05 | 機能 | 要件書をリリース・検収単位の change に分割し、分割案を人に示すこと | 反映済 | specs/req-to-openspec-skill/spec.md |
| REQ-030 | 要件定義書 v0.1 §5.2 F-REQ-06 | 機能 | 各 Requirement に SHALL または MUST の規範文、`Source:` 行、1 つ以上の Scenario を含めること | 反映済 | specs/req-to-openspec-skill/spec.md |
| REQ-031 | 要件定義書 v0.1 §5.2 F-REQ-07 | 機能 | 範囲外の要件は Requirement にせず、proposal.md の Non-goals に書くこと | 反映済 | specs/req-to-openspec-skill/spec.md |
| REQ-032 | 要件定義書 v0.1 §5.2 F-REQ-08 | 機能 | 作業の最後に、change 一覧・台帳の集計・ブロッキング確認事項・未承認の仮定を報告すること | 反映済 | specs/req-to-openspec-skill/spec.md |
| REQ-033 | 要件定義書 v0.1 §5.2 F-REQ-09 | 機能 | ブロッキング確認事項は、顧客にそのまま送れる文面で出力すること | 反映済 | specs/req-to-openspec-skill/spec.md |
| REQ-043 | 要件定義書 v0.1 §5.4 F-AGT-01 | 機能 | 仕様の正、作業の流れ、完了の定義、禁止事項、報告の形を定めること | 反映済 | specs/agents-rules/spec.md |
| REQ-044 | 要件定義書 v0.1 §5.4 F-AGT-02 | 機能 | テストを弱める・skip する・設定を緩める変更を、人の承認なしに行うことを禁止すること | 反映済 | specs/agents-rules/spec.md |
| REQ-045 | 要件定義書 v0.1 §5.4 F-AGT-03 | 機能 | 末尾に、プロジェクトごとに書き換える欄を設けること | 反映済 | specs/agents-rules/spec.md |
| REQ-055 | 要件定義書 v0.1 §6 N-10 | 非機能 | エラーメッセージ・Skill・AGENTS.md を日本語で提供すること | 反映済 | specs/req-to-openspec-skill/spec.md, specs/agents-rules/spec.md |
| REQ-059 | 要件定義書 v0.4 §7 2 項目目 | 制約 | 要件書は Markdown で受け取り、ほかの形式からの変換は利用者が行う | 反映済 | specs/req-to-openspec-skill/spec.md |
| REQ-063 | 要件定義書 v0.4 §2 範囲外 6 行目 | 範囲外 | Markdown 以外の形式（.docx・.xlsx・.pdf など）の要件書の読み取りと変換は範囲外 | 範囲外 | proposal.md Non-goals |
| REQ-062 | 要件定義書 v0.1 §7 5 項目目 | 前提 | 既存の verify.mjs と req-to-openspec Skill の試作版を出発点とする | 既存仕様で充足 | 既存：.agents/skills/req-to-openspec/、AGENTS.md |

## 確認事項

<!-- 回答 欄が空で ブロッキング = yes の行があると、verify の仕様ゲートは失敗する -->

| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 |
|---|---|---|---|---|---|---|
| Q-02 | REQ-025 | .pdf・.xlsx を読むために必要なツール（pdftotext など）を devcontainer に入れますか（要件書 Q-02。setup-monorepo の trace.md と同じ質問で、回答は同じものを使う）。入れない場合、利用者の環境に無いと .pdf・.xlsx は読めません | 入れる / 利用者の環境に任せる | 入れる。.docx・.pdf・.xlsx の 3 形式を devcontainer 内で確かめられる | yes | 入れる（2026-10-22 回答）。その後、要件書 v0.4 で要件書を Markdown に限ったため、入れないことにした（2026-10-22） |

## 仮定

<!-- 承認 欄が空の仮定は verify で警告になる（失敗にはしない） -->

| ID | 関連 | 仮定の内容 | 理由 | 承認 |
|---|---|---|---|---|
| A-01 | REQ-026, REQ-027, REQ-028, REQ-029, REQ-030, REQ-031, REQ-032, REQ-033, REQ-043, REQ-044, REQ-045 | Skill と AGENTS.md の要件は、必須の項目がテンプレートに書かれていることの構造検査で確かめる。AI の実際の振る舞いは、実案件の要件書で人が確かめる（design.md） | 文章は自動テストで振る舞いまでは確かめられない | 承認（2026-10-22） |
| A-02 | REQ-025 | Markdown 以外の形式を渡されたとき、Skill は読まずに、利用者に Markdown への変換を求める | 要件書 v0.4 は Markdown 以外を範囲外としたが、渡されたときの振る舞いは書いていない | 承認（2026-10-22） |
