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
| AGENTS.md 2 章「工程の 3 段階」（PR #187） | 5d78117 | 2026-10-31 |
| openspec/specs/monorepo/spec.md の「プルリクエストごとの完了ゲート」「完了ゲートの対象の決め方」「対象の change がない PR の扱い」「文書だけの PR の品質ジョブ」「文書として扱うファイル」 | main | 2026-10-31 |

## 要件台帳

| ID | 出典 | 種別 | 要約（原文に忠実に） | 状態 | 反映先 |
|---|---|---|---|---|---|
| REQ-342 | 設計メモ 1 章、rebuild-plan 2.1、AGENTS.md 2 章 | 機能 | gate は変更パスと spec の差分から段階 L1・L2・L3 を決める。最も高い段階を採り、archive の PR は L1。`loomake-tier:` は上げる方向にだけ上書きでき、下げと不正値は失敗 | 反映済 | specs/monorepo/spec.md |
| REQ-343 | 設計メモ 2・3 章、rebuild-plan 3 章の手順 2（完了条件「L1 の PR で gate が verify --done を呼ばない」） | 機能 | L1 は lint と doc-links だけで verify を呼ばない。L2 は現行どおり。L3 は change が必須。段階と理由を標準出力の 1 行と GITHUB_OUTPUT に書く | 反映済 | specs/monorepo/spec.md |
| REQ-010 | 設計メモ 2 章（既存の Requirement「プルリクエストごとの完了ゲート」） | 既存変更 | 完了ゲートは先に段階を決め、L1 では verify を呼ばない。L2・L3 では現行どおり change ごとに --done | 反映済 | specs/monorepo/spec.md |
| REQ-132 | 設計メモ 1 章末尾（独自 isDocument の削除）、既存の Requirement「完了ゲートの対象の決め方」「対象の change がない PR の扱い」 | 既存変更 | 対象の change は L2・L3 のときだけ決める。文書の判定を「文書として扱うファイル」に合わせ、L2 で change がなく文書だけなら品質コマンドだけ、L1 では品質コマンドを実行しない | 反映済 | specs/monorepo/spec.md |
| REQ-054 | 既存の Requirement「プルリクエストごとの完了ゲート」の Source | 既存 | 完了ゲートが不合格ならジョブを失敗させる。この change では変えない | 既存仕様で充足 | specs/monorepo/spec.md |
| REQ-270 | 設計メモ 2 章の「quality ジョブとの整合」 | 既存変更 | quality の docs_only の判定を段階 L1 と同値にする。Requirement の本文だけを変えた spec.md は文書だけと判定しない | 反映済 | specs/monorepo/spec.md |

## 確認事項

| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 | 回答者 | 回答日 |
|---|---|---|---|---|---|---|---|---|
| Q-01 | REQ-343 | L1 で `verify` を呼ばなくなると、文書だけの PR で `tests/doc-links.test.ts` を回す場がなくなる（docs/dev/ci.md）。どうするか（設計メモの judgment 1） | A: L1 の gate で `vitest run tests/doc-links.test.ts` も呼ぶ / B: 落として docs/dev/ci.md を直す | A。数秒で終わり、L1 の変更内容（文書のリンク）に直結する | yes | A を採用する | 設計担当（設計メモ 7 章、2026-10-31 09:05 JST。ADR 0006 の包括承認に基づく） | 2026-10-31 |
| Q-02 | REQ-342 | この change 自体の段階。Requirement を 2 件足すので規則どおりなら L3（設計メモの judgment 2） | A: L3 として受ける（`ci:all-os` で 3 OS を通す） / B: 開発基盤なので L2 に緩める | A。Requirement を足す以上、規則どおり | no | A を採用する。規則を緩める代案は採らない | 設計担当（設計メモ 7 章、2026-10-31 09:05 JST。ADR 0006 の包括承認に基づく） | 2026-10-31 |
| Q-03 | REQ-343 | L3 で `ci:all-os` ラベルがなければ gate を失敗させるか（設計メモのタスク 5 の任意項目） | A: 今回は入れない / B: 入れる | A。3 OS の時間切れ（手順 5）が直るまで、L3 の PR が Windows で必ず落ちる。手順 5 の完了後に別 PR で足す | no | A を採用する | 設計担当（設計メモ 7 章、2026-10-31 09:05 JST。ADR 0006 の包括承認に基づく） | 2026-10-31 |

## 仮定

| ID | 関連 | 仮定の内容 | 理由 | 承認 | 承認者 | 承認日 |
|---|---|---|---|---|---|---|
| A-01 | REQ-342 | Requirement の本文の変更を「`### Requirement:` の行か RFC 2119 の語（SHALL・MUST・SHOULD・MAY、単語境界）を含む行の追加・削除」で近似する。段落の途中で RFC 語のない行だけを変えた場合は L1 になる | 厳密な段落解析は過剰。Scenario の WHEN/THEN・Purpose・見出しの文言は L1 のまま残せる | 承認 | 設計担当（設計メモ 1 章。ADR 0006 の包括承認に基づく） | 2026-10-31 |
| A-02 | REQ-342 | `openspec/changes/archive/` への追加があり、全パスが L1 なら、Requirement の行を足していても L1 とする | archive の PR は Requirement を実装 PR の --done で検査済み。例外がないと archive PR は change ディレクトリがもうないため L3 で必ず失敗する | 承認 | 設計担当（設計メモ 1 章。ADR 0006 の包括承認に基づく） | 2026-10-31 |
| A-04 | REQ-132 | 「完了ゲートの対象の決め方」も MODIFIED にする（設計メモは MODIFIED 3 件）。change の tasks.md だけを変えた PR は L1 なので、既存 Scenario「明示を優先する」「変えたファイルとブランチ名を合わせる」は `scripts/x.mjs` も変える形に直す | L1 で verify を呼ばない（REQ-343）と、tasks.md だけの変更で --done を呼ぶ既存 Scenario は両立しない。設計メモの「L1 では verify を呼ばない」を優先する | 承認 | 実装担当（ADR 0006 の包括承認に基づく。設計メモからの逸脱として PR に書く） | 2026-10-31 |
| A-03 | REQ-270 | quality ジョブの docs_only の判定は PR 本文の `loomake-tier:` を読まない。本文で L2 以上に上げた文書だけの PR は、quality は飛び、gate の verify が lint・typecheck・test を実行する | quality ジョブは gh で PR 本文を読む権限を持たない。gate の verify で同じ品質コマンドが走るので検査は抜けない | 承認 | 実装担当（設計メモ 1 章「同じ入力・同じ関数で一致」の範囲を本文なしに限定。ADR 0006 の包括承認に基づく） | 2026-10-31 |
