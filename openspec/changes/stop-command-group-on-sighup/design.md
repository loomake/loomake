# Design: stop-command-group-on-sighup

## Context

動機と依頼の要点は proposal.md を参照。対象コミットは `608b9273885f796da0a6c352ef59330c3b2ca171`。親の process.ts は、監視役が結果を書かずに終わると対象のグループを止め、理由つきの ProcessLimitError を返す（REQ-250）。本件は、CLI と監視役が同じ SIGHUP で終わって親の後片付けが働かない経路を扱う。

### 監視役を通る経路

| 経路 | 監視役 | 根拠と修正前の挙動 |
|---|---|---|
| CLI の verify の品質コマンド | 通らない | main.ts は timeoutMs を渡さず、共有予算もないので verify/run.ts の spawnSync を使う。コマンドへも同じグループの SIGHUP が届く |
| CLI の trace record 内の verify の品質コマンド | 通らない | record.ts も timeoutMs を渡さないため同上 |
| CLI の verify の openspec validate | 通る | verify/run.ts の runExternal。CLI と監視役が SIGHUP で終わり、openspec とその子が残る |
| CLI の trace record と doctor の git | 通る | record.ts・doctor.ts の runExternal。同上 |
| run の git・gh・品質コマンド | 通る | run.ts の共有予算。CLI は abort のハンドラで生き残り、親が対象を止める。検査の detail には監視役の異常終了の理由が付く |

runExternal は予算の有無によらず監視役を通る。配布物の E2E ではPATH に偽の openspec を置ける verify --spec-only を代表とする。

## Goals / Non-Goals

SIGHUP の停止手順は SIGINT・SIGTERM と同じにする。親が先に終わっていても監視役自身で止める。exit イベントが起きる異常終了の後片付けも扱うが、送信条件は ADR 0006 に基づく Q-04 の A 回答に従う。

親の process.ts、verify/run.ts、runner、CLI、公開 API、依存は変えない。Windows のハンドラ追加は Q-03 で対象外と決定済み。監視役の SIGKILL・OOM による結果なし終了時の run の status は Q-02 に従い別 Issue へ回す。

## Decisions

### D-1 SIGHUP の扱い（REQ-333）

supervisor.cjs の SIGINT・SIGTERM の隣に、POSIX だけ `process.on('SIGHUP', () => stop('interrupted'))` を足す。既存の SIGTERM → 250ms → SIGKILL → 最大 1 秒待つ手順を使う。親が生きていれば fd3 の `kind:'interrupted'` を読み、理由のない ProcessLimitError を返す。二度目の信号は stopping で無視する。親が先に終わり、後の結果の書き出しに失敗しても、その前にグループを止める。

親で SIGHUP の結果なし終了を理由なしに写す案は採らない。REQ-250 の異常終了と利用者中断の区別を保つためである。CLI の全サブコマンドへハンドラを足す案も、spawnSync 中にはハンドラが動かないため採らない。

### D-2 exit 時の SIGKILL（REQ-334、Q-04 は A）

Q-04 は ADR 0006 の包括承認に基づき、おすすめ A を採用する。グループへの SIGKILL の送信を killed で記録し、`child && child.pid && !killed` を exit ハンドラの条件にする。対象の終了処理済みかどうかと、グループを止めたかどうかを分ける。

| exit 時の状態 | A の動作 | 現行 !exited の動作 |
|---|---|---|
| 正常終了し、対象の exit 処理で SIGKILL を送信済み | 送らない | 送らない |
| 中断の 250ms 後に SIGKILL を送信済み | 送らない | 対象の exit が未処理なら再送する |
| EPIPE で例外終了し、対象の exit は未処理、SIGKILL も未送信 | 送る | 送る |
| stop の SIGTERM 後、対象の先頭だけが終了し、250ms の猶予中に例外終了。孫は SIGTERM を無視 | 送る | 送らず、孫が残る |
| 起動失敗などで対象の PID がない | 送らない | 送らない |

