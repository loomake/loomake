# Trace: verify-v2-c001

## 入力文書

| 文書 | 版 | 日付 |
|---|---|---|
| docs/requirements/loomake-v0.11.md 7.1・7.3・7.9、FR-12、O01 | v0.11.3、main f397109 | 2026-10-29 |
| docs/architecture.md 0.4・0.5・付録A | v2.5.5、main f397109 | 2026-10-29 |
| docs/wbs/baseline-v1.4.md J02・J03、W1-2/4/5、5章C-001/C-003 | 固定v1.4 | 2026-10-26 |
| docs/dev/compatibility-changes.md、docs/guide/3.reference/1.compatibility.md、ADR 0001・0002 | main f397109 | 2026-10-29 |
| Issue #61・#63・#64の作業・先行範囲・調査記録 | 2026-10-29取得 | 2026-10-29 |
| openspec/specs/core-parsers・verify・trace-record・trace-report・run-decision-policy、受入済みadd-quality-verdict-aggregation | main f397109 | 2026-10-29 |
| packages/kit/src/verify、packages/cli/src/main.ts、packages/core/src/verify-result*・trace-schemas.ts、packages/trace/src/record.ts・report.ts、packages/runner/src/run、scripts/ci-gate.mjs | 実装観測、main f397109 | 2026-10-29 |
| mainの追加契約とCLI実装・3回目レビューの部分承認 | 751a8a1b6ffca673f44f2fa272b9029a667bf12b、コメント6510041693 | 2026-10-30 |

