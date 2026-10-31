# 1. 正式起案と仕様ゲート

- [x] 1.1 管理役の1 change/1 PR指定とQ01〜Q10・Q-N1〜Q-N5・release適用範囲の回答をtraceへ記録し、REM049/214とMOD144を起案する
- [x] 1.2 049/214の全文・全8Scenario・Source・旧試験名をdocs/dev/ci.mdへ保存し、主仕様と実装を変えずstrict/spec-onlyを検証する

# 2. 先行できる独立実装（C2〜C5と監査対応）

凍結した179診断の吸収先との統合境界・重複・順序の確定と当初未設計10fileの残設計はcase本体分割の前提であり、この節の独立実装の前提ではない。C2〜C5は基点085aと採用済み62abaの範囲で先行し、統合後にfresh差分と検証を繰り返す。追加2.5は995e対象のcd321d46に従う独立な監査・宣言inventoryであり、残9fileの設計3.2と並行できる。実caseの本体分割・OS割当は含めず、実registryは空に保つ。

- [x] 2.1 ci.ymlのnode20ジョブを削除し、node22/3OS Node24を保つ。docs/dev/ci.mdと互換性文書、docs/quality/scenarios.jsonのREQ-144対応、monorepo/package-workflows/ci-test-diagnostics-workflowの照合を実在境界検査付きで更新する
- [x] 2.2 root globalSetup/provideとpackage/slow injectを実装し、build/pack共有1回、unit-only/file選択の費用、inject欠落のfallback拒否、実build失敗/正常cleanup/watchを独立依存で検証する
- [x] 2.3 純粋split helperとnamed slowの足場を作り、未測定のOS割当やcase本体の分割を加えず、空集合・未知ID/OS・PR判定とファイル選択を検査する。reporter/outputFile/coverage/ci-gate/verifyを保つ
- [x] 2.4 REQ-161の元13条件を実際に検出する独立fast試験とrunnerのonly選択を追加し、未知/重複拒否、baseline/検出/未検出/エラー/元source-test-report不変を確認する。既定13条件の元全体試験も残す。fastの確定は統合後3OS各3sampleで行う

- [ ] 2.5 REQ-347差分・traceのQ-19〜Q-30・scopeを確認し、spec-only exit 0の後、cd321d46に従う監査/宣言inventoryとdocsを同じPRで実装する。[REQ-347]付きで登録済みC→S、rawFile/inputs、登録外Cのraw保持、不正/欠落registry・不正Cのerror/成果物なし、status/Source/hash、同名別入力行とoverlapのSet、複数block欠測、既存状態/旧形式/migrate条件を検査し、raw report・レビュー表・元3Scenarioを保つ。独立ASTで下記の移動後baselineと合成fixture全error codeを確かめ、alias/動的title/未知の動的行/壊れた宣言を除外しない。AST実測が想定と違えば設計へ戻す。将来mainでcase移動/count変更があれば期待値を実装へ合わせず、移動前後の保持を示す別の承認済み証拠とbaselineを再照合する。実registry/本体/既存scanner・partition・Vitest規則は変えず、既存監査全試験を通す

2.5の995e基点run60宣言/62候補/70展開行は履歴として残す。受入済みmain PR231の移動後はlive run58宣言/60候補/68行とrun-timeout2宣言/3候補/2行を合わせ、元60宣言/70行のscopeを保持する。raw候補計63は追加importの非call1増であり、宣言数には数えない。本文blockとselector/hashの独立保持照合に基づくbaseline更新とし、既存期待を実装へ合わせて変えない。非literalなeach表の展開未確定はdynamicRowsで明示し、宣言を除外せずdynamicTitleも流用しない。

# 3. 統合と残設計

- [ ] 3.1 head `3571c208` で凍結したPR179診断をstabilize-cross-os-testsへ引き継ぎ、その統合境界と最新mainを基準にfresh差分・元case/parameter/assert/timeout・診断対象/companionを照合する。case本体分割の前に吸収先/C001/E3との重複と統合順序を管理役が確定する
- [ ] 3.2 当初未設計10fileのうちrun以外の9fileの全文・fixture/hook/callerと関連Requirement全文をそろえ、管理役がOpusの具体設計を確認する。a3bf248bのin-place登録構造とcd321d46の監査/inventory設計は採用済みとして保持し、採用済み4fileを含む14fileの本文位置・名前/parameter/assert/timeout・監査/登録対応を再照合する。出版診断companion/shardと、他fileで行閾値が混在する場合に10秒超caseだけslowへ分ける設計を決める。2.5の独立実装はこの残設計と並行できる
- [ ] 3.3 残る数値・外部連携・失敗境界と各fileの判断をtraceへ反映し、仕様ゲートを再実行する。REQ-347の原文/元3Scenario/SourceとQ-R系・Q-A系の採用を保持し、残設計3.2と実OS割当の前提がそろっていることを確認してspec-onlyをexit 0にする。2.5着手前の仕様ゲートをこの後続ゲートで代用しない

