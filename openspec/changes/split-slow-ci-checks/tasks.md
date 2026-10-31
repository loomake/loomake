# 1. 正式起案と仕様ゲート

- [x] 1.1 管理役の当初1 change/1 PR指定（現行の分割はQ-38）とQ01〜Q10・Q-N1〜Q-N5・release適用範囲の回答をtraceへ記録し、REM049/214とMOD144を起案する
- [x] 1.2 049/214の全文・全8Scenario・Source・旧試験名をdocs/dev/ci.mdへ保存し、主仕様と実装を変えずstrict/spec-onlyを検証する

# 2. 先行できる独立実装（C2〜C5・監査・C1前提対応）

凍結した179診断の吸収先との統合境界・重複・順序の確定と当初未設計10fileの残設計はcase本体分割の前提であり、この節の独立実装の前提ではない。C2〜C5は基点085aと採用済み62abaの範囲で先行し、統合後にfresh差分と検証を繰り返す。追加2.5は995e対象のcd321d46に従う独立な監査・宣言inventoryであり、残9fileの設計3.2と並行できる。実caseの本体分割・OS割当は含めず、実registryは空に保つ。

- [x] 2.1 ci.ymlのnode20ジョブを削除し、node22/3OS Node24を保つ。docs/dev/ci.mdと互換性文書、docs/quality/scenarios.jsonのREQ-144対応、monorepo/package-workflows/ci-test-diagnostics-workflowの照合を実在境界検査付きで更新する
- [x] 2.2 root globalSetup/provideとpackage/slow injectを実装し、build/pack共有1回、unit-only/file選択の費用、inject欠落のfallback拒否、実build失敗/正常cleanup/watchを独立依存で検証する
- [x] 2.3 純粋split helperとnamed slowの足場を作り、未測定のOS割当やcase本体の分割を加えず、空集合・未知ID/OS・PR判定とファイル選択を検査する。reporter/outputFile/coverage/ci-gate/verifyを保つ
- [x] 2.4 REQ-161の元13条件を実際に検出する独立fast試験とrunnerのonly選択を追加し、未知/重複拒否、baseline/検出/未検出/エラー/元source-test-report不変を確認する。既定13条件の元全体試験も残す。fastの確定は統合後3OS各3sampleで行う

- [x] 2.5 REQ-347差分・traceのQ-19〜Q-30・scopeを確認し、spec-only exit 0の後、cd321d46に従う監査/宣言inventoryとdocsを同じPRで実装する。[REQ-347]付きで登録済みC→S、rawFile/inputs、登録外Cのraw保持、不正/欠落registry・不正Cのerror/成果物なし、status/Source/hash、同名別入力行とoverlapのSet、複数block欠測、既存状態/旧形式/migrate条件を検査し、raw report・レビュー表・元3Scenarioを保つ。独立ASTで下記の移動後baselineと合成fixture全error codeを確かめ、alias/動的title/未知の動的行/壊れた宣言を除外しない。AST実測が想定と違えば設計へ戻す。将来mainでcase移動/count変更があれば期待値を実装へ合わせず、移動前後の保持を示す別の承認済み証拠とbaselineを再照合する。実registry/本体/既存scanner・partition・Vitest規則は変えず、既存監査全試験を通す

2.5にはG-B Q-G2の通常const fixture helperと非call参照のbinding分類を含め、test alias拒否を保つ。guards37/52/40とrun-no-change12/13/25のモデル静的値を独立ASTで実測する。実登録/prefix/隔離解除は含めない。

2.5の995e基点run60宣言/62候補/70展開行は履歴として残す。受入済みmain PR231の移動後はlive run58宣言/60候補/68行とrun-timeout2宣言/3候補/2行を合わせ、元60宣言/70行のscopeを保持する。raw候補計63は追加importの非call1増であり、宣言数には数えない。本文blockとselector/hashの独立保持照合に基づくbaseline更新とし、既存期待を実装へ合わせて変えない。非literalなeach表の展開未確定はdynamicRowsで明示し、宣言を除外せずdynamicTitleも流用しない。

