# AGENTS.md

このリポジトリは **Loomake** の規約で開発する。Claude Code・Codex など、どのエージェントでもこのファイルが共通ルールの正本。承認の範囲と人の操作は [ADR 0006](docs/adr/0006-standing-approval-for-autonomous-delivery.md)、管理役の手順は [delivery スキル](.agents/skills/delivery/SKILL.md)、工程の分担と独立レビューの原則は [agent-workflow.md](docs/dev/agent-workflow.md) に置き、ここには複製しない。

## 1. 仕様の正（何が「正」か）

- **現在の仕様**：`openspec/specs/` — いまシステムが満たしているべき振る舞い
- **進行中の変更**：`openspec/changes/<change-id>/` — proposal / specs（差分）/ design / tasks / trace
- **要件の出典**：各 change の `trace.md` — 要件書のどこから来たか、確認事項、仮定

仕様に書かれていない振る舞いは実装しない。必要だと気づいたら、実装を止めて change の specs を更新する提案をする。

`docs/dev/` に書いた開発の仕組み（devcontainer、CI の組み方、テストの書き方の前提など）は製品の仕様ではないので、change を通さずに直してよい（[ADR 0005](docs/adr/0005-keep-dev-mechanics-out-of-specs.md)）。ただし、承認範囲・工程分担・ゲート・完了条件・禁止事項・レビュー規則の変更は規則の変更として扱い、人の判断を仰ぐ。

## 2. 工程の 3 段階

変更の種類で、かける検査を変える。段階は PR の変更パスから gate が決め、PR 本文の `loomake-tier: L1|L2|L3` で上げる方向にだけ上書きできる。

