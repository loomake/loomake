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
| REQ-041 | 現行verify「終了コード」、要件7.3・WBS J02 | 既存変更 | 従来の使い方2を維持しv2の0〜3優先順を明示する | 反映済 | specs/verify/spec.md |
| REQ-066 | 現行trace-record「証拠の記録」、WBS W1-5 | 既存変更 | v2結果と同じ終了コードで追記記録する。未コミット・change不正の停止は保持する | 反映済 | specs/trace-record/spec.md |
| REQ-205 | 現行run-decision-policy「完了ゲート後の純粋な判断」、要件7.3・FR-12 | 既存変更 | v2の要判断とabortedで止まり、local完了をDraft PRへ進む条件として扱う | 反映済 | specs/run-decision-policy/spec.md |
| REQ-274 | 現行core-parsers、要件7.3・WBS J03 | 既存変更 | 現行v2と旧1.0.0履歴のスキーマ・導出型を分離する | 反映済 | specs/core-parsers/spec.md |
| REQ-302 | 現行core-parsers、要件7.3・WBS同時追従 | 既存変更 | Evidenceを2へ移し旧1を保持、Report 2と既存の構造制約を維持する | 反映済 | specs/core-parsers/spec.md |
| REQ-303 | 現行core-parsers、WBS同時追従 | 既存変更 | 同期APIと整合性検査・遅延zodを維持し新旧証拠へ追従する | 反映済 | specs/core-parsers/spec.md |
| REQ-304 | 現行core-parsers、要件7.3・WBS J03 | 既存変更 | verify/evidenceの新形式と旧fixtureを保持し、無関係6 JSONを変えない | 反映済 | specs/core-parsers/spec.md |
| REQ-308 | 要件7.3、architecture0.5、WBS W1-2 | 機能 | v2のci/local completed/partialとaborted、未知キー許容・既知禁止キーを区別する | 反映済 | specs/core-parsers/spec.md |
| REQ-309 | 要件7.3実行エラー、WBS W1-2 | 機能 | change未確定nullと入力・種別・対象・説明・次の操作を持つabortedにする | 反映済 | specs/core-parsers/spec.md |
| REQ-310 | 要件7.1・7.3、WBS C-001、Issue61準備調査 | 機能 | 最小quality読取・既定値と、構文/型の2・不在/読取不能の3を区別する | 反映済 | specs/verify/spec.md |
| REQ-311 | 要件7.3終了コード表、WBS W1-5 | 機能 | API/CLI共通の0〜3、stdout JSONのみ、stderr診断、非対話 | 反映済 | specs/verify/spec.md |
| REQ-312 | 要件7.3・FR-12、現行REQ-042、WBS W1-5 | 機能 | scopeと既存の検査を保持する。bare verify適用境界はR-C001-01待ち | 確認待ち | specs/verify/spec.md |
| REQ-313 | 要件7.1・7.3集約の規則、WBS W1-4 | 機能 | 純粋な限定条件判定で証跡不足・必須違反・NA・PASSを区別する | 反映済 | specs/verification-policy/spec.md |
| REQ-314 | 要件7.3集約・件数、REQ-305/306先行受入 | 機能 | 既存4値集約、件数とlocal pending。evaluatedはR-C001-02待ち | 確認待ち | specs/verification-policy/spec.md |
| REQ-315 | 要件7.3、WBS J03・W1-5 | 機能 | Evidence 2でv2を保存し、旧1.0.0を自動再利用しない | 反映済 | specs/trace-record/spec.md |
| REQ-316 | WBS J03・W1-2・W1-5、現行Report 2契約 | 機能 | 新旧証拠を既存Report外形へ投影し旧版を閲覧専用にする | 反映済 | specs/trace-report/spec.md |
| REQ-317 | 要件7.3・FR-12、architecture0.5、WBS同時追従 | 機能 | runnerはdecisionで停止し、local完了と最終CI合格を分ける | 反映済 | specs/run-decision-policy/spec.md |
| REQ-318 | WBS5章同時追従・J03、architecture0.4、互換性文書 | 移行 | 公開型とCLI・CI gate・runner・traceを同じchangeで追従し配布検証する | 反映済 | specs/monorepo/spec.md |
| REQ-319 | WBS5章C-001正常/不正/不足、AGENTS DoD、Issue61調査 | 受入 | 正常PASSと自己完了ゲートを削らず、最小実証跡の範囲・依存はR-C001-03で決める | 確認待ち | specs/verify/spec.md |

