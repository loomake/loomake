# Context

当初の基点はmain `085a82686dc1c14506fbdbad88b5b9b3961f522e`。a3bf248bの設計とV0・9sampleの基点はmain 9758 系の取込後の head `8d8587aaf1741575957808e59e623b18e32cefa2`。今回の追加設計cd321d46の対象はmain acce34fb（PR228）取込後の head `995e63257d7cadae128afa0ab28e42ce959fbb94`。4計画fileと現REQ-347は8dからbyte同一で、差分の基点は維持する。当初の基点と原資料は履歴として残し、現在の受入に旧測定を流用しない。利用者のdelivery指示1-1、管理役Q01〜Q10、補足設計62aba81dとQ-N1〜Q-N5の採用をこの起案へ反映する。原文・版・hashは専用treeの`.loomake/ci-formal-adoption/inputs/`と索引へ保存した。C1の正式起案を終え、管理役の指示によりC2〜C5の独立実装へ進む。ここに記す未実装・未実測の受入を、先行着手だけで完了としない。

# 仕様と運用の境界

REQ-144のNode20追加検査だけを削るMODIFIED全文を使い、3OS Node24とNode22.12.0の下限契約を残す。049/214はADR0005の開発運用としてREMOVEDのReason/Migrationを付け、取得時の全文・全Scenario・Sourceと旧試験名をdocs/dev/ci.mdに保存する。運用変更は利用者が明示したNode20削除とPRのslow不実施に限り、移管を試験の削除へ読み替えない。main正本は実装と受入の後、対応スキルのsync/archiveを通じて更新する。

CI側の049に由来する273タグは後続実装で外すが、agents-rulesの273や旧履歴を変更しない。Source270の文書判定など別契約も保つ。衝突の解消はB1に引き継ぎ、今回のタグ変更で解消済みと記録しない。

# case分割と測定

各OSで最新headの3sampleを集め、caseごとの最大が10秒を超えた集合をそのOSのslowにする。歴史資料の108key/14fileは候補であり、新headの合格値ではない。OS pathの正規化、同じfile/fullNameの重複3件、Node24.21/24.22混在を旧観測の制限として保持する。重複は多重集合で照合する。parameter行の閾値が混在する場合、Q-45〜Q-52で採るliteral表の行登録に限り、2.7のV2受入後に葉IDごとに分ける。未対応の表は未割当・未達を保ち、表全体を同じ側へ送らない。実OS割当は4.2の成功と個別設計の受入後に限る。推測で実測の遅さを取り消さない。

Opus設計 a3bf248b の Q-R1 おすすめAは、元 `x.test.ts` の各 `it` 呼出し直前に `if (has(id))` を足し、本文を元ファイルに残す方式である。slow companion は同じファイルを動的 import する。`it`/`test` の先頭から閉じ括弧までを変えず、同じdescribe/it名・parameter・assert・timeout・hookを保つ。元 `x.test.ts` から `x.cases.ts` へ本文を移す旧案は、本文ブロック監査の source を失うため採用しない。この見直しは採用済み4fileを含む14fileに及ぶ。skipやtestNamePatternによる未実行化は使わない。現行の`scripts/lib/test-partition.mjs`のcase IDとOS別集合、未登録IDの拒否、caseがないファイルの選択除外を実装時に検査する。旧`tests/test-split.ts`の重複prototypeはQ-40に従って後続で整理し、この計画更新では削除しない。case IDは新しいREQ番号ではない。

当初のQ-R2 Bは登録構造もPR184内で扱う決定だった。後の差分200KiB上限とQ-38により、開発基盤・測定・監査・実登録を段階的なPRへ分ける。Node20削除と全PRのslow不実施は最後のPR184で同時に有効にし、途中のcarrier登録を1-1の完成とは扱わない。Q-R3 Bの採用に従い、実OS割当が確定する前に実registryを非空にしない。fixtureで行う技術検証と実repoの登録を区別する。管理役はQ-R2 B・Q-R3 Bを採用し、Q-R1 AはV0とcd321d46の静的検査方針を踏まえて元file内方式として採用した。Q-R1bの具体化とQ-A1〜Q-A6のおすすめAも採用する。判断元・ADR0006の回答者・日付をtraceへ記録し、scopeとspec-onlyを実装前に確認する。

当初設計済みのexternal-budget、ai-journeys、domain-mutations、package-artifactsの4fileと、今回のrun登録構造案を区別する。残9fileの具体設計、既存4fileを含む14fileの元本文・監査・登録対応の再照合、凍結PR179診断の統合照合は未完了である。全文のfixture/hook/callerと関連Requirementをそろえて先に設計する。重い処理をbeforeAllへ移してcase時間を隠さない。PR179を単独受入・マージする経路は廃止し、凍結head `3571c208` の診断をstabilize-cross-os-testsへ引き継ぐ。吸収先の担当と統合境界・重複・順序を管理役が確定したうえで、最新mainの元case/parameter/assert/timeout・診断対象とcompanion/shard対応を照合する。境界が未確定の間はcase本体を分割しない。helperのPR220はmainへ受入済みであり、統合後の現行sourceを使う。E3/helperの影響はfresh diffと再測定で扱い、8d時点の担当境界を現在の未マージ作業とは扱わない。

測定経路はpush `ci/measure-*`専用とし、同じheadで3OS各3sampleの全件を実行する。PRへslowを戻さず、新しいrequired statusにも加えない。失敗や未計測を0や成功に変えず、checkout SHA・実行版・case数・結果とraw timingを残す。8dの旧full測定9sampleは7成功・Windows2失敗であり、Node patch混在と自己PID/hostによる厳密名の差もある。Windows sample2/3のTempケースは既存120秒、sample2のpackage-artifactsは既存60秒のtimeout失敗がある。測定や閾値を変えて成功に読み替えず、4.2は未受入のまま原因・同一性・受入条件を確認する。

# 登録構造と監査の設計（cd321d46採用）

追加設計はREQ-347と独立した宣言inventoryだけを対象にする。監査とinventoryの先行実装2.5は、残9fileの個別設計3.2と並行でき、本体分割ではない。実registry、run.test.ts、Vitest config、既存partition検査規則、extractTestBlocks/blockDigestの規則は変えない。新しいRuntime依存は追加せず、ASTにはrootの既存devDependencyであるTypeScriptを使う。REQ-189/190/346と元REQ-347の本文・3Scenario・Source、レビュー表の理由・状態・ハッシュを保つ。

## AUDIT-347のデータ経路

1. auditRepositoryとmigrateRepositoryの両入口で、JSON_LIMITSのreaderからtests/test-partition.jsonを読み、JSON.parse後に既存validatePartitionへroot内のexistsSync/isFileを渡して検査する。一覧の欠落もエラーとする（Q-A1 A）。失敗は既存CLIの終了コード1へ伝え、出力先を作る前に拒否する。
2. 新しい純粋関数companionLinks(registry, readText)がMap<companion, source>を作る。登録済みSのC=companionOf(S)に試験宣言がないこと、文字列リテラルを渡す動的importがちょうど1つで元Sの同じ場所の.jsだけを指すこと、別の.test.js/.test.tsへの静的fromがないことを構造で確認する。Cの重複も拒否する。文字列の雛形への完全一致は求めない（Q-A6 A）。不正な一覧やCはエラーにし、監査成果物を作らない。
3. readExecutions(root,input,links)は既存のposix正規化後のrawを使い、各行をfile=links.get(raw)??raw、rawFile=raw、fullName、statusの新しいオブジェクトへ変換する。登録外Cはrawのままで、名前によるmappingをしない（Q-A2 A）。登録外Cのrepo内検出は独立inventoryが担う。
4. sourceの読み取りは論理fileであるSごとに行い、元のblockDigestと本文の順序で照合する。raw reportのbytesとtestReportSha256を変えない。audit inputsに一覧の生テキストのpartitionSha256とcompanions:{C:sha256}を追記する。renderAuditはrawFileとfileが違う行をS（C）: fullNameと表示する。
5. auditScenariosのselectedだけを入力行オブジェクトの同一性によるSetにする。同じオブジェクトをoverlap selectorが複数回選んでも1回とし、別の入力行ならfullNameが同じでも残す。各selectorのhash・全status・Sourceの検査は変えない。新しいbaseline入力/APIは導入しない。
6. migrateRepositoryにも同じlinksを渡す（Q-A3 A）。migrateReviews本体やREQ-346の条件は変えない。旧形式はS全体のhashで照合し、prefixにより全体hashが変わった旧根拠を勝手に有効化しない。dry-runと既存block形式の不変を保つ。

