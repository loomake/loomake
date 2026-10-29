# Design

## Context

本体のbudgetNowは単調時計からholderWaitTimeを除く。一方、対象試験のrunElapsedはDate.nowの差であり、保持役の待ちを含む。同じファイルの別試験には待ちを差し引く前例がある。今回、どちらの影響で失敗したかを記録から確かめる。

## Goals / Non-Goals

実時間と待ち時間を同じ初回runの前後で採取する。既存のassertion・上限・下限・skip・再試行を変えず、元の失敗は残す。時計の診断が予算内でも試験そのものを成功へ読み替えない。

## Decisions

### 明示的な追加計測

既存のLOOMAKE_TEST_PHASE_PROFILE_DIRに加え、LOOMAKE_TEST_BUDGET_CLOCK=1のときだけ追加計測を有効にする。旧形式のイベントと既存fixtureの判定を維持するため、追加時計の有無はこの指定で区別する。

profileEventにbudget-clockイベントを追加し、初回runについて単調時計のwallElapsedMs、holderWaitTimeの差分holderWaitMs、既存のbudgetMsとgraceMsを固定の数値項目として保存する。budgetElapsedMsはwallElapsedMs-holderWaitMsとして集計側で計算する。stdout・コマンド引数・環境全体は保存しない。既存の1MiB上限とI/O失敗の扱いを維持する。

### 区間と時計を分ける

aggregateBudgetClocksを名前付きexportにし、push・createについて各1件の時計を検証する。結果はbudgetClocksのcompleteとcasesへ格納する。欠損、重複、負値、非有限数、待ちが実時間を超える値、正でない予算は不足または不整合とし、0秒として補完しない。通常の区間phasesへ時計を加算せず、総時間を重複計上しない。

collectProfileは追加計測を指定した場合だけbudgetClocksをprofile.jsonに付ける。時計が不足すればprofile.complete=falseとCLIの非ゼロ終了を維持する。元の区間が不足していても時計自体は独立して確認できる。指定のない既存の入力では従来の出力・判定を維持する。summary.mdには実時間、保持役の準備待ち、予算上の経過時間、予算、猶予、診断の成否を日本語で表示する。32KiB上限とエスケープを維持する。

### 試験とWindows実行

push・createの初回runの直前と終了直後に、performance.nowとholderWaitTimeを採取する。既存のDate.nowによるrunElapsedとassertionは変えない。途中失敗でも、採取できた時計をassertionの前に記録する。

既存のprofile-slow-tests.ymlのtestとcollectのstep envに追加計測の指定を加える。対象4ケース、固定3サンプル、Node24、読取権限、失敗後の保存、profile.jsonとsummary.mdだけの7日保存を維持する。既存ci.ymlは変更しない。

## Risks / Trade-offs

保持役の待ちを引いた値と実時間は異なる。除外後の値だけで停止処理全体の速さを断定しない。差分が今回の失敗を説明するかはWindowsの実測で判断し、測定結果を見てから必要な修正範囲を決める。
