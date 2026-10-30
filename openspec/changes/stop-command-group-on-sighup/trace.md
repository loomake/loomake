# Trace: stop-command-group-on-sighup

<!--
このファイルは loomake verify が読む。表の列の順番と見出し名は変えないこと。
状態の値：反映済 / 確認待ち / 範囲外 / 既存仕様で充足
-->

## 入力文書

| 文書 | 版 | 日付 |
|---|---|---|
| 設計の依頼（SIGHUP で監視役だけが死に、対象が孤児になる）と `.loomake/repro/sighup-driver4.sh`。Opus の設計の成果物 `.loomake/claude/180efb22-b5d7-4cbe-80e1-ffb9ce6fad69/result.md`（design.md の「設計工程の記録」を参照） | d5aa30d | 2026-10-30 |
| openspec/specs/external-process-budget/spec.md・run/spec.md・run-decision-policy/spec.md | d5aa30d | 2026-10-30 |

## 要件台帳

| ID | 出典 | 種別 | 要約（原文に忠実に） | 状態 | 反映先 |
|---|---|---|---|---|---|
| REQ-333 | 設計の依頼「supervisor.cjs で SIGHUP も stop('interrupted') にする」、run/spec.md の REQ-208「SIGHUP も SIGINT と同じく」 | 非機能 | POSIX の監視役は SIGHUP も SIGINT・SIGTERM と同じく中断として扱い、親が先に終わっていても対象のグループを止める | 反映済 | specs/external-process-budget/spec.md |
| REQ-334 | 設計の依頼「process.on('exit') で未停止のグループに SIGKILL を送る案の是非」 | 非機能 | POSIX の監視役が、対象の終了を処理する前に停止の手順を終えずに終わるときは、終わる直前に対象のグループへ SIGKILL を送る | 反映済 | specs/external-process-budget/spec.md |

## 確認事項

<!-- 回答 欄が空で ブロッキング = yes の行があると、verify の仕様ゲートは失敗する。回答を書いたら、回答者（名前の代わりに役割でもよい）と回答日（YYYY-MM-DD）も書く -->

| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 | 回答者 | 回答日 |
|---|---|---|---|---|---|---|---|---|
| Q-01 | REQ-333 | 依頼の再現は、HEAD にない UsageError の文を観測しており、worktree の外の dist（古い可能性）を読んでいた。HEAD では、監視役だけに SIGHUP を送ると親が対象を止める見込みが高い。再現をどう扱うか | A: HEAD のビルドで取り直して PR に書き、Red はタスク 1.1 の試験で示す / B: 依頼の観測をそのまま根拠にする | A。古いビルドの結果を HEAD の不具合の証拠にしない。本体の孤児（親も死ぬ経路）は試験で再現できる | no | A。HEAD のビルドで再現を取り直して PR に書き、Red はタスク 1.1 の試験で示す（B は採らない） | 利用者（2026-10-30 の「おすすめで進めて」の指示に基づき、おすすめ案を採用） | 2026-10-30 |
| Q-02 | REQ-250, REQ-205 | 監視役が SIGKILL・OOM などで結果を書かずに終わると、run は検査の detail が INTERRUPTED と一致しないので中断と見なさず、後続の git の中断の例外で stopped になる（phases.ts:117、run.ts:75）。どうするか | A: この change では変えず、Issue に回す / B: 理由つきの中断も interrupted にする / C: stopped のまま、理由を監視役の終了にする | A。REQ-250 は利用者の中断と区別すると定めており、run の状態を変えるのは仕様の判断。SIGHUP は REQ-333 でこの経路を通らなくなる | no | A。この change では run の状態を変えず、Issue に回す（B・C は採らない） | 利用者（2026-10-30 の「おすすめで進めて」の指示に基づき、おすすめ案を採用） | 2026-10-30 |
| Q-03 | REQ-333, REQ-334 | Windows でも SIGHUP のハンドラ（コンソールを閉じたとき）と exit 時の停止を登録するか | A: POSIX だけ / B: 全 OS で登録し、検証は後にする | A。CI で確かめられないハンドラを足さない（stop-children-when-supervisor-dies の Q-01 と同じ）。Windows では、親が生きていれば保持役が止める | no | A。POSIX だけに登録する（B は採らない） | 利用者（2026-10-30 の「おすすめで進めて」の指示に基づき、おすすめ案を採用） | 2026-10-30 |

## 仮定

<!-- 承認 欄が空の仮定は verify で警告になる（失敗にはしない）。承認したら、承認者（名前の代わりに役割でもよい）と承認日（YYYY-MM-DD）も書く -->

| ID | 関連 | 仮定の内容 | 理由 | 承認 | 承認者 | 承認日 |
|---|---|---|---|---|---|---|
| A-01 | REQ-333, REQ-334 | 要件 ID は REQ-333 から採り、REQ-326〜332 は使わない | main の最大は REQ-325 で、進行中の PR #139 が 326〜329 を使う可能性があるため、範囲を空けた（依頼の指定） | | | |
| A-02 | REQ-181, REQ-333 | REQ-181 の本文は MODIFIED にせず、SIGHUP は ADDED の Requirement に書く | REQ-181 の文を変えずに済み、REQ-181 の Scenario の既存のレビューを変えない。SIGHUP は REQ-181 と同じ方法で止めると参照する | | | |
| A-03 | REQ-334 | Node.js は、未処理の例外で終わるときにも exit イベントを出す | 出さなければ REQ-334 の方法が成り立たない。タスク 1.2 の Red/Green で確かめ、成り立たなければ止めて設計を見直す | | | |
| A-04 | REQ-333 | run の summary.json の status の判定は変えない。端末を閉じたときは、CLI の abort（REQ-208）で interrupted になる | HEAD でも phases.ts:113 が abort を先に見る。REQ-333 で検査の detail も INTERRUPTED にそろう | | | |
| A-05 | REQ-333, REQ-334 | この change の要件 ID は REQ-333〜335 の範囲に収める。REQ-335 は使わず予備にする | main の最大は REQ-325。REQ-326〜329 は PR #139 のために空け、REQ-330〜332 は並行する change stop-on-empty-engine-diff が使う。この change に割り当てられた範囲が REQ-333〜335 | | | |
