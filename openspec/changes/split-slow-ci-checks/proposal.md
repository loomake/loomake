# Why

利用者の2026-10-30のdelivery指示1-1は、Node22.12以上という配布物の下限に合わないnode20の追加検査を削り、10秒を超えるcaseをVitestのslow projectへ分け、PRを軽くするよう求めている。現行monorepoにはNode20とPR時の全件実行を含む開発運用契約があるため、実装前に仕様との関係を整理する。

# What Changes

- `split-slow-ci-checks`は1 changeのまま、200KiBの差分上限に合わせて開発基盤と実登録を段階的なPRへ分ける（Q-38）。Node20ジョブ削除と全PR経路でのslow不実施は最後のPR184で同時に有効にし、途中のPRを1-1全体の完成とは扱わない。
- REQ-144はNode20追加検査だけを外し、3OS Node24とNode22.12.0の下限検査を保つ。
- ADR0005に従い、049/214の開発運用をdocs/dev/ci.mdへ移す。元の全文・8 Scenario・Source・旧試験名を保存し、利用者のPR軽量化に対応した運用を同文書へ記録する。主仕様の反映はchange経由のsync/archiveで行う。
- 最新headの3OS各3sampleで最大10秒超のcaseをOS別にslowへ分ける。PRの全経路でslowを実行せず、main push・scheduleとローカルの全件実行を保つ。releaseの既存manual dispatch品質ゲートも全件を保つ。
- case 本文は元の `x.test.ts` に残し、宣言直前の分岐と companion の動的 import で登録先を分ける。`x.cases.ts` への本文移動は採用しない。a3bf248bの構造案とV0を、995e対象のcd321d46の監査・独立宣言検査の設計で補う。G-Bに続き、C1のengine-long-deadline・scenario-timeout-evidence・signal-during-sync・run-timeoutの登録設計を採用する。残る個別設計と実OS割当は未完了のまま残す。
- 登録された companion の実行結果を元 source の本文ブロックへ対応付けるため、REQ-347 の MODIFIED を同じ change に追加する。raw report と既存レビュー表の根拠は保持する。登録外のcompanionは自身のfileのまま扱い、不正・欠落した一覧や不正な登録済みcompanionは成果物を作る前に監査エラーにする。
- PR253のdefault initializer経由の重大不整合は、独立調査のQ-79〜Q-83に従う閉じたVitest namespace/読込先検査で修理する。REQ-347の元全文・11Scenario・Sourceを保ち、短いSHALLと第12Scenarioを先行追記してから、新2.10を同じPR253で実装する。既存228件の期待・4件の受理・旧文言・raw/レビュー表を固定し、未実装の修理を完了へ数えない。
- PR253のquery/fragment経由の別試験読込はQ-95〜Q-97で第12Scenarioの相対module原子句を閉じたpath/明示8拡張子へ明確化し、import.metaとdirect requireを拒否する。元短SHALL・Source・元11Scenarioと12番目の他条件を保持し、spec-only成功後だけ修理する。
- C1のfactory宣言とliteral配列の型だけを示すwrapperを独立inventoryで分類し、PR231の移動先run-timeout・external-budget-deadlineを必須測定包含へ加える独立タスク2.6を追加する。実registryと元本文は変えず、旧15fileに2fileを加えた17fileに加え、採集された全file・全case・raw・失敗sampleを保持する。
- 行閾値が混在するliteral表は、元のit.each呼出しを保つ局所bindingと表全体のforEachで行だけを選ぶ設計を2.7へ加える。旧V2は停止記録を保ち、一次ソースから訂正したV2bの新16行の手書きnative基準を先に確かめる。技術観測の受入と本番・3OSの受入を分け、未対応の表や実行時の名前は未登録・未達のまま残す。
- 行登録基盤の追加設計Q-91〜Q-94では、正規helper相対pathの完全一致・SourceFileまでのdescribe祖先閉包・非空行とhelper実体の独立検査を2.7の部分修理として先行する。has/hasAnyの独立wiring検査は方向だけ採用し、完全な束縛/header・C1のstatic/native対応・一般oracleの追加設計がそろうまで2.7全体と実登録は未達に保つ。
- schema2fileの個別登録設計を採用し、旧17＋schema2の19file必須包含と各欠落negative、接頭辞前の独立inventoryを未完了2.8へ加える。全採集を19fileへ限定せず、2.6の実装完了も保持する。A2の3fileとguards追加2宣言の設計を採用し、全fileの成功に基づく隔離解除、未判定ならfile未登録、唯一Sourceの根拠をPRから失わない条件を追加する。
- orphansのimported helper分類を新2.9で先行し、実証後の33宣言/34行とv2-readersの16宣言/18行を保つ個別登録設計を採用する。実割当は全sample受入後に限り、v2-readers登録と同commitで必須包含を2.8の19fileから20fileへ増やす。分割後に起動費用が他caseへ移って10秒を超えれば未達として再設計し、hookやgroup全体への移動で隠さない。
- publicationは共有初回runの10行を各OSで同part、非literal lookup8行はwhole IDとし、閾値mixedならfile全体を未登録未達に保つ（Q-84〜Q-90）。18ID/25raw行と26診断contextを独立照合し、producer/既存試験不変、合成F-P・production変種・Windows全行3sampleと全raw/selectorの受入を既存タスクに残す。
- publication診断の後継は、既存quality-quarantineへ隔離一覧と独立の固定選択・Windows3sampleを追加する。main push/scheduleでの実運用の確認は、最後のPR184のマージ後・sync/archive前の必須受入に残す。
- named slow projectとroot globalSetupの共有build/pack、実際の13条件を検査するREQ-161のfast試験、元全caseと診断profilerの保持を、採用済みの設計に沿って実装する。

