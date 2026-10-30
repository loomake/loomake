# Trace: bound-engine-timer-and-interrupt

<!--
このファイルは loomake verify が読む。表の列の順番と見出し名は変えないこと。
状態の値：反映済 / 確認待ち / 範囲外 / 既存仕様で充足
-->

## 入力文書

| 文書 | 版 | 日付 |
|---|---|---|
| 設計の依頼（エンジン側のタイマーの丸めと、git・gh 中の中断の記録ずれ。要件 ID は REQ-336〜338）と、その Opus 設計 `.loomake/claude/380d4efd-8a0c-4224-b255-3283edbb838a/result-extracted.md` | - | 2026-10-30 |
| `.loomake/repro/timer-overflow.mjs`（timeoutMs 2147483648 で約 250ms で時間切れになる再現） | - | 2026-10-30 |
| openspec/specs/run/spec.md の REQ-105・REQ-124・REQ-137・REQ-141・REQ-208、external-process-budget の REQ-180・REQ-250 | d5aa30d | 2026-10-30 |

## 要件台帳

| ID | 出典 | 種別 | 要約（原文に忠実に） | 状態 | 反映先 |
|---|---|---|---|---|---|
| REQ-336 | 設計の依頼の観測 1 | 非機能 | エンジンの時間の上限が Node のタイマーの上限を超えても丸めない。監視役と同じく上限以下に分けて待ち、計り直す。timeoutMinutes の受け付ける値は変えない | 反映済 | specs/run/spec.md |
| REQ-337 | 設計の依頼の観測 2 | 機能 | git・gh の実行中に監視役が SIGINT・SIGTERM で止めた中断を、summary.json の interrupted に写す。push・PR の段階も含む。理由つきの中断は stopped のまま | 反映済 | specs/run/spec.md |
| REQ-338 | 設計の依頼 | 範囲外 | 使わない（2 つの要件で足りるため） | 範囲外 | - |

## 確認事項

<!-- 回答 欄が空で ブロッキング = yes の行があると、verify の仕様ゲートは失敗する。回答を書いたら、回答者（名前の代わりに役割でもよい）と回答日（YYYY-MM-DD）も書く -->

| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 | 回答者 | 回答日 |
|---|---|---|---|---|---|---|---|---|
| Q-01 | REQ-336 | タイマーの丸めをどこで防ぐか | A: エンジンで監視役と同じく分けて待つ / B: timeoutMinutes に上限を置き UsageError / C: 両方 | A。原因を直せ、受け付ける値（REQ-141）を変えずに済む。B は今まで通った設定を拒む | no | A（おすすめ案）。エンジンで監視役と同じく分けて待つ | 利用者（2026-10-30 の「おすすめで進めて」の指示に基づき、おすすめ案を採用） | 2026-10-30 |
| Q-02 | REQ-337 | 理由つきの中断（監視役が結果を書かずに終わる）も interrupted にするか | A: 理由がないものだけ interrupted / B: すべて interrupted | A。REQ-250 は利用者の中断と理由の有無で区別すると定めている | no | A（おすすめ案）。理由がないものだけ interrupted にする | 利用者（2026-10-30 の「おすすめで進めて」の指示に基づき、おすすめ案を採用） | 2026-10-30 |
| Q-03 | REQ-336, REQ-337 | 2 つの観測を 1 つの change にするか | A: 1 つ（tasks の 2・3 で区切る）/ B: 2 つに分ける | A。同じ capability（run）と runner で閉じ、1 PR・10 commit 以内に収まる | no | A（おすすめ案）。1 つの change にする | 利用者（2026-10-30 の「おすすめで進めて」の指示に基づき、おすすめ案を採用） | 2026-10-30 |
| Q-04 | REQ-337 | 依頼の範囲（engine.ts・config.ts・run.ts）の外の run/phases.ts の push・PR の catch も直すか | A: 直す / B: run.ts だけにして push・PR は Issue に回す | A。push 中の中断は phases.ts の catch で stopped になり、run.ts だけでは直らない | no | A（おすすめ案）。phases.ts の push・PR の catch も直す | 利用者（2026-10-30 の「おすすめで進めて」の指示に基づき、おすすめ案を採用） | 2026-10-30 |
| Q-05 | REQ-337 | SIGHUP の change（stop-command-group-on-sighup）との取り決め | A: SIGHUP の change は利用者の信号の中断に reason を付けない / B: SIGHUP の change が reason を付け、こちらで信号名を見る | A。こちらは kind と reason だけを見るので、SIGHUP の change のマージで SIGHUP も interrupted に写る | no | A（おすすめ案）。SIGHUP の change は利用者の信号の中断に reason を付けない | 利用者（2026-10-30 の「おすすめで進めて」の指示に基づき、おすすめ案を採用） | 2026-10-30 |
| Q-06 | REQ-336 | timeoutMinutes×60000 が Infinity になる値（約 1.8e303 分超）の文言を run の設定の誤りに直すか | A: 範囲外にして Issue に回す / B: この change で直す | A。いまも UsageError（終了コード 2）で止まり、丸めの不具合とは別である | no | A（おすすめ案）。範囲外にして Issue に回す（proposal.md の「Issue に回す」） | 利用者（2026-10-30 の「おすすめで進めて」の指示に基づき、おすすめ案を採用） | 2026-10-30 |

## 仮定

<!-- 承認 欄が空の仮定は verify で警告になる（失敗にはしない）。承認したら、承認者（名前の代わりに役割でもよい）と承認日（YYYY-MM-DD）も書く -->

| ID | 関連 | 仮定の内容 | 理由 | 承認 | 承認者 | 承認日 |
|---|---|---|---|---|---|---|
| A-01 | REQ-336, REQ-337 | 要件 ID は依頼で指定された REQ-336〜338 だけを使う | main の最大は REQ-325 で、進行中の PR #139 が REQ-326〜329 を使う可能性があるため、範囲を空けて重なりを避ける | | | |
| A-02 | REQ-337 | interrupted に写すとき、理由の文は今のまま（push・PR では「証拠のコミットを保っていますが…」を含む）とし、状態だけを変える | 止まった操作と証拠を保ったことが理由から分かる。既存の試験と再開の手順の文を変えずに済む | | | |
| A-03 | REQ-337 | REQ-337 の統合試験は POSIX だけで行う | Windows で別のプロセスから送る SIGINT は監視役の強制終了になり、理由つきの中断の経路を通る（REQ-124 の試験と同じ制約） | | | |
| A-04 | REQ-336, REQ-337 | REQ-105・REQ-124・REQ-137 を MODIFIED にせず、ADDED で足す | 既存の文は状態を stopped と定めておらず、矛盾しない。既存の Scenario のレビューを読み直さずに済む | | | |
| A-05 | REQ-336 | 24 日を超える実時間の待機は試験しない。待機の早い発火を差し替えで作って確かめる | kit の count-supervisor-startup-budget の設計と同じ方針である | | | |
| A-06 | REQ-336, REQ-337 | 要件 ID の範囲の確認：main（d5aa30d）の最大は REQ-325。REQ-326〜329 は PR #139 のために空け、REQ-330〜332 と REQ-333〜335 は並行する change `stop-on-empty-engine-diff` と `stop-command-group-on-sighup` が使う。この change は REQ-336〜338 の範囲だけを使う | 並行する change と番号を重ねない | | | |
