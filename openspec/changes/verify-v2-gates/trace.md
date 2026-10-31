# Trace: verify-v2-gates

<!--
このファイルは loomake verify が読む。表の列の順番と見出し名は変えないこと。
状態の値：反映済 / 確認待ち / 範囲外 / 既存仕様で充足
-->

## 入力文書

| 文書 | 版 | 日付 |
|---|---|---|
| 親change `openspec/changes/verify-v2-c001/`（trace R-C001-08・10、tasks 3.4） | main 488edda2 | 2026-10-31 |
| `.loomake/handoff/design-step8b-c001-acceptance-2026-10-31.md`（1章の未済4点、2章 3/6） | main b29df8c2 基準 | 2026-10-31 |
| [PR #139 の承認コメント](https://github.com/loomake/loomake/pull/139#issuecomment-6511434324)（R05 A・R06 A・R08 B） | cf6c17c | 2026-10-30 |
| docs/requirements/loomake-v0.11.md 7.3 | v0.11.3 | 2026-10-29 |

## 要件台帳

| ID | 出典 | 種別 | 要約（原文に忠実に） | 状態 | 反映先 |
|---|---|---|---|---|---|
| REQ-036 | 現行verify「仕様ゲートの警告」・親trace | 既存変更 | spec-onlyは未承認の仮定・確認待ちをPASSの案内にして0、doneは不足と要判断で1（R-C001-08 B） | 反映済 | specs/verify/spec.md |
| REQ-037 | 現行verify「openspec validateの実行」・親trace | 既存変更 | auto時にOpenSpec CLIが無いと、localは理由・確認者つきNOT_APPLICABLE、ciは不足。明示trueは不合格（R-C001-08 B） | 反映済 | specs/verify/spec.md |
| REQ-038 | 現行verify「完了ゲート」・親trace | 既存変更 | doneの確認待ちはREQ-036と同じ不足と要判断に統一。未完了tasksと実施済み失敗はFAIL | 反映済 | specs/verify/spec.md |
| REQ-039 | 現行verify「品質コマンドの実行」・親trace | 既存変更 | 未知キーはwarnから理由つきPASSの案内へ。コマンド失敗は不合格のまま | 反映済 | specs/verify/spec.md |
| REQ-191 | 現行verify「品質コマンドを省いたことの表示」・親trace | 既存変更 | `--skip-commands` はchecksの不足にして1。未実施と再実行を案内する | 反映済 | specs/verify/spec.md |
| REQ-203 | 現行trace-agreement・親trace | 既存変更 | 仮定の承認後は、spec-onlyの案内とdoneの不足・要判断理由に未承認が残らない | 反映済 | specs/trace-agreement/spec.md |

6件とも親のRequirementを既存IDのまま移し、本文をR-C001-08 Bの規範に確定した（未承認候補・A/B候補の文言を除いた）。親の台帳でREQ-036〜039・191・203が確認待ちだった行は、この子changeでは反映済にする。具体的なassertionの変更は、確認事項S9-01の個別承認を求める。

## 確認事項

| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 | 回答者 | 回答日 |
|---|---|---|---|---|---|---|---|---|
| R-C001-08 | REQ-036〜039・191・203 | warnとskipをゲート/scope別にどう移行するか | 親traceのとおり | B | no | B。[承認元](https://github.com/loomake/loomake/pull/139#issuecomment-6511434324) | rrr-xxx（rrr-www名義・Claude Code代筆） | 2026-10-30 |
| R-C001-10 | REQ-036 | localのspec-onlyで品質項目を数えるか | 親traceのとおり | A | no | A。[承認元](https://github.com/loomake/loomake/pull/139#issuecomment-6510041693) | rrr-xxx（rrr-www名義・Claude Code代筆） | 2026-10-30 |
| S9-02 | REQ-037 | OpenSpec CLI不在のNOT_APPLICABLEの確認者に何を書くか。人が確認する項目ではない | A: `loomake verify（openspecValidate: auto の自動判定）` / B: 設定者の名前を設定に足す（新しい設定キーが要る） | A。新しい設定を足さず、対象外の理由と確認者を欠かさない | no | | | |
| S9-01 | REQ-036〜039・191・203 | 変わる試験の期待値（旧→新）の個別承認。PR本文の表を見て承認する | A: 表のとおり承認 / B: 差し戻し | A。R08 Bの規範どおりの変更だけを表にしている | no | | | |

## 仮定

| ID | 関連 | 仮定の内容 | 理由 | 承認 | 承認者 | 承認日 |
|---|---|---|---|---|---|---|