| 段階 | 対象 | 必須の検査 | レビュー | 記録 |
|---|---|---|---|---|
| **L1 文書** | docs/・openspec の文言・worklog・changeset だけ | gate（docs-only 判定）＋ lint | Codex 自動レビューのみ | PR 本文に 1 行 |
| **L2 試験・CI・開発基盤** | test/・.github/・scripts/・テンプレート | 必須 5 チェック | Codex ＋ 独立 Opus **1 回**（指摘があれば修正後に 1 回だけ再レビュー） | worklog に 4 行 |
| **L3 製品コード** | packages/*/src・openspec の Requirement 変更 | 必須 5 チェック ＋ `verify --done` ＋ 変更した package の 3 OS 試験（ラベル `ci:all-os`） | Opus 設計 ＋ Codex ＋ 独立 Opus **最大 2 往復** | worklog に 4 行 ＋ 計測表 |

どの段階でも、流れは次のとおり。

1. 要件書・仕様書を渡されたら、`req-to-openspec` スキルで change を作る
2. 実装に入る前に **仕様ゲート** `pnpm -s verify --change <change-id> --spec-only` を通す。ブロッキングな確認事項が未回答なら失敗する。ADR 0006 に従っておすすめ案を回答として記録し、ゲートが成功するまで実装に進まない
3. `tasks.md` の順に実装する。1 タスクごとに小さくコミットし、終わったタスクは `- [x]` にする。1 つの PR は 1 日以内にマージできる大きさ（目安は commit 10 個以内）にし、大きい change は `tasks.md` の区切りで PR を分ける
4. 完了したら **完了ゲート** `pnpm -s verify --change <change-id> --done` を通す
5. レビュー・修正・検証・記録のような実作業はサブエージェントに分けて任せ、本体は計画と調整に集中する。担当は 1 つの change につき 1 つ。同時に進める本数、マージ条件、レビューの回数は ADR 0006 と delivery スキルに従う

`trace.md` の「要件台帳」「確認事項」「仮定」の表と必須の列は、これまでどおり書く（verify が確かめる）。各欄には問い・選択肢・おすすめ・決定・出典のような要点だけを、おおむね 300 文字以内で書き、経緯や測った結果は PR か Issue に書いてリンクだけを置く。

## 3. 完了の定義（DoD）

次をすべて満たすまで「完了」と報告しない。

- `pnpm -s verify --change <change-id> --done` が exit 0
- change 内の各 Requirement に、対応するテストが 1 つ以上ある
  - テスト名に要件 ID を入れる：`it('[REQ-012] 未ログインのとき 401 を返す', ...)`
  - 1 つのテストが複数の要件を確かめる場合は `[REQ-012][REQ-013]` と並べる
- `tasks.md` がすべてチェック済み

## 4. 禁止事項

- テストを弱める・skip する・期待値を実装に合わせて書き換える。承認経路は設けない。必要性が生じたら Issue に記録し、その変更は行わず独立した次の作業へ進む
- 曖昧な要件を記録せず推測で埋める。`trace.md` の「確認事項」に選択肢・おすすめと理由を整理し、ADR 0006 に従って回答して仕様ゲートを通す
- `loomake.config.json` や lint・型・テストの設定を緩めること、完成範囲を縮めること。承認経路は設けず、必要性が生じたら Issue に記録して独立した次の作業へ進む
- 秘密情報（API キー、パスワード、個人情報）をコード・ログ・テストデータに書く
- `openspec/specs/` を直接編集する（変更は必ず change 経由で、archive 時に反映する）。ただし、change を archive した直後に `## Purpose` を直すことだけは例外とする。新しい capability の仮の文（`TBD - created by archiving change …`）を書き換えるときと、change で Requirement の用語を変えたあとに Purpose に残る古い用語（検収レポートなど）を新しい用語に合わせるときに限る。差分仕様の Purpose は archive で反映されないため

## 5. 報告の形

作業の区切りでは次の 4 項目を、各 1〜2 文で報告する。

1. やったこと（change-id とタスク番号、PR へのリンク）
2. verify の結果
3. 残っている確認事項・仮定
4. 次にやること

同じ 4 項目を `docs/worklog/<日本時間の日付>/<ブランチ名>.md`（`/` は `-` に置き換える。例：`docs/worklog/2026-10-28/docs-foo.md`）に、1 PR 1 節で書く。run ID・session ID・ハッシュは PR 本文の証跡ブロックにあるので書かない。計測表は L3 の PR だけに付け、形は delivery スキルに従う。作業記録はその作業の PR に含め、作業記録だけの PR は作らない。マージ後に記録を足すときは、次の作業のブランチのファイルに書く。2026-10-27 までの日付ごとのファイルは移さずにそのまま残す。

確認事項と仮定は PR 本文に ID・選択肢・おすすめと理由・影響をまとめ、決定・承認者・日本時間の日付・ADR への参照を `trace.md` に記録する（回答の仕方は ADR 0006）。

yomiyasu スキル（Claude Code では `yomiyasu`、Codex では `yomiyasu:yomiyasu`）は、利用者向けの文書（docs/、README、Issue の依頼文）を書くときに使う。報告文・handoff・worklog には使わない。

---

## プロジェクト固有の情報

<!-- ここから下はプロジェクトごとに書き換える -->

- 技術スタック：TypeScript / Node.js（配布物は 22.12 以上、開発は 24）/ Vitest / ESLint（typescript-eslint）
- パッケージマネージャ：pnpm（workspaces）。リリースは changesets
- 主なディレクトリ：`packages/core/` = trace.md などの読み取りと JSON スキーマ、`packages/kit/` = verify・init・doctor の本体と `templates/`（init が配るファイル）、`packages/trace/` = trace record・trace report の本体、`packages/runner/` = run の本体、`packages/cli/` = CLI 本体、`tests/` = リポジトリ全体のテスト、`docs/` = 使い方・開発の流れ・要件定義書・記録
- コーディング規約：関数は named export。`@loomake/core` の外部の実行時依存は `zod` だけ、`@loomake/kit` は core と `yaml` だけ、`@loomake/trace` は core と kit だけ、`@loomake/runner` は core・kit・trace だけ、`loomake` は core・kit・trace・runner だけに保つ（REQ-046・REQ-047・REQ-083・REQ-123）。使い方や設定の誤りは `UsageError` を投げ、CLI が終了コード 2 で返す。利用者に見せるメッセージは日本語で書く
