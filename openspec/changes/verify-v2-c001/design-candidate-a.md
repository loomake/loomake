# 承認済み決定に基づくS1/S2の設計詳細

この文書は設計候補だけの先行更新である。承認済み方針の履歴は保持し、規範specs・trace・tasksは後段で反映する。task 1.2とC001のDoDは未受入。後段で反映する節への参照先は予定のためコード表記にしている。

## 位置づけと基準

R01/02/03/04/07/09/10は[先の7件の明示回答](https://github.com/loomake/loomake/pull/139#issuecomment-6510041693)でA、R05/06は[追加回答](https://github.com/loomake/loomake/pull/139#issuecomment-6511434324)でA、R08は同追加回答でBと承認された。10件の決定はtraceへ出典付きで記録し、規範へ反映した。補足R11〜13の構造NA/scope/型付き観測・REQ205の採用条件はdesignの補足設計節（後段予定：`design.md#最終レビュー指摘に対する補足設計の採用`）を正とし、旧回答と区別する。localのOpenSpec CLI不在は理由付きNAとし、未実施をPASSと扱う不採用案は実装しない。製品・既存試験・設定は今回変更しない。S1の内部契約はtask 1.3で具体設計し、仕様ゲートと独立受入を経てS2へ進む。

計画branchの作成基準はmain `f397109`。今回の製品調査基準はmain `f4e3edb`で、同mainの製品ソースを調査した。#60は当時の未受入依存であったが、[PR140](https://github.com/loomake/loomake/pull/140)・[PR141](https://github.com/loomake/loomake/pull/141)で修正・仕様同期・archiveを受け入れ、2026-10-29T03:32:23Zにclose済みである。最新の仕様照合基準は通常mergeで取り込んだmain `d5aa30d7a9326be44ea4eac5145b5fa95529efce`。PR #155でCLI/URL両changeの同期/archiveも受入済みである。当初の反映基準はADR 0006を含むmain `e73fb3e`だった。現在は3製品PRと同期archive #168・表記整合 #166・依頼テンプレート #165を含むmain `5c71ae0584cabb9be18c15a6bb8cf9dfd4c0df17`で正本へ再整合した後、PR #169受入main `9a3fe04a89da68e67334a5b535bd5f967428a2b6`を通常統合している。方針回答は揃っているが、規範反映とS1の具体設計・独立受入、S2実装は別の作業として確認する。

根拠は固定要件7.3、既存REQ-310・313・314・319等と元のDoDである。新しいREQ IDを割り当てず、品質/CLIで使用済みのREQ-320〜325も再使用しない。source/metric・plan・producer mappingは承認済みR-C001-03 A、S1基準準備・private handoffは承認済みR-C001-04 Aであり、現行スキーマに実装済みとは扱わない。未実装の技術事項と過去10件の直接回答・補足R11〜13を区別する。

承認済みR01 Aのbare品質専用経路は架空のchange IDを補わず `change: null`、`scope: local` のcompleted/partial、verdictなしで表す。quality.yamlを新たに要求せず、設定済みの品質コマンドだけを実行する。change必須gateの未指定はusageのaborted/2として区別する。bareは明示localを受理し、明示ci・空/範囲外scopeを品質コマンド前にusageのaborted/2で拒否する。bareの品質コマンドやspec-onlyの構造確認だけではCI最終PASSを作らない。通常のspec-only既定localは保持する。

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

REQ-314の未評価notPASSを、gateが混在するchecksでも保つ。候補check `quality:subjects` は品質対象0・全NA・必要証拠配列空ならINSUFFICIENT_EVIDENCEとする。構造gateやテストcommandのPASSで相殺しない。非ゼロの適用品質対象とplanへの結び付きを示すevidenceがあればguard自体はPASSにできるが、個々の品質条件の証明を代替しない。承認済みR-C001-02 Aに従いこのguardも含む全checksを `evaluated` に数える。NAには理由・確認者とquality定義へのevidence参照を付ける。

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

対象CLI/APIの判定は検証済みS1 base-built checker moduleを**直接load/call**して実行する。定義だけ読んでtarget側policyで判定する方式は採らない。実行前にmodule実体・依存graph・固定manifestのidentityを独立したexpected anchorへ照合し、実行中の変化も拒否する。private bindingを設定したという自己申告は、この照合の代わりにならない。

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
| auto OpenSpec CLI不在 | localは承認済みR08 Bの理由付きNA、ciは不足1。いずれもstrict実施済みとは報告しない |
| doneでskip-commands | local/ciとも品質コマンド不足1。古いレポートで成功を補わない |
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
| trace report | Report2の既存外形・日本語行へ投影。coverageの既存意味と保存文書を保持。旧1は履歴閲覧専用、local/旧版の表示okを自動ゲートにしない |
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

R-C001-05 Aで非互換範囲は回答済みであり、製品実装・具体的assertion差分の適用は未実施である。差分を棚卸しし、旧原本と検査強度を保持して確認する。ADR 0006に従いテスト弱体化・設定緩和・範囲縮小は禁止する。R01のbare経路とR03/04の正常PASSの範囲にも結び付け、要件番号の定義を便宜的に変更しない。

## 既存assertionの移行点（task 1.2）

次は現mainの既存試験を読んで整理した変更予定であり、今回のPRでテストを変更した記録ではない。具体的なコード差分は実装タスクで提示し、旧fixture・旧46例の原本と検査強度を保持する。承認済み仕様への形式移行と、実装の都合に合わせた期待値変更を区別する。後者と、skip・設定緩和・範囲縮小は行わない。

| 要件・保護差分 | 実際の既存試験・assertion | 採用契約に沿う移行と保持する条件 |
|---|---|---|
| REQ-036/037/038/039/191・C5 | `packages/kit/test/verify.test.ts` のwarn、fail、skipと `packages/cli/test/arguments.test.ts` のresults/skip | v2のchecks/result/reasonへ追従する。spec-onlyの案内0、doneの未承認/確認待ち/skip不足1、auto不在localのNAとci不足を個別に検査する。未完了tasks・実施失敗のFAIL、明示trueのvalidate失敗、未知キー名と再実行案内を保つ |
| REQ-040 | `packages/cli/test/cli.test.ts` のschemaVersion 1.0.0とskip時coverage完全一致 | 現行2.0.0のschema検証と、今回のtestコマンドが新規生成する成功coverage一覧を検査する。skipは別に不足1・coverage省略を検査し、正常coverageを単に削除しない。stdoutがJSONだけ、進捗stderrも保つ |
| REQ-042 | `packages/cli/test/cli.test.ts` のbare verify commands専用 | change:null/local/verdictなしで品質コマンドだけを実行し、quality.yamlを新たに要求しない。架空changeで代替しない |
| REQ-050 | `packages/cli/test/cli.test.ts` の500要件/1,000ファイル、skip経路のexit0と3000ms未満 | 明示local・skip不足1へ移行する。抽出/対応判定の実関数を同じfixtureで連続計測し、合計3秒・500要件全件対応を保持する。処理量や時間閾値を緩めない |
| REQ-055・C1/C2 | `packages/kit/test/verify.test.ts` の存在検査の厳密なcheck/status/detail一致 | 旧構造の原本を履歴試験へ保ち、現行は対応するv2 checkのFAIL・同じ日本語理由を検査する。有効な非実在IDの存在FAIL/1と、change未確定のusage aborted/2を分ける |
| REQ-073・C3 | `packages/trace/test/report.test.ts` のschemaVersion 2拒否、results欠落、パス/診断/終了コード2 | v1履歴の解析と拒否fixtureを残し、現在のEvidence 2/verify 2.0.0の受理と状態別必須欄欠落拒否を別に検査する。未対応版検査を便宜的な数値置換で済ませず、新旧の対応版と未対応版・同じ日本語案内/2・スタックなしを確認する |
| REQ-093 | `packages/runner/test/run.test.ts` のブランチ未作成・エンジン未呼出し・不合格1 | 既存条件を保ち、usage/config aborted2とその他aborted3の停止を追加する。成功経路だけを確認して終了しない |
| REQ-114/115 | `packages/runner/test/pr.test.ts` の証拠コミットが先、向き先保持、本文順序 | local完了のEvidence 2とDraft PRへ追従し、本文にlocal完了とCI最終未確認を分ける。コミット/push/PR順、向き先不明時停止と未記録、要件別テスト表を保つ |
| REQ-135/194/041・CLI旧46例 | `packages/cli/test/cli.test.ts`・`arguments.test.ts`、`packages/cli/test/fixtures/reference-cli-baseline.json`、`tests/cli-reference.test.ts` | helpの全既存オプションとstdout/0/処理なしを保ちscopeの受理値/既定値を追加する。値の空白/等号構文と空値拒否も保つ。旧46例原本は残し、v2の変化と追加例を別の明示基準へ整理して共通定義・生成ページ・配布CLIを同時照合する |
| REQ-136 | `tests/kit-assets.test.ts` の既定ciコマンド文字列と `packages/runner/test/run.test.ts` の完了ゲート印 | 両req-to-openspec雛形の明示localコマンドへ追従し、印の存在・エンジンに渡さないこと・成功時だけ完了の検査を保持する。最終ci確認をローカル完了で代替しない |
| REQ-164 | `packages/runner/test/publication-retry.test.ts` の同じ証拠/コミット/PR、旧証拠と改変時停止 | Evidence 2/localの同一状態に限る再試行と、旧Evidence 1の非再利用を検査する。再local検査、親SHA・文書snapshot、改変証拠の保存、重複公開の防止を保持する |
| REQ-124/208/337・制限観測 | `packages/runner/test/run.test.ts:548–584`・`signal-during-sync.test.ts:115–171` のresults/detail、中断状態と厳密な理由一致 | 未完了checkを不足、run.errors runtime/partialとし、v2 check.reasonへ中断で止めたこと・監視役の理由を同強度で移す。onLimitは実原因から通知し、理由なし/空文字付き理由を区別する。実観測不能かつlocal未完了の理由なし中断は「中断されました」を保ち、旧assertionを削らない |
| REQ-183 | `packages/runner/test/external-budget.test.ts` の期限と中断、`packages/kit/test/process-startup.test.ts` | 時間・出力・共有予算の回帰をそのまま保つ。JSON版不変は予算単独変更の範囲とし、C001の形式移行を理由に資源制限を緩めない |
| REQ-203 | `packages/cli/test/trace-agreement.test.ts` の承認/承認者/日付・警告消失 | 同じ承認記録と対象外の不変を保ち、承認後はspec-only案内とdone不足/要判断から該当IDが消えることを検査する |
| REQ-275/276/305/307・C4 | coreの`verify-result-schema.test.ts`・`json-schema.test.ts`・`quality-result-schema.test.ts`・`unknown-fields*.test.ts`と`scripts/schema-contract-check.mjs` | v1履歴とv2現行を版別に検査し、特殊未知キー・既定値・型・遅延ロード、必須項目削除/改名の変異検出を保持する。verify/evidenceだけを現行形式へ移し、無関係6 JSONのbyte不変と旧版exportsを検査する |
| REQ-322〜325 | `tests/quality-reference.test.ts`・`tests/cli-reference.test.ts`・`tests/package-artifacts.test.ts` | quality生成/checkとCLI共通定義集約単独の不変条件を保つ。C001の明示改版ではscopeを共通定義・生成文書へ同時反映し、既存URL4 Scenarioと生成/check一致を保持する |
| REQ-143/155・配布/導入試験 | `scripts/package-smoke.mjs` のverified.ok/coverage25件と`scripts/ai-journeys.mjs`のdone/trace、`tests/package-artifacts.test.ts`・`tests/ai-journeys.test.ts` | 実tarballの公開API/型・履歴データと、3つの導入/通常/復旧シナリオを保つ。quality/planと必要な実証跡を用意し、local完了と最終ciを分ける。旧.okの比較をただ消さず、v2の状態/scope/decision/終了コードと25要件/行の対応を照合する。失敗・復旧・未コミット拒否を省かない |

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

著述3回のactual model/session/exit/denialsは[作業記録](../../../docs/worklog/2026-10-30/spec-verify-v2-c001.md)に記した。原文3稿はignored領域で無改変のまま保持し、この詳細では指定された既存要件との整合を取った。当時の追加AI評価0という記録を保持し、方針の採否はその後のPR #139で回答済みである。当初の規範反映では既存設計を再利用し、新規Opus設計は実施しなかった。その後、最終レビューの指摘を受け、2026-10-30に独立Opus補足設計2回を実施し、採用条件をtraceへ記録した。

## 承認済みの追加互換差分（R05 A）

REQ-183は予算/後片付けだけの変更の版不変、REQ-322はquality生成/checkだけの公開8 JSON等の不変へ範囲を限定する。別途承認するv2形式移行を恒久的に禁止する要件にしない。両者を差分仕様と台帳へ追加し、既存Scenarioを保持した。

REQ-040のskip時coverageはプロパティを省略する契約で、古いレポートを今回の成功一覧にしない。正常coverageの試験は今回のコマンドが新たにレポートを生成する経路へ移す。REQ-050の呼出しは --done --scope local --skip-commands --json、期待は不足1とする。500要件/1,000ファイルと3秒を維持し、同じfixtureの実際の抽出/対応判定関数を含む合計時間と対応件数も検査して処理量を減らさない。独立に解析したfixtureの一覧は公開coverageや品質合格へ使わない。

REQ-036/038のdone確認待ちは不足/要判断へ統一し、未承認仮定のdoneも旧warn/0から不足/1へ強める。未完了tasksと実施済み失敗のFAILとは分ける。これらとCLI基準の出力変更はR05 Aの承認済み方針であり、実際の既存assertion/46例fixtureの差分は、管理役が旧原本・assertion・処理量・期限・coverage・範囲の強度維持を検証し、REQ-324の具体差分への別途承認を承認者・日付・ADR参照・根拠付きで記録する。弱体化等を人へ例外承認依頼する経路は設けない。

REQ-114/115はlocal完了のv2証拠からDraft PRへ進み、本文にCI最終未確認を記す。REQ-164/315のEvidence 2/localの同一状態再試行はlocalゲートを省略せず、旧Evidence 1や過去の証拠から新しいci合格を作らない。REQ-203の承認後の案内/不足用語も合わせる。

## 4回目レビューで明示するMUSTの範囲

REQ-323/324はCLIリファレンス生成/共通定義集約単独の変更に限り、現在定義のない契約やhelp/usage/終了コード/8 JSONを変えないMUSTを適用する。別の改版を恒久的に禁止する仕様にしない。PR #155でarchive受入済みの正本とMODIFIEDを照合し、R05 AのMUST範囲変更と具体基準差分を区別して確認する。

REQ-306はverdictだけを返す純粋な集約APIを保ち、その定義変更単独でsummaryやverifyへ接続しない範囲に限定する。別changeの呼出し側からの接続まで禁じない。REQ-100の整合条件はdesignの確認事項と残る実装準備（後段予定：`design.md#確認事項と残る実装準備`）を参照する。R05 A・R06 A・R08 Bの明示回答を規範へ反映し、承認元をtraceに残す。
