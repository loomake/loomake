# Design: classify-hook-budget-calls

## Context

動機と変更範囲は `proposal.md` を参照する。製品のREQ-180・182・257、元hook・設定・予算・workflowを保持する。新capabilityは外部操作ごとの試験用観測・停止分類・公開の制限を所有し、Windowsの4ケースの実時間を扱う既存REQ-295・296とは分ける。

observerのTS、集計のmjs、公開schema版2と公開物の安全性にまたがり、取得時点などの技術判断を記録する必要があるためdesign.mdを置く。設計の出典は専用treeの21fcbdf8・67aa86b7・42a5d810の各結果で、管理役は全文を照合して採用した。確認事項の決定と出典はtraceに記録する。

## Goals / Non-Goals

**Goals:**

- 自己変化するtimeout設定を誤ったfalseにせず、getterとProxyを追加評価しない観測へ直す。
- 採用済みの時計窓表と、共有窓内・前・後・mode不明の違いを正確な規範とID付き追加試験へ結び付ける。
- code-before-changeとnone指定の経緯を保存し、独立changeの通常L3・正常doneへ戻す。

**Non-Goals:**

- 製品srcと既存製品要件、元の試験名・本文・期待値、timeout・skip・設定の変更。
- 内部timeoutの厳密値、元のWindows障害の再現・原因の特定・修理済みの宣言、Issue #116のclose。
- 旧Windows版1の標本やLinuxの単独成功を、新しいheadのWindows証拠として使うこと。

## Decisions

### D1：保持役待ちを差し引いた時計窓

共有期限の区間Sは入口のt0/t1・共有残予算R・保持役の累積待ちhw0/hw1から求める。startedAtからtimeLeftまでの遅れは実測していないため、上限δmax=ts−t1−(hw1−hw0)だけを使い、順序の検査を通ったときに前端をmax(0,δmax)+1ms、後端を1ms広げる。保持役待ちを差し引かない案は、Windowsの最初の待ちを重ねて窓へ入れるため採らない。

有効なmode・時計・spawnと報告がそろい、deadlineが窓内なら、明示timeoutがnullでも共有期限とする。同時上限の可能性はnormalか明示timeoutがfalseでないときに残す。窓より前のnormalかつ明示falseだけを1操作上限とし、未来側や欠損は理由付き未確定にする。mode不明は窓と比べる前に未確定へ戻す。67aaのnullを一律未確定とした草案は採用せず、42a5のREQ-351・352に訂正した。

### D2：A′による事前snapshotとQ6(a)

診断envの確認の直後、t0を読む前に、元のargs[2]からsnapshotを一度だけ求める。後段のdescriptor観測は元関数が設定を変えたあとを読むため採らない。単に呼ぶ前へ移す案も、qualityCommandなどのgetterがtimeout選択前に値を変え得るため採らない。事後比較は元に戻る変更を見逃し、不明を増やすだけなので採らない。

まずProxyをtrapなしで判定し、Proxyなら打ち切る。通常のobjectでは自身のdata descriptorだけを読み、accessor・不明な継承は評価しない。キーがなくprototypeがnull、またはObject.prototypeにそのキーがない通常の設定は「指定なし」とする。qualityCommand・untilDeadline・timeoutMsの3項目が判定できるときだけtimeoutのnullish有無を三値で記録し、どれかが不明ならnullにする。qualityCommandがtrueで製品がuntilDeadlineを短絡する場合も、3項目すべての判定を条件にして安全側を保つ。

modeは前2項目で同じ判定をし、cwdは安全に得られた自身の文字列だけを使う。不明な作業ディレクトリからrepo欄を作らない。snapshotの失敗はunknownとして元関数を呼び、finallyではsnapshotだけを使ってoptionsを読まない。元関数は同じ引数で同期に1回だけ呼び、返値・throwをそのまま通す。診断envなしではsnapshotも記録もしない。

Q6(a)の位置は、検査時間がt1→tsへ入ってδmaxを広げることを防ぐ。時計読取の例外で記録を省く既存経路は保持する。A′は製品側がqualityCommand→untilDeadline→timeoutMsの順に読むことを前提とするため、対応コメントと文書を残す。

### D3：版2と公開の制限

分類の意味を変えた旧実装はsummary.versionを2にしており、版1の標本と区別する。旧rawの欠けたtimeoutと不正modeはnullに投影し、falseやnormalへ補完しない。投影後はREQ-351の規則で分類する。

call IDは固定連番へ再投影し、公開するのは許可キー・列挙値・有限数・nullに限る。内部timeoutはnull、公開はcalls.jsonl・summary.json・summary.md・heartbeat.jsonの4ファイル、7日保存を保持する。raw各64KiB・最大128ファイル・合計512行と、公開JSON各1MiB・Markdown256KiB・heartbeat2KiBを分けて扱い、空でないexport先には書かない。自由なoptions・args・環境・出力・例外messageの公開を増やす案は採らない。

## Risks / Trade-offs

- [δmaxは上限で実測値ではない] → 窓を広げる向きだけに使い、原因や厳密な内部timeoutを断定しない。
- [spawn観測の行が欠けると起動前と誤分類し得る] → 文書へ残る限界を書き、診断の観測と製品の結果を区別する。
- [A′で不明が増える] → nullとして保持し、精度を上げるためにgetterを実行しない。
- [診断I/Oと環境差] → 単独試験の成功を元の失敗の再現や原因修理へ読み替えない。

## Migration Plan

aeeeの基点と59eeの分類実装は、独立changeを作る前に入った。PR #276をL2/changeなしとした旧判断は、後発Q-S1を読み誤った手順の欠落であり、履歴を消さず現在の記録で訂正する。24100ff7の空changesetはREQ-056だけを直したもので、正常doneやPR全体の受入ではない。main3aを通常mergeして現在の規約を適用し、保護8pathと対象技術sourceを変更しないままこの計画を作成した。

次は仕様ゲートの成功後、自己変化getter・選択後のdata変更・先行getter・全trapのREDを観測してA′/Q6(a)へ修理する。REQ-350〜352の全19 Scenarioを新しいitで確認し、文書と作業記録を直して正常doneを通す。旧it・describeは書き換えず、新しい試験に予約済みIDを付ける。localの完了とCIの最終合格を分け、3 OS・必須5チェック・独立Opus最終を通常L3で満たす。#260の統合先への段階受入例外は適用しない。

## Open Questions

現在の採用範囲に未回答の判断はない。実装で新しい曖昧さが見つかればtraceへ追加して仕様ゲートで止める。Scenario監査のarchive後の登録はtasksのWorkflow follow-upに記す。
