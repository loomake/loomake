# #65 / W1-6 の親引継ぎ

## 分割と未完了の扱い

管理役が2026-11-05に採用したOpus設計を、3本の独立した通常L3 changeとして実装する。P1→P2、P1→P3の依存とし、各PRでspecgate、local/ci done、必須5チェック、変更packageの3OS、非著者Codexと独立Opusのレビューを満たす。例外の段階受入は使わない。

- P1：`extract-shared-secret-redaction`、REQ-447とREQ-207の責務の明記。全13タスクの実装とローカル完了ゲートは成功し、非著者Codexと独立Opusの初回レビューは重大0件だった。最終headのCIとmain受入は未完了。
- P2：五つのツールの中立変換と収集、REQ-448〜450。change未作成・全件未実装。
- P3：verify/traceの保存・表示・診断、REQ-451〜453とREQ-070のMODIFIED。change未作成・全件未実装。
- REQ-454は未使用。REQ-447〜453の予約を別案件へ流用しない。

P1だけでIssue #65を閉じない。P2とP3の両方がmainへ入り、仕様同期/archiveを含む必要な受入を確認するまで、Issueの全完了条件は未完了である。五つのツールや古い証拠の表示を外した旧設計は採用していない。

## P2へ残す全義務

### REQ-448：coreの中立変換

- `gh`・`claude`・`codex`・Biome・Playwrightの五つをそれぞれ対象にする。coreは取得済みのfile/textをParseResultへ変換する純粋関数を持ち、I/O、spawn、通信、時計、品質の合否判定を持たない。
- 用途はghのPR checks、Claudeのresult、CodexのJSONL、Biomeのlint/ci JSON diagnostics、PlaywrightのJSON tests。対応version/shapeと必要な終端を一次資料で固定してから仕様とfixtureにする。Codexのevent名をhelpだけから推測しない。
- 共通型にはtool名と種類を持たせる。ghはchecksのname/bucket/workflow/link、agent-resultはok/text/sessionId/turns/errors、Biomeはseverity/rule/message/file/line、Playwrightはversion/tests/statsが設計候補。既存TestCaseとREQ-ID抽出を利用する範囲を明示する。
- 変換出力は新しい収集型の既知項目だけとし、vendorの未知fieldは捨てる。既存Evidence/Reportの未知field保持とは別契約である。
- malformed、空、必須項目・対応形の欠落、終端のないJSONLをerrorsにしvalueをnullにする。入力の生値をエラーへ引用せず、field pathと不正な形の説明だけを返す。
- Claudeのtype=result、is_error/subtype、Codexの終端と失敗、Playwrightの再帰suites/TestCaseStatus、Biomeの実際のdiagnostic形を一次資料に照合する。これらは正式spec確定前の設計候補であり、形を推測して実装しない。
- 対象headにはcoreの既存zod ^4.6.7とkitの既存yaml ^2.9.1がある。P1はcoreを変更せず外部依存を増減しない。P2のconverterは純粋な処理とし、外部依存を新たに利用しない。既存package.jsonと実仕様の原文を正確に保持し、この作業で依存整理を行わない。

### REQ-449：kitの収集と失敗分類

- tool、command、readonly args、cwd/env、timeoutMs/maxBufferを収集関数の引数として設計する。tool固有の変更を引数builderとcore converterへ閉じ込める。gh builderはread-only subcommandだけを生成する。
- 共通runExternalを1回だけ呼び、status/signal/起動error/ProcessLimitErrorを区別する。共有予算・時間・出力量・中断状態・子孫の停止は既存基盤を維持する。
- `parsed`・`unreadable`・`not_found`・`spawn_error`・`limited`の5分類を仕様化する。ENOENTはnot_found、ほかの起動errorはspawn_error、ProcessLimitErrorはkindを残すlimited。非0でも正しいpayloadと終端ならparsedで、終了状態は記録する。終了コードから品質合否やmetric件数を作らない。
- 未導入・未対応の理由を返し、自動インストール・再認証・追加ネットワーク問い合わせへ進まない。CLIや設定の汎用実行機構を追加しない。

### REQ-450：保存前の置換と保証範囲

- 生stdoutはメモリ上でcore converterへ渡し、観測の戻り値にはmaskValueを掛ける。raw出力のspoolやtemporaryを作らない。
- stderrの全文をcreateDiagnosticRedactorのwrite/endへ通してから診断の末尾を切る。BEGIN行やtokenの先頭を切り落としてから置換しない。
- limitedのstdoutは捨て、reasonへraw textを入れない。戻り値、diagnostics、例外に既知の形を残さない。保証はREQ-118/199の既知の形だけとする。
- Loomakeの戻り値・callback・例外メッセージ・保存ファイルを保証する一方、ツール自身のsession log、Playwrightのtrace/attachment等は保証外と文書へ明記する。Playwrightはstdout JSONを使う案とPLAYWRIGHT_JSON_OUTPUT_*の扱いを確認し、利用者のツール設定や履歴を勝手に変更しない。
- 実providerを起動せず、版に根拠のある合成fixtureとprocess.execPathの代替commandで五つすべてを試験する。正常・非0・ENOENT・signal・timeout・出力量超過、共有予算中断後の後続拒否、JSON Unicode escape、改行、nested、Bearer、PEM、切れた出力を含める。

## P3へ残す全義務

### REQ-451：verifyの戻り値・進捗・診断

