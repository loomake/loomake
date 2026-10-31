# Design: validate-engine-json-result

## Context and scope

目的はproposal、約束の正本は2差分spec。REQ-340/341、8 Requirement・41 Scenario・Sourceと正常経路を保持する。Source204の別契約/330の二見出しを混同せず、REQ-100追加Scenarioはa1原文、C001/S1のv2/local/ciは推測で混ぜず、先行採用時はmain統合後に全契約/Scenario/前提を再照合する。

統合ブランチのS1はIssue #243に従い、main `248c89b6` から文書だけを移した。19 taskのうち4済（1.1〜1.3、4.1）・15未であり、製品コード・対応試験・実4件はまだ統合していない。4.1は元ブランチで確認済みの導入・公開根拠を引き継ぐ印で、採集資格や実観測の証明ではない。実装・試験・完了ゲート・独立最終受入は後段へ残す。以下の13済/6未は元ブランチ `d822e540` の履歴として保つ。旧実装・試験を確定形で記した箇所もd822e540の履歴であり、この統合ブランチへの実装・試験の受入証明ではない。

19taskは13済/6未（3.5、4.2〜4.4、5.1/5.2）、実4件0/4、P6拒否、done/最終受入未達。先行PRも親完成に数えない。圧縮だけで新設計/資格/許可/fixture投影literal追加なし。[元design][history-design]・[元trace][history-trace]（過去worklogは当該記録の固定参照）へ全詳細/旧判断/失敗記録を残し、trace全元表行と以下の現在条件を保持する。

## 1. 分類と停止の責務

分類/安全な理由/AfterGuardはdecision-policy.tsの純粋関数。出力保存後、runClaudeの元標準出力をメモリで分類し、秘密置換後の値を使わない。engine.tsのraw/text契約・公開index・既存置換/予算を保ち、下流は構造化fault/outputPathと質問判定等の明示欄だけ。rawを公開戻り値/summary/停止理由へ足さない。

| 順 | 条件 | 分類 |
|---|---|---|
| 1 | JSON不正、最上位object以外（null/array含む） | shape |
| 2 | is_error===true、またはstring subtypeがerror_開始 | failure。型異常より先 |
| 3 | 存在するtype/subtypeが非string、存在するis_errorが非boolean、result欠落/非string | shape |
| 4 | その他 | normal。未知欄/未知string/空resultも許可 |

object確認前に失敗欄だけを読まない。subtype表示はerror_後の`[a-z0-9_]{1,64}`、全体最大70字だけ。理由へ渡すのは分類・許可subtype・当該NN-output.json具体パスで、result/未知欄/本文を混ぜない。

先行停止は中断→出力上限→時間上限→質問→非ゼロ/不明終了コード。HEAD/branch変更はGit内部変更より優先し、変更理由を終了/結果異常より先に置き中断状態を保つ。先行停止へE3理由を足さず、結果異常だけならhold。

hold後もtask/repair共通で既存guardと削除/差分/承認案内を行う。AfterGuardは異常か違反で停止、重なれば結果異常→guard理由。違反resetは既存guard、E3単独時だけ追加resetでindexを外し作業を残す。reset失敗はREQ-137のGitErrorで、E3理由の残存は保証しない。

異常時はタスク/ゲートを完了にせず、commit/NoChange完了/直しの再gate/後続engineへ進まない。正常時のtask commit/NoChange/完了ゲートと直しを保持。既存早期停止時guard省略と分類前output保存失敗時のGit内部検査省略は範囲を変えず、E3受入済みにしない。

## 2. 理由と保存失敗の段階

recorder/logs/log-policyは不変。通常summary/表示は具体パス全体、guard詳細は従来表示へ残す。

- 分類利用前のoutput保存失敗は従来I/O停止。分類済み/E3理由の証跡を補わない。
- 分類後summary/stop保存失敗はREQ-179 fallback、保存不能/確認先の表示と終了1、短い理由の先頭に結果異常。
- summary予約量超過のstopは2048 UTF-16以内。短path全体、長pathは先頭種別/長さだけで、無限長完全表示/予算拡張は約束しない。

