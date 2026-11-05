## Purpose

固定された判定の要約を変更せずに、取得済みの本体の保存先と照合事実を小さな索引へ追加する。本体の同一性、当時の保持期間、現在の期限、未確認の取得権限を分け、索引だけを真正性や品質合格の根拠にしない。

## ADDED Requirements

### Requirement: 本体参照receiptの版と上書きしない追加
traceはindexVersion:1の本体参照receiptを同期検証し、実取得時刻から決めた名前で1件1ファイルを原子的に追加する SHALL。同名はfalseで拒否し既存ファイルを変えない MUST。型・遅延構造スキーマ・追加JSON Schemaを公開し、未知のJSON欄とown __proto__、既存13Schema（元12と受入済みP1要約1）・Evidence1/2・同期APIを保つ SHALL。共通の秘密置換で内容が変わる新receiptと不正入力は、入力を診断へ出さず公開前にUsageErrorで拒否する MUST。

Source: REQ-470

#### Scenario: receiptの必須構造
- **WHEN** indexVersion:1のreceiptを検証する
- **THEN** body（kind:test-report・sha256・bytes）、summary（path・sha256・bytes・change・sha・ci）、locator（type:github-actions-artifact・repository・artifactId・artifactName・entry・runId・runAttempt）、archive（sha256・bytes・apiDigest）、execution（checkoutSha・workflowHeadShaまたはnull・runId・runAttempt）、artifact（createdAt・expiresAt）、retrieval（retrievedAt・method:github-api-authenticated-read・accessPolicy:project-members・policyVerified:false）、gapsを持つ
- **AND** SHA-256は小文字64桁、bytesは0以上の安全な整数、artifactIdとrunIdは空でない数字列、runAttemptは先頭ゼロのない正の安全な整数を表す文字列、コミットSHAは既存の40桁または64桁の形式、日時は実在するUTCのISO日時とする

#### Scenario: 形式と版が不正
- **WHEN** 必須欄がない、版が1以外、ハッシュ・数値・日時・識別子・JSON構造が不正である
- **THEN** bodyReceiptProblemは同期的に問題を返し、appendBodyReceiptはファイルや一時ファイルを公開せず入力内容を含まないUsageErrorで拒否する

#### Scenario: 未確認の閲覧権限とworkflowの対象
- **WHEN** 正しいreceiptを検証する
- **THEN** retrieval.policyVerifiedはfalseで、access未確認のgapをちょうど1件持ち、workflowHeadShaがnullならその未確認gapも1件持つ
- **AND** 既知gapのfieldはretrieval.accessPolicyとexecution.workflowHeadShaであり、前者は常にunverifiedがちょうど1件、後者はnullのときだけunverifiedがちょうど1件で、値があれば0件とする。未知fieldは保持するが、すべてのgapは空でないfield、kindがunverifiedまたはnot_applicable、空でなくHiragana・Katakana・Hanのいずれか1字以上を含むreasonを要求する。文章の意味による日本語判定は保証しない。真正性や全memberの権限を環境値から作らない

#### Scenario: 未知のJSON欄とown key
- **WHEN** 非秘密の未知のJSON欄とown __proto__・constructor・prototypeを含むreceiptを検証・保存する
- **THEN** 未知欄と値を保ち、共有prototypeや入力を変更せず同期APIで保存後にも読める
- **AND** token・署名付きURL・actorのloginやメール・本体本文を定義欄へ複製せず、任意の秘密や個人情報を検出できるとは保証しない

#### Scenario: 内容を変えずに保存する秘密境界
- **WHEN** 新しいreceiptの値またはown keyが共有maskValueの既知の秘密の形に一致するか、共有関数が入力を拒否する
- **THEN** 参照のpathやhashを置換した値で保存せず、公開前に入力を含まないUsageErrorで止まり、raw値・key・cause・部分出力を診断に含めない
- **AND** 独自patternやrunnerからの実装コピーを加えない。既存receiptや固定要約のbytesは書き換えない

#### Scenario: 安全な相対参照
- **WHEN** summary.pathとlocator.entryを検証する
- **THEN** summary.pathはroot相対の正規POSIX `.loomake/evidence/<change>/<正規summary名>.json`、entryは正規相対entryであり、絶対path・空のsegment・ドライブ名・backslash・dot/dotdotを拒否する
- **AND** 保存と読取りでは既存のリンク拒否を保ち、ZIP entryの実属性検証は本changeで行ったとは主張しない

