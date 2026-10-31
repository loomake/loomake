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

原資料の全文・hashは専用treeの`.loomake/ci-formal-adoption/inputs/`と索引に保存した。Q01〜Q10の元おすすめはreadiness/manager-questions.json、採用回答はci-manager-decisions.md、Q-N1〜Q-N5の元案はOpus結果§7にある。旧資料の未採用という状態はその観測時点の記録であり、下表の管理役回答が今回の採用である。1 change/1 PRと配布第3枠は管理役が指定した。

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

Q-01〜Q-37の採用と条件は管理役がADR0006に基づき記録する。Q-19〜Q-24はR系と行閾値/宣言分類、Q-25〜Q-30はcd321d46のQ-A1〜Q-A6に対応する。未完了の個別設計・測定・実装は回答済みという理由で受入済みにしない。回答日・承認日は日本時間である。回答者は包括承認の表記であり、利用者本人が各資料をレビューしたという意味ではない。選択肢とおすすめの採用理由を残す。旧Q番号Q01〜Q10は下表Q-01〜Q-10、Q-N1〜Q-N5はQ-11〜Q-15に対応する。Q-01〜Q-16は当時の決定として残し、PR179先行受入と旧レビュー条件に関する現行の決定はQ-17・Q-18を優先する。

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

## 仮定

| ID | 関連 | 仮定の内容 | 理由 | 承認 | 承認者 | 承認日 |
|---|---|---|---|---|---|---|
| A-01 | tasks2.5・cd REGISTRY-INVENTORY | 995eのrunでAST60宣言とscannerの有効60候補が一致する | OpusはV0の位置から推定し未実測。既存scannerを変更せず、最初のscope実測で違えば設計へ戻す | 条件付き承認 | 管理役 | 2026-10-31 |

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