未保存を保存済みにせず、元出力は既存秘密置換・理由は秘密目印なし。短pathは実run、長pathは全OS同文字列のstartRecording直接試験。新skip/実在不能runDirは作らない。

## 3. 既存Scenarioと回帰

元main20 Scenarioは承認済policy204正常条件の結果異常追加以外不変。8本文/41 Scenario/Source・既存45/36/66件/mutation期待値を保持。仮ID/旧gateの合格流用は禁止。

失敗優先/AfterGuard順の反転コピーをassertion失敗で検出し、timeout/import失敗を成功にしない。task/repair、変更/NoChange/違反、先行停止、元raw/置換後、短長path/I/O段階を回帰する。fake engineは正常JSONへ必要な追従だけ行い、元assert/品質設定/1200file/60秒を緩めない。他change/合成/Gitfixtureを実4件/実停止等の代替へ数えない。

## 4. 観測入力の出所と保存許可

採集時の原raw/認証秘密、stderr・例外の本文/hash、元値/原raw全体hashは永続化禁止。一度書いて削除する方式、session_idで安全という仮定を置かず、JSメモリ消去も保証しない。fixture自身hashは保存物整合だけで、元raw一致/再解析/独立再現の証明にしない。

全recordはschemaVersion=1・provenance・定義keyだけ、全階層additionalProperties=false。raw/body/privateRawSha256等も拒否する。

| provenance | 入力とschemaの条件 |
|---|---|
| observed-projection | 元最上位objectの既知4欄をpresence/value/JSON型不変で投影。inputは4key/下表だけ、fieldsと欠落/型を照合 |
| derived | 元rawから直接同型固定値へ。object input/fields/substitutions必須。置換field/元型/input型/合図を照合し、metarecordから作らない |
| observed-metarecord | parse/topLevel/fieldsだけ。元値/input/substitutions禁止、分類inputへ使わない |
| synthetic | 新生成した合成出所/input。観測版/実行の自己申告・実観測/derivedの詐称・実4枠算入禁止 |

最上位number/null等は値なしmetarecordと必要な別syntheticで扱う。元objectへ未知欄/欠落欄を足さず、未知欄は保存しない。4欄の値が1つでも閉集合外ならderived。

| 欄 | projection許可値 | 他stringのderived |
|---|---|---|
| type | result、null | withheld |
| subtype | success、error_max_turns、null | error_開始+表示可→error_withheld、表示不可→error_X、非error_→withheld |
| is_error | true、false、null | withheld |
| result | OK、null | withheld |

stringは固定文字列。その他の同型固定値はnumber=0、boolean=false、object={}、array=[]。nullは許可値、欠落は欠落、is_error true/falseは維持。result:42はderivedの0、nullはprojectionで、任意の文/数値/object/arrayを投影しない。新literal候補は未採用/未実装。

fieldsは4欄それぞれ`{present:false}`か`{present:true,jsonType:<6種>}`だけで、長さ/元値を足さない。保存前に元値と最上位型・各欄presence/JSON型・is_error true・subtypeのerror_開始/表示可否・分類合図をメモリで比較し、不一致は拒否。同型だけで全合図保持を仮定せず直接試験する。製品のsubtype表示とfixture閉集合を区別し、表/例/schemaを一致させる。

実観測metadataはcli={version（2.1.307/2.1.308）,nativeSha256}、case/attempt、exit={code,signal,timedOut,stdoutLimitHit}、本文なしstderrBytesだけ。未知key/許可外値/各階層-cross-field不整合を保存前に拒否し、型合格だけで許可しない。元rawから直接最小化し、matchesResultCaseの形/終了/case合格を保護資格/元値一致の証明にしない。

CIの保証は保存物の型/出所/整合まで。原raw非保存による再分類/元値独立照合不能をfixture/manifestへ明記し、合成へ差し替えて不足を埋めない。

## 5. 実CLI 2版×2caseの採集前提

