# Design: validate-engine-json-result

## Context and scope

基準はmain `085a82686dc1c14506fbdbad88b5b9b3961f522e`。品質E3の旧treeと設計head5cを保持し、同じchange-idの正式起案だけを新treeへ移した。Opus b95d2ffbの8 Requirement・41 Scenarioと、管理役のQ1〜Q11・監査残5点を採用元とする。予約済みのREQ-340/341だけを使う。C001/S1のv2/local/ciは未採用なので、現行verify --doneと既存runnerの正常経路を維持する。

この正式起案に対する独立Opus設計A1・A2・A3・Bを実施し、管理役が2026-10-31（日本時間）に下記7章の方針を採用した。A3は資料の一部を未読と明記しており、その範囲を確認済みへ数えない。設計確認時点では製品実装、実CLI採集、install、PR/pushは実施していなかった。実装の進捗はtasksと各commitの検証で区別する。仕様ゲートの成功も製品の完了や実観測の成功を意味しない。

## 1. 分類と停止の責務

分類は元の標準出力に対する純粋な判断とし、秘密置換でJSONとして読める形へ変わった出力を分類に使わない。記録の保存と分類の利用を分け、元rawを新しい公開戻り値・summary・停止理由へ足さない。判断に必要な元値はメモリ内だけで扱い、安全な分類と表示可能なsubtypeを下流へ渡す。既存の出力の置換・予算は保つ。

| 順序 | 入力条件 | 結果 |
|---|---|---|
| 1 | JSONが読めない、最上位がobject以外（null/arrayを含む） | shape |
| 2 | is_errorがtrue、またはsubtypeがerror_で始まる文字列 | failure。metadata/resultの型異常より先 |
| 3 | type/subtypeが存在して文字列でない、is_errorが存在してbooleanでない、resultが文字列でない/欠落 | shape |
| 4 | それ以外 | normal。未知欄・未知の文字列・空resultを許容 |

表示するsubtypeは、`error_`の後ろのsuffixが`[a-z0-9_]{1,64}`に一致する場合だけで、全体は最大70字とする。Q3はこの適用範囲を管理役が明記した。最上位objectの判定に成功する前に、failure欄だけを読む経路は作らない。

新しい観測は既存decision-policyの停止順を崩さない。中断、出力上限、時間上限、質問、非ゼロ/不明終了コードは従来どおり先に止める。HEAD/branch変更はGit内部変更より前にし、これらの理由があれば結果異常より先に書く。結果異常だけの正常終了をholdとして呼出し元へ返す。

hold後も既存guardの検査と、削除・差分・承認の必要な表示を省かない。純粋AfterGuardで結果異常か不正な直し方があれば止める。両方ある場合、ここでの理由は結果異常が先、guardが後である。Q1の理由順と、先行するGit内部/HEAD変更の理由順は異なる段階なので混ぜない。indexを外し、作業ツリーの変更を残す。タスク完了・commit・NoChange完了・直しの再gate・次engineはしない。

正常結果では従来のタスクcommit、正当なNoChange、完了ゲートと直しを保つ。REQ-330の二見出しは別々に更新する。同Source204の別契約を、この純粋判断のRequirementと取り違えない。公開indexへの不要なexportや別パッケージは追加しない。

## 2. 理由と保存失敗の段階

理由の組立てに渡すのは固定の分類、許可されたsubtype、当該NN-output.jsonの具体パスだけとする。result・未知欄・raw本文を連結しない。不正な直し方の詳細は従来のguard表示へ残す。通常の表示とsummary.jsonは具体パス全体を保つ。

| 保存する段階 | 失敗時の扱い | 回帰 |
|---|---|---|
| callEngineのoutput保存。結果の分類を停止判断へ使う前 | 従来のI/O停止。E3理由を決めたことや、結果を分類できたという実行証跡を補わない | 既存I/O失敗を保持し、E3のR-15とは別に検査 |
| 結果異常を分類後のsummary/stop情報 | REQ-179のfallbackと保存できない表示。短い理由の先頭に結果異常と確認先を残す | REQ-340「保存できないときの表示」/R-15 |
| summaryの予約量超過によるstop形式 | 既存2048 UTF-16以内。短いパスは全体が残り、長いパスは先頭の種別と長さだけを保証 | 短い/長いパスを別Scenarioで検査 |

2048字の本文へ無限長パスを残す約束は加えない。既存の記録予算を拡張せず、原因となる結果異常を先に置く。秘密の目印は理由へ含めず、元の出力記録は既存の置換規則で保存する。

## 3. 既存Scenarioと回帰

8本文はrunのADDED340とMODIFIED099/330の二つ/331/100、run-decision-policyのADDED341とMODIFIED204で構成する。元の全41 Scenarioを保持し、既存mainの20 Scenarioは、管理役が承認したpolicy204正常条件への結果異常の追加以外、原文を保つ。REQ-100の追加6番目はa1原文へ戻す。C001の提案本文とは合成しない。

直接試験は失敗優先とAfterGuardの理由順を逆にしたコピーをassertion失敗として検出する。タイムアウトや読込失敗をmutation検出の成功へ読み替えない。統合試験はタスクと直しの両方、変更/NoChange/不正な直し方、先行停止、元rawと置換後の差、短い/長いpathとI/O段階を確かめる。別変更の試験成功をE3の代替証拠にしない。既存fake engineは正常なJSON結果を返す形へ必要な範囲だけ追従し、元assertを実装へ合わせて弱めない。

## 4. 観測入力の出所と保存許可

採集時の元raw、認証秘密、stderr本文、例外message、個々の元値のhashは永続化しない。元raw全体のhashも保存しない。session_idがあるから安全という普遍的な仮定は置かない。fixture自身のhashは保存物の整合確認に使えるが、元rawの一致・再解析・独立再現の証明には使わない。

| provenance | 入力の作り方 | 保存/試験上の区別 |
|---|---|---|
| observed-projection | 元の最上位objectにある既知4欄だけを、presence/value/JSON型を一切変えずに写す。下表の許可値だけ | 実観測の4欄投影。欠けた欄を補わない |
| derived | 採集時に元rawから直接、同じJSON型の固定値へ置換する。fieldと元の型をsubstitutionsに残す | 観測由来の値置換。metarecordから作らない |
| observed-metarecord | 値を持たず、parse/topLevelと4欄の存在/型だけ | 分類試験のinputに使わない |
| synthetic | 試験表やmetarecordを見て新生成した入力 | 合成。実観測・derivedを名乗らない |