PRでslowを実行しないと、そのcaseを選ぶ根拠は監査でinvalidになる場合がある。これを正直な結果として受け入れ、docs/dev/ci.mdへ書く（Q-A4 A）。別reportの合流や判定の緩和で補わず、main pushの全件実行と最終受入を別に確認する。追加設計はtrace未読と明記しているため、ここでのQ番号対応と採用記録は管理役が行い、モデルがtraceを読んだとは記録しない。

## REGISTRY-INVENTORY

新しいscripts/lib/test-declarations.mjsはテスト専用とし、監査からimportしない。inventoryDeclarations(source,file)はCRLF正規化後、TypeScript ASTの最外CallExpressionからit/testおよび既存scannerと同じ命名規則の宣言を独立抽出する。each・runIf・型引数・tagged templateを含める。結果はdeclarations/nonCall/scannerCandidates/expandedRows/errorsとし、最後にscannerと開始位置・end・本文を照合する。

syntax、scannerMismatch、scannerFalsePositive、unclassifiedCandidate、alias、dynamicTitleを別の検査codeにする。end<0の既知の非callを許可する親は、別名でないImportSpecifierとPropertyAssignmentの名前だけとする。壊れた宣言、export/fn引数/shorthandのit、alias、動的titleを黙って除外しない。scannerのend<0をまとめて捨てるfilterは使わない。

checkRegistration(file,source,cases)は、宣言のliteral IDを持つif(has(id))、elseがないこと、kebab-case/req-禁止、重複/未知/欠落ID、has/hasAnyのliteralと既知ID、includeCaseのfile literal、各OS/partの空describe guardと子孫ID集合の一致を検査する。error codeはunprefixed/invalidId/duplicateId/unknownId/missingId/dynamicGuard/includeCaseTarget/unguardedDescribe/guardMismatchを保持する。

995e時点の範囲はrun.test.tsと登録済みfileだけ（Q-A5 A）であり、受入済みmainの移動後は下記baseline照合に従って元の2宣言も検査する。実registryは空のまま、repo内の全*.slow.test.tsが登録済み元fileのcompanionであることを別に検査する。995e基点のrunの期待値は60宣言（直接57、each2、runIf1）、62候補、既知の非call2、展開70行である。AST結果と60宣言の一致自体はOpus未実測であり、実装時の最初のscope確認で違いがあれば設計へ戻す。すべての正/負fixtureとerror codeを対応させ、実caseの登録やOS割当はここで行わない。展開行数を確定できないdynamicな表/行も黙って除外せず報告し、既存の検査codeで分類できなければ設計へ戻す。将来mainで宣言の移動やcount変更が入った場合、期待値を実装に合わせて書き換えず、移動前後のcase保持を示す別の承認済み証拠と照合してbaselineを再確認する。

## 受入済みmainの移動後baseline

計画適用後にmain d799ea4f（PR231など）を取り込み、現在の基点はecdbac3ac411038756be02c3bbbbd81ecdbb1322となった。995eのrun60宣言/62raw候補/70展開行は履歴として残す。現行runは58宣言/60raw候補/68展開行、run-timeoutは移動したREQ-105の2宣言/3raw候補/2展開行である。合計60宣言/70行を保持し、raw候補の計63は移動先のimport識別子itという非call候補が1つ増えた結果である。候補と宣言を混同せず、既存の許可親による分類で扱う。

native scannerで995eのrun60本文blockと現行run58＋run-timeout2の文字列多重集合がbyte同一であることを確認した。ASTとscannerの有効宣言位置・本文範囲も現行2fileで一致し、展開行は68＋2だった。external-budgetも旧11本文block＝現行8＋external-budget-deadline3でbyte同一だった。元のassert・timeoutなどを含む本文の保持を確認したのであり、実行後の全case受入やOS割当を完了とはしない。

旧runの58selectorは現行run56＋run-timeout2へ移り、レビュー行ID・contains・hashScope・sha256などfile以外の全fieldは同一だった。REQ-347差分と監査sourceは変えず、2.5のlive inventoryはrunと移動先run-timeoutの2宣言を合わせて元scopeを保持する。既存期待を実装へ合わせる変更ではなく、受入済みmainの移動と独立した本文/selector保持の照合を根拠にbaselineを更新する。残る登録済みfileの検査、実registry空、監査/品質/全受入の条件は保つ。

非literalなeach表などで展開行数を確定できない場合はprivateな開発用診断code dynamicRowsで未確定を示し、宣言自体を保持する。文字列でない試験名を表すdynamicTitleは流用しない。 親のdescribe.eachなどで実行回数が変わる未対応構造も、行数を1と確定せずdynamicRowsとする。Vitestのnamespace参照やその別名を未分類のまま除外せず、独立inventoryはaliasとして拒否する。companionの自身の宣言なしという条件はscanner候補0だけでは証明せず、namespace・別名経由の標準Vitest宣言も独立した構造検査で拒否する。重なる不正条件の診断は抑制せず、負のfixtureで期待するcode集合を確認する。

## 保持と欠測を確かめる範囲

V0は8d・Linux・Node24.21.0・Vitest5.0.5の隔離fixtureの証拠である。動的importのfile/fullName、timeout80msの83.8045ms対設定なし5011.0856ms、混在/全fast/全slowの各7件の一度だけ登録、既定module隔離、空describe guard、run60blockのprefix外本文一致を確認した。実run全件・3OS・58selector監査の合格ではない。

8dの9sampleではrunの2つのit.each全12行がすべてpassed・10秒以下（最大5268.1718ms）だった。今回のrun2宣言がuniform fastである旧観測に限り、他9fileや995e以降の割当の根拠へ一般化しない。最新headと実装後headの測定は4.2/4.5で別に受け入れる。関連10file108試験はb98取込head bc8ba80で成功した。995eは文書変更の追加で、管理役は検査対象11sourceがbc8ba80とbyte同一であることを確認した。995eで108試験を実行済みとは記録せず、8dの全9sampleや次の実装の合格に代用しない。

複数本文blockを選ぶselectorで一部blockの実行が欠ければ、選ばれたblock集合のhash相違で検出できる。一つのit.each内の一部parameter行がreportから欠けた場合までhashで証明したとは扱わない。全parameter・正当な同名17行を含む元全caseの保持は、partition helperに依存しないraw全caseの多重集合比較を4.3/5.1の必須受入に残す。失敗/skip/todoが実結果にあれば元のstatus検査で無効とする。

## 2.5の変更対象と確認

scripts/scenario-audit.mjs、tests/scenario-audit-scope.test.ts、新しいscripts/lib/test-declarations.mjsとtests/test-declarations.test.ts、docs/dev/ci.mdを対象にする。scope testのprepareは空registryを既定で用意し、既存assertを弱めない。AUDIT-347の11fixture群（正常・status/Source不一致・登録外・一覧/C不正・本文/Cコメント変更・複数block欠測・同名別行・overlap・既存状態・migrate）をREQ-347付きで検査し、raw bytes/レビュー表/旧形式移行条件を保持する。開発用inventory試験には虚偽REQタグを付けない。既存scenario-audit全試験も実行する。

# guards・run-no-changeの追加設計（5753a1af）

