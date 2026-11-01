# Spec Delta: ci-external-call-diagnostics

## Purpose

明示的に有効化した外部操作の試験用診断について、元の実行を保つ観測、時計と停止状態に基づく分類、安全に公開する情報の範囲を定め、観測の不足から原因や成功を推測しないための契約とする。

## ADDED Requirements

### Requirement: 外部操作の試験用観測
`LOOMAKE_EXTERNAL_TEST_DIAGNOSTIC_DIR` を指定したときだけ、試験用の観測は外部操作の元関数を同じ引数で同期に一度だけ呼び、返値とthrowをそのまま返す SHALL。指定がなければ設定を検査せず記録もしない SHALL。明示timeoutの有無・mode・作業ディレクトリは元関数を呼ぶ前に、Proxyでない設定の自身のデータ値だけから求め、呼んだ後に設定を読まない SHALL。元関数がtimeoutを選ぶまでに読むqualityCommand・untilDeadline・timeoutMsのどれかがgetter・Proxy・Object.prototypeとnull以外からの継承なら明示timeoutを不明（null）とし、modeは前の2項目で同様に判定し、getterやtrapを追加で評価しない MUST。timeoutの値・生の引数・環境値・出力・例外messageは記録しない MUST。記録の失敗で元の結果を変えない SHALL。

Source: REQ-350

#### Scenario: 選択中に自身を変えるtimeoutのgetter
- **WHEN** timeoutMsのgetterが1を返す評価中に自身をnullのデータへ変える
- **THEN** 元関数は1回呼ばれて返値は同一、getterの評価は1回のままで、明示timeoutをnullとして記録しfalseにしない

#### Scenario: 選択の後で変わる設定
- **WHEN** 自身のデータtimeoutMs:1を元関数が読んだあとでnullへ変える
- **THEN** 明示timeoutをtrueとして記録する

#### Scenario: 先に読む別の項目のgetter
- **WHEN** timeoutMs:nullの設定で、qualityCommandのgetterがtimeoutMsを1へ変える
- **THEN** 明示timeoutとmodeをnullとして記録し、観測によるgetterの評価は0回である

#### Scenario: 固定の設定
- **WHEN** 設定が {timeoutMs:1}・{}・未指定・{timeoutMs:null} である
- **THEN** 明示timeoutをそれぞれtrue・false・false・falseとし、modeをnormalとして記録する

#### Scenario: getter・継承・Proxyの設定と元の例外
- **WHEN** timeoutMsがaccessor・継承・全trapを数えるProxyで、元関数が返すかProcessLimitErrorを投げる
- **THEN** 明示timeoutをnullとし、観測によるgetterの評価とtrapは0回、作業ディレクトリ由来の欄を記録せず、同じ返値か同じ例外を返す

#### Scenario: 観測を指定しない
- **WHEN** 診断の保存先を指定せず、全trapを数えるProxyの設定で呼ぶ
- **THEN** 観測によるtrapは0回で、記録を作らない

### Requirement: 外部操作の停止の分類
集計はcallごとに、起動前の予算切れ（共有残予算が不明なら未確定）、起動前の中断、spawn1回で監視役の結果が欠けた中断を区別する SHALL。それ以外の上限停止は、timeoutで、共有期限の窓・有限のdeadlineとspawn直前時刻・spawn1回・有効な報告と一致する終了kind・有効なmode・順序の整った時計がそろうときだけ窓と比べ、欠ければ理由付きで未確定とする MUST。窓は観測開始時の共有残予算と保持役の累積待ちから求め、前へmax(0, ts−t1−(hw1−hw0))+1ms、後ろへ1ms広げる SHALL。deadlineが窓より後なら未確定、窓内なら明示timeoutの値によらず共有期限（gh pr createは別名）とし、modeがnormalのときか明示timeoutがfalseでないときは同時上限の可能性を示す SHALL。窓より前は、normalで明示timeoutがfalseのときだけ1操作上限とし、明示timeoutがtrueか不明、またはmodeがnormal以外なら理由付きで未確定とする SHALL。

Source: REQ-351

