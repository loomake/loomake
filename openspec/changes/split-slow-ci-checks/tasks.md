# 1. 正式起案と仕様ゲート

- [x] 1.1 管理役の1 change/1 PR指定とQ01〜Q10・Q-N1〜Q-N5・release適用範囲の回答をtraceへ記録し、REM049/214とMOD144を起案する
- [x] 1.2 049/214の全文・全8Scenario・Source・旧試験名をdocs/dev/ci.mdへ保存し、主仕様と実装を変えずstrict/spec-onlyを検証する

# 2. 先行できる独立実装（C2〜C5）

179の最終統合と残10fileの設計はcase本体分割の前提であり、この節の独立実装の前提ではない。基点085aと採用済み62abaの範囲で先行し、統合後にfresh差分と検証を繰り返す。

- [x] 2.1 ci.ymlのnode20ジョブを削除し、node22/3OS Node24を保つ。docs/dev/ci.mdと互換性文書、docs/quality/scenarios.jsonのREQ-144対応、monorepo/package-workflows/ci-test-diagnostics-workflowの照合を実在境界検査付きで更新する
- [x] 2.2 root globalSetup/provideとpackage/slow injectを実装し、build/pack共有1回、unit-only/file選択の費用、inject欠落のfallback拒否、実build失敗/正常cleanup/watchを独立依存で検証する
- [x] 2.3 純粋split helperとnamed slowの足場を作り、未測定のOS割当やcase本体の分割を加えず、空集合・未知ID/OS・PR判定とファイル選択を検査する。reporter/outputFile/coverage/ci-gate/verifyを保つ
- [ ] 2.4 REQ-161の元13条件を実際に検出する独立fast試験とrunnerのonly選択を追加し、未知/重複拒否、baseline/検出/未検出/エラー/元source-test-report不変を確認する。既定13条件の元全体試験も残す。fastの確定は統合後3OS各3sampleで行う

# 3. 統合と残設計

- [ ] 3.1 PR179の最終受入headを統合してfresh差分・元case/parameter/assert/timeout・診断対象を固定し、C001/E3との重複と順序を確認する
- [ ] 3.2 未設計10fileの全文・fixture/hook/callerと関連Requirement全文をそろえ、管理役がOpus設計を確認する。出版診断のcompanion/shard対応も決める
- [ ] 3.3 仕様ゲートを再実行し、残る数値・外部連携・失敗境界の判断をtraceへ反映する

# 4. case分割と実測

- [ ] 4.2 push ci/measure-*専用の同head3OS×3sample測定を用意し、新required statusを加えず最新headの元caseと新fastを測る
- [ ] 4.3 採用済みの個別設計に従い、各OSの最大10秒超caseだけをslowへ分ける。元名/parameter/assert/timeoutとfast+slowの多重集合、空file選択、未知ID/OSと全PR経路のslow不実施、local/releaseの全件を検査する
- [ ] 4.4 両診断profilerをmain push/schedule・companion含む4pathへ更新し、PR/手動起動の撤去、元caseId/3sample/失敗後保存/未計測を照合する。release manual dispatch品質ゲートは全件保持する
- [ ] 4.5 最新実装headで3OS各3sampleを再取得し、checkout SHA/Node版/全case数/時間/失敗を保存する。REQ-297の4case・19.5/39.5秒下限・既存上限/clock/retry/assertと全診断契約を保持する

# 5. 受入と人の操作

- [ ] 5.1 元全caseと全assertの保持、coverage94/89/96/97、local full、change.liveの実passed対応、Node22.12/3OS24を検証する。旧reportや虚偽タグを使わない
- [ ] 5.2 対象headの完了ゲートと全tasks・要件対応テストを確認する <!-- loomake:gate=done -->
- [ ] 5.3 同headの他4必須check・自動Codex・独立した新Opusの指摘ゼロをそろえ、node20だけ廃止に伴い未成立であることを記録する。修正後は新headを再検証/再レビューする
- [ ] 5.4 管理役がrulesetのfresh beforeとnode20 contextだけの差分・証跡をIssue121で@rrr-xxxへ渡し、人の操作後fresh afterで他4checkと全fieldを照合する。規則を補助や管理役が書き換えない
- [ ] 5.5 残存required成功後に管理役が同じ1-1 PRをマージし、対応スキルでsync/archiveの受入へ続く。旧Source/試験対応と273衝突のB1引継ぎを保持する
