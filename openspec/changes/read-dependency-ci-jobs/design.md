# Design

## Context

動機はproposal、振る舞いはREQ-415の5Scenarioによる。基準はraw `530b8582`（main `7fe840ed` を含む）の上の `ac17c769`。process.tsの私的 `runExternalBytes` は元のBufferを返し、データ上限に64KiBの制御用領域を足して親が捕捉する。Node24/Linuxの実測で、公開runExternalは64MiBより1バイト少ない出力からnative ENOBUFSになり、私的入口はちょうどまでstatus 0、1バイト超は出力の上限になった。他OSとNode22は実測済みとしない。

## Goals / Non-Goals

新規の非公開module `packages/kit/src/verify/ci-jobs.ts` の `jobDigits` と `fetchJob(root, digits, limit?)`、新規試験までとする。同じjobの1回化・呼出しの順序・合計128MiB・失敗した取得の合計への計上・共有予算が残る期限の取得不能化は候補416、照合と両ゲートへの接続・REQ-401は候補417へ残し、旧試験2箇所の承認とhead比較範囲も後続の未決として保持する。公開runExternal、REQ-412のsource・型・既存試験、package barrel、run.ts・CLIは変えない。

## Decisions

- `fetchJob` は `{ result: JobFetch; bytes }` を返す。JobFetchは `{kind:'fetched',job,value:unknown}` か `{kind:'unavailable',job,reason}` で、reasonは `missing|exit|signal|spawn|json`。jobは正規化した10進の文字列、bytesは返ったBufferの `stdout.length + stderr.length`。解析値以外に応答本文を持たず、理由に応答・stderr・環境変数の値を含めない。
- `jobDigits` は `/^[0-9]+$/` だけを受け、ほかは起動前に内部の誤用としてErrorを投げる。JavaScriptの `$` はmフラグなしでは入力の末尾にだけ一致するので、LF・CR・CRLF・U+2028・U+2029も拒否する。REQ-400のCI列の `\d` はJavaScriptではASCIIの0〜9だけで、受け付ける集合は一致する。`replace(/^0+(?=[0-9])/,'')` で正規化し、Numberへ変換しない。
- POSIXは `gh` を `['api', path]` で直接起動する。Windowsは `process.env.ComSpec ?? 'cmd.exe'` を `['/d','/s','/c','gh api <path>']` で起動し、Nodeのshellと同じ命令行で従来のgh.cmdも呼べる。cmdへは固定の文字と検証済みの数字だけを渡し、shellオプション・Raw APIの拡張・公開入口への切り替えをしない。
- envは呼出し時のprocess.envからGH_REPO（Windowsは大文字と小文字を区別しない）だけを除いた写しで、cwdはroot。
- `maxBuffer` は `min(JSON_LIMITS.maxFileBytes, limit)` で、limitの既定は64MiB。新しい数値を作らない。
- error.codeがENOBUFSなら `ProcessLimitError('output','gh')` を投げる。ENOENTはmissing、ほかのerrorはspawn、signalはsignal、0以外はexit。Windowsの9009はcmdがghを見つけられない終了としてmissingにし、gh自身の9009とは区別できない。0は既存のinput.tsと同じ `toString('utf8')` のあとJSON.parseし、失敗はjson。BOMはJSON.parseが受け付けずjsonになる。
- runExternalBytesの例外はそのまま投げる。期限の分類と部分出力（既存のProcessLimitErrorの文字列）の計上は候補416が行う。

## 試験

新規 `packages/kit/test/ci-jobs.test.ts` に `[REQ-415]` を付けて置く。`vi.mock` で `runExternalBytes` を実物を呼ぶ `vi.fn` に包み、通常は偽のgh（POSIXは実行可能なnode script、Windowsは `gh.cmd`）を実際に起動する。起動の失敗・シグナル・native ENOBUFS・取得中の中断だけをspyで確かめる。新規の実process試験の上限は60秒とする（1操作30秒と保持役の準備待ち・後片付けの各10秒を含む。既存のtimeoutと実操作の期限は変えない）。

| Scenario | 試験 |
|---|---|
| 応答の取得 | null・配列・object・文字列の値とbytes、引数・cwd・1回の起動、barrelにないこと（実process） |
| 数字の桁 | 000/0/007/23桁/先頭00の23桁のpath、改行5種と `&` を含む数字以外15種の起動前拒否（実process） |
| 同じリポジトリ | GH_REPOの非伝達、ほかの環境変数の伝達、結果に値と本文がないこと（実process） |
| 取得不能 | 終了コード3・`{`・BOM・空の理由とbytes、文字列中の不正UTF-8の置換、不存在（実process）、起動の失敗とシグナル（spy） |
| 1回の出力の上限と監視の停止 | 64MiBちょうどと1バイト超、小さいlimitの超過と64MiBへの制限（実process）、native ENOBUFS・取得中の中断（spy）、1操作の期限の例外と部分出力（実process） |

## Risks / Trade-offs

[Windowsのcmd経由] → cmdが作業ディレクトリのghを先に探すのは既存のpr.tsのshell経由のghと同じで、本子では強化しない。ComSpecがcmd以外を指す環境は扱わない。9009・gh.cmd・部分出力・cwdの表記は3OSのCIで確かめ、Linuxの観測から推定しない。
[ghの{owner}/{repo}の解決] → GH_HOST・set-default・複数remoteは未実証で、originだけや任意hostの保証、新しいremote解析を足さない。
[従来相当の復号] → 文字列中の不正UTF-8はU+FFFDになり取得済みになりうる。受理を狭める厳密な復号は本子で採らない。

## 独立最終レビュー

REQ-415の上表5Scenarioに加え、公開4caller・process.ts・barrel・run.ts/CLI・既存試験/設定/enum/JSON/decision/run.errorsの不変、metadata未検証、数字の桁、OS別起動と監視の停止を照合する。元6Scenarioの移管は通常設計e5c5f2edの表に従い、残りのcache/合計/期限分類を候補416、metadata照合と両ゲートを候補417＋MODIFIED REQ-401に保持する。

## 変更量と受入順

| 対象 | 行数 |
|---|---:|
| 計画6ファイル | 141 |
| 主仕様同期（差分ヘッダを除く） | 25 |
| source 44・test 129・日誌 14・changeset 5 | 192 |
| 合計 | 約358 |

413行の一体案は未採用とし、取得を2子、照合と両ゲート接続を後続の1子へ分けた。約300行の目安に対し、この自然な1回取得の単位の約350行見込みを管理役が技術判断として受け入れた。実数がこの表より明確に多いか、5Scenarioの試験が足りなければ、実装を広げず管理役へ戻す。normal local doneと、同じ実装PRでの主仕様同期とarchiveを行う。