#### Scenario: 取得時刻に由来する正規の保存先
- **WHEN** appendBodyReceipt(root, receipt)で受理したreceiptを追加する
- **THEN** .loomake/evidence/_index/body/<body.sha256>/<UTC秒のYYYYMMDDTHHMMSSZ>-<artifactId>-<entryのraw UTF8 SHA-256の先頭8桁>.jsonへ整形JSONと末尾改行で保存する
- **AND** UTC秒はretrieval.retrievedAtの実時刻を正規化して使い、現在時計や新しい取得時刻を作らない。_indexをchangeとして予約するために既存change-id検証を緩めない

#### Scenario: 同じ名前の原子的な衝突
- **WHEN** 同じ最終名が既にあるか、2つの追加が同じ名前で競合する
- **THEN** 既存の内容は不変で、公開に成功した1件以外はfalseを返し、自分の一時ファイルだけを片付ける
- **AND** 同じ内容だから成功済みと読み替えず、CLI等の呼出側が記録なしを終了コード1へ対応させる既存方針を保つ

#### Scenario: 異なる名前の追加
- **WHEN** 実取得時刻またはartifactIdまたはentryが異なり正規の最終名が異なるreceiptを追加する
- **THEN** 両方のファイルが残り、先のreceiptと固定要約を上書きしない

#### Scenario: サイズと公開失敗の境界
- **WHEN** 末尾改行を含む整形UTF8 JSONが64MiBちょうどか1byte超過、または書込み・同期・公開に失敗する
- **THEN** ちょうどは受理し、超過は公開前に拒否する。通常の公開失敗は自分の一時ファイルを片付け、不完全な最終JSONを残さない
- **AND** 非原子的な代替へ切り替えず、保存先のリンク等の入力拒否と既存の公開制約を保つ

#### Scenario: 公開物と旧契約を保持する
- **WHEN** core・kit・traceをbuild/packして追加の型と構造スキーマを利用する
- **THEN** 追加のSchemaはschema/summary/で公開され、既存の8個と版付き4個および受入済みP1要約1個のSchema・固定fixture・元の試験期待値は変わらず、coreの入口はZodを静的に読まない
- **AND** 依存を増やさず、旧Evidence1/2の閲覧・documents省略・同期serialize/report・runnerの再利用条件は従来どおりである

### Requirement: 固定要約と本体参照の照合と解決
kitは固定要約のraw bytes・receipt・任意の本体bytesを照合する入力不変の純粋関数を公開する SHALL。traceは明示した保持方針とnowを用い、本体ごとの参照と状態を同期的に返す SHALL。壊れた候補や矛盾を無視して成功へ戻らず、保持期間・現在の期限・access未確認を分ける MUST。resolvedは索引と要約の一致だけを表し、実取得・真正性・品質合格・#71の外部anchorの代わりにしない MUST。

Source: REQ-471

#### Scenario: raw要約と7項目の照合
- **WHEN** checkBodyReceipt(summaryBytes, receipt, bodyBytes?)へ入力を渡す
- **THEN** 要約のraw SHA-256とbytes、strict UTF8のJSON解析とsummaryVersion:1および照合欄の形式、summary.shaとexecution.checkoutSha、summary.ciとlocatorとexecutionのrunId/runAttempt、bodyのhash/bytesに一致する要約artifactがちょうど1つ、archive.sha256とapiDigestのsha256:以降、渡された場合だけ本体のraw hash/bytesをすべて照合する
- **AND** いずれかが違えば一致にせず、日本語の固定の理由を返し、I/O・環境・現在時計・追加の外部実行を使わない

#### Scenario: 実checkoutとworkflow headを分ける
- **WHEN** workflowHeadShaがsummary.shaと同じでもcheckoutShaが異なる、またはrun・attemptが3箇所のどこかで異なる
- **THEN** 不一致とし、workflow headへの置換・trim・大文字小文字の統一で一致を作らない

#### Scenario: 要約や本体の改変とbyte view
- **WHEN** 要約または本体が1byte変わる、ハッシュやbytesが異なる、またはUint8Arrayのoffset/lengthを変える
- **THEN** 渡されたviewの範囲だけをhash照合し、対応する不一致を返す。入力bytesとreceiptを変更しない

#### Scenario: 本体を渡さない場合
- **WHEN** receiptと要約だけを照合する
- **THEN** 索引の結付けだけを判定し、本体を今回取得・照合した結果を作らない
- **AND** ZIPのdigest一致と展開後本体のhash一致を混同しない

#### Scenario: 一意でない本体参照
- **WHEN** receipt.bodyのhash/bytesに一致するsummary.artifactsが0件または2件以上ある
- **THEN** 対象本体の結付けを不一致にし、都合のよい要素を選ばない