REQ-305/306はPR #138、REQ-307は#60保持修正の専用IDであり、本changeへ再割当しない。既存REQ-042はR-C001-01未回答のため、いまは変更したと扱わない。

## 確認事項

| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 | 回答者 | 回答日 |
|---|---|---|---|---|---|---|---|---|
| R-C001-01 | REQ-312・REQ-309 | 要件7.3のchange未指定abortedと現行REQ-042のbare verify品質専用をどう適用するか | A: bare verify品質専用を維持しchange必須ゲートの未指定をabortedにする / B: bare verifyもabortedにし品質専用の代替操作を同じchangeで定義する | A。現在の品質確認とci-gateのnone/文書経路を維持できる。7.3の適用境界を明記する必要は残る | yes | | | |
| R-C001-02 | REQ-314 | summary.evaluatedは何件を数えるか | A: checks全件（PASS/FAIL/不足/NA） / B: NAを除く適用対象件数 | A。全4値の合計と一致し、ゼロと全NAを別に説明できる。既存資料には定義がなく採否が必要 | yes | | | |
| R-C001-03 | REQ-313・REQ-319 | C-001で適格な実証跡に基づく正常PASSと自己完了ゲートを成立させる取得範囲と依存をどうするか | A: 新鮮なコマンド結果/REQ対応レポートの最小adapterと必要な適格性・実施確認をC-001へ先行する / B: 取得/適格性を並行準備しC-001/C-003の必要範囲を合同受入する計画へ変える | A。C-001の正常/不正/不足を同時に受け入れられる。source/metric、対象版/SHA/環境/手順/鮮度と信頼する基準、required_byを持つ検証計画の最小入力・受入例を先に仕様へ固定する必要がある | yes | | | |

質問管理先：[R-C001-01〜03 / #121](https://github.com/loomake/loomake/issues/121)。R-C001-01は#61の既存管理ID。02・03は本changeで具体化した追加の未回答項目であり、#121に集約する前に採用済みとは扱わない。

3件とも未回答なので仕様ゲートを止め、全製品コード・形式切替・利用側移行に進まない。01がBならREQ-042の完全なMODIFIED差分と品質専用代替を追加する。02は件数期待値を固定する。03がAならsource/metric・検証計画の版/required_by・適格性の条件を差分仕様へ足す。03がBなら依存順を改め、C-001の正常PASS・DoDを取り除かない。

## 仮定

| ID | 関連 | 仮定の内容 | 理由 | 承認 | 承認者 | 承認日 |
|---|---|---|---|---|---|---|

未承認の製品仕様を仮定で埋めない。scopeの明示・Report 2への投影・同期API保持・初期quality手動配置・責務分離は根拠をdesignに記した技術提案であり、人が決めた回答として記録していない。

## 技術確認と依存

| 対象 | 確認結果・扱い |
|---|---|
| #60 / REQ-307 | 未知キー保持修正の受入が実装開始の依存。本branchはf397109時点で未受入のため、実装しない |
| 最小quality読取 | coreにversion 2のスキーマと既定値があり、kitにyaml依存・予算付きInputReaderがある。新しい一般名前空間を仮定せず利用できる |
| 証拠の既存取得 | runVerifyはコマンド前に古いレポートを消し、成功IDを抽出する。ただし版/SHA/環境/鮮度を含む完全な適格性は未接続。exit 0だけをPASS根拠にしない |
| scope | 既存API/CLIに指定なし。明示引数と--scopeを設計案にし、環境からの推測を避ける |
| Evidenceの版 | 必須verifyを2.0.0へ移すため新書き出しを2とする。旧1を履歴型・fixtureで保持する |
| Reportとrunner | Report 2の既存フィールド、RunSummaryの既存外形へ投影する。不要な新フィールドやReport 3を追加しない |
| 互換性・配布 | 公開側/利用側を同じchangeで切替。旧fixture改変、試験期待値の便宜的書換え、skipや設定緩和を禁止する |
| C-003へ残るもの | partialの実取得経路と全禁止キーの網羅、全providerの実証跡取得・適格性/実施確認。03で先行する最小範囲が決まるまでは全体を完了としない |

## 検証の記録

計画段階のOpenSpec strictと仕様ゲートの実行結果はworklogへ記録する。仕様ゲートの期待結果はR-C001-01〜03の未回答によるexit 1であり、実装開始可能や製品DoD達成を意味しない。コード実装・全体試験・完了ゲートは実行しない。
