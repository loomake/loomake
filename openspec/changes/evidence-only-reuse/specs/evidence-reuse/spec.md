## ADDED Requirements

### Requirement: 証跡だけの実差分の判定
kit は named export `readEvidenceRange` を公開し、小文字40桁か64桁のsourceとtargetについて、置換参照を使わずGit原本から範囲の各コミットの差分を読み、許可した証跡だけかをメタデータで判定する SHALL。

Source: REQ-473

#### Scenario: 公開契約の共通条件
- **WHEN** このRequirementのAPIを利用する
- **THEN** 許可するのは、shallowでなく、sourceがtargetの祖先かつ異なり、範囲の全コミットが親1つで、全コミットの全entryが状態A・mode 100644で、対象changeの `.loomake/evidence/<change>/` 直下または `reuse/` 直下の正規名である場合だけとする MUST。最終treeの差分では判定しない MUST。コミット4096件・entry合計4096件・メタデータ1回16MiBを超える範囲、object欠落・祖先でない・マージ・M/D/T・正規名以外・symlink・submodule・実行可能は、理由コード付きのallowed:falseを返す SHALL。外部操作の期限と中断はREQ-192の実行時の失敗とし、引数の誤りはUsageErrorとする SHALL。kitは本文を解釈せず、`createGitEvidenceReader` が共有予算（1件64MiB・合計128MiB）でblobをstrict UTF-8として読む SHALL。

#### Scenario: 証跡の追加だけの範囲
- **WHEN** 検証済みのsourceの後に、対象changeの正規名の証跡JSON 1件を追加したコミットだけがある
- **THEN** allowed:trueとなり、範囲のコミットとentryのcommit・path・oid・kindを返す

#### Scenario: コードや仕様の変更が混ざる
- **WHEN** 証跡の追加に加えて、`packages/` のファイル、差分仕様、quality.yaml、loomake.config.json、lockfileのいずれかを変更したコミットが範囲にある
- **THEN** allowed:falseとなり、変更したpathとコミットが理由に含まれる

#### Scenario: mainへの追従
- **WHEN** 範囲にマージコミットがある、またはsourceがtargetの祖先でない
- **THEN** 差分の内容にかかわらずMERGE_IN_RANGEかSOURCE_NOT_ANCESTORとなる

#### Scenario: 証跡のパスに不正な形式がある
- **WHEN** 証跡のパスに、変更・削除・改名、実行可能・symlinkのentry、別changeや `effort/` の記録がある
- **THEN** パス名が似ていてもallowed:falseとなる

#### Scenario: 読めない範囲
- **WHEN** shallowのリポジトリ、存在しないsource、上限を超える件数やメタデータの範囲を判定する
- **THEN** 例外で止まらず、理由付きのallowed:falseとなる

#### Scenario: 打ち消し合うコミットと置換参照
- **WHEN** コードを変更して次のコミットで戻した範囲、または `git replace` で証跡だけに見せかけたコミットを判定する
- **THEN** 最終treeが同じでも各コミットの変更と原本のobjectで判定し、allowed:falseとなる

#### Scenario: 共有予算と厳密なdecode
- **WHEN** 同じreaderで合計128MiBを超えるblob、または不正なUTF-8のblobを読む
- **THEN** BLOB_TOO_LARGEかBLOB_NOT_UTF8を返し、置換文字に変えた本文を返さない

### Requirement: 外部の信頼値による要約の再利用と差し戻し
trace は `runReuse` を公開し、HEADをtarget、信頼値のshaをsourceとして、target時点のGit原本から明示された要約を読み、呼出側が渡した信頼値で `checkFixedSummary` の照合を形の確認より先に行う SHALL。

Source: REQ-474

#### Scenario: 公開契約の共通条件
- **WHEN** このRequirementのAPIを利用する
- **THEN** 信頼値が読めない・repoかgit common dirの中にある、要約が欠落・通常blobでない・上限超過・UTF-8不正、照合のFAIL、別change・形の不正・role:development以外・ファイル名とshaの不一致・sourceに既にある場合は、outcome:returned-to-humanで最初の理由だけを示し、再検証・記録・ほかのPASSで置き換えない MUST。照合と形に通った要約がciのcompleted・要判断なし・PASSで、範囲がallowedで、範囲のほかの証跡が検証に通る合格のEvidence 2か再利用の記録で、node・platform・arch・評価器の版・品質コマンド設定の出典とSHA-256・basis・文書がすべて一致する場合だけ再利用する SHALL。それ以外はすべての理由を定めた順に示してrevalidatedとする SHALL。信頼値の取得元・真正性・hardlinkを判定しない MUST。

