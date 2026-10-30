# Design: validate-engine-json-result

## Context and scope

基準はmain `085a82686dc1c14506fbdbad88b5b9b3961f522e`。品質E3の旧treeと設計head5cを保持し、同じchange-idの正式起案だけを新treeへ移した。Opus b95d2ffbの8 Requirement・41 Scenarioと、管理役のQ1〜Q11・監査残5点を採用元とする。予約済みのREQ-340/341だけを使う。C001/S1のv2/local/ciは未採用なので、現行verify --doneと既存runnerの正常経路を維持する。

製品実装、実CLI採集、install、Opus起動、PR/pushはこの起案では行わない。修正版の独立設計確認はtasks1.3へ残す。仕様ゲートの成功も製品の完了や実観測の成功を意味しない。

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

採集時の元raw、認証秘密、stderr本文、例外message、個々の元値のhashは永続化しない。元raw全体のhashも既定では保存しない。session_idがあるから安全という普遍的な仮定は置かない。fixture自身のhashは保存物の整合確認に使えるが、元rawの一致・再解析・独立再現の証明には使わない。

| provenance | 入力の作り方 | 保存/試験上の区別 |
|---|---|---|
| observed-projection | 元の最上位objectにある既知4欄だけを、presence/value/JSON型を一切変えずに写す。下表の許可値だけ | 実観測の4欄投影。欠けた欄を補わない |
| derived | 採集時に元rawから直接、同じJSON型の固定値へ置換する。fieldと元の型をsubstitutionsに残す | 観測由来の値置換。metarecordから作らない |
| observed-metarecord | 値を持たず、parse/topLevelと4欄の存在/型だけ | 分類試験のinputに使わない |
| synthetic | 試験表やmetarecordを見て新生成した入力 | 合成。実観測・derivedを名乗らない |

最上位number/nullを4欄投影とは呼ばない。object以外は値を含まないmetarecordと、必要な別syntheticで扱う。実CLIの期待したcaseに該当しなければ未収集として残す。

| 欄 | projectionに保存できる値 | それ以外をderivedへ置換する場合 |
|---|---|---|
| type | `^[a-z_]{1,32}$`の文字列 | 同じJSON型を保つ固定値。型不正を文字列へ直さない |
| subtype | `^[a-z0-9_]{1,70}$`の文字列 | 文字列はerror_開始の有無と表示可否を保つ。表示不可のerror系には固定のerror_X等を使い、表示可能へ直さない |
| is_error | true/false/null/安全な整数 | booleanはその値を保つ。他の型は同型の固定値で、failure/shapeをnormalへ変えない |
| result | 文字列OKとnullだけ | 許可外string→文字列の固定置き値、number→0、object→空object、array→空array。欠落は欠落のまま |

result:42はderivedのresult:0、result:nullはprojectionのnullである。resultの任意の数値・文・object・arrayをprojectionへ保存しない。元がobjectのinputには既知4欄以外を足さず、未知欄は保存しない。元の型を保つだけで分類の全合図を維持できるとは仮定せず、error_開始・is_error・表示可否を含む直接試験を用意する。

保存schemaの構成は次のとおりとし、表・例・schemaのいずれかだけを別の許可集合にしない。これはcollector/fixtureの設計であり、実装済みschemaではない。

| 分岐 | 必須 | 禁止/整合検査 |
|---|---|---|
| 全record | schemaVersion=1、provenance。定義したkeyだけを許可 | additionalProperties=false。raw/body/privateRawSha256/個々の元値hashを認めない |
| projection | input=object、fieldsのpresence/jsonType | inputのkeyはtype/subtype/is_error/resultだけ。上表のprojection許可値と一致。欠落・型をfieldsと比較 |
| derived | input=object、fields、substitutions | 上表の同型固定値だけ。置換fieldと元の型、input型が一致。保持すべき合図を変えない |
| metarecord | parse/topLevelとfields | input/substitutions/値を持たない |
| synthetic | 合成である出所、input | 観測caseの成立へ数えない。観測版/実行を自己申告で付与しない |
| 実観測record | cli.version=2.1.307または2.1.308、native binaryのsha256、case、attempt、終了/上限の固定metadata | stderrはbytesだけ。秘密や本文を加えない。unknown key/許可値外は保存前に拒否 |

