# Trace: tier-ci-gate

<!--
このファイルは loomake verify が読む。表の列の順番と見出し名は変えないこと。
状態の値：反映済 / 確認待ち / 範囲外 / 既存仕様で充足
-->

## 入力文書

| 文書 | 版 | 日付 |
|---|---|---|
| `.loomake/handoff/design-step2-gate-tiers-2026-10-31.md`（Claude の設計メモ。1〜7 章。7 章に judgment 1・2 とタスク 5 の任意項目の採否） | PR #187 head 5d78117 基準 | 2026-10-31 |
| `.loomake/handoff/rebuild-plan-2026-10-31.md` 2.1「変更の種類で工程を分ける」・2.6「作業ツリーとディスク」・3 章の手順 2 | - | 2026-10-31 |
| AGENTS.md 2 章「工程の 3 段階」（PR #187 のマージ後の main） | bd697a8 | 2026-10-31 |
| openspec/specs/monorepo/spec.md の「プルリクエストごとの完了ゲート」「完了ゲートの対象の決め方」「対象の change がない PR の扱い」「文書だけの PR の品質ジョブ」「文書として扱うファイル」 | main | 2026-10-31 |

## 要件台帳

| ID | 出典 | 種別 | 要約（原文に忠実に） | 状態 | 反映先 |
|---|---|---|---|---|---|
| REQ-342 | 設計メモ 1 章、rebuild-plan 2.1、AGENTS.md 2 章（main bd697a8。規則の文書は L2、当たらないパスは L2） | 機能 | gate は変更パスと spec の差分から段階 L1・L2・L3 を決める。最も高い段階を採り、規則の文書は L2、archive の PR は L1。`loomake-tier:` は上げる方向にだけ上書きでき、下げと不正値は失敗 | 反映済 | specs/monorepo/spec.md |
| REQ-343 | 設計メモ 2・3 章、rebuild-plan 3 章の手順 2、AGENTS.md 2 章（main bd697a8「change を持つ PR は段階を問わず verify --done を通す」） | 機能 | L1 は lint と doc-links を実行し、change があれば --done も、なければ verify を呼ばない。L2 は現行どおり。L3 は change が必須。段階と理由を標準出力の 1 行と GITHUB_OUTPUT に書く | 反映済 | specs/monorepo/spec.md |
| REQ-010 | 設計メモ 2 章（既存の Requirement「プルリクエストごとの完了ゲート」） | 既存変更 | 完了ゲートは先に段階を決め、L1 では verify を呼ばない。L2・L3 では現行どおり change ごとに --done | 反映済 | specs/monorepo/spec.md |
| REQ-132 | 設計メモ 1 章末尾（独自 isDocument の削除）、既存の Requirement「対象の change がない PR の扱い」 | 既存変更 | 文書の判定を「文書として扱うファイル」に合わせる。L2 で change がなく文書だけなら品質コマンドだけ、L1 で change がなければ品質コマンドを実行しない | 反映済 | specs/monorepo/spec.md |
| REQ-054 | 既存の Requirement「プルリクエストごとの完了ゲート」の Source | 既存 | 完了ゲートが不合格ならジョブを失敗させる。この change では変えない | 既存仕様で充足 | specs/monorepo/spec.md |
| REQ-288 | archive の change align-template-worklog の trace（Q-02：REQ-273 を REQ-288 に振り直す）、未取り込みのパッチ `.loomake/handoff/patch-req273-to-288-unlanded.patch` | 既存変更 | agents-rules の「AGENTS.md の作業記録の決まり」の Source を REQ-273 から REQ-288 に振り直す。本文は変えない | 反映済 | specs/agents-rules/spec.md |
| REQ-270 | 設計メモ 2 章の「quality ジョブとの整合」 | 既存変更 | quality の docs_only の判定を段階 L1 と同値にする。Requirement の本文だけを変えた spec.md は文書だけと判定しない | 反映済 | specs/monorepo/spec.md |

## 確認事項

| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 | 回答者 | 回答日 |
|---|---|---|---|---|---|---|---|---|
| Q-01 | REQ-343 | L1 で `verify` を呼ばなくなると、文書だけの PR で `tests/doc-links.test.ts` を回す場がなくなる（docs/dev/ci.md）。どうするか（設計メモの judgment 1） | A: L1 の gate で `vitest run tests/doc-links.test.ts` も呼ぶ / B: 落として docs/dev/ci.md を直す | A。数秒で終わり、L1 の変更内容（文書のリンク）に直結する | yes | A を採用する | 設計担当（設計メモ 7 章、2026-10-31 09:05 JST。ADR 0006 の包括承認に基づく） | 2026-10-31 |
| Q-02 | REQ-342 | この change 自体の段階。Requirement を 2 件足すので規則どおりなら L3（設計メモの judgment 2） | A: L3 として受ける（`ci:all-os` で 3 OS を通す） / B: 開発基盤なので L2 に緩める | A。Requirement を足す以上、規則どおり | no | A を採用する。規則を緩める代案は採らない | 設計担当（設計メモ 7 章、2026-10-31 09:05 JST。ADR 0006 の包括承認に基づく） | 2026-10-31 |
| Q-04 | REQ-288 | main で REQ-273 が agents-rules（作業記録の決まり）と monorepo（ci:all-os）で重複している。どちらを振り直すか | A: agents-rules 側を REQ-288 にする（archive の trace の決定どおり） / B: monorepo 側を変える | A。archive の align-template-worklog の Q-02 で REQ-288 に決まっていたが、パッチが取り込まれなかった | no | A を採用する。agents-rules の Source と tests/kit-assets.test.ts・docs/quality/scenarios.json の ID を REQ-288 にする。monorepo の REQ-273 は変えない | 管理役（PR #188 のレビュー対応の指示。ADR 0006 の包括承認に基づく） | 2026-10-31 |
| Q-03 | REQ-343 | L3 で `ci:all-os` ラベルがなければ gate を失敗させるか（設計メモのタスク 5 の任意項目） | A: 今回は入れない / B: 入れる | A。3 OS の時間切れ（手順 5）が直るまで、L3 の PR が Windows で必ず落ちる。手順 5 の完了後に別 PR で足す | no | A を採用する | 設計担当（設計メモ 7 章、2026-10-31 09:05 JST。ADR 0006 の包括承認に基づく） | 2026-10-31 |

## 仮定

| ID | 関連 | 仮定の内容 | 理由 | 承認 | 承認者 | 承認日 |
|---|---|---|---|---|---|---|
| A-01 | REQ-342 | Requirement の変更は、変更行が属する節で判定する。`git diff -U0` のハンクの行番号から、足した行は HEAD の、消した行はベースの spec.md を読み、直前の見出しが `### Requirement:` なら Requirement の変更とする。`#### Scenario:` 配下・Purpose・ほかの見出しの下は L1。ファイルを読めなければ安全側に Requirement の変更とする | 設計メモの「RFC 語を含む行」の近似は、RFC 語のない箇条書きの変更を L1 にし、Scenario に MUST を足すと L3 にしてしまう（Opus レビュー軽微 3） | 承認 | 管理役（PR #188 のレビュー対応の決定。ADR 0006 の包括承認に基づく） | 2026-10-31 |
| A-02 | REQ-342 | status が A か R で変更後のパスが `openspec/changes/archive/` の下にあるファイルがあり、全パスが L1 なら、Requirement の行を足していても L1 とする（archive の下を M で変えただけなら例外に当たらない） | archive の PR は Requirement を実装 PR の --done で検査済み。例外がないと archive PR は change ディレクトリがもうないため L3 で必ず失敗する | 承認 | 設計担当（設計メモ 1 章。ADR 0006 の包括承認に基づく） | 2026-10-31 |
| A-05 | REQ-343 | tasks.md に完了した印が 1 つもない change（提案だけの PR）は `--done` ではなく `--spec-only` で検査する | 提案だけの PR は L1 でも `--done` で必ず落ちる（Opus レビュー情報 10） | 承認 | 管理役（PR #188 のレビュー対応の決定。ADR 0006 の包括承認に基づく） | 2026-10-31 |
| A-04 | REQ-343 | L1 でも対象の change があれば `verify --change <id> --done` を実行する。設計メモ 2 章の「L1 では verify を呼ばない」は change がないときに限る | PR #187 のマージ後の AGENTS.md 2 章が「change を持つ PR は段階を問わず verify --done を通す（gate が実行する）」と定めた。規則の正本を優先する | 承認 | 実装担当（AGENTS.md 2 章 main bd697a8。ADR 0006 の包括承認に基づく） | 2026-10-31 |
| A-03 | REQ-270 | quality ジョブの docs_only の判定は PR 本文の `loomake-tier:` を読まない。本文で L2 以上に上げた文書だけの PR は、quality は飛び、gate の verify が lint・typecheck・test を実行する | quality ジョブは gh で PR 本文を読む権限を持たない。gate の verify で同じ品質コマンドが走るので検査は抜けない | 承認 | 実装担当（設計メモ 1 章「同じ入力・同じ関数で一致」の範囲を本文なしに限定。ADR 0006 の包括承認に基づく） | 2026-10-31 |
