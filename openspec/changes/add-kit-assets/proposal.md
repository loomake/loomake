# add-kit-assets

## Why
Loomake が守らせる仕組みの中身は、要件書を出典つきで change に変える req-to-openspec Skill と、AI が従う AGENTS.md である。どちらも試作があるが、要件書の機能要件（F-REQ・F-AGT）を満たしているかは確かめられていない。この 2 つを `@loomake/kit` が配布する正式版として整え、`init` が置く内容を確定する。出典：要件定義書 v0.1 §5.2・§5.4・§6・§7

## What Changes
- req-to-openspec Skill を、要件 F-REQ-01〜09 を満たす形に整え、`@loomake/kit` のテンプレートとして持つ
- AGENTS.md（仕様の正・作業の流れ・完了の定義・禁止事項・報告の形・プロジェクト固有欄）を、F-AGT-01〜03 を満たす形に整え、kit のテンプレートとして持つ
- Skill・AGENTS.md を日本語で提供する
- 要件書は Markdown だけを受け取る。ほかの形式からの変換は利用者が行い、kit のコードと Skill には入れない

## Non-goals
- `loomake init` によるプロジェクトへの配置（add-init-cli）
- 英語の Skill・文書（Q-03 の回答は add-verify-cli の trace.md で管理する。MVP は日本語）
- `@loomake/trace`・`@loomake/runner`（setup-monorepo の Non-goals を参照）
- Markdown 以外の形式（.docx・.xlsx・.pdf など）の要件書の読み取りと変換（REQ-063）

## Impact
- 影響する capability：req-to-openspec-skill（新規）、agents-rules（新規）
- 影響するコード：`packages/kit/templates/`（Skill・AGENTS.md・CLAUDE.md・trace.md のテンプレート）
- 前提：setup-monorepo が完了していること。`.agents/skills/req-to-openspec/` と `AGENTS.md` の現行版が出発点（REQ-062）
- 要件書 v0.4 で要件書を Markdown に限ったため、読み取り用ツールは devcontainer に入れない（Q-02）
