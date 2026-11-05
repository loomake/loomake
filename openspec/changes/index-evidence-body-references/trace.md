# Trace: index-evidence-body-references

## 入力文書

| 文書 | 版 | 日付 |
|---|---|---|
| docs/requirements/loomake-v0.11.md 3章・NFR09・7.9 | main aae24bda・v0.11.3 | 2026-11-05 |
| https://github.com/loomake/loomake/issues/69 | 更新2026-11-05T09:49:07Z・本文と全1コメント取得 | 2026-11-05 |
| 同Issue comment6654873804 | 本文全件・投稿日時は接続出力で未提供 | 2026-11-05 |
| 実Opus初期84f0136e・補足271b9d31 | full result・実claude-opus-5-5・exit0・ok:true | 2026-11-05 |
| P1 record-evidence-summaryの計画とparent-handoff | Git commit5b809c3fac91c7b6480a2e76a984a370b7e5a2cf | 2026-11-05 |
| #65 extract-shared-secret-redactionのREQ447計画 | Git commitc3f9c6379c9aed4404e2312b62b7606a1bde3b0f | 2026-11-05 |
| 管理役のQRef22〜26・29採用 | 本会話・ADR0006によるおすすめ採用 | 2026-11-05 |

## 要件台帳

| ID | 出典 | 種別 | 要約（原文に忠実に） | 状態 | 反映先 |
|---|---|---|---|---|---|
| REQ-470 | 要件7.9 L559〜580・補足271b S69-01/07・管理QRef22/24/25 | 機能 | 固定summaryを変えず、本体参照receiptを同期検証・原子的追記し既存形式を保持する | 反映済 | specs/evidence-body-index/spec.md |
| REQ-471 | 要件7.9 L595〜602・補足271b S69-01/02/06・管理QRef23/26 | 機能 | 要約/CI/本体/ZIPを照合し、参照解決・実期限・権限未確認を分けて返す | 反映済 | specs/evidence-body-index/spec.md |
| REQ-472 | 補足271b S69-04/A・管理Q69-18/19 | 範囲外 | 限定手動CIとbundle/fetch・実本体参照の運用受入（同じW1の別通常PR） | 範囲外 | parent-handoff.md |
| REQ-464 | 初期84設計4章PR2・要件7.9 | 範囲外 | release記録の版1と予約（同じW1の別通常PR） | 範囲外 | parent-handoff.md |
| REQ-465 | 初期84設計4章PR2・FR47 | 範囲外 | 失敗試行attemptsの保存と重複排除（同じW1の別通常PR） | 範囲外 | parent-handoff.md |

## 確認事項

| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 | 回答者 | 回答日 |
|---|---|---|---|---|---|---|---|---|
| QRef-22 | REQ-470・REQ-471 | locatorの形式例にないrunId/attemptと照合条件4をどう整合するか | A:両欄を必須追加 / B:locator照合を省く | A。3箇所一致を保持 | yes | A。P1の数字列/正safe文字列に合わせ、完全一致（ADR0006） | 利用者（ADR0006の包括承認、管理役記録） | 2026-11-05 |
| QRef-23 | REQ-471 | 複数本体・0件・policyの入力をどう扱うか | A:本体別配列・明示policy/now / B:1件のみ | A。観測を落とさない | yes | A。全体優先invalid-index>mismatch>not-indexed>resolved、0件not-indexed（ADR0006） | 利用者（ADR0006の包括承認、管理役記録） | 2026-11-05 |
| QRef-24 | REQ-470 | 未知欄保持と秘密形の新規保存をどう両立するか | A:共有maskで変われば拒否 / B:置換保存 | A。参照を壊さず非秘密未知欄を保つ | yes | A。NFR09とOpus65設計が根拠。raw診断なし、独自patternなし。271b自身のprivacy評価とはしない（ADR0006） | 利用者（ADR0006の包括承認、管理役記録） | 2026-11-05 |
| QRef-25 | REQ-470 | stampとentryhashの取得元は何か | A:実retrievedAt/entry UTF8 / B:現在時計 | A。時刻を作らない | yes | A。UTC秒とentryhash8、実同名衝突だけfalse、異名追記（ADR0006） | 利用者（ADR0006の包括承認、管理役記録） | 2026-11-05 |
| QRef-26 | REQ-470・REQ-471 | 不正要約・不正候補・不正引数をどう区別するか | A:各status/UsageError / B:一律例外 | A。失敗を隠さない | yes | A。要約mismatch・候補invalid-index・引数generic UsageError、raw causeなし。既存分類不変（ADR0006） | 利用者（ADR0006の包括承認、管理役記録） | 2026-11-05 |
| QRef-29 | REQ-470・REQ-471 | 相対参照とraw入口の合計予算をどう保つか | A:正規path一致と予算共有 / B:file別予算 | A。参照と既存上限を守る | yes | A。summary/receipt合計128MiB、残量超の読取を起動せず、purebindへpathを入れない。既存JSON_LIMITSが根拠（ADR0006） | 利用者（ADR0006の包括承認、管理役記録） | 2026-11-05 |
| QRef-27 | REQ-470・REQ-471 | P1の要約・raw読取り・照合/期限APIはmainで使えるか | A:受入後に実契約照合 / B:未受入APIで実装 | A。通常の前提受入が必要 | yes | A。PR #452（deaf02d7）受入、PR #457（5a9ec513）同期archive済。summary型・遅延Schema、readInputBytes、checkArtifactBody、artifactRetentionの公開実装を照合（ADR0006） | 管理役root | 2026-11-06 |
| QRef-28 | REQ-470 | #65の共通maskValueはmainで使えるか | A:受入後に共有API / B:独自pattern | A。秘密処理を重複しない | yes | A。PR #450（3f67db52）受入、PR #453（db893f01）同期archive済。kit公開maskValueのown key保持・getter/toJSON非実行・入力拒否を照合（ADR0006） | 管理役root | 2026-11-06 |

