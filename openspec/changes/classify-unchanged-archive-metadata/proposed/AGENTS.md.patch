--- a/AGENTS.md
+++ b/AGENTS.md
@@ -18,7 +18,7 @@
 
 | 段階 | 対象 | 必須の検査 | レビュー | 記録 |
 |---|---|---|---|---|
-| **L1 文書** | `docs/`・README・openspec の Scenario の文言と Purpose・worklog・changeset だけ | gate（docs-only 判定）＋ lint | Codex 自動レビューのみ | PR 本文に 1 行 |
+| **L1 文書** | `docs/`・README・openspec の Scenario の文言と Purpose・worklog・changeset・archive（「archive のメタデータの移動」に当たる内容不変の `.openspec.yaml` の移動を含む）だけ | gate（docs-only 判定）＋ lint | Codex 自動レビューのみ | PR 本文に 1 行 |
 | **L2 試験・CI・開発基盤** | `tests/`・`packages/*/test/`・`.github/`・`scripts/`・`.agents/skills/`・`packages/kit/templates/`・`packages/*/schema`・ルート設定（package.json、pnpm-lock.yaml、eslint、tsconfig、loomake.config.json）・AGENTS.md・ADR・delivery スキル（規則の変更。利用者の承認が要る） | 必須 5 チェック（change があれば `verify --done` も） | Codex ＋ 独立 Opus **1 回**（指摘があれば修正後に 1 回だけ再レビュー） | worklog に 4 行 |
 | **L3 製品コード** | `packages/*/src`・openspec の Requirement の変更（spec.md の Requirement 本文・SHALL 文） | 必須 5 チェック ＋ `verify --done` ＋ 変更した package の 3 OS 試験（ラベル `ci:all-os`） | Opus 設計 ＋ Codex ＋ 独立 Opus **最大 2 往復** | worklog に 4 行 ＋ 計測表 |
 
