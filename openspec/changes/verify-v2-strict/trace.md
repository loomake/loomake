# Trace: verify-v2-strict

<!--
このファイルは loomake verify が読む。表の列の順番と見出し名は変えないこと。
状態の値：反映済 / 確認待ち / 範囲外 / 既存仕様で充足
-->

## 入力文書

| 文書 | 版 | 日付 |
|---|---|---|
| 親change `openspec/changes/verify-v2-c001/` | main 2ea5897 | 2026-10-31 |
| 子change `verify-v2-readers`（2a/6、PR #198）・`verify-v2-wiring`（2b-1/6、PR #197）・`verify-v2-evidence`（2b-2/6、PR #199） | main 2ea5897 | 2026-10-31 |
| `.loomake/handoff/design-step8-c001-split-2026-10-31.md`（設計メモ2.2） | main f26823f 基準 | 2026-10-31 |
| 管理役の決定（2c/6の範囲：REQ-318・164・317、evidenceProblemのpending≥insufficient、ci-gateを流れにつなぐ） | 2026-10-31 | 2026-10-31 |
| docs/requirements/loomake-v0.11.md 7.3 | v0.11.3 | 2026-10-29 |

## 要件台帳

| ID | 出典 | 種別 | 要約（原文に忠実に） | 状態 | 反映先 |
|---|---|---|---|---|---|
| REQ-164 | 親 trace、現行run「検証済み証拠の安全な再利用」 | 既存変更 | Evidence 2/verify 2.0.0のscope:local完了だけを外部操作の再試行に再利用し、旧Evidence 1は履歴閲覧に限る | 反映済 | specs/run/spec.md |
| REQ-317 | 親 trace、要件7.3・FR-12、architecture 0.5 | 機能 | runnerはv2 APIで準備と完了確認を行い、decision.requiredで停止し、旧ok:trueやlocalの0をCI最終合格に使わない | 反映済 | specs/run-decision-policy/spec.md |
| REQ-318 | 親 trace、WBS 5章同時追従・J03、architecture 0.4、互換性文書 | 移行 | 配布された公開入口は2.0.0とEvidence 2を同じ契約で処理し、ci-gateはlocal・旧形式・skip/neutralだけを最終合格にしない | 反映済 | specs/monorepo/spec.md |

3件とも親のRequirementの本文をそのまま移し、REQ-318とREQ-317には2c/6で確かめるScenarioを足した。REQ-318の配布物のScenarioは、既存の配布物の試験（package-artifacts・json-schema-versions）が同じIDで確かめている。

## 確認事項

| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 | 回答者 | 回答日 |
|---|---|---|---|---|---|---|---|---|
| R-C001-01〜10 | 親の全Requirement | 親traceのR-C001-01〜10 | 親traceのとおり | 親traceのとおり | no | 親traceに記録済み（R05・06・07 A、R08 B、ほかA） | 親traceのとおり | 2026-10-30 |
| S8-05 | 全Requirement | 書く側のPRをどう分けるか | 親traceと `verify-v2-wiring` のtraceのとおり | A | no | A（2b-1・2b-2・2c・6/6）。生成物は大きさから除く | 管理役（Claude Fable 5.1） | 2026-10-31 |
| S8-08 | REQ-318 | ci-gateが「完了ゲートの結果」をどう見分けるか。2.0.0にはmodeがない | A: gateが渡した引数（--doneか--spec-only）と対象のchangeで判定し、--doneではscope:ciに加えて完了ゲートの検査（tasks.md・要件ごとのテスト・品質コマンド）の有無も見る / B: scopeだけで見分ける | A。`--scope` のCLIフラグが入ると、仕様ゲートのci結果がscopeだけでは区別できなくなる | no | A（管理役の決定「modeとchangeで判定」に沿う。2026-10-31） | 管理役（Claude Fable 5.1） | 2026-10-31 |

## 仮定

| ID | 関連 | 仮定の内容 | 理由 | 承認 | 承認者 | 承認日 |
|---|---|---|---|---|---|---|
| A-01 | REQ-164 | 直前の証拠がEvidence 1（形は正しい）のときは、不正な証拠として止まらず、再利用しないで通常の検証と記録に進む | 親のScenario「旧証拠しかない」が「新しいv2検証と記録を必要とする。旧ファイルは削除しない」と定めている | 管理役承認（2026-10-31） | 管理役（Claude Fable 5.1） | 2026-10-31 |
| A-02 | REQ-317 | 完了ゲートにscope:ciの結果が来たときの停止は、純粋判断（REQ-205）でabortedの次、要判断の前に置く | 実行エラーと同じく、エンジンに直させても解けない | 管理役承認（2026-10-31） | 管理役（Claude Fable 5.1） | 2026-10-31 |
| A-03 | REQ-318 | ci-gateの完了ゲートの検査の有無は、2b-1/6の仮定A-01で決めたcheckのid（`tasks.md`・`要件ごとのテスト`・`command: *`）で見る | 2.0.0にゲートの種別の欄がない | 管理役承認（2026-10-31） | 管理役（Claude Fable 5.1） | 2026-10-31 |