最上位number/nullを4欄投影とは呼ばない。object以外は値を含まないmetarecordと、必要な別syntheticで扱う。実CLIの期待したcaseに該当しなければ未収集として残す。

| 欄 | projectionに保存できる値 | それ以外をderivedへ置換する場合 |
|---|---|---|
| type | `"result"`、null | 許可外の文字列は `"withheld"`。ほかは下表の同型固定値 |
| subtype | `"success"`、`"error_max_turns"`、null | error_開始かつ表示可能なら `"error_withheld"`、表示不可なら `"error_X"`。error_以外の文字列は `"withheld"` |
| is_error | true、false、null | 真偽値は保つ。許可外の文字列は `"withheld"`、ほかは同型固定値 |
| result | `"OK"`、null | 許可外の文字列は `"withheld"`、ほかは同型固定値。欠落は欠落のまま |

置換する全JSON型の固定値を次のとおりそろえる。nullは各欄の許可集合に含め、存在しない欄は補わない。

| 元のJSON型 | type・subtype・is_error・resultの置換値 |
|---|---|
| string | 上の欄別の固定文字列。subtypeのerror_開始・表示可否を保つ |
| number | 0 |
| boolean | false。is_errorのtrue/falseは許可値なので置換しない |
| object | 空object |
| array | 空array |

分類に使う最上位型、各欄の存在・JSON型、is_errorのtrue、subtypeのerror_開始と表示可否を、保存前にメモリ内で元の値と比較する。不一致なら保存しない。閉じた許可集合にない欄が1つでもあればrecordはderivedとし、置換箇所と元の型をsubstitutionsへ残す。製品の理由に表示するsubtypeの契約は変更せず、公開fixtureの保存許可集合と区別する。

result:42はderivedのresult:0、result:nullはprojectionのnullである。resultの任意の数値・文・object・arrayをprojectionへ保存しない。元がobjectのinputには既知4欄以外を足さず、未知欄は保存しない。元の型を保つだけで分類の全合図を維持できるとは仮定せず、error_開始・is_error・表示可否を含む直接試験を用意する。

保存schemaの構成は次のとおりとし、表・例・schemaのいずれかだけを別の許可集合にしない。これはcollector/fixtureの設計であり、実装済みschemaではない。

| 分岐 | 必須 | 禁止/整合検査 |
|---|---|---|
| 全record | schemaVersion=1、provenance。定義したkeyだけを許可 | additionalProperties=false。raw/body/privateRawSha256/個々の元値hashを認めない |
| projection | input=object、fieldsのpresent/jsonType | inputのkeyはtype/subtype/is_error/resultだけ。上表のprojection許可値と一致。欠落・型をfieldsと比較 |
| derived | input=object、fields、substitutions | 上表の同型固定値だけ。置換fieldと元の型、input型が一致。保持すべき合図を変えない |
| metarecord | parse/topLevelとfields | input/substitutions/値を持たない |
| synthetic | 合成である出所、input | 観測caseの成立へ数えない。観測版/実行を自己申告で付与しない |
| 実観測record | cli.version=2.1.307または2.1.308、native binaryのsha256、case、attempt、終了/上限の固定metadata | stderrはbytesだけ。秘密や本文を加えない。unknown key/許可値外は保存前に拒否 |

同型の固定値はnull/true/false/0/空array/空object、文字列の固定置き値と、分類に必要な固定error合図に限定する。任意のraw値へ広げない。fieldsの各欄はpresent=false、またはpresent=trueとjsonTypeだけとし、元値を持たない。fieldsへ長さなど採集に不要なmetadataを追加しない。recordのstderrBytesは本文を持たない既定の件数として区別する。上の表のcross-field整合も保存前に検査し、単なるJSON型合格だけで保存可能とはしない。

形だけを示す合成例は次のとおり。実観測のversion/hashを捏造していない。

```json
{"schemaVersion":1,"provenance":"synthetic","input":{"type":"result","subtype":"success","is_error":false,"result":"OK"}}
```

CIで確認できるのは保存物自身の型・出所と整合までである。原rawを保存しないため、後から元値を分類し直したり、CIで元値との一致を独立確認したりはできない。この限界をfixtureと採集manifestに明記し、実観測の証明をsyntheticへ差し替えない。

## 5. 実CLI 2版×2caseの採集前提

必須は2.1.307/2.1.308 × success/error_max_turnsの実4件のまま。公式package/integrityを確認し、版別の独立prefixへignore-scriptsで導入し、nativeを絶対パスで直接呼ぶ。実行名・版/checksum・helpはその版で確かめる。今回は実導入も採集もしない。

実採集の前提は、保存先が専用worktree内で除外対象かつ外向きsymlinkなし、cwdが一時領域のgit外であること、必要なflagと公式reference、debug出力の抑止が既存設定を変えずに成立すること、既存subscription認証、hook/会話記録を含め原raw/認証秘密の永続化を避けられること、である。認証値や秘密ファイルを読んで整える工程は作らない。

Q5はunknown/non-subscriptionなら未収集・Issueであり、管理役回答待ちのまま他作業まで止めない。Q9/Q10は不明でも無害promptだから採集する旧推奨を採用しない。no-session-persistenceが使えない場合や既存hookの永続化を避けられない場合も、保護を外さず未収集にする。必須4件のtaskは残す。

起動はshellなし・promptはstdin、stdoutは1MiB・stderrは64KiB・上限5分を前提とし、生の出力を端末/ファイル/ログへ継承しない。環境は既存を保ち、採集の子にDISABLE_AUTOUPDATER=1とCLAUDE_CODE_DISABLE_AUTO_MEMORY=1を足す。ReadだけでMCPを除いたとは主張せず、公式disallowedToolsのmcp__*を追加拒否する。既存設定源、hook、保護、MCP設定を無効にしない。MCPサーバー接続の有無は推測せず、不明なら不明と記録する。原raw/秘密の非永続化を確認できなければ未収集とする。

argvの必要flagを対象版のhelpで確認する。max-turnsがhelpにない版は、その版へ適用できる公式referenceを保存できる場合だけ試し、unknown optionは未収集にする。設定sourceの無効化、bare、safe-mode、permission緩和、独自settings/MCP構成、debug/verbose/resume等を付けない。error_max_turnsは無害なnoteをReadした後の固定promptで確認し、Read拒否や別subtypeを成功へ数えない。同じ条件の試行は元案の2回までとし、全試行と不足を残す。