A の採用により、REQ-334 の条件を「グループへの SIGKILL をまだ送っていない」に置き換える。現行の「対象の終了を処理したあとは送らない SHALL」は、その条件とは両立しないため置き換えの対象とする。SIGKILL 送信済みなら再送しない設計と試験を残す。猶予中の先頭終了後の例外を明示する Scenario と回帰試験も加え、否定の保証を説明だけ消して済ませない。

猶予中の試験では、実際の対象の exit と全ハンドラの処理を観測してから例外を起こす。grace のコールバックの配送だけを試験内で対象の exit まで保留し、対象が 250ms 以内に終了するという試験の前提をなくす。製品の 250ms と、外側の 2 秒以内の停止判定は変えない。ready ファイルができる前の失敗でも、監視役を終了させて fd3 を読み終えたあと、報告済み PID のグループを後片付けする。

### D-3 Windows

Q-03 の承認どおり、SIGHUP と exit 時の停止は POSIX だけに登録する。Windows は既存の保持役による後片付けを保つ。

### D-4 復旧の文書

run-recovery の「端末を閉じたときとコンテナを止めたとき」で、Ctrl+C や端末を閉じてプロセスグループ全体に信号が届く場合は、子のプロセスまで止めてから中断として扱うと書く。`kill <PID>` のように CLI だけに届く場合は、コマンドが終わったところで扱う。証拠の記録・push・PR の作成に進まない扱いは変えない。

## 受入条件と確認方法

既存の試験本文・期待値は変えず、新しい試験を足す。

| # | 受入条件 | 試験と Red の条件 |
|---|---|---|
| AC-1 | REQ-333：SIGHUP は理由のない interrupted を返し、SIGTERM を無視する子孫も止め、同じ予算で次を起動しない | process.test.ts の既存 SIGINT 試験を写して別の SIGHUP 試験を足す。既存 SIGINT 試験は変えない。修正前は reason が付いて失敗する |
| AC-2 | REQ-333：親の後片付けなしでも監視役が止め、fd3 に interrupted を書く | 新しい supervisor.test.ts から直接 spawn し、fd3 の pid と孫の準備完了を待って SIGHUP を送る。孫が 2 秒以内に止まることを確かめる。修正前は孫が残る |
| AC-2E | REQ-333：配布物の CLI も SIGHUP で終わる状況で、openspec と孫が残らない | package-artifacts.test.ts と新しい verify-sighup-smoke.mjs。偽 openspec が SIGTERM を無視する孫を作り、ready に PID を書く。detached で起動した CLI のグループへ SIGHUP を送り、CLI の signal が SIGHUP、3 秒以内に子孫が停止と確認する。修正前は残る |
| AC-3 | REQ-333：監視役を通る品質コマンドの中断は detail が INTERRUPTED で、後続を実行しない | verify.test.ts で runVerify に timeoutMs:60000 を渡す。project.ts に interruptScript(signal) を足し、既存の INTERRUPT_SCRIPT = interruptScript('SIGINT') の文字列を保つ。修正前は理由つき detail になる |
| AC-4 | REQ-334：EPIPE で監視役が例外終了しても子孫を残さない | supervisor.test.ts で stdout の読み手を閉じ、引き金のファイルで対象に出力させる。監視役が非ゼロ終了し stderr に EPIPE があることと、2 秒以内の孫の停止を確認する。1.1 の修正後も孫が残って Red になる |
| AC-4G | Q-04 の A に従い：先頭の exit 処理済みでも SIGKILL 未送信なら孫を止める | SIGTERM の猶予中に先頭が終わり、孫が生きている状態で監視役が例外終了する回帰試験を足す。!exited では Red、!killed では Green とする。実機で順序を確かめられなければ完了と扱わず、検証方法を見直す |
| AC-5 | 既存の試験が同じ期待値で通る | process・orphans・process-startup・verify・signal-during-sync・runner の run・配布物の REQ-124/208 を確認する |
| AC-6 | Q-01：対象 HEAD のビルドで元の再現を取り直す | この worktree の dist を読む再現スクリプトを使い、修正前後を PR に記録する |

