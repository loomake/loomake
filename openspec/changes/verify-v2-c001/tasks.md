# Tasks

当初のPR #139は計画のみを受け入れた。#60/REQ-307はPR #140・#141で受入済みであり、R-C001-05 A・06 A・08 Bも[追加回答](https://github.com/loomake/loomake/pull/139#issuecomment-6511434324)で回答済みである。以下のチェック付きタスク本文は原計画と受入範囲を保持するため変更していない。「保留」「回答後」「Aなら/Bなら」は当時の記述として読み、現在は採用済みA/A/Bを適用する。回答待ちを現在の停止理由にはせず、親1.2の残確認と1.3以降を進める。[S1/S2の設計詳細](design-candidate-a.md)に含まれる承認済みR03/04/07 A・R05 A/R06 A/R08 Bと補足R11〜13等の旧採用履歴、未実装の技術候補を区別する。当時の全A比較と補足の採用履歴を保持し、補足の現在の扱いは[後続判断との対応](design.md#旧補足と後続判断の対応)に従う。R08 Aだけに依存する記述は採用しない。最小適格性・信頼基準と独立S1準備→通常done 0→同期/archive→S2の義務を保持し、その具体設計・実装・独立受入は残る。印は1/9のままで、親全体は未完了である。

## 1. 仕様と依存の確定

- [x] 1.1 proposal・差分仕様・design・tasks・traceを準備し、出典・公開側/利用側・未回答の停止範囲をレビューできる資料にする。OpenSpec strictの成功と、仕様ゲートが未回答で失敗することを記録する
- [ ] 1.2 承認済みR01/02/03/04/07/09/10のAを保持し、保留のR05/06/08の採否と承認元を記録する。#60受入済みの事実を踏まえ、採用するsource/metric・plan・最小適格性・正常PASS例・REQ-036/037/038/039/040/042/050/055/073/093/114/115/135/136/164/183/191/203/275/276/305/307/322とC1〜C5の具体的assertion差分を整理する。R05/R06の回答後、このタスクでREQ-135・136のMODIFIEDを確定する。REQ-093のMODIFIED（spec-only不合格1とusage/config aborted 2・その他aborted 3を分け、実装ブランチ作成/エンジン呼出しを止める）は、子change `verify-v2-readers` で確定済み。135もR05 Aなら全オプション説明義務の本文を保持し、既存verify/trace recordヘルプScenarioへscopeを加える。136はR06 Aなら完了ゲート本文を明示localへ変更し、最終ci確認と区別して印と既存Scenarioを保持する。Bなら136本文と雛形の既定ciコマンドを保持する。全回答後、規範文から候補・質問ID・未決選択肢を除いて採用した振る舞いだけへ確定し、台帳を更新する。PR #155でCLI/URL両changeが同期/archiveされ、main d5aa30dのREQ-323〜325とREQ-322のURL/4 Scenarioへ入ったことを確認する。REQ-323/324のMUSTを生成/集約単独へ限定する差分、REQ-100の明示local、REQ-306の非接続範囲もR05の採否へ含め、全既存Scenario/Sourceを保持する。最新mainは通常merge済みであり、採否確定後のstrictと仕様ゲートexit 0を確認する。全C-001差分を一時コピーでarchiveして全capabilityの主仕様strictを通し、全MODIFIEDの本文字数をOpenSpecのパーサで測って500以内と確認する。上限に近いREQ-322・114と短縮した306は文言確定後に再計測する。本番archiveは製品DoD達成後とし、保護された期待値変更は具体差分の個別承認を得る

