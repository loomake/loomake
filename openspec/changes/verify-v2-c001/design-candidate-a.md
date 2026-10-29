# 全Aの場合の設計候補（未承認）

## 位置づけと基準

R-C001-01〜03がすべてAとなる場合の、採否を判断するための具体案である。回答・回答者・回答日は未記入のままとし、承認済みの仮定を追加しない。いずれかがBなら該当部分を再設計する。この文書をそのまま実装指示や規範仕様にせず、採否後に必要な差分仕様へ反映し、仕様ゲートexit 0を確認する。今回、7 capabilityの差分仕様・製品・既存試験・設定は変更しない。

計画branchの作成基準はmain `f397109`。今回の製品調査基準はmain `f4e3edb`で、製品ソースが同一の専有worktree `codex-quality-reference-source-links`（head `77f9e2e`）を読んだ。#60は当時の未受入依存であったが、[PR140](https://github.com/loomake/loomake/pull/140)・[PR141](https://github.com/loomake/loomake/pull/141)で修正・仕様同期・archiveを受け入れ、2026-10-29T03:32:23Zにclose済みである。現在の実装停止理由は未回答3件と仕様ゲートである。

根拠は固定要件7.3、既存REQ-310・313・314・319等と元のDoDである。新しいREQ IDを割り当てず、品質/CLIで使用済みのREQ-320〜325も再使用しない。source/metricの綴り、以下のplan、S1基準準備・private handoff・producer mappingは、R-C001-03 Aの**新しい契約候補**であり、現行スキーマに実装済みとは扱わない。19項目の新質問を増やさず、技術事項と既存3質問の採否を区別する。

R01Aのbare品質専用経路は、架空のchange IDを補わず `change: null`、`scope: local` のcompleted/partial、verdictなしで表す未承認候補とする。quality.yamlを新たに要求せず、設定済みの品質コマンドだけを実行する。change必須gateの未指定はusageのaborted/2として区別する。bareの品質コマンドやspec-onlyの構造確認だけではCI最終PASSを作らず、明示ciでも必要な実施を確認できない結果は最終PASSにしない。通常のspec-only既定localは保持する。

## 最小の入力と観測

現行qualityスキーマに実在する `version`・`model`・`product`・`characteristic`・`blocking`・`evidence` と、その `source`・`metric`・`target`・`min_samples` を使う。案のsourceは `ci.test_report`、metricは `required_subjects_with_failed_tests`。値は「適格な実施済みfailedテストを持つ必須subjectの重複しない数」であり、「成功IDが見つからないsubject数」ではない。参考指標は表示・集計だけに使い、必須証拠を代替しない。

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

`min_samples` はREQの個数ではなく、適格性を満たす実行観測の個数とする案である。観測identityは `(report hash, 正規化したテストファイル, fullName)`。同じ観測の重複掲載は1件、1テストに複数REQがあってもサンプルは1件とする。承認済み必須subject集合への対応と、集合全体の実施充足も別に確認する。合成例ならREQ-313/319に対応する異なる3テストのpassed/failedを数えるが、実際のC001 DoDをこの2要件に限定しない。

既存のcoverage抽出はpassedだけを保持する。これを欠落判定の根拠に転用せず、adapterで必要最小限のstatus観測を別に追加する案とする。適格なpassed/failedと、missing・skip・todo・pending・未取得・未照合を分ける。failedは実施された違反の根拠になり、後者は不足の根拠になる。coverageの既存意味と旧assertionは維持する。

比較演算子は既存5種（<=・>=・==・<・>）を維持し、例だけを `== 0` とする。有限で完全な有効値、または当該比較の違反が確定する有効な実施根拠があるときに比較する。未完の集計値・数値0・成功IDのabsenceだけから暫定PASS/FAILを作らず、それまでは不足とする。適格な実施違反が確立したときに限り、ほかの不足と同時でも既存のFAIL優先を適用する。5演算子の境界試験はタスク3.2に残す。

### 検証計画の候補と照合順

現在のmainにはroot quality.yamlやverification.yamlはない。以下は新規の最小plan契約候補であり、OpenSpecがファイルを許容することと、内容を検証できることを区別する。候補配置はchange内 `verification.yaml` とし、予算付きInputReaderと専用validatorで内容を確認する。配置自体も採否後に行う。

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

REQ-314の未評価notPASSを、gateが混在するchecksでも保つ。候補check `quality:subjects` は品質対象0・全NA・必要証拠配列空ならINSUFFICIENT_EVIDENCEとする。構造gateやテストcommandのPASSで相殺しない。非ゼロの適用品質対象とplanへの結び付きを示すevidenceがあればguard自体はPASSにできるが、個々の品質条件の証明を代替しない。R-C001-02 Aならこのguardも含む全checksを `evaluated` に数える。NAには理由・確認者とquality定義へのevidence参照を付ける。

## 信頼する判定器と自己ゲートの段取り

S1の準備を先に受け入れる案自体がR-C001-03 Aの追加未承認内容である。公開版の発行・新しい鍵・新サービスを前提にしない。S1を置くだけ、schema 2だけを追加して実出力を1に残すだけでは、C001完了にしない。