2.5の現行guards基準は、受入済みmain d04e212f（PR235）取込後の22be0369で39宣言/54候補/42展開行とする。3d664093の37/52/40は履歴として残す。旧37宣言の本文多重集合保持とREQ-348の追加2宣言だけであることを独立照合した根拠に従い、追加2件の正確な試験名も検査する。run58/60/68・run-timeout2/3/2・run-no-change12/13/25と既存assertを保ち、計画追記後のspec-only成功をlive inventory編集前の条件とする。

- [x] 2.6 Q-34〜Q-37とC1設計を確認し、spec-only exit 0の後、private inventoryに同fileの非export const・TEST_FUNCTION名・it/test.runIf/skipIfの1引数factory分類を追加する。宣言名と初期値の候補をnonCallとして残し、実呼出しは宣言として検査する。let/export/規則外名/不正引数/aliasの負fixtureとit/test×runIf/skipIfの正fixture、既存fixture-helper/namespace/test alias拒否を照合する。モデル未実測16宣言/22候補/19行は履歴に残し、独立nativeの25候補（propertyKey3漏れの訂正）と元16blockのbyte保持を根拠に最初のscopeを照合する。factory分類後の16宣言/19行は別に確認し、違えばsource保持証拠と設計へ戻す。signalのas constを含むas/satisfies/括弧/!の型だけを示すwrapperをunwrapし、spreadなしliteral配列の行数を数える。変数/spread tableはdynamicRowsを保つ正負fixtureも追加する。コード実行・値評価はしない。external-budget-deadlineもlive inventoryへ加え、独立probeの3宣言/4候補/元3本文保持に照合し、wrapper対応後の6行は別確認する。C2の残設計/実登録/OS割当は含めない。同時にmetadataの旧15必須fileの順序・包含を保ちrun-timeoutとexternal-budget-deadlineを加えた17fileの包含・新2file各欠落negativeと対象外fileも含む全採集の保持を独立fixtureでred/green検査し、全case/raw/失敗sampleを保つ。対象はtest-declarations本体/試験、ci-measure-metadata本体とtests/ci-measure.test.ts、docs/dev/ci.mdとする。実registry・元signal factory・元本文・scanner/partition/Vitest規則を変えず、実登録/OS割当/production合格を含めない。V1は技術前提の観測であり本タスクの完了証拠へ代用しない

- [ ] 2.7 Q-45〜Q-52のrow設計とspec-only成功後、最初に専有V2でR1〜R8の手書きnative基準を実行し、不一致なら期待値を変えず設計へ戻す。旧V2の停止原本を保持し、Q-58〜Q-60の一次sourceによる設計訂正に従うV2bを新16行（事前予測R4b追加）で実行する。exit/signal/rawを照合前に保存し、元7callはbyte保持、実Vitest5.0.5/引用chunkの同一性と全期待を独立照合する。%%は既存scanner限界の注記だけとし新しい行登録制限を加えない。管理役が報告全文を読みLinux合成の技術前提だけを限定採用した状態を保ち、checker/oracle/実production/3OS/coverage/実期限の未受入を完了印へ変えない。literal表だけのeachRows/selectRows、partの共有入口、rowBinding/rowIds/rowTexts・shadowedTest・行数/対応形/ID/describe guardの全正負fixture、helperから独立したraw多重集合oracleと負fixtureを実装し、既存fixtureと元call/table/body/値評価回数・参照/arity/名前/%#/%$/timeout/options/statusを保つ。全fast/混在/全slow/空part/未知OSと同名行・欠測/重複/status/順序/sample/shardを検証する。factory/runIf.each/tagged/.for/動的表・実行時名は対応せず混在なら未登録未達。実registry・caseprefix・OS割当・既存scanner/partition/監査/製品srcを変えない。deadline実登録後の候補4→5はrowBinding1増、宣言3/行6/元3本文不変という事前内訳を保持する