G-Bの元test内prefixとcompanion方式を採用する。本文を変えず、実registry登録とprefix追加は測定後の同じ4.3で行う。guardsの37宣言/52候補/40行、run-no-changeの12宣言/13候補/25行はモデルの静的読取値であり、実装担当が独立ASTで照合する。モデルは候補44と数えたが、同じ3d664のsourceを管理役と実装担当が独立実測し、52候補＝37宣言＋import1＋propertyKey8＋通常helper6と確認した。本文を変更せず、未実測だった静的見積の漏れを訂正し、宣言37/展開40は一致した。

2026-10-31、受入済みmain d04e212f（PR235）を取り込んだhead 22be0369を照合した。3d664093のguards37宣言は本文の文字列多重集合をbyte同一で保持し、追加はrunner-git-reads-batchのREQ-348に対応する通常itの2宣言だけだった。現行guardsは39宣言/54候補/42展開行で、import1・propertyKey8・通常helper6は変わらない。旧37/52/40は当時の基準として残し、live inventoryでは現行の正確な数と追加2件の正確な試験名を検査する。run58/60/68、run-timeout2/3/2、run-no-change12/13/25と全既存assertは保持する。実registry・元本文・製品コード・Requirementは変更しない。

Q-G1は推奨Cとし、each行の閾値混在が実測されるまで追加のwrapperや本文変更を実装しない。混在があれば未割当のまま具体設計を追加し、fast行を表ごとslowへ送らない。Q-G2は推奨Aを採用し、同fileのconstで定義された通常fixture helperの宣言名・非call参照をbindingに基づいて非宣言と分類する。withTest6候補を検査対象から消さず、テスト関数を指す初期値やそのaliasは拒否する。元run/timeoutの検査を保持し、2.5でこの2fileと正負fixtureも独立照合する。Q-G3は推奨Aの条件付き採用とし、最新測定でWindows隔離中の3試験が成功した場合だけ4.3の登録と同じcommitで隔離を解除する。失敗時はBの未登録・未達を保ち、隔離/分割の重複拒否を変更しない。

モデルはADR本文未読と明記した。AGENTSとworkflowのRead、actual Opus5-5/read-only/拒否0と管理役の全文読了を確認し、管理役はADRのおすすめ回答・品質維持・人の操作の境界を照合した。3規約のRead済みや新しい人のレビューとは記録しない。異なる不正条件が重なる場合の診断は抑制せず、負のfixtureで全code集合を確認する。独立全case比較は有効な登録対応だけでCからSへ戻し、名前の推測mappingを採用しない。

# Vitestと共有build

unit/package/slowの名前付きprojectを保つ。GitHub Actionsのpull_requestではslow projectを構成から外し、quality/gate/ci:all-osとshardを含む全PR経路でslowを実行しない。main pushとscheduleでは全件を実行する。ローカルの通常test/doneとreleaseの既存manual dispatch品質ゲートは全件を維持する。

root globalSetupがbuildAndPackしてprovideし、packageとslowがinjectする。project間の同module memo共有や0caseならsetupが動かないという反証済みの仮説を使わない。rootの判定、選択project/file、inject欠落の失敗、build/pack失敗時のcleanup、正常終了とwatch再実行の寿命を実repoで検査する。unit-onlyで不要buildが起きる経路は実測して記録する。package fixtureの準備をcase内でどう保つかも再測定する。独立コピー依存を使い、共有依存のshimを変更しない。

# 保持する契約と品質判定

REQ-161は元の全体試験をslowに残し、元13条件を実際に1つずつ変えて既存テストが検出するfast試験を足す。選択肢をrunnerへ追加するときも既存CLIの既定動作と結果形式を変えない。baseline成功、同じテストの過不足ない実行、assertionによる検出、未検出と試験エラーの区別、ハッシュと元source/test/reportの不変を確かめる。タグや合成した成功結果を実証の代わりにしない。

REQ-297はmainに残す。元4case、Linux/macOSの19.5秒とWindowsの39.5秒の下限、既存の上限、保持役の準備待ちの差だけを引く時計、retryと全assertを保つ。auth/listの同タグをpush/createのfast実証とは呼ばない。291/292/296/297の実行条件不変は、その診断・時計機能のOS/Node/env/sample/case/元判定を守る条件であり、今回の利用者が明示したevent/slow分離を永久に禁止する意味ではない。失敗後保存と未計測の扱いも保つ。

coverageの94/89/96/97、local full done、選択changeのADDED/MODIFIED live Sourceに対するpassed対応を維持する。古いreportの合流、虚偽REQタグ、閾値緩和で通さない。C001の未採用v2/scopeを現在のci-gateやverifyへ混ぜない。PRで実際に検査した範囲とslow未実施を正直に記録する。

# workflowと人の規則操作

後続実装でci.ymlのnode20ジョブを削り、node22の下限検査とquality/gate/CodeQLを残す。workflow文字照合はnode22とgateなどの実在する境界を先に検査してからsliceし、`indexOf=-1`の誤成功を防ぐ。診断記録の非対象ジョブ、prepare→指定runtime→offline check、continue-on-error禁止を保つ。REQ-144の旧Scenarioを参照するdocs/quality/scenarios.jsonも正式MODIFIEDの2Scenarioとの対応を確認し、必要なmigrationを同じPRで行う。

診断2本分の受入意図は保持するが、profile-publication-retryはPR190のA-07で採用されず、現行mainには存在しない。後継quality-quarantineはWindowsのpublication-retry全fileをunshardedで選び、診断とraw reportの保存を試みる。隔離解除後の診断先、main push/scheduleの起動、独立3sample、元case/companionの選択と保存・privacy・時計の具体設計はA1の未完了条件として3.1に残す。旧179のworkflowを復活させると決めず、4.4の受入範囲も縮めない。profile-slow-testsとpublication診断の後継経路では、元ファイルとcompanionの4pathを選ぶ意図とmain push/scheduleだけで起動する条件を保つ。元のcaseId集合と3独立sample、診断のprivacy/保存上限/失敗時保存を保つ。Q04/N3の手動起動撤去はこの2本に限る。既存releaseのmanual dispatchは公開に必要な全件品質ゲートとして残す。これは利用者のPR軽量化をrelease検査縮小へ広げないための管理役の包括承認による明示判断であり、release実行の証拠ではない。

ruleset mainの変更案はrequired_status_checksからnode20 contextだけを除く。他のgate、quality (ubuntu-latest)、CodeQL、node22と全rule/parameterを保つ。実装headのローカル受入と他4check、改訂ADR 0006の段階別レビュー条件をそろえ、廃止したnode20だけが期待どおり未成立であることを分けて示す。管理役がfresh GETと具体差分をIssue121の@rrr-xxxへ渡し、人の操作後のfresh GETで保持条件を照合し、全残存required成功の後にマージする。dummy check、管理役のPUT、保護の迂回は行わない。Codexは参考としてPR末尾の証跡ブロックへ記録し、必須条件には加えない。

# 工程と未完了

内部工程はtasksに従い、Q-38の段階的PRで受け入れる。change全体の完成は最後のPR184とマージ後の必須受入まで保留する。管理役はC2のNode20削除、C3のroot共有準備、C4の空registryを用いる純粋helper/slow足場、C5の実13条件試験を先行可能と指定した。これらは採用済み62abaの範囲に限定し、未測定のOS割当や未設計case本体を加えない。凍結head `3571c208` の診断を引き継ぐ吸収先との統合境界・重複・順序の確定と残9fileの個別設計と14fileの対応再照合は、case本体分割と最終同head測定の前提として残す。統合後に元caseを固定し、先行実装もfresh差分・測定・完了ゲート・独立レビューで再検証する。C001/S1/E3の既存treeと担当は保持する。本文やfixtureの重複は最新差分と担当の統合順で解決し、未測定・未設計を完成としない。

