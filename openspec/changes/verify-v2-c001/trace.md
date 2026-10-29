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

Issue参照：[契約 #61](https://github.com/loomake/loomake/issues/61)、[判定 #63](https://github.com/loomake/loomake/issues/63)、[CLI #64](https://github.com/loomake/loomake/issues/64)。質問の管理先は[進行管理 #121](https://github.com/loomake/loomake/issues/121)。この計画は人の承認前であり、Issueの調査メモを本案の採用承認として扱わない。

## 要件台帳

| ID | 出典 | 種別 | 要約（原文に忠実に） | 状態 | 反映先 |
|---|---|---|---|---|---|
| REQ-040 | 現行verify「JSON 出力」、要件7.3 | 既存変更 | v2でも要件ごとの成功テストファイル一覧をcoverageに保持し、abortedに補わない | 反映済 | specs/verify/spec.md |
| REQ-041 | 現行verify「終了コード」、要件7.3・WBS J02 | 既存変更 | 従来の使い方2を維持しv2の共通判定REQ-311を参照する | 反映済 | specs/verify/spec.md |
| REQ-066 | 現行trace-record「証拠の記録」、WBS W1-5 | 既存変更 | v2結果と同じ終了コードで追記記録する。未コミット・change不正の停止は保持する | 反映済 | specs/trace-record/spec.md |
| REQ-205 | 現行run-decision-policy「完了ゲート後の純粋な判断」、要件7.3・FR-12 | 既存変更 | v2の要判断とabortedで止まり、local完了をDraft PRへ進む条件として扱う | 反映済 | specs/run-decision-policy/spec.md |
| REQ-274 | 現行core-parsers、要件7.3・WBS J03 | 既存変更 | 現行v2と旧1.0.0履歴のスキーマ・導出型を分離する | 反映済 | specs/core-parsers/spec.md |
| REQ-275 | 現行core-parsers「verify結果の未知のフィールド」・レビュー指摘2 | 既存変更 | 現行checksと履歴resultsの未知値を保持し、v2の既知禁止キーと区別する | 反映済 | specs/core-parsers/spec.md |
| REQ-276 | 現行core-parsers「JSON Schemaの書き出し」・レビュー指摘9 | 既存変更 | 現行と履歴の公開JSON Schemaを分ける。旧版公開の採否はR-C001-09待ち | 確認待ち | specs/core-parsers/spec.md |
| REQ-302 | 現行core-parsers、要件7.3・WBS同時追従 | 既存変更 | Evidenceを2へ移し旧1を保持、Report 2と既存の構造制約を維持する | 反映済 | specs/core-parsers/spec.md |
| REQ-303 | 現行core-parsers、WBS同時追従 | 既存変更 | 同期APIと整合性検査・遅延zodを維持し新旧証拠へ追従する | 反映済 | specs/core-parsers/spec.md |
| REQ-304 | 現行core-parsers、要件7.3・WBS J03 | 既存変更 | verify/evidenceの新形式と旧fixtureを保持し、無関係6 JSONを変えない | 反映済 | specs/core-parsers/spec.md |
| REQ-305 | 受入済み共有4値・レビュー指摘2 | 既存変更 | 共有4値と遅延ロードを保ち、verify/evidenceの現行形式と無関係6 JSONの保持を分ける | 反映済 | specs/core-parsers/spec.md |
| REQ-307 | main f4e3edbの未知キー保持・互換性照合 | 既存変更 | 現行checksと履歴resultsを保持対象にし、8 JSON不変をv2対象2本と無関係6本へ分ける | 反映済 | specs/core-parsers/spec.md |
| REQ-073 | 現行trace-report「使った証拠の記載」・レビュー指摘2 | 既存変更 | Evidence 1/v1とEvidence 2/v2の対応版を受け付け未対応版・不正構造は拒否する | 反映済 | specs/trace-report/spec.md |
| REQ-308 | 要件7.3、architecture0.5、WBS W1-2 | 機能 | v2のci/local completed/partialとaborted、未知キー許容・既知禁止キーを区別する | 反映済 | specs/core-parsers/spec.md |
| REQ-309 | 要件7.3実行エラー、WBS W1-2 | 機能 | change未確定nullのabortedと、構文が有効な不存在changeのREQ-055 FAIL/1を区別する | 反映済 | specs/core-parsers/spec.md |
| REQ-310 | 要件7.1・7.3、WBS C-001、Issue61準備調査 | 機能 | 最小quality読取・既定値と構文2/読取3。spec-only不在の提案はR-C001-07待ち | 確認待ち | specs/verify/spec.md |
| REQ-311 | 要件7.3終了コード表、WBS W1-5 | 機能 | API/CLI共通の0〜3、stdout JSONのみ、stderr診断、非対話 | 反映済 | specs/verify/spec.md |
| REQ-312 | 要件7.3・FR-12、現行REQ-042、WBS W1-5 | 機能 | scopeと既存の検査を保持する。bare verify適用境界はR-C001-01待ち | 確認待ち | specs/verify/spec.md |
| REQ-313 | 要件7.1・7.3集約の規則、WBS W1-4 | 機能 | 純粋な限定条件判定で証跡不足・必須違反・NA・PASSを区別する | 反映済 | specs/verification-policy/spec.md |
| REQ-314 | 要件7.3集約・件数、REQ-305/306先行受入 | 機能 | 既存4値集約、件数とlocal pending。evaluatedはR-C001-02待ち | 確認待ち | specs/verification-policy/spec.md |
| REQ-315 | 要件7.3、WBS J03・W1-5 | 機能 | Evidence 2でv2を保存し、旧1.0.0を自動再利用しない | 反映済 | specs/trace-record/spec.md |
| REQ-316 | WBS J03・W1-2・W1-5、現行Report 2契約 | 機能 | 新旧証拠を既存Report外形へ投影し旧版を閲覧専用にする | 反映済 | specs/trace-report/spec.md |
| REQ-317 | 要件7.3・FR-12、architecture0.5、WBS同時追従 | 機能 | runnerはdecisionで停止し、local完了と最終CI合格を分ける | 反映済 | specs/run-decision-policy/spec.md |
| REQ-318 | WBS5章同時追従・J03、architecture0.4、互換性文書 | 移行 | 配布された型・CLI/API・Schemaとci-gateの版別受理が一致する | 反映済 | specs/monorepo/spec.md |
| REQ-319 | WBS5章C-001正常/不正/不足、AGENTS DoD、Issue61調査 | 受入 | CLI/APIは正常PASS・不正aborted・不足を区別し、古い結果から合格を作らない | 確認待ち | specs/verify/spec.md |

REQ-305/306はPR #138、REQ-307は#60保持修正の既存IDである。305・307は今回その既存要件をMODIFIEDとし、別の振る舞いへ再割当しない。既存REQ-042はR-C001-01未回答のため、いまは変更したと扱わない。

## 確認事項

| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 | 回答者 | 回答日 |
|---|---|---|---|---|---|---|---|---|
| R-C001-01 | REQ-312・REQ-309 | 要件7.3のchange未指定abortedと現行REQ-042のbare verify品質専用をどう適用するか | A: bare verify品質専用を維持しchange必須ゲートの未指定をabortedにする / B: bare verifyもabortedにし品質専用の代替操作を同じchangeで定義する | A。現在の品質確認とci-gateのnone/文書経路を維持できる。7.3の適用境界を明記する必要は残る | yes | | | |
| R-C001-02 | REQ-314 | summary.evaluatedは何件を数えるか | A: checks全件（PASS/FAIL/不足/NA） / B: NAを除く適用対象件数 | A。全4値の合計と一致し、ゼロと全NAを別に説明できる。既存資料には定義がなく採否が必要 | yes | | | |
| R-C001-03 | REQ-313・319 | C-001で実証跡を取る範囲をどうするか。adapter・verification.yamlの契約と適格性検査だけでも複数タスクを要する | A: 新鮮なコマンド結果/REQレポートの最小adapter・plan・適格性をC-001へ先行 / B: C-003と並行準備し必要範囲を合同受入 | A。正常/不正/不足を同じCLI/APIで受入可能にする。信頼する判定器の構築は04で別に判断する | yes | | | |
| R-C001-04 | REQ-313・318・319 | 信頼する判定器を別段階で準備するか。独立change・build・照合・引継ぎ・自己ゲートまで必要 | A: 詳細候補のS1独立change・base-built checker・private handoffとS2照合を採用 / B: その案を採らず信頼基準と依存を再設計 | A。PRが書いた結果だけで自己合格にしない。単なるadapter追加より大きく、S1のDoD・同期archiveを先に要する | yes | | | |
| R-C001-05 | REQ-040・055・073・274・275・302〜305・307 | 詳細候補のC1〜C5の非互換移行を受け入れるか | A: C1旧形のv2化、C2不存在FAIL/1維持、C3Evidence2受理、C4型/埋込版移行を採用しC5診断/同期性を保つ / B: 非互換範囲を再設計 | A。旧fixtureは保持し形だけ移行する。具体的な既存assertionの変更は棚卸し差分を提示して個別承認し、未定の診断緩和やskipは含めない | yes | | | |
| R-C001-06 | REQ-312・315・319、AGENTS DoD | done既定ciに対してローカルDoDをどう満たすか | A: ローカルは --done --scope local の0、最終受入は --done --scope ci の0と必須CIを要求するよう規約/guideを移行 / B: ローカルでもci証拠を取得し既定done 0を要求 | A。ローカル完了と最終合格を区別し、CI証拠不足でローカル作業が恒久停止しない。AGENTS・配布規約・PRテンプレートも同時に修正する | yes | | | |
| R-C001-07 | REQ-310・312 | root quality.yamlがない既存導入のspec-onlyと移行時期をどうするか | A: spec-onlyでは不在だけ許容し構造検査を対象外、doneは不在3。切替前にこのrepoへ有効なqualityを配置 / B: spec-onlyも不在3とし既存change全件の事前移行後に切替 | A。既存の仕様ゲートを一斉に落とさず、完了ゲートの必要証拠は維持する。存在する不正/読取不能はspec-onlyでも2/3 | yes | | | |
| R-C001-08 | REQ-312・314 | 現行warnを4値へどう対応させるか | A: 未知設定キーはPASSの理由、未承認/確認待ちは不足と要判断、OpenSpec未実施は不足とする設計表を採用 / B: 全warnを不足にする | A。未知設定キーを許す既存互換性を保ち、未承認・未実施を成功に写さない。OpenSpec不在などの旧warnが不足へ変わる影響も確認する | yes | | | |
| R-C001-09 | REQ-276・304・305 | 外部から読める旧verify/evidence JSON Schemaを公開し続けるか | A: 既存パスを現行版へ移し、旧版を版付きの追加パス/exportsで配布 / B: 旧版JSONは配布せず履歴型/fixtureだけ残す | A。履歴データを検証する外部利用側にも移行先を用意できる。パス変更と読み分けを移行説明へ記載する | yes | | | |
| R-C001-10 | REQ-312・314 | localのspec-onlyで品質項目をchecks/summaryへ数えるか | A: 仕様/構造検査のみ数え、品質targetやquality:subjectsを生成しない / B: 品質項目を不足として数えpendingにする | A。仕様ゲートで品質実施を要求しない原則と一致し、構造検査のPASSを品質PASSへ転用しない | yes | | | |

質問管理先：[R-C001-01〜10 / PR #139](https://github.com/loomake/loomake/pull/139)。[レビュー指摘](https://github.com/loomake/loomake/pull/139#issuecomment-6508732362)を出典として、03の取得範囲と04の判定器構築を分け、05〜10の採否も仕様ゲートで確認する。追加項目を承認済みとは扱わない。

全10件が未回答で、全製品コード・形式切替・利用側移行を止める。01のBならREQ-042の完全なMODIFIED差分と品質専用代替を追加し、02は件数を固定する。03/04のAなら取得/plan契約とS1/S2の採用内容を差分仕様へ反映する。05は具体的assertion差分を別途確認する。06〜10の選択がA候補と異なる場合も、影響する仕様・design・tasksを更新してからstrictと仕様ゲートexit 0を確認する。

## 仮定

| ID | 関連 | 仮定の内容 | 理由 | 承認 | 承認者 | 承認日 |
|---|---|---|---|---|---|---|

未承認の製品仕様を仮定で埋めない。scopeの明示・Report 2への投影・同期API保持・初期quality手動配置・責務分離は根拠をdesignに記した技術提案であり、人が決めた回答として記録していない。

## 技術確認と依存

| 対象 | 確認結果・扱い |
|---|---|
| #60 / REQ-307 | f397109基準のbranch作成時は未受入と記録。その後[PR140](https://github.com/loomake/loomake/pull/140)・[PR141](https://github.com/loomake/loomake/pull/141)で修正と仕様同期/archiveを受入、#60はclose済み。現在の実装停止は未回答10件と仕様ゲート |
| 最小quality読取 | coreにversion 2のスキーマ、kitに予算付きInputReaderがある。kitの現在の直接依存はcoreのみ。REQ-047の許容内でyaml追加を提案する |
| 証拠の既存取得 | runVerifyはコマンド前に古いレポートを消し、成功IDを抽出する。ただし版/SHA/環境/鮮度を含む完全な適格性は未接続。exit 0だけをPASS根拠にしない |
| scope | 既存API/CLIに指定なし。明示引数と--scopeを設計案にし、環境からの推測を避ける |
| Evidenceの版 | 必須verifyを2.0.0へ移すため新書き出しを2とする。旧1を履歴型・fixtureで保持する |
| Reportとrunner | Report 2の既存フィールド、RunSummaryの既存外形へ投影する。不要な新フィールドやReport 3を追加しない |
| 互換性・配布 | 公開側/利用側を同じchangeで切替。旧fixture改変、試験期待値の便宜的書換え、skipや設定緩和を禁止する |
| C-003へ残るもの | 全provider、完全なhost隔離、広いCI成果物/再利用、最小接続以外のpartialと全禁止キーの網羅。A候補の最小接続の適格性・実施確認はC-001内で成立させる |

## 詳細候補と工程記録

[全Aの場合の未承認候補](design-candidate-a.md)は03の取得/planと04のS1/S2を別に示す。locator/envは場所を指すだけで承認や信頼の根拠にならない。新要件IDは割り当てない。著述工程と限定した実験の事実は[2026-10-30の作業記録](../../../docs/worklog/2026-10-30/spec-verify-v2-c001.md)に記し、Git対象外のファイルを要件の出典や承認証拠として使わない。

## 検証の記録

計画段階のOpenSpec strictと仕様ゲートの実行結果はworklogへ記録する。仕様ゲートの期待結果はR-C001-01〜10の未回答によるexit 1であり、実装開始可能や製品DoD達成を意味しない。製品実装は行わない。doneは計画段階の未完了と既存品質コマンドの維持を確認するために実行し、製品DoD達成とは扱わない。
