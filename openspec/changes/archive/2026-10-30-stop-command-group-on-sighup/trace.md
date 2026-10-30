# Trace: stop-command-group-on-sighup

<!--
このファイルは loomake verify が読む。表の列の順番と見出し名は変えないこと。
状態の値：反映済 / 確認待ち / 範囲外 / 既存仕様で充足
-->

## 入力文書

| 文書 | 版 | 日付 |
|---|---|---|
| [PR #158](https://github.com/loomake/loomake/pull/158) の設計依頼。要点は [proposal.md](proposal.md#設計の依頼の要点) に収録 | 608b927 | 2026-10-30 |
| openspec/specs/external-process-budget/spec.md・run/spec.md・run-decision-policy/spec.md | d5aa30d | 2026-10-30 |
| [設計レビュー](https://github.com/loomake/loomake/pull/158#issuecomment-6512610756) と再設計の要点 [design.md](design.md)。工程の実際のモデル・セッション・対象は design.md の末尾に記録 | 608b927 | 2026-10-30 |

## 要件台帳

| ID | 出典 | 種別 | 要約（原文に忠実に） | 状態 | 反映先 |
|---|---|---|---|---|---|
| REQ-333 | proposal.md「設計の依頼の要点」（PR #158）、run/spec.md の REQ-208「SIGHUP も SIGINT と同じく」 | 非機能 | POSIX の監視役は SIGHUP も SIGINT・SIGTERM と同じく中断として扱い、親が先に終わっていても対象のグループを止める | 反映済 | specs/external-process-budget/spec.md |
| REQ-334 | proposal.md「設計の依頼の要点」（PR #158） | 非機能 | POSIX の監視役が、対象のグループへ SIGKILL をまだ送っていないまま停止の手順を終えずに終わるときは、終わる直前に対象のグループへ SIGKILL を送る | 反映済 | specs/external-process-budget/spec.md |

## 確認事項

<!-- 回答 欄が空で ブロッキング = yes の行があると、verify の仕様ゲートは失敗する。回答を書いたら、回答者（名前の代わりに役割でもよい）と回答日（YYYY-MM-DD）も書く -->

| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 | 回答者 | 回答日 |
|---|---|---|---|---|---|---|---|---|
| Q-01 | REQ-333 | 依頼の再現は、HEAD にない UsageError の文を観測しており、worktree の外の dist（古い可能性）を読んでいた。HEAD では、監視役だけに SIGHUP を送ると親が対象を止める見込みが高い。再現をどう扱うか | A: HEAD のビルドで取り直して PR に書き、Red はタスク 1.1 の試験で示す / B: 依頼の観測をそのまま根拠にする | A。古いビルドの結果を HEAD の不具合の証拠にしない。本体の孤児（親も死ぬ経路）は試験で再現できる | no | A。HEAD のビルドで再現を取り直して PR に書き、Red はタスク 1.1 の試験で示す（B は採らない） | 利用者（本会話と引き継ぎ README の既承認記録。承認元 URL は未記録） | 2026-10-30 |
| Q-02 | REQ-250, REQ-205 | 監視役が SIGKILL・OOM などで結果を書かずに終わると、run は検査の detail が INTERRUPTED と一致しないので中断と見なさず、後続の git の中断の例外で stopped になる（phases.ts:117、run.ts:75）。どうするか | A: この change では変えず、Issue に回す / B: 理由つきの中断も interrupted にする / C: stopped のまま、理由を監視役の終了にする | A。REQ-250 は利用者の中断と区別すると定めており、run の状態を変えるのは仕様の判断。SIGHUP は REQ-333 でこの経路を通らなくなる | no | A。この change では run の状態を変えず、Issue に回す（B・C は採らない） | 利用者（本会話と引き継ぎ README の既承認記録。承認元 URL は未記録） | 2026-10-30 |
| Q-03 | REQ-333, REQ-334 | Windows でも SIGHUP のハンドラ（コンソールを閉じたとき）と exit 時の停止を登録するか | A: POSIX だけ / B: 全 OS で登録し、検証は後にする | A。CI で確かめられないハンドラを足さない（stop-children-when-supervisor-dies の Q-01 と同じ）。Windows では、親が生きていれば保持役が止める | no | A。POSIX だけに登録する（B は採らない） | 利用者（本会話と引き継ぎ README の既承認記録。承認元 URL は未記録） | 2026-10-30 |
| Q-04 | REQ-334 | 先頭の exit 処理後、SIGKILL 未送信の猶予中に例外終了して孫が残る場合も止めるか。現在の「終了処理後は送らない SHALL」と !killed 案が異なる | A: 未送信なら送る条件へ仕様変更し、猶予中の回帰 Scenario・試験を追加 / B: !exited を保ち否定 SHALL だけ設計へ移す / C: 現仕様を維持 | A。先頭の終了とグループの停止を分け、SIGTERM を無視する孫の残存を防ぐ。送信済みなら再送しない。詳細は design.md D-2 と PR #158 | yes | A。SIGKILL 未送信なら送る条件へ変更し、猶予中の先頭終了後の回帰試験を追加する（B・C は採らない）。承認元は ADR 0006 と本会話の包括承認 | 利用者（2026-10-30 の包括承認に基づきおすすめ案を採用） | 2026-10-30 |

Q-01〜Q-03 は2026-10-30 の「おすすめで進めて」の既承認記録を引き継ぐ。今回も利用者は引き継ぎ README の順で既存計画を実装するよう明示したため、同じ承認は求め直さない。承認元は本会話および管理役の引き継ぎ README であり、PR の明示的な承認コメント URL は未記録。AI レビューは人の承認として扱わない。Q-04 は ADR 0006「自律配布の包括承認」と管理役の指示に基づき、おすすめ A を採用した。承認元は2026-10-30 の本会話であり、PR の人の承認コメントを代行したものではない。

## 仮定

<!-- 承認 欄が空の仮定は verify で警告になる（失敗にはしない）。承認したら、承認者（名前の代わりに役割でもよい）と承認日（YYYY-MM-DD）も書く -->

| ID | 関連 | 仮定の内容 | 理由 | 承認 | 承認者 | 承認日 |
|---|---|---|---|---|---|---|
| A-02 | REQ-181, REQ-333 | REQ-181 の本文は MODIFIED にせず、SIGHUP は ADDED の Requirement に書く | REQ-181 の文を変えずに済み、REQ-181 の Scenario の既存のレビューを変えない。SIGHUP は REQ-181 と同じ方法で止めると参照する | 承認済み。既存仕様と品質基準を保つ計画として管理役が承認（ADR 0006） | 管理役 Codex | 2026-10-30 |
| A-03 | REQ-334 | Node.js は、未処理の例外で終わるときにも exit イベントを出す | 出さなければ REQ-334 の方法が成り立たない。Node 22.12 以上と開発用 Node 24 の CI、タスク 1.2 の Red/Green で確かめ、成り立たなければ止めて設計を見直す | 承認済み。既存仕様と品質基準を保つ計画として管理役が承認（ADR 0006） | 管理役 Codex | 2026-10-30 |
| A-04 | REQ-333 | run の summary.json の status の判定は変えない。端末を閉じたときは、CLI の abort（REQ-208）で interrupted になる | HEAD でも phases.ts:113 が abort を先に見る。REQ-333 で検査の detail も INTERRUPTED にそろう | 承認済み。既存仕様と品質基準を保つ計画として管理役が承認（ADR 0006） | 管理役 Codex | 2026-10-30 |
| A-05 | REQ-333, REQ-334 | この change の要件 ID は REQ-333〜335 の範囲に収める。REQ-335 は使わず予備にする | main の最大は REQ-325。REQ-326〜329 は PR #139 のために空け、REQ-330〜332 は並行する change stop-on-empty-engine-diff が使う。この change に割り当てられた範囲が REQ-333〜335 | 承認済み。既存仕様と品質基準を保つ計画として管理役が承認（ADR 0006） | 管理役 Codex | 2026-10-30 |