独立した監査・宣言inventory対応2.5とC1 factory分類・17file包含の2.6は実装・関連検証済みである。現在の8完了を保ち、行登録2.7・schema測定/inventory2.8・imported helper分類2.9を未完了として実装・検証は8/20とする。5.3〜5.5の元の必須受入3件に、マージ後の実診断5.6を加えて全24件を追跡する。完了ゲートは20タスクを判定し、ゲート後の4件は別に未達を保持する。ゲート後の出来事をゲートの前提へ含めない構造は維持し、レビューと証跡の運用だけを利用者が採用した2026-10-31の改訂規約へ合わせる。人のruleset操作は維持する。マージとsync/archiveの受入までchangeを完了としない。対象headの証跡はPR #184末尾の1ブロックに記録する。head変更時は必要な完了ゲート・CIを再検証し、独立Opusの回数・重大指摘ゼロ・軽微指摘のIssue化・reviewed-headとの対応は改訂ADR 0006に従う。無制限の全重大度ゼロとCodex必須をマージ条件へ戻さない。

# 2026-10-31の再編決定

当初のmain085a基点・PR179を先に受け入れる計画は出典として保持するが、現行の依存は上記のstabilize-cross-os-testsへの引継ぎと統合境界の確定に置き換えた。利用者が採用した再編計画の手順5・7と改訂ADR 0006を適用した計画更新であり、PR179の受入・マージ、吸収先の設計完了やcase実装を宣言するものではない。

Node20削除と全PR経路でのslow不実施は同じ最後の1-1 PR184で受け入れる（Q-38）。REQ-297の4case・下限/上限・clock/retry/assert、全case・coverage・3OS各3sample測定・release/local全件・人のnode20-only ruleset操作を保持する。今回の計画改訂では、main acce34fb取込後の995eを前提にするが、未完了taskと受入3件を完了へ進めない。PRの段階は改訂AGENTSに従って管理役が確認し、その段階のゲート・独立レビューを適用する。


# C1期限・信号試験の登録設計（2026-10-31採用）

管理役はOpus C1設計（5b4ee366）の全文を読み、Q-C1〜Q-C4のおすすめAを採用した。出典は`.loomake/scratchpad/speed-deadline-design-adoption/result.md`、V1の観測は`speed-mock-v1-probe/REPORT.md`、診断と移動の照合は`speed-integration-boundary-audit/report.md`（いずれも同じscratchpad配下）である。モデルのactual Opus5-5・read-only・拒否0と3規約のReadを確認した。モデルのtrace読取は一部であり、全traceへの対応付けとADR 0006の範囲の採用判断は管理役が行った。

## C1の宣言と登録単位

対象はrunnerのengine-long-deadline・scenario-timeout-evidence・signal-during-sync・run-timeoutの4file。元のit/test呼出しから閉じ括弧までの本文ブロックを保ち、各宣言に`if (has(id))`、5つのdescribeに子孫の全IDを列挙した`if (hasAny(ids))`を足す。import直後にpartition helper・FILE・registry・has/hasAnyを追加する。has内のincludeCase第2引数は、既存includeCaseTarget検査に従い元source pathの文字列literalを直接書く。モデル例のFILE変数参照は使わず、checker規則を緩めない。G-Bの同じprefix方式もこのliteral条件に従う。宣言間の定数・ヘルパー、`vi.setConfig`・`vi.hoisted`・元の`vi.mock`・実時計とfinallyは変えない。共有`tests/helpers/partition-part.ts`と各3行のcompanion（setPart import、`setPart('slow')`、元fileだけのliteral dynamic import）を使い、companionへmockを重複配置しない。

| 元file（packages/runner/test/） | 宣言 | scanner候補 | 展開行 | case ID（元宣言順） |
|---|---|---|---|---|
| engine-long-deadline.test.ts | 4 | 5 | 4 | timer-limit-keeps-result、split-wait-rearms、short-deadline-rearms、run-timeout-minutes-over-limit |
| scenario-timeout-evidence.test.ts | 2 | 4 | 2 | shared-deadline-restores-gate-mark、second-verify-timeout |
| signal-during-sync.test.ts | 8 | 13 | 11 | abort-during-gate-quality、abort-during-evidence-quality、abort-during-pr-lookup、supervisor-signal-task-commit、supervisor-signal-evidence-push、supervisor-signal-pr-operation、supervisor-killed-stopped、quality-supervisor-killed |
| run-timeout.test.ts | 2 | 3 | 2 | engine-timeout-stop、gate-test-timeout-stop |
| 合計 | 16 | 25 | 19 | eachは元の表全体に1 ID |

モデルの16宣言/22候補/19行は未実測の見積もりとして履歴に残す。別Codexの独立native照合（`.loomake/scratchpad/speed-factory-measure-impl/c1-baseline-probe.json`）は25候補（5+4+13+3）と元16有効block本文のbyte同一を確認した。scenarioのpropertyKey test 1件とsignalの同2件がモデルの数え漏れだった。管理役がこのsource保持証拠に基づく訂正をADR 0006の範囲で採用した。上表の宣言16・展開19は、2.6実装後の独立点検で候補の非call分類・宣言位置・本文範囲とともに確認済みである。違えばsourceの保持証拠と設計を再照合し、期待値を実装へ合わせて変えない。本文多重集合は元4+2+8+2を保持し、登録時はscannerの有効blockと独立ASTの両方で確かめる。

## 2.6の独立実装範囲

Q-34（Q-C1 A）はprivateな開発用inventoryの分類追加であり、新しい製品Requirementや規則の変更ではない。同じfileの非exportなconstで、宣言名が既存TEST_FUNCTION規則に一致し、初期値が`it`または`test`の`.runIf`または`.skipIf`を1引数で呼ぶ形だけをfactoryとする。宣言名と初期値のscanner候補は両方ともnonCallに分類し、候補を捨てない。bindingを照合し、そのfactoryを呼ぶ`posixIt(...)`と`posixIt.each(...)`は通常の試験宣言として検査する。

let・export・引数数不正・別名経由のfactoryは許可せず、規則外の宣言名もaliasとして拒否する。既存の通常const fixture helperのbinding分類、test alias・Vitest namespace参照とその別名の拒否、壊れた宣言など全既存診断を保持する。正fixtureはit/test×runIf/skipIfと実signalの形、負fixtureは上記の拒否条件を確かめ、宣言・候補・nonCallとerror codeを個別に照合する。元signalの`const posixIt = it.runIf(process.platform !== 'win32')`は変更しない。

独立照合でsignalのliteral配列2表を包む`as const`が既存rowCountのdynamicRowsになることも確認した。2.6ではas/satisfies/括弧/!の型だけを示す構文wrapperをunwrapし、内側がspreadなしliteral配列なら静的に行数を数える。変数tableはunwrapしてもliteralでないためdynamicRowsを維持し、コード実行や値の評価はしない。正fixtureにliteral配列のas const、負fixtureに変数tableと未確定行を含め、全parameter保持という既目的を具体化する。新しい製品Requirement・設定・規則の変更ではない。管理役は後続C2設計のQ-D1 Aも同じ限定として採用した。Q-D4 Bの旧15file固定は採用済みC1 Q-C4 Aと衝突するため採らず、旧15fileの順序・包含を保ち新2fileの欠測negativeを追加する17file案を維持する。既存試験を弱めずred/greenを確認する。

管理役は同じrowCount修正を使うexternal-budget-deadlineのlive inventoryも2.6へ加えた。別Codexの`.loomake/scratchpad/speed-factory-measure-impl/c2-baseline-probe.json`は3宣言/4候補と元3本文blockのbyte保持を確認し、as constのため行数はdynamicRowsだった。型だけのwrapper対応後の6行は2.6で別に独立確認済みである。C2の残る個別設計・実登録・OS割当はこの追加に含めない。

Q-37（Q-C4 A）はPR231の移動先2fileを必須包含へ追加する。`ci-measure-metadata`の旧15fileを削らず、run-timeoutとexternal-budget-deadlineを加えた17fileの欠落を検出する。これは全件の採集範囲を17fileへ限定する変更ではない。17file以外も含むcollectedFiles・全case・raw report・失敗/欠測sampleと実outcomeを保持する。追加各fileの欠落を独立fixtureで検査する。後の4.3では有効な登録済みcompanionだけを元sourceとして包含照合し、全slowの元fileを誤ってmissingRequiredFilesへ入れない検査も行う。

