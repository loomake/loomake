# Design

## Context

基準は main `5652a250ff0857f227374ba4b3a2782f76e1a96d`。動機は proposal.md を参照する。
主仕様 REQ-100 は変更なし停止を持つが、local/CI を区別する採用済みの差分は未同期である。
本 change は既存の実装と規範を合わせる。主仕様だけで全条件が既に表現されているとは扱わない。

## Goals / Non-Goals

- 対象は `specs/run/spec.md` の Tc 全文（Source 込み485 UTF-16文字、5 Scenario、REQ-100単独）。製品コードの差分は0とする。
- C001・E3・親 #259 の完了、E3 の異常結果停止、統合枝への追加、#185 の再開は対象外。T（497文字・6 Scenario）の正式 change を F 前に確定する義務は残る。
- 原 W/E3/S1 文書・C00114原文/PIN（47 identity・158 Scenario・46 Source・16条件）・旧 it/assert/期待・期限・設定は変えない。

## Decisions

### 1. Tc を独立した正式 delta にする

Opus修正版設計 `2703b343-125e-438a-b64a-96e299b4cdb5` の Q-259-R2 は、管理役 Codex が B（Tcを持つ独立子）を技術的な分割として選んだ（2026-11-02）。利用者の新しい承認とは記録しない。
design だけに置いた本文を主仕様へ書く案を使わず、本 delta を通常の main 向け独立PRで検証する。非PASS例外・規則変更・Q-259-R1 はこの子へ適用しない。
既存の5 Scenario は main と W の原文を全て残し、Source は REQ-100 の1行とする。正式REQの新規予約は不要。

### 2. 全条件と既存の現物根拠

以下のパスは基準main内。規範がactive changeにある箇所は、そのまま明示する。

| Tcの条件 | 既存規範 | 現行の実run実装 | 既存回帰（packages/runner/test/） |
|---|---|---|---|
| 全タスク後にlocal完了ゲート | verify-v2-wiring/specs/run のREQ-100 | src/run/phases.ts:132-153 | v2-readers.test.ts:107 `[REQ-100]` |
| REQ-205が再修正を選ぶときだけ不合格を渡す | verify-v2-readers/specs/run-decision-policy のREQ-205、主仕様の回数/期限優先 | decision-policy.ts:40-51、phases.ts:162-169 | v2-readers:50/59/124/144 `[REQ-205]`、run.test.ts:244 `[REQ-100][REQ-111]` |
| 変更なしはコミットも再実行もしない | 主仕様run のREQ-331、run-decision-policy のREQ-332 | phases.ts:172-178、decision-policy.ts:58-62 | run-no-change.test.ts:139/151 `[REQ-331]`・`[REQ-331][REQ-100]` |
| それ以外の直しを所定名でコミットして再実行 | 主仕様run のREQ-100、REQ-331 | phases.ts:135-178 | run.test.ts:244 `[REQ-100][REQ-111]` |
| ゲートのタスクをエンジンに渡さない | 主仕様run のREQ-100 | src/run/tasks.ts:12-16、prepare.ts:96-104 | run.test.ts:257 `[REQ-100]` |
| localの0、要判断/abortedなしだけローカル完了。CI最終合格と区別 | verify-v2-wiring/specs/run のREQ-100、verify-v2-readers のREQ-205、verify-v2-strict のREQ-317 | phases.ts:30-40、decision-policy.ts:40-51 | v2-readers:95/107/124/144/157 `[REQ-205]`・`[REQ-100]`・`[REQ-317]` |
| 印で識別、合格時にチェックする | 主仕様run のREQ-100 | tasks.ts:8-16、phases.ts:181-185 | run.test.ts:519 `[REQ-100][REQ-136]` |
| 印なしverify/--doneを旧書式とし案内する | 主仕様run のREQ-100 | tasks.ts:14、prepare.ts:99-104 | run.test.ts:533 `[REQ-100]` |
| 指示・コミット文・表示から印を除く | 主仕様run のREQ-100、採用済みWの第5 Scenario | tasks.ts:11、phases.ts:98/113/185 | run.test.ts:543 `[REQ-100]`、519/533のprompt確認 |