# Non-goals

テストの弱化、skip、期待値・時間上下限・予算・coverage閾値の緩和、製品の完成範囲縮小は行わない。REQ-297は退役させず、元4caseと全assertを保つ。旧108keyや過去の3OS観測は最新headの性能合格には使わない。

今回の計画改訂だけでは実装・実測・受入を完了へ進めない。当初未設計10fileのうちG-BとC1以外の残設計と、採用済み4fileを含む14fileの監査・登録対応の再照合、元caseと新fastの最新測定、凍結PR179診断を吸収したPR190の後継診断経路の実装・統合照合とマージ後の実3sample受入、先行実装の統合後検証、rulesetの人の操作は未完了である。V1はLinuxの合成fixtureにおけるmock維持の前提観測に限り、実case・3OS・coverage・OS割当の合格ではない。PR236のfixture・quality receiptはmain取込済みだが、最新全件測定と性能受入は未完了である。新REQの採番、C001/S1/E3の契約の先取り、REQ-273の履歴衝突の解決、releaseの実行は含めない。

# Capabilities

新しい capability は追加しない。既存の `monorepo` で REQ-144 の変更と REQ-049/REQ-214 の移管を扱い、既存の `scenario-evidence-audit` で REQ-347 に登録済み companion の対応条件を追加する。新しい差分ファイルは既存 capability の変更であり、Purpose は追加しない。

# Impact

対象はmonorepoとscenario-evidence-auditの差分仕様、docs/dev/ci.md、後続実装のci.yml・Vitest config/setup・分割対象のテストと対応するworkflow照合試験・profiler・測定経路である。REQ-161の選択条件に必要な開発用mutation runnerの変更も同じchangeの段階的PRで扱う。監査の実行結果と元 source の対応、独立した登録宣言の検査とfixtureも対象に含める。具体範囲と残設計はdesign/tasksを正本とする。

配布第3枠として管理役が割り当てた専用treeを使い、C001/S1と品質E3の既存所有を保つ。ruleset変更はnode20 contextだけの具体案を用意し、管理役がIssue121で人に依頼する。補助は規則を変更しない。