変更先はscripts/lib/test-declarations.mjsとその試験、scripts/ci-measure-metadata.mjsとtests/ci-measure.test.ts、docs/dev/ci.mdである。2.6では実registry・元case本文・scanner・partition・Vitest規則を変えず、実case登録とOS割当を行わない。2.5と2.6の完了印は保つ。factory分類の実装済みと、実case・3OS・正式割当の未受入を区別する。

## V1の採用範囲と残る受入

管理役はQ-35（Q-C2 A）とV1の最終native実行を採用した。Linux・実Node24.21.0・Vitest5.0.5の合成fixtureで、all-fast・mixed・all-slow各5行、別実行mixed-unit 2行＋mixed-slow 3行が独立した期待多重集合に一致した。元moduleのvi.hoistedとchild_processのpartial mockはcompanionからも有効であり、mockだけを外した対照は同じ未変更のmonitor assertで失敗した。timer/警告listenerの復元、moduleの隔離と全45 PIDの不在も観測した。

初回negativeはfilter不一致で4skipとなり、対照成功の根拠にしない。探索中のbundle loaderによる所有dir外の一時config生成とHOME上書きも報告に残る。最終実行はnative config loaderと所有cache/TMPDIRを使い、HOME上書きを取り除いた。これらの履歴を最終成功で消さない。V1はmock/importの技術前提の観測に限り、2.6の実装完了、元のproduction case・3OS・long deadline・cleanup・coverage・正式OS割当の合格ではない。今後production条件でmockが効かなければscenario-timeout-evidenceを未登録・未達に保ち、設計へ戻す。

4.3の登録は3.1〜3.3・2.5・2.6・2.7・2.8・2.9・4.2の受入後に行い、prefix・companion・実registryを同じcommitで追加する。Q-38の中間PRではslowも実行し、全PRのslow除外結線はNode20削除とともに最後のPR184で有効にする。profilerの元source/companion対象更新は登録より前又は同じcommitに置く（Q-57）。4.2の各OS3sampleで、行の失敗・欠測・skipが一つでもあれば割り当てない。各行の最大が10000ms超ならslow、each全行が超える場合だけ表全体をslow、全行以下ならfastとする。混在時は、2.7で受け入れたliteral表だけ行ごとに分け、未対応なら未割当・未達を保ち追加設計へ戻す。Windowsのsignalの8skip行を時間0やslow合格へ変えない。

Q-36（Q-C3 A）により、ubuntuでfastだけのcoverageが94/89/96/97を下回るなら該当caseのLinux割当を行わず未達を残し、不足範囲を補う新しいfast試験を別Issueで設計する。閾値は下げない。登録後の3OSで元19行とfast＋slowの`(元file, fullName, status)`の多重集合をpartition helperから独立に比較し、macOS/Windowsは全shardを合わせる。12selectorは変えず、main全件の監査で元の状態・理由を照合し、PRのslow未実行によるinvalidは正直に記録する。timeoutの上下限・実時計・cleanup、全fast/混在/全slowの空describe/file、PR全経路とlocal/release/main/scheduleの選択は4.3〜5.1で検証する。

## 現行mainとA1の未完了条件

PR236のfixture・quality receiptはmain7099へ受入済みで、現在のtreeに取り込まれている。境界監査の「236未マージ」は監査時点の記録として扱う。fixture/呼出し先・元case/parameter/assert/timeoutの保持を現行sourceで再照合し、性能と最新全件測定は別に未受入とする。C001/E3の担当を移さず、同じsourceへの重複writerを避ける。

PR179診断のPR190への吸収は確認できたが、publicationの診断は現在Windows隔離全fileのunsharded実行であり、隔離一覧とcompanion登録は重複拒否される。shared-first-runで共有した初回runと各caseの再試行、case時刻による対応、REQ-297の時計・予算・retry、診断privacyと保存上限を保つ。隔離解除後の後継経路はA1-routeの設計を以下で採用したが、実装・producer互換・実3sampleの受入は未完了である。3.1は未チェックのまま、4.4の診断2本分の対象・sample・失敗後保存・未計測の受入意図を保持する。


# 段階的PRと現在の受入境界（Q-38〜Q-44）

分割設計の原本は管理役共有の`.loomake/handoff/split-design-184-2026-10-31.md`（同worktree内の保存先は`.loomake/scratchpad/speed-plan-reconcile-282/split-design-result.md`）、GitHubの作業範囲はIssue #239〜#242である。原本の3d664時点の「2.5未実装」「必須15file」は履歴であり、現行282bでは2.5/2.6実装・関連検証済み、17file包含である。native全差分240486Bは上限204800Bを超えている。後の利用者決定であるADR0006の分割規則と包括承認に基づきQ-38を採り、scopeや受入条件を減らさず次の順に出す。

| 段階 | 範囲と受入の境界 |
|---|---|
| #239・L2 | 2.2共有準備の残試験、2.4の13条件と選択runner、4.2の全件測定workflow/metadata/試験を先行する。2.6の17file包含を保つ。ci.yml・node20・specs・実登録を含めない |
| #240・L2 | 2.5の監査とprivate inventoryを同一PRにする。2.6分類を含む現checkerを保つ。REQ-347差分とspec-only成功を前提に原文を取り込み、空registry、旧3Scenario、raw/レビュー表・移行条件を保つ。単独checker PRは作らない |
| #241・L2 | 3.1〜3.3、2.5〜2.9、4.2の受入後だけ実case/companion/OS割当を登録する。中間段階ではPRでもslowを実行し、元caseを減らさない。profiler対象更新は先行又は同commit。200KiBを超えるなら受入済みfile群でさらに分ける |
| #242・最後のPR184・L3 | Node20削除と全PRのslow不実施を同時に有効にする。specsとchange文書、全18タスク、4.5/5.1/5.2を受け入れ、他4required・段階別レビュー・人のnode20-only規則操作後にマージする |

L2中間PRは`loomake-change: none`、`loomake-planning-change: split-slow-ci-checks`と親PR/Issue参照を持ち、change全体のdone成功を宣言しない。REQ-347は進行中changeの仕様ゲートを通した差分に従う開発基盤で、製品src・配布API・実登録を先取りしない。各PRは必須5checkとci:all-os、独立した同packet自己レビュー・独立Opusを満たす。部分PRのmain受入後にmainを取り込み、同じbytesの差分が自然に消える形で縮め、force-pushは使わない。新しいOpus依頼の前には利用者指示どおり最新mainを取り込む。

Q-40では重複prototypeを後続で外し、PR判定を既存test-partitionへ集約する計画だけを決めた。2.3の元の空集合・未知ID/OS・全PR判定・選択の検証範囲はPR204と最後のPR184で保持し、この更新ではコードも期待値も削らない。Q-41の測定同一性は元case/runtime/config/depsに差分がないことを管理役が実証できる場合だけ認め、試験等が変われば再測定する。失敗測定の救済には使わない。Q-44は詳細原本を正確な保存先で参照するBを既定にし、それでも実diffが上限を超える場合だけ原文移管記録の先行L1案Aを使う。Requirement/Scenario/Source・受入・正負fixtureを削って小さくしない。

282bの全件9sampleは7成功・Windows2失敗で、155source/必須17/全raw/同名17余剰行を各sampleで保持した構造監査は成功した。AI Temp120秒とdeadline準備・pushの既存assert失敗を保持し、原因を未確定とする。全caseの成功、厳密なruntime名の同一性、4.2の受入とOS割当は未達である。新たな10秒超としてschema2file・kit/orphans・runner/v2-readersも見つかっており、元候補fileだけへ範囲を固定しない。原本は`.loomake/ci-measure-20261031/run41191899025/partial-analysis.md`と`failures.json`、最新状態の正本はPR184である。