- runVerifyのすべての戻り値を共通の置換結果とし、CLI表示、onVerify、Evidenceが同じ結果を使う。runVerifyの残りの出口、format.ts、verifyAbortedResultをGrepで列挙し、Scenarioで漏れなく確かめる。
- progressのcommand文字列、品質commandとOpenSpec検証の失敗出力、run errors、decision reason、aborted理由を保護する。既存末尾30行・先頭2000文字の上限は変えず、全文を置換してから切る。
- maskValueのobject own undefined保持とroot/Array undefined拒否を踏まえ、既存VerifyResultの省略形を失わない。partial/local/abortedへ新しい判定を作らず、秘密のない正常な値と終了コード0〜3は変えない。

P3には補足設計が必要な未決事項がある。新設予定のREQ-455/456のonCommand hookはraw stdout/stderrを品質実施のreceiptへ渡す契約を持つため、先行設計の「全callbackをmask」との整合を確認する。P3着手時に採用されたhookの仕様・実装・試験を読み、raw receiptに必要な値と、保存前に置換する値・表示する値の扱いを補足設計で確定する。raw callbackへ一律にmaskを掛けたり、raw値を無条件に保存可能としたりしない。必要な差分仕様と仕様ゲートを通すまでこの契約を変更しない。P1にonCommandやREQ-455/456の実装・変更は混ぜず、未決の親義務として残す。

### REQ-452：trace recordの原文と保存前の最後の検査

- Q65-05 Aは管理役による暫定採用。管理役が既存openspecのspec/trace408文書をreadonlyで調べ、置換が生じた文書は0件だった（.loomake/design65/p3-corpus-scan.json）。この観測をP3の正式specと受入へ引き継ぎ、追加文書や変更後の影響もP3で確認する。
- 原文documentsを置換して保存しない。秘密形がある文書はUsageError/終了コード2で記録を拒否する。メッセージは安全なpathと行番号・次の操作だけにし、値を出さない。
- readDocumentsの原文contentとSHA-256、verify前後のHEAD/作業ツリー/文書hash比較、記録後のfreshnessを維持する。置換後hashだけの比較へ変えない。
- serializeEvidenceは既存形式・最終JSON bytesの上限を維持し、temporaryへ書く前に既知の形が残らないことを最後に検査する。既存REQ-174/175のboundaryと原子的な上書きなし公開を保つ。
- recordのgitエラー、dirty file一覧とpath等も置換する。元文書と既存のEvidence1/2を書換え・削除しない。
- 秘密形文書ではtemporaryも最終ファイルも作られず、stdout/例外にも秘密がないことを試験する。秘密のない文書のsnapshotとREQ-128/129の変更検知はそのまま試験する。

### REQ-453：Report/API/Markdown/JSONと旧記録

- reportFromEvidenceの戻り値、直接呼べるformatReportMarkdownの入力、runReportの出力、readEvidence/buildReportの診断を保護する。決定的な置換と同じ入力から同じ結果というREQ-085を保つ。
- 過去のEvidence1/2のbytesを維持して読み、Reportと診断だけを置換する。読む前後でファイル内容が同じであることを試験する。旧fixture自体の期待値を都合よく書換えない。
- local完了、aborted、partial、証拠不足、旧Evidence1を新しい最終CIのPASSに変えない。REQ-315/316と既存Report2の外形を保つ。
- REQ-070の現行全文と全Scenarioを維持してMODIFIEDを作り、「原文を置き換えずに載せる」の例外として既知の秘密だけを***へ置換する文とScenario1件を加える。
- 品質commandの秘密を含む出力からverify/onVerify、Evidence、JSON/MD Reportへ進む往復を試験する。秘密を含む旧fixtureは別fixtureとして作り、読取前後のbytes不変と出力の置換を確認する。
- runnerのlogs/run/recorder/phases/engineは既存の薄い再exportを使い、独自の置換規則を追加しない。

## P2/P3の着手前に確認する不足

1. 管理役が `.loomake/design65/p2-primary/manifest.json` に版固定の公式資料を取得済み。Codex 0.166.0のevents、Biome 2.6.5のJSON reporter、Playwright 1.64.1のJSON reporter/typesの4原本がある。P2担当は原本と対応versionを確認し、gh/Claudeの必要項目と合成fixtureも揃える。資料があることだけで5vendorの契約が確定したとは扱わず、モデルや記憶で形式を推測しない。
2. P3でverify/OpenSpec/format/abortedの全出口を列挙し、上記の検査とsnapshot/保存前置換を正式specのScenarioへ対応させる。
3. Q65-05 Aのreadonly影響調査と採用判断を残す。単に「documentsは全部対象外」として完了させない。
4. 各子changeを起こす時点でREQ採番とREQ-070の同時変更を再確認する。P1で範囲外としたREQ-448〜453は削除された義務ではない。
5. P2/P3は共通APIと各readerを同じ通常PRで追従させる。200KiBを超えるなら各条件と必要試験を保持して通常PRへ再分割し、未完了を受入済みとしない。

## 現在の停止点

B01は、独立確認に基づき管理役が通常の仕様追従と分類した。追加承認が必要との先の解釈を訂正したもので、新たな利用者承認とは扱わない。元4項目・全禁止依存・未知ファイル拒否を保ち、仕様ゲートの成功後にP1の実装を終えた。通常のローカル完了ゲートは実終了0・21検査PASS・3,577試験成功・失敗0・既存保留8である。

非著者Codexの初回レビューは重大0・軽微0・情報0、独立Opusの初回レビューは重大0・軽微2・情報4だった。文書の旧状態と試験根拠の対応を直し、配布物の追加実行試験は [Issue #451](https://github.com/loomake/loomake/issues/451) に残した。旧headのCIでは通常Windows試験の既存REQ-270が時間切れとなったため、最終headのCI完了ゲート・必須5チェック・通常3OSの成功を確認してからmain受入へ進む。Q65-03/04/10の採用とP2/P3の未完了はtraceに分けてあり、main受入後の仕様同期とarchiveも未実施である。