2.1.307/2.1.308×success/error_max_turnsの実4件を必須とする。unknown/non-subscriptionはその版/caseを未収集・Issue/taskに残し、認証を切り替えず独立作業を続ける。無害promptだから不明でも採る旧案は不採用。no-session-persistence/hook等の非保存が不明なら保護を外さず拒否する。

起動前にP1固定版native/path/hash、P2 ignored/containment、P3新規git外cwd/note（9.6）、P4固定argv/prompt、P5許可2環境だけの差分（8.2）、P6認証/全設定源/managed/hook/plugin/診断/CLI stateの非永続化証拠と管理確認、P7版/case最大2試行と全試行/不足を照合する。1件でもfalse/unknownならspawn0。全boolを実証拠へ拘束する資格adapterは未実装。自己申告file/空settings/hook-plugin空/合成case一致/設定読取成功を資格にしない。

## 6. 検証と引継ぎ

strict/spec-only・正規parserの正式本文500 UTF-16・全Source/Scenario照合後にtasks順。設計/導入-help/合成/実4件/done/CI-3OS/最終レビューは別受入。D01〜D05だけ採集と独立に先行可。

## 7. 独立設計と採用元

採用設計/管理補正を再利用。実モデルclaude-opus-5-5・ok/deny/headは固定元/PR証跡に保持し、最終レビューへ代用しない。

未読/材料不足（A3/6c/LC/ecb）は未確認、重複417111fcは停止/未実施（詳細は固定元）。再利用/新実行とモデル同意/実証を別扱いする。

PR193から同期した開発用合成3試験の119controlsはREQタグを外し、親E3の要件試験・実4件・受入の件数へ算入しない。

## 8. 公式2版と固定採集手順

### 8.1 導入と根拠

公式wrapper/nativeを独立prefixへignore-scripts/omit=optionalで導入、registry integrity/lock/checksum/直接version-helpを照合済み。force/CPU偽装/global CLI/settings/auth変更なし。4.1は4.2/会話成功ではない。

| native | SHA-256 |
|---|---|
| 2.1.307 | 1c67968ab8410c9644e2f4867167a0dab1a8c6c9de9cc83fe78449e5ae8a3633 |
| 2.1.308 | fdd22e6cbb734d580f5664c48df4294eeec850218ff07f186f9af30426396ee1 |

