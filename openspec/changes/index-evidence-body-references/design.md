# Design

## Context

基点はmainのaae24bda。Issue #69の本文と全1コメント、要件定義7.9・NFR-09、Opus初期84f0136eと補足271b9d31、固定したP1計画5b809c3fを入力にする。両Opusのmanifestは実claude-opus-5-5・exit0・ok:trueを示す。実装・保存・CIの成功を示すものではない。

P1のsummaryVersion:1、readInputBytes、checkArtifactBody、artifactRetentionと、#65 P1のmaskValueは、この基点のmainにはない。正式な依存の受入まで仕様ゲートを止める。既存のpublishEvidenceは一時fileの完全書込み・fsync・linkによる非上書き公開を行い、serializeEvidenceは末尾改行を含む64MiBを検査する。これらを弱めない。

## Goals / Non-Goals

**Goals:** 固定要約を変えず、immutable receiptで本体を参照する。自己申告された識別と、実際の取得・hash照合、期限、権限の未確認を分ける。小さな通常L3 PRとして、全2要件・全Scenario・通常DoDを満たす。

**Non-Goals:** 通信、gh起動、workflow、ZIP展開、定期実行、release記録、attempts、旧raw整理はこのchangeで実装しない。REQ-472・464・465と親の実運用・整理の義務はparent-handoff.mdに残す。親#69、#70のhistory/status、W5の自動転送を完成扱いにしない。

## Decisions

### 型・検証・公開

新しいBodyReceiptの型・遅延スキーマはP1のcore summary-contracts/summary-schemasへ追加する。JSON Schemaはschema/summary/だけへ追加し、既存8本とversions4本の配列・生成物は変えない。通常exportsとpublishConfigをそろえ、core入口からZodを静的に読まない。未知のJSON欄とown __proto__を安全に保持する。

traceのbodyReceiptProblem(value)は同期の形式・意味検証を行う。kitのcheckBodyReceipt(summaryBytes, receipt, bodyBytes?)はI/Oのない7項目の照合だけを行う。kitからtraceをimportせず、要約全体のP1意味検証はresolverがtrace側で先に行う。pure照合はstrict UTF8/JSON・summaryVersion:1と照合に必要な欄を検査し、非対象の既存verifyの合否を再判定しない。必要な参照型はcoreから共有し、既存型を複製しない。

locatorにもrunId/runAttemptを必須で置く（QRef22）。補足設計の形式例にはなかったが、同設計の照合条件4はsummary・locator・executionの3箇所の一致を要求していた。runIdは数字列、runAttemptはP1と同じ正のsafe整数を表す文字列とし、trimや数値変換で違う記録を同一にしない。

### 追加とファイル名

appendBodyReceipt(root, receipt):booleanをtraceで公開する。受理したJSON互換receiptを共有maskValueへ渡し、値またはown keyが変わる場合や共有関数が拒否する場合は、入力を含まないUsageErrorにする（QRef24）。参照path/hashをマスクした別の値として保存しない。構造検証・JSON化・末尾改行込みbyte上限・JSON化後の再検証を通してからpublishEvidenceを使う。getter/toJSONを実行しない共有入力契約も維持する。

新しいpatternを作らず、runnerの実装をコピーしない。これはNFR-09と既存Opus65の共有関数設計を根拠にした管理採用であり、271b自体がprivacyを評価済みという意味ではない。任意の未知の秘密や個人情報を検出できるとは保証せず、token・署名URL・actor情報・本体本文をreceiptの定義欄へ持ち込まない。

保存先は`.loomake/evidence/_index/body/<bodyhash>/<stamp>-<artifactId>-<entryhash8>.json`。stampは実retrievedAtをUTC秒へ正規化し、entryhash8はentryのraw UTF8 SHA-256先頭8桁とする（QRef25）。現在時計は読まない。同名ならfalse、異名なら別ファイルに追加する。CLIの新設はせず、呼出側が衝突を終了コード1へ対応する既存方針を案内する。

正規pathの安全性と既存公開のリンク・通常file/dir制約を確かめ、索引のためにassertChangeIdを緩めない。既存のread/publicationを全般的に改変するPRにはしない。通常失敗では自分のtemporaryだけを片付け、強制終了時の残骸確認は既存の案内を保つ。

### 7項目の結付け

1. summaryのraw SHA-256とbyte数がreceipt.summaryに一致する。
2. strict UTF8のJSONとして読め、summaryVersion:1と照合欄が正しい。
3. summary.shaがexecution.checkoutShaと完全一致する。workflowHeadShaは別の観測値である。
4. summary.ci、locator、executionのrunId/runAttemptが完全一致する。
5. receipt.bodyのhash/bytesと一致するsummary.artifactsの要素がちょうど1件ある。
6. ZIPのarchive.sha256がapiDigestの`sha256:`以降と一致する。
7. bodyBytesがある場合だけ、P1のcheckArtifactBodyでraw bytesを照合する。