保存はrawからメモリ内で最小化して行う。stderr/例外messageは本文もhashも残さず、固定の結果符号だけを使う。rawを一度書いてから消す方式は使わない。JSのメモリを確実に消去できるとは主張しない。設定の許可された整合metadataを比較して変化があれば無効とし、不足をIssue/taskへ残す。

## 6. 検証と引継ぎ

strict/spec-onlyと正式IDの500 UTF-16本文再測定、既存Source/Scenario比較はhead6c951b9で成功した。独立設計4工程と下記の管理判断を反映したら、strict/spec-onlyを再実行してから製品実装と回帰へ進む。実4case、done、L3の必須CI・変更runnerの3OS試験・独立最終レビューは別に受け入れる。現在のレビュー規則は9.2の改訂ADRに従い、Codexは参考として扱う。どこかが未実施/未収集なら全体を完了にしない。

旧source340/341の仮名を正式IDへ置換しただけの長さ測定や、旧5cのgate成功を流用しない。C001が先に採用された場合は、最新mainへ統合して仕様・全Scenario・採集/回帰前提を再照合する。個別の停止で他の独立作業を止めないが、未達の受入を短縮して済ませることもしない。


## 7. 独立設計の確認と管理役の採用（2026-10-31）

同じhead6c951b9のA1=f39faeb5、A2=1bb16ffa、A3=a1351704、B=e2a2fb83は、すべて実モデルclaude-opus-5-5、ok:true、拒否0の別セッションで完了した。原本と検証は専用treeの`.loomake/claude/`と`.loomake/e3-revised-design/existing-design-audit.json`にある。これは設計であり、製品の最終レビューではない。A3の未読資料727〜1626行と別抜粋は、確認済みとしない。今回誤って重複起動した417111fcは管理役の指示で停止し、未実施のまま記録する。

管理役はADR0006の包括承認に基づき、各工程の選択肢と理由を照合して次を採用した。確認事項の回答者は利用者（ADR 0006 の包括承認）と記録する。

- 分類器、分類と具体パスからだけ理由を作る関数、AfterGuardはdecision-policy.tsへ置く。構造化したfaultとoutputPathを観測へ渡す。rawは渡さず、既存の質問の判定に必要なtext等は明示した欄で渡す。engine.tsのraw/text契約と公開indexは変更しない。
- 既存の45件と既存mutation試験の期待値を変えず、新しいresult-policy試験とmutation試験を作る。失敗優先とAfterGuardの理由順を逆にしたコピーが、同じ新規直接試験のassertionで失敗することを確認する。タイムアウトやimport失敗は検出成功へ数えない。
- taskとrepairの正常・hold両経路で同じAfterGuardを使う。違反時のresetは既存guardが行い、E3単独で止まるときだけresetを追加する。reset自体が失敗した場合は既存REQ-137のGitError経路を保ち、その場合にE3の理由が残るとは約束しない。
- recorder、logs、log-policyは変更せず再利用する。短いパスは実runで確認し、長いパスはstartRecordingの直接試験で全OS同じ文字列条件を確認する。OS限定の新しいskipや実在できない長いrunDirは作らない。
- fixtureのprojectionは4章の閉じたliteral集合に限定し、derivedは全JSON型と分類・表示の合図を保持する。collectorとvalidatorはscriptsへ置き、このchangeのtasksに含める。元rawと個々の元値のhashは一律に保存しない。
- successの実caseはresultが文字列なら成立し、OK以外はderivedに置換する。error_max_turnsの実caseは元の合図と拒否の条件をメモリ内で確認する。syntheticやmetarecordは必須4枠を埋めない。

BのQ-B3にあるsettingsのメモリ内読取案と、Q-B4にある会話以外の書込みを既知の制約として許す案は、安全性の証明に代用しない。原raw・秘密の非永続化を確認できるまでは採集しない。必要な前提は未確認であり、2.1.307/2.1.308の実4件は未収集のままとする。製品D01〜D05はこの採集に依存しないので先行できるが、tasks4.2〜4.4、親DoDと最終受入を完了にしない。

既存REQ-109と早期停止時のguard省略、および分類前output保存失敗時のGit内部検査省略は、この変更で広げも縮めもしない。範囲外の差として管理役へ引き継ぎ、E3の受入済みと混同しない。


保存検査の実装はscripts/claude-result-fixture.mjsへ集約する。resultSignalsは存在・JSON型と分類/表示の合図だけを返す。createObservedResultFixtureは元rawをメモリ内で直接処理し、validateResultFixtureは各階層の追加欄とcross-field不整合を拒否する。matchesResultCaseはfixtureの形と終了/case条件を確認するだけであり、採集前提や元値の一致を証明しない。metarecordからinputを生成する経路は作らない。

保存するfieldsはtype/subtype/is_error/resultの4欄を持ち、各欄は{present:false}か{present:true,jsonType:<6種>}とする。cliはversion/nativeSha256だけ、exitはcode/signal/timedOut/stdoutLimitHitだけとする。これらを含め定義外の欄を保存しない。66件の合成回帰は保存許可と分類の対応を検査するための入力であり、CLIの実観測や実4枠の収集成立へ数えない。保存モジュールだけの成功で採集を起動せず、4章/5章の保護前提と実4件は別に受け入れる。


## 8. 公式CLI 2版の導入確認と、採集前に固定する手順

### 8.1 確認できた配布と版（task4.1）

この実機はlinux/arm64/glibcである。既存資料にあったlinux-x64の初回導入はEBADPLATFORMで失敗し、その原本を保持した。CPU/OSの偽装やforceは使わず、実機に合う公式linux-arm64を選び直した。

2.1.307と2.1.308をそれぞれ`.loomake/e3-cli/<version>-arm64/`の独立prefixへ、公式registry・固定版・ignore-scripts・omit=optionalで導入した。wrapperとnativeを明示して導入し、公開integrityとlockの一致を確認した。既存のglobal CLI、認証、settingsは変更していない。