規範表の `verify-v2-*` は `openspec/changes/`、主仕様は `openspec/specs/`、実装は `packages/runner/` からの相対パス。local判定は `gateObservation` が `verifyExitCode(result) === 0` を確かめ、純粋判断がaborted・ci・要判断を完了/再修正より先に止める。新たな規則をこの子から作らない。

### 3. 短文化の意味と原文保持

| 差分の句 | 保持する意味と根拠 |
|---|---|
| `REQ-205が再修正を選ぶなら` | Wの「REQ-205の純粋判断が再修正を選ぶ不合格なら」。既存REQ-205と実装で、再修正は不合格・中断なし・期限内・回数未満だけ |
| `変更がなくREQ-331に従うときはコミットも再実行もせず止まり` | 主仕様REQ-331の合図有無両方の停止と未完を保持。再実行する対象は同文の完了ゲート |
| `それ以外は直しを…でコミットし、完了ゲートを再実行する` | 再修正と変更なし停止の分岐後に、既存の変更あり直しをコミットして再検証する |
| local完了とCIの区別の2文 | Wの同じ条件を保持。チェック完了は既存の「印のあるタスク」Scenarioにも残る |
| 印の定義・旧書式・`コミットメッセージ` | 元の定義と同じ。語間空白と「コミットのメッセージ」の表記だけを短くする |

既存Scenarioの名前・順番・WHEN/THEN、Sourceはbyte照合する。500の判定にSource行を含める。srcと既存試験の挙動に未成立条件が見つかったら、コードを追加せず計画を止める。

### 4. 検証と独立レビュー

実行する既存回帰は `pnpm exec vitest run packages/runner/test/run.test.ts packages/runner/test/v2-readers.test.ts packages/runner/test/run-no-change.test.ts`。実run関数とローカルGit・代替エンジン/ghによる回帰であり、実サービスや実E3採集の成功とは数えない。
主レビューIDは REQ-100/331/317/205、保持対象は099/204/330（2要件）/332/341。REQ-340/341のE3側規範・全5+1 Scenario・統合枝試験は後のT子に残す。本子の5 ScenarioからE3を受入済みとはしない。
受入には本文/Source/Scenario/原文保持の照合、既存回帰、通常local done、全tasks完了、必須CI、Codexレビュー、独立Opus重大0が必要。段階はRequirement変更のL3。変更packageは0だが、管理役の指定により `ci:all-os` で全3 OSの成功を求める。
見積もりは計画6ファイル約190行＋既存worklog最小追記8行、300行以内。品質結果・未実施・初回失敗は実際の状態で記録する。

## Risks / Trade-offs

- 後の古い全文同期による欠落 → sync/archive skillのintelligent mergeに従い、差分が触れていないScenario/内容を保持して全文照合する。Tcだけを無条件上書きしない。
- E3が既に同期された状態 → REQ-340と第6 Scenarioを保持し、Tとの整合を確認する。E3を後で落とす順序に固定せず、未実装E3を先出しもしない。
- C001原文fixtureがactive wiringパスやREQ-331 hashを固定している → その移動/更新は後のC001/E3 archive設計で扱う。本子でPINやfixture/期待値を変えない。
- T子の統合枝追加Q-259-R1は未決 → 本子とは独立して未回答を維持する。F前のT正式確定と親#259の全受入を省かない。

## Migration Plan

本子は通常ゲートとレビューを経て受け入れ、主仕様反映時は同期対象外の内容を保持する。W/E3/S1は書き換えず、C001既存archive順も変更しない。
将来の同期では現行main・W・E3・Tc/Tの全文、Source、全Scenario、500文字を照合し、不一致ならarchive前に止める。主仕様の無条件置換や、テスト期待の変更による復旧はしない。
