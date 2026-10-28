# AGENTS.md

このリポジトリは **Loomake** の規約で開発する。Claude Code・Codex など、どのエージェントでもこのファイルが共通ルールの正本。

## 1. 仕様の正（何が「正」か）

- **現在の仕様**：`openspec/specs/` — いまシステムが満たしているべき振る舞い
- **進行中の変更**：`openspec/changes/<change-id>/` — proposal / specs（差分）/ design / tasks / trace
- **要件の出典**：各 change の `trace.md` — 要件書のどこから来たか、確認事項、仮定

仕様に書かれていない振る舞いは実装しない。必要だと気づいたら、実装を止めて change の specs を更新する提案をする。

ただし、`docs/dev/` に書いた開発の仕組み（devcontainer、CI の組み方、テストの書き方の前提など）は製品の仕様ではないので、この決まりには当てはまらず、change を通さずに直してよい。

## 2. 作業の流れ

1. 要件書・仕様書を渡されたら、`req-to-openspec` スキルで change を作る
2. 実装に入る前に **仕様ゲート** を通す
   ```sh
   pnpm -s verify --change <change-id> --spec-only
   ```
   ブロッキングな確認事項が未回答なら、ここで失敗する。失敗したら実装に進まず、確認事項を人に提示する
3. `tasks.md` の順に実装する。1タスクごとに小さくコミットし、終わったタスクは `- [x]` にする
4. 完了したら **完了ゲート** を通す
   ```sh
   pnpm -s verify --change <change-id> --done
   ```
5. レビュー・修正・検証・記録のような実作業は、必要に応じて毎回サブエージェントに分けて任せる。本体のエージェントは計画と調整に集中し、PR ごと・作業ごとに担当を分けて並行して進める

## 3. 完了の定義（DoD）

次をすべて満たすまで「完了」と報告しない。

- `pnpm -s verify --change <change-id> --done` が exit 0
- change 内の各 Requirement に、対応するテストが 1 つ以上ある
  - テスト名に要件 ID を入れる：`it('[REQ-012] 未ログインのとき 401 を返す', ...)`
  - 1 つのテストが複数の要件を確かめる場合は `[REQ-012][REQ-013]` と並べる
- `tasks.md` がすべてチェック済み

## 4. 禁止事項

- 人の承認なしに、テストを弱める・skip する・期待値を実装に合わせて書き換える
- 曖昧な要件を推測で埋める。曖昧なら `trace.md` の「確認事項」に書いて止まる
- `loomake.config.json` や lint・型・テストの設定を緩める変更を、人の承認なしに行う
- 秘密情報（API キー、パスワード、個人情報）をコード・ログ・テストデータに書く
- `openspec/specs/` を直接編集する（変更は必ず change 経由で、archive 時に反映する）。ただし、change を archive した直後に `## Purpose` を直すことだけは例外とする。新しい capability の仮の文（`TBD - created by archiving change …`）を書き換えるときと、change で Requirement の用語を変えたあとに Purpose に残る古い用語（検収レポートなど）を新しい用語に合わせるときに限る。差分仕様の Purpose は archive で反映されないため

## 5. 迷ったとき

推測で進めるより、止まって質問を並べる方が良い。質問は「何が分からないか」「選択肢」「おすすめとその理由」の形で出す。

## 6. 報告の形

作業の区切りでは次の順で短く報告する。

1. やったこと（change-id とタスク番号）
2. verify の結果
3. 残っている確認事項・仮定
4. 次にやること

報告した内容は、作業したブランチごとのファイル `docs/worklog/<日本時間の日付>/<ブランチ名>.md`（例：`docs/worklog/2026-10-28/worklog-per-branch.md`）にも記録する。ブランチ名の `/` は `-` に置き換える（`docs/foo` なら `docs-foo.md`）。同じ日・同じブランチのファイルがあれば、末尾に追記する。

作業記録はその作業の PR に含め、作業記録だけの PR は作らない。PR のマージ後に記録を足すとき（CI の結果やマージの記録など）は、次の作業のブランチのファイルに書き、その PR に含める。2026-10-27 までの日付ごとのファイル（`docs/worklog/2026-10-22.md` など）は、移さずにそのまま残す。

日本語の文章を書いたり直したりするときは、常に yomiyasu スキルで推敲してください（Claude Code では `yomiyasu`、Codex では `yomiyasu:yomiyasu`）。

---

## プロジェクト固有の情報

<!-- ここから下はプロジェクトごとに書き換える -->

- 技術スタック：TypeScript / Node.js（配布物は 22.12 以上、開発は 24）/ Vitest / ESLint（typescript-eslint）
- パッケージマネージャ：pnpm（workspaces）。リリースは changesets
- 主なディレクトリ：`packages/core/` = trace.md などの読み取りと JSON スキーマ、`packages/kit/` = verify・init・doctor の本体と `templates/`（init が配るファイル）、`packages/trace/` = trace record・trace report の本体、`packages/runner/` = run の本体、`packages/cli/` = CLI 本体、`tests/` = リポジトリ全体のテスト、`docs/` = 使い方・開発の流れ・要件定義書・記録
- コーディング規約：関数は named export。`@loomake/core` の外部の実行時依存は `zod` だけ、`@loomake/kit` は core と `yaml` だけ、`@loomake/trace` は core と kit だけ、`@loomake/runner` は core・kit・trace だけ、`loomake` は core・kit・trace・runner だけに保つ（REQ-046・REQ-047・REQ-083・REQ-123）。使い方や設定の誤りは `UsageError` を投げ、CLI が終了コード 2 で返す。利用者に見せるメッセージは日本語で書く