両nativeの絶対パスからversion/helpだけを実行し、exit0・版一致・stderr0を確認した。print、output-format、tools、disallowedTools、no-session-persistenceは両版のhelpにある。max-turnsはhelpにないが、checksum確定の両native内のoption宣言と[公式CLI reference](https://code.claude.com/docs/en/cli-reference)を照合した。これは版適用の静的な根拠であり、max-turnsを付けた会話の成功や実caseの採集ではない。

| native版 | 実binaryのSHA-256 |
|---|---|
| 2.1.307 | 1c67968ab8410c9644e2f4867167a0dab1a8c6c9de9cc83fe78449e5ae8a3633 |
| 2.1.308 | fdd22e6cbb734d580f5664c48df4294eeec850218ff07f186f9af30426396ee1 |

元metadata、導入失敗/成功、integrity、binary checksum、helpの固定metadata、静的option宣言は専用treeの`.loomake/e3-cli/`へ保存した。help本文と認証情報は保存していない。

### 8.2 採集を起動する前の条件（task4.2）

次の条件をすべて確かめられるまで、会話promptを渡さない。現在は認証方式、hook/plugin/debug、会話記録を含む原raw/秘密の非永続化が未確認である。settingsのメモリ内読取や、会話外書込みを単に限界として記すことを安全性の証明へ代用しない。

- 保存先は専用worktree内のGit除外対象で、外向きsymlinkを含まないことを作成前に確認する。cwdはgit外の一時領域とし、機密でない固定のnote.txtだけを用意する。
- 既存subscription認証、設定源、hook、許可規則、保護、MCP設定を維持する。認証秘密ファイルの読取/コピーや、設定源を空にするflag、独自settings、権限緩和、bare/safe-modeは使わない。
- 既存hook/plugin/debug/CLI自身の会話記録が原rawや認証秘密を永続化しないことを確認する。必要な設定や挙動が不明なら、その版/caseを未収集として止める。保護を外して不足を埋めない。
- 必須flagと対象版の根拠、実binary checksum、保存先、stderr/stdoutの容量、期限、後述argvを起動前に照合する。不一致なら起動しない。

### 8.3 固定する呼出しと、メモリ内の変換（tasks4.3〜4.4）

shellを使わず、先頭は検証したnativeの絶対パスとし、引数を次へ固定する。promptはstdinで渡し、argvへ含めない。

```text
success:
-p --output-format json --tools Read --disallowedTools mcp__* --no-session-persistence
error_max_turns:
-p --output-format json --tools Read --disallowedTools mcp__* --no-session-persistence --max-turns 1
```

successの固定promptは次の文字列とする。

```text
Reply exactly OK. Do not access files or call tools.
```

error_max_turnsの固定promptは次の文字列とし、note.txtの本文は `Safe fixture note.` と末尾改行だけにする。

```text
Read note.txt in the current working directory and then report its contents.
```

Read拒否や違うsubtypeを目的caseの成功へ数えない。successでresultがOK以外の文字列なら、その値をderivedへ置換する。各版/caseの試行は2回までとし、全試行と不足を残す。

環境は継承し、子へDISABLE_AUTOUPDATER=1とCLAUDE_CODE_DISABLE_AUTO_MEMORY=1を足す。debug等の既存環境が非永続化と両立しない場合は、値を記録したり保護を無効化したりせず起動を止める。verbose/debug/resume/continueや独自のsettings/MCP構成は付けない。ReadだけでMCPが除外されたとは扱わず、mcp__*の追加拒否を保つ。

stdoutは1MiB、stderrは64KiB、期限は5分とする。端末への継承やrawの一時ファイルを作らず、メモリ内で容量と期限を管理する。例外messageやstderr本文は保存せず、固定の結果符号へ変換する。取得した元rawから直接createObservedResultFixtureへ渡し、元の存在/JSON型と分類/表示の合図の一致、および保存schemaを検査する。元値や元rawのhashは保存しない。確実なメモリ消去を約束しない。

実caseの判定には元のsubtype/is_error/resultと必要な拒否の有無をメモリ内だけで使う。終了0や保存schema合格だけを収集成立にしない。projection/derived以外、case不一致、拒否、unknown option、上限停止、保存/保護の不一致は未収集へ残す。metarecordからinputを生成して観測を名乗らず、syntheticは実4枠へ数えない。

最後に、保存を許可した最小fixtureと出所・版/case/試行の固定metadataだけを検査して残す。原rawを保存しないので、後から元値を再解析したり独立に一致確認したりはできない。この限界は実4件を免除しない。2.1.307/2.1.308×success/error_max_turnsの必須4枠は、現在0/4・未収集のままである。task4.1の導入/手順確認と、task4.2の保護前提の達成、4.3の実収集、親DoDを区別する。


## 9. 追加の採集制御設計と管理判断（2026-10-31）

公開済みhead6ece6adのPR #185と公式資料・固定booleanだけを渡し、独立Opus設計3203554f-62b1-4053-a61c-1fc49feb1706を新たに実行した。manifestはrole=design、要求/応答モデルともclaude-opus-5-5、ok=true、拒否0を示す。設定原文・認証・環境値・非公開rawを送っていない。この設計と管理役のADR0006判断は採集制御の手順を具体化するもので、実4件や最終レビューを代替しない。

| 判断 | 採用した手順と理由 | 保持する元選択肢・限界 |
|---|---|---|
| CD-1=A | 子の環境へCLAUDE_CODE_DISABLE_AUTO_MEMORY=1を追加する。公式の無効化手段と両版の静的分岐に従い、既存保護を削らずmemoryの経路を閉じる | B：DISABLE_AUTOUPDATERだけ、は採らない。他の環境は追加・削除しない |
| CD-2=A | nativeの既知の設定ローダーに対応する非認証settings JSONだけをメモリで読み、hook/plugin/env等の固定booleanと固定理由コードだけを返す限定readonly probeを認める | 旧E3-D06の読取禁止をこの技術手順に限り改訂する。B：全hook無効、C：通常利用と同程度だから許容、は採らない。credential/authファイルを読まず、設定値・原文・個人情報を含むパス・例外messageを保存しない。設定変更や「読めたので安全」という代用をしない |
| CD-3=A | managedが読み込まれないという版ごとの根拠と管理確認がそろうまでunknownとして拒否する | B：managedを保証範囲外にする、は採らない。ローカルファイル不在だけでサーバー側も不在とは扱わない |
| CD-4=A | 固定の診断用環境名・接頭辞について、set/nonemptyだけをメモリで判定し、設定envも限定probeの対象にする | B：子環境から削除、は採らない。値や動的な名前一覧を保存せず、存在だけで有効とも無効とも証明しない。不明は拒否する |
| CD-5=A | 公式資料と対象版のコードからCLI state/history/診断を含む非永続化を確認する。未証明なら拒否する | B：metadata保存なので許す、は採らない。no-session-persistenceだけで他の書込経路も安全とは扱わない |
| CD-6（任意） | 自己作成の一時cwdから導くprojects配下の対象1件だけをstatして、出現なら保護不一致を検出できる | 検出は予防の証明に数えない。任意の設定ディレクトリ探索は行わない |

### 9.1 probeとcollectorの拒否側実装

公開の公式宣言・版固定nativeのローダー根拠を補い、scriptsの独立probeとcollector、および合成回帰を実装する。実装の対象はtask4.2の採集前確認であり、4.2〜4.4の完了とは区別する。probeは深さ・容量を制限し、読取失敗・未知の設定源・追加構造は固定理由へ変換して拒否する。グローバル設定・auth・保護は変更しない。

起動前にP1 nativeのrealpath/checksum、P2 ignoredの保存先とsymlink、P3新しいgit外cwdと固定noteだけ、P4固定argv/prompt、P5許可2環境だけの差分、P6保護各booleanの実証拠と管理確認、P7版/caseあたり最大2試行を確認する。false/unknownが1件でもあればspawnは0にする。P6の自己申告booleanファイルを、安全性の証明や実4件の資格へ使わない。証拠が未確認のままtrueを書いて起動する経路を作らない。

stdoutはメモリ内1MiBまで、stderrは本文を保持せず64KiBまで数え、UTF-8不正・期限5分・中断・容量超過は固定理由で止める。必要なら子のprocess groupを終了し、5秒後に強制終了する。permission_denialsとcaseの元合図はメモリ内だけで確かめる。保存は既存schemaを満たす最小fixtureと固定metadataだけで、raw/秘密/hash/例外messageは保存しない。合成試験は拒否時spawn0、固定argv/環境差分、容量/期限、本文非漏出、UTF-8、非ゼロ/拒否/case不一致、試行上限を確認する。既存試験や品質設定を緩めない。

現在はmanaged・hook/plugin・診断・CLI stateの非永続化に未証明があり、実prompt0、実4件0/4である。collectorの拒否回帰が成功しても、採集前提達成や実観測の成立へ読み替えない。

### 9.2 完了ゲートと最終受入の順序

共通の独立Opus設計92ea61a2と既存archiveの手順を管理役が確認し、E3の旧5.3だけをtasks.md「完了ゲート後の必須受入」へ移す計画整合を採用した。この移動時点では元の番号・本文・担当・条件を保持した。2026-10-31の規約改訂に合わせ、現在の受入条件は次段落へ更新する。5.2自身と未完了4.2〜4.4/5.1はcheckboxのまま残す。旧18意図は17tasksと必須受入1に対応し、現時点は12/17、受入1未達である。共通設計の別change向け件数16をE3へ転記しない。

利用者が本会話で採用した[改訂ADR0006](https://github.com/loomake/loomake/blob/c4fe90150eb7e32559f8ab41a0df5edce72591d8/docs/adr/0006-standing-approval-for-autonomous-delivery.md)により、L3の必須CI・変更runnerの3OS試験・完了ゲートと、設計/実装とは別の独立Opusレビューで重大な指摘ゼロ（最大2往復）を受入条件とする。Codexは参考記録へ変更する。reviewed-headとheadが異なる場合は、指摘修正だけの差分かを管理役が判定し、ADRの回数規則とともにPR末尾の1証跡ブロックへ記録する。旧5.3の全指摘ゼロ/Codex必須という文言と旧レビュー履歴は、この変更前のcommitに保持する。実4件・tasks・doneと製品の完成範囲は変えず、未実施をチェックして通さない。


### 9.3 確認した資料と拒否実装の到達点

[server-managed settings](https://code.claude.com/docs/en/server-managed-settings)はサーバーからの配布だけでなく起動時cacheの経路も説明する。[monitoring](https://code.claude.com/docs/en/monitoring-usage)は原API本文を含むtelemetryとファイル出力の選択肢を説明する。[data usage](https://code.claude.com/docs/en/data-usage)はデータフローの資料であり、対象2版の全ローカルstate/history/debug経路の非永続化を証明しない。現在の公式資料を対象版の完全な動作保証へ置き換えない。

checksum確定native2版の公開nK/K_n/FT関数から、userのconfigDir/settings.jsonとproject/localの.claude/settings.json・settings.local.jsonという3経路を確認した。probeはこの非認証JSONだけを容量1MiB・深さ32・node数4096までメモリで読み、symlink・ファイル型・inode不一致・不正UTF-8/JSONを固定理由へ変換する。parent/flag/managed/plugin由来の他経路を調べ終えたとは扱わない。credential/authファイルを開く入口や、任意filenameを受ける入口は作っていない。

実readonly probeではuser settings読取成功、hook/plugin/envの各設定false、未知欄あり、診断環境set/nonempty=trueとなった。自己作成cwdのproject/local JSONは不在だったが、git非ゼロだけではgit外を証明しないため、その判定は未証明として残した。出力は固定boolean/状態/理由だけで、設定値・原文・環境値・動的名前一覧・個人情報を含むパスは保存しない。

scripts/claude-result-preflight.mjsは限定probeと拒否判断、claude-result-collector.mjsは固定argv/prompt/環境計画と合成processのメモリ内検査を実装した。CLI実起動・採集資格の証拠adapter・fixture永続化・版/case間の試行履歴はまだ実装/受入していない。実起動口を設けず、設定が空でも自己申告booleanでも拒否する。合成processのcase一致もcollected=falseを返し、実観測へ数えない。102件の合成/fixture回帰はこの範囲の検査であり、4.2達成の証拠ではない。


### 9.4 実起動へつなぐ前に必要な境界

管理役のコード確認では、inspectResultProcessは既に作られた子のPIDへSIGTERM/SIGKILLを送り、owned process treeの終了・回収をまだ実装していない。将来の実起動では既存のowned tree cleanup設計を適用し、子孫を残さないことを確かめる。stdout/stderrのstream errorを秘密を含まない固定理由へ変換する処理と、closeが来ない場合にも終了する処理も未実装/未受入である。現在の合成試験の成功をこれらの証明に使わない。

固定planのvalidatorと保存schemaはあるが、実際のbinary realpath/hash・実行したargv/prompt/環境・観測metadataを信頼できる同じ経路へ拘束する資格adapterはまだない。呼出側が渡したhashやbooleanだけでprovenanceを認めず、合成processのcase一致も実観測へ数えない。新しいsandboxや資格adapterを推測で追加せず、追加設計と管理確認の後に実起動の接続を判断する。

両版の公開nativeを再hashし、no-session-persistenceがprint条件検査からsessionPersistenceDisabledを設定して主要transcript writerのskipへ届くことを静的に確認した。一方、別historyクラスのadd入口はskip-history環境と入れ子条件を見ており、同flagの直接guardはない。printから全callerへ到達しないという証明はまだないため、必ず書くとも安全とも判断しない。新しい環境変数を追加して解消した扱いにはしない。

managedの適格判定にはteam/enterpriseだけでなくprofile・machine pin・gateway・key等の経路とcache読取があるため、subscription種別だけでmanaged不在としない。これらの公開分岐と公式資料を根拠として、保存経路に残る確認事項を限定した。3pathのreadonly probeをparent/managed/flag/pluginのcoverage証明へ使わず、実CLI起動0・実4件0/4を維持する。


### 9.5 追加制御設計6c4bd8c7の採否（2026-10-31）

head9cc0abcの全8 Requirement・41 Scenario、関連契約・コード全文と旧3203554fを保持して追加設計を新たに実行した。要求/実応答はclaude-opus-5-5、role=design、ok=true、拒否0で、回答138行全文を管理役が確認した。kernel本文はモデルへ未提供で管理要約に基づくという不足を保持し、設計の同意だけでOS強制や採集資格を認めない。

| 判断 | 元の選択肢・おすすめ | 管理役の採否と理由 |
|---|---|---|
| QD-1 | A：C launcher／B：Python ctypes／C：第三者ツール／D：導入なし。Aを候補として調査 | Aは調査候補だけ。新sandbox・C launcherの実装/適用は未採用。B1〜B4を解けず、技術可能性を資格にしない |
| QD-2 | A：hook/pluginが空なら制限下の結果をgenuineへ数える／B：数えない。A推奨 | 未採用。空というだけでgenuineとせず、従前P6と全証拠を維持。保護と非保存を実際に確認できる条件が正で、hook/pluginが必ず空という一般条件は追加しない |
| QD-3 | A：seccompでAF_UNIX拒否を調査／B：ABI9待ち／C：拒否維持。Aを調査し不成立ならC | 追加制御候補の調査だけ。seccomp実装/適用は未採用 |
| QD-4 | A：固定boolで未証明なら拒否／B：host audit/eBPF/swap等を保証外とする。モデルは一部Bを推奨 | 新しい無限の証明義務は追加しない。既承認のJSメモリ消去を保証しない限界とcollector/CLI/子孫の原raw非保存を保持する。ホスト外の仮想的観測まで閉じたとは主張しない。実在する診断B1等の未証明は残す |
| QD-5 | A：純粋試験は全OS、syscall調査は手動記録／B：Linux限定の新skip。A推奨 | A採用。新skipや品質設定の緩和はしない。OS制御の採用を意味しない |
| QD-6 | A：固定診断名をstderr-only/file-or-network/unknownへ分類／B：存在で拒否。B維持でA検討 | B維持。Aは対象2版の公開nativeの厳密な根拠を準備する段階のみ。実環境値は読まない |

追加設計6章のP1/P2/P3だけを今回の実装へ採用する。P1は固定版nativeのpath/type/symlink/hashをread-onlyで確認し、P2はignored内のcontainmentを検査する。P3は自己所有の一時cwd、O_EXCL/0600の固定note、祖先の.git不在とGIT環境の不在、git自身が非repoと判定した根拠を確認し、finallyで自己領域を片付ける。失敗は固定理由へ変換する。どれも資格adapterや実起動へつながず、P6の拒否・実0/4・task4.2未完了を保つ。

atomic renameだけの保存は既存fixtureを上書きできるため、永続化/試行台帳は未採用とする。REQのnooverwriteと全試行保持に結ぶ具体手順が別に必要である。process tree/stream終結も既存部品の利用境界を具体化してから扱う。今回のvalidatorsでこれらの未受入や5.3を完了にしない。既存36/66/45件とmutation期待値を変えず、新しい合成否定試験だけを追加する。


### 9.6 先行するP1/P2/P3の到達点

scripts/claude-result-paths.mjsへread-only validatorとowned cwd管理を追加する。P1の実入口はversionから公式prefixと既存の固定SHAを導き、別pinを受けない。低水準のfile検査は合成試験用にも使うが、その戻り値を実観測の資格へ使わない。path/type/symlinkを確認して同じopenのFDを逐次hashし、途中のfile変更や不一致は固定理由で拒否する。execするFDとの拘束は未実装のままである。

P2は実pathの境界とgit check-ignoreをread-onlyで調べ、保存先を作らない。成功しても、その後のopenとの原子性や資格を証明しない。P3は自己作成cwdへO_EXCL/0600で固定noteだけを書き、祖先.git/GIT環境の存在を拒否する。gitの明示的な非repo結果も照合し、単なる非ゼロやbare repoをgit外としない。callbackの例外messageを捨て、成功/失敗後に自己cwdをfinallyで削除する。CLI呼出しや資格adapterへは接続しない。

追加24件の合成試験はnativeの偽pin/path/type/symlink、保存先の境界/除外/祖先file、git内/bare/GIT環境/実行不能、noteと成功/失敗時のcleanupを確認する。既存36/66/45件とmutation期待値は保持する。実4件0/4、P6拒否、4.2未チェック、永続化/試行台帳・process tree/stream終結の未受入を維持する。


### 9.7 lifecycle driverの採否（2026-10-31）

独立Opus設計dbfb3588-5554-4865-8ec4-869177f3514fはhead87957d3、role=design、要求/実応答claude-opus-5-5、ok=true、拒否0だった。158行全文と既存契約を管理役が確認し、次をADR0006で採用した。66/45件の個別ファイルはモデルに特定材料不足と明記されており、その全体をレビュー済みとは数えない。

| 判断 | 元の選択肢 | 採否と理由 |
|---|---|---|
| LC-1 | A：spawn/group/clock/timer/signalの必須注入／B：private TS/dist直接import／C：runner公開export追加 | A採用。実factory/OS adapterの既定値を作らず、runner本体・公開index・build順を変えない |
| LC-2 | close猶予500/1000/5000ms | 1000ms採用。TERM猶予5000ms・group待機1000msと合わせ、最初のstop/exitから最大7000msで終結する |
| LC-3 | HUPを扱う／扱わない | 扱う。SIGINT/SIGTERMと同じ中断へそろえ、偽emitterだけで検証する |
| LC-4 | 純粋projection抽出／複製／proxy child | projectResultTransport抽出。既存36件を変更せず、元の分類/fixture判定を一か所に保ち、listener/timerの二重化を避ける |
| LC-5 | Windows tree adapter追加／factory0で拒否 | win32はfactory0で拒否。実OS/Windows/別sessionの保証を新たに作らない |
| LC-6 | close codeをexitへ代用／exit-unobserved | 後者採用。exitを作り出さず、exit/close不一致も固定exit-close-mismatchで拒否する |

scripts/claude-result-lifecycle.mjsのdriveResultProcessは全依存を必須とし、呼出元は合成試験だけとする。shell=false・detached=true・3pipeの凍結optionsを注入factoryへ渡し、正の安全なPID（1と自分のPID以外）だけをowned pgidとして記録する。factory前の中断は起動0。起動後は元exit/closeと、timeout/abort/上限のflags、最初のprimary、transport、cleanupを分け、後処理で元の結果を書き換えない。実owned groupと同一PID/別session/Windows通常終了の保証は未受入である。

stdoutは1MiBのメモリだけ、stderrは64KiBのbyte数だけとし、3stream/child errorを固定理由へ変換する。実行期限5分は単調時計で再確認し、stop/exitの後はTERM→5秒後KILL→group最大1秒→close最大1秒で終結する。signal/waitのthrow・reject・false・never-resolveもdriver自身で有界にし、wait trueが遅れて届いてもnow<deadlineを再確認して期限後は採らない。cleanupの完了や失敗をtimeoutへ代用しない。

settleは一度だけとし、timer/親signal/abort/data listenerを回収しowned pipeをdestroyする。遅いerrorはmessageを捨てるsinkで吸収する。primaryなし・cleanup確認済み・transport closed・exit観測済み・exit/close一致の場合だけ、純粋projectResultTransportへ渡す。戻り値はcollected=falseで、原raw・stderr・例外message・PID一覧を保存しない。同期依存が任意にhostをブロックする場合までの保証は追加しない。

[Node22.12の一次資料](https://nodejs.org/download/release/v22.12.0/docs/api/child_process.html#event-close)では、exit時のstdio未closeと、spawn失敗のerror後close、error後exitの未保証が説明されている。元データの分類とtransport完了を分離する根拠であり、実OSの停止保証や採集資格へ置き換えない。P6拒否・実0/4・4.2未チェック、実adapter/資格adapter/CLI入口/永続化台帳の未採用を維持する。


lifecycleの先行実装は全依存fakeの48試験で、依存欠落/中断済み/不正PID/不完全pipe、元code/flags、group停止と期限、stream error、close未到達/不一致、UTF-8、marker非漏出とlistener/timer/pipe回収を確認する。判定後半だけをprojectResultTransportへ抽出し、旧inspectResultProcessのcaptureと既存36件は保持する。旧captureが実OS接続に適格になったとは扱わず、新driverもcollectorの実行入口へ接続しない。


## 10. 1200file guard回帰の修理設計（2026-10-31）

### 10.1 独立設計と管理役の採用方向

独立設計ecb3f21c-c1f6-44af-994f-ff17fd46be9eはhead0b8aを対象とし、実モデル/回答モデルclaude-opus-5-5、ok=true・deny=0を管理役が確認した。モデルはsources.md本文の未読を明記しており、全Requirement/Scenarioを読了したレビューとは扱わない。これは設計であり最終受入ではない。

| 項目 | 旧案を含む選択肢と理由 | 現在の管理判断 |
|---|---|---|
| G-Q1 | 内容diffのliteral pathspec／従来glob。file間の行混入を防ぐ | literalの方向採用 |
| G-Q2 | no-color/no-ext-diff/submodule short/a-b prefix/no-renames固定／従来設定。区切り照合を安定させる | 内容diffの固定方向採用。algorithm/textconvは現行維持 |
| G-Q3 | output超過だけ二分再取得／群単位で停止 | 前者の方向採用。singleton超過は従来同様output停止 |
| G-Q4 | 旧optionの表示を群で連結／literalだけ／literal・固定形式とfile境界選別／単一呼出維持 | H-Q1=B'を採用。literalだけでもdir子削除が付くため境界選別を行う |
| G-Q5 | timeout/中断で再取得しない／二分する | 再取得しない方向採用。30秒/共有期限は延長しない |
| G-Q6 | 差分specなし／run-guards差分を追加 | 同じ要求振舞いを保てる範囲でのみ前者。表示/予算に実質変更が残れば仕様案へ戻す |
| G-Q7 | 8192／16384／payloadごとの算定 | multi-file群はJSON.stringify(path).length+1合計8192。single-overは単独群で旧失敗境界を保持し、全argvが常に8192以下とは主張しない |
| R-3 | stdoutだけ累計（元おすすめ）／stdout+stderr累計 | 前者は旧1操作合計64MiBと両立せず不採用。H-Q2=Aの返却stdout+stderr UTF8 byte数を累計する |

### 10.2 追補採用と内部API

内容diffはstatus順の連続群で取得し、完全一致かC quote復号でfileへ照合する。Tは2区切り、A/Mは1区切りを要求し、未知/欠落/余分な区切りはGitErrorとしてREQ137の既存経路へ返す。D配下の扱いは型とdir置換の実出力に一致させる。既存guard判定の本文とfindings挿入順は変えず、別fileの追加/削除行を対応させない。群は使用後に破棄する。

追補08fff24d-3e4d-4a76-af24-74050eb6187dを管理役が全文確認し、実モデル/回答モデルclaude-opus-5-5、ok=true・deny=0を確認した。H-Q1=B'（literal・固定形式・file境界選別）、H-Q2=A（返却stdout+stderr bytes）、H-Q3=A（no-renames）、H-Q4=A（固定形式）を採用した。回答者は利用者のADR0006包括承認、採用者は管理役、2026-10-31である。

git.tsに非index-exportのgitMeasured(root,env,args,options?:{maxBuffer?:number}):{stdout:string,bytes:number}を置き、既存git()は同関数のstdoutを返す。env/共有期限/GitError/対話案内は共用する。bytesは成功時に返ったstdoutとstderr両方のUTF-8 byte数を合計し、wire元byte数とは呼ばない。表示はfilter前のraw全群を課金し、次呼出にroom=64MiB-usedを渡す。room<=0は起動せずProcessLimitError outputにし、UsageErrorへ変えない。表示はoutput/timeout/interruptedの再取得をしない。内容はoutputだけ二分し、singletonは同じoutputで止める。

管理補正として「不正UTF8の置換は旧より常に厳しい」という追補元の説明は採用しない。runtimeのutf8PrefixはStringDecoder.writeの末尾不完全文字を最大3byte保持し得るため、表示の返却bytesがroomとの差3byte以内ならroomへ安全側に課金する。課金はBuffer/StringDecoderの境界合成試験で検証する。kit/監視役のprotocolは変えない。

追加の管理補正として、完結hunkのprefixでも後続hunkの切断を一般には区別できないため、gitMeasuredへhasReplacementCharacterを返却text中のU+FFFD有無だけのbooleanとして追加する。invalid UTF8だったという断定には使わない。batch consumerだけがbytes>=room-3かつflagで「上限近傍で差分の完全性を確認できない」としてoutput停止し、内容はoutput限定の二分/単独停止、表示は非再取得とする。正規U+FFFDでも境界近傍では停止する制約を明示する。ASCII/通常UTF8の完全な最終群はexact境界で成功でき、U+FFFDも十分な余裕があれば通す。極小roomでreplacement全落ちのstdoutは区切り/完全性検査で拒否し、stderr側の未知tailはroom飽和で後群を拒否する。既存git()の他callerへ新しい拒否は広げない。


パッチは末尾newlineと全hunkのold/new行数、context/add/deleteによる消費、hunk/次headerへの遷移を検証し、未知/不完全ならGitErrorで止める。header数だけを根拠に途中で切れたパッチを成功へ補わない。型/空file/mode/binary等は実Git fixtureで必要な完結形式を確かめる。

表示もno-renames/no-color/no-ext-diff/submodule short/a-b prefixを固定し、literalの取得後にstatusで照合する。群外は既知のdescendantだけを捨て、それ以外はGitError。内容側で捨てられるdescendantはDだけ、表示側はstatusにあるもの。捨てる部分も先に予算へ計上する。旧表示とのbyte一致は既定設定・非rename・混入なしの場合に限り、renameは削除と追加へ固定し、色/prefix/extdiff設定の反映はなくなることを明示する。GIT_GLOB_PATHSPECS/GIT_ICASE_PATHSPECS等の競合はenvを改変せず既存GitError経路へ返す。

### 10.3 owned Git実出力と群数計算

Linux Git2.56のowned小fixtureでT(file→symlink)は同一file2headerと確認した。file→dirはD親/A子、dir→fileはA親/D子で、literal親pathspecも子のdiffを含む。quotePath true/false・color.diff=always・noprefix/mnemonicPrefixの下でも採用内容optionはANSIなしa/b prefixとなった。glob名は従来表示だと別fileも含み、literalで除けるが、eslint.config.js旧dir→同名通常fileの子削除はliteralだけでは除けなかった。これは自作Git出力の実測で、Mac/Windowsの実出力証明ではない。

元1200pathをGit字句順に並べた純粋計算は総weight98,490、各80〜83、8192基準で13群。二分やpackage showなしの理論呼出はadd/status+内容13+表示13=28であり、元案の約24回を採用しない。ceil(total/cap)は一般上限でない（cap10・6/6/6は3群）。一般には隣接2群のweight合計がcap超からmin(file数,ceil(2W/cap))を独立上限にできる。oversizeなしなら満杯群used>=cap-maxWeight+1からceil(total/(cap-maxWeight+1))も独立上限にできる。今回の値は13で一致した。修理後の起動回数/argv/所要時間は未実測で、G3を成功扱いにしない。

### 10.4 タスクと検証の維持

task2.5/3.5を追加し、旧17行と状態は保持する。2.5の実装とローカル新旧回帰の成功により13済/6未となり、3.5の実3OSと必須受入5.3は未達である。既存8差分Requirement/41Scenario、全期待値、1200file/60秒/品質設定は変更しない。新試験は群内/群間の偽対応、quote/pathspec、T/dir置換、未知区切り、stderrを含む予算、output限定再取得、timeout/中断の非再取得を意味ある否定条件で検証する。要求された検出・停止・対象file表示・予算境界は既存REQの範囲で維持するため差分specは追加しない。strict/spec-only成功の後にtasks順で実装する。実4件0/4・P6拒否・4.2〜5.2/最終受入未完了は維持する。

内容の二分取得はgeneratorで次の成功群だけを保持する。各操作30秒は群単位のままで、全表示群が旧1操作30秒以内という保証は追加しない。runの共有期限は全群へ引き継ぐ。


### 10.5 constant textconvのM0境界（実観測による補正）

owned Git2.56でraw blobはMだが旧新textconvが同じ固定文字列の場合、旧per-file/content固定/display固定すべて正常終了・0headerとなると確認した。管理役はこの事実に基づき、モデルのM=1固定という仮定を訂正し、非曖昧なbatchOutput成功からのconsumerだけM0を許す案を採用した（利用者ADR0006包括承認、2026-10-31）。byPathにM0の空entryを置いて群消費順を保ち、旧同様の空linesへ戻す。parser単体は既定strictのまま、A/D/T・未知header・不完全hunkを緩めない。room<=3かつ空stdoutはreplacement全落ちと区別できないためoutput拒否する。これらの拒否理由は「上限近傍で差分の完全性を確認できない」とし、wire超過を観測したとは書かない。旧設定を保つ修正として、新Req/specは追加しない。


### 10.6 status一覧の終端・ペア・復号後重複

管理役の最終diff確認に基づき、codes Map構築前にname-statusのNUL終端とペア完全性、空code/path、復号後の重複pathを検証する（REQ137・REQ138）。欠損や同名上書きはGitErrorで閉じ、空statusだけは正規の変更なしとして許可する。Tのstatusは単独項目のまま、内容patchのT=2区切りとは区別する。新しいmissing-terminal/duplicate-decoded-path等の否定試験と既存guard55件・型lint/spec-onlyで確認し、通常full1813成功はこの小補正前の結果として保持する。最終source全体は次の実CIで確認する。
