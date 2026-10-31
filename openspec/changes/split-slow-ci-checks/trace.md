# Trace: split-slow-ci-checks

## 入力文書

| 文書 | 版 | 日付 |
|---|---|---|
| 利用者delivery指示1-1 | Node20削除・10秒超slow分離・1 PR | 2026-10-30 |
| 現行monorepo/domain-mutation-check/ci-deadline-clock-alignment | main085a82686dc1c14506fbdbad88b5b9b3961f522e | 2026-10-30 |
| 管理役ci-manager-decisions.md | Q01〜Q10の採用 | 2026-10-30 |
| Opus62aba81d-e041-42f8-b68d-df78bf959be6 | main085a・claude-opus-5-5・ok:true・拒否0 | 2026-10-30 |
| 管理役ci-followup-adoption.mdとrelease適用範囲 | Q-N1〜Q-N5と診断2本のmanual撤去の限定 | 2026-10-30 |
| 利用者が採用した実装ワークフロー再編計画・改訂ADR 0006 | 手順5・7、レビュー規則の改訂、管理役のPR184計画更新委任 | 2026-10-31 |
| Opus a3bf248b-a66e-4442-9e06-c5ed823e14bc | head8d8587aa・in-place登録構造・V0前提 | 2026-10-31 |
| V0 REPORT.md・旧全件測定run41181009660 | 8dのLinux隔離fixtureと3OS9sample（7成功/2失敗・未受入） | 2026-10-31 |
| Opus cd321d46-844b-438a-bd15-2d0841611d27 | head995e6325・AUDIT-347/REGISTRY-INVENTORY・Q-A1〜Q-A6 | 2026-10-31 |
| 管理役の設計採用・ADR0006 | Q-R2 B/Q-R3 B、Q-R1元file内方式、Q-A1〜Q-A6 A採用 | 2026-10-31 |
| 受入済みmain PR231の期限試験移動 | main d799ea4f取込後の本文block/selector/native AST照合 | 2026-10-31 |
| Opus C1設計・管理役の全文採用 | 5b4ee366・actual Opus5-5/read-only/拒否0・Q-C1〜Q-C4 A | 2026-10-31 |
| V1 REPORT.md・管理役の限定採用 | Linux/Node24.21.0/Vitest5.0.5の最終native合成fixture観測 | 2026-10-31 |
| 統合境界監査・管理役の採用 | PR190のA-07と後継隔離診断、17file包含、現行main236受入後の再照合 | 2026-10-31 |

| Opus 分割設計とIssue #239〜#242・管理役採用 | 3d664の原設計を282bの実装済み2.5/2.6と17fileへ照合・Q-38〜Q-44 | 2026-10-31 |
| Opus 行登録設計58b1ebb7・管理役採用 | head65f98fcb・actual Opus5-5/read-only/拒否0・Q-E1〜Q-E8 | 2026-10-31 |
| Opus A1-route設計effd2731・管理役採用 | headd465f317・actual Opus5-5/read-only/拒否0・後継選択と実3sample受入 | 2026-10-31 |
| 最新全件9sampleとV2初回の観測 | 282bの7成功/2失敗、V2手書き基準不一致で停止・未受入 | 2026-10-31 |
| Opus V2b補足設計dd40a790 | head65f98fcb・actual Opus5-5/ok/read-only/拒否0・Q-V1〜3 | 2026-10-31 |
| Opus schema2file設計2043c3b2 | head65f98fcb・actual Opus5-5/ok/read-only/拒否0・19file包含とlive基準 | 2026-10-31 |
| Opus A2追加設計585f3bb1 | head65f98fcb・actual Opus5-5/ok/read-only/拒否0・全file解除条件とSource保持 | 2026-10-31 |
| Opus orphans設計b782f009・管理役採用 | head65f98fcb・actual Opus5-5/ok/read-only/拒否0・imported helperと33宣言 | 2026-10-31 |
| Opus v2-readers設計d33bb4dd・管理役採用 | head65f98fcb・actual Opus5-5/ok/read-only/拒否0・16宣言18行と登録後20包含 | 2026-10-31 |
| Opus row境界追加設計c6060b2e・管理役の部分採用 | head7ed774d3・actual Opus5-5/ok/read-only/拒否0・R1〜R3採用/R4方向のみ | 2026-10-31 |
| Opus module読込補足d466c4ce・管理役採用 | headb386bd41・actual Opus5-5/ok/read-only/拒否0・第12Scenario読込原子句の明確化 | 2026-10-31 |

原資料の全文・hashは専用treeの`.loomake/ci-formal-adoption/inputs/`と索引に保存した。Q01〜Q10の元おすすめはreadiness/manager-questions.json、採用回答はci-manager-decisions.md、Q-N1〜Q-N5の元案はOpus結果§7にある。旧資料の未採用という状態はその観測時点の記録であり、下表の管理役回答が今回の採用である。1 change/1 PRと配布第3枠は管理役の当初指定である。後の200KiB分割規則に従う現行のPR構成はQ-38〜Q-44で記録する。

## 要件台帳

| ID | 出典 | 種別 | 要約（原文に忠実に） | 状態 | 反映先 |
|---|---|---|---|---|---|
| REQ-049 | main monorepo「3 つの OS での CI」・利用者1-1・Q03/Q04 | 制約 | CI運用を全文/全Scenario/Source履歴付きで開発文書へ移し、PRのslow不実施とpush/schedule全件へ改める | 反映済 | specs/monorepo/spec.md REMOVED・docs/dev/ci.md |
| REQ-214 | main monorepo「CI のテストの分割」・Q03/Q07 | 制約 | 既存シャードと全caseを保持し、分割運用を開発文書へ移す | 反映済 | specs/monorepo/spec.md REMOVED・docs/dev/ci.md |
| REQ-270 | main monorepoの049/214 Source・Q03 | 制約 | 移管対象のSourceを保持し、docs-only判定など別契約を残す | 反映済 | specs/monorepo/spec.md REMOVED・docs/dev/ci.md |
| REQ-273 | main monorepoの049 Source・Q-N4 | 制約 | CI側の旧Source/試験履歴を保持してタグを外し、別契約との歴史衝突をB1へ引き継ぐ | 反映済 | specs/monorepo/spec.md REMOVED・docs/dev/ci.md |
| REQ-144 | main monorepo「対応環境での配布物の検証」・利用者1-1 | 制約 | Node20追加検査だけを外し、3OS Node24とNode22.12.0下限を保つ | 反映済 | specs/monorepo/spec.md MODIFIED |
| REQ-161 | main domain-mutation-check・Q06 | 制約 | 元13条件の実検出とbaseline成功、source/test/report不変を保つ | 既存仕様で充足 | openspec/specs/domain-mutation-check/spec.md |
| REQ-162 | main domain-mutation-check・Q06 | 制約 | 検出/未検出/試験エラーと全体の不合格を保つ | 既存仕様で充足 | openspec/specs/domain-mutation-check/spec.md |
| REQ-163 | main domain-mutation-check・Q06 | 制約 | 各条件の結果/ハッシュと保存先保護、元ファイル不変を保つ | 既存仕様で充足 | openspec/specs/domain-mutation-check/spec.md |
| REQ-297 | main ci-deadline-clock-alignment・Q02/Q-N5 | 制約 | 元4caseと時計の実時間/予算上下限/待ち差分/retry/assertを保持する | 既存仕様で充足 | openspec/specs/ci-deadline-clock-alignment/spec.md |
| REQ-347 | main scenario-evidence-audit全文・a3bf Q-R1b・cd321d46 AUDIT-347 | 制約 | 原本文/元3Scenario/Sourceを保持し、登録済みCの実結果を元Sで照合する。登録外はraw保持、不正一覧/Cはerror、raw多重度と既存状態/移行条件を保つ | 反映済 | specs/scenario-evidence-audit/spec.md MODIFIED・tasks2.5/4.3/5.1 |

反映済は差分仕様への反映であり、実装や受入の完了ではない。REQ-270/273が複数契約を持つことを理由に他の契約を削らない。新しいREQの採番・予約は行わない。

## 確認事項

Q-01〜Q-100の採用と条件は管理役がADR0006に基づき記録する。Q-19〜Q-24はR系と行閾値/宣言分類、Q-25〜Q-30はcd321d46のQ-A1〜Q-A6に対応する。未完了の個別設計・測定・実装は回答済みという理由で受入済みにしない。回答日・承認日は日本時間である。回答者は包括承認の表記であり、利用者本人が各資料をレビューしたという意味ではない。選択肢とおすすめの採用理由を残す。旧Q番号Q01〜Q10は下表Q-01〜Q-10、Q-N1〜Q-N5はQ-11〜Q-15に対応する。Q-01〜Q-16は当時の決定として残し、PR179先行受入と旧レビュー条件に関する現行の決定はQ-17・Q-18を優先する。Q-21の同一PR限定は後の200KiB分割決定を適用するQ-38で更新し、Node20削除と全PRslow不実施の同時有効化を維持する。

| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 | 回答者 | 回答日 |
|---|---|---|---|---|---|---|---|---|
| Q-01 | REQ-049・REQ-214 | OS別か3OS和集合か | OS別／3OS和集合 | OS別。実測した遅さを推定で取り消さない | yes | OS別を採用。各OSで同head3sampleの最大10秒超caseをslowにし、同fileのfastを残す。旧108keyは候補で最新測定へ流用しない（Q01） | 利用者（ADR 0006 の包括承認） | 2026-10-30 |
| Q-02 | REQ-297 | 時計下限と主仕様をどう保つか | A：main保持／B：全文開発docs移管 | A。PR gate回避の退役にしない | yes | Aを採用。元4case、19.5/39.5秒下限と上限、保持役待ち差分だけの時計、retry、全assertを維持する。auth/listでpush/createのfast実証を代用しない（Q02） | 利用者（ADR 0006 の包括承認） | 2026-10-30 |
| Q-03 | REQ-049・REQ-214・REQ-144 | 既存運用契約とNode20をどう変更するか | 全文devdocs移管＋144部分変更／旧契約維持 | 前者。ADR0005と利用者1-1を整合する | yes | 049/214を全文・全Scenario・Source/旧試験対応付きで開発docsへ移管する。144はNode20だけを削り、3OS24/22.12下限を保つ。273履歴衝突はB1に残す（Q03） | 利用者（ADR 0006 の包括承認） | 2026-10-30 |
| Q-04 | REQ-049・REQ-214 | PR全経路とprofilerのslowをどうするか | 全PR不実施／PRで一部復活 | 全PR不実施。利用者のpush/定期だけに合わせる | yes | quality/gate/ci:all-os/shard/両profilerを含む全PRでslowを実行しない。main push/scheduleで全件を保つ。PR179を先に受け入れる。manual撤去の対象はQ-16で限定する（Q04） | 利用者（ADR 0006 の包括承認） | 2026-10-30 |
| Q-05 | REQ-214 | build/packをどう共有するか | root provide/inject／module memo共有 | root provide/inject。memo共有仮説は反証済み | yes | root globalSetup→package/slow injectを採用。独立コピー依存で共有1回を検証する。unit-only余計build、失敗cleanup/watch、inject欠落も実証し、0case setup不実行を仮定しない（Q05） | 利用者（ADR 0006 の包括承認） | 2026-10-30 |
| Q-06 | REQ-161・REQ-162・REQ-163 | 13条件のfastをどう補うか | 実baseline＋実検出／タグや合成成功 | 実検出。契約の振る舞いを確かめる | yes | 元13条件を実際に検出するfastを追加し、元全体試験もslowに残す。baseline/失敗分類/元source-test-report不変を確かめ、重い処理をhookへ隠さない（Q06） | 利用者（ADR 0006 の包括承認） | 2026-10-30 |
| Q-07 | REQ-214・REQ-297 | 元caseと測定対象をどう固定するか | 最新headで全対応照合／旧観測流用 | 最新head。179/E3/helper差がある | yes | fast+slow和集合と元名/parameter/assert/timeoutを固定headで照合する。179統合後とE3等の差を再測定し、旧OSpath/duplicate/Node混在を最新合格根拠にしない（Q07） | 利用者（ADR 0006 の包括承認） | 2026-10-30 |
| Q-08 | REQ-144・REQ-161・REQ-297 | PR gateとcoverageをどう保つか | 現行gate/閾値維持／緩和 | 維持。検査対象と実証を正直に記録する | yes | 94/89/96/97、local full done、対象change.liveの実passed対応を維持する。古いreport/虚偽タグは使わず、未採用C001のv2/scopeを混ぜない（Q08） | 利用者（ADR 0006 の包括承認） | 2026-10-30 |
| Q-09 | REQ-144 | rulesetを誰がどこまで変えるか | node20のみ人操作／管理役API変更 | node20のみ人操作。ADR0006の境界を守る | yes | ready時にfresh before/afterと具体差分をIssue121へ渡して人に依頼する。他4checkと全rule/parameterを保持する。管理役/補助はPUTしない（Q09） | 利用者（ADR 0006 の包括承認） | 2026-10-30 |
| Q-10 | REQ-049・REQ-214 | 既存所有と枠をどう扱うか | CI配布第3枠・E3品質枠／担当移動 | 既存所有維持。重複実装を避ける | yes | CIを配布第3枠、E3を品質1枠とし、C001/Windows診断の配布枠と既存C001/S1/E3treeを保つ。main085aの専用treeと独立依存を使い、179を先に統合する（Q10） | 利用者（ADR 0006 の包括承認） | 2026-10-30 |
| Q-11 | REQ-214 | マージ前の全OS測定をどこで起動するか | A：push ci/measure-*専用workflow／B：マージ後push/scheduleだけ | A。同head3OS×3をPR外で得る | yes | A採用。push ci/measure-*で同head3OS各3sampleを測る。PRへslowを戻さず、新required checkにも加えない（Q-N1） | 利用者（ADR 0006 の包括承認） | 2026-10-30 |
| Q-12 | REQ-214 | 名前付きslowとsetupを維持するか | A：維持／B：slow project廃止 | A。利用者がslow projectを明示している | yes | A採用。root setupを維持してunit-onlyの追加時間、失敗cleanup/watchを測る。Bは利用者の明示構成と合わない（Q-N2） | 利用者（ADR 0006 の包括承認） | 2026-10-30 |
| Q-13 | REQ-214 | profilerはcompanionをどう選ぶか | A：companion含む4path／B：x.test.ts.slow.tsへ改名して元command維持 | A。元caseIdを照合できる | yes | A採用。元とcompanionの4pathを明記しmain push/scheduleだけで起動する。元caseId集合とPR/手動起動の撤去を検査する。releaseはQ-16の全件保持（Q-N3） | 利用者（ADR 0006 の包括承認） | 2026-10-30 |
| Q-14 | REQ-273 | CI側273のタグをどう扱うか | A：CIタグを外し履歴保持／B：触らない | A。別契約へ誤対応させない | yes | A採用。CI側049由来の273タグを外し、旧Source/名/全assert対応を保持する。agents-rulesの別契約と歴史衝突は解消済みとせずB1へ残す（Q-N4） | 利用者（ADR 0006 の包括承認） | 2026-10-30 |
| Q-15 | REQ-297 | 元の実行条件不変は今回event分離も禁止するか | A：診断/計測の機能保護として解釈／B：MODIFIEDで文言を変更 | A。利用者1-1の明示変更と元機能を両立する | yes | A採用。291/292/296/297の機能・OS・Node・env・sample・対象case・元成否と全assert/上下限/保存/未計測を保持し、今回のevent/slow分離を永久禁止とは読まない（Q-N5） | 利用者（ADR 0006 の包括承認） | 2026-10-30 |
| Q-16 | REQ-049・REQ-214 | manual撤去はreleaseにも及ぶか | A：診断profiler2本のみ／B：release品質ゲートも縮小 | A。PR軽量化を公開検査縮小へ広げない | yes | Aを管理役が明示採用。診断profiler2本のmanualだけを撤去し、既存release manual dispatch品質ゲートとlocal fullは全件を維持する。人のrelease操作を実行したとは記録しない（root追加回答） | 利用者（ADR 0006 の包括承認） | 2026-10-30 |
| Q-17 | REQ-214・REQ-297・tasks3.1 | 凍結PR179診断の依存経路をどうするか | A：stabilizeへ吸収／B：179単独受入を先行 | A。利用者採用の再編手順5・7と重複回避を整合する | yes | 凍結head `3571c208` をstabilize-cross-os-testsへ引き継ぐ。吸収先との境界・重複・順序を管理役が確定し、最新mainで元case/parameter/assert/timeout・診断対象/companionを照合するまでcase本体分割は進めない | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| Q-18 | REQ-144・tasks5.3 | 旧全指摘ゼロ・Codex必須を維持するか | A：改訂ADR適用／B：旧無制限を維持 | A。利用者が再編計画のレビュー規則を採用済み | yes | 段階別のOpus回数・重大ゼロ・軽微Issue化・head対応は改訂ADRに従う。Codexは参考としPR末尾へ記録する。必要なCI・done・要件対応テスト・測定と人のruleset操作は保持する | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| Q-19 | REQ-347・tasks2.5/4.3 | 元本文をcases.tsへ移すか（Q-R1） | A：元test内prefix＋動的import／B：carrierへ移動 | A。原it本文blockを保持し、V0と独立ASTで登録を検査する | yes | Aを採用。V0成立とcd321d46方針を反映しin-place方式とする。実本体分割は3.1〜3.3・2.5・4.2受入後 | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| Q-20 | REQ-347・REQ-189・tasks2.5 | companionの実結果を元sourceへ結ぶか（Q-R1b） | A：登録済みC→S／B：selectorをCへ変更 | A。原sourceのblockhashと実passed対応を保つ | yes | Aを採用。cd321d46の入口検査・links・rawFile・行identity Set・migrate対応を採る。REQ-347差分とspec-onlyを実装前に通す | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| Q-21 | tasks4.3・1change/1PR | carrierの先行PRを作るか（Q-R2） | A：別PR／B：PR184内 | B。利用者の1-1を保つ | yes | Bを採用。Node20削除とslow有効化は同じPR184。独立2.5も同PRで扱い別carrier PRは作らない | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| Q-22 | tasks2.5/4.2/4.3 | OS割当前に実registryへ全fast登録するか（Q-R3） | A：先に登録／B：割当まで空 | B。実割当前のファイル隔離経路を保持する | yes | Bを採用。2.5は合成fixtureとrun読取検査で進め、実registryはOS割当まで空に保つ | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| Q-23 | 10秒超caseだけ・tasks3.2/4.3 | it.each行の閾値が異なる場合の登録単位は何か | A：全表一括slow／B：全行の実測閾値と原blockを保持 | B。run12行の8d旧9sampleは全passed・最大5268.1718ms。他fileへ広げない | yes | B。run2表は旧8d観測のuniform fast条件だけを確認。残9file・最新headの行閾値は3.2/4.2で確認し、混在行を一括slowにしない | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| Q-24 | tasks2.5・cd REGISTRY-INVENTORY | 62scanner候補と壊れた宣言をどう分類するか | A：全候補prefix/単純filter／B：ASTで独立分類 | B。非call2と有効60宣言を区別し壊れた宣言を隠さない | yes | Bを採用。cd設計のAST宣言とscanner突合、非call許可親2種、alias/dynamicTitle/syntax拒否を採る。AST未実測の一致は2.5で確認し、違えば設計へ戻す | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| Q-25 | REQ-347・tasks2.5 | 監査rootに一覧がない場合（Q-A1） | A：error／B：空とみなす | A。実repoのVitestも一覧を必須にする | yes | Aを採用。一覧の欠落/不正は出力作成前にerror。scope fixtureは空registryを既定で作り、既存assertを弱めない | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| Q-26 | REQ-347・tasks2.5 | 登録外Cがreportにある場合（Q-A2） | A：自身のrawfileのまま／B：監査issue追加 | A。推測mappingをせず既存の判定を保つ | yes | Aを採用。登録外Cだけで一覧errorにせずrawfileで照合する。repo内の登録外Cは独立inventoryが検出する | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| Q-27 | REQ-346/347・tasks2.5 | migrateもcompanion対応するか（Q-A3） | A：対応／B：対応しない | A。実行済みをnotExecutedへ誤分類しない | yes | Aを採用。migrateRepository入口もlinksを渡し、migrateReviews/REQ-346の移行条件・dry-run・既存block形式は変えない | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| Q-28 | REQ-189/190・PR監査・tasks2.5/4.3 | PRでslow未実行の根拠がinvalidになる場合（Q-A4） | A：正直な結果を記載／B：別扱いを設計 | A。欠測を成功で補わずmain全件を別に確認する | yes | Aを採用。PRでinvalidになり得ることをci.mdへ記し、旧report合流や判定緩和をせず、main push全件の監査と最終受入を確認する | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| Q-29 | tasks2.5・cd REGISTRY-INVENTORY | 実fileのinventory範囲（Q-A5） | A：runと登録済みfile／B：repo全test | A。未調査fileへ検査範囲を広げない | yes | Aを採用。run60宣言/62候補/非call2/展開70を確認し、他fileは登録時に検査する。全slow fileの登録対応は独立に照合する | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| Q-30 | REQ-347・tasks2.5 | companionの形の検査（Q-A6） | A：構造／B：雛形完全一致 | A。整形差を許し別testの混入を拒否する | yes | Aを採用。宣言なし・元Sへのliteral dynamic importが1つ・別testの静的fromなし・一意なCを検査する | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| Q-31 | tasks3.2/4.3・G-B Q-G1 | each行の閾値混在時にどうするか | A：行wrapper／B：本文を分割／C：未割当を保持 | C。実測で混在を確認してから具体設計し、fast行をslowへ隠さない | yes | Cを採用。最新4.2で混在が判明した宣言は未割当・未達を保ち、本文保持と行別条件を両立する追加設計を得る | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| Q-32 | tasks2.5/4.3・G-B Q-G2 | withTestの通常helper候補をどう分類するか | A：constと非call参照をbindingで分類／B：rename／C：検査除外 | A。元本文と検査範囲を保持する | yes | Aを採用。通常fixture helperのconst宣言名と非call参照を非宣言として分類し、初期値がテスト関数やaliasなら拒否する。2.5で実2fileと正負fixtureを照合する | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| Q-33 | tasks4.2/4.3・G-B Q-G3 | Windowsの隔離と登録の重複をどう解消するか | A：最新3試験成功後同commit解除／B：隔離中は未登録 | A。失敗をslowへ移して隠さず重複拒否を保つ | yes | 条件付きA。最新測定で対象3試験が成功したときだけ4.3登録と同commitで隔離を解除し、失敗時はBの未登録・未達。今回の計画更新で解除しない | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| Q-34 | tasks2.6/4.3・C1 Q-C1 | signalのposixIt factoryをどう分類するか | A：const factoryを独立分類／B：本文変更／C：未登録 | A。元本文を保ち候補を除外しない | yes | Aを採用。非export const・既存名規則・it/test.runIf/skipIfの1引数をfactoryとし、名前/初期値をnonCall、呼出しを宣言にする。不正名/let/export/引数/aliasと既存診断を保つ。型だけのwrapperを外しspreadなしliteral配列だけ数え、変数/spread表はdynamicRows。モデル22候補はpropertyKey3漏れでnative25へ訂正、元16本文保持を根拠とし宣言16/行19は2.6で別確認（C1・別Codex・管理役採用・ADR0006） | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| Q-35 | tasks3.2/4.3・C1 Q-C2 | companionでmockが効かない場合 | A：未登録・未達で設計へ戻す／B：mock重複 | A。元moduleだけの読込と本文を保つ | yes | Aを採用。V1の最終native合成fixtureでmock維持と同一assertのnegative失敗を観測した。Linuxの技術前提に限り、production/3OS/OS割当の合格や2.6完了へ流用しない。production条件で不成立なら未登録・未達で設計へ戻す（V1報告・C1設計・管理役採用・ADR0006） | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| Q-36 | tasks4.3/5.1・C1 Q-C3 | fast coverageが閾値を下回った場合 | A：未割当・未達と新fast設計／B：閾値低下 | A。品質を保つ | yes | Aを採用。ubuntu fastが94/89/96/97未達なら該当caseのLinux割当を行わず未達を残し、不足を補うfast試験を別Issueで設計する。閾値は下げない（C1設計・管理役採用・ADR0006） | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| Q-37 | tasks2.6/4.2・C1 Q-C4 | PR231の移動先を必須測定包含へ加えるか | A：旧15＋移動先2で17file／B：旧15のまま | A。移動後の元case欠落を検出する | yes | Aを採用。run-timeoutとexternal-budget-deadlineを必須包含へ追加し、全採集file/全case/raw/失敗sampleを保持する。17fileだけへ測定対象を限定せず、旧結果を最新9sampleへ流用しない（C1設計・境界監査・管理役採用・ADR0006） | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| Q-38 | tasks/PR239〜242・分割Q-S1 | 1 change/1 PRをどう分割するか | A：1 change複数PR／B：単一PR | A。後の200KiB分割規則と小PR方針に従う | yes | A。L2部分PRはnone/planning-change/Refsで範囲を明示し、Node20削除と全PRslow不実施は最後184で同時に有効化。旧Q-21をこの範囲で更新し全受入を保つ（管理役採用・ADR0006） | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| Q-39 | REQ-347・分割Q-S2 | 主仕様同期前に2.5基盤を受け入れるか | A：spec-only後L2先行／B：最後184 | A。採用済み差分に従う開発基盤を独立受入できる | yes | A。進行中REQ-347差分と仕様ゲートを前提に監査+inventoryを同一PRへ。実registry空と原3Scenario/raw/移行条件を保ち、製品src・配布APIを追加しない（管理役採用・ADR0006） | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| Q-40 | tasks2.3・分割Q-S3 | 重複test-split prototypeをどうするか | A：外して既存partitionへ集約／B：保持 | A。一覧の正本を二重にしない | yes | A。後続で整理しPR判定は最後184の既存partitionへ集約。2.3検証範囲はPR204と最後184で保持し完了印を変えない。今回は計画だけ（管理役採用・ADR0006） | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| Q-41 | tasks4.2・分割Q-S4 | 測定headと実登録基点の同一性は何か | A：同SHA又は非実行差分のみ実証／B：常に再測定 | A。実行条件が同じ場合に限り再採集を避ける | yes | A。元case/runtime/config/depsに差分なしを管理役が実証できるときだけ同基準。触れれば再測定。282b9本の7成功2失敗は未受入で救済せず、失敗/欠測を保持する（管理役採用・ADR0006） | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| Q-42 | tasks5.4・分割Q-S5 | AGENTSのnode20規約をいつ直すか | A：5.4と別L2案を人へ／B：最後184へ混在 | A。規則変更は人の操作である | yes | A。具体ruleset案と別L2規約PR案をIssue121の@rrr-wwwへ示し人の判断を待つ。管理役は規則を変更しない。古い宛先表記は現行ADRに合わせる（管理役採用・ADR0006） | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| Q-43 | tasks2.6/4.2・分割Q-S6 | 必須測定包含へ移動先2fileを足すか | A：旧15+2／B：旧15固定 | A。移動したcaseの欠落を検出する | yes | A。Q-37どおり17file。2.6で実装/独立検証済みの旧順序・包含と各追加file欠測negativeを維持し、全採集file/case/rawを保持する（管理役採用・ADR0006） | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| Q-44 | PR184差分・分割Q-S7 | 最後184も200KiBを超える場合 | A：移管原文節だけL1先行／B：設計要点+原本保存先 | Bを既定、なお超過ならA。条件を削らない | yes | Bを既定に採用。native全diffを実測し超過が残るときAを検討。Requirement/Scenario/Source・受入・正負fixtureを削って収めず、原本の正確な保存先を残す（管理役採用・ADR0006） | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| Q-45 | tasks2.7/4.3・row Q-E1 | 行選択APIの形は何か | A：裸Blockの局所it束縛／B：IIFE／C：一時差替え／D：内部task削除 | A。元call不変で効く範囲が字面で閉じる | yes | A。const it/test=eachRowsの2文Blockだけを認め元call/bodyをbyte保持。rowBindingを非callに分類し、元本体/registry/実割当は2.7で変えない（管理役採用・ADR0006） | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| Q-46 | tasks2.7・row Q-E2 | 表をどうVitestへ渡すか | A：コピー+own forEach／B：Proxy／C：filter配列 | A。全tableのeveryと元indexを保つ | yes | A。元表の評価1回・値参照/arity/名前/timeoutを維持。Vitest5.0.5依存をV2で検出し、手書きnative全fast基準不一致なら期待を変えず設計へ戻す（管理役採用・ADR0006） | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| Q-47 | tasks2.7/4.3・row Q-E3 | registryの行をどう表すか | A：葉IDとliteral位置／B：rows形式追加 | A。既存schema/partition/監査規則を保つ | yes | A。葉IDを一意に登録しrowIds/rowTextsと表位置を照合する。describe guardも葉ID集合へ展開。hashだけでparameter欠測を証明しない（管理役採用・ADR0006） | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| Q-48 | tasks2.7/4.3・row Q-E4 | 対応するeach表の範囲は何か | A：直接it/testのliteral表／B：factory/動的表へ拡張 | A。最初のdeadlineの形で足りる | yes | A。factory/runIf.each/tagged/.for/関数呼出し/変数・spread表は範囲外。ai-journeys/signal/packageの混在は必要なら追加設計し、それまで未登録未達を保つ（管理役採用・ADR0006） | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| Q-49 | tasks2.7・row Q-E5 | 試験関数名を通常constで隠す形はどうするか | A：shadowedTest拒否／B：保持 | A。rowBindingを抜け道にしない | yes | A。rowBinding以外のit/test変数を通常helperへ回さず拒否。元live baselineが不成立なら期待を変えず設計へ戻り、既存alias/namespace診断も保つ（管理役採用・ADR0006） | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| Q-50 | tasks2.7/4.3・row Q-E6 | deadline登録後の候補4→5をどう扱うか | A：内訳を事前固定／B：実装時に決める | A。実装に合わせた期待値変更を避ける | yes | A。増加はrowBinding1件、宣言3/行6/元3本文は不変。nonCallはimport1+rowBinding1。raw多重集合と元call byteも別に確認する（管理役採用・ADR0006） | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| Q-51 | tasks2.7/5.1・row Q-E7 | 実行時に変わる名前を正規化するか | A：正確な一致のみ／B：正規化 | A。未検証の推測対応を避ける | yes | A。PID/host/tmpdirを含む表は行登録対象外、rawを原文保持する。基準とsplitのOS/sample別多重度・順序・全shardを独立oracleで比較する（管理役採用・ADR0006） | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| Q-52 | tasks2.7・row Q-E8 | 行登録基盤をどこで行うか | A：2.7先行／B：4.3へ混在 | A。V2受入を実登録の前提にできる | yes | A。未完了2.7を追加し実registryは空。現在8完了を保ち8/18とする。モデルの7/18は現在進捗に使わず、V2/基盤受入をproduction/3OS合格へ代用しない（管理役採用・ADR0006） | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| Q-53 | tasks4.4/5.6・route Q-S1 | 実運用3sampleをどこで受け入れるか | A：最後184マージ後初回mainpush／B：measure branchでも起動 | A。mainpush/scheduleという経路を守る | yes | A。5.6を追加必須受入にし、5.5マージ後に実3artifactを確認してからsync/archive。fixture成功で代用せず未達があればchange未完了を保つ（管理役採用・ADR0006） | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| Q-54 | tasks4.4・route Q-S2 | 隔離中の診断重複をどうするか | A：既存隔離+診断3sample／B：隔離側から除外 | A。REQ-344の一覧出力を保つ | yes | A。隔離job/一覧を変えず固定診断選択を独立追加。解除までは重複実行を受け入れ、対象成功などQ-33の条件が整うまで隔離解除/実登録をしない（管理役採用・ADR0006） | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| Q-55 | tasks4.4・route Q-S3 | case/worker/process対応付けを実装するか | A：cases.json処理／B：rawのみで手作業 | A。対応付けを正負fixtureで検査する | yes | A。固定label/context/区間/repo/worker/processで結び、曖昧・欠測・時計/上限異常を固定codeで残す。producer/既存試験の全文互換確認を実装前に行い、秘密やrawを追加記録しない（管理役採用・ADR0006） | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| Q-56 | tasks4.4・route Q-S4 | Windows診断にheartbeatを起動するか | A：起動／B：省略 | A。停止区間の観測を保つ | yes | A。既存Windows診断と同様に起動/停止/失敗後保存しubuntuへ追加しない。3独立job・7日保持・元timeout/clock/worker/TEMP条件とprivacyを保つ（管理役採用・ADR0006） | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| Q-57 | tasks4.3/4.4・C2 Q-D3 | profiler対象更新と実登録の順序は何か | A：登録前又は同commit／B：登録後 | A。push/createが未計測になる窓を作らない | yes | A。profile-slow-testsとpublication後継のsource/companion対応更新を登録前又は同commitに行う。PR/manual撤去は最後184。Q-D4の旧15固定はQ-37/43と衝突し不採用（管理役採用・ADR0006） | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| Q-58 | tasks2.7・補足Q-V1 | %%名を行登録の対応形から外すか | A：外さず注記／B：unsupported拒否 | A。既存scannerの制限であり新しい行登録の問題ではない | yes | A。Vitestは%%でも値を消費しscannerと異なる。既存制限をdocsへ注記するだけとし、scanner/名前正規化/行登録の制限を追加しない（管理役採用・ADR0006） | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| Q-59 | tasks2.7・補足Q-V2 | V2b受入に旧rawを使うか | A：新規実行／B：旧raw流用 | A。旧版は終了結果の保存も不十分 | yes | A。旧期待/raw/停止記録を保持し新V2bでbaseline/success/failureを実行。exit/signal/rawを照合前に記録し、報告全文の管理役確認前は実観測未受入（管理役採用・ADR0006） | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| Q-60 | tasks2.7・補足Q-V3 | 旧R4訂正だけでなく新しい予測行を足すか | A：未実行R4b追加／B：旧名だけ訂正 | A。結果を見ていない予測で一次sourceの導出を確かめる | yes | A。元7call byte保持+新R4bを事前固定し16行へ。予測rows q x % y z/argc2をnative基準と比較。合成設計の誤導出訂正で、production期待の書換えではない（管理役採用・ADR0006） | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| Q-61 | tasks2.8/4.2・schema Q-S1 | schema2fileを必須包含へ加えるか | A：旧17+2=19file／B：旧17固定 | A。元file/Cの採集漏れを検出する | yes | A。2.6完了を保ち未完2.8へ追加。旧17順序/包含と新2各欠測negative、全採集file/case/rawを保持。282b測定は必須17の7成功2失敗で新19受入に使わない（管理役採用・ADR0006） | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| Q-62 | tasks2.8/4.3・schema Q-S2 | schema2fileのlive基準をいつ足すか | A：接頭辞前commit／B：登録時だけ | A。元の数/本文の保持を独立に示す | yes | A。各1宣言/2候補/1行/import1/errors0と元本文を2.8で照合。実registry空を保ち実割当は4.3。nested全15trial/元timeout/scriptを変えない（管理役採用・ADR0006） | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| Q-63 | tasks4.2/4.3・A2 Q-E1 | pr/guardsのWindows隔離をいつ解除するか | A：最新3sampleでfile全行成功／B：隔離記載caseだけ成功 | A。隔離はfile全体なので根拠をそろえる | yes | A。旧Q-33を強化し、新guards2件も含むfile全行が同headWindows3sampleでpassed/欠測skipなしの場合だけ実登録と同commit解除。未達ならfile未登録未達、排他保持（管理役採用・ADR0006） | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| Q-64 | tasks4.3・A2 Q-E2 | 1caseの割当が判定不能なfileをどうするか | A：file全体未登録未達／B：そのcaseを[]登録 | A。[]をfast確定の代用にしない | yes | A。失敗/欠測/skip等で1caseでも未判定ならfile全体を未登録に保つ。現状実行範囲保持をfast判定や1-1完成へ読み替えず、追加設計/測定を残す（管理役採用・ADR0006） | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| Q-65 | tasks4.3・A2 Q-E3 | A2のlive inventoryをいつ足すか | A：接頭辞前commit／B：登録後検査だけ | A。登録前後で数を保ったと示す | yes | A。evidence2/3/2、auth2/3/2、pr10/11/10とimport1/errors0を接頭辞前に追加。guards39/54/42と追加2名は保持。不一致なら期待を変えず設計へ戻す（管理役採用・ADR0006） | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| Q-66 | tasks4.3/5.1・A2 Q-E5 | live Sourceの唯一の根拠をLinux slowにするか | A：未割当未達+新fast設計／B：PRdoneだけ全件 | A。PR全経路slow不実施を保つ | yes | A。全対応を確認し唯一根拠がLinux slowへ移るなら割当せず未達とし、独立新fast試験を設計。古いreport/虚偽タグ/閾値や期待変更/PRgate例外で補わない（管理役採用・ADR0006） | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| Q-67 | tasks2.9・orphans Q-O1 | imported helperの根拠は何か | A：import先を静的検証／B：相対importだけ／C：名前一覧 | A。試験factoryをhelperと誤分類しない | yes | A。原本§2.2のexport function/非Vitest/直接call条件を満たすbindingのみ。readModuleのrepo内path/実path・isFile・構文を検証し、transitive非検査はA-02の限界とする（管理役採用・ADR0006） | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| Q-68 | tasks2.9・orphans Q-O2 | 対応するimport参照の形は何か | A：別名なし直接callだけ／B：非call/aliasへ拡張 | A。orphansに必要な範囲に閉じる | yes | A。候補を消さずimportedHelperCallへ分類しAST/scannerの開始/終了/本文を照合。type/別名/curried/property/each/非call等は既存code集合を保ち設計へ戻す（管理役採用・ADR0006） | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| Q-69 | tasks2.9/4.3・orphans Q-O3 | 分類をどのtaskへ置くか | A：新基盤taskで登録前／B：実登録へ混在 | A。正負検査と実登録を分ける | yes | A。提案番号2.8は既使用なので新2.9未完へ。実装前に33宣言/72候補/34行・6import+33helper/errors0を独立実証し、偽66/67を基準へ採用しない（管理役採用・ADR0006） | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| Q-70 | tasks4.5・orphans Q-O4 | 分割後fastへ起動費用が移り10秒超ならどうするか | A：3OS各3測定し未達/設計確認／B：全group slow／C：登録しない | A。費用を隠さず実測する | yes | A。登録後headで実3OS×3を測り直し、新10秒超は未達として受入・設計を確認。beforeAllや全group一括slowにせず、元clock/budget/所有/cleanupを保つ（管理役採用・ADR0006） | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| Q-71 | tasks4.3・orphans Q-O5 | describe guardの範囲は何か | A：6つ全部／B：現時点必須だけ | A。空集合と将来の割当変化を照合できる | yes | A。describe.runIf2つを含む6つ全てへ子孫全IDのhasAny。元runIf条件/skip/本文/fixtureを変えず、登録後checkRegistrationと全raw多重度を独立比較する（管理役採用・ADR0006） | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| Q-72 | tasks2.8/4.3・orphans Q-O6 | orphansを必須包含へ加えるか | A：今は追加せず登録の独立比較／B：追加 | A。元候補包含と実登録後の欠測検査を分ける | yes | A。モデル旧17は現行2.8未実装19へ読み替え、orphansは追加しない。全採集を保ち、有効registryのsource/C欠測は独立全case比較で検出する（管理役採用・ADR0006） | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| Q-73 | tasks4.3・orphans Q-O7 | 提示33case IDを採るか | A：原順序再照合を条件に採用／B：変更 | A。kebab-caseで重複せずreq-ではない | yes | 条件付きA。原本§2.4の33IDを独立ASTの元33宣言順に実装前再照合し、本文/parameter/60s/clock/保持役を保つ。今の実registryは空、OS割当を確定しない（管理役採用・ADR0006） | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| Q-74 | tasks4.3・v2-reader Q-V1 | Windowsだけslowの2IDを登録するか | A：測定受入後win32案／B：未登録 | A。全行実測が成立すれば根拠を保って分けられる | yes | 条件付きA。local-done-draft-pr/done-gate-scope-localの案は4.2全sample・18行の成功/欠測なし/有効時間後だけ。今registry空、他IDを[]でfast確定しない（管理役採用・ADR0006） | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| Q-75 | tasks4.3・v2-reader Q-V2 | describe guardの範囲は何か | A：7つ全て／B：6つだけ | A。割当変化でも空集合を保てる | yes | A。元16宣言/17候補/18行と内側2mode・spy/env/cleanup/60sを保持し7describe全guard。実prefix前のlive基準と全raw多重度を独立照合する（管理役採用・ADR0006） | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| Q-76 | tasks4.3・v2-reader Q-V3 | 非literal3row eachで閾値が混在した場合 | A：file未登録未達/追加設計／B：そのIDだけfast | A。対応しない形の行を成功扱いしない | yes | A。関数式/呼出しを含む3行表は2.7行登録の対象外。混在・失敗/欠測ならfile全体未登録未達、原each/内側2modeを変えず追加設計へ戻す（管理役採用・ADR0006） | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| Q-77 | tasks2.8/4.3・v2-reader Q-V4 | 必須包含へいつ追加するか | A：登録同commit／B：全収集だけ | A。登録後の欠測を独立に検出する | yes | A。2.8未実装19を基準とし、v2-readers登録と同commitで20へ。旧19順序/包含・追加file欠測negativeを保ち、全file/case/rawの採集を狭めない（管理役採用・ADR0006） | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| Q-78 | tasks4.5・v2-reader Q-V5 | 初回fixture費用が別fastへ移り10秒超ならどうするか | A：未達/設計へ戻す／B：割当を連続修正 | A。測定の受入を一度ずつ確かめる | yes | A。実3OS各3sampleで移動後の費用を残し、新10秒超は未達として設計へ戻す。beforeAll/cache/helper共有で隠さず、未検証の連続割当を完成にしない（管理役採用・ADR0006） | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| Q-79 | tasks2.10・PR253 Q-B1 | 規則の方式をどうするか | A：純粋な全構文許可／B′：既存拒否後に閉じたvitest規則／C：個別拒否追加 | B′。4正例と既存文言を保ち同族の値の流れを閉じる | yes | B′。R1〜R3を既存検査の後へ追加し、228期待と4件の受理を固定。修理は同253の新2.10未完へ、既存2.5完了を保持する（管理役採用・ADR0006） | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| Q-80 | REQ-347・PR253 Q-B2 | 仕様の明確化をどこへ書くか | A：SHALL+第12Scenario／B：SHALLだけ／C：文書だけ | A。原文11Scenarioを保ち検査の参照先を作る | yes | A。本文500文字以内の短SHALLと新ScenarioへR1〜R3/両入口/error前不変性を追記。元本文/11Scenario/Sourceはbyte保持しspec-only後に実装する（管理役採用・ADR0006） | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| Q-81 | tasks2.10・PR253 Q-B3 | vitestの許可名は何か | A：expectだけ／B：vi等も含む | A。既存正例に必要な集合へ閉じる | yes | A。ALLOWEDはexpectのみ。namespace/aliasの位置を閉じ、4件の非試験正例・相対helperと整形許容を保持する。拡張は別の仕様改訂（管理役採用・ADR0006） | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| Q-82 | tasks2.10・PR253 Q-B4 | 読み込み先をどう制限するか | A：vitest+相対非test module／B：nodeも許可／C：無制限 | A。createRequire等の別入口を閉じる | yes | A。R1でnode:module/vitest/*/@vitest/runner等を拒否。companion本体だけの静的検査/依存module・反射非検証/globals無効は技術限界として記し、不正受理の免除にしない（管理役採用・ADR0006） | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| Q-83 | tasks2.10・PR253 Q-B5 | native比較試験をどこで起動するか | A：scope内一回の集団実行／B：別試験 | A。正負対照を保ちながら起動費用をまとめる | yes | A。T1〜T5、同族負とnative original/fallback/objectCarrier/parameter/正例、偽reviewed red-green、228固定を受入とする。10秒超なら候補として残し隠さない（管理役採用・ADR0006） | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| Q-84 | tasks3.2/4.3・publication Q-P1 | 共有10行の閾値が混在したらどうするか | A：同part不可ならfile未登録未達／B：各行割当／C：最大で全slow | A。初回runの重複やfast行のslow移動を避ける | yes | A。各OSの行別max3sampleで全行同判定だけ採用。混在ならwhole file未登録未達/追加設計。F-Pと実変種の共有回数/元25行保持を別検証（管理役採用・ADR0006） | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| Q-85 | tasks3.2/4.3・publication Q-P2 | case IDをどう命名するか | A：診断名+lookup-results／B：別名対応表 | A。対応を直接照合できる | yes | 条件付きA。原本§3.1の18IDを元順で独立再照合。9宣言/10候補/25行→rowBinding3増/13候補は静的予測で、prefix前live baseline/AST/本文/selectorを実証してから登録（管理役採用・ADR0006） | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| Q-86 | tasks4.3・publication §3.3 | 非literal lookup8行が混在したらどうするか | A：whole IDとfile未登録未達／B：一括slow／C：未対応行を除外 | A。非literalは行登録の対象外でfastを隠さない | yes | A。lookup-results全8行の最大3sampleが全slow/全fastだけ採用し混在ならfile全体未登録未達。原本の確認表にQ-P3はなく、§3.3の採用条件を本行に記録（管理役採用・ADR0006） | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| Q-87 | tasks4.2/4.3・publication Q-P4 | Windows隔離をいつ解除するか | A：file全25行3sample成功／B：旧隔離記載表だけ成功 | A。file単位の隔離の根拠をそろえる | yes | A。同head各3PASS/欠測skipなし後だけ同commit解除/prefix/C/registry/診断対象更新。未達なら全OS未登録。他file失敗を含む4.2全体の受入は別に保持（管理役採用・ADR0006） | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| Q-88 | tasks4.4/5.6・publication Q-P5 | publication診断期待をどこへ置くか | A：固定topology+新code／B：旧codeだけ | A。再試行列と予備labelへの落下を検出する | yes | A。25labels+shared=26contexts、共有/10行/他7行/lookup8行のn列を固定。file単位区間/pid/workerで照合し同時刻曖昧拒否、runSequence/unexpectedLabel追加。producer/既存試験byte不変（管理役採用・ADR0006） | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| Q-89 | tasks3.2/4.3・publication Q-P6 | 実productionの変種をどう検査するか | A：専用treeでregistry一時変更／B：envで読取先差替え | A。不要な設定を追加しない | yes | A。専用実験treeのtracked registryだけ未commit一時変更、手順/rawはignoredへ保存し元bytes復元clean。現canonical/本PRは空、env overrideなし。全経路25raw/26context/cleanup残0は未実証（管理役採用・ADR0006） | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| Q-90 | tasks5.1・publication Q-P7 | 部分一致selectorで行欠測をどう受け入れるか | A：既知限界と全raw独立受入／B：表全体ID | 条件付きA。hashだけで各行保存を証明しない原則を守る | yes | A。影響SCNを全文再照合しdocs/PRへ記す。PRconfirmedは全row保存の根拠にせずmain/local全rawと全selectorを必須再受入。既知bad companion/失敗/欠測の免除や完成範囲縮小にしない（管理役採用・ADR0006） | 利用者（ADR 0006 の包括承認） | 2026-10-31 |

| Q-91 | tasks2.7・row追加Q-R1 | eachRowsのimport元をどう確定するか | A：file位置から正規相対pathの完全一致／B：basename一致 | A。別helperの全行重複を受理しない | yes | A。canonical helperへのposix相対specifierだけを受理し、fileの絶対path/..要素・別表記・query等は拒否する。attemptedは広く残して通常helperへの抜けを防ぐ。R1のみ先行可（管理役採用・ADR0006、c606） | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| Q-92 | tasks2.7・row追加Q-R2 | describe外側の祖先をどう扱うか | A：SourceFileまで閉じた連鎖／B：直近callbackだけ | A。loopによる追加登録を除く | yes | A。plain literal titleのdescribe/vitest named又は未解決global、callbackとelseなしhasAny guardだけをSourceFileまで認める。loop/他if/関数/偽describe等を拒否し旧正負期待を保つ。R2先行可（管理役採用・ADR0006、c606） | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| Q-93 | tasks2.7・row追加R3/Q-R3 | 空行とhelper実体の境界は何か | A：構文の限界明記／B：通常file非symlinkも検査 | A+B。非空契約と実物の裏付けを分ける | yes | A+B。空IDsはunsupportedRowForm、非空IDs+空表はrowIdsMismatchのまま。canonical helperへlstatの通常file/非symlink検査を独立追加し、構文だけで実体を証明しない。R3先行可（管理役採用・ADR0006、c606） | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| Q-94 | tasks2.7/4.3・row追加Q-R4 | has/hasAnyの束縛をどこで検査するか | A：Issueだけ／B：独立wiring検査／C：既存登録検査へ必須化 | B方向。旧fixtureを弱めず実sourceへ適用する | yes | Bの新checkPartitionWiring方針だけ採用。完全なheader/束縛/fixture契約は追加設計待ちで実装GOしない。C1の16行sourceとQ48/V2b境界を再確認し、2.7全体/4.3受入は未達のまま（管理役採用・ADR0006、c606） | 利用者（ADR 0006 の包括承認） | 2026-10-31 |

| Q-95 | tasks2.10・module Q-M1 | helperに拡張子を必須にするか | A：明示8拡張子／B：拡張子なしも許す | A。別testへの解決を曖昧にしない | yes | A。閉じた相対path grammarと.js/.ts/.mjs/.mts/.cjs/.cts/.jsx/.tsxだけを認め、query/fragment/percent等と最終要素.test./.spec.を拒否。提案regexの広い拡張子で列挙を広げない（管理役採用・ADR0006、d466） | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| Q-96 | tasks2.10・module Q-M2 | symlink/依存module中身をどう扱うか | A：既存の静的技術限界を記す／B：存在検査で保証する | A。構文検査以上の意味証明を装わない | yes | A。依存moduleとsymlinkの解決先は既存の静的技術限界としてdocs/dev/ci.mdのT5へ記す。既知query/fragment反例やbad受理の免除、完成範囲縮小には使わない（管理役採用・ADR0006、d466） | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| Q-97 | tasks2.10・module Q-M3 | import.metaをどこまで拒否するか | A：全面拒否／B：globだけ拒否 | A。閉じた構文を維持する | yes | A。import.meta参照を全面拒否し、direct calleeがIdentifier requireの呼出も拒否。追加違反は既存の読込先固定文言、元拒否順/文言・R2/R3は保持。native未観測形は理論反例と区別（管理役採用・ADR0006、d466） | 利用者（ADR 0006 の包括承認） | 2026-10-31 |

| Q-98 | PR184・253・利用者Q-S1/S2 | 未完成コードをどの枝で統合するか | A：main基点の統合枝／B：noneでmainへ部分merge | A。文書限定noneの決定を守る | yes | A。change/split-slow-ci-checksをmain248cから作り、採用計画だけ移植。実装taskは受入まで未完。部分PRを同枝へ向け、最終main受入は全done・必須CI・独立レビューを満たす（Issue121 comment6543715081） | 利用者（ADR 0006 の包括承認） | 2026-10-31 |

| Q-99 | task2.7・N3 else | 原設計の予測診断を訂正するか | A：元guardOfから訂正／B：予測を維持 | A。元else非guard規則から独立に導ける | yes | A。Opus5f83の訂正を採用。elseはguardMismatchでなくunguardedDescribe。旧321回帰・元335行・guardOf/checkRegistrationは不変、修理前RED[]/[]を保全し、新試験は完全一致と正負対照を増やす | 利用者（ADR 0006 の包括承認） | 2026-10-31 |
| Q-100 | task2.7・N3 guardOf | 元guardOfへelse受理を追加するか | A：変更しない／B：elseを認める | A。既存else試験と閉じた祖先規則を保つ | yes | A。元guardOfとcheckRegistrationを変更しない。予測表だけの訂正で、新規else2形のunsupported拒否とrowBindingゼロ・else除去の正常対照を検査。元の期待や設定を緩めない | 利用者（ADR 0006 の包括承認） | 2026-10-31 |

## 仮定

| ID | 関連 | 仮定の内容 | 理由 | 承認 | 承認者 | 承認日 |
|---|---|---|---|---|---|---|
| A-01 | tasks2.5・cd REGISTRY-INVENTORY | 995eのrunでAST60宣言とscannerの有効60候補が一致する | OpusはV0の位置から推定し未実測。既存scannerを変更せず、最初のscope実測で違えば設計へ戻す | 条件付き承認 | 管理役 | 2026-10-31 |
| A-02 | tasks2.9・orphans helper | product srcのtransitiveなVitest依存の不存在は既存依存規則に頼る | module1階層の静的検査は意味の無条件証明ではない。直接Vitest/不明import等は拒否し、既存依存規則と実装前の独立照合を前提に限る | 条件付き承認 | 管理役 | 2026-10-31 |

管理役が確認する実装上の仮定は上表で管理し、利用者本人の新しいレビューとはしない。当初未設計10fileのうち残9file、実cleanup/watch、診断吸収先/E3との統合境界確定後の同head測定は未完了taskとして残す。必要な判断は管理役が元資料とおすすめ理由を確認して記録し、ゲート前に解消する。

## 独立実装の依存順

管理役がC1受領後、利用者の独立並行指定に基づきC2〜C5の先行を指示した。旧tasks 3.1/3.2/3.3/4.1は新2.1/2.2/2.3と4.3/2.4へ対応する。旧2.1〜2.3は新3.1〜3.3へ移した。全受入・179最終統合・残10file設計・fresh測定・人ruleset操作は保持し、規則やゲートを変更しない。未測定のcase割当とcase本体分割は先行しない。

2026-10-31 JST、管理役は独立Opus設計92ea61a2のおすすめAを採用した。旧tasks5.3〜5.5は原文・番号・順序・担当・証拠先を変えず、tasks.md「完了ゲート後の必須受入」へ移した。実装15タスクと必須受入3件で全18件の意図を保持し、ゲート後の出来事をゲートの前提へ含める循環を除いた。既存archiveの非チェック形式と同じ計画の整合であり、規則・条件の緩和や完了の宣言ではない。

## 2026-10-31の現行依存とレビュー規則

利用者が再編計画に合わせると回答し、管理役がPR184の計画整合を委任した。上記の旧「179最終統合」は当時の経緯であり、Q-17により凍結head `3571c208` の診断をstabilize-cross-os-testsへ引き継ぐ経路へ変更した。吸収先/C001/E3との重複・統合順序と最新mainでのcase/assert/timeout/companion対応の確認はtasks3.1の未完了条件として保持する。

5.3はQ-18により改訂ADR 0006のレビュー規則へ合わせた。旧5.3〜5.5移動時の番号・順序と、実装15タスク＋必須受入3件の範囲は維持する。Node20削除とslow分離の同一PR、残10file設計・actualcase/fastの3OS測定、REQ-297、他4required保持と人のnode20-only操作、マージとsync/archiveは省かない。今回の計画更新ではmain統合・case分割・測定・実装・受入を実施済みにしない。

## 2026-10-31 登録構造・監査の追加採用

管理役はa3bf248bのin-place案を、V0成立と995e対象のcd321d46の監査/独立inventory方針で具体化した。Q-R2 B・Q-R3 B、Q-A1〜Q-A6 Aを採用した。出典のモデルはtrace未読と明記しており、管理役がQ-19〜Q-30へ対応付けた。モデルがtraceや正当な同名17行のraw実データを読んだとは記録しない。

8dのV0はLinux/Node24.21.0/Vitest5.0.5の隔離fixtureであり、file/fullName、timeout80ms（実測83.8045ms、設定なし5011.0856ms）、混在/全fast/全slow各7件の一度だけ登録、既定module隔離、空describe guard、元60block本文一致を確認した。8dの旧9sampleは7成功/Windows2失敗、Node patch混在・自己PID/hostname差があり4.2未受入。run12行のuniform fastはこの旧観測だけの確認である。PR220はmainに受入済みである。関連10file108試験はb98取込head bc8ba80で成功し、995eはmain acce34fb（PR228）を取り込んだ文書変更のheadで、検査対象11sourceがbc8ba80とbyte同一であることを管理役が確認した。これは統合の確認であり、実装後の全件/3OS/58selector監査の成功へ流用しない。

追加2.5は独立な監査/宣言inventory先行で、残9fileの個別設計3.2と並行できる。REQ-347差分・本trace・scope・spec-only成功を実装前の条件とし、実registryと元本体は変えない。4.3の本体分割は3.1〜3.3・2.5・4.2の受入後に行う。元15番号/6完了印と必須受入3件を保持し、追加後は6/16＋必須受入3件未達とする。

複数blockの一部欠測はblock集合hashで検知するが、同一it.eachのparameter行欠測まで検知したとは記録しない。元全parameterと正当な同名17行を含むraw全caseの独立多重集合比較は4.3/5.1に残す。旧レビュー表/旧形式行を勝手に移行・昇格させず、REQ-189/190/346/347の原契約、REQ-144、REQ-297、全診断・coverage・local/release全件・人のnode20-only ruleset操作・同PRマージとsync/archiveを保持する。

## 2026-10-31 受入済みmainの移動後baseline

main d799ea4fを取込済みとし、995eのrun60宣言/62raw候補/70展開行は当時の記録として残す。現行run58宣言/60raw候補/68行と、PR231がREQ-105の2宣言を移したrun-timeout2宣言/3raw候補/2行を、2.5の元scopeとして合わせて検査する。raw候補計63は移動先importの非call1が増えた結果であり、有効宣言計60/展開計70と区別する。

native比較で旧run60＝現run58＋run-timeout2、旧external-budget11＝現8＋external-budget-deadline3の本文block文字列多重集合がbyte同一だった。現行run/timeoutはASTとscannerの有効宣言位置・本文範囲も一致した。旧run58selector＝現run56＋timeout2で、file以外のレビュー行ID/contains/hashScope/sha256など全fieldも一致した。別担当が受入済みmainで行った移動の保持証拠であり、assert/timeoutの弱化や新しい機能追加ではない。

A-01の995eでの前提は履歴として残し、現行2fileを合わせたAST/scanner/展開数をnativeで再照合した。独立inventory全error codeや実行後のraw全case受入は2.5/4.3/5.1に残る。非literalなeach表はprivateな開発用診断dynamicRowsで展開未確定を示し、宣言を保持する方針を管理役が採用した。dynamicTitleとは区別し、新しいREQや製品仕様は追加しない。

REQ-347差分、監査source、実registryは変更しない。6/16と必須受入3件未達、4.2/4.5の別測定と全受入条件は維持する。

## 2026-10-31 G-B設計の採用

Opus5753a1af（head3d664093）の全文を管理役が読み、Q-G1=C、Q-G2=A、Q-G3=条件付きA/失敗時BをQ-31〜Q-33へ記録した。元の規則の変更や新しい人のレビューではない。モデルのADR本文未読を保持し、管理役がADR0006の採用範囲を照合した。通常helperの分類を2.5へ加える前に仕様ゲートを再実行し、実registry/隔離/元caseをまだ変更しない。

G-Bのguards候補数44はモデルの未実測値であり、管理役と実装担当が3d664の同じsourceで52を確認した（有効37、import1、propertyKey8、helper6、展開40）。scopeから候補を除外せず、static見積の漏れを訂正した。元case/Source/本文は変更していない。

## 2026-10-31 Git読取集約の受入後baseline

2026-10-31、受入済みmain d04e212f（PR235）を取り込んだhead 22be0369を照合した。3d664093のguards37宣言は本文の文字列多重集合をbyte同一で保持し、追加はrunner-git-reads-batchのREQ-348に対応する通常itの2宣言だけだった。現行guardsは39宣言/54候補/42展開行で、import1・propertyKey8・通常helper6は変わらない。旧37/52/40は当時の基準として残し、live inventoryでは現行の正確な数と追加2件の正確な試験名を検査する。run58/60/68、run-timeout2/3/2、run-no-change12/13/25と全既存assertは保持する。実registry・元本文・製品コード・Requirementは変更しない。

出典は受入済みPR235のdesign.md・specs/run-guards/spec.md（Source: REQ-348）と、3d664093から22be0369への独立AST/本文多重集合比較である。追加2宣言はエンジン前後の読取回数と、完了ゲート前後・直しの前のHEAD読直しを確かめる。現行guardsは受入済みmainとbyte同一で、inventoryのerrorsは空だった。管理役が既存2.5の基準照合として採用した範囲であり、新しいRequirementやcase個別設計を追加しない。7/16と必須受入3件未達を保持し、最新全件測定や最終受入の証拠へ流用しない。


## 2026-10-31 C1設計・V1・独立2.6の採用

管理役は`.loomake/scratchpad/speed-deadline-design-adoption/result.md`を全文読み、Opus C1のQ-C1〜Q-C4のおすすめAをQ-34〜Q-37へ対応付けた。モデルのactual Opus5-5・read-only・拒否0、AGENTS/ADR/workflowの3規約Readを確認した。モデルはtraceを一部だけ読み、全traceへの対応付けは管理役が行った。判断はADR 0006の包括承認に基づく採用であり、新しい人のレビューや規則の変更ではない。private factory分類に新しい製品REQは設けず、REQ-347差分と元Scenario/Sourceは変えない。

C1のengine-long-deadline・scenario-timeout-evidence・signal-during-sync・run-timeoutはin-place prefixと5describe guard・4companionを採用する。モデル静的値16宣言/22候補/19行は未実測の履歴として残す。別Codexの独立native照合（`.loomake/scratchpad/speed-factory-measure-impl/c1-baseline-probe.json`）は25候補（5+4+13+3）と元16有効blockのbyte保持を確認し、scenarioのpropertyKey test 1件とsignalの同2件の見積もり漏れを管理役が訂正として採用した。factory分類後の宣言16/行19は2.6で別に確認する。signalのas constを含むas/satisfies/括弧/!の型だけを示すwrapperを外しspreadなしliteral配列のみ数える最小対応を2.6へ含め、変数/spread表はdynamicRowsを保ち、コード実行/値評価はしない。違えばsource保持証拠と設計を再照合し、期待値を実装へ合わせて変えない。signalの元factoryと通常const fixture helper・namespace/test alias拒否は保持する。C1/G-Bのhas内includeCaseは元source path literalを直接使い、モデル例のFILE参照に合わせてincludeCaseTarget規則を緩めない。2.6では実registry・元本文・scanner/partition/Vitest規則とOS割当を変更しない。

管理役は`speed-mock-v1-probe/REPORT.md`の最終native実行を限定採用した（同scratchpad配下）。Linux/実Node24.21.0/Vitest5.0.5の合成fixtureで全fast/混在/全slow各5行と分離2＋3行、mockを外した対照で未変更monitor assertの失敗、timer/listener復元、全45 PID不在を観測した。初回negativeのfilter不一致4skipと探索時bundle一時file/HOME上書きの履歴を保持し、最終nativeでの修正と区別する。productionの実case・3OS・coverage・正式OS割当と2.6完了は未検証である。

`speed-integration-boundary-audit/report.md`のPR190吸収とsource保持を採用するが、A1の診断後継設計は残る。旧profile-publication-retryは190 A-07で採られず現行mainに存在しない。後継はWindows全fileのunsharded隔離診断である。隔離解除後のmain push/schedule・独立3sample・元case/companion・失敗後保存/privacy/時計を設計するまで3.1を未チェックとし、4.4の診断2本分の受入意図を縮めず、旧179workflowを復活させない。監査時点で未マージだったPR236は、その後main7099でfixture/quality receiptを受入済みである。現行sourceの保持と最新全件測定を別に再確認し、性能受入済みへ読み替えない。

管理役は後続C2設計Q-D1 Aの型だけのwrapper対応を2.6へ採用し、Q-D4 Bの旧15file固定は既採用C1 Q-C4 Aと衝突するため採らなかった。旧15fileの順序・包含と新2file欠測negativeのred/greenを保つ。C2の残る個別設計の採用は後続へ分離し、別Codexの`speed-factory-measure-impl/c2-baseline-probe.json`（同scratchpad配下）は3宣言/4候補/元3本文保持を確認した。管理役がC2 live inventoryを2.6へ追加し、wrapper対応後の6行を別確認とした。C2の全個別設計や実登録/OS割当の受入とはしない。

元16タスクのID・完了印7件と必須受入3件を保ち、未完了2.6を追加した現在の進捗は7/17＋必須受入3件未達である。4.3は3.1〜3.3・2.5・2.6・4.2とPRのslow除外結線の受入後とする。4.2の元case/新fastと4.5の最新実装後の各9sample、raw全case/parameter/正当な同名行の多重集合、58selector、REQ-297、coverage、local/release全件、人のruleset操作と同PRのマージ/sync/archiveを保持する。今回の計画更新と仕様ゲートはこれらの完了を表さない。


## 2026-10-31 段階的PR・行登録・後継診断の採用

管理役は共有分割設計とIssue #239〜#242を最新main/担当へ照合し、Q-38〜Q-44を採用した。分割設計の対象3d664の2.5未実装/旧15fileは履歴として残し、282bの2.5/2.6実装済み・17file包含に合わせた。独立checkerだけの未push準備は#240へ吸収し、監査と同一PRという2.5の条件を保つ。元の1-1完成単位はNode20削除と全PRslow不実施を同時に有効にする最後184に残す。部分PRはchange全体のdoneや完成を宣言しない。

行設計58b1ebb7とA1-route effd2731は管理役が全文を読み、actual Opus5-5/read-only/拒否0/3規約Readを確認した。設計用tree内の各`.loomake/claude/<session>/result.md`が全文原本で、要点と未確認はdesignに記録した。rowのtraceは部分読取、routeのproducer試験/checker本文は全文未読という限界を保持し、モデルの読了を広げない。Q-45〜Q-52は2.7のV2先行とliteral行登録/独立oracle、Q-53〜Q-56は既存quality-quarantineの独立固定診断経路、Q-57は登録前のprofiler結線順である。管理役はおすすめの採用として記録し、利用者本人の新しい資料レビューとは扱わない。

Q-D4の旧15file固定は既採用Q-C4 Aと衝突するため不採用、旧15順序+新2各欠測negativeを保つ17fileを維持する。C2の未完了個別設計/実登録とA1-carrier/追加fileの残設計は未受入である。V2はnative手書き基準が違えば期待を変えず設計へ戻し、未知の表やruntime名は未登録未達に保つ。

最新282bの全9sampleは7成功/Windows2失敗。構造上の155file・17必須・全raw・同名多重度の保持と、実試験の成功/性能を分ける。AI Tempとdeadline準備/pushの失敗を保存し、再実行成功やQ-41のhead同一性で受入へ変えない。4.2/実OS割当/3.1〜3.3は未完了。新たなschema2file・orphans・v2-readersの10秒超も残設計対象から落とさない。

現在8完了を保持し、新2.7を未完了で加え8/18とする。元5.3〜5.5にマージ後初回mainpushの実診断5.6を加え、18タスク+必須受入4件の全22件を追跡する。旧進捗と元受入は履歴として残し、5.6前にsync/archiveやchange完成へ進めない。要件台帳・全Requirement/Scenario/Source・旧選択肢/回答・clock/timeout/coverage/全case/人のruleset操作は保持し、この計画更新で実装や受入を完了にしない。

V2初回のnative基準は15raw行の試験自体が成功したが、R4の手書き期待名と実際のformatter結果が1件異なった。管理役は未変更の期待値を保持して停止し追加設計へ戻した。V2成功・2.7完了とは扱わず、後続設計の受入まで正式実装を保留する。orphansのimportされた*Test helperの誤認候補も見つかり、未検証のcountを固定せず3.2で個別設計とinventoryの適用範囲を確認する。


## 2026-10-31 V2b・schema2file・A2の追加採用

管理役と計画担当が3設計を全文読み、actual Opus5-5・ok/exit0/read-only/拒否0と、規約3本の実Readイベントを確認した。全文とmanifestは同worktreeの`.loomake/scratchpad/speed-plan-reconcile-282/followup66/`に保存した（row-v2b/schema-two/a2-guardsの各-result.mdと-manifest.json、索引model-proof.json）。Q-58〜Q-66は管理役がADR0006のおすすめ回答として採用したもので、新しい人の資料レビューや規則変更ではない。

V2のR4旧期待はVitest一次sourceで導出誤りと確認し、旧期待/raw/STOPを保持してV2bを新規に行う。%%を既存scanner制限として注記し行登録制限は増やさない。元7call保持と未実行R4bの事前16行予測を独立に照合する。その後管理役と計画担当がV2b最終報告を全文読み、Linux合成の技術前提として限定採用した。16process（8成功/8期待失敗）・208比較差分0、実5.0.5/4chunk一致・元7callと旧37file保持を確認したが、2.7のchecker/oracle/実production/3OS/coverage/実期限の受入は未達のまま。productionの期待値・assert・clockを変更する許可にはしない。

schema2fileは既存in-place方式と3行companion、各1宣言/1行と元callback/全15trialを保持する個別設計を採用した。未完了2.8で19file必須包含と各欠落negative・接頭辞前live基準を追加する。旧17の順序・包含と2.6完了は保つ。282bの155file/必須17/7成功2失敗という測定を新19file検査や4.2成功へ変えない。schemaモデルの7/18は旧進捗であり現在数には使わない。

A2の14宣言とguards追加2件は個別設計を採用し、pr/guards解除はfile全行Windows3sampleのpassed/欠測skipなしへ強化した。1caseでも未判定ならfile全体未登録、唯一live Source根拠をLinuxslowへ移す割当も未達とし新fastを独立設計する。F-A2は未実施、selector12件はGrepのみ・旧形式未全文検証、trace/partition-integration/quarantineの本文未読という限界を保持して実装前の確認に残す。モデルの結線前登録不可は古い単一PR前提なので採らず、後のQ-38どおり中間PR全件→最後184でPRslow除外とNode20を同時有効にする。

2.7追加時点8/18+4必須未達を履歴として残し、現在は新2.8未完了を加え8/19+4必須未達（全23件）である。要件台帳・全Requirement/Scenario/Source・旧Qと完了印を保持し、実registry/本体/設定/製品コードをこの計画更新で変えない。2.8の実装は252/253先行基盤の受入後でよく、実OS割当・3OS/全case・coverage/唯一Source・後継診断5.6・人の規則操作/マージ/sync/archiveの未受入は残す。

V2bの結果の保存先は同worktreeの`.loomake/scratchpad/speed-plan-reconcile-282/followup66/REPORT.v2b.md`。原本のOpusが「authorized」とした表現は操作許可の根拠にせず、Opusによる設計の訂正と管理役のADR0006内での限定採用を区別する。タスクの完了印は増やさない。


## 2026-10-31 orphans・v2-readersの条件付き採用

両原本とmanifestは`.loomake/scratchpad/speed-plan-reconcile-282/followup78/`に保存し、管理役・計画担当が全文読了、actual5-5/ok/exit0/read-only/拒否0と規約3本のReadイベントを確認した。Q-67〜Q-78はADR0006に従うおすすめの条件付き採用で、新しい人のレビューや規則変更ではない。設計の詳細・全ID・残る未読/推定は同folderのorphans-result.md/v2-readers-result.mdとdesignの対応節を参照する。

orphansはimport元の限定static検査とreadModuleのpath/実path/isFile/構文境界を2.9で先行し、transitive非検査をA-02に残す。元33宣言/72候補/34行・6imports+33helperの予測は実装前独立実証が必要で、現checkerの偽66/67を既存期待へ固定しない。実source・registryを変えず、6describeと提示33IDの原順序再照合、登録後の起動費用移動と新10秒超は未達/設計へ戻す条件を保つ。

v2-readersの2Windows ID案は4.2全受入後に限る。7describe全guard、元16/17/18と非literal3row/内側2modeを保持し、行閾値混在ならfile未登録未達を残す。必須包含は現在実装済み17、未完2.8で19、v2-readers登録同commit後20と時点を区別する。orphansは19へ追加せず登録source/Cの欠測を独立比較で検出する。全採集/rawと失敗原本は常に保持する。

現在は8/20+ゲート後4必須未達（全24件）、Q78/A02で、2.7/2.8/2.9を未チェックとする。元Q66・19タスクのID/完了印・全Requirement/Scenario/Sourceは保持し、4.3の現在前提に2.9を加える。PR253の重大1/default initializer未解決・最終Opus0回・独立調査中、PR252の重大0/軽微1Issue254・CI未完という先行受入の境界を保持する。いずれもこの計画更新で受入済みへ変更せず、人の規則操作・3OS/全case/clock/coverage/唯一Source・診断5.6・merge/sync/archiveは未完了のままである。


## 2026-10-31 PR253独立調査・修理設計の採用

原本・第一段階所見全文・manifest・規約3本Readと独立所見先行の順序証拠は`.loomake/scratchpad/speed-plan-reconcile-282/followup83/`に保存した。管理役と計画担当が両段階を全文読了し、actual5-5/ok/exit0/read-only/MCPなし/拒否0を確認した。1始まりevent186（0始まり185）の独立所見がevent187（同186）のdeferred見解Readより先である。Q-79〜Q-83はADR0006に基づく管理役のおすすめ採用で、モデルによる権限承認ではない。設計とT1〜T5の全受入はdesignのPR253節を参照する。

REQ-347の元本文・Sourceと全11Scenarioをbyte保持して短SHALLと新第12Scenarioを先行追記し、仕様ゲート後に同じPR253で重大修理2.10を行う。既存2.5の完了印・228期待/4正例・旧拒否文言・scanner/blockDigest/migrateReviewsの元契約・全raw/旧レビュー表/ledgerとregistry空は保持する。companion本体だけの静的検査、依存module中身と反射の非検証・globals無効は既存検査の技術限界であり、不正受理の免除/完成範囲縮小や反射の安全宣言ではない。objectCarrier/parameterのnativeと両入口・偽reviewedのredは未観測として残し、受入へ補わない。

2.9追加時点の8/20+4未達（全24件）とQ78を履歴に残し、現在は新2.10未完を加え8/21+4必須未達（全25件）、Q83とする。全4.3の現在前提へ2.10を加え、旧Q/選択肢/Source/Scenarioと全task範囲を減らさない。PR253は重大1未修理・独立調査/設計採用済み・独立Opus最終0回で、PR252は独立Opus重大0/軽微1Issue254・Ubuntu coverage待ちである。実装は別の新Codexへ渡し、計画更新をmain受入や1-1完成とは扱わない。


## 2026-10-31 publication-carrier設計の採用

bfc72c35の原本全文とmanifest/規約Read証拠を`.loomake/scratchpad/speed-plan-reconcile-282/followup90/`へ保存し、管理役と計画担当が全文読了/actual5-5/ok/exit0/read-only/拒否0を確認した。Q-84〜Q-90はADR0006のお勧め採用で、原本のQ-P3欠番は§3.3のlookup条件として区別した。全設計/18ID/PC1〜8と未読資料・未実測の限界は原本とdesignのpublication節を参照する。モデルがrow原本/proposal/trace全文を読んだとは扱わない。

共有10行とlookup8行は各OSのmax3sampleが一様でなければfile全体未登録未達とし、一括slowや[]で救済しない。18ID/9宣言10候補25行・登録後rowBinding3増/13候補の静的予測はprefix前の独立AST/source/checkerで実証する。producer/既存診断試験byte不変、25rawと26context/n列・file区間/pid/worker相関と曖昧拒否、新code、F-P/実variant、Windows全行3PASSと他fileを含む4.2、main/local全raw/全selectorの受入を既存taskへ具体化した。

専用実験treeで変更するregistryはtracked tests/test-partition.jsonである。管理役の当初の『ignored一時registry』という表現は、実loaderの固定pathとgit ls-filesに照らして訂正し、元設計どおり未commit一時変更→元bytes復元clean、手順/rawだけignored所有folderへ保存とした。現canonical/本PRの実registryは空のまま、env overrideを追加せず、実variantは未実証とする。空registry前提のintegrationは独立expected source選択の設計を先行し旧14試験/経路表を保ち、期待を実装へ合わせない。

新taskは追加せず8/21+必須4未達（全25件）、Q90。元Requirement全文/Source/12Scenario、Q83以前、21taskのIDと8完了印・全受入範囲を保持する。Q-P7はblockhashだけの行欠測限界を記録し、PRconfirmedを全row保存の根拠にせずmain/local全rawと全selectorを必須再受入する条件で採用した。既知bad companion/失敗/欠測を許す免除や完成範囲縮小ではなく、3.1/3.2/4.3/4.4/5.1/5.6と重大修理2.10・人ruleset・merge/sync/archiveは未完了のままである。

## 2026-10-31 row境界の部分採用（Q-91〜Q-94）

2026-10-31 21:51 JSTに管理役がADR0006に基づいてc606のQ-R1 A/Q-R2 A/Q-R3 A+BとR3非空制約を採用し、Q-R4はB方向だけを採用した。原本全文・manifest・3規約Read（0始まり6/7/10）・公開所見event87がdeferred Read88より先の証拠を`.loomake/scratchpad/row-boundary-plan-update/`に保存した。これは利用者本人の個別レビューやモデルによる権限承認ではない。R1〜R3の部分修理だけをspec-only成功後に進め、R4/C1の詳細と実装・一般oracleは追加設計を待つ。

旧採用節の「現在」やPR252のcoverage待ちは当時の履歴であり、本節の現在状態を優先する。PR252はmain248c89b6へ受入済み、PR253はquery/fragment付き別試験読込の実反例が残り未受入である。row候補7ed774d3はmain248を取込済みだが、nativeのwrong helper 4対2行・loop内describe 4対静的2行・空IDsの収集エラーが残り、321回帰成功を重大ゼロへ読み替えない。旧a23fから7edへの対象source同一性確認、has偽束縛のnative対照、C1の生成sourceとQ48/V2b境界の照合は別担当の確認待ちである。

元Q90までの回答行、全Requirement/Source/12Scenario、21taskと8完了印は保持し、新taskを足さず8/21+必須4件未達（全25件）のままとする。2.7全体/4.3はR4と正規source/native対応の追加設計・検証を必須に保ち、5.1の一般runtime oracleは独立点検の重大3件を解消しておらず未採用である。PR253の既知反例はrow修理とは別scopeで、完成範囲の縮小や既知bad受理の免除に使わない。

## 2026-10-31 module読込契約の補足（Q-95〜Q-97）

2026-10-31 21:53 JSTに管理役がd466のQ-M1 A/Q-M2 A/Q-M3 AをADR0006に基づいて採用した。原本全文・manifest・3規約Read（0始まり5/7/9）と公開所見106→deferred Read107の証拠は`.loomake/scratchpad/row-boundary-plan-update/module-contract/`に保存した。元短SHALL/Source/元11Scenarioをbyte保持し、第12Scenarioの相対module原子句だけを閉じたpath grammarへ置換してimport.meta/direct require拒否を追記した。他のR2/R3/THEN・拒否順/固定文言・両入口/out前error/rawとledger不変は保つ。

fragmentはqueryとともにnativeで別test行がpassedになった実観測済みで、先行見解の未検証表記は当時の履歴である。percentはnative module-not-found/行0で宣言成功未確認、拡張子なし/test.mts/spec.ts/大小文字/import.meta.glob/requireは未実行の理論反例と区別する。提案regexの[cm]?[jt]sx?は列挙8種以外も許すため正とせず、本文の8種だけを実装と試験の基準にする。T5文書が無いとのモデル発言はGrep不足で、既存docs/dev/ci.mdへ追記し別文書を新設しない。

spec-only成功後だけ同PR253の2.10修理を行う。既存269件・旧拒否文言・原raw/ledgerを保ち、query偽reviewedのRED→GREENとquery/fragmentの新native対照を受け入れるまで未チェックとする。Q91〜94のrow部分修理とR4詳細/C1の追加設計、一般oracle重大3の未採用状態、8/21+必須4未達は変えない。

## 統合枝へ計画を移植した時点（Q-98）

利用者のQ-S1/S2決定はIssue121コメント6543715081を参照する。統合枝はmain248c89b6から作成し、元枝d9647be5の正式計画7ファイルを移植した。差分仕様2ファイルの本文・Source・Scenarioと元21タスクの受入範囲を保持した。元枝の8完了印のうち実装2.1〜2.6は履歴とし、この枝への受入までは未完了へ戻した。元枝での試験成功や未達の根拠は取り消さない。原本と経過の「現在」は各記録時点を指す。

PR252は既にmainへ取り込まれた履歴で、今回あらためて受入済みにしたものではない。PR253修理は別担当で未受入。Node20削除・実registry・全PRslow不実施の有効化と最終main受入は後段に残し、計画移植を1-1完成とは扱わない。実観測・全case保存・coverage・ruleset人操作・sync/archiveの条件は削らない。

## N3 else診断の予測表訂正（Q-99・Q-100）

Opus5f83ae6cの設計全文を管理役が読み、元guardOfのelse除外と既存test-declarationsのelse試験から、unguardedDescribeが導かれることを確認した。guardOf/checkRegistration本文は元7edと修理候補でそれぞれ844/3256bytes同一である。修理前はelse行が[]/[]で通るREDだった。候補はunsupportedRowFormで拒否し、予測guardMismatchとの違いだけが残っていた。元の321回帰と全既存期待を変えず、elseを共通予測表から分け、式/Block形の完全一致・rowBindingゼロ・診断文言・else除去の正対照を追加する。新しい結果に合わせる救済ではなく、元の拒否規則による予測表の訂正である。

送信依頼の抜粋は候補snapshotを固定headと誤表示していた。元依頼は変更せず、専用row-n3-designツリーのEXCERPT-CORRECTION.mdとactual-head-source.mjsで訂正した。モデルは元headと候補を読み比べ、本文の不変を確認した。実モデル5-5/ok/ReadOnly/拒否0だが、原OpusのRead前に公開された文章は作業予告だけで、具体的な独立所見の事前保存を確認できない。3規約の全Readも確認できないため、独立調査工程の成功とは数えず、設計訂正の技術所見として採用する。規約と採用範囲は管理役が照合した。

R4/C1・一般oracle・実登録・OS割当は未設計/未達のまま。PR253は追加require包み型から実nativeの偽reviewedが実証され、最終Opusを起動せず別の設計確認へ戻す。N3の訂正を、PR253や2.7全体・main受入の完了へ読み替えない。