| 段階 | 候補の作業と終了条件 |
|---|---|
| 採否前 | 質問3件は未回答。製品実装しない。採用する追加契約・保護された互換差分を人が判断し、差分仕様とtraceへ反映して仕様ゲート0を確認する |
| S1内部基準の準備 | 基準側で独立したbase-built checker/policy moduleとexact2.0.0 parser、承認spec/REQ集合、quality/plan/method manifestを準備する。anchor identityを明示的に固定・承認する。準備段階では公開v1を維持できるが、C001 DoD達成ではない。先に取り込む場合は、限定した内部checker/基準の準備を独立changeとその範囲のDoD・REQ対応試験・通常done 0で受け入れ、仕様同期/archive後に親C001のS2を行う |
| S2一体切替 | verify2/Evidence2へ実出力を切り替え、全利用側を同じ範囲で移す。正常self-ci、独立trusted check、全要件の試験・配布確認・元のDoDまで成立させる |

S1の独立change/REQ IDは今回作成・割当しない。A採用後、他担当・既用ID・同時3枠を照合し、1枠を確保してから準備する。未完了tasksを持つ親C001のdoneをS1 PRで合格扱いにしない。限定したS1自体が独立gateを通せる範囲にできない場合はR03Aの未決点として残し、親gate・自己task・必須試験を緩めない。

S2のnormal commandは `pnpm -s verify --change verify-v2-c001 --done`。提案済みのdone既定ciでreal v2/PASS・decision.required=false・exit 0を要求し、local 0で代替しない。独立checkerのPASSはこれに**追加する条件**である。

private runtime handoffは、基準側のcheckout/build済みmodule locator、計画・入力のlocator、結果出力先を渡す内部経路の案である。公開APIに必須schemas引数を増やさず、`--trusted-ref` やpublic provenance fieldも増やさない。locator/envは場所を指すだけで承認ではない。祖先であることやhandoffの自己申告hashだけでも信頼しない。expected anchorはtargetと独立したS1承認・基準側の固定情報から取る。

対象CLI/APIの判定は検証済みS1 base-built checker moduleを**直接load/call**して実行する。定義だけ読んでtarget側policyで判定する方式は採らない。実行前にmodule実体・依存graph・固定manifestのidentityを独立したexpected anchorへ照合し、実行中の変化も拒否する。private bindingを設定したという自己申告は、この照合の代わりにならない。

同じCIで自己待ちを起こさない段取りは次の候補とする。

1. 基準側controllerが承認済みS1を別checkoutでfrozen lockからbuildし、固定anchor/module/planのidentityを確認する。targetは別checkoutと専有出力先に置く。
2. controllerがtarget SHA・承認spec/REQ集合・quality・methodと環境を確定し、private handoffを準備する。targetが書いたmanifestを信頼anchorにはしない。
3. S1 checkerがその場でproducerを新規実行し、独立したfresh結果Tとreceiptを作る。現在実行中の集約CI自身の完了やGitHub required-checkを待たない。
4. 別invocationとして通常の上記done commandを実行する。target facadeはS1 moduleを直接呼び、新規実施の結果Sを返す。Sのexit 0だけでは受け入れない。
5. trusted coreでSとTをそれぞれ **exact `schemaVersion: 2.0.0`** として解析する。major 2という文字列だけでは受け入れない。Tを常に権威とし、Tとnormal Sの双方にci/PASS・要判断なし・exit 0を要求する。target/spec/必須REQ集合・quality/plan/method/producer・環境・required_by・check ID/result・summary/decision/verdictの一致を確認する。invocation固有nonce・時刻・receipt/report hashは個別の実施へ照合し、別実行ゆえの差分を許容する。

Sは一致検査の対象で、独立Tを置き換えない。S/T不一致やanchor不明はnotPASSとする。実行ロジック・methodの最小信頼をC003へ先送りしたまま正常PASSを宣言しない。PR側コードを任意に実行するhost全体の隔離や全providerの完全対策は別に残り、最小adapterで信頼できる実行経路の範囲・制約も採否材料へ含める。

候補CI jobの実装と検証は、設定の採用・実行権限の包括承認を意味しない。将来のrequired-check設定、公開・権限設定操作は具体的なcode/job/SHAと検証結果をそろえた後に個別承認を得るまで行わない。

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
| 必須quality/planのENOENT・read不能で評価対象が確定しない | runtimeまたはpermissionのaborted/3。読み取りをconfig/2へまとめない |
| quality/planの構文・型・版・内容が不正 | configのaborted/2 |
| 必須change未指定・値欠落・構文不正ID | usageのaborted/2、change:null。R01Aのbare品質専用経路とは区別 |
| 構文は有効だが存在しないchange | 既存REQ-055の存在check FAIL/1を保持。自動でusage/2へ変更しない |
| 品質対象0、全NA、または必要証拠配列空、gateだけPASS | quality:subjectsが不足。ci全体は不足/1。Aならguardを含めevaluated=checks.length |
| 有効違反に加えてdecision.required=true | checks/summaryへFAILを残して1。runnerは修正を続けず判断待ち |
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