直接起動の試験は POSIX だけにする。孫は stdio を ignore とし、準備完了を待ってから信号や出力を送る。停止判定は既存の macOS のゾンビ判定にならう。E2E は既存の run-sigint-smoke.mjs にならって consumer を複製し、openspecValidate:true にする。finally で試験自身の子孫を後片付けする。

A に従い、SIGKILL 送信済みの正常終了・既存の SIGINT 終了で exit ハンドラが再送しないことも確かめる。SIGKILL 送信直後で対象の exit が未処理の例外を nextTick で起こす試験も加え、!exited の対照では再送を検出する。A-03 は Node 22.12 以上と開発用 Node 24 の既存 CI で検証する。実装 PR へ ci:all-os を付け、macOS の非同期 EPIPE 経路を確認する。

## 変更対象

| ファイル | 変更 |
|---|---|
| packages/kit/supervisor/supervisor.cjs | POSIX の SIGHUP ハンドラ。exit ハンドラは SIGKILL 未送信のときだけ送る |
| packages/kit/test/process.test.ts | AC-1 を追加 |
| packages/kit/test/supervisor.test.ts | AC-2・AC-4、A 選択時は AC-4G と再送しない条件を追加 |
| packages/kit/test/verify.test.ts・project.ts | AC-3 と信号別の補助関数を追加 |
| scripts/verify-sighup-smoke.mjs・tests/package-artifacts.test.ts | AC-2E を追加 |
| docs/guide/2.guides/3.run-recovery.md | D-4 を反映 |
| .changeset/stop-command-group-on-sighup.md | @loomake/kit の patch |
| docs/quality/scenarios.json | 新しい Scenario のレビューを追加。既存の根拠にした試験を変えた場合はレビューを確かめ直してから更新 |
| docs/worklog/2026-10-30/change-supervisor-sighup-and-exit-kill.md | このブランチの作業記録 |

PR #159 が変更する process.ts・verify/run.ts の中断理由と重ねない。run-recovery は両 PR が触るため、後からマージする側が先の文と整合させる。

## Risks / Trade-offs

exit イベントが起きない SIGKILL などは監視役自身では後片付けできず、親の REQ-250 に任せる。親も同時にいなければ停止は保証しない。

A では、先頭の exit 処理後もグループが残っていれば -pid へ送る。既存の stop の 250ms 後の送信と同じ対象の扱いで、正常終了は既存の exit 処理による SIGKILL 送信済みなので再送しない。PID 再利用の安全性を新たに保証するものとは扱わない。

Q-04 は包括承認のおすすめ A として trace.md に回答を記録した。仕様ゲートを通してから製品実装へ進む。

## 設計工程の記録

| 項目 | 内容 |
|---|---|
| 状態 | 実施済み。新規設計の作成であり、追加の設計評価ではない |
| 実行ツール | Claude Code 2.1.308、修正後の ask-opus.mjs、role design |
| 実際のモデル | claude-opus-5-5（responseModels・models とも同一、helperModels は空） |
| セッション | 6fe32a2b-e81f-4cd7-aa2e-9038d1eb7418 |
| 対象コミット | 608b9273885f796da0a6c352ef59330c3b2ca171 |
| 実行結果 | ok:true、権限拒否 0。成果物の要点は本 design に収録 |
| ローカル証跡 | .loomake/handoff/redesign.md・redesign-summary.json、同セッションの .loomake/claude/ 内の記録。要件の唯一の出典にはしない |
| 旧設計 | 180efb22-b5d7-4cbe-80e1-ffb9ce6fad69 は権限拒否 1 のため未実施。補助モデル判定の修正だけでは再利用しない |
| AI 評価 | 旧レビューを1回、最終レビュー880c757fを1回とする計2回の履歴を保持する。利用者の最新指示により最終レビューの回数上限を撤廃し、新しいheadを別の新しいOpusセッションで評価して指摘ゼロになるまで修正を続ける。同一指摘が3回連続した場合はIssueへ記録し、往復を続ける |
| 転記・計画補正 | Codex。ADR 0006 に基づく Q-04=A と管理役の仮定承認を記録。製品コードは未変更 |