| QRef-30 | REQ-470・REQ-471 | gapの欄名と未知field、reasonの日本語、receipt候補名の形式をどう確定するか | A:accessPolicy/workflowHeadSha・未知保持・日本語1字以上・正規名grammar / B:未定のまま停止 | A。P1の拡張と重複全pathを保つ | yes | A。管理役が本会話で採用。既知2field/未知保持、日本語文字1字、実在UTC名とsuffix/hash整合。候補名時刻とretrievedAtは一致不要で、取得事実はreceiptだけから読む（ADR0006） | 管理役root | 2026-11-06 |

| QRef-31 | REQ-471 | 複数locatorの保持判定と結果の対応をどう返すか | A:receipt別の保持配列とlocator別全path / B:単一値へ集約 | A。異なる実期限の事実を落とさない | yes | A。locatorsはstable locatorで集約、paths/retentionは全receipt別に保持。1 traversalと残量付きraw読取り、例外後は消費量不明のため残量0。後続未読はinvalid-index（本会話・ADR0006） | 管理役root | 2026-11-06 |

QRef27/28は2026-11-06（日本時間）に実mainの受入・同期archiveと公開ソースを照合した。#65の固定一覧追加に新しい人の承認が必要との以前の解釈は管理役が訂正・取下げ済みで、本件は共有実装の未受入だけを依存として残す。

## 仮定

| ID | 関連 | 仮定の内容 | 理由 | 承認 | 承認者 | 承認日 |
|---|---|---|---|---|---|---|

権限・外部連携・保持期間・削除・未受入APIを仮定で補わない。採用した選択は上の表へ記録し、根拠は[ADR0006](../../../docs/adr/0006-standing-approval-for-autonomous-delivery.md)と本会話の管理役判断である。

## 品質の定義

| 要件 | 目的 | 利用状況 | 受け入れ条件 | 計測方法 | 副特性 | 出典・確認事項 |
|---|---|---|---|---|---|---|
| REQ-470 | 本体をGitに複製せず参照と実取得事実を残す | 要件定義3章の1人・1repo・GitHub/Actions開発、7.9保管 | 全receipt Scenario、64MiB境界、同名非上書き、秘密形拒否、旧12Schema不変 | REQ名付き境界/公開物/互換試験と通常DoD、PQ900条件保持 | 既存PQ900 functional_correctness、NFR09の秘密情報保護 | 要件定義3/7.9/NFR09、補足271b S69-01/07、QRef22/24/25/27/28 |
| REQ-471 | 別実行・改変・壊れた参照を一致にしない | 要件定義3章と7.9の要約から本体を辿る開発者 | 7照合・全status/複数/重複/期限/権限未確認Scenario、固定要約不変 | 固定bytes/明示nowによる純粋試験と安全I/O試験、通常DoD | 既存PQ900 functional_correctness | 要件定義7.9、補足271b S69-01/02/06、QRef22/23/26/27 |

## 継承記録

計画の原文はGit 3e62a1fcab89515f86c4c5c4e02910f7a1f3a071。実装基点は5a9ec513で、元の全27 Scenario・8タスクを保持する。QRef27/28はmainで実在するAPIを確認し、管理役rootの指示に従って回答を記録した。REQ472は予約のまま未使用、REQ448〜450・466〜469は他streamのため使わない。
