# Design: windows-owned-cleanup-phases

## Context

動機はproposalを参照する。基点は最新mainの5f1b4d73。旧設計基点3a54614eから、対象test・REQ-345のcapability・heartbeat・workflow・Vitest設定の差分がないことを確認し、clean専用branchをFFした。旧ignored原本は保持し、設計資料を再利用する。採用設計は0666055f全体、aa7c533eのF1補完・SELF-PID・POOL条件、8f7296c0の解析表とPowerShell印の継承箇所である。旧detached writer・hook・同期flush案は採用しない。

## Goals / Non-Goals

**Goals:** 診断だけを追加し、停止と品質の元の結果を保持する。時間の原点、数値不整合、保存の成功通知と欠測を区別する。

**Non-Goals:** 原因の修理や#272・#265と同じ原因との断定、PR266と52bの再実行、追加のPowerShell probe、認証・native探索、REQ-345・markPhase・元assert・期限・skip・workflow・設定の変更。

## Decisions

### Q-WRITER=C、Q-POOL=同時1要求

プロセス内でコールバック版のmkdirとappendFileを1本の鎖として実行する。Promise、同期fs、追加プロセス、Worker、hook、終了待機を使わない。作成時はenv/platformの参照とオブジェクト生成だけでI/Oしない。WindowsかつLOOMAKE_CI_HEARTBEAT_DIR指定時だけ、事象発生後に最初のmkdirを1回発行する。

同時に実行する要求は最大1件。コールバックが同じ呼出内で返る差し替えにも、反復によるpumpで再入せず対応する。fsの同期throwとコールバック内の例外は外へ出さない。完了通知が返らなければ後続も終わりも書かず、呼出側は待たない。mkdir失敗時も診断を欠くにとどめる。

全体で48行・8KiBとし、recorderを作るときにそのcase-endの枠を予約する。行と予約を合算して上限を守る。note後の待ち行列と実行中の行もこの予算に含める。end後のnoteは追加しない。

### 固定の行とQ-SELFPID=A

ファイルは同じartifactディレクトリのowned-cleanup-<自己pid>.jsonl。行のpidもprocess.pidだけとし、停止対象のPIDや呼出引数から値を作らない。type/label/event/at/pid/seq/durationMs/kindだけをphaseに含め、終わりの行はrows/saved/failed/droppedも持つ。ラベルはowned-cleanup-ownedとowned-cleanup-mismatch、段階13個とkind7個は採用設計の固定集合とする。durationMsは有限・非負の整数で、ps以外はcase-startからの経過、atは事象の時刻である。SAFEはmarkPhaseと同じ正規表現を複製し、本体は変えない。

REQ本文のaa7版は510 UTF-16文字だったため、設計が明示したfallbackに従って最後の自己PID説明文1文だけを外し472文字とした。停止対象PIDの禁止と9 Scenarioは保持する。自己PIDの許可はこの節とtraceのQ-SELFPIDに明記する。

### Q-COMPLETE、Q-END、Q-WAIT

case-endの内容は待ち行列の先頭に来たときに決める。rows/saved/failedはそのrecorderの終わりの行より前の行を数える。savedは成功通知の数、failedは失敗通知か同期例外の数、droppedは上限や不正などで捨てた行の数。saved=rowsかつfailed=0かつdropped=0のときだけcomplete、それ以外はpartialとする。終わりの行自身の保存失敗や通知固着なら終わりが残らず欠測になる。fsyncの耐久性や予定した全事象の発生は保証しない。

case-endは各試験のcleanupでclosedを待ったあとにendで1回だけ出す。hookは増やさない。読めない行があればcompleteでもpartialとして読み、seqの欠落は保存されなかった行を示す。終わりがなければ欠測であり、成功とは扱わない。

### Q-ORIGIN、Q-RETURN、Q-MARKS

parseStopMarksは8fの解析表をそのまま使い、stdoutが4096文字を超えたら先にinvalidとする。改行で終わらない最後の断片を捨て、CRを外し、印以外は無視する。4印の形式・重複・順序・F系の非負と単調性を確認し、不正なら数値を残さない。bootは省略でき、負かtimeout超ならclockとしてF系だけ残す。Sの壁時計差、Fのストップウォッチ、NのNode経過は比べず差し引かない。

classifyStopReturnはerror ETIMEDOUT→timeout、ほかのerror→error、status非0/null→status、ほか→okでstdoutを見ない。recordWindowsStopはps-return、値のある4印、ps-parseの順で記録し、元のresultを変えず、診断例外を外へ出さない。

PowerShell元13行を順序込みで保持する。try内でStopwatchを始めてbootを出し、CIM後にcim、照合成功の判定後にowner、taskkill直後のLASTEXITCODE判定の後にtaskkill印を出し、最後にexit 0を加える。接頭辞はLOOMAKE-PS、印はFlushし、元throw/exit順を変えない。

### 接続と回帰

stopOwnedFakeの省略可能なrecorder引数、stop-begin・開始時刻・recordWindowsStop・wait-endを追加する。既存2caseにrecorderとrepo-ready/child-ready/closed/cleanup-closed/endを挿入する。3つめの呼出は変更しない。T1〜T9は全OSでPowerShellを新しく起動せず、純粋解析・スクリプト構造・差し替えfs・実一時ディレクトリで検証する。

## Risks / Trade-offs

- 共有スレッドプールを1本占有する負荷が新しく加わる。同じfork内のfs・dns.lookup・zlib・cryptoは遅くなりうる。性能影響ゼロや呼出時間一定は主張しない。
- 最初のプール初期化、mutex、GCの時間は保証しない。uv_onceの初期化ではスレッド起動を待つ。ディスク完了待ちとは分ける。
- カーネル内の固着がプロセス終了を妨げるか、Windowsの途中stdout/Flush、鎖の追いつきは未観測。欠測を保持し、実Windowsの既存2caseのartifactで後から観測する。
- Vitestの既定forksを前提とする。設定を変えてthreadsにした実行はこの前提の外で、ここではpool設定を変えない。

## Migration Plan

strict/spec-only成功後、意味あるREDを先に記録し、最小実装と対象回帰を経て、全件を通常localdone1回へ統合する。CIの3 OS・必須5チェック・正常ci doneと独立レビューは必須の外部受入として残す。主仕様は直接編集せず、受入後にarchiveする。診断だけの追加を根本原因修理と報告しない。

## Primary Sources

Node v24.21.0の固定commit 955266bfdd854cd280dffd47548673914484e4c0にある公式7原本をignoredのfs-primary-0666055fへ保持し、blob一致を確認した。fs.md:2357–2363/9211–9212、cli.md:4110–4115、lib/fs.js:2355–2369/2439–2446/2528–2540、src/node_file.cc:1928–1942/2055–2063/2529–2539、win/fs.c:82–97、threadpool.c:120–161/204–249/281が根拠である。node_file-inl.h:323–351でAsyncDestCallがafter付きDispatchを呼ぶことも確認し、aa7の未確認点を補完した。これらは実Windowsの観測結果ではない。