# 行単位登録2.7（Q-45〜Q-52）

同worktree内の全文保存先は`.loomake/scratchpad/speed-plan-reconcile-282/row-design-result.md`（head65f98fcb、actual claude-opus-5-5、Read/Glob/Grep、拒否0、3規約Read）。管理役は全文を読み推奨Aを採った。traceはモデルの部分読取で、Q番号との対応は管理役が行う。モデルの進捗7/18は現在の2.6完了と後続2.8/2.9追加を反映しないため使わず、現在は8/20とする。製品Requirement・registry形式・scanner/partition規則は変えない。

元の`it.each(...)`から閉じ括弧までをインデントも含めbyte不変で保ち、裸Blockの先頭に`const it = eachRows(has, [葉ID...])`、末尾に閉じ括弧だけを足す。`selectRows`は元表を一度sliceし、表全体のlength/every判定・行の参照・元indexを保つown forEachだけで選択行へcallbackを渡す。Vitest本来のformatter/parseArgumentsを通し、名前・%#/%$・arity・評価回数・timeout/options/statusを保つ。単純なfilter、Proxy、globalな差し替え、内部taskの削除は使わない。Vitest5.0.5のforEach使用への依存は、独立したnative fixtureで検出する。

対応形はfile直下又はdescribe callback直下の裸Block内の2文だけとする。非export const it/testの単一宣言、正しいimport bindingのeachRows、識別子has、spreadなしliteral葉ID配列と、1回だけのX.each(literal表)(...)を結ぶ。型だけのwrapperはunwrapできるが、行はliteral値とその配列/オブジェクトだけ。factory/runIf.each/tagged/.for/関数呼出し/変数・spread表/実行時の名前/親describe.eachは対象外で、混在なら未登録・未達のままとする。

inventoryはrowBindingをnonCallとして残し、rowIds/rowTextsを位置で対応させ、宣言数と全表行数を保つ。checkRegistrationは葉IDを平坦化して従来の全ID/describe guard検査を適用する。rowIdsMismatch・unsupportedRowFormと既存dynamicGuardを区別し、rowBinding以外のit/test変数はshadowedTestで拒否する。正負fixtureの全code集合を照合し既存fixtureを変更しない。deadlineの実登録時は元3宣言/6行/3本文blockを保ち、候補4→5の増加はrowBinding1件、nonCallはimport1+rowBinding1という事前設計の内訳で検査する。葉IDはengine-prep-budget/shared-deadline-push/auth/list/create/hook-until-deadlineを設計どおり結び、profilerの固定caseIdと混同しない。

最初に専有V2 fixtureで、手書きfullNameのnative全fast基準を実行する。R1元indexと%#/%$、R2混合scalar/tupleのarity・参照、R3同名2行、R4 %%/$&/正規表現文字、R5数値とoptionsの80ms失敗、R6元error、R7全fast/混在/全slow/空part/未知OS、R8長さ不一致/二重使用/tagged拒否を確かめる。基準と手書き期待が違えば期待を実装へ合わせず設計へ戻す。既存7case fixtureへ混ぜない。実case・3OS・coverageの合格には代用しない。

独立oracleはpartition/part helperをimportせず、registryのJSON生文字列と基準/分割raw reportを入力にする。有効なS→C規則だけを独立に読み、(S,fullName,status)を数付き多重集合で比較する。sampleごと・OSごとに分離し全shardを合わせ、partの順序は基準の部分列とする。missing/extra/order違反・登録外C・重複名の減少・status変化を負fixtureで検出する。hashだけに頼らず、rowIds/rowTextsの位置とV2 marker、raw多重度を組み合わせる。PID/host/tmpdir名を正規化しない。既存監査の%$未対応は今回%sのdeadlineの影響外として保持し、虚偽のREQ変更で補わない。

# publication後継診断（Q-53〜Q-56）と登録前の順序（Q-57）

同worktree内の全文保存先は`.loomake/scratchpad/speed-plan-reconcile-282/route-design-result.md`（head d465f317、actual claude-opus-5-5、read-only/拒否0、3規約Read）。管理役の全文読了と採用により、既存quality-quarantine末尾に独立diagnostics-plan/quality-diagnosticsを足す案Aを採る。固定DIAGNOSTIC_TARGETSは隔離一覧を読まない選択経路で、Windowsの独立3sampleをmain push/scheduleだけで実行する。既存隔離・mutation jobと期限/排他/出力は保ち、PR・manual・新required status・旧179workflowを増やさない。隔離中は既存1sampleと診断3sampleの二重実行を受け入れ、解除後も診断は残す。

対象一覧はsourceと有効なcompanionを明記し、未知OS/重複ID・path/不在・非test/登録外C/sourceだけの登録を拒否する。samplesは0又は3だけ。publicationのprefix/companion/registry、診断一覧へのC追加、隔離解除は最新対象3sample成功などQ-33の条件を満たした同commitとする。失敗時は未登録・未達でsource診断を続ける。profile-slow-testsも元source+companionの4pathへ登録より前又は同commitで更新し、旧caseId/3sample/時計/失敗後保存/未計測を保つ。PR/manual撤去とNode20削除は最後のPR184で仕上げる。

新metadata scriptは生reportをbyteで保存し、実checkout/Node/OS/sample/outcome・expectedFiles/欠測を記録する。CからSの選択対応は有効registryだけを使い、全slowでSがないことを誤欠測にしない。cases.jsonは固定label/context id/repo/worker/process/有限な開始終了時刻で区間を結び、basenameだけや試験名で推測しない。共有初回runと25ラベル、再試行n=2の元topology、元privacy・行/総量上限・truncationを保つ。missing/duplicateLabel・unterminated・sharedTopology・clockInvalid・truncated・unreadable・inputLimit、区間外/曖昧行を固定code/件数で残し、argv/env/stdout/stderr/試験名/parameter文字列を新成果物へ書かない。異常はexit1、選択設定不正は2、rawやtestOutcomeを書き換えず失敗後もuploadを試みる。Windows heartbeat、7日保持、独立job/再試行なし、既存timeout/worker/TEMP/phase profiler契約を維持する。

このモデルは既存publication-retry-diagnostics試験とchecker本文を全文未読であり、producerの出力形式と既存試験への互換を実装前に確認する。producer互換・25ラベル/25展開行と共有contextの独立照合・正負fixture・起動条件の真偽表・旧job無変更を4.4のマージ前条件とする。実運用の受入は5.6で、最後のPR184のマージ後最初のmain pushから3artifactを取得し、同checkout・実Node・3sample・source/companion・固定caseId/区間/worker/process・時計/保存/失敗の扱いを確認する。fixture成功だけで5.6を完了とせず、欠測や未解決の異常が残ればchangeを未完了に保ち、sync/archiveへ進まない。

V2初回はnative15raw行の試験成功に対し、手書きfullNameの1件で不一致を観測し、期待値を変えず停止して追加設計へ戻した。これは計画どおりの受入前停止であり、後続設計のV2bへ進む。管理役はV2b報告全文を読みLinux合成の技術前提として限定採用したが、2.7のchecker/oracle実装完了や実登録とはしない。新候補orphansのimportされた*Test helperをinventoryが誤認する可能性も残設計で確認し、現在のcountや診断を実装へ合わせて固定しない。


# V2b補足設計（Q-58〜Q-60）

同worktree内の全文は`.loomake/scratchpad/speed-plan-reconcile-282/followup66/row-v2b-result.md`、セッションdd40a790-7051-44f2-bf4a-655fe28cfef0・head65f98fcb・actual claude-opus-5-5である。管理役と計画担当が全文を読み、manifestのok/exit0/read-only/拒否0と3規約のReadイベントを確認した。旧V2のR4不一致は、wrapperを使わないnative基準でも起きる、前回設計の導出誤りと分かった。