kitの現在の直接依存はcoreだけでyamlはない。REQ-047の許容内でyaml依存とlock変更を提案する。coreの既存zod以外や新パッケージを当然に追加しない。sync loaderは下の実測に基づく最小案とし、必須schemas引数の追加を前提にしない。他6 JSON、Report2、RunSummary、履歴1の閲覧と元のDoDは削らない。

### 保護された互換差分 C1〜C5

| 候補 | 具体的な衝突・扱い |
|---|---|
| C1 REQ-055の旧verify形 | 現在の正確な{check,status:fail,detail}の期待値はv2形と両立しない。FAIL・日本語detail・exit1は維持し、形の変更はR01に結び付く保護差分として提示する。個別承認前に既存assertionを変更しない |
| C2 R01Aのmissing-change | change必須経路の--change未指定はaborted2だが、有効な非実在IDはREQ-055の存在FAIL1である。両者を混同しない。R01の意図が後者もabortedなら、便宜変更せず採否を踏まえて再設計する |
| C3 REQ-073 | Evidenceの未対応版2を拒否する現行Scenario/診断とEvidence2導入が衝突する。便宜的に未対応版を3へ書換えず、R01/R03の採否後に必要な規範差分・既存期待値変更の明示承認を得る |
| C4 埋め込み・公開型 | Evidence1を埋め込む型・smoke・report/reuseの旧定数を棚卸しする。履歴のbytes・documents省略を保持し、現行書出しだけをv2へ一体移行する |
| C5 診断・同期性 | stderr空や同期/予算の既存assertionを、観測warningに合わせて弱めない。配布時の実際の挙動を確認し、必要な互換変更は承認材料として残す |

これらは変更済み・承認済みではない。R01のbare経路の採否、R03の正常PASSの範囲と互換移行へ結び付け、要件番号の定義を便宜的に変更しない。

## 技術的に確認した範囲

以下は実装成功の判定ではなく、設計候補の実現性を限定して調べた事実である。実験は製品WTのignored `node_modules/.cache/` 内に保存した。

| 実測 | 事実・制限 |
|---|---|
| Node24.21.0 | actual core+kit distの静的import後quality-schema/Zod load0。関数内createRequire(actual core dist/quality.js URL)からactual quality-schemaを同期requireでき、非Promise namespace・safeParse・cacheを確認。runVerifyは通常Function。runVerifyへの接続は未実装 |
| 公式Node22.12.0 linux-arm64 | 公式SHASUMSとSHA256 `8cfd5a8b9afae5a2e0bd86b0148ca31d2589c0ea669c2d0b11c132e35d90ed68`一致後、同じ実graphを1回実行しexit0。同じ静的0/遅延同期load・parse・cacheを確認。require(ESM) ExperimentalWarningは実際にstderrへ出た |
| 観測器の診断 | Node22では専有V8 coverage観測器の終了時に「Precise coverage has not been started」も出た。原因の独立再現はしていない。loader失敗とは確認しておらず、stderr cleanとも主張しない |
| OpenSpec1.14.3 | scratchへ既存root/changeをコピーしたstrict control0。同一byteの.openspec.yamlをverification.yamlへコピー後もstrict0/issues[]。ファイル配置の許容だけであり、plan内容schema/意味の検証ではない |

証跡は同WTの `c001-technical-experiments-20261029/result.json` と `c001-node2212-technical-20261029/result.json`。[Node22.12公式docs](https://nodejs.org/download/release/v22.12.0/docs/api/modules.html#loading-ecmascript-modules-using-require)は同期ESM graphのrequireを扱い、TLA graphは対象外である。製品統合・tarball・CLIのJSON/日本語stderr/互換性は未検証。後日のnative CIと配布検証を必要とし、global warning抑制・設定緩和・既存assertionの無承認変更では解決しない。

## 採否と完了条件

R01はbare verifyの境界、R02はevaluated、R03は最小adapter・plan・producer mapping・S1/bootstrap/private handoffの追加契約と依存を判断する。日常的なsource照合・同期loader・利用側の追従は技術作業として扱い、3質問への人の回答を代行しない。

C003には全provider、全host隔離、広いCI成果物取得/再利用連鎖、最小接続以外のpartial取得経路、全禁止キーの網羅が残る。C001の最小接続の適格性・実施確認・必須のpartial/aborted分類はその残作業へ先送りしない。S2の実出力v2と全利用側移行、normal done ci/PASS・要判断なし・0、独立trusted TのPASS、全要件のID付き試験、全タスクと必須CI・配布検証という元のDoDを維持する。

著述3回のactual model/session/exit/denialsは[traceの出典](trace.md#全a候補と著述の出典)に記した。原文3稿はignored領域で無改変のまま保持し、本候補では指定された既存要件との整合を取った。追加AI評価0、過去PR139ローカル回数不明、上限リセットなし。独立レビュー・人の採否は未実施である。