Issue参照：[契約 #61](https://github.com/loomake/loomake/issues/61)、[判定 #63](https://github.com/loomake/loomake/issues/63)、[CLI #64](https://github.com/loomake/loomake/issues/64)。質問の管理先は[進行管理 #121](https://github.com/loomake/loomake/issues/121)。7件の明示承認は下表の出典で記録し、保留3件やIssueの調査メモを採用承認へ広げない。


## 要件台帳

| ID | 出典 | 種別 | 要約（原文に忠実に） | 状態 | 反映先 |
|---|---|---|---|---|---|
| REQ-100 | 現行run「完了ゲートと直し」・4回目レビュー中2 | 既存変更 | runの完了ゲートを明示localにし、純粋判断と既存5 Scenarioを保持する | 確認待ち | specs/run/spec.md |
| REQ-306 | 現行verification-policy・4回目レビュー中3 | 既存変更 | 件数/summary/verifyへの非接続を集約定義単独の範囲へ限定する | 確認待ち | specs/verification-policy/spec.md |
| REQ-323 | active CLI差分・4回目レビュー中1 | 既存変更 | 未確定契約を追加しないMUSTをCLI生成単独の範囲へ限定し、改版後の共通定義へ従う | 確認待ち | specs/reference-docs/spec.md |
| REQ-324 | active CLI差分・4回目レビュー中1 | 既存変更 | help/usage/終了コード/8 JSON等の不変MUSTを共通定義集約単独へ限定する | 確認待ち | specs/reference-docs/spec.md |
| REQ-036 | 現行verify「仕様ゲートの警告」・追加レビュー重大1 | 既存変更 | spec-onlyの案内PASS/0とdoneの不足/1を分ける候補。採否はR08待ち | 確認待ち | specs/verify/spec.md |
| REQ-037 | 現行verify「openspec validateの実行」・追加レビュー重大1 | 既存変更 | auto時CLI不在はlocal理由PASSかNA、ci不足の候補をR08で比較する | 確認待ち | specs/verify/spec.md |
| REQ-038 | 現行verify「完了ゲート」・3回目レビュー中2 | 既存変更 | doneの確認待ちは036と同じ不足/要判断に統一。未完了tasksと実施済み失敗はFAIL | 確認待ち | specs/verify/spec.md |
| REQ-050 | 現行verify「性能」・3回目レビュー中1 | 既存変更 | localのskip不足1とレポート解析を含む3秒条件の試験案。具体assertion差分はR05待ち | 確認待ち | specs/verify/spec.md |
| REQ-183 | 現行external-process-budget・3回目レビュー重大1 | 既存変更 | JSON/依存の不変を予算単独変更の影響範囲へ限定する | 確認待ち | specs/external-process-budget/spec.md |
| REQ-322 | 現行reference-docs・3回目レビュー重大1 | 既存変更 | 公開8 JSON等の不変をqualityリファレンス生成/check単独の影響範囲へ限定する | 確認待ち | specs/reference-docs/spec.md |
| REQ-114 | 現行run-pr・3回目レビュー軽微2 | 既存変更 | local完了からDraft PRへ進み、明示localのv2記録を先に作る | 確認待ち | specs/run-pr/spec.md |
| REQ-115 | 現行run-pr・3回目レビュー軽微2 | 既存変更 | PR本文はlocal完了0と最終CI未確認を区別する | 確認待ち | specs/run-pr/spec.md |
| REQ-164 | 現行run・3回目レビュー軽微2 | 既存変更 | v2/local証拠の同一状態の外部再試行と旧版非再利用を315と整合する | 確認待ち | specs/run/spec.md |
| REQ-203 | 現行trace-agreement・3回目レビュー軽微1 | 既存変更 | 仮定承認後に未承認の案内/不足へ出ない用語へ追従する | 確認待ち | specs/trace-agreement/spec.md |
| REQ-039 | 現行verify「品質コマンドの実行」・追加レビュー重大1 | 既存変更 | 未知キーのwarnを理由付きPASSの案内へ移し、コマンド失敗は保つ | 確認待ち | specs/verify/spec.md |
| REQ-191 | 現行verify「品質コマンドを省いたことの表示」・追加レビュー重大2 | 既存変更 | skip-commandsをchecksの不足として1にし、未実施と再実行を案内する候補 | 確認待ち | specs/verify/spec.md |
| REQ-040 | 現行verify「JSON 出力」、要件7.3 | 既存変更 | v2でも要件ごとの成功テストファイル一覧をcoverageに保持し、abortedに補わない | 確認待ち | specs/verify/spec.md |
| REQ-041 | 現行verify「終了コード」、要件7.3・WBS J02 | 既存変更 | 従来の使い方2を維持しv2の共通判定REQ-311を参照する | 確認待ち | specs/verify/spec.md |
| REQ-066 | 現行trace-record「証拠の記録」、WBS W1-5 | 既存変更 | v2結果と同じ終了コードで追記記録する。未コミット・change不正の停止は保持する | 確認待ち | specs/trace-record/spec.md |
| REQ-205 | 現行run-decision-policy「完了ゲート後の純粋な判断」、要件7.3・FR-12 | 既存変更 | v2の要判断とabortedで止まり、local完了をDraft PRへ進む条件として扱う | 確認待ち | specs/run-decision-policy/spec.md |
| REQ-274 | 現行core-parsers、要件7.3・WBS J03 | 既存変更 | 現行v2と旧1.0.0履歴のスキーマ・導出型を分離する | 確認待ち | specs/core-parsers/spec.md |
| REQ-275 | 現行core-parsers「verify結果の未知のフィールド」・レビュー指摘2 | 既存変更 | 現行checksと履歴resultsの未知値を保持し、v2の既知禁止キーと区別する | 確認待ち | specs/core-parsers/spec.md |
| REQ-276 | 現行core-parsers「JSON Schemaの書き出し」・レビュー指摘9 | 既存変更 | 旧版JSON Schemaの版付き追加公開はR09 A採用。現行形式置換の非互換範囲はR05待ち | 確認待ち | specs/core-parsers/spec.md |
| REQ-302 | 現行core-parsers、要件7.3・WBS同時追従 | 既存変更 | Evidenceを2へ移し旧1を保持、Report 2と既存の構造制約を維持する | 確認待ち | specs/core-parsers/spec.md |
| REQ-303 | 現行core-parsers、WBS同時追従 | 既存変更 | 同期APIと整合性検査・遅延zodを維持し新旧証拠へ追従する | 確認待ち | specs/core-parsers/spec.md |
| REQ-304 | 現行core-parsers、要件7.3・WBS J03 | 既存変更 | verify/evidenceの新形式と旧fixtureを保持し、無関係6 JSONを変えない | 確認待ち | specs/core-parsers/spec.md |
| REQ-305 | 受入済み共有4値・レビュー指摘2 | 既存変更 | 共有4値と遅延ロードを保ち、verify/evidenceの現行形式と無関係6 JSONの保持を分ける | 確認待ち | specs/core-parsers/spec.md |
| REQ-307 | main f4e3edbの未知キー保持・互換性照合 | 既存変更 | 現行checksと履歴resultsを保持対象にし、8 JSON不変をv2対象2本と無関係6本へ分ける | 確認待ち | specs/core-parsers/spec.md |
| REQ-073 | 現行trace-report「使った証拠の記載」・レビュー指摘2 | 既存変更 | Evidence 1/v1とEvidence 2/v2の対応版を受け付け未対応版・不正構造は拒否する | 確認待ち | specs/trace-report/spec.md |
| REQ-308 | 要件7.3、architecture0.5、WBS W1-2 | 機能 | v2のci/local completed/partialとaborted、未知キー許容・既知禁止キーを区別する | 確認待ち | specs/core-parsers/spec.md |
| REQ-309 | 要件7.3実行エラー、WBS W1-2 | 機能 | change未確定nullのabortedと、構文が有効な不存在changeのREQ-055 FAIL/1を区別する | 確認待ち | specs/core-parsers/spec.md |
| REQ-310 | 要件7.1・7.3、WBS C-001、Issue61準備調査 | 機能 | 最小quality読取・既定値と構文2/読取3、spec-only不在許容と初期必須1項目のR07 Aを反映 | 反映済 | specs/verify/spec.md |
| REQ-311 | 要件7.3終了コード表、WBS W1-5 | 機能 | API/CLI共通の0〜3、stdout JSONのみ、stderr診断、非対話 | 確認待ち | specs/verify/spec.md |
| REQ-312 | 要件7.3・FR-12、現行REQ-042、WBS W1-5 | 機能 | bare verify維持はR01 A採用。scope既定を規範化しDoD/警告分類はR06/08待ち | 確認待ち | specs/verify/spec.md |
| REQ-313 | 要件7.1・7.3集約の規則、WBS W1-4 | 機能 | R03/04 Aを反映し、純粋な条件判定で証跡不足・必須違反・NA・PASSを区別する | 反映済 | specs/verification-policy/spec.md |
| REQ-314 | 要件7.3集約・件数、REQ-305/306先行受入 | 機能 | evaluatedはR02 Aの全checksを採用。NA/PASSとpending分類はR08待ち | 確認待ち | specs/verification-policy/spec.md |
| REQ-315 | 要件7.3、WBS J03・W1-5 | 機能 | Evidence 2でv2を保存し、旧1.0.0を自動再利用しない | 確認待ち | specs/trace-record/spec.md |
| REQ-316 | WBS J03・W1-2・W1-5、現行Report 2契約 | 機能 | 新旧証拠を既存Report外形へ投影し旧版を閲覧専用にする | 確認待ち | specs/trace-report/spec.md |
| REQ-317 | 要件7.3・FR-12、architecture0.5、WBS同時追従 | 機能 | runnerはdecisionで停止し、local完了と最終CI合格を分ける | 確認待ち | specs/run-decision-policy/spec.md |
| REQ-318 | WBS5章同時追従・J03、architecture0.4、互換性文書 | 移行 | 配布された型・CLI/API・Schemaとci-gateの版別受理が一致する | 確認待ち | specs/monorepo/spec.md |
| REQ-319 | WBS5章C-001正常/不正/不足、AGENTS DoD、Issue61調査 | 受入 | CLI/APIは正常PASS・不正aborted・不足を区別し、古い結果から合格を作らない | 確認待ち | specs/verify/spec.md |

R01/02/03/04/07/09/10のAを承認として反映した。REQ-310・313は採用済みの範囲を反映済みにし、残る行はR05の形式/既存互換差分、R06のDoD、R08の分類のいずれかに依存するため確認待ちを保つ。文書の反映済みは製品実装やDoD達成を意味しない。

REQ-305/306はPR #138、REQ-307は#60保持修正の既存IDである。305・307は今回その既存要件をMODIFIEDとし、別の振る舞いへ再割当しない。既存REQ-042のbare verify品質専用はR01 Aで維持し、別の品質専用操作へ変更したと扱わない。

## 確認事項

| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 | 回答者 | 回答日 |
|---|---|---|---|---|---|---|---|---|
| R-C001-01 | REQ-312・REQ-309 | 要件7.3のchange未指定abortedと現行REQ-042のbare verify品質専用をどう適用するか | A: bare verify品質専用を維持しchange必須ゲートの未指定をabortedにする / B: bare verifyもabortedにし品質専用の代替操作を同じchangeで定義する | A。現在の品質確認とci-gateのnone/文書経路を維持できる。7.3の適用境界を明記する必要は残る | yes | A。[承認元](https://github.com/loomake/loomake/pull/139#issuecomment-6510041693) | rrr-xxx（rrr-www名義・Claude Code代筆） | 2026-10-30 |
| R-C001-02 | REQ-314 | summary.evaluatedは何件を数えるか | A: checks全件（PASS/FAIL/不足/NA） / B: NAを除く適用対象件数 | A。全4値の合計と一致し、ゼロと全NAを別に説明できる。既存資料には定義がなく採否が必要 | yes | A。[承認元](https://github.com/loomake/loomake/pull/139#issuecomment-6510041693) | rrr-xxx（rrr-www名義・Claude Code代筆） | 2026-10-30 |
| R-C001-03 | REQ-313・319 | C-001で実証跡を取る範囲をどうするか。adapter・verification.yamlの契約と適格性検査だけでも複数タスクを要する | A: 新鮮なコマンド結果/REQレポートの最小adapter・plan・適格性をC-001へ先行 / B: C-003と並行準備し必要範囲を合同受入 | A。正常/不正/不足を同じCLI/APIで受入可能にする。信頼する判定器の構築は04で別に判断する | yes | A。[承認元](https://github.com/loomake/loomake/pull/139#issuecomment-6510041693) | rrr-xxx（rrr-www名義・Claude Code代筆） | 2026-10-30 |
| R-C001-04 | REQ-313・318・319 | 信頼する判定器をS1独立changeとして準備するか。追加レビュー用のS1見積は44〜88人時（8時間/人日で5.5〜11人日）、実績ではなく待機を除く作業推定 | A: S1のbase-built checker・private handoff・S2照合契約を採用 / B: その案を採らず信頼基準と依存を再設計 | A。自己申告だけで合格にしない。詳細候補の内訳・再利用/新規・前提を確認して判断する。S2本実装や外部承認待ちの時間は見積外 | yes | A。[承認元](https://github.com/loomake/loomake/pull/139#issuecomment-6510041693) | rrr-xxx（rrr-www名義・Claude Code代筆） | 2026-10-30 |
| R-C001-05 | REQ-036〜041・050・055・073・093・100・114・115・135・164・183・191・203・274〜276・302〜306・307・315・322〜325 | 既存互換差分に加え、323/324の未確定契約追加禁止・help/usage/終了コード/8 JSON不変MUSTの範囲変更、100のlocal化、306の接続範囲を受け入れるか | A: 既存のv2形式・183/322範囲・未承認done1・040/050/191・CLI基準の非互換案を保持し、323/324のMUSTを生成/集約単独へ限定、100を明示local、306を集約定義単独に限定 / B: これらの範囲と互換移行を再設計 | A。別の改版を永久に禁じない範囲へ限定する。未承認仮定done1、skip coverage省略/1、性能条件保持、CLI基準・help更新の方針を含むが、具体的assertion/旧46例の変更承認は別に取得する | yes |  |  |  |
| R-C001-06 | REQ-100・311・312・315・319、AGENTS DoD | done既定ciに対してローカルDoDをどう満たすか | A: ローカルは --done --scope local の0、最終受入は --done --scope ci の0と必須CIを要求するよう規約/guideを移行 / B: ローカルでもci証拠を取得し既定done 0を要求 | A。ローカル完了と最終合格を区別し、CI証拠不足でローカル作業が恒久停止しない。AGENTS・配布規約・PRテンプレートも同時に修正する | yes |  |  |  |
| R-C001-07 | REQ-310・312・319 | root quality初期内容と、切替日にopenなPRをどう移行するか | A: 詳細候補のci.test_report 1必須項目を置き、全open PRを棚卸し、実装PRはmain取込と新鮮な実証跡で再検証。spec-only不在許容/done不在3 / B: 初期項目と切替順を再設計 | A。空/全NAで一斉不足にしない。C-001対象だけでなく各PRの承認REQ集合へplanを割り当て、移行できないPRのマージを止める。検証前に品質合格を与えない | yes | A。[承認元](https://github.com/loomake/loomake/pull/139#issuecomment-6510041693) | rrr-xxx（rrr-www名義・Claude Code代筆） | 2026-10-30 |
| R-C001-08 | REQ-036〜039・191・203・312・314 | warnとskipをゲート/scope別にどう移行し、doneの確認待ち/未承認仮定をどの分類に統一するか | A: spec-onlyの未承認/確認待ちは案内PASS/0、doneは不足+要判断/1。未知キーは理由PASS、auto CLI不在はlocal理由PASS・ci不足、skip不足1 / B: 同じAの共通部分を保ち、auto CLI不在localだけ理由付きNA | B。4回目レビューの基本AとlocalだけBを合成した案。未知キーの理由PASS等は変えず、実行していないvalidateはNAとする。ci不足、明示trueの失敗、品質条件のFAILを維持する。おすすめであり回答ではない | yes |  |  |  |
| R-C001-09 | REQ-276・304・305 | 外部から読める旧verify/evidence JSON Schemaを公開し続けるか | A: 既存パスを現行版へ移し、旧版を版付きの追加パス/exportsで配布 / B: 旧版JSONは配布せず履歴型/fixtureだけ残す | A。履歴データを検証する外部利用側にも移行先を用意できる。パス変更と読み分けを移行説明へ記載する | yes | A。[承認元](https://github.com/loomake/loomake/pull/139#issuecomment-6510041693) | rrr-xxx（rrr-www名義・Claude Code代筆） | 2026-10-30 |
| R-C001-10 | REQ-312・314 | localのspec-onlyで品質項目をchecks/summaryへ数えるか | A: 仕様/構造検査のみ数え、品質targetやquality:subjectsを生成しない / B: 品質項目を不足として数えpendingにする | A。仕様ゲートで品質実施を要求しない原則と一致し、構造検査のPASSを品質PASSへ転用しない | yes | A。[承認元](https://github.com/loomake/loomake/pull/139#issuecomment-6510041693) | rrr-xxx（rrr-www名義・Claude Code代筆） | 2026-10-30 |

質問管理先：[PR #139](https://github.com/loomake/loomake/pull/139)。[3回目レビューの回答](https://github.com/loomake/loomake/pull/139#issuecomment-6510041693)で、R01/02/03/04/07/09/10はAと明示された。承認者はrrr-xxxで、rrr-www名義のコメントをClaude Codeがその指示に基づいて代筆したと出典に記載されている。回答日は日本時間2026-10-30である。AI評価やCI成功を承認として扱ったものではない。

R05/06/08は同じコメントで保留とされた。パーサが回答済みと扱わないよう選択回答・回答者・回答日は空のまま保ち、保留の経緯と出典をここへ記す。[4回目レビュー](https://github.com/loomake/loomake/pull/139#issuecomment-6510532640)のMUST範囲・localゲート・品質集約と軽微指摘も、この3件の判断材料へ加えた。同コメント末尾のおすすめは新たな回答ではない。すでに承認された7件の選択肢を変更して再質問していない。

製品実装・形式切替・利用側移行を止めているのはR05/06/08である。方針採否後も既存assertionとCLI基準fixtureの具体差分は別途の個別承認を要する。全回答後、採用した振る舞いへ規範文を確定し、主仕様へ同期される本文に候補・質問ID・未決選択肢を残さない。最新mainの通常merge、strict・仕様ゲートexit 0の順を守る。

## mainとCLI changeの順序

2026-10-30にfetchした最新mainは`751a8a1b6ffca673f44f2fa272b9029a667bf12b`で、PR #144の実装と#150/#152を含む。PR #144の`add-cli-reference-generation`はこのSHAで進行中changeのまま、REQ-323〜325はその差分にある。C-001では採用する共通定義args.ts・生成ページ・reference-cli-baseline.jsonをその実装へ追従させる。旧46例は互換原本として保持し、v2で変わる例の具体差分をR05の方針採否とは別に承認対象へ出す。

C-001の実装前にCLI changeのDoD・仕様同期/archiveが受け入れられた最新mainを通常mergeし、REQ-323〜325の正本が主仕様へ入ったことを確認する。そのあとREQ-323/324のMUST範囲を生成/集約単独へ限定するC-001のMODIFIEDを最終確定する。今はactive CLIの全Scenario/Sourceを保護した予約差分であり、archive前に正本を変更したとは扱わない。CLI changeのarchive待ちを理由にその主仕様を直接書き換えず、未archiveなら依存を記録して止める。fix-quality-reference-source-links（PR #149はmain取込済み、changeは未archive）のREQ-322のURL SHALLと4番目ScenarioもC-001のMODIFIEDへ保持し、同changeも仕様同期/archiveされてから最終整合を確認する。C-001を先にarchiveし、あとから古いグローバル不変条件を復活させる順にしない。現在のmain snapshot検証と、main取込済みで未archiveの149差分のURL文/全4 Scenario保持は別に検証する。snapshotの成功をどちらかのarchive実施の証拠とは扱わない。

## 仮定

| ID | 関連 | 仮定の内容 | 理由 | 承認 | 承認者 | 承認日 |
|---|---|---|---|---|---|---|

未承認の製品仕様を仮定で埋めない。承認済み7件は確認事項へ記録し、未承認のR05/06/08を仮定の承認として埋めない。Report 2への投影・同期API保持などの技術的な手段も、必要な採否を超えて人の承認を捏造しない。

## 技術確認と依存

| 対象 | 確認結果・扱い |
|---|---|
| #60 / REQ-307 | f397109基準のbranch作成時は未受入と記録。その後[PR140](https://github.com/loomake/loomake/pull/140)・[PR141](https://github.com/loomake/loomake/pull/141)で修正と仕様同期/archiveを受入、#60はclose済み。現在の実装停止は保留のR05/06/08と仕様ゲート |
| 最小quality読取 | coreにversion 2のスキーマ、kitに予算付きInputReaderがある。kitの現在の直接依存はcoreのみ。REQ-047の許容内でyaml追加を提案する |
| 証拠の既存取得 | runVerifyはコマンド前に古いレポートを消し、成功IDを抽出する。ただし版/SHA/環境/鮮度を含む完全な適格性は未接続。exit 0だけをPASS根拠にしない |
| scope | 既存API/CLIに指定なし。明示引数と--scopeを設計案にし、環境からの推測を避ける |
| Evidenceの版 | 必須verifyを2.0.0へ移すため新書き出しを2とする。旧1を履歴型・fixtureで保持する |
| Reportとrunner | Report 2の既存フィールド、RunSummaryの既存外形へ投影する。不要な新フィールドやReport 3を追加しない |
| 互換性・配布 | 公開側/利用側を同じchangeで切替。旧fixture改変、試験期待値の便宜的書換え、skipや設定緩和を禁止する |
| C-003へ残るもの | 全provider、完全なhost隔離、広いCI成果物/再利用、最小接続以外のpartialと全禁止キーの網羅。A候補の最小接続の適格性・実施確認はC-001内で成立させる |

## 詳細候補と工程記録

[部分承認と残るA案の具体化](design-candidate-a.md)は03の取得/planと04のS1/S2を別に示す。locator/envは場所を指すだけで承認や信頼の根拠にならない。新要件IDは割り当てない。著述工程と限定した実験の事実は[2026-10-30の作業記録](../../../docs/worklog/2026-10-30/spec-verify-v2-c001.md)に記し、Git対象外のファイルを要件の出典や承認証拠として使わない。

## 検証の記録

計画段階のOpenSpec strictと仕様ゲートの実行結果はworklogへ記録する。仕様ゲートの期待結果はR-C001-05/06/08の未回答によるexit 1であり、実装開始可能や製品DoD達成を意味しない。製品実装は行わない。doneは計画段階の未完了と既存品質コマンドの維持を確認するために実行し、製品DoD達成とは扱わない。
