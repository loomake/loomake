## Context

Opus具体設計a0730601の§9・案Sを採用したC2b。C1はPR #308/#314、C2aはPR #315で通常受入済みで、C2aの同期・archive（PR #318）後に実装する。

## Goals / Non-Goals

REQ-378の全5 Scenarioを保持し、残条件はproposalのImpactに従う。

## Decisions

### readerと共有原文

REQ-387のreaderを変更せず呼ぶ。閉じたroot・core schema/merge禁止・alias100・日本語の失敗・null/false・凍結を継承する。共有S1設計§3と7回答の全文は、案Sで配分した[C2a設計](../archive/2026-11-01-trusted-baseline-record-reader/design.md)と同archiveのtrace.mdに保持する。本changeの9採否と所有表は以下に全文を残す。

### データとPIN

元scalar候補をexpected_specの下へ2字下げ、anchor s28の値だけをtrusted-c001-initial-baselineへ変える。展開後に変わるのは9件のtrace.changeだけ。コード側の私的PIN定数を別モジュールに置き、対象の自己申告を使わない。RecordCountsの全15項目を基準側PINへ固定し、T-C2-01のliteralと照合する。Pythonのsort_keys付きJSONとNodeのcanonical JSONを独立に測り、一致digestをコードと試験のliteralへ固定する。同じPRの定数を採否や原commitの来歴の独立証明とは呼ばない。

### 全試験と参照

元JSON6件は1410 bytes・名前とタグまで不変。378タグを足さず別の新試験を使う。実記録の行・所有・Scenario対応・open・置換・補完・採否と試験参照の削除/追加/複製を拒否し、C1だけなら通る変異は正の対照にする。閉じたYAMLと既定alias予算も378試験で確かめ、Issue #317のtop-level負例は正しい基準と拒否理由で強化する。最後の全体reportで全409参照を正確なfile/fullNameで各1件成功として照合する。意味・主体・適格receiptの合格とはしない。

### 初回基準の追加の所有採否

Q-S1-16〜24は、既存候補で参照が空だった9契約の所有を記録する。原47 identity・158 Scenarioと原本文、既存の具体採否を保持し、現在の所有先の記録を原規範の置き換えや未対応の解消には使わない。特にREQ205のO1/O2/O3、REQ114のDraft義務と実装差を残す。試験の意味と横断条件の照合、作者・API binding、初回連鎖は別に確認する。

| 採否ID | 原契約 | 現ownerのファイル・Requirement | 所有本文のsha256 | 保持する条件 |
|---|---|---|---|---|
| Q-S1-16 | `cli/modified/REQ-194` | `openspec/changes/verify-v2-scope/specs/cli/spec.md` / 値をとるオプションの書き方 | `sha256:a3952e18f3ff74a70fb883ace7bebfd773654c2d00292629b34668c7958dabbd` | scopeのlocal/ci以外をusage/2とする補完を記録する。元の空値と等号の条件を保持する。 |
| Q-S1-17 | `core-parsers/modified/REQ-275` | `openspec/changes/verify-v2-shape/specs/core-parsers/spec.md` / verify 結果の未知のフィールド | `sha256:a361dec6bdad2df16364a825bd5cedab9a00d5be47dead92b0e911997561c912` | 原規範と同一の現行・履歴の未知キー保持を記録する。未知キーと既知禁止キーを区別する。 |
| Q-S1-18 | `core-parsers/added/REQ-308` | `openspec/changes/verify-v2-shape/specs/core-parsers/spec.md` / verify 2.0.0の状態とscope | `sha256:4147b29aa81ba05c57023f2d198808c3f475a5e885dd763078b59d401bbbcc11` | 原規範と同一のci/local各状態・aborted・未知キー・遅延ロードを記録する。 |
| Q-S1-19 | `external-process-budget/modified/REQ-183` | `openspec/changes/verify-v2-shape/specs/external-process-budget/spec.md` / verifyとtraceの接続と互換性 | `sha256:b25468a518f1b124d5f853540d3091c48ba82d30d817afa9d8e276bfb710eeae` | 原規範と同一の予算・同期・互換性を記録する。D2を保持し、制限の非成功を特定のenum値へ読み替えない。 |
| Q-S1-20 | `run-decision-policy/modified/REQ-205` | `openspec/changes/verify-v2-readers/specs/run-decision-policy/spec.md` / 完了ゲート後の純粋な判断 | `sha256:890136632959a3ede00a6f36e25982c095540e5c4a119073c8a710b0bc7a48cf` | 短縮された現ownerを所有の対応先として固定する。原優先順位と型付き観測・閉予算後のGit禁止は撤回せず、O1/O2/O3に残す。 |
| Q-S1-21 | `run-decision-policy/added/REQ-317` | `openspec/changes/verify-v2-strict/specs/run-decision-policy/spec.md` / runnerのv2判定追従 | `sha256:34396b4d000a358c3f8802e1ce645ac0b0a71cbedade10d13a63bfbd70ea2351` | 原規範を保持する現ownerを記録する。ciをlocal完了としない補完も保持し、CI成果物の取得・ready化全体は後続とする。 |
| Q-S1-22 | `run-pr/modified/REQ-114` | `openspec/changes/verify-v2-c001/specs/run-pr/spec.md` / 証拠を記録してから PR を作る | `sha256:61feb1c79ba089d03c0fbb2803ef86c105fca4e742361a6f839be86ff30a09a4` | 現ownerを記録し、全文ScenarioのDraft義務と既存の実装・保護試験との差をopenに残す。SHALL短縮を撤回根拠にしない。 |
| Q-S1-23 | `run-pr/modified/REQ-115` | `openspec/changes/verify-v2-c001/specs/run-pr/spec.md` / PR の本文 | `sha256:80dec94565bb0240ec921bbead40dd1e332ad763f17c107c7092e4a66545bea8` | 原規範と同一のタイトル・本文の項目と順序を記録する。local完了とCI最終合格の区別を保持する。 |
| Q-S1-24 | `trace-report/added/REQ-316` | `openspec/changes/verify-v2-shape/specs/trace-report/spec.md` / 新旧証拠の閲覧と既存レポート外形 | `sha256:0c523dce8c80211496f881899373acbc93a054c118f2bc6f8aed5e075fd35a56` | 原規範と同一の新旧閲覧・日本語行・旧結果の非再利用を記録する。旧fixtureと実試験の不足を、所有の記録だけで解消しない。 |

## Risks / Trade-offs

既定の入力・alias・期限を保持し、所有hashがずれたら設計へ戻る。原本・記録・所有はHEADのGit objectから読み、3OSで確認する。C3・Issue #310・S1以降の残条件もproposal記載どおり保持する。

## Migration Plan

tasks.mdの通常ゲート・品質・レビューを満たし、全差分が200KiBを超えたら実測を添えて設計へ戻る。全データ・試験・採否を保持し、受入後に同期・archiveする。