#### Scenario: 先行の結果欠損の後の起動前中断
- **WHEN** spawn1回で結果が欠けたinterruptedのcallの後に、spawnしていないinterruptedのcallがある
- **THEN** 前をmissing-result、後をpre-spawn-interruptedとする

#### Scenario: 未観測の遅れを含む窓の境界
- **WHEN** 窓[5100,5101]・ts=111で、normalかつ明示timeoutがfalseのdeadlineが5089、5088.999、5102、5102.001である
- **THEN** それぞれ同時上限の可能性ありのshared-deadline、operation-limit、shared-deadline、deadline-after-shared-intervalの未確定とする

#### Scenario: 窓内で明示timeoutが不明か指定あり
- **WHEN** 窓内のdeadline 5097.5で、normalかつ明示timeoutがnull、untilDeadlineかつfalse、qualityかつtrueである
- **THEN** すべてshared-deadlineで理由はなく、同時上限の可能性はそれぞれあり・なし・ありとする

#### Scenario: 窓より前で上限の種類が分からない
- **WHEN** deadline 5088.999で、normalかつ明示timeoutがtrue、normalかつnull、untilDeadlineかつfalseである
- **THEN** operation-limitとせず、それぞれrequested-timeout-possible、timeout-option-unavailable、deadline-before-shared-intervalの未確定とする

#### Scenario: modeが不明
- **WHEN** modeがnullで、deadlineが窓より十分前か窓内にある
- **THEN** どちらもmode-unavailableの未確定とする

#### Scenario: 時計の欠損と逆転
- **WHEN** spawn直前の時刻が欠けるか非有限、または共有残予算を読んだ時刻より前である
- **THEN** 未確定とし、spawn-start-unavailableかobservation-order-invalidを示す

#### Scenario: gh pr createの共有期限
- **WHEN** gh-pr-createのcallのdeadlineが窓内にある
- **THEN** create-shared-deadlineとする

### Requirement: 公開する外部操作診断
公開用exportは、版2の要約と、call IDを固定連番に置き換えて許可キー・列挙値・有限数・nullへ再投影したcalls.jsonl・summary.json・summary.md・heartbeat.jsonの4ファイルだけを、空の専用先へ排他的に書く SHALL。内部timeoutの厳密値はnullとし、旧rawで欠けた明示timeoutと不正なmodeはfalseやnormalにせずnullへ投影したうえで、停止の分類の規則で分類する SHALL。閉じたschemaの検査に通らないもの、版1、JSON各1MiB・Markdown256KiB・heartbeat2KiBの上限を超えるものは公開しない MUST。CIは検査済みの4ファイルだけを7日保存し、元の試験の期待値・期限・予算・選択と成否を変えない MUST。

Source: REQ-352

#### Scenario: 旧rawの明示timeoutの欠落
- **WHEN** timeoutRequestedのないrawの行（窓[5100,5101]・ts=103、normal）を、deadline 2101、5100.5、5102.001で公開用に投影する
- **THEN** 明示timeoutはどれもnullで、それぞれtimeout-option-unavailableの未確定、理由なしで同時上限の可能性ありのshared-deadline、deadline-after-shared-intervalの未確定とし、すべて版2の検査に通る

#### Scenario: 旧rawの不正なmode
- **WHEN** timeoutRequestedがなく、modeが許可値以外の行を、窓内のdeadlineで投影する
- **THEN** modeと明示timeoutをnullとし、mode-unavailableの未確定として版2の検査に通る

#### Scenario: 版と型の拒否
- **WHEN** 公開用の要約の版が1か、明示timeoutの欄が欠けているか文字列か、未知のキーがある
- **THEN** 公開schemaの検査で拒否する

#### Scenario: 秘密と未知の値
- **WHEN** rawにPID・自由な文字列・未知キーがある
- **THEN** 公開ファイルに含めず、検査済みの値だけを書く

#### Scenario: 空でない公開先
- **WHEN** export先に既存のファイルがある
- **THEN** 書かずに失敗する

#### Scenario: CIでの保存
- **WHEN** diagnose-hook-budgetのworkflowを読む
- **THEN** 元の1件だけを選び、試験が失敗してもjobは失敗のまま、検査済みの4ファイルだけを7日保存する