移管追記（5b）：REQ-136 の MODIFIED は子 `verify-v2-dod` で確定する。REQ-135 は子 `verify-v2-scope` で確定済み。上の旧本文と親1.2全体の受入条件は保持する。R05 A・R06 A・R08 B は回答済みで再質問しない。規則移行とkit-assets:251の具体的な期待値差分は別々に明示承認済みで、子8/8・local/ci完了ゲートexit 0・必須CI成功・独立最終レビュー重大0を満たした。子は[PR #269](https://github.com/loomake/loomake/pull/269)のhead `27b8295fa7b276bc659aefb88004742667312c23` をmain `6fa36825` で受入済みである。

検証追記（1.2の一部）：main `620550a` の一時コピーで指定10changeをarchiveし、各段の全30capability strictは実exit 0だった。35MODIFIED本文は500 UTF-16以内（最大REQ-322の498、REQ-114は496）、Scenario703→752・欠落0、Source欠落0、期待本文不一致0、Purpose保持を確認した。正式archiveではなく、規範全体・1.2の他条件・S1具体化/独立受入は未完了のため、1.2の印は変えない。
- [ ] 1.3 1.2後、承認済みR-C001-04 Aに従い、R05/06/08の採否後にS1内部基準準備を具体化する。承認済みanchor/spec/必須REQ集合・quality/plan/method/tool/version/hashを固定し、環境の記録・照合も S1 で扱う（Q-08 A）。private handoff・base-built判定module・S2自己ゲートとの一致検査を準備する。先行受入するS1は独立change・その範囲のDoD/REQ対応試験/通常done 0で受け入れ同期archive後にS2へ進む候補とし、新change/IDは採否後の担当・既用ID・枠確認まで作らない。親doneを緩めず、S1をC-001完了とせず、設定・公開操作は別途の具体的承認まで行わない（REQ-313・319）

## 2. 公開形式と履歴の分離

旧タスク2.1と2.2のスキーマ・型・loader・版付きJSON Schema・schema-contract-checkは、子change `verify-v2-shape` のタスク1.2〜1.5へ移した。

- [ ] 2.2 書き出しを2.0.0とEvidence 2へ切り替えるときに、版付きでないverify・evidenceのJSON Schemaを現行版へ移し、schema-history に2.0.0を追加する。配布試験で旧版の版付きパスと履歴validatorを確かめ、型移行の説明を更新する（REQ-318）

## 3. 最小入力と限定した判定

旧タスク3.2・3.4と3.1の読取部は子change `verify-v2-shape` のタスク1.7・1.8へ移した。

旧タスク3.1・3.3は子change `verify-v2-quality` へ移した。3.3のうち、method（script・config・lock・toolのhash）・verification.yamlのplan・PRのREQ削除は1.3（S1）へ。

旧タスク3.4（R-C001-08のゲート別warn対応・localのOpenSpec不在NA・ciの不足、REQ-191のskip-commands不足1、R-C001-10のspec-only品質計数。REQ-036・037・038・039・191）は、子change `verify-v2-gates`（3/6）へ移した。同じ子changeでREQ-203の未承認警告の用語（trace-agreementの差分仕様）も確定した。

## 4. CLIと既存利用側の一体移行

旧タスク4.3の版別の投影は子change `verify-v2-shape` のタスク1.9へ移した。runnerの純粋判断（REQ-205）と仕様ゲートのaborted（REQ-093）の読み取りは、子change `verify-v2-readers`（2a/6）へ移した。旧タスク4.1・4.2・4.4のうちverifyの書き出しの切替（REQ-040・041・100・311・315）と、旧4.6・4.7、4.9のrunVerifyの保証、4.11の --scope local の固定は、子change `verify-v2-wiring`（2b-1/6）へ移した。旧4.3（reportのEvidence 2の受付と、未対応版・形の違う記録の拒否）と旧4.8（Evidenceの現行名、互換性の文書、root quality.yaml、`--skip-commands` のhelpと基準の差分）は、子change `verify-v2-evidence`（2b-2/6）へ移した（REQ-073・324）。

旧タスク4.1のうち、`--scope local|ci` のCLI（verifyとtrace record）、args.tsの共通定義・help/usage・docs/guide/3.reference/5.cli.mdの生成、reference-cli-baseline.jsonの旧46例の差分の記録、REQ-050の処理量の保持は、子change `verify-v2-scope`（4/6）へ移した（REQ-050・135・194・041・312・323）。runVerifyのscope既定値とAPI/CLIの0〜3の一致は同じ子changeで確かめる。
- [ ] 4.2 trace recordをEvidence 2へ移し、scopeと終了コード、aborted、文書snapshot・未コミット・検査前後変化・追記専用・同期性とserializationのJSON前後検査・publicationの上書き禁止を既存回帰とID付き試験で確認する（REQ-066・315）（CLIの `trace record --scope` は子change `verify-v2-scope` へ移した）
- [ ] 4.4 runnerの準備・local完了・decision停止・記録をv2へ追従し、reuse/pr/prompt/recorderも含む型・表示・再利用を追従し、RunSummary外形・中断/予算/変更保持と要判断+FAILで止まる試験を確認する。REQ-100の既存5 Scenarioを保持してverify --done --scope localと同じ検査へ追従し、REQ-205の判断順を保つ。1.2で確定したREQ-093に従いspec-only不合格1とaborted 2/3の停止を実装・試験し、実装ブランチを作らずエンジンを呼ばないことと全既存Scenarioを確認する。REQ-114/115のPR本文はlocal完了0とCI最終未確認を分け、REQ-164/315はEvidence 2/localの同一状態再試行と旧版非再利用を同じ試験で確認する。agreement/doctorへverify限定のエラー分類を漏らさない（REQ-205・317）
- [ ] 4.5 ci-gateと関連workflowの利用経路をv2/ciへ移し、local・旧形式・skip/neutral・全NAを合格にしない統合試験、R-C001-04がAの場合だけnormal self-ciがS1判定moduleを直接使うことと、fresh Tを基準としたexact 2.0.0解析・S/T一致を確認し、採用したbare verify品質経路を確認する（REQ-312・318）
旧タスク4.9（evidenceProblemのpending≥insufficient）・4.10（ci-gateを実行の流れにつなぎ、1.0.0・spec-only・全件NOT_APPLICABLEを合格にしない）・4.11（runの完了ゲートにciの結果が来たら停止する）と、4.4のREQ-164の旧版非再利用・REQ-317、4.5のREQ-318は、子change `verify-v2-strict`（2c/6）へ移した。

## 5. 配布・受入

- [ ] 5.1 core/kit/trace/CLIのminorとrunnerのpatch changeset、形式版と利用側の移行案内を追加し、実tarball・公開型・JSON・CLI/API・旧fixture閲覧を検証する。1.2で採用したR-C001-06に従いAGENTS.md・packages/kit/templates/AGENTS.md・guide・PRテンプレートのローカルDoD/CI合格のコマンドと説明を同時に更新する。CONTRIBUTING.md、README.md、README.en.md、packages/cli/README.md、docs/flow.md、.agents/skills/delivery/SKILL.mdと、雛形文面を固定しているtests/kit-assets.test.ts:251も移行対象とする。kit-assetsの期待値は具体差分の個別承認を得てから変更し、R06の方針承認だけで変更しない。req-to-openspecのtasks雛形2箇所（packages/kit/templates/skills/req-to-openspec/references/openspec-format.md、.agents/skills/req-to-openspec/references/openspec-format.md）も対象にする。1.2で確定したREQ-136と採用コマンドを両雛形へ反映し、印を付ける既存Scenarioと完了ゲートの印を保持する試験を行う。Scenario変更後にREQ-190の監査をやり直し、docs/quality/scenarios.jsonのScenario hash・対応テスト・理由を実際の最新試験へ照合して更新する。旧レビューのhashだけを書き換えて済ませず、不足/無効の残りも記録する。CLI共通定義・生成ページ・新旧基準fixtureが同じ受理/出力を表すことを検査し、基準差分の個別承認を照合する。既存試験・設定を緩めずlint・typecheckと全体試験を通す（REQ-308〜319）

移管追記（5b）：DoD・配布文書・両tasks雛形・kit-assets:251とREQ-136のScenario監査を子 `verify-v2-dod` へ移した。上の旧本文と残るchangeset・実tarball・公開型・形式移行・CLI基準・その他のREQ-190監査は保持する。guideのscope説明は[PR #289](https://github.com/loomake/loomake/pull/289)のhead `30a331abaf4ba8ec9edb29d513063e043e417a86` をmain `8a5f3659` で受入済みで、基準main `620550a` には2.0.0 JSON例もある。これらを未移行の残作業には数えず、親5.1全体の検証とREQ-190監査の残りを保持する。
- [ ] 5.2 正常PASS・abortedの2/3・不足1のCLI/API統合、全要件のID付きテストと独立レビューを確認し、R-C001-06の回答に従い最終headのローカルDoDとci完了ゲート・必須CI成功を記録する。Aならローカルは `--done --scope local` の0、最終CIは `--done --scope ci` のreal v2/PASS・要判断なし・0を両方必要とする。R-C001-04がAなら独立trusted checkも追加条件として確認し、Bなら採用した信頼基準を検証する。C-003へ残る全provider/host隔離/広い取得経路と#61/63/64全体の未完了を明記する（REQ-319） <!-- loomake:gate=done -->
注：archiveは6/6（受入）のマージのあとに、verify-v2-shape・verify-v2-readers・verify-v2-wiring・verify-v2-evidence・verify-v2-strict・verify-v2-gates・verify-v2-scope・verify-v2-quality・verify-v2-dod・verify-v2-c001を順に行う。evidence→scope→quality→dod→parent の整合と、S1 の先行受入・同期・archive を保つ