- [ ] 2.8 Q-61・Q-62とschema2file設計・spec-only成功後、旧17fileの順序・包含を保ちschema-compatibility/schema-version-contractを加えた19file必須包含を実装する。新2fileの各欠落を独立negativeで検出し、全採集file/case/raw/失敗sampleを保持する。2file各1宣言/2候補/1行/importSpecifier1/errors0と元本文を、接頭辞前commitのlive inventoryで独立照合する。2.6完了を維持し、本タスクは252/253先行基盤の受入後に実装してよい。実registry・元2callback/全15trial/元script/260000・240000・10000・15000ms/依存/cleanup/既存期待/製品schemaを変えず、実case登録とOS割当を含めない

- [ ] 2.9 Q-67〜Q-73のorphans設計とspec-only成功後、imported product helperの限定したbinding分類をchecker/試験/docsだけへ実装する。別名なし非type相対.js named import→正規repo内packages/*/src.ts、本体付きexport function・直接call・Vitest系/非literalimport/requireなしを静的に確認する。readModule注入と既定filesystemのpath/実path内包・isFile・構文/読取の正負境界を検証し、transitive依存の非検査はA-02として限界を保つ。全72候補を保持し、元6imports+33importedHelperCall/元it33宣言34行/errors0予測を実装前の独立AST/原文照合で実証、偽66/67を基準採用せず、不一致なら期待を変えず設計へ戻す。map正例のred/greenと規則外のcode集合・既存全fixture/live baselineを保持する。実source/registry/scanner/本文hash/partition/Vitest/製品コードは変えず、実登録/OS割当を含めない

# 3. 統合と残設計

- [ ] 3.1 head `3571c208` で凍結したPR179診断をstabilize-cross-os-testsへ引き継ぎ、その統合境界と最新mainを基準にfresh差分・元case/parameter/assert/timeout・診断対象/companionを照合する。case本体分割の前に吸収先/C001/E3との重複と統合順序を管理役が確定する。179の診断を吸収した190に専用2本目profilerはなく、現行後継はWindows隔離全fileのunsharded診断である。A1-route設計はQ-53〜Q-56で採用したが、隔離解除後の選択・main push/schedule・独立3sample・元case/companion・失敗後保存/privacy/時計の実装とproducer互換を確認するまで未完了とし、旧179workflowを復活させず4.4範囲を縮めない。実運用は追加必須受入5.6に残す。main236のfixture/quality receipt受入後の再照合と最新測定を残す
- [ ] 3.2 当初未設計10fileのうちrun以外の9fileの全文・fixture/hook/callerと関連Requirement全文をそろえ、管理役がOpusの具体設計を確認する。a3bf248bのin-place登録構造、cd321d46の監査/inventory、G-BとC1の個別設計は採用済みとして保持し、残る個別設計を受け入れる。C1のV1はLinux合成fixtureの前提観測としてのみ採用し、全case/3OS/coverage/OS割当合格へ代用せず、採用済み4fileを含む14fileの本文位置・名前/parameter/assert/timeout・監査/登録対応を再照合する。出版診断companion/shardと、他fileで行閾値が混在する場合に10秒超caseだけslowへ分ける設計を決める。2.5/2.6の実装済みを保持し、未完了2.7の原理実験と独立実装はこの残設計と並行できる。全件で追加判明したschema2file・kit/orphans・runner/v2-readersも対象候補から除外せず、schema2file/A2追加設計は採用したが、2.8・F-A2・全selector旧形式・producer/quarantine互換と残る個別設計の受入を確認する。orphansのimportされた*Test helperは2.9で独立実証し、v2-readersも個別設計の未確認事項を解消してから登録する。未検証countやモデルの旧進捗を基準へ固定しない
- [ ] 3.3 残る数値・外部連携・失敗境界と各fileの判断をtraceへ反映し、仕様ゲートを再実行する。REQ-347の原文/元3Scenario/SourceとQ-R系・Q-A系の採用を保持し、残設計3.2と実OS割当の前提がそろっていることを確認してspec-onlyをexit 0にする。2.5着手前の仕様ゲートをこの後続ゲートで代用しない

# 4. case分割と実測

- [ ] 4.2 push ci/measure-*専用の同head3OS×3sample測定を用意し、新required statusを加えず最新headの元caseと新fastを測る。main取込前や旧headの測定を最新の9sampleへ代用せず、checkout SHA/Node版/3OS各3sample/全case数/失敗/欠測を照合して受け入れる。2.8で旧15file＋移動先2file＋schema2fileの19必須fileを包含し、全採集file/全case/raw/失敗sampleを保存する。8dの旧full測定9sampleは7成功/2失敗で未受入であり、995eや実装後の最新headの測定へ流用せず、282bの最新全9本は17必須/155採集fileの7成功/Windows2失敗で未受入であり、未実装の19file包含検査へ読み替えず、元case/runtime/config/deps不変の実証に限るQ-41を失敗の救済には使わない。この計画改訂で4.2を完了にしない
- [ ] 4.3 3.1〜3.3・2.5・2.6・2.7・2.8・2.9・4.2の受入後、本文を元testに残す採用済みの個別設計に従い、schema2fileの各1行/全15trialとA2の14宣言/guards追加2件、orphansの元33宣言/34行とv2-readersの元16宣言/18行を含める。orphans提示33IDを元順序で再照合し6describe全部、v2-readersは7describe全部をguardし、非literal3row eachが混在する場合はfile未登録未達にする。両fileの新slow案は全4.2受入後に限り、実prefix前に独立live baselineを追加する。v2-readers登録と同commitで2.8の19必須へ追加して20fileとし、旧19順序/包含と追加独立欠測negativeを保つ。orphansは必須19へ加えず、登録source/Cの欠測を独立比較で検出する。A2の各2/3/2・2/3/2・10/11/10の独立live inventoryを接頭辞前commitで追加し、guards既存39/54/42を保持する。F-A2のmock/empty-describe/timeout対照、全selectorと旧形式・quarantine境界を検証してから、各OSの最大10秒超caseだけをslowへ分ける。元名/parameter/assert/timeoutとfast+slowの多重集合、空file選択、未知ID/OS、local/releaseの全件を検査する。Q-38の中間登録PRではslowも実行し、全PR経路のslow不実施はNode20削除とともに最後のPR184で有効にして本タスクの完了条件へ含める。profilerのsource/companion対象更新を登録より前又は同commitで行う（Q-57）。実OS割当と登録をここで行い、宣言内の本文ブロックを変えず、fast/slow双方の実レポートから元sourceへの対応と一度だけの登録を検証する。it.each表全体1IDで閾値混在を一括slowにせず、2.7で受け入れたliteral行だけ葉IDで分け、未対応形は未登録・未達に保つ。hashだけで同一it.each内の行欠測を証明したとは扱わず、独立したraw全case比較で全parameterと正当な同名caseの多重度を保持する。C1の本文16block・19行・12selectorを独立照合し、Windowsの8skip行はWindowsの割当対象にせずfastのskipを保つ。Q-63に従いpr/guardsのWindows隔離解除はfile全行が最新同head3sampleでpassed・欠測skipなしのときだけ同commitで行い、未達ならfile未登録を保つ。Q-64に従い1caseでも判定不能ならfile全体を未登録未達とし、[]でfast確定しない。Q-66に従い唯一のlive Source根拠がLinux slowへ移る場合も割当を行わず未達とし、新fast試験を独立設計する。coverage未達・mock失敗は該当する割当を行わず未達として設計へ戻す。coverageを補う新fast試験は別に設計し、閾値を下げない
- [ ] 4.4 診断2本分の受入意図を保ち、profile-slow-testsのsource/companionを含む4path更新と、quality-quarantineの独立診断plan/job・固定選択/metadata/cases対応を実装する。producer/既存診断試験とchecker全文の互換を実装前に確認し、選択/排他/25ラベルと共有初回・区間/worker/process/有限時計/privacy/保存上限/欠測・失敗後保存・heartbeatの正負fixtureと起動条件真偽表を検証する。対象path更新は4.3登録より前又は同commit、PR/手動起動の撤去は最後184で行う。新診断はmain push/scheduleのWindows独立3sampleだけで、旧隔離/mutation jobを保つ。マージ前の本タスクは静的/fixture受入とし、実運用3artifactは5.6に残す。release manual dispatch品質ゲートは全件保持する
- [ ] 4.5 最新実装headで3OS各3sampleを再取得し、checkout SHA/Node版/全case数/時間/失敗を保存する。REQ-297の4case・19.5/39.5秒下限・既存上限/clock/retry/assertと全診断契約を保持する。orphans保持役とv2-readers初回fixture費用がfast別caseへ移り新10秒超となれば、未達として測定受入・設計確認へ戻し、beforeAll/全group一括slow/cache共有で隠さない。v2-readers登録後は必須20、未登録の2.8段階は19という包含時点を照合する

# 5. 受入と人の操作

- [ ] 5.1 元全caseと全assertの保持、coverage94/89/96/97、local full、change.liveの実passed対応、Node22.12/3OS24を検証する。parameter全行・正当な同名17行を含め、元全caseとfast+slowのraw多重集合をpartition helperから独立して比較し、58selectorの再受入を確認する。旧reportや虚偽タグを使わない
- [ ] 5.2 対象headの完了ゲートと全tasks・要件対応テストを確認する <!-- loomake:gate=done -->

## 完了ゲート後の必須受入

次の4件は5.2の後に行う必須受入であり、タスクの完了印では代用しない。番号・順序・担当と未完了の受入を保持し、2026-10-31のレビュー規則改訂を5.3へ反映する。証跡の正本はPR #184末尾の証跡ブロックとし、人へのruleset依頼はIssue #121に記録する。どれかが未達の間はchange・PR・配布の完了を報告しない。

- 5.3 同headの他4必須checkをそろえ、node20だけ廃止に伴い未成立であることを記録する。独立Opusの回数・重大指摘ゼロ・軽微指摘とhead対応の扱いはADR 0006の「レビュー規則（2026-10-31 改訂）」に従う。自動Codexは参考としてPR末尾の証跡ブロックへ記録し、マージ条件には加えない
- 5.4 管理役がrulesetのfresh beforeとnode20 contextだけの差分・証跡、AGENTS等のnode20記載を直す別L2規約PR案をIssue121で@rrr-wwwへ渡し、人の操作後fresh afterで他4checkと全fieldを照合する。規則を補助や管理役が書き換えず、規約PRも人の判断を得て進める（Q-42）
- 5.5 残存required成功後に管理役がNode20削除と全PRslow不実施を同時に有効にする最後の1-1 PR184をマージする。対応スキルのsync/archiveは5.6の実運用受入後に続け、旧Source/試験対応と273衝突のB1引継ぎを保持する
- 5.6 マージ後最初のmain pushのpublication独立診断3artifactを取得し、同checkout/実Node/3sample/expected source-companionと元25ラベル・共有初回・n=2/区間/worker/process/有限時計/privacy/上限/失敗後保存を照合する。欠測・失敗・異常codeを成功へ補わず、未達なら修理と受入を残しsync/archiveとchange完成を保留する。fixture成功は実運用の代わりにしない（Q-53）

2.6追加時点の7/17と必須受入3件未達は履歴として残す。2.7追加時点の8/18を履歴として保持し、2.8追加時点の8/19も履歴として残し、現在は2.6までの8完了を保って未完了2.9を加え8/20とする。元5.3〜5.5を保持し追加5.6と合わせた必須受入4件は未達、全24件を追跡する。4.2の元case・新fastの測定受入と、最終分割後の4.5の全測定は別に保持する。最終レビュー等で修正が必要になったら5.2より前に修正タスクを追加し、新headで必要な完了ゲート・CIを再検証する。独立Opusの再レビュー要否と回数は改訂ADR 0006に従い、無制限の全重大度ゼロやCodex必須という旧条件は適用しない。仕様・測定・要件対応テスト・人のruleset操作・マージとsync/archiveの残受入は保持する。


## PR分割の記録

Q-38〜Q-44の採用により#239（測定/fast基盤）、#240（2.5監査とinventory同一PR）、#241（受入後の実登録）、#242（最後のPR184）へ分ける。各L2部分PRは親changeのspec-only成功を参照し、必須5check・ci:all-os・同packet自己レビュー・独立Opusを満たす。親changeの20タスクと必須受入4件の範囲は分割で減らさず、最後184のdoneと5.6前に完成を宣言しない。重複prototypeの整理は元検証をPR204/最後184へ保って行い、今回の計画更新ではコードを変えない。
