# Trace: classify-hook-budget-calls

この台帳の「反映済」は差分仕様への反映を指す。コードの修理、全19 Scenarioの追加試験、正常doneとCI/独立レビューの達成を意味しない。

## 入力文書

| 文書 | 版 | 日付 |
|---|---|---|
| [Issue #116](https://github.com/loomake/loomake/issues/116)、[PR #276](https://github.com/loomake/loomake/pull/276) | 単独診断と分類の修正 | 2026-11-01 |
| [後発Q-S1](https://github.com/loomake/loomake/issues/121#issuecomment-6543715081) | コードPRではnoneを使わない。管理役が原文を再照合 | 2026-10-31 |
| [REQ-350〜352の予約](https://github.com/loomake/loomake/issues/116#issuecomment-6549397212) | 管理役の中央予約。今回pluginで原文再確認 | 2026-11-01 |
| 21fcbdf8の技術設計と管理役の採用記録 | `.loomake/claude/21fcbdf8-d9a3-4f56-b27a-646a68ba0f94/result.md`、`.loomake/design-classification/manager-adoption.md` | 2026-11-01 |
| 67aa86b7の独立change化設計 | `.loomake/claude/67aa86b7-95eb-4680-aae9-5d940c256433/result.md` | 2026-11-01 |
| 42a5d810の追加設計と今回の管理役採用 | `.loomake/claude/42a5d810-187d-47d1-ad39-d1c2480da9b7/result.md`。本会話でrootがA′/3ADDED/mode-cwd/Q6(a)を採用 | 2026-11-01 |
| 現在のmainの規約と保護契約 | main 3a54614eを通常merge。AGENTS・ADR0006・agent-workflowとREQ-180/182/257 | 2026-11-01 |

## 要件台帳

| ID | 出典 | 種別 | 要約（原文に忠実に） | 状態 | 反映先 |
|---|---|---|---|---|---|
| REQ-350 | Issue #116、採用D2とF116-Q2/Q4/Q6、中央予約、42a5追加設計1章 | 非機能 | 元関数前の不活性snapshotで三値timeout・mode・cwdを観測し、getter/trapの追加評価と元実行への影響を避ける | 反映済 | specs/ci-external-call-diagnostics/spec.md |
| REQ-351 | Issue #116、採用D1と先行中断の区別、中央予約、42a5追加設計1章 | 非機能 | 先行中断と結果欠損を分け、保持役待ちを引いた補正窓・明示timeout・modeに従って停止を分類する | 反映済 | specs/ci-external-call-diagnostics/spec.md |
| REQ-352 | Issue #116、採用D3、中央予約、42a5追加設計1章 | 非機能 | 旧rawのnull投影と停止分類、版2・匿名化・閉じたschema・固定4ファイル・各上限・7日保存を維持する | 反映済 | specs/ci-external-call-diagnostics/spec.md |
| REQ-180 | main external-process-budget、既存技術設計の保護条件 | 関連 | 製品の操作期限と停止の契約は変更しない | 範囲外 | openspec/specs/external-process-budget/spec.md |
| REQ-182 | main external-process-budget、既存技術設計の保護条件 | 関連 | run共有予算とhook/createの期限の契約は変更しない | 範囲外 | openspec/specs/external-process-budget/spec.md |
| REQ-257 | main external-process-budget、既存技術設計の保護条件 | 関連 | 保持役の準備待ちと予算の契約は変更しない | 範囲外 | openspec/specs/external-process-budget/spec.md |

## 確認事項

| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 | 回答者 | 回答日 |
|---|---|---|---|---|---|---|---|---|
| F116-Q1 | REQ-350, REQ-351, REQ-352 | コードPRでnoneを使えるか | A: 独立changeで通常完了 / B: none | A。後発Q-S1を優先する | no | A。コードPRではnoneを使わない。入力文書のQ-S1出典参照。旧L2/changeなし判断を撤回し正常doneへ戻す | 利用者（Q-S1。管理役が記録） | 2026-10-31 |
| F116-Q2 | REQ-350 | 自己変化する設定をいつどう観測するか | A′: 事前の不活性snapshot / A: 単純事前保存 / B: 事後検知 | A′。先行getterでの変更もunknownとし追加評価を避ける | yes | A′。呼ぶ前に安全なdataだけから三値を保存し、呼んだ後との比較はしない。42a5をrootが本会話で全文確認して採用。ADR0006の包括承認に基づく | 利用者（ADR 0006 の包括承認） | 2026-11-01 |
| F116-Q3 | REQ-350, REQ-351, REQ-352 | 契約をどう所有するか | A: 新capabilityに3ADDED / B: 既存診断へ追加 / C: 1件へ集約 | A。観測・分類・公開を分け、製品契約の所有を保つ | yes | A。ci-external-call-diagnosticsに3件を置く。REQ-180/182/257はMODIFIEDにしない。通常L3、例外なし。rootが本会話で採用、ADR0006参照 | 利用者（ADR 0006 の包括承認） | 2026-11-01 |
| F116-Q4 | REQ-350 | modeとcwdもsnapshotへ含めるか | A: 含める / B: timeoutだけ | A。同じ追加getter/trapの問題を避ける | yes | A。finallyでoptionsを読み直さず、不明modeはnull、cwdが安全に得られなければ由来欄を省く。rootが本会話で採用、ADR0006参照 | 利用者（ADR 0006 の包括承認） | 2026-11-01 |
| F116-Q5 | REQ-350, REQ-351, REQ-352 | 名前とIDの所有はどうするか | A: 中央予約の名前/IDを使う / B: 別名/再採番 | A。既存予約の所有を保つ | no | A。classify-hook-budget-calls / ci-external-call-diagnostics、REQ-350/351/352。[予約原文](https://github.com/loomake/loomake/issues/116#issuecomment-6549397212)を再確認。新規採番ではない | 利用者（ADR 0006 の包括承認） | 2026-11-01 |
| F116-Q6 | REQ-350 | snapshotを取る位置はどこか | a: 診断env確認直後でt0前 / b: t1後 | a。検査時間をt1→tsへ入れて窓を広げない | no | a。42a5の追加判断をrootが本会話で採用。実装位置としてdesignへ記録し、条件や試験の緩和はしない。ADR0006参照 | 利用者（ADR 0006 の包括承認） | 2026-11-01 |

F116-Q5の予約実務と原文再確認は管理役Codexが担当し、名前・IDを採用する決定権限は利用者のADR 0006の包括承認に基づく。

採用済みの技術前提Q1B/Q2A/Q3A・D1/D2/D3Aは21fと採用記録に従う。67aaの「timeout不明は一律未確定」という草案は採用せず、窓内と窓より前を分ける42a5の全19 Scenarioを原文で記録した。

## 仮定

| ID | 関連 | 仮定の内容 | 理由 | 承認 | 承認者 | 承認日 |
|---|---|---|---|---|---|---|

新しい仮定はない。δmaxが遅れの上限であること、code-before-changeの経緯、通常L3の適用とdesignの採用範囲は、設計と上の確認事項へ明記した。

## 工程の訂正と未達

診断コードはaeeeを基点に59eeまで独立changeより先に実装され、PR #276をL2/changeなしとした。後発Q-S1の再照合でその解釈を訂正した。旧履歴と技術検証ログは保持するが、空change・他changeへの便乗・noneで正常doneを代用しない。

24100ff7は空changesetだけでREQ-056の不足を直した。main3aを通常mergeしたあとも、元hook・workflow・設定・旧作業記録と診断の技術source/testsは241と同じ。今回は計画文書の正式化と仕様ゲートだけで、M1の修理、ID付き追加試験、正常done、3 OS/必須CIと独立Opus最終は未実施である。
