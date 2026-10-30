# Trace: split-slow-ci-checks

## 入力文書

| 文書 | 版 | 日付 |
|---|---|---|
| 利用者delivery指示1-1 | Node20削除・10秒超slow分離・1 PR | 2026-10-30 |
| 現行monorepo/domain-mutation-check/ci-deadline-clock-alignment | main085a82686dc1c14506fbdbad88b5b9b3961f522e | 2026-10-30 |
| 管理役ci-manager-decisions.md | Q01〜Q10の採用 | 2026-10-30 |
| Opus62aba81d-e041-42f8-b68d-df78bf959be6 | main085a・claude-opus-5-5・ok:true・拒否0 | 2026-10-30 |
| 管理役ci-followup-adoption.mdとrelease適用範囲 | Q-N1〜Q-N5と診断2本のmanual撤去の限定 | 2026-10-30 |

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

反映済は差分仕様への反映であり、実装や受入の完了ではない。REQ-270/273が複数契約を持つことを理由に他の契約を削らない。新しいREQの採番・予約は行わない。

## 確認事項

全項目は管理役がADR0006に基づき回答した。回答者は包括承認の表記であり、利用者本人が各資料をレビューしたという意味ではない。選択肢とおすすめの採用理由を残す。旧Q番号Q01〜Q10は下表Q-01〜Q-10、Q-N1〜Q-N5はQ-11〜Q-15に対応する。

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

## 仮定

| ID | 関連 | 仮定の内容 | 理由 | 承認 | 承認者 | 承認日 |
|---|---|---|---|---|---|---|

新しい仮定は置いていない。未設計10file、実cleanup/watch、179/E3統合後の同head測定は未完了taskとして残す。必要な判断は管理役が元資料とおすすめ理由を確認して記録し、ゲート前に解消する。

## 独立実装の依存順

管理役がC1受領後、利用者の独立並行指定に基づきC2〜C5の先行を指示した。旧tasks 3.1/3.2/3.3/4.1は新2.1/2.2/2.3と4.3/2.4へ対応する。旧2.1〜2.3は新3.1〜3.3へ移した。全受入・179最終統合・残10file設計・fresh測定・人ruleset操作は保持し、規則やゲートを変更しない。未測定のcase割当とcase本体分割は先行しない。

2026-10-31 JST、管理役は独立Opus設計92ea61a2のおすすめAを採用した。旧tasks5.3〜5.5は原文・番号・順序・担当・証拠先を変えず、tasks.md「完了ゲート後の必須受入」へ移した。実装15タスクと必須受入3件で全18件の意図を保持し、ゲート後の出来事をゲートの前提へ含める循環を除いた。既存archiveの非チェック形式と同じ計画の整合であり、規則・条件の緩和や完了の宣言ではない。
