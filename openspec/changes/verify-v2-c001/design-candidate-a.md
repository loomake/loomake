# 承認済み決定に基づくS1/S2の設計詳細

この文書は設計候補だけの先行更新である。承認済み方針と旧作業木での補足設計の履歴は保持し、規範specs・trace・tasks・design.mdへの反映は後段で行う。task 1.2とC001のDoDは未受入。参照元のproposal・design・tasks・traceに残る旧説明も後段で更新する。それまでは、現headの規範反映状態は参照元の記録に従い、旧作業木の承認・採用事実とは区別する。後段で反映する節への参照先は予定のためコード表記にしている。

## 位置づけと基準

R01/02/03/04/07/09/10は[先の7件の明示回答](https://github.com/loomake/loomake/pull/139#issuecomment-6510041693)でA、R05/06は[追加回答](https://github.com/loomake/loomake/pull/139#issuecomment-6511434324)でA、R08は同追加回答でBと承認された。10件の決定と規範への反映は旧60dc/bb88作業木に記録済みだが、この先行headの規範specs・traceへの移植は後段で行う。補足R11〜13の構造NA/scope/型付き観測・REQ205の採用条件も旧作業木で管理役が採用した技術的補足であり、このheadのtrace・designには未移植である。採用条件は後段でdesignの補足設計節（後段予定：`design.md#最終レビュー指摘に対する補足設計の採用`）へ反映し、過去10件の直接回答と区別する。localのOpenSpec CLI不在は理由付きNAとし、未実施をPASSと扱う不採用案は実装しない。製品・既存試験・設定は今回変更しない。S1の内部契約はtask 1.3で具体設計し、仕様ゲートと独立受入を経てS2へ進む。

計画branchの作成基準はmain `f397109`。今回の製品調査基準はmain `f4e3edb`で、同mainの製品ソースを調査した。#60は当時の未受入依存であったが、[PR140](https://github.com/loomake/loomake/pull/140)・[PR141](https://github.com/loomake/loomake/pull/141)で修正・仕様同期・archiveを受け入れ、2026-10-29T03:32:23Zにclose済みである。最新の仕様照合基準は通常mergeで取り込んだmain `d5aa30d7a9326be44ea4eac5145b5fa95529efce`。PR #155でCLI/URL両changeの同期/archiveも受入済みである。当初の反映基準はADR 0006を含むmain `e73fb3e`だった。現在は3製品PRと同期archive #168・表記整合 #166・依頼テンプレート #165を含むmain `5c71ae0584cabb9be18c15a6bb8cf9dfd4c0df17`で正本へ再整合した後、PR #169受入main `9a3fe04a89da68e67334a5b535bd5f967428a2b6`を通常統合している。方針回答は揃っているが、規範反映とS1の具体設計・独立受入、S2実装は別の作業として確認する。

根拠は固定要件7.3、既存REQ-310・313・314・319等と元のDoDである。新しいREQ IDを割り当てず、品質/CLIで使用済みのREQ-320〜325も再使用しない。source/metric・plan・producer mappingは承認済みR-C001-03 A、S1基準準備・private handoffは承認済みR-C001-04 Aであり、現行スキーマに実装済みとは扱わない。未実装の技術事項と過去10件の直接回答・補足R11〜13を区別する。

承認済みR01 Aのbare品質専用経路は架空のchange IDを補わず `change: null`、`scope: local` のcompleted/partial、verdictなしで表す。quality.yamlを新たに要求せず、設定済みの品質コマンドだけを実行する。change必須gateの未指定はusageのaborted/2として区別する。bareの明示local受理・明示ci拒否と不正scopeの扱いは、R01 Aだけによる決定ではなく、旧作業木で管理役が採用した補足R12による。採用事実と根拠を後段traceへ移す。明示ci・空/範囲外scopeは品質コマンド前にusageのaborted/2で拒否する。bareの品質コマンドやspec-onlyの構造確認だけではCI最終PASSを作らない。通常のspec-only既定localは保持する。旧作業木の補足R12とbb88のREQ-191/312どおり、bareのskip-commandsは不足1・最後の行で再実行を案内し、通常実行でcommands未設定なら0を保つ。この保持条件を候補へ明示することは管理役がADR 0006の包括承認として採用した。

## 用語

S1は公開側の切替前に信頼する内部判定器と固定基準を準備する段階、S2はverify/Evidenceのv2実出力と利用側を一体で切り替える段階を指す。anchorは人の承認と基準側の固定情報から取る版・commit・hashなどの識別情報、base-built checkerはその固定した基準側ソースをbuildした判定器である。private handoffはその判定器と計画の保存先を内部で引き渡す経路を指す。fresh Tは基準側が今回の実行で新しく取得した結果、Sは対象CLI/APIの結果であり、Tを独立した照合の基準にする。

ADR 0006はLoomake自身の開発運用にだけ適用する。管理役による自プロジェクトの基準固定・受入と、製品がtargetから独立した承認済みexpected anchorを検証する信頼境界を混同しない。locator/envやtargetの自己申告hashを信頼せず、製品利用者向けの承認仕様をこのADRだけで変更しない。

承認済みR-C001-03 Aはadapter・plan・適格性の実装と試験が対象である。承認済み04 AによりS1独立changeの仕様・build・受入・archive、private handoff、S2との照合が加わり、単一adapterの追加を超える複数段階の作業になる。R04 Aの採用時に提示した44〜88人時の見積幅を以下に保持する。実装実績や納期の保証ではなく、固定済みの既存C-001見積りは書き換えない。

## S1の工数見積り

2026-10-30に、TypeScript/Nodeと本リポジトリに慣れた1人がAIを使わずに進める場合の実作業を、**44〜88人時**と見積もった。1人日を8時間とすれば5.5〜11人日になる。これはR-C001-04のS1準備とS2への引継ぎ契約までの推定であり、実測・実装開始・人の採用判断ではない。承認/CIキューの待機、S2の公開側/全利用側の本実装、全面host隔離、全provider、公開/権限操作は含めない。元のC-001見積り24〜58時間とは範囲が異なり、重なる検証もあるため単純加算しない。

| S1で準備する範囲 | 人時 | 調査した再利用部分と新規部分 |
|---|---|---|
| 独立changeの仕様・受入・固定anchorの契約 | 4〜8 | OpenSpec/既存DoDを使えるが、基準承認とS1/S2の契約は新規 |
| exact2.0.0の内部parser・同期loader・旧公開v1の保持 | 4〜8 | coreの既存schema/遅延loaderを参考にできるが、現在のverify schemaは1.0.0 |
| verification.yaml・品質条件とmethod/producer/REQ集合のvalidator・hash照合 | 6〜12 | kitの予算付きInputReader、traceのhash検査は再利用候補。独立した基準manifest/依存graphの照合とtarget比較・不足/FAIL判定の接続は新規 |
| ci.test_reportの最小adapter・今回実施のreceipt | 6〜12 | core/test-report.tsはpassed ID抽出だけ。failed/skip/todo、実tool/対象/鮮度の照合は追加が必要 |
| 基準側checkout/build・module確認・private handoff | 6〜12 | kitのprocess予算は使えるが、信頼するS1 moduleの準備/拘束とcontrollerは存在しない |
| S2が直接呼べる境界とS/T一致の契約試験 | 8〜16 | ci-gate.mjsはCLI終了値だけを使う。別のfresh T・exact解析・差分照合のharnessを新規に用意する。S2本実装は別 |
| 境界/改変/古い証拠の拒否と配布・Node22/24確認 | 6〜12 | 既存Vitest/smokeの枠を使い、改変manifest・module・REQ集合、partial/abortedを追加確認する |
| 設計資料・レビュー対応・限定DoD・同期archive・引継ぎ | 4〜8 | 既存手順を使うが、S1単独での受入と親gateを緩めない確認が必要 |
| 合計 | 44〜88 | 8項目の作業幅の合計。並列化による短縮は計上していない |

根拠として読んだ実装はpackages/core/src/test-report.ts・verify-result-schema.ts・quality-schema.ts、packages/kit/src/verify/policy/coverage-policy.ts・quality-verdict.ts・runtime/input.ts・runtime/process.ts、scripts/ci-gate.mjsと既存CIである。既存集約は適格な入力が来たあとの4値集約であり、S1の信頼や実施確認を代替しない。

前提は1つのVitest JSON形式とLinuxの基準側controller、現在のpackage/lock構成を対象にし、Node22.12/24の互換性を確認できることである。S1のcode/job/anchorを独立承認で固定できることも前提とする。Windows/macOSの基準側controllerまで同時実装する場合や、実効scriptの動的な依存先を固定できない場合はこの幅では見積もれず、契約と範囲を再調査する。下限は既存I/O/予算/loaderを再利用できる場合、上限は改変拒否と配布境界の手直しが増える場合の作業量で、完了までの暦日ではない。

## 最小の入力と観測

現行qualityスキーマに実在する `version`・`model`・`product`・`characteristic`・`blocking`・`evidence` と、その `source`・`metric`・`target`・`min_samples` を使う。採用したsourceは `ci.test_report`、metricは `required_subjects_with_failed_tests`。値は「適格な実施済みfailedテストを持つ必須subjectの重複しない数」であり、「成功IDが見つからないsubject数」ではない。参考指標は表示・集計だけに使い、必須証拠を代替しない。

次は説明用の合成入力で、未実行・未承認である。名前や値は実際のroot品質基準の採用を表さない。

```yaml
version: 2
model: iso-iec-25010-2011
product:
  PQ-900:
    characteristic: functional_suitability
    subcharacteristic: functional_correctness
    blocking: true
    linked_requirements: [REQ-313, REQ-319]
    evidence:
      - source: ci.test_report
        metric: required_subjects_with_failed_tests
        target: "== 0"
        min_samples: 3
```

`min_samples` はREQの個数ではなく、適格性を満たす実行観測の個数とする。観測identityは `(report hash, 正規化したテストファイル, fullName)`。同じ観測の重複掲載は1件、1テストに複数REQがあってもサンプルは1件とする。承認済み必須subject集合への対応と、集合全体の実施充足も別に確認する。合成例ならREQ-313/319に対応する異なる3テストのpassed/failedを数えるが、実際のC001 DoDをこの2要件に限定しない。

既存のcoverage抽出はpassedだけを保持する。これを欠落判定の根拠に転用せず、adapterで必要最小限のstatus観測を別に追加する。適格なpassed/failedと、missing・skip・todo・pending・未取得・未照合を分ける。failedは実施された違反の根拠になり、後者は不足の根拠になる。coverageの既存意味と旧assertionは維持する。

比較演算子は既存5種（<=・>=・==・<・>）を維持し、例だけを `== 0` とする。有限で完全な有効値、または当該比較の違反が確定する有効な実施根拠があるときに比較する。未完の集計値・数値0・成功IDのabsenceだけから暫定PASS/FAILを作らず、それまでは不足とする。適格な実施違反が確立したときに限り、ほかの不足と同時でも既存のFAIL優先を適用する。5演算子の境界試験はタスク3.2に残す。

## 初期品質と切替手順

承認済みR-C001-07 Aに従う初期内容として空や全NAのroot qualityではなく、次の**ci.test_reportの必須1項目**を置く。この必須1項目・指標・閾値の内容は03/04/07 Aの承認を反映する。PQ-900の正式な割当と既用IDとの衝突確認、実配置は実装時の作業として残る。実際のrootファイルは今回作成せず、既用PQ IDとの衝突を配置前に確認する。

```yaml
version: 2
model: iso-iec-25010-2011
product:
  PQ-900:
    characteristic: functional_suitability
    subcharacteristic: functional_correctness
    blocking: true
    applicability: applicable
    evidence:
      - source: ci.test_report
        metric: required_subjects_with_failed_tests
        target: "== 0"
        min_samples: 1
```

初期値のmin_samplesは1であり、上の説明用合成例の3と区別し、R07 Aで採用された初期値である。各changeのverification.yamlは、承認されたそのchangeの全必須REQ集合とPQ-900のmeasureを結び付ける。linked_requirementsをC-001の2要件だけへ固定して他changeへ流用しない。必要な全REQが実施されていることは別に必須とし、1つの成功テストだけでほかのREQのmissing/skipを通す条件にはしない。failed・不足・古い結果・偽装した自己申告は承認済みの設計どおりnotPASSとする。31副特性全体の品質合格を表す初期値でもない。

R07 Aで承認された切替の手順は次のとおり。日付はS1独立受入と実施準備後に決め、今回の承認を切替の実施済み記録や未決の設定操作の包括承認とは扱わない。

1. S1の独立受入と同期/archiveを終え、v2切替前に上のroot品質と各進行中changeの承認REQ集合/planを準備する。文書追加だけの先行段階では旧ゲートの成功をv2合格とは呼ばない。
2. 切替直前にGitHubの全open PRの番号・対象change・head・依存・ゲート版を棚卸しする。固定の現在PR一覧を将来の全件だとは扱わない。plan/adapter/初期root品質を含むS2で同じ契約を有効にする。
3. 完了を主張する実装PRは、承認REQ集合のplanを割り当て、切替mainを通常mergeした最新headで品質コマンドを新規実行する。ローカルdone/localと最終done/ci・必須CIを再確認する。切替前の緑CIや旧v1証拠だけでマージしない。
4. 計画だけのDraft PRはspec-onlyで既存の未回答を検出し、doneの未完了失敗を保つ。移行用の架空のPASSやNAを与えない。plan/実証跡を準備できない実装PRはそのマージだけを保留し、不足の対象・担当・次の検証をPRへ記録する。
5. changeなしの文書/開発補助PRは、従来の対象選択とR01で採用した品質専用経路を保ち、存在しないchangeや空の品質PASSへ付け替えない。各実装PRの移行が済んだことを確認してから通常の取り込みへ戻す。

これにより初期空入力による一斉不足の原因を避けるが、1項目を置くだけで既存PR全件がPASSになるとは約束しない。必要なplanと実施がそろわないPRは止める。承認済みの初期内容や切替範囲を後で変える場合は、変更する項目だけを再確認する。空や全NAを合格にする例外は加えない。

### 検証計画の候補と照合順

現在のmainにはroot quality.yamlやverification.yamlはない。以下は新規の最小plan契約候補であり、OpenSpecがファイルを許容することと、内容を検証できることを区別する。候補配置はchange内 `verification.yaml` とし、予算付きInputReaderと専用validatorで内容を確認する。具体的な型・検証規則はS1の設計で確定し、配置は実装タスクで行う。

| plan候補の項目 | 内容と独立した照合先 |
|---|---|
| version・change・required_by | 計画の版、対象change、ci/localで必要なmeasure。曖昧な既定値で必須項目を落とさない |
| expected_spec | 承認された仕様の版・hash、必須REQ集合と集合hash。基準側の承認版を正とし、PRのfrom-change抽出だけを母集団にしない |
| quality・definitions | quality内容hash、必須check・許可ルールhash、S1 anchorの版・commit・判定module/依存graphのhash。expected値は独立したS1承認と基準側に置く |
| producer | adapter ID、実producerのpackage名・解決済みversion・実体hash、report形式/版。package.jsonの宣言だけで実行版を代用しない |
| method | 実行tool/Node identity、実効scriptとその推移的な実行対象、config・lockfile・関連toolのhash。command文字列とPR側のreportの自己申告だけを結ばない |
| target・environment | 正確なtarget SHA、承認済みspec/必須REQ集合との照合、OS/arch/Node/tool版など計画で指定した環境。実行前後の変化も検知する |
| freshness・measure | 同一invocationのrun/attempt/nonce、開始終了、専有report path、report hash、measure source/metric、観測identity、min_samples |

合成planの読み方は`version: 1`、`required_by: ci`、上のsource/metric・target・min_samplesと、これらの固定されたidentityをひとつのmeasureへ結ぶことである。hash欄の説明用例には64桁hexの `aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa` 等を使う。これらは実ファイルをhashした値ではなく、有効な実行fixtureだとは主張しない。計画に必要な対象・版・手順が未定義なら不足、必須planそのものが読めず評価対象が確定しない場合は後述のabortedにする。

基準側controllerが実tool/versionとscript/config/lock・依存先を検査し、承認済みmethod manifestと一致するものだけを起動する。producerは専有出力先で新規実行し、基準側が実行receiptとreport hashを捕捉する。起動なし・report置き残し・別invocation・古いartifact・版や対象不一致はPASSにならない。PR側scriptが書いたreceiptの自己申告やexit 0だけでは実施確認を満たさない。report入力自体の型・形式版と取得時のbyte/hashも確認する。

実行前後の一致に加え、対象specを承認済みplanのexpected spec版/hash/必須REQ集合へ照合する。PRが実行前にSourceやREQを削っても、その縮小集合で正常PASSにしない。変更を正当に採用する場合は、先に基準側の明示的な採否とplan更新が必要である。

### 品質対象専用guard

REQ-314の未評価notPASSを、gateが混在するchecksでも保つ。候補check `quality:subjects` は品質対象0・全NA・必要証拠配列空ならINSUFFICIENT_EVIDENCEとする。構造gateやテストcommandのPASSで相殺しない。非ゼロの適用品質対象とplanへの結び付きを示すevidenceがあればguard自体はPASSにできるが、個々の品質条件の証明を代替しない。承認済みR-C001-02 Aに従いこのguardも含む全checksを `evaluated` に数える。ここでのNAは品質NAであり、理由・確認者とquality定義へのevidence参照を付ける。旧作業木で採用した補足R11の構造NAは、auto・OpenSpec CLI不在・localだけの限定例外である。構造NAは理由と明示/既定の設定出典を持ち、確認者なしでNA/evaluatedへ数え、pending0・run.errorsなしとする。この例外で品質NAの確認者や品質対象guardを相殺しない。後段規範と試験へこれらを反映する。

## 信頼する判定器と自己ゲートの段取り

S1の準備を独立changeで先に受け入れる範囲はR-C001-04 Aで承認された。承認済みR05 A・R06 A・R08 Bを規範へ反映し、S1の具体設計・仕様ゲート後に実装する。公開版の発行・新しい鍵・新サービスを前提にしない。S1を置くだけ、schema 2だけを追加して実出力を1に残すだけでは、C001完了にしない。

| 段階 | 作業と終了条件 |
|---|---|
| 決定の規範反映 | 10件の方針回答を差分仕様とtraceへ反映し、仕様ゲート0を確認する。製品は実装せず、具体的な互換差分とS1内部契約の準備を後続へ残す |
| S1内部基準の準備 | 基準側で独立したbase-built checker/policy moduleとexact2.0.0 parser、承認spec/REQ集合、quality/plan/method manifestを準備する。anchor identityを明示的に固定・承認する。準備段階では公開v1を維持できるが、C001 DoD達成ではない。先に取り込む場合は、限定した内部checker/基準の準備を独立changeとその範囲のDoD・REQ対応試験・通常done 0で受け入れ、仕様同期/archive後に親C001のS2を行う |
| S2一体切替 | verify2/Evidence2へ実出力を切り替え、全利用側を同じ範囲で移す。正常self-ci、独立trusted check、全要件の試験・配布確認・R06で採用するローカル/CIのDoDまで成立させる |

S1の独立change/REQ IDは今回作成・割当しない。他担当・既用ID・ADR 0006の同時4枠を照合し、1枠を確保してから準備する。未完了tasksを持つ親C001のdoneをS1 PRで合格扱いにしない。限定したS1自体が独立gateを通せる範囲にできない場合はR04Aの未決点として残し、親gate・自己task・必須試験を緩めない。

S2の最終CIのnormal commandは `pnpm -s verify --change verify-v2-c001 --done --scope ci`。real v2/PASS・decision.required=false・exit 0を要求し、ローカルDoDの `--done --scope local` の0と分ける。この変更は承認済みR-C001-06 Aに従い、S2実装時に規約と配布文書へ反映する。独立checkerのPASSはこれに**追加する条件**である。

private runtime handoffは、基準側のcheckout/build済みmodule locator、計画・入力のlocator、結果出力先を渡す内部経路の案である。公開APIに必須schemas引数を増やさず、`--trusted-ref` やpublic provenance fieldも増やさない。locator/envは場所を指すだけで承認ではない。祖先であることやhandoffの自己申告hashだけでも信頼しない。expected anchorはtargetと独立したS1承認・基準側の固定情報から取る。

対象CLI/APIの判定は検証済みS1 base-built checker moduleを**直接load/call**して実行する。定義だけ読んでtarget側policyで判定する方式は採らない。facadeを置くパッケージとレイヤー、外部build moduleのloadをパッケージ依存へ追加しない境界は、S1の具体設計で確定する保持条件とする。REQ-046/047の依存制約、REQ-303/305の公開入口からの静的ロード禁止、REQ-207のレイヤー検査は維持または同強度で拡張し、動的specifierによる検査回避で成立させない。実行前にmodule実体・依存graph・固定manifestのidentityを独立したexpected anchorへ照合し、実行中の変化も拒否する。private bindingを設定したという自己申告は、この照合の代わりにならない。

同じCIで自己待ちを起こさない段取りは次の候補とする。

1. 基準側controllerが承認済みS1を別checkoutでfrozen lockからbuildし、固定anchor/module/planのidentityを確認する。targetは別checkoutと専有出力先に置く。
2. controllerがtarget SHA・承認spec/REQ集合・quality・methodと環境を確定し、private handoffを準備する。targetが書いたmanifestを信頼anchorにはしない。
3. S1 checkerがその場でproducerを新規実行し、独立したfresh結果Tとreceiptを作る。現在実行中の集約CI自身の完了やGitHub required-checkを待たない。
4. 別invocationとして通常の上記done commandを実行する。target facadeはS1 moduleを直接呼び、新規実施の結果Sを返す。Sのexit 0だけでは受け入れない。
5. trusted coreでSとTをそれぞれ **exact `schemaVersion: 2.0.0`** として解析する。major 2という文字列だけでは受け入れない。Tを常に権威とし、Tとnormal Sの双方にci/PASS・要判断なし・exit 0を要求する。target/spec/必須REQ集合・quality/plan/method/producer・環境・required_by・check ID/result・summary/decision/verdictの一致を確認する。invocation固有nonce・時刻・receipt/report hashは個別の実施へ照合し、別実行ゆえの差分を許容する。

Sは一致検査の対象で、独立Tを置き換えない。S/T不一致やanchor不明はnotPASSとする。実行ロジック・methodの最小信頼をC003へ先送りしたまま正常PASSを宣言しない。PR側コードを任意に実行するhost全体の隔離や全providerの完全対策は別に残り、最小adapterで信頼できる実行経路の範囲・制約も採否材料へ含める。

候補CI jobの実装と検証だけで、受入規則や公開操作を変更済みとは扱わない。Loomake自身の既承認運用内の通常CI設定は管理役が扱い、required-check/gate等の受入規則変更、npm公開・public化・リリースは具体的なcode/job/SHAと検証結果をそろえ、ADR 0006の人の操作4項目として扱う。製品が独立した承認済みanchorを検証する契約は保持する。

## 受入例と終了コード

以下は未実行の受入設計である。completed/partialでは各checkのevidenceを保持し、エラーを品質違反へ読み替えない。abortedはchecks/summary/verdictを持たない。

| 入力・観測 | 期待する結果 |
|---|---|
| 承認plan・anchor・実tool/method・対象spec/REQ集合・環境が一致し、同一invocationに全必須実施と成果物があり、条件充足・min_samples充足、S/T一致 | normal ci completed/PASS・要判断なし・0。独立TもPASS |
| 適格な実施済みfailedにより必須条件の違反が確立 | FAIL/1。別の不足と同時でも有効違反を優先する |
| passed IDなし、missing/skip/todo、未起動、report未取得・未照合、サンプル不足、古いartifact | 不足/1。absenceをfailedや数値0に置換しない |
| producer/version・実効method・対象SHA・環境・鮮度・anchorが不一致 | 適格証拠なしとしてnotPASS。対象が確定した取得不足は不足/1、対象自体が確定しない読取/起動失敗はaborted/3 |
| PRがSource/REQを実行前に削除し、その前後だけは一致 | 承認済みspec hash/必須REQ集合との不一致でnotPASS。縮小populationからPASSを作らない |
| 対象は確定しているが取得の一部が権限不足 | partial、該当checkは不足、原因をrun.errorsへ。ほかの有効違反がなければci不足/1 |
| doneの必須quality/planのENOENT・read不能で評価対象が確定しない | runtimeまたはpermissionのaborted/3。読み取りをconfig/2へまとめない |
| quality/planの構文・型・版・内容が不正 | configのaborted/2 |
| 必須change未指定・値欠落・構文不正ID | usageのaborted/2、change:null。R01Aのbare品質専用経路とは区別 |
| 構文は有効だが存在しないchange | 既存REQ-055の存在check FAIL/1を保持。自動でusage/2へ変更しない |
| 品質対象0、全NA、または必要証拠配列空、gateだけPASS | quality:subjectsが不足。ci全体は不足/1。承認済みR02 Aに従いguardを含めevaluated=checks.length |
| 有効違反に加えてdecision.required=true | checks/summaryへFAILを残して1。runnerは修正を続けず判断待ち |
| spec-onlyの未承認仮定/確認待ちだけの案内 | PASSの理由と案内に残し、その案内だけではpending/要判断を立てず0。ブロッキング質問の不合格は保持 |
| auto OpenSpec CLI不在 | localは補足R11による理由・明示/既定の設定出典付きNA。確認者不要の限定例外としてNA/evaluatedへ数え、pending0・run.errorsなしとし、品質NAの確認者/品質guardを相殺しない。ciは不足1。明示false/trueとの区別を保ち、strict実施済みとは報告しない |
| doneでskip-commands、またはbare/localでskip-commands | doneはlocal/ci、bareはlocalで品質コマンド不足1・再実行案内。古いレポートで成功を補わない。bareの明示ciは補足R12のusage/2であり、受理してci不足へ付け替えない |
| bareを通常実行しcommands未設定 | 補足R12とREQ-312どおり0。quality.yamlを新たに要求しない |
| localの全項目完了／未完了あり | 前者はverdictなし・pending0/fail0で0、後者はpendingへ数えて1。local0をci合格にしない |
| reportのexit0だけ、CI集約skip/neutralだけ、未完の測定値0だけ | PASS不可。必要実施と適格性を確認できなければ不足 |

### 出力の合成例

これは未実行・未承認の形の説明で、実際のC001検査全件を列挙したfixtureではない。hashは説明用の合成64hexである。evidence参照にはreport・実行receipt・planとの結び付きを含め、公開provenance fieldは増やさない。品質のNA例の確認者名も架空の値であり、人の採否を表さない。

```json
{
  "schemaVersion": "2.0.0",
  "change": "verify-v2-c001",
  "run": { "status": "completed", "errors": [] },
  "scope": "ci",
  "checks": [
    { "id": "gate:requirements", "result": "PASS", "reason": "承認specと必須REQ集合に一致", "evidence": ["spec:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"] },
    { "id": "gate:test-command", "result": "PASS", "reason": "基準側が新規実行を確認", "evidence": ["receipt:sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"] },
    { "id": "quality:subjects", "result": "PASS", "reason": "適用品質対象と必要証拠の定義あり", "evidence": ["plan:sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc#measure-1"] },
    { "id": "quality:PQ-900", "result": "PASS", "reason": "適格な完全観測で値0、3サンプル、条件==0", "evidence": ["receipt:sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", "report:sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd", "plan:sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc#measure-1"] },
    { "id": "quality:PQ-901", "result": "NOT_APPLICABLE", "reason": "この合成例の対象外項目。確認者: 合成例の確認者", "evidence": ["quality:sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee#PQ-901"] }
  ],
  "summary": { "fail": 0, "insufficient": 0, "not_applicable": 1, "evaluated": 5 },
  "decision": { "required": false, "reasons": [] },
  "verdict": "PASS",
  "coverage": { "REQ-313": ["tests/synthetic-a.test.ts"], "REQ-319": ["tests/synthetic-b.test.ts"] }
}
```

NAの参照先には理由・確認者を含む定義が必要である。上のquality YAMLはPQ-900だけの抜粋であり、このJSONと合わせた実行可能fixtureではない。構造gateにもspec・検査入力、command gateにも実行receiptというevidenceを付ける。品質guardだけで実施証明を完了せず、quality checkの3参照を実ファイル・実行へ照合する。

## 公開側と全利用側の一体移行

| 対象 | 同じS2での変更・保持事項 |
|---|---|
| core | verify2のschema/導出型、Evidence2、exact版validatorと履歴1専用loader。named exports、起動時lazy、同期API・予算・未知キー保持。無関係6 JSONを変更しない |
| kit・CLI | runVerifyの同期名を維持しv2へ。提案済み--scope local\|ciを保持、done既定ci/spec-only既定local。aborted2/3、JSON stdoutのみ、日本語stderr、非対話を同時に接続 |
| ci-gate・workflow | target facadeからS1判定moduleを直接使う正常self-ciと独立Tを確認。旧ok・local・skip/neutralで合格にしない。設定操作の許可とは分ける |
| trace record・runner record | trace record既定ci、runnerは明示local。同じ0〜3、文書snapshot・前後照合・未コミット拒否・追記専用を保持 |
| serialization・publication | 新旧validator、JSON前後検査、同期・byte予算・末尾改行、fsync・原子的な上書き禁止公開・失敗cleanupを保持 |
| trace report | Report2の既存外形・日本語行へ射影する。採用済みAはv2のci/PASSかつ要判断なしだけok:true、それ以外false。v1は旧verify.okを保持し、履歴閲覧専用の警告を加え、自動再利用しない。実在FAIL/不足だけをfailedChecksへ写し、coverage・保存文書を保持する。追加Opus設計に基づく下記「Report2射影Aの具体契約」に従い、JSON roundtripとlocal完了の中立表示を同時に確認する。日本語制御タグ・WeakMapだけの状態保持・Reportの新欄を使わない |
| runner run・reuse・pr・prompt・recorder | v1 ok/results直読・型をすべて追従。親SHA・文書snapshot・未コミット拒否・reuse制約、decision停止、変更保持・予算・中断、RunSummary外形を保持 |
| agreement・doctor | 共有config/validatorの影響を確認。既存の承認日記録・非verifyの例外契約を保持。doctorで品質コマンドを実行しない |
| tests・smoke・公開型・配布物 | 旧fixtureを保持する履歴試験とv2新規試験、公開型のstrict検査、tarball実行、Node22/24、offline・SIGINT・既存hash/予算回帰を確認 |

kitの現在の直接依存はcoreだけでyamlはない。REQ-047の許容内でyaml依存とlock変更を提案する。coreの既存zod以外や新パッケージを当然に追加しない。sync loaderは下の実測に基づく最小案とし、必須schemas引数の追加を前提にしない。他6 JSON、Report2、RunSummary、履歴1の閲覧と全要件/タスク/必須CIの条件は削らない。

### 保護された互換差分 C1〜C5（R-C001-05）

| 候補 | 具体的な衝突・扱い |
|---|---|
| C1 REQ-055の旧verify形 | 現在の正確な{check,status:fail,detail}の期待値はv2形と両立しない。FAIL・日本語detail・exit1は維持し、形の変更はR01に結び付く保護差分として提示する。管理役が旧原本と実差分の強度維持を検証・記録するまで既存assertionを変更しない |
| C2 R01Aのmissing-change | change必須経路の--change未指定はaborted2だが、有効な非実在IDはREQ-055の存在FAIL1である。両者を混同しない。承認済みR01 Aの範囲を変えて不存在IDをabortedへ変更しない |
| C3 REQ-073 | Evidenceの未対応版2を拒否する現行Scenario/診断とEvidence2導入が衝突する。便宜的に未対応版を3へ書換えず、R05 Aの範囲で、旧版fixtureを保持し、必要な互換差分を具体化して確認する |
| C4 埋め込み・公開型 | Evidence1を埋め込む型・smoke・report/reuseの旧定数を棚卸しする。履歴のbytes・documents省略を保持し、現行書出しだけをv2へ一体移行する |
| C5 診断・同期性と警告/省略コマンド | REQ-036/037/039のwarnは承認済みR08 Bのゲート/scope別分類、REQ-191のskipは不足/1へ移す。stderr空や同期/予算の既存assertionを、観測warningに合わせて弱めない。配布時の実際の挙動を確認し、正当な互換移行は管理役の強度維持確認を記録する材料として残す |

R-C001-05 Aで非互換範囲は回答済みであり、製品実装・具体的assertion差分の適用は未実施である。差分を棚卸しし、旧原本と検査強度を保持して確認する。過去回答R05/R06とREQ-324の具体差分の個別承認は、ADR 0006に従い管理役が旧原本と具体差分を照合し、強度維持・承認者・日付・ADR参照・根拠を記録する経路へ対応付ける。方針承認だけで具体差分を適用せず、後段でtrace・designの表現もこの経路にそろえる。テスト弱体化・設定緩和・範囲縮小は禁止し、例外承認の経路は設けない。R01のbare経路とR03/04の正常PASSの範囲にも結び付け、要件番号の定義を便宜的に変更しない。

## 既存assertionの移行点（task 1.2）

次は現mainの既存試験を読んで整理した変更予定であり、今回のPRでテストを変更した記録ではない。具体的なコード差分は実装タスクで提示し、旧fixture・旧46例の原本と検査強度を保持する。承認済み仕様への形式移行と、実装の都合に合わせた期待値変更を区別する。後者と、skip・設定緩和・範囲縮小は行わない。

| 要件・保護差分 | 実際の既存試験・assertion | 採用契約に沿う移行と保持する条件 |
|---|---|---|
| REQ-036/037/038/039/191・C5 | `packages/kit/test/verify.test.ts` のwarn、fail、skipと `packages/cli/test/arguments.test.ts` のresults/skip | v2のchecks/result/reasonへ追従する。spec-onlyの案内0、doneの未承認/確認待ち/skip不足1、auto不在localのNAとci不足を個別に検査する。構造NAの理由・設定出典・確認者不要の限定例外・NA/evaluated計数・pending0・run.errorsなしと、品質NAの確認者/guardを相殺しないことをspec-only単独とdone/local混在の両方で検査する。明示false/trueとの区別も保つ。未完了tasks・実施失敗のFAIL、明示trueのvalidate失敗、未知キー名と再実行案内を保つ |
| REQ-040 | `packages/cli/test/cli.test.ts` のschemaVersion 1.0.0とskip時coverage完全一致 | 現行2.0.0のschema検証と、今回のtestコマンドが新規生成する成功coverage一覧を検査する。skipは別に不足1・coverage省略を検査し、正常coverageを単に削除しない。stdoutがJSONだけ、進捗stderrも保つ |
| REQ-042 | `packages/cli/test/cli.test.ts` のbare verify commands専用 | change:null/local/verdictなしで品質コマンドだけを実行し、quality.yamlを新たに要求しない。bare skipは不足1・再実行案内、通常のcommands未設定は0を保つ。補足R12に従いCLI bareはgateを渡さず、changeなしでgateだけ指定するAPIは旧来の無視からusage aborted/2へ移す。reference-definition.test.ts:93–99の完全一致も具体差分へ含め、既定値を下位へ引き継ぐ強度と旧APIからの移行説明を保持する。架空changeで代替しない |
| REQ-050 | `packages/cli/test/cli.test.ts` の500要件/1,000ファイル、skip経路のexit0と3000ms未満 | 明示local・skip不足1へ移行する。抽出/対応判定の実関数を同じfixtureで連続計測し、合計3秒・500要件全件対応を保持する。処理量や時間閾値を緩めない |
| REQ-055・C1/C2 | `packages/kit/test/verify.test.ts` の存在検査の厳密なcheck/status/detail一致 | 旧構造の原本を履歴試験へ保ち、現行は対応するv2 checkのFAIL・同じ日本語理由を検査する。有効な非実在IDの存在FAIL/1と、change未確定のusage aborted/2を分ける |
| REQ-073・C3 | `packages/trace/test/report.test.ts` のschemaVersion 2拒否、results欠落、パス/診断/終了コード2 | v1履歴の解析と拒否fixtureを残し、現在のEvidence 2/verify 2.0.0の受理と状態別必須欄欠落拒否を別に検査する。Evidence2/verify1とEvidence1/verify2の混在は拒否する。未対応版検査を便宜的な数値置換で済ませず、新旧の対応版と未対応版を確認する。対応版を増やす診断は具体差分として承認記録へ結び付け、記録パス・対象版・日本語案内・終了2・スタックなしを保持する |
| REQ-066/127/128・trace record | `packages/trace/test/record.test.ts:64,66`のschemaVersion/modeと文書snapshot・前後一致・dirty拒否 | 旧版fixtureと期待原本を保持し、現行Evidence2/verify2の対応を別に検査する。同期API・文書hash・前後の不一致拒否・追記専用と失敗時の保存なしを維持する |
| REQ-302/303/304・公開trace契約 | `packages/trace/test/schema-contracts.test.ts:22,29–30`の版配列・拒否入力、`packages/core/test/fixtures/trace-contract-values.ts:4`と`evidence.ts:12,18–19` | 旧公開元・schema・型と原本を履歴用に保持し、新版は版別の受理/拒否を検査する。旧mode拒否を削るだけにせず、新版の状態別必須欄欠落・混在版拒否へ同強度の検査を加える |
| REQ-205/206/124/332・純粋判断 | `packages/runner/test/decision-policy.test.ts:30–90`の旧13観測・期待文言・冪等性と判断順 | 旧ケースの原本・観測と期待文言を保持し、v2のlocal完了・要判断・aborted・実観測不能を別に追加する。`phases.ts:135–139`のdetail文字列による原因推測を型付きonLimitへ移し、REQ204のエンジン判断は変えない |
| REQ-100/331・直しとNoChange | `run.test.ts:289–291`の直し指示の欠落要件表示、`run-no-change.test.ts:139–162`の単一verify・合図なし・出力記録 | v2の失敗/不足理由から同じ具体的な直し情報を作る。変更がなければ追加のcommit・再検証を行わず、合図の決まりをエンジンへ渡さず、出力記録の所在を保持する |
| REQ-105/182・期限と閉予算 | `run.test.ts:318–359`と`external-budget.test.ts:134–266`の期限理由・完了印・Git起動 | 期限の理由と一時完了印の復元、予算閉鎖後にGitを起動しないこと、再試行の重複防止を保持する。エンジン中断とverify中断を区別し、後者の型付き観測を照合する |
| REQ-093 | `packages/runner/test/run.test.ts` のブランチ未作成・エンジン未呼出し・不合格1 | 既存条件を保ち、usage/config aborted2とその他aborted3の停止を追加する。成功経路だけを確認して終了しない |
| REQ-114/115/116/165 | `packages/runner/test/pr.test.ts` の証拠コミットが先、向き先保持、本文順序、:127のgh argv完全一致と既存PR検索 | local完了のEvidence 2とDraft PRへ追従し、本文にlocal完了とCI最終未確認を分ける。コミット/push/PR順、向き先不明時停止と未記録、要件別テスト表を保つ。Draft指定の具体argvとR05の形式移行への対応、既存ready PRの扱いは後段で確定し、既存PRを無断で作り直さない。phases.ts・record.ts・pr.tsとpr.test.tsのlocalに対する合格表記も具体移行対象へ含める |
| REQ-135/194/041・CLI旧46例 | `packages/cli/test/cli.test.ts`・`arguments.test.ts`、`packages/cli/test/fixtures/reference-cli-baseline.json`、`tests/cli-reference.test.ts` | helpの全既存オプションとstdout/0/処理なしを保ちscopeの受理値/既定値を追加する。値の空白/等号構文と空値拒否も保つ。`tests/cli-reference.test.ts:29,153–154`の23行完全一致・scope/decision不在と`packages/cli/test/cli.test.ts:185`のusage全文一致を具体移行対象とし、REQ-135/323/324の後段MODIFIEDと具体差分の承認記録を前提に追従する。旧46例原本は残し、v2の変化と追加例を別の明示基準へ整理して共通定義・生成ページ・配布CLIを同時照合する |
| REQ-136 | `tests/kit-assets.test.ts` の既定ciコマンド文字列と `packages/runner/test/run.test.ts` の完了ゲート印 | R06の具体差分の承認記録を前提に、両req-to-openspec雛形の明示localコマンドへ追従し、印の存在・エンジンに渡さないこと・成功時だけ完了の検査を保持する。最終ci確認をローカル完了で代替しない |
| REQ-164 | `packages/runner/test/publication-retry.test.ts` の同じ証拠/コミット/PR、旧証拠と改変時停止 | Evidence 2/localの同一状態に限る再試行を検査する。既存8kindのfailed/fail-resultは旧ok/resultsの未知欄だけを書き換えず、v2の実在する状態・scope・pending・decision・check FAILへ対応付ける。正常な旧Evidence1は保存して新v2を記録し2ファイルとする。旧版のJSON破損・SHA/change/文書不正は停止し、正常v2のci・local未完了・要判断・abortedは別の条件不一致理由で停止する。停止・保存・1ファイル・PR不変、再local検査、親SHA・文書snapshot、改変証拠の保存、重複公開の防止を保持する |
| REQ-124/208/337・制限観測 | `packages/runner/test/run.test.ts:548–584`・`signal-during-sync.test.ts:115–171` の中断状態と厳密な理由一致（results/detailの直接照合はsignal-during-sync側） | 未完了checkを不足、run.errors runtime/partialとし、v2 check.reasonへ中断で止めたこと・監視役の理由を同強度で移す。onLimitは実原因から通知し、理由なし/空文字付き理由を区別する。実観測不能かつlocal未完了の理由なし中断は「中断されました」を保ち、旧assertionを削らない |
| REQ-183 | `packages/runner/test/external-budget.test.ts` の期限と中断、`packages/kit/test/process-startup.test.ts` | 時間・出力・共有予算の回帰をそのまま保つ。JSON版不変は予算単独変更の範囲とし、C001の形式移行を理由に資源制限を緩めない |
| REQ-203 | `packages/cli/test/trace-agreement.test.ts` の承認/承認者/日付・警告消失 | 同じ承認記録と対象外の不変を保ち、承認前に該当IDが出ることもv2で確認する。承認後はspec-only案内とdone不足/要判断から該当IDが消えることを検査する |
| REQ-275/276/305/307・C4 | coreの`verify-result-schema.test.ts`・`json-schema.test.ts`・`quality-result-schema.test.ts`・`unknown-fields*.test.ts`と`scripts/schema-contract-check.mjs` | v1履歴とv2現行を版別に検査し、特殊未知キー・既定値・型・遅延ロード、必須項目削除/改名の変異検出を保持する。verify/evidenceだけを現行形式へ移し、無関係6 JSONのbyte不変と旧版exportsを検査する。schema-contract-checkのメジャー変異を現行2.0.0と同一にせず、現行形式へ作用する変異へ移す。json-schemaの一覧完全一致・同registry登録・旧版の一意な$idと、coverageの__proto__非復元も個別に保持する |
| REQ-322〜325 | `tests/quality-reference.test.ts`・`tests/cli-reference.test.ts`・`tests/package-artifacts.test.ts` | quality生成/checkとCLI共通定義集約単独の不変条件を保つ。C001の明示改版ではscopeを共通定義・生成文書へ同時反映し、既存URL4 Scenarioと生成/check一致を保持する |
| REQ-146・公開型破壊検出 | `tests/package-artifacts.test.ts:145–161`のd.ts変異とTS2322 | 旧ok文字列の出現数に依存した変異を現行v2公開型へ実際に作用する変異へ移す。履歴型だけを壊して合格にせず、公開利用側のstrict型不一致を同強度で検出する |
| REQ-143/155・配布/導入試験 | `scripts/package-smoke.mjs` のverified.ok/coverage25件と`scripts/ai-journeys.mjs`のdone/trace、`tests/package-artifacts.test.ts`・`tests/ai-journeys.test.ts` | 実tarballの公開API/型・履歴データと、3つの導入/通常/復旧シナリオを保つ。quality/planと必要な実証跡を用意し、local完了と最終ciを分ける。tarballだけのconsumerでci/PASSを得る具体経路はtask 1.3のhandoff設計に依存し、REQ-143/155/319をlocal成功だけで代替しない。旧.okの比較をただ消さず、v2の状態/scope/decision/終了コードと25要件/行の対応を照合する。失敗・復旧・未コミット拒否を省かない |

### 追加境界設計の採用と残る成立条件

2026-10-31に、head `71223c16e32be768e211a397bfe780b75cfc465c` の追加Opus設計2本を管理役が確認した。境界設計はsession `ae8a181f-7672-4812-b236-6be83a41b407`、Report2は `01aa2d9f-4500-4331-a228-1f925dcb672c`。実モデルは両方claude-opus-5-5、ok:true・権限拒否0・読取専用・MCPなしである。利用者が本会話でこの2件の送信・実行を許可し、その範囲で実施した。設計の完了を最終レビューや製品受入の成功とは扱わない。

管理役はADR 0006により、R-F12=A、R-F15=A、R-F17=A、Report2のD-R2-01=A・02=A・04=Aを採用した。確認事項の回答者は「利用者（ADR 0006 の包括承認）」、採用記録日は日本時間2026-10-31である。R-F18は既存の速度対策1-1の1change/1PRを維持する決定と整合させた。F16は後述の方向だけを暫定採用し、成立済みとは扱わない。後段の規範PRで選択肢・理由・決定・出典をtraceへ移す。今回の候補だけでは規範、task1.2、S1/S2、親C001のDoDは完了しない。

#### F12：新規Draftと既存PRの再利用

新規PRだけをDraftとして作り、既存の`gh pr create`のargv末尾へ`--draft`を加える。本文ファイルの位置と証拠commit→push→PR作成の順序を保つ。同じrepository/base/headの一意なopen PRはreadyでもDraftでも作り直さず、状態も変えずにURLを返し0とする。検索の`isDraft`はbooleanとして検査・記録し、ready/Draftの表示を事実に結び付ける。型不正・検索失敗・複数候補・不正URL・向き先不一致は停止し、既存PRの状態変更を行わない。

local完了を「合格」と表示せず、PR本文・停止理由・再利用の表示にlocal完了とCI最終未確認を区別して記す。REQ-114/115/116/165の既存Scenario・期待原本を保持し、新規argvの完全一致、既存ready/Draftそれぞれの作成0回・状態変更0回、検索異常時の証拠/commit/PR不変を後段で検査する。

#### F15：JSONの選択と副作用前の入力検証

help優先→argv解析→要求の検証→設定読取→品質コマンド/Git/保存の順に処理する。scopeの空値・範囲外、gateとchangeの組合せ、change-idの構文は設定読取や副作用より前に拒否する。CLI bareはgateを渡さず、changeなしでgateだけを指定するAPIは旧来の無視からusage aborted/2へ移す。旧APIとの具体差分と共通定義/旧46例の対応を記録する。

JSON形式の選択は解析成功と分け、共通option定義に従って値に消費されなかった独立の`--json`だけを認識する。`--change=--json`や`--json=1`を独立flagと誤認しない。構文エラーを受理するための別文法を加えず、最初の日本語診断・空白/等号構文・重複拒否・help優先を保持する。

| 条件 | stdout | stderr・終了と副作用 |
|---|---|---|
| helpがある | 従来のhelpだけ | 0。検査・JSON・Git・保存を起動しない |
| verifyの構文/要求の誤り、独立--jsonあり | 正規2.0.0のusage abortedを1個 | 日本語診断と既存の使い方、2。設定・品質コマンド・Git・保存なし |
| 同じ誤り、独立--jsonなし | JSONなし | 同じ診断・使い方、2。副作用なし |
| bareの明示ci、全gateの空/範囲外scope | 上の形式選択どおり | usage/2。品質コマンド・Git・既存レポート削除より前に拒否 |
| 構文が有効な非実在change | 対応するv2結果 | REQ-055の存在check FAIL/1。change:nullやusageへ変えない |
| 設定の構文・型・対応版の誤り | --json時はconfig aborted | 日本語診断、2 |
| verifyの読取不能・外部操作の上限 | --json時はpermission/runtime等のaborted | REQ-192の日本語理由、3。使い方を出さない |
| trace recordの不正scope | 新しい--jsonを設けない | UsageError/2。設定・Git・verify・保存の前に拒否 |
| trace record自身のGit非0終了 | 従来どおり | 既存UsageError/2と日本語文言を保持。ProcessLimitError等の上限停止3とは区別 |

未確定changeはnullとし、生の入力をrun.errorsの対象へ保持する。確定したIDと未確定入力を分け、abortedへscope・checks・summary・decision・verdictを補わない。型・キーはtask2.1の正式契約へそろえる。JSON位置の前後、等号値、全gate/APIとrecordの番兵による副作用ゼロ、stdout単独JSON、CI=1の非対話、既存診断と0〜3を後段で確認する。

#### F16：changeなしPRのCI経路（暫定採用・成立未確認）

公開bareはchange:null/local/verdictなしを維持し、明示ciは拒否する。方向として、ci-gateの基準側controllerがS1判定器から独立した正式v2のci結果Tを取得し、別invocationのbare local結果Sと照合する。Tはtarget SHAに拘束されたchange:null/ciで、公開bare/APIからciを作る経路とは分ける。Tのci/PASS・要判断なし・0と、Sのlocal完了/pending0/fail0/0、同じcommand checkのid/result・target・環境の一致がそろった場合だけ成功とする。localの0だけやskip/neutralを最終合格にしない。

母集団はPR側で縮めず、基準側の現行主仕様にある全REQと承認済みroot plan・PQ-900を固定する方向を暫定採用した。空集合・全NA・必要証拠空・実施不足をPASSへ補わない。IDの既存衝突を集合化で隠さず、宣言元と対応の未整備を予備監査へ残す。基準資料が読めず評価対象を確定できない場合は既存aborted契約を保持し、空の不足checkや成功を捏造しない。

現mainの全必須REQが適格なID付きpassed試験で充足されるか、S/T別invocationの実施費用と全体時間がいくらかは未実測である。旧reportを使う予備照合は不足の棚卸しだけに使い、最新headの性能や受入成功にはしない。全REQ/宣言元とreport/headの対応、不足一覧、重複ID、必要な解消範囲を記録し、実測が揃うまでこの案を成立済み・S2切替可能としない。command実施を二重にする影響も未測定とする。S1の独立受入より前にS2の新ci-gateを有効にせず、架空change・MUST適用外・空PASSで回避しない。

速度対策1-1の全PR経路でslowを実施しない条件と、REQ-297の元4case・実時計下限19.5/39.5秒を保持する条件も、F16の成立に必要である。全REQのタグがあっても、auth/list等の同REQタグをpush/createのfast実証へ流用しない。全main母集団の案がPR内の実slowを要求するなら、この統合条件と両立せず、未採用の外部証跡再利用を補って解決済みにしない。

既承認R07はci.test_reportの初期必須1項目を各PR/changeの承認REQ集合へ結ぶもので、全main245IDを一律に必須とする決定ではない。min_samples1は観測数であり、必須subjectを1件へ縮める許可でもない。対案Bとして基準側で承認したroot planへ正当なsubjectを固定する方向を追加設計の候補とし、PR側による母集団の縮小・空品質・タグだけの偽充足を禁止する。実changeの全承認REQと原47要件・16条件を残し、changeなしPRのsubjectが何かを一意に確定して適格なS/Tへ結ぶまでは、Bも成立済み・採用確定とはしない。

後段ではREQ-132のchangeなし/branch不一致/archive経路、REQ-318の最終ci、REQ-312のbare境界を同時に整合させ、内部結果の正式なschema/validatorとS/T一致範囲をtask1.3で確定する。現行REQ-270の品質job省略とmain push全実行を維持し、品質jobを省いてもgateの必要な実施を省略しない。

#### F17：実tarballのproducerとprivate handoff

製品の公開入口は実tarballのinstallだけから解決し、実パスを検査する。producerはワークスペースのlockに対応する実Vitestを用い、製品をrepoのsrc/distへすり替えない。実tool/version/実体hash・method/config/lock・target・nonce・開始終了・専有report/hashを基準側が照合し、手書きpassed JSONを新しい品質証明に使わない。producerの実体を供給するlinkは製品の公開依存の追加と区別する。

consumerには実際の値を検査する25件のID付きfixtureと25REQのplan・PQ-900を用意し、タグだけのassert(true)へ置き換えない。基準側controllerの承認anchor/module/依存graphとconsumer外のprivate handoffを使い、別invocationのTと通常CLI/APIのSでci/PASS/0・decisionなし・coverage25件を照合する。private locator/envそのものを承認とせず、独立したexpected anchorとの照合を維持する。具体的bindingと起動順はtask1.3で受け入れる。

doctor/spec-onlyの正常系、handoffなしの不足1、local0/verdictなし、既定ciのtrace record/Evidence2とReport2の25行を同時に確認する。first-use/daily-use/recoveryの3シナリオ、未回答・不足・実失敗・復旧、未コミット拒否、init再実行の不変と既存AGENTS保護を残す。REQ-143/155/319をlocal成功だけで代替せず、新旧JSON・公開型・同期性・unknown key・非通信・予算・Node22.12/24の保護を維持する。

#### F18：既存承認と速度対策1-1の統合順

規約DoDの反映はR06 Aの元の問い・回答・具体patchを照合し、その明示承認の範囲だけを記録して行う。作業中local完了と最終ci/PASS/要判断なし/0を分け、全要件対応試験・tasks・必須CI・独立レビューを残す。承認元を超える新たな規則変更はIssue121で人へ依頼し、包括承認だけで全規則を変更しない。

Node20削除は利用者の依頼1-1で決定済みであり、既存change `split-slow-ci-checks`の1change/1PRでNode20とslowを受け入れ、S2より前に統合する。追加Opusの別change/別PR推奨はこの既存決定と異なるため採らない。rulesetは同changeのQ09に従い、ready時の具体的なbefore/afterと検証結果を揃えて人へ依頼する。先に規則を変更済みとしたり、別の承認待ちへ戻したりしない。削除前はNode20.19の既存検査を保ち、削除後は受入済み基準でNode22.12/24を検証する。既存の実測を未実測OS/Nodeへ流用しない。

### Report2射影Aの具体契約

v1は旧verify.okとstatus:failのcheck一覧を保持し、warnings先頭へ履歴閲覧専用の警告1件を加える。v1のtrueをfalseへ書き換えず、履歴閲覧と最終CIの自動合格への再利用不可を区別する。追加Opus結果8章の「v1をok:trueにすることは禁止」という一文は同結果2章・採用済みAと矛盾する誤記として不採用にした。原本は変更せず、この採否を後段traceへ記録する。

v2のok:trueはcompleted/partial・ci・PASS・decision.required=falseに限る。failedChecksは実在するFAIL/INSUFFICIENT_EVIDENCEのidをchecks順に写し、abortedでは空にする。scopeやrun.errorsを架空checkへ変換せず、abortedへcoverageや合格行を補わない。不整合な状態・summary・verdictはexact validatorで拒否する。

| 証拠の状態 | evidence.ok・failedChecks | warningsと表示 |
|---|---|---|
| v1の正常/失敗、documentsあり/なし | 旧okと旧fail一覧を保持 | 履歴閲覧専用・現在の自動合格へ再利用不可を先頭警告に加える |
| v2 ci/PASS・判断不要 | true、FAIL/不足なし | 最終ciの結果として扱う |
| v2 ci/FAIL | false、実在FAILと不足のid | 違反確定と証拠不足の理由を別に示す |
| v2 ci/不足 | false、実在不足のid | 未実施・不足を実施済みFAILと混同しない |
| v2 local完了 | false、実在FAIL/不足がなければ空 | local完了・最終CI未確認。失敗した検査を捏造しない |
| v2 local未完了/要判断 | false、実在FAIL/不足だけ | pending/failと判断理由、最終CI未確認を分ける |
| v2 partial | scope/verdict/decisionに従う | run.errorsの種別・対象・日本語理由を示す。partialだけで一律不合格にしない |
| v2 aborted | false、空配列 | 中止・run.errorsの理由。存在しないchecks/coverageを補わない |
| Evidence1/verify2、Evidence2/verify1、未対応版、必須欄欠落 | 射影しない | パス・対象版・日本語診断・終了2・スタックなしを保持して拒否 |

状態/scope・FAILと不足の別・decision/run.errorsは、型付きの欄から日本語warningsを組み立てる。証拠の警告を先、既存の合意警告を後に置く。formatterはReportの既存欄だけで表示を決め、warningsは解析せずに表示する。Markdownは「合格していない検査」「合格ではない」「証拠と合意の記録の警告」とし、local完了を不合格とも最終CI合格とも呼ばない。新しいReportの欄・列挙値・公開signature、WeakMapだけの状態保持、日本語制御タグは加えない。旧documentsなしの行と説明、coverageの意味は保持する。

REQ-301の旧JSON期待原本を保持し、v1の出力は履歴警告1件だけの差分をbyteで照合する。先頭警告を除いた残りは原本と完全一致させ、対応するv2 ci/PASS入力は従来JSON原本とbyte一致させる。REQ-079の警告の完全一致、REQ-072/088/209の表示・順序とREQ-073の拒否強度も保持する。旧fixtureを変更せず、新旧対応版・混在版・0/3/999/文字列/nullの拒否を別に検査し、便宜的な数値置換だけで済ませない。

全状態についてbuildReport→直接formatter、runReport JSON→JSON.parse→formatter、Report schema parse→formatterの結果一致を確認する。warningsを任意の文字列へ変えても警告節以外の表示が変わらないことを検査し、隠れた状態や日本語の解析へ依存しない。旧JSON/fixture原本、決定性と同じ秒の選択順を保持する。

D-R2-03はreportが保存あり/なし両方を扱う設計だけを採用した。recordが新しくaborted/partialを保存する方針を、この候補では決定しない。既存task4.2の保存条件と結合して具体化するまで未確定とし、reportの対応設計から保存許可を逆算しない。

後段では原47要件・16横断条件を保持したまま、必要な既存REQ-072/073/079/088/209/301/316、F12〜18のREQ-116/132/143/155/165等の規範/Scenario・移行表とtask1.3/4.1〜4.5/5.1を追従させる。既存Scenarioは削除せず、旧期待原本と具体差分の強度維持・承認者・日付・ADR参照を照合してから実装へ適用する。原47外に必要な既存REQへの補足は工程coverageにも追加し、元の47と16を縮めない。

## 技術的に確認した範囲

以下は実装成功の判定ではなく、設計候補の実現性を限定して調べた事実である。以下は当時の実験記録の要点であり、Git対象外の保存先を読者が開ける証拠として参照しない。

| 実測 | 事実・制限 |
|---|---|
| Node24.21.0 | actual core+kit distの静的import後quality-schema/Zod load0。関数内createRequire(actual core dist/quality.js URL)からactual quality-schemaを同期requireでき、非Promise namespace・safeParse・cacheを確認。runVerifyは通常Function。runVerifyへの接続は未実装 |
| 公式Node22.12.0 linux-arm64 | 公式SHASUMSとSHA256 `8cfd5a8b9afae5a2e0bd86b0148ca31d2589c0ea669c2d0b11c132e35d90ed68`一致後、同じ実graphを1回実行しexit0。同じ静的0/遅延同期load・parse・cacheを確認。require(ESM) ExperimentalWarningは実際にstderrへ出た |
| 観測器の診断 | Node22では専有V8 coverage観測器の終了時に「Precise coverage has not been started」も出た。原因の独立再現はしていない。loader失敗とは確認しておらず、stderr cleanとも主張しない |
| OpenSpec1.14.3 | scratchへ既存root/changeをコピーしたstrict control0。同一byteの.openspec.yamlをverification.yamlへコピー後もstrict0/issues[]。ファイル配置の許容だけであり、plan内容schema/意味の検証ではない |

[Node22.12公式docs](https://nodejs.org/download/release/v22.12.0/docs/api/modules.html#loading-ecmascript-modules-using-require)は同期ESM graphのrequireを扱い、TLA graphは対象外である。製品統合・tarball・CLIのJSON/日本語stderr/互換性は未検証。後日のnative CIと配布検証を必要とし、global warning抑制・設定緩和・既存assertionの無承認変更では解決しない。

## 採否と完了条件

R01はbare verifyの境界、R02はevaluated、R03は最小adapter・plan・producer mapping、R04はS1/bootstrap/private handoffの追加契約と依存を判断する。R05はC1〜C5、R06はローカルDoD、R07はquality移行、R08はゲート/scope別warnとskip-commands、R09は旧JSON Schema公開、R10はspec-onlyの計数を判断する。日常的なsource照合・同期loader・利用側の追従は技術作業として扱い、過去10件と補足R11〜13を再質問せず、具体的な技術作業と決定記録を区別する。

C003には全provider、全host隔離、広いCI成果物取得/再利用連鎖、最小接続以外のpartial取得経路、全禁止キーの網羅が残る。C001の最小接続の適格性・実施確認・必須のpartial/aborted分類はその残作業へ先送りしない。S2の実出力v2と全利用側移行、ローカルdone/localの0、最終done/ciのPASS・要判断なし・0、独立trusted TのPASS、全要件のID付き試験、全タスクと必須CI・配布検証を確認する。

著述3回のactual model/session/exit/denialsは[作業記録](../../../docs/worklog/2026-10-30/spec-verify-v2-c001.md)に記した。原文3稿はignored領域で無改変のまま保持し、この詳細では指定された既存要件との整合を取った。当時の追加AI評価0という記録を保持し、方針の採否はその後のPR #139で回答済みである。旧作業木で当初規範を反映した際には既存設計を再利用し、新規Opus設計は実施しなかった。その後、最終レビューの指摘を受け、2026-10-30に独立Opus補足設計2回を実施し、旧作業木のtraceへ採用条件を記録した。実モデルは両方claude-opus-5-5、sessionは`9b8c1bd2-3fed-4ee8-bf9b-19ccd818552b`と`4b757858-2041-4eca-abf1-796e3287c37b`、両manifestはok:true・権限拒否0である。旧60dc/bb88のdesign補足節・traceが採用記録の所在であり、この先行headの同名ファイルには未移植である。後段で採用条件を移し、今回の作業記録にも原本照合の履歴を残す。設計の実施・採用を製品実装や最終レビュー合格へ読み替えない。

## 承認済みの追加互換差分（R05 A）

REQ-183は予算/後片付けだけの変更の版不変、REQ-322はquality生成/checkだけの公開8 JSON等の不変へ範囲を限定する。別途承認するv2形式移行を恒久的に禁止する要件にしない。両者の範囲限定は旧60dc/bb88の差分仕様と台帳へ反映し、既存Scenarioを保持した。この先行headに既にあるREQ-183等の差分と、REQ-322等の未移植の範囲限定を区別し、後段で残る規範差分を反映する。

REQ-040のskip時coverageはプロパティを省略する契約で、古いレポートを今回の成功一覧にしない。正常coverageの試験は今回のコマンドが新たにレポートを生成する経路へ移す。REQ-050の呼出しは --done --scope local --skip-commands --json、期待は不足1とする。500要件/1,000ファイルと3秒を維持し、同じfixtureの実際の抽出/対応判定関数を含む合計時間と対応件数も検査して処理量を減らさない。独立に解析したfixtureの一覧は公開coverageや品質合格へ使わない。

REQ-036/038のdone確認待ちは不足/要判断へ統一し、未承認仮定のdoneも旧warn/0から不足/1へ強める。未完了tasksと実施済み失敗のFAILとは分ける。これらとCLI基準の出力変更はR05 Aの承認済み方針であり、実際の既存assertion/46例fixtureの差分は、管理役が旧原本・assertion・処理量・期限・coverage・範囲の強度維持を検証し、REQ-324の具体差分への別途承認を承認者・日付・ADR参照・根拠付きで記録する。弱体化等を人へ例外承認依頼する経路は設けない。

REQ-114/115はlocal完了のv2証拠からDraft PRへ進み、本文にCI最終未確認を記す。REQ-164/315のEvidence 2/localの同一状態再試行はlocalゲートを省略せず、旧Evidence 1や過去の証拠から新しいci合格を作らない。REQ-203の承認後の案内/不足用語も合わせる。

## 4回目レビューで明示するMUSTの範囲

REQ-323/324はCLIリファレンス生成/共通定義集約単独の変更に限り、現在定義のない契約やhelp/usage/終了コード/8 JSONを変えないMUSTを適用する。別の改版を恒久的に禁止する仕様にしない。PR #155でarchive受入済みの正本とMODIFIEDを照合し、R05 AのMUST範囲変更と具体基準差分を区別して確認する。

REQ-306はverdictだけを返す純粋な集約APIを保ち、その定義変更単独でsummaryやverifyへ接続しない範囲に限定する。別changeの呼出し側からの接続まで禁じない。REQ-100は変更のある直しだけを所定のメッセージでcommitし、明示localの完了ゲートを再実行する。変更がなければREQ-331に従い再実行せず止まる。ローカル完了とCI最終合格を分け、REQ-205の純粋判断・Source・既存5 Scenarioを保持する。後段ではdesignの確認事項と残る実装準備（後段予定：`design.md#確認事項と残る実装準備`）にもこの整合条件を反映する。R05 A・R06 A・R08 Bの明示回答は旧作業木での反映事実と区別し、この先行headへ続く後段で規範へ移植し、承認元をtraceに残す。
