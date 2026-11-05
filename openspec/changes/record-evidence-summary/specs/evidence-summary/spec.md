## Purpose

判定の要約に実行条件と本体の観測事実を追加し、旧形式の閲覧と同期APIを保ちながら、確認できた情報と未確認の情報を利用側が区別して扱えるようにする。

## ADDED Requirements

### Requirement: 判定の要約の版と読取りの互換
新しい記録はEvidence 2の最上位にsummaryVersion:1と本要件の拡張欄を持つ SHALL。拡張の型・遅延構造スキーマ・別ディレクトリのJSON Schemaを公開し、既存12JSON Schemaと公開元を変えない MUST。summaryVersionがなければ既存の意味検証と閲覧を保ち、1なら同期的に拡張を検証し、他の値とEvidence 1での目印は拒否する MUST。未知欄とown __proto__、元の保存・読取りの入力制約を保つ SHALL。

Source: REQ-460

#### Scenario: 新しい要約の必須欄
- **WHEN** 新規recordを正常に保存する
- **THEN** 既存のschemaVersion:2・change・sha・committedAt・recordedAt・verify・documentsを保持し、summaryVersion:1、role:development、ci、execution、artifacts、request:null、observation:null、gapsを持つ
- **AND** 旧verify結果の形・品質判定・終了コードを追加欄から変更しない

#### Scenario: 旧形式と未知のstorage欄
- **WHEN** summaryVersionのないEvidence 1または2と、未知のstorage・任意の未知欄を持つ従来の有効な記録を読む
- **THEN** 従来どおり読み、旧ファイルのbytes・未知値・documentsの省略・レポートの出力を変えない
- **AND** Evidence 1の閲覧専用警告、local・aborted・不足を最終CIの合格にしない契約を保つ

#### Scenario: 版や拡張が不正
- **WHEN** summaryVersionが文字列の1・数値2・null、Evidence 1に目印がある、または版1の必須拡張欄の型・意味が不正である
- **THEN** ファイルと理由を示して同期的に拒否し、reportは終了コード2で止まり、古い成功記録へ戻らない

#### Scenario: 固定用のrelease要約
- **WHEN** 公開された検証関数へrole:releaseの固定入力を渡す
- **THEN** すべてのartifactにlocationとretrievalがある場合だけこの役割の構造を受け、roleだけから承認済み・公開可能とは判断しない
- **AND** 本PRのrecordはrelease要約を生成しない

#### Scenario: 新しい公開物を分ける
- **WHEN** 新しい構造スキーマとJSON Schemaを生成し、通常exportsとpublishConfig exportsから利用する
- **THEN** schema/summary/の拡張版1の生成物が構造スキーマと一致し、元の8個・版付き4個のJSON Schemaと既存固定fixtureは不変である
- **AND** coreの入口はZodを静的に読まず、traceの従来の型公開とserialize・report等は同期のままである

### Requirement: 実行条件の事実と未確認の理由
要約は実行識別・評価器・対象と基準・環境・コマンド・実施時刻を出典どおり記録し、値を推定しない MUST。CI識別と実行元を分け、環境値を真正性・承認の証拠にしない MUST。既知のnullable欄ごとにnullのときだけcanonicalなfield名のgapを1件持ち、未知欄はこの規則へ巻き込まない SHALL。requestとobservationは本PRではnullと理由を保持する SHALL。

Source: REQ-461

#### Scenario: 実行事実を記録する
- **WHEN** recordが既存の検証を1回実施する
- **THEN** executionはid（新規UUID）、origin（localまたはgithub-actions）、evaluator（name:@loomake/traceとpackageのversion）、basisSha256、environment（node/platform/arch）、commands、producerまたはnull、startedAt/finishedAt、verification:executedを持つ
- **AND** basisSha256は既存basisHashと同じ入力・手順、commandsは設定のrawハッシュと名前参照だけを持ち、実施時刻はその検証の前後に得た時刻で、追加の外部コマンドを起動しない

#### Scenario: CIの環境値がそろう
- **WHEN** GITHUB_ACTIONSがtrue、GITHUB_RUN_IDが空でない数字列、GITHUB_RUN_ATTEMPTが正の安全な整数を表す文字列である
- **THEN** ciはrunId・runAttempt・source:environmentを持ち、runIdとrunAttemptは最上位のciだけに保存する
- **AND** shaは実際に検証した元の対象であり、要約を追加したcommitへ変えない。#71の最小固定入力と同じci.runId/runAttempt・shaの位置になる

#### Scenario: ローカルまたは不完全なCI環境
- **WHEN** GitHub Actionsの外で実行するか、CI環境値が欠ける・形が不正・runAttemptが安全整数でない
- **THEN** ciをnullとし、外での実行はnot_applicable、不完全な環境はunverifiedのgapを1件残し、架空の識別を作らない

#### Scenario: 未確認と対象外の欄
- **WHEN** producerを確認できないか、requestとobservationの機能を使わない
- **THEN** それぞれをnullとし、execution.producerはunverified、requestとobservationはnot_applicableのgapを1件ずつ持つ
- **AND** gapsはfield・kind（unverifiedまたはnot_applicable）・空でない日本語reasonを持つ

#### Scenario: gapsの対応が不正
- **WHEN** 既知のnull欄のgapがない・同じfieldで重複する・値がある既知欄にgapを付ける
- **THEN** 拡張の意味検証が拒否する
- **AND** canonicalなfieldはci、execution.producer、execution.commands.sha256、execution.commands.nameRefs、request、observation、artifacts、artifacts[0].counts等の既知配列要素の欄で、未知のnullable欄はそのまま保つ