両helpでprint/output-format/tools/disallowedTools/no-session-persistenceを確認。max-turnsはhelp未掲載だがchecksum固定native宣言と[公式reference](https://code.claude.com/docs/en/cli-reference)で版適用を確認。根拠なし/unknown optionは未収集で、必須2件を省かない。help本文/認証情報は保存しない。

### 8.2 保護と固定呼出し

既存subscription認証/設定源/hook/許可規則/保護/MCP設定を維持。credential/auth秘密の読取/コピー、source空、全hook無効、bare/safe-mode、権限緩和、独自settings/MCP、debug/verbose/resume/continueは禁止。ReadだけでMCP除外を主張せずmcp__*を追加拒否し、接続有無を推測しない。

検証済native絶対path、shellなし、prompt=stdin、stdout=メモリ1MiB、stderr=本文なし64KiB件数、期限5分。生出力継承/原raw一時fileなし。環境継承に子の`DISABLE_AUTOUPDATER=1`/`CLAUDE_CODE_DISABLE_AUTO_MEMORY=1`だけ追加し、診断環境を削除せず不適合/不明なら値を記録せず拒否。

```text
success: -p --output-format json --tools Read --disallowedTools mcp__* --no-session-persistence
error_max_turns: -p --output-format json --tools Read --disallowedTools mcp__* --no-session-persistence --max-turns 1
```

success prompt=`Reply exactly OK. Do not access files or call tools.`。error_max_turns prompt=`Read note.txt in the current working directory and then report its contents.`、note=`Safe fixture note.`+末尾改行。Read拒否/別subtypeは成功に数えず、successは元resultがstringなら成立、OK以外はderivedへ置換。

### 8.3 判定/保存

stdout不正UTF8/JSON・中断/期限/容量は固定符号で未収集。元subtype/is_error/result・permission_denials等はメモリだけ。終了0/schema合格だけで採集成立とせず、projection/derived以外、case不一致/拒否/unknown option/上限停止/保存保護不一致/許可metadata変化は未収集とし、固定符号へ変換してIssue/taskへ残す。元rawから4章の最小fixtureへ直接変換しpresence/type/分類表示合図を照合。再解析不能と実4件0/4を維持。

## 9. 採集制御と未受入境界

### 9.1 CD採用とP6

CD-1〜5は8章/9.3の限定手順。診断は固定名/接頭辞のset/nonemptyだけ。旧E3-D06の読取禁止をCD-2の非認証probeだけ改訂し、読めた=安全とはしない。CD-6は自己cwd由来projects対象1件の任意statだけで、予防証明/任意設定探索には使わない。旧選択肢/不採用理由はtrace全元行に保持する。

### 9.2 完了ゲートと最終受入

以下の「件数はContext」はContextのS1注記にある4済/15未の移植時点の記録を指し、13済/6未はd822e540の履歴である。現在のS2後の件数は12章に記録する。

92ea61a2の5.3非checkbox化、5.2/未採集checkboxと必須受入1未達を保持（件数はContext）。L3=必須CI/runner3OS/done/独立Opus重大ゼロ・最大2往復、Codex参考。head差/指摘修正限定/回数は管理役がADR0006で判定しPR末尾1証跡へ。旧規則は固定元に保持し、実4件/tasks/完成範囲を免除しない。

### 9.3 限定probe

固定2版loaderの非認証user configDir/settings.jsonとproject/local .claude/settings.json/settings.local.jsonだけを読む。上限1MiB/深さ32/4096node、symlink/型/inode不一致・読取失敗・不正UTF8/JSON・未知構造は固定理由で拒否。任意filename/credential/authを開かず、原文/設定値/個人情報path/例外message/環境値/動的名前一覧を返却保存せず、hook/plugin/envを固定boolean/状態/理由にする。

3pathをparent/flag/managed/plugin全coverageへ数えない。公式managedの起動cache、monitoringのraw API本文/ファイル出力も確認する（[元の公式根拠一覧][history-design]9.3）。data usage/現行docsは2版全stateの保証ではない。managedのprofile/machine pin/gateway/key/cache経路もあり、subscription種別/ローカル不在だけで不存在としない。

### 9.4 未受入

認証/managed/hook/plugin/診断/CLI state非保存は未証明。主要transcript skipの静的確認でも別history addの全caller不達は未証明で、必ず書く/安全のどちらも断定せず、新環境追加で解消しない。

native FD→exec、plan argv/prompt/環境→観測metadataを信頼経路へ拘束する資格adapter、実OS/live入口、nooverwriteの永続化/全試行台帳は未実装/未受入。atomic rename単独は既存上書きを防げず未採用。旧inspectResultProcessは子PID停止だけでowned tree/stream error/close未到達の実接続へ適格とせず、合成一致もcollected=false。

### 9.5 追加OS制御

QD-1のC launcher等/QD-3 seccomp-AF_UNIXは調査候補だけでsandbox実装/適用は未採用。Landlock ABI/技術可能性を資格にしない。QD-2のhook/plugin空だけでgenuine扱いは不採用、空必須という一般条件も追加せず、保護/非保存の実確認を要する。

QD-4はhost audit/eBPF/swap等の無限の新証明義務を追加せず、JS消去の限界とcollector/CLI/子孫の原raw非保存を保持。ホスト外仮想観測まで閉じたとせず実在診断B1等は未証明拒否。QD-5は全OS純粋試験+手動調査、新skip/緩和なし。QD-6は存在で拒否を維持し、stderr-only/file-or-network/unknown分類は2版nativeの厳密根拠準備だけ、実環境値は読まない。

### 9.6 P1/P2/P3

P1は版から公式prefix/固定SHAを導き別pin不可。path/type/symlinkと同一open FDの逐次hash、途中変更/不一致を固定理由で拒否し、低水準合成validatorを資格にしない。P2はrealpath境界/外向きsymlinkなし/git check-ignoreをreadonly確認、保存先を作らず後openの原子性は未保証。

P3は自己cwdにO_EXCL/0600の固定noteだけ。祖先.git/GIT環境を拒否しgitの明示的非repoを確認、単なる非ゼロ/bareは不可。callback例外messageを捨て固定理由で拒否し、成功/失敗ともfinallyで自己領域を削除。実CLI/資格へ接続せずP6/0/4を維持。

### 9.7 LC全条件

LC-1はspawn/group/clock/timer/signal必須注入で実factory/OS adapter既定・TS/dist直結・公開export追加なし。LC-2 close1000ms、LC-3 HUP=INT/TERM中断、LC-4 projectResultTransport抽出（旧capture/36件保持、listener/timer二重化なし）、LC-5 win32 factory0/platform-unsupported、LC-6 exit-unobserved/exit-close-mismatch拒否。

driveResultProcessはfake試験だけ、全依存必須、凍結shell=false/detached=true/3pipe。正の安全整数PID（1/自分以外）だけowned pgidとしfactory前中断は起動0。A-LC-1は単調有限ms clock/進行するschedulerで、同期依存によるhostブロックまで防ぐ保証なし。

元exit/close/timeout-abort-limit flags、最初のprimary、transport、cleanupを分離し元結果を後処理で変えない。stdoutメモリ1MiB/stderr64KiB件数、3stream/child errorは固定理由。実行5分を単調時計で再確認し、stop/exit後TERM→5秒後KILL→group最大1秒→close最大1秒、最大7秒でdriver自身が終結。signal/waitのthrow/reject/false/never-resolve、close未到達も有界、遅いwaitGroupExit=trueはnow<deadlineを再確認し期限後不採用。cleanup結果をtimeoutへ代用しない。

settle一度、timer/親signal/abort/data listener回収・owned pipe destroy、遅いerrorはmessageを捨てるsink。primaryなし/cleanup確認/transport closed/exit観測/exit-close一致だけ純粋projectionへ渡し、collected=false、raw/stderr/例外message/PID一覧は保存しない。実owned tree/同一PID/別session/Windows通常終了は未受入、fake48件を資格へ数えない。Node close契約（固定元9.7）のexit/stdio close/errorを同一視しない。

## 10. guard群化の現在条件

G-Q1/2/3/5/7・H-Q1=B'/H-Q2-4=Aと管理補正を採用（旧案/不採用理由はtrace/固定元）。既存要求を保つ範囲だけ差分specなし、実質変更は仕様案へ戻す。

add -A後のname-status --no-renames -zはMap前にNUL終端/ペア/空code-path/decoded重複を検証し、不正はGitError。空statusは変更なし、Tは単独status。既存検出本文/findings順を保ち、file間の追加/削除を偽対応させない。

status順にw=JSON.stringify(path).length+1、合計8192で連続群化。single-overは単独の旧失敗境界へ渡し、全argv8192以下とは言わない。内容は-U0、literal/no-renames/no-color/no-ext-diff/submodule short/a-b prefix固定、algorithm/textconv維持。generatorは次の成功群だけ持ち、大きい例外出力もcatch外で解放する。

headerの完全一致/C quote復号でpath照合、T=2、A/D=1、M=1を基本とし未知/余分/欠落はGitError。末尾newline、hunkのold/new行数/context-add-delete消費/次hunk-header遷移を検証し、不完全EOFやheader数だけの成功は禁止。mode/empty/binary/型/dirも実Gitの完結形式に従う。

constant textconvの合法M0は非曖昧batch成功のconsumerだけ空entryで許可し旧空linesへ戻す。parser既定strict、A/D/T/未知header/不完全hunkは不変。群外を捨てるのは内容=既知D descendant、表示=既知status descendantだけ。literalでも混ざるdir子削除は境界選別する。

gitMeasuredは非index、旧gitのenv/対話案内/GitError/共有期限を共用。返却stdout+stderrのUTF8 bytesとtext内U+FFFD有無だけで、wire byte/invalid UTF8と断定しない。表示はfilter前の全群（捨てる部分込み）を課金しroom=64MiB-usedを渡す。room<=0は起動せずoutputで、UsageErrorにしない。

bytes>=room-3はroomへ飽和し、同境界+U+FFFDまたはroom<=3+空stdoutは「上限近傍で差分の完全性を確認できない」とoutput停止。正規U+FFFDも境界では拒否、余裕あるU+FFFD/通常UTF8の完全最終群exact境界は許可。完結prefix後のhunk欠落も成功にせず、内容=output限定二分/単独停止、表示=全停止非再取得。kit監視protocolと既存git他callerの拒否条件は不変。

30秒は群単位、run共有期限は全群に適用し、全表示群が旧1op30秒以内とは保証しない。renameは削除/追加全文、色/prefix/extdiffは表示に反映しない。旧byte一致は既定/非rename/混入なしだけ。GIT_GLOB_PATHSPECS/GIT_ICASE_PATHSPECS競合はenvを変えずGitErrorへ。

群数上限=min(n,ceil(2W/C))。ceil(W/C)は上限でなくC10/6-6-6は3群。oversizeなしの別式は固定元10.3参照。1200path=13群/28呼出で旧24概算を成功実測にせず、計算/Gitfixture/3OSを区別。Windows errno未観測/Mac区間未計測は原因候補にとどめる。

[history-design]: https://github.com/loomake/loomake/blob/3b3b6d7e2f68fd8c71a888a7302f28e6ef91c291/openspec/changes/validate-engine-json-result/design.md
[history-trace]: https://github.com/loomake/loomake/blob/3b3b6d7e2f68fd8c71a888a7302f28e6ef91c291/openspec/changes/validate-engine-json-result/trace.md


### 10.7 Windows偽gitとliteral子環境（task2.5の修正）

独立Opus設計8afb8b0d-5775-47d6-81f7-cce858c5916e（head3b3b、実モデル/回答モデルclaude-opus-5-5、ok=true・deny=0）を本体rootが全文確認し、W-GIT-01=A、02=a、03=公式資料と実Git、04=追加assertなしのCI診断を技術採用した。これは本体による既存設計内の採用判断であり、利用者本人の新しい直接回答ではない。

`batchOutput`だけが`{ ...env, GIT_LITERAL_PATHSPECS: '1' }`を子へ渡し、内容と表示の2つのargsから先頭の`--literal-pathspecs`を外す。[Git公式](https://git-scm.com/docs/git#Documentation/git.txt---literal-pathspecs)は両指定が等価と説明している。呼出元env・process.env・ほかのGIT変数は変えない。実GitでもGLOB/ICASEとの衝突は同じGit失敗、NOGLOB=1と既存LITERAL=0は同じ出力となることを確認した。R-5の衝突停止を保ち、部分的な自作pathspecやnative launcherは追加しない。

1200file試験の観測を子envへ移し、26件・合計28回・8192+152の期待値を保つ。26件すべてが先頭diff・flag不在で、残る2件がliteral設定なしのaddとname-status diffであることを追加検査する。W1で内容/表示の両群と呼出元env不変、W2で実Gitの正負とliteral名の混入防止を確かめる。既存のraw flag版とのbyte比較、特殊path・textconv・予算・二分・timeout・中断のassertionは変えない。

public API、git/gitMeasuredのsignature、runtime/監視役protocol、群化・照合・表示・課金・共有期限は不変である。GitErrorに含むargvは`git --literal-pathspecs diff`から`git diff`へ変わる。external-budgetの元4case・19.5/39.5秒下限/既存上限・保持役待ち差分・retry・全assertを変更せず、Windowsでdiff転送成功がpushの停止より前にあることは本体がCI診断で確認する。今回の修正だけで実3OS回帰・実4件0/4・残6task・最終受入を完了としない。

## 11. S4先行の統合順（2026-11-01）

S2-Q01/02の管理役採用により、S1の次はS4（tasks2.5/3.5）を先行し、S2（2.1〜2.4/3.1/3.2全6task・71件候補）をその上へ重ねる。S2の範囲を純粋classifierだけへ縮めず、1200file・60秒・全assertとrunner3OSの受入を保持する。旧d822のファイル全体を移す方法は採らず、currentのGit読み取り集約・C001 local/CI・qualitySchema・helperを保持する。旧S4設計と実関数の適合確認が製品実装の前提で、新しい判断を要する差があればその部分だけ設計へ戻す。 再利用した設計と適合確認の結果は [PR #261](https://github.com/loomake/loomake/pull/261) の証跡を参照する。

計画採用時点では19taskのID・本文・受入と4済15未の印を保持した。S4のローカル実装・回帰時点では2.5だけを完了とし、5済14未であった。3.5はrunner3OSとWindowsのpush期限順の受入まで未完了とする。S4の先行は依存上必要な順序の変更だけで、S1 gate/merge未達、全体done未達と実4件0/4・P6未成立を免除しない。REQ100本文の統合はIssue259でF前に再照合する。

## 12. S2の局所実装と現在の受入境界（2026-11-01）

管理役が採用したOpus設計5f6412e0（実モデルclaude-opus-5-5）を再利用した。元設計の前像とS4後のdecision-policy・phases・helpers・recorder・logs・log-policy・engineの7fileがbyte単位で同一であることを実装前に確認し、仕様ゲートを通した。設計原本と実行情報、採用判断、保持照合と実検証は、この枝の`.loomake/s2-implementation/`に保存した。

製品変更はdecision-policyとphasesだけである。元rawの分類、構造化faultとhold、task/repair共通のAfterGuardを接続し、既存guardの検査・表示・resetと先行停止を保った。正常経路ではGit呼出しを増やさず、currentのlocal/CI判定・qualitySchema・engineBaselineと、既存recorderを保持した。helpersはresultFields/stdoutの型と偽engineの出力部分だけを追加した。

直接53件・統合11件・保存6件・新変異1件の計71件を実行した。統合試験には、異常時の出力パスと読めない理由、本文を含めない場合の分類とパスのassertも追加した。Linuxの全runnerと新旧変異を含む回帰は556件成功・失敗0・skip0で、新3変異と既存6変異を同じ直接試験のassertion失敗で検出した。1200file・60秒・既存の期待値と品質設定は保持した。この結果はmacOS/Windowsの成功や実CLIの観測を意味しない。

今回2.1〜2.4・3.1・3.2を完了とし、19taskのID・本文を変えず、現在11済8未である。3.3〜3.5、4.2〜4.4、5.1/5.2と最終CI・独立レビュー・実4件0/4・P6未成立を残す。8 Requirement・41 Scenario・Sourceは変更せず、REQ-100の全文統合はIssue259でF前に再照合する。部分実装を親の完了ゲート成功や段階PRのマージ承認へ読み替えない。


## 13. S3の正常経路と保存fixtureの試験（2026-11-01）

E3-S3-01の管理役採用により、S2の製品実装を保持して既存S3設計を再利用した。正常経路は09e6c922の追加describe5件だけを追記し、現S2の元prefixと強化済み4assertをbyte単位で保持した。保存fixtureは796324d5の149行・66ケースをそのまま追加した。fixture scriptは旧版・現S2・mainで同一のため変更せず、製品src・helpers・品質設定・依存lock・正式仕様も変えていない。

3.3のrunner全回帰と新旧変異試験は565件、3.4の保存fixture試験は別実行で66件が成功し、どちらも失敗・skipは0であった。正常なcommit・NoChange・done、部分完了と異常なrepair、旧停止優先、4出所・型・固定置換・分類表示の保持・追加欄拒否を検査する。fixtureの合成対照をCLIの実観測やP6の証明へ数えない。

3.3・3.4だけを追加完了して現在13済6未である。8 Requirement・41 Scenario・Sourceと全19task本文を保持し、3.5・4.2〜4.4・5.1/5.2、実4件0/4・P6・REQ100同期と最終受入を残す。L2の必須検査・3OS・別担当の自己レビュー・独立Opusは後段の受入であり、親done未達と規則案#260未承認を免除しない。