#### Scenario: 複数の本体の参照解決
- **WHEN** resolveArtifactBodyへroot・summaryPath・保持方針policy・明示nowを渡し、要約に複数の本体参照がある
- **THEN** artifactsの元の順序で本体ごとの結果配列を返し、各hashの_index/body/<hash>/を既存入力予算内で読む
- **AND** 各結果はstatus・locator一覧・receiptのpaths・retention・access:unverifiedと理由を持ち、全体statusはinvalid-index、mismatch、not-indexed、resolvedの順で優先する

#### Scenario: 同じ要約のpathと共有の読取り予算
- **WHEN** 本体参照を解決する
- **THEN** summaryPathとreceipt.summary.pathが一致することをresolver側で照合し、各file64MiB・summaryと全receipt合計128MiB・4096項目・深さ32の既存予算を共有する
- **AND** summaryのraw読取り分を残予算から引き、残量を超えるreceipt読取りを起動しない。pure照合へpathやI/Oを持ち込まない

#### Scenario: 本体や索引がない
- **WHEN** 有効な要約のartifactsが空か、ある本体に対応するreceiptがない
- **THEN** 0件は空の本体結果配列とnot-indexedの未取得理由、索引のない本体はnot-indexedを返す
- **AND** 古い要約や別の本体の索引から成功を作らない

#### Scenario: 壊れた候補から成功へ戻らない
- **WHEN** 同じ本体の候補に不正JSON・構造不正・正規でないJSON名・読取不能・リンク・予算超過のreceiptが1件でも混ざる
- **THEN** 当該本体はinvalid-indexとなり、正常な別候補へ戻ってresolvedにしない
- **AND** 候補名はUTC秒-artifactId-entryhash8.jsonの生成時と同じgrammarで、prefixのUTC日時は実在し、suffixはreceiptのartifactId・entryhashに、ディレクトリはbodyhashに一致する。prefixとretrievedAtの一致は要求せず、取得時刻の事実はreceiptのretrievedAtだけから読む
- **AND** raw値・key・パス由来の秘密・causeを理由へ出さず、入力や保存済みファイルを変えない

#### Scenario: 候補と要約の結付けが違う
- **WHEN** 読める正しい構造の候補が要約または本体の結付け検査で一致しない
- **THEN** 当該本体はmismatchとし、不一致を無視して別候補のresolvedへ戻らない

#### Scenario: 同じlocatorの矛盾
- **WHEN** repository・artifactId・entryが同じ候補のbody・expiresAt・summaryのいずれかが違う
- **THEN** invalid-indexを返し、後の時刻や都合のよい候補を選んで矛盾を隠さない

#### Scenario: 同一内容の重複を集約する
- **WHEN** 同じ内容のreceiptが異なる正規pathにある
- **THEN** locatorの重複はまとめるが、すべてのreceipt pathを履歴として返す
- **AND** 同じ入力からは同じ順序の結果となり、索引を削除・上書きしない

#### Scenario: 当時と現在の保持状態
- **WHEN** 実createdAt/expiresAtと明示policy/nowで期限を判定する
- **THEN** P1のartifactRetentionを使い、当時のsatisfied・insufficient・unverifiedと現在のavailable・expired・unverifiedを分ける
- **AND** nowがexpiresAtちょうどならexpiredで、現在の失効で当時の判定を変えず、90dの要求を実期限へ置き換えない

#### Scenario: 権限と信頼anchorの意味
- **WHEN** 索引の結付けが一致する
- **THEN** resolvedでもaccessはunverifiedのままで、memberの権限・現在のdownload・真正性・品質合格を保証しない
- **AND** receiptに保存したsummary hashを#71の外部信頼anchorと呼ばず、リリース記録の別の固定値の責務を保持する

#### Scenario: 不正な要約と引数
- **WHEN** 要約を読めない・strict UTF8やP1の同期的な拡張版の検証が不正、またはroot・summaryPath・policy・now自体が不正である
- **THEN** 要約不正はmismatch、呼出引数の不正は入力を含まない日本語UsageErrorとし、raw causeを持たせない
- **AND** 既存record/reportのエラー分類は変更しない

#### Scenario: 旧読取りと新索引の共存
- **WHEN** _index/bodyのreceiptがある状態で既存のtrace report・runner再利用・Evidence1/2の閲覧を行う
- **THEN** receiptを従来の要約と誤認せず、既存の出力・再利用の候補と条件・固定要約のbytesが変わらない