Vitest5.0.5のrun chunk3004行は%の文字数をcountし、3035行は%%も含む置換ごとにitemsを消費する。display chunk77/117行により、`p %s %% [.*+?]`の['x']は`rows p x % undefined [.*+?]`になる。旧期待・raw・停止記録は上書きせず残す。これは合成実験の誤った設計期待を一次ソースで訂正するもので、productionの試験・既存期待値・時間・assertを実装へ合わせる変更ではない。

V2bでは期待・call・driverを実行前に別版で固定し、旧7callはbyte不変、未実行のR4b `it.each([['x','y']])('q %s %% z',...)`を加える。予測は`rows q x % y z`、argc2・値['x','y']、mixedでは葉ID r4-pair-xyをslowにする。新しい16行・mixedSlow8行をnative基準から新規に実行し、元index/全table判定/参照/arity/名前/多重度/timeout/status/失敗文を確かめる。exit/signal/stdout/stderr/rawは照合前に保存し、すべての照合差分を記録して止める。実Vitest5.0.5と引用4chunkの同一性を事前確認し、旧rawをV2b成功の代わりにしない。

%%に対するscannerの既存の固定%扱いは、表全体の登録でも起きる制限である。Q-58によりdocsへ注記するだけで、行登録へ新しいunsupported制限や名前の正規化を加えない。production deadlineの名前は%sだけで影響しない。管理役と計画担当はV2b最終報告（同followup66配下のREPORT.v2b.md）を全文読了し、Linux/Node24.21.0/Vitest5.0.5の合成技術前提として限定採用した。native16processはexit0が8本・期待したexit1が8本、208比較は差分0、16行native基準と混在8+8/全fast/全slow・R4b予測・arity/参照/重複/timeout/error/不正形を照合した。元7call byteと旧V2全37fileを保持し、実Vitest版と引用4chunkも一致した。Opusが許可したのではなく一次sourceに基づく設計訂正を管理役がADR0006の範囲で採用した。2.7のchecker/oracle実装は未チェックを維持し、4.2/4.3/production/3OS/coverage/実期限上下限の成功に代用しない。一般oracleのsample/shard/複数file負fixtureは未実施である。

# schema2fileの個別登録と独立2.8（Q-61・Q-62）

全文保存先は同じfollowup66配下の`schema-two-result.md`、セッション2043c3b2-d322-401e-8dea-379cdc29a1d8・head65f98fcb・actual Opus5-5である。管理役・計画担当の全文読了、ok/exit0/read-only/拒否0と3規約Readを確認した。proposal、blockDigest、partition-fixtureの全文未読、coverage・PRのpassed対応は静的な見込みというモデルの限界を保持する。

各targetは1宣言/2候補/1行/importSpecifier1/errors0で、case IDはschema-contract-trialsとschema-version-contract-trialsである。最後のimport直後に共通part/loadPartition/includeCase/registry/hasだけを足し、includeCase第2引数は元source pathのliteral、rootはjoin(import.meta.dirname,'..')を使う。describeがないためhasAnyは加えない。元itから閉じ括弧までの本文をbyte不変にし、3行companion（setPart import/slow設定/元.jsのliteral dynamic import）へ登録する。実registryとprefixは4.3の同commit、個別fileの全fast/全slow・他OSだけslowを独立した期待で収集検査し、0試験fileを選ばない。全slow時の個別起動は元fileでなくcompanionを指定することを文書へ記す。

元callback2件は全15trial（current8/branch1/version6）を各々実行し、schema-compatibilityの同一targetへの2回目の拒否も保つ。試験260000ms、子script240000ms、同一target再実行10000ms、内側各15000ms、UUID出力先・junction依存・cleanup/引数/cwd/Node・元assert・元scriptの全trialを変更しない。beforeAllへの移動、trialの共有/省略、直列化、retry追加は行わない。外側は各1行のまま、入れ子trial行をrawの外側行に加算しない。

Q-61により旧17fileの順序・包含を保ってschema2fileを足す19fileを必須包含とし、新2file各々の欠測negativeを独立に追加する。Q-62により上記の2file live inventoryを接頭辞より前のcommitで追加し、元本文と宣言位置を独立に照合する。新しい未完了2.8で行い、2.6完了を戻さず、252/253の先行基盤受入後に実装してよい。19fileは全収集の下限であり、全file/case/raw/失敗sampleを保持する。登録後は有効なCだけSへ包含対応し、全slowのSを誤欠測にしない。282b計測の必須17・155file・7成功2失敗という実績は変えず、新19file検査の成功へ読み替えない。

既存schema-compatibilityのblock形式レビュー行は変更せず、schema-version-contractに新しいレビュー行を捏造しない。元blockの前後照合・raw各1行・全shardを独立比較し、PRのinvalidを別reportで補わない。fast coverage94/89/96/97とlive Sourceの実passed対応を測り、不足ならLinux割当を行わず未達を残す。子processがcoverageへ寄与しないという静的見込みで合格を宣言しない。schema2fileを固定profilerの対象に加えず、元のai/deadlineの4pathを保つ。

# A2とguards追加2宣言の個別設計（Q-63〜Q-66）

全文保存先はfollowup66の`a2-guards-result.md`、セッション585f3bb1-8ef3-4b52-ba6a-0ad02256ad12・head65f98fcb・actual Opus5-5である。管理役・計画担当の全文読了、ok/exit0/read-only/拒否0と3規約Readを確認した。A2の14宣言と既存G-B以後のREQ-348追加2宣言をin-placeで具体化し、旧37guardsは再設計・再採番しない。

| 元file | 元宣言順のcase IDとdescribe guard |
|---|---|
| evidence-storage | storage-create-failure-resume（describe内1件）、cleanup-failure-recover（top-level1件）。describeは前者だけhasAny |
| auth-prompts | push-auth-prompt-guide、push-unrelated-failure。同describeに両ID |
| pr | pass-commit-push-pr/evidence-last-commit、resume-on-change-branch/unknown-base-stops、pr-body-order、gh-create-args/gh-auth-fail-no-evidence/gh-auth-fail-no-engine/dry-run-skips-gh/gh-logout-during-run。4describeに各組をhasAny |
| guards追加分 | boundary-engine-reads、boundary-gate-readsを追加describeのhasAnyへ。旧37のIDと同じ見出し/registry/companionを共有 |

各fileは既存import直後に共通5行、各宣言とdescribeへprefixだけを加え、includeCaseは元source literalを使う。元it/describe本文・hook/mock/config/clock/timeout/fixture/finallyを変えない。companionは3行としmockを重複しない。A2 live baselineは2/3/2・2/3/2・10/11/10（宣言/候補/行）、import1/errors0を接頭辞前commitで追加する（Q-65）。guards39/54/42と追加2件の正確な試験名の既存照合は保持する。登録後も同じ数と元blockを独立照合し、不一致なら期待を合わせず設計へ戻す。

Q-63は旧Q-33の隔離解除条件を強める。pr/guardsのWindows隔離は、最新同headのWindows独立3sampleで、隔離一覧の対象だけでなくfile全行（guards新2件を含む）がpassed・欠測/skipなしのときだけ、実登録と同commitで解除する。条件不成立ならfileは未登録・未達、隔離/partitionの重複拒否は変えない。Q-64により失敗・欠測・skip等で1caseでも判定不能ならfile全体を未登録に保ち、[]をfast確定の代わりに書かない。現状の実行範囲を保持することと、全PRslow不実施の最終受入を満たすことを区別し、未判定を完成にしない。

Q-66により、進行中changeのSourceを満たす唯一の根拠がLinuxのslowへ移るなら、その割当を行わず未達を残し、独立した新fast試験の設計へ戻す。verifyのPRだけ全件を復活させたり、虚偽タグ/古いreport/期待変更で補わない。prのREQ-114/115等は実際の全対応を検証し、Grepだけで唯一と断定しない。この条件は他のC1等も確認する。coverage未達もQ-36のまま保つ。