同型の固定値はnull/true/false/0/空array/空object、文字列の固定置き値と、分類に必要な固定error合図に限定する。任意のraw値へ広げない。fieldsはpresence=false、またはpresence=trueとJSON型だけとし、元値を持たない。長さなど採集に不要なmetadataを追加しない。上の表のcross-field整合も保存前に検査し、単なるJSON型合格だけで保存可能とはしない。

形だけを示す合成例は次のとおり。実観測のversion/hashを捏造していない。

```json
{"schemaVersion":1,"provenance":"synthetic","input":{"type":"result","subtype":"success","is_error":false,"result":"OK"}}
```

CIで確認できるのは保存物自身の型・出所と整合までである。原rawを保存しないため、後から元値を分類し直したり、CIで元値との一致を独立確認したりはできない。この限界をfixtureと採集manifestに明記し、実観測の証明をsyntheticへ差し替えない。

## 5. 実CLI 2版×2caseの採集前提

必須は2.1.307/2.1.308 × success/error_max_turnsの実4件のまま。公式package/integrityを確認し、版別の独立prefixへignore-scriptsで導入し、nativeを絶対パスで直接呼ぶ。実行名・版/checksum・helpはその版で確かめる。今回は実導入も採集もしない。

実採集の前提は、保存先が専用worktree内で除外対象かつ外向きsymlinkなし、cwdが一時領域のgit外であること、必要なflagと公式reference、debug出力の抑止が既存設定を変えずに成立すること、既存subscription認証、hook/会話記録を含め原raw/認証秘密の永続化を避けられること、である。認証値や秘密ファイルを読んで整える工程は作らない。

Q5はunknown/non-subscriptionなら未収集・Issueであり、管理役回答待ちのまま他作業まで止めない。Q9/Q10は不明でも無害promptだから採集する旧推奨を採用しない。no-session-persistenceが使えない場合や既存hookの永続化を避けられない場合も、保護を外さず未収集にする。必須4件のtaskは残す。

起動はshellなし・promptはstdin、stdoutは1MiB・stderrは64KiB・上限5分を前提とし、生の出力を端末/ファイル/ログへ継承しない。環境は既存を保ち、採集の子にDISABLE_AUTOUPDATER=1だけを足す。ReadだけでMCPを除いたとは主張せず、公式disallowedToolsのmcp__*を追加拒否する。既存設定源、hook、保護、MCP設定を無効にしない。MCPサーバー接続の有無は推測せず、不明なら不明と記録する。原raw/秘密の非永続化を確認できなければ未収集とする。

argvの必要flagを対象版のhelpで確認する。max-turnsがhelpにない版は、その版へ適用できる公式referenceを保存できる場合だけ試し、unknown optionは未収集にする。設定sourceの無効化、bare、safe-mode、permission緩和、独自settings/MCP構成、debug/verbose/resume等を付けない。error_max_turnsは無害なnoteをReadした後の固定promptで確認し、Read拒否や別subtypeを成功へ数えない。同じ条件の試行は元案の2回までとし、全試行と不足を残す。

保存はrawからメモリ内で最小化して行う。stderr/例外messageは本文もhashも残さず、固定の結果符号だけを使う。rawを一度書いてから消す方式は使わない。JSのメモリを確実に消去できるとは主張しない。設定の許可された整合metadataを比較して変化があれば無効とし、不足をIssue/taskへ残す。

## 6. 検証と引継ぎ

strict/spec-onlyと正式IDの500 UTF-16本文再測定、既存Source/Scenario比較はこの起案で行う。次は管理役が修正版の独立Opus設計を確認し、製品実装と回帰、実4case、done、同headの必須CI・自動Codex・独立最終レビューへ進む。どこかが未実施/未収集なら全体を完了にしない。

旧source340/341の仮名を正式IDへ置換しただけの長さ測定や、旧5cのgate成功を流用しない。C001が先に採用された場合は、最新mainへ統合して仕様・全Scenario・採集/回帰前提を再照合する。個別の停止で他の独立作業を止めないが、未達の受入を短縮して済ませることもしない。