# 4. case分割と実測

- [ ] 4.2 push ci/measure-*専用の同head3OS×3sample測定を用意し、新required statusを加えず最新headの元caseと新fastを測る。main取込前や旧headの測定を最新の9sampleへ代用せず、checkout SHA/Node版/3OS各3sample/全case数/失敗/欠測を照合して受け入れる。8dの旧full測定9sampleは7成功/2失敗で未受入であり、995eや実装後の最新headの測定へ流用せず、この計画改訂で4.2を完了にしない
- [ ] 4.3 3.1〜3.3・2.5・4.2の受入後、本文を元testに残す採用済みの個別設計に従い、各OSの最大10秒超caseだけをslowへ分ける。元名/parameter/assert/timeoutとfast+slowの多重集合、空file選択、未知ID/OSと全PR経路のslow不実施、local/releaseの全件を検査する。実OS割当と登録をここで行い、宣言内の本文ブロックを変えず、fast/slow双方の実レポートから元sourceへの対応と一度だけの登録を検証する。it.each表全体1IDで閾値混在を一括slowにしない。hashだけで同一it.each内の行欠測を証明したとは扱わず、独立したraw全case比較で全parameterと正当な同名caseの多重度を保持する
- [ ] 4.4 両診断profilerをmain push/schedule・companion含む4pathへ更新し、PR/手動起動の撤去、元caseId/3sample/失敗後保存/未計測を照合する。release manual dispatch品質ゲートは全件保持する
- [ ] 4.5 最新実装headで3OS各3sampleを再取得し、checkout SHA/Node版/全case数/時間/失敗を保存する。REQ-297の4case・19.5/39.5秒下限・既存上限/clock/retry/assertと全診断契約を保持する

# 5. 受入と人の操作

- [ ] 5.1 元全caseと全assertの保持、coverage94/89/96/97、local full、change.liveの実passed対応、Node22.12/3OS24を検証する。parameter全行・正当な同名17行を含め、元全caseとfast+slowのraw多重集合をpartition helperから独立して比較し、58selectorの再受入を確認する。旧reportや虚偽タグを使わない
- [ ] 5.2 対象headの完了ゲートと全tasks・要件対応テストを確認する <!-- loomake:gate=done -->

## 完了ゲート後の必須受入

次の3件は5.2の後に行う必須受入であり、タスクの完了印では代用しない。番号・順序・担当と未完了の受入を保持し、2026-10-31のレビュー規則改訂を5.3へ反映する。証跡の正本はPR #184末尾の証跡ブロックとし、人へのruleset依頼はIssue #121に記録する。どれかが未達の間はchange・PR・配布の完了を報告しない。

- 5.3 同headの他4必須checkをそろえ、node20だけ廃止に伴い未成立であることを記録する。独立Opusの回数・重大指摘ゼロ・軽微指摘とhead対応の扱いはADR 0006の「レビュー規則（2026-10-31 改訂）」に従う。自動Codexは参考としてPR末尾の証跡ブロックへ記録し、マージ条件には加えない
- 5.4 管理役がrulesetのfresh beforeとnode20 contextだけの差分・証跡をIssue121で@rrr-xxxへ渡し、人の操作後fresh afterで他4checkと全fieldを照合する。規則を補助や管理役が書き換えない
- 5.5 残存required成功後に管理役が同じ1-1 PRをマージし、対応スキルでsync/archiveの受入へ続く。旧Source/試験対応と273衝突のB1引継ぎを保持する

既存18件の範囲はすべて残し、新たな未完了2.5を加えて実装・検証16タスクと本節の必須受入3件の全19件とする。既存の完了印6件を増やさず、追加時点の進捗は6/16とする。4.2の元case・新fastの測定受入と、最終分割後の4.5の全測定は別に保持する。最終レビュー等で修正が必要になったら5.2より前に修正タスクを追加し、新headで必要な完了ゲート・CIを再検証する。独立Opusの再レビュー要否と回数は改訂ADR 0006に従い、無制限の全重大度ゼロやCodex必須という旧条件は適用しない。仕様・測定・要件対応テスト・人のruleset操作・マージとsync/archiveの残受入は保持する。