F-A2は未実施でありV1からの類推を実証へ変えない。専有native fixtureでevidence-storage型のnode:fs partial mock/vi.fn/afterEach/timeoutとdescribe+top-levelを全fast/混在両方向/全slowで試し、mockだけを外した対照で同じassertが失敗することを確認する。pr型の4describe/空describeとcompanion timeoutも確かめる。所有config/cache/TMPDIRを用いHOMEを変えず、productionでmockが効かなければ未登録・未達を保つ。技術fixtureをproduction/3OS/割当の合格にしない。

モデルは監査selectorをGrepで12件（evidence3/pr9）と数えただけで、全文と旧形式を検証していない。trace本文・partition-integration・ci-quarantine・quality-quarantineも全文未読である。実装前に全selector/旧形式・producer/quarantineの境界を読み、状態/理由・raw/レビュー表・旧Sourceを保持する。12を未検証の受入期待へ固定しない。モデルの『PR slow除外結線ができるまで登録不可』は古い単一PR前提なので採用しない。後のQ-38を優先し、中間登録PRではfast+slow全件を実行、最後184でNode20削除と全PRslow不実施を同時に有効化する。


# orphansの分類と登録（Q-67〜Q-73、新2.9）

全文は同worktreeの`.loomake/scratchpad/speed-plan-reconcile-282/followup78/orphans-result.md`、Opus b782f009-b4af-4bbb-9a3c-6f4199018eff・head65f98fcbである。管理役・計画担当が全文を読み、actual Opus5-5/ok/exit0/read-only/拒否0と3規約のReadイベントを確認し、おすすめAを条件付きで採用した。モデルの2.8という新task案は既存schema2.8と衝突するため2.9へ割り当て、モデルの旧進捗を現在数に使わない。

importされたproduct helperを試験と誤認するprivate checkerだけを修正する。対象はchecker/試験/docsで、元orphans source・scanner/本文hash/REQ-347/partition/Vitest・実registryは変えない。別名/type-onlyでない相対.jsのnamed import、直接Identifier callだけを対象に、正規化したrepo内packages/*/src/*.tsを静的に読む。対象名はit/test/describe以外、本体を持つtop-level export functionだけとし、default/declare/export const/re-exportは対象外。Vitest系のimport/export-from/import-equals/dynamic import/require、非literalなimport/requireがあるmoduleも対象外とする。名前のwhitelist・rename・コード評価は加えない。

options.readModuleは任意注入できるが、渡すpathはrepo内の上記正規pathに限る。既定filesystem readerはrepo rootと実pathの内包・isFile・読取と構文を検査し、repo外へ解決するsymlinkや未読/不正構文をhelper扱いにしない。注入readerでもpath境界と返す文字列の構文を確認し、評価せず閉じる。既存入力読取境界と秘密情報禁止を適用した受入条件で、汎用評価器や名前の許可一覧へ広げない。moduleを1階層静的に読むだけなのでtransitiveなVitest依存の不存在は証明しない。製品srcの既存依存規則に頼る仮定A-02と限界を残す。

parse/inventory/checkRegistrationで同じbinding規則を使い、helper callのscanner候補も開始/終了/本文をASTと照合したうえでnonCallのimportedHelperCallとして残す。呼出し33件を削除せず、import6+helperCall33=nonCall39、元it33宣言（direct32/each1）/全72候補/34展開行/errors0という予測を、実装前に独立ASTと原文から実証する。現checkerの偽66宣言/67行を基準として採用しない。不一致なら期待を変えず設計へ戻す。map注入の正例は修正前red→修正後green、規則外module/export/import/alias/type-only/shadow/each/curried/非call参照と既存fixtureは同じcode集合を保持する。各path/実path/isFile/構文の負fixtureも含める。

実登録は4.3で、元33本文・全parameter/assert/60s/clock/budget・fixture/保持役/cleanupを不変にし、提示33ID（原本§2.4）を元宣言順に独立再照合してから条件付き採用する。6describe全部（describe.runIf2つを含む）に子孫全IDのhasAnyを付け、runIf条件とskipを保つ。each2行の閾値が混在するなら2.7の対応形かを確認し、非対応ならfile未登録未達。header/3行companionは既存設計を共有する。Windows2件のslow案は4.2前の候補であり今はregistry空、linux/darwinのslowなし・status/行数・worker分離も未実測の予測として受入時に確認する。

保持役の起動費用は分割後のWindows fast別caseへ移る可能性がある。Q-70では登録後headの実3OS各3sampleで費用を正直に測り、新しい10秒超が出れば未達として測定の受入と設計確認へ戻す。beforeAllへ隠す、Windows groupを一括slowにする、未検証の割当を連鎖修正して合格にすることはしない。所有・残留なし/実時計と上下限・全caseを独立oracleで検証する。モデルは全34行の時間、pool/isolate実効値・Windows保持役scriptを読んでおらず、worker/費用の静的見込みを実証にしない。selector0件も実登録時に再照合する。

Q-72によりorphansは今の必須包含へ追加しない。2.8で未実装の19fileを保ち、orphans登録時はsource/Cの欠測を有効registryと独立全case比較で検出する。必須包含から外すことを採集や保持の免除へ読み替えない。

# v2-readersの登録（Q-74〜Q-78）

全文はfollowup78の`v2-readers-result.md`、Opus d33bb4dd-028e-44e1-994c-7b3f2001795f・head65f98fcb。全文読了・actual5-5/ok/exit0/read-only/拒否0と規約3本のReadを同様に確認した。元16宣言/17候補（import1）/18行/errors0、16本文の順序とbyte、非literal各3row、内側throw/resultの2mode、spy/env復元/cleanup/60sを保つ。内側2modeを外側caseとして数えない。共有headerと元宣言直前/7describe全部のguardを追加し、同じ3行companionだけで登録する。

16IDとdescribe対応は原本§2.1の元順序を使い、local-done-draft-prとdone-gate-scope-localだけwin32 slowとする案をQ-74で条件付き採用する。全18行の各OS3sampleがpassed/欠測なし/有効時間で4.2を受け入れるまでは実割当を確定せず、残りIDを[]でfast確定しない。元3行eachは関数式/呼出しを含みliteral行登録の対象外なので、閾値混在ならfile全体未登録未達で追加設計へ戻す。Linuxで唯一Sourceの根拠が失われる場合もQ-66を適用し、全PRslow不実施を変えない。

live inventoryを実prefix前に追加し元blockと選択経路を独立照合する。全fast/混在/全slow/空part/未知OS、実登録後raw18行のOS/sample別・全shard/projectの多重度/status/順序を独立oracleで比べる。spyの有効性は実assertで確認し、mockなしでも通り得るlocal-done-draft-pr単独を根拠にしない。Windowsでcompanionのspy/vi.setConfigが効くかは未確認のため、3OSで不成立なら未登録未達を保つ。selector0件という入力とモデル未読のproposal/ci文書/test-declarations・部分traceという限界も実装前に再照合する。

Q-77の必須包含は、モデルの旧17を採らず、2.8の未完了19fileを基準にする。v2-readers登録と同commitで末尾へ加えて20fileにし、旧19の順序/包含と追加file独立欠測negativeを保つ。17実装済み→2.8で19→登録同commit後20という時点を分け、全採集file/case/raw/失敗をどの段階でも保持する。Q-78により分割後のfixture初回costがfast別caseへ移って新たな10秒超が出たら、実3OS各3sampleで未達を記録して設計へ戻す。beforeAll/cache/helper共有で隠さない。Q-38の中間PRは全件、最後184でPRslow除外とNode20削除を同時に有効にする。

現在4.3の前提は3.1〜3.3・2.5〜2.9・4.2の受入で、実registryは空のまま。先行PR253はdefault initializer経由の重大1が未解決で最終Opus0回、難しいバグの独立Opus調査へ戻している。PR252は独立自己レビュー重大0/軽微1をIssue254へ残し、CI未完で受入前である。どちらも準備や計画更新をmain受入・1-1完成へ読み替えない。