#### Scenario: コマンド本文を新しい欄へ保存しない
- **WHEN** 設定ファイルがある実行のcommands参照を保存する
- **THEN** commandsはsource:loomake.config.json、設定のraw SHA-256であるsha256、nameRefsを持ち、コマンド本文とraw custom nameを保存しない
- **AND** nameRefsは確認できた既存の品質コマンド訪問順の配列で、各要素はraw nameのUTF8 SHA-256であるnameSha256と、名前が完全一致した場合だけ任意のknownName（lint/typecheck/test）を持つ。本文hashや実行結果として扱わない

#### Scenario: 設定省略と観測できない訪問順
- **WHEN** 設定ファイルを省いた従来の既定値経路、またはaborted等で訪問順を観測できない実行を記録する
- **THEN** 省略時はcommands.sourceをdefaults、sha256をnullと対応するgapにし、従来の既定値経路を受け付ける。訪問なしを確認できた場合のnameRefsは空配列、観測できない場合はnullとunverified gapにする
- **AND** 空文字列の設定hashを捏造せず、既存verify details全体の秘密情報保護をこの新欄だけで保証しない

### Requirement: 本体の参照と同じ実行の観測照合
recordはverifyを再実行せず、既存の変更検知後に本体のraw bytesを安全に読み、表現を比較できるcheckハッシュと照合する SHALL。既知の不整合は記録せず1を返す MUST。未確認や既知の部分出力はcounts:nullとgapを持ち、同じ実行を照合したverifiedは全件完了・真正性・品質合格を意味しない MUST。元のonVerifyの回数・順序、入力安全性とUsageErrorの分類、失敗の保存、期限・品質コマンドの回数を保つ SHALL。

Source: REQ-462

#### Scenario: 同じ実行のレポートを照合する
- **WHEN** ciの品質checkにreport:sha256があり、実raw本体と一致し、UTF8をstrictに解析でき、開始時刻がverify前後の範囲内で、品質commandのcheckがすべてPASS、parseTestReportが成功し、失敗0件のファイルや既知の部分出力がない
- **THEN** artifactのsameRun.statusをverifiedとし、観測されたpassed・failed・skipped・todo・pending・otherの6件数だけを保存する
- **AND** tests_total（passed+failed）と区別し、未知の未実行試験を0補完しない

#### Scenario: 本体の既知ハッシュが違う
- **WHEN** rawがstrict UTF8として有効でcheckが示すreportハッシュとraw SHA-256が違う、またはcheckが空文字列のhashでrawが空でない
- **THEN** gapで握り潰さず、新しい要約と一時ファイルを公開せず1を返し、既存記録は書き換えない

#### Scenario: 不正なUTF8とハッシュ表現
- **WHEN** 元の本体がstrict UTF8として解析できない
- **THEN** raw SHA-256とbytesを保持したままsameRunをunverified、countsをnullと理由付きgapにする。置換decode後文字列のcheck hashとの表現差を既知のraw不一致だとは扱わず、元verifyの失敗等の保存を保つ
- **AND** valid UTF8のときだけstrict decodeしたtextを件数parserへ渡し、共通sha256Hex・従来readerのdecode・旧verify結果は変更しない

#### Scenario: 安全なraw入力の公開
- **WHEN** readInputBytesへ通常の入力ファイルと既存のJSON_LIMITS等を渡す
- **THEN** 元のraw bytesの複製を返し、lstat・nofollow/nonblock付きopen・fstat・実読取り量の予算・通常ファイル/リンク拒否とエラー分類を既存どおり適用する
- **AND** InputReader型の既存メンバーは不変で、従来readの文面・予算・置換decode・ELOOP分類を維持し、64MiBちょうど/超過・リンク差替え・FIFO・ディレクトリ・不正UTF8を区別する

#### Scenario: 同一実行を確認できない
- **WHEN** localでcheckのハッシュがない、出力が古い、実行が失敗・中断した、開始時刻を確認できない、またはbail等の部分出力だと分かる
- **THEN** sameRunをunverifiedと理由付きで記録し、countsはnullとgap1件、verifyの元の失敗や不足は維持する
- **AND** hidden bailの全排除や、全テストの完了をこの照合だけで保証しない

#### Scenario: 本体がないか読めない
- **WHEN** レポートがない、または本体の観測用読取りができない
- **THEN** artifactsは空配列で、artifactsのgapを例外的に1件持ち、未取得と不読を理由で区別する
- **AND** 元のconfig・入力安全性のUsageErrorをこの処理で握り潰さず、元のverify結果を合格へ変えない

#### Scenario: 本体参照の構造
- **WHEN** 本体をartifactとして記録する
- **THEN** kind:test-report、configの相対path、sha256、bytes、sameRun、counts、location、availability、expiresAt、retrievalを持つ
- **AND** locationはnullまたはgithub-actions-artifact（repository/runId/runAttempt/artifactName/entry/createdAt）で、availabilityはnot-uploaded・uploaded・retrievedを区別する

#### Scenario: 現時点の書き手と参照検証の境界
- **WHEN** 本PRのrecordが新しいdevelopment要約を保存する
- **THEN** locationとexpiresAtとretrievalはnull、availabilityはnot-uploadedで、それぞれのgapを持つ。本体をGitや要約へ複製せず、取得済みと報告しない
- **AND** 実在する共有先へ辿る親#69の義務は未完了のまま残る

#### Scenario: 既存保存と再利用を保つ
- **WHEN** 新しいlocal要約を保存し、直前のcommitがその正規名の要約1件だけを追加している
- **THEN** 既存の原子的公開・64MiBの上限・上書き禁止とrunnerの再利用条件を保ち、記録ごとの索引更新ファイルは同時に追加しない