#### Scenario: 有効な証跡だけ
- **WHEN** 合格したci要約と、それに対応する外部の信頼値があり、範囲が証跡の追加だけである
- **THEN** 結果はreusedで、品質コマンドは1回も起動されない

#### Scenario: 要約を改変した
- **WHEN** 要約の1文字、または要約と自己ハッシュを同時に書き換えたコミットを範囲に含める
- **THEN** returned-to-humanとなり、SUMMARY_HASH_MISMATCHを示し、品質コマンドも新しい記録も実行しない

#### Scenario: 信頼値がない、または同じrepoにある
- **WHEN** 信頼値のファイルがない・形が不正、またはrepoの中や親のsymlinkを経由してrepoの中を指す
- **THEN** returned-to-humanとなる

#### Scenario: 環境や基準が違う
- **WHEN** 要約のnode・platform・arch、評価器の版、設定のSHA-256、basis、文書のいずれかが現在と違う
- **THEN** revalidatedとなり、違う項目を理由に示す

#### Scenario: 合格でない要約
- **WHEN** 照合に通ったが、要約がlocal、FAIL、不足、要判断あり、aborted である
- **THEN** revalidatedとなる

#### Scenario: 差し戻しと再検証の理由が同時にある
- **WHEN** 要約のハッシュが一致せず、範囲にコードの変更とマージもある
- **THEN** returned-to-humanとなり、再検証の理由で上書きせず、品質コマンドを起動しない

#### Scenario: 範囲のほかの証跡
- **WHEN** 範囲に、壊れたJSON・Evidence 1・不合格のEvidence 2・欄の欠けた再利用の記録のいずれかがある
- **THEN** revalidatedとなり、そのpathを理由に示す

#### Scenario: 要約がsourceに既にある
- **WHEN** 要約のpathがsourceのtreeに既にある、またはsourceとtargetが同じである
- **THEN** returned-to-humanとなる

### Requirement: 再利用の記録と既存の記録との互換
`runReuse` は再利用したときだけ `.loomake/evidence/<change>/reuse/<UTCの日時>-<targetの先頭12文字>.json` に、reuseVersion:1、verification:integrity-only、qualityCommands:not-run、sourceのSHAと要約のpath・oid・SHA-256・CI識別、targetのSHA、範囲のコミットとentry、信頼値の出所がcaller-fileで真正性が未確認であること、評価器・環境・確認時刻を保存する SHALL。

Source: REQ-475

#### Scenario: 公開契約の共通条件
- **WHEN** このRequirementのAPIを利用する
- **THEN** 保存前と整形JSON（末尾LF・64MiB以内）を読み直した後に公開の同期関数 `reuseRecordProblem` で検証し、祖先のディレクトリがsymlinkでないことを確かめ、一時ファイルから原子的に公開する MUST。既存のファイルを書き換えず、同じ名前があれば記録せず1を返す MUST。元の要約、Evidence 2、summaryVersion 1、runnerの再利用条件、trace reportの読取りを変えない MUST。この記録を品質合格やciの最終合格として表示せず、後の判定の根拠にしない MUST。
`reuseRecordProblem` は例外を出さず、既知の欄をownのdata propertyとしてだけ読み、getterを実行しない MUST。文字列の欄はtypeofがstring、reuseVersionはnumberの1であることを、正規表現・比較・切り出しより先に確かめ、Array・boxedの値・文字列への変換で通る値を不正とする MUST。runAttemptは先頭0のない正の10進の文字列で安全な整数の範囲、runIdは10進の数字列とし、要約の検証と同じ条件とする SHALL。既知の文字列の欄のいずれかがREQ-118・REQ-199の既知の秘密の形に当たる場合は不正とし、保存では値を置き換えずに記録をやめ、入力値を含まない固定の使い方の誤りとする MUST。未知の欄は解釈せず保持する SHALL。