Bufferを含むUint8Arrayのoffset/lengthを尊重し、textへの再encodeを元bytesと呼ばない。要約・receipt・bodyを変更しない。receiptのsummary.sha256は外部anchorではなく、#71のcheckFixedSummaryの信頼値を自己hashへ移さない。

### resolverの入力と結果

`resolveArtifactBody(options: {root:string; summaryPath:string; policy:QualityEvidencePolicy; now:string}): BodyResolution`とする（QRef23）。root qualityの暗黙読取り、環境変数、現在時計、外部コマンドを追加しない。policyのartifact_retentionをP1の期限判定へ明示的に渡す。nowはUTCの実在するISO日時で、呼出側が明示する。

BodyResolutionは全体status、理由、artifacts配列を持つ。各要素は要約の元順序で、bodyのhash/bytes、status、locator一覧、receiptの全paths、retention、access:unverified、固定の日本語理由を返す。0件はnot-indexedと未取得理由を返す。全体の優先順位はinvalid-index > mismatch > not-indexed > resolvedとし、途中の悪い候補を後の成功で隠さない。

P1の安全なraw readerでsummaryを読み、同期的なevidence/summary意味検証を行う。本体ごとに`_index/body/<hash>/`をcreateInputReader(JSON_LIMITS)の同じ予算で読む。64MiB/file・summaryと全receiptで128MiB/total・4096項目・深さ32の既存制約を保ち、リンクや特殊fileを採用しない。正規のJSON候補以外の公開temporaryは証拠として採用せず、正規でないJSON名や読めない候補を成功から除外して終わりにはしない。

QRef29に従い、summaryPathとreceipt.summary.pathはroot相対の正規POSIX証拠pathで一致させる。locator.entryは正規相対entryとし、絶対/drive/backslash/dot/dotdot/空segmentを拒否する。ZIP実属性の検査はREQ472側であり、文字列からsymlink不存在を証明しない。summaryをraw読取りした分はreceipt readerの残合計予算から引き、残量を超える読取りを開始しない。pure照合にpathの判定を持ち込まず、既存readの分類を変えない。

同じ(repository, artifactId, entry)でbody・expiresAt・summaryが違えばinvalid-index。同一内容の重複はlocatorをまとめるが全pathを辞書順で保持する。異なる候補も決定的な順序で返す。索引の追記・削除・修復はresolverの仕事にしない。

### エラーと意味の境界

QRef26に従い、要約の不読・strict UTF8不正・P1意味検証の不正はmismatch、候補の不正JSON・構造・リンク・予算超過・読取不能はinvalid-indexとする。引数root/summaryPath/policy/now自体の誤りはgenericな日本語UsageErrorとし、入力をmessage/causeへ出さない。既存record/reportの分類は変えない。

retentionはP1のartifactRetentionで当時の充足と現在の期限を別々に返す。実7dを要求90dへ変更せず、期限切れで当時の判定を変えない。policyVerified:falseにはaccess未確認のgapをちょうど1つ置き、権限APIやmemberの個人情報を取得しない。resolvedは記録の一致だけであり、現在の実download・真正性・全member権限・品質合格の主張ではない。

## Risks / Trade-offs

- P1と#65が未mainのため実装できない。依存を受け入れたあと、公開API・型・Schemaの実差分をもう一度照合する。
- 7項目の一致と実取得の証明を混同しない。旧artifactの取得例は異なるcheckout/workflow head、実7d、producer未確認で、対応する固定summaryがない。新規運用の合格へ流用しない。
- 固定要約の不変を優先して別receiptを足すため、runnerの「1summary追加だけ」の再利用候補は広げない。実運用でsummary+receiptを同一commitへ入れるのはREQ-472側の受入である。
- 通常レビュー差分200KiBには計画・型・生成物・fixtures・試験を含める。超過が見込まれたら実装前に通常PRの分割を管理役へ提示し、要件・試験・原文を削って合わせない。

## 実装へ継承した前提（2026-11-06 JST）

実装基点は5a9ec513。PR #452/#457でP1が、PR #450/#453で共通maskが受入・同期archive済み。coreのEvidenceSummary・loadSummarySchemas、kitのreadInputBytes・checkArtifactBody・artifactRetention・maskValueを実ファイルで照合した。元の未受入という記述は計画時点の事実として保持する。既存13 Schema（旧12とP1要約1）は不変に保つ。

QRef30を管理役rootが採用した。gapの既知fieldと日本語文字の構造条件、resolverの候補名の時刻・suffix・bodyhash検査をspecへ明記した。同内容の別pathを保持するため、候補名のprefixとretrievedAtの一致は求めず、取得事実はreceiptの原retrievedAtからだけ読む。

QRef31は2026-11-06 JSTに管理役rootが採用。locatorsはstable locatorで集約し、pathsとretentionはreceipt別に保持して順序と対応を失わない。raw読取失敗の消費量は不明なので、残量0として後続をinvalid-indexにする。保持状態の集約規則は作らない。