#### Scenario: 再利用元と範囲を記録する
- **WHEN** 再利用が成立する
- **THEN** 記録にsourceとtargetのSHA、範囲のコミットとentry、要約のSHA-256が入り、元の要約のbytesは変わらない

#### Scenario: 既存の利用側への影響
- **WHEN** 再利用の記録がある状態で trace report と loomake run の再利用判定を実行する
- **THEN** 記録は読まれず、従来どおりの結果になる

#### Scenario: 記録を検証する
- **WHEN** 後の範囲に、欄が欠けた・版が違う・ファイル名とtargetが合わない再利用の記録が追加されている
- **THEN** その範囲はrevalidatedとなる

#### Scenario: 同名と保存先の異常
- **WHEN** 同じ名前の記録が既にある、または保存先の祖先がsymlinkである
- **THEN** 既存のファイルは変わらず、同名はstoppedで1、symlinkは使い方の誤りとなり、記録されない

#### Scenario: 秘密の形に当たる値を記録しない
- **WHEN** 再利用が成立する条件で、change-id、または評価器か実行環境の版が既知の秘密の形に当たる記録を保存しようとする。あるいは同じ形の値を持つ再利用の記録が後の範囲にある
- **THEN** 保存では記録せずに使い方の誤り（2）となり、ディレクトリとファイルは増えず、要約のbytesも変わらず、例外の文・cause・標準出力・標準エラーに元の値が残らない。範囲の中の記録はrevalidatedとなる

#### Scenario: 既知の欄の型の境界
- **WHEN** 既知の欄をArray・boxedの値・数と文字列の取り違え・継承・getterで与えた記録、またはrunAttemptが0・先頭0・安全な整数の範囲を超える記録を検証する
- **THEN** reuseRecordProblemは例外を出さずに不正を返し、getterは実行されず、入力は変わらない。要約の検証で受理されるrunIdとrunAttemptは同じく受理される

### Requirement: 再利用の公開入口と再検証への切替え
CLIは `loomake trace reuse --change <id> --summary <path> --anchor <file> [--scope local|ci] [--json]` を提供し、`runReuse` を呼ぶ SHALL。

Source: REQ-476

#### Scenario: 公開契約の共通条件
- **WHEN** このRequirementのAPIを利用する
- **THEN** 開始時に未コミットの変更があるときは判定せず、終了前にHEAD・作業ツリー・文書・設定・basis・信頼値のbytesが変わっていれば、記録も再検証もせずにstoppedで1を返す SHALL。再検証のときは理由を示してから `runRecord` と同じ検証と記録を実行し、その終了コードと記録先を返す SHALL。reusedは0、returned-to-humanは1、使い方の誤りは2、外部操作の期限は3を返す SHALL。--jsonの標準出力はresultVersion・outcome・exitCode・reasons・source・target・record・verifyExitCodeを持つJSON 1つだけとし、進捗と再検証の表示は標準エラーへ出す MUST。使い方の誤りと実行時の失敗ではJSONを出さない SHALL。`loomake trace reuse --help` は使い方と5つのオプションの説明を表示し、ほかの処理をせず0を返す SHALL。

#### Scenario: 混在のときは実際に再検証する
- **WHEN** 範囲にコードの変更が混ざった状態でCLIを実行する
- **THEN** outcomeはrevalidatedで、各品質コマンドが1回ずつ起動し、新しいEvidence 2が記録され、終了コードは検証の結果と同じである

#### Scenario: 判定中の変更
- **WHEN** 判定のあいだにHEADまたは追跡しているファイルが変わる
- **THEN** 再利用の記録も再検証も行わず、終了コードは1である

#### Scenario: JSONの出力
- **WHEN** --jsonを指定して、reused・revalidated・returned-to-human・stoppedのそれぞれを実行する
- **THEN** 標準出力を単独のJSONとして解析でき、outcomeで区別でき、再検証の表示は標準エラーにある

#### Scenario: 使い方の誤り
- **WHEN** --anchorか--summaryを省く、--summaryが正規の形でない、または不正なchange-idを渡す
- **THEN** 日本語の使い方が表示され、終了コードは2である

#### Scenario: help
- **WHEN** `loomake trace reuse --help` を実行する
- **THEN** reuseの使い方と--change・--summary・--anchor・--scope・--jsonの説明が表示され、Gitも品質コマンドも実行されず、終了コードは0である
