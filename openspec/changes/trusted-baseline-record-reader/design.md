## Context

C1はPR #308で受け入れ、PR #314で同期・archive済み。C2の既知差分205,674 bytesは通常上限を超える。Opus設計a0730601の§9・案Sを採用し、汎用読取りを本change、実データをC2bへ配分する。

## Goals / Non-Goals

本changeはYAMLの閉じた形・構造・基準側固定値を照合する。C001の実候補、固定PIN定数、元JSON6試験、所有採否9行と表はC2bへ残す。CLI・公開exports・採否主体/API・新しい実行・親の完了は扱わない。

## Decisions

### 私的API

packages/kit/src/verify/trusted/baseline-record.tsにcheckBaselineRecord(text, context, pin)をnamed exportする。contextはcheckInitialBaselineStructureと同じoriginal・anchor・sha256Hex、pinは基準側が渡すsha256とRecordCounts。返り値は既存の構造照合と同じbaseline・sha256・adoptionsVerified:false・problems。C2bのコード定数を引数にするので分割してもAPIを変えない。

### 読取りと失敗

yamlはquality-input.tsと同じ遅延createRequireで読み、parseDocumentのprettyErrors:falseと既定YAML 1.2/core・uniqueKeys・mergeなしを使う。errorsかwarningsを拒否し、toJSのmaxAliasCount:100を維持する。rootはplain objectでexpected_specだけとし、未知欄・merge欄・自己申告PINを拒否する。非JSON・循環値を含め、例外は日本語のproblemsへ変換する。REQ-377の構造失敗はその問題を保持して返す。

### 全15件数とdigest

rows・owners・scenarioMap・currentNull・moved・renamed・superseded・open・supersessions・supersessionRefs・supplements・adoption・testRefs・uniqueTestRefs・crossを構造照合済みの基準から数える。一意の試験参照はfile/nameの組で数える。固定件数の違いを項目ごとに示し、canonical sha256もpinと比較する。失敗はbaselineとsha256がnull、成功はC1の凍結した値を返す。どちらもadoptionsVerified:false。対象が示す固定値は根拠にしない。

### 試験と分割配分

既存trusted-baseline.test.tsのfixtureと同じ原14文書・全原集合を新試験内に構成し、既存ファイルを変更しない。成功、非破壊と凍結、構造だけでは通る件数・値の変異、自己申告、YAMLの全拒否経路、構造失敗を確かめる。scalar anchorの100/101回はライブラリを先に実測する。合成データであることを明示し、C001の実候補・採否や409参照の受入としない。

### 移管元S1の原文

R15 §5に従い、S1設計§3を全文保持する。以下は全体の設計の写しで、未接続のC3以降の実装済みという主張ではない。

### 3. 初回集合と有効 baseline（REQ-371）

親の `verification.yaml.expected_spec` に baseline 本体、`verification-adoptions.json` に追記専用の連鎖を置く。本体と連鎖を分けて hash の循環を避ける。原本は A の `scripts/trusted/original-c001/specs/` に固定した14文書から独立に復元する。originalRef `bb88fe238ab0254e34d25dd8caeb19e8d0155cc4` は歴史的な出典として保持する。原47契約・158 Scenario・46 Source・16条件の範囲は変えない。既存の監査索引は照合の補助とし、対象 PR が置いた索引だけを信頼しない。

| 項目 | 保持する内容 |
|---|---|
| identity | capability・operation・REQ の組47件。cli/REQ-041 と verify/REQ-041 を混ぜない |
| 原文 | original ref/path/line/name と全158 Scenario の対応。46 unique Source・16横断条件 |
| owner | delta・main-unchanged・archived と file/name/block hash、採否、Scenario 対応 |
| 履歴 | supplements・supersessions・resolved は削除しない。open は残すか具体的な修理として resolved に移す |
| 試験 | root 相対 POSIX file と実際の fullName の組。16条件にも対応試験を持つ |

現在の10 delta の47 block・154 Scenario・45 Source は元集合と母集団が違う。数合わせで消したり追加したりせず各 original を対応させる。REQ-324 の owner は scope と evidence の2つ、303/305/307 は shape とする。REQ-042 は主仕様の unchanged block と REQ-312・311/040 の補完を持ち、PR217 の明示 ci 拒否案の撤回を保持する。REQ-038 の公開分類と042の API gate は open のまま初期化する。親1.2の文書整理や PR296 の入力復元で製品の open を閉じない。

R11 の原文書はバイトを変えずに保存し、J が A の Git object から読む。A から build した `trusted/original-snapshot.ts` の定数は論理path・copy path・バイト長・sha256・Git blobの14件を固定する。純粋な検証器がpath集合、通常mode100644、blob、UTF-8バイト長とsha256を再計算してから論理pathへ写し、原scopeを復元する。scopeにはcanonicalな文書manifestのdigestも結ぶ。Mcのコピーやmanifestを基準に選び直さない。原文書・manifest・検証器は既存の閉包に含み、Mcの変更は不足、A側の不一致は基準未確定のaborted runtime/3とする。

初回S1はTを通らない。管理役による元blob・sha256との一致の実測、CIの内部整合、独立レビューを証跡に残す。これを原commitからの暗号学的な来歴証明とは呼ばず、commit本文・履歴・bundle・作者情報は保存しない。文書manifest・index・scopeのdigestをliteralの新規試験で固定し、原本のすり替えを検知する。原commit不在の新規repository、shallowとautocrlf、改変・欠落・追加・mode差・CRLF・BOMの境界を試験する。

初回基準で元Scenarioの現対応が無いときは、R6のnullableを使い、statusを元義務の保持を表すkept、currentをnull、openを必須とする。現在の対応があるkeptはScenario名も一致させる。nullを置換済みや実装済みへ読み替えず、元158対応と未対応による不足を残す。構造・所有だけの検証結果は採否の権限や新しい試験実行の成立を示さない。

既存38群の採用は、親traceのADOPT-PR197-01〜27・ADOPT-PR199-01〜11の回答済み行へ一対一で記録する。元の群ラベルだけを回答と推定せず、元表の全セルと採用範囲を保持する。R6のAdoptionRefはこの実在IDを使い、作者・未編集コメント・具体差分の結合はtask2.3で検証する。

同名で本文の異なる10Scenarioは、元indexと全owner blockのhash、句ごとの補完・置換・openで扱い、新しいScenario hash欄は追加しない。REQ324のhtml/xml原例の同名はDUP324として未対応を残し、多重度を一意参照と扱わない。

元REQ100の変更なし停止を補う主仕様REQ331は、元100行の追加ownerとしてfile・name・全block hash・Scenarioを固定し、元47identityを増減しない。REQ114の全文ScenarioはDraftを保持している。producerと保護されたREQ116のargv期待値にdraftがない実装差は公開側の修理残へ残し、S1では期待値を変えない。

R10の照合では158 Scenarioのうち名前の一致しない17件を句ごとに扱う。後続採否による置換はPR217のbare明示ciとS9-02の固定確認者を保持する。型付きonLimit、停止優先順位と観測、local partialの完了・再利用、API scope、mode出力とlegacy独立、bare案内の未対応はopenに残す。Q-01の品質検査ci限定と構造NAの設定出典は句ごとの採否を記録するまで未対応とする。REQ-183は理由付き不合格を要求するがliteralなv2 FAILの指定とは読まず、制限停止の公開分類との対応をS2に残す。既存038/042もS1の内部試験では解消しない。

初回の試験参照は実file/fullNameとassertionで選ぶ。意味を確認した既存のタグなし試験もScenarioの補完に使えるが、各47identityのID付き試験とR8の新しい解消の規則は維持する。REQ-324の重複fullNameは参照不可として記録し、46原caseや既存試験を省略・改名しない。過去の受入済みreportは候補に限り、新しい実装headの全体reportで一意な成功を確かめる。

J は A の baseline・連鎖・作者表・原契約・owner・採否を検証して B_A と hash H_A を確定する。Mc の同じファイルは A の parser でデータとして読む。その後、ExpectedSet を作る前に有効集合 B_eff を選ぶ。

1. 本体と連鎖がともに A と同一なら B_eff=B_A。
2. 本体が変わった場合は、元の連鎖が完全な prefix で、追記がちょうど1件、from=H_A、to=hash(B_Mc)、pr=今回、actors=固定表の hash であり、既存の採否コメントと trace の行が一致するときだけ B_eff=B_Mc。
3. 本体だけ・連鎖だけの変更、複数追記、不正な形、採否不一致は不足とし、B_A に戻して判定を続けない。
4. original identity/本文/158対応/16条件を不変とする。owner の移動には検証済み spec binding が必要。supersession の追加には採否を要し、既存の履歴は減らせない。open の単純削除、Source・Scenario・試験の欠落は CRITERIA_RELAXATION とする。
5. B_eff の owner を、anchor なら A、target-transition なら Mc の実体と照合する。A と Mc の owner を混用しない。

子 X の ExpectedSet は X が owner の行、親 C001 では47行と16条件の全体から作る。必須 Source は対象行の Source と target delta の ADDED/MODIFIED の Source の和集合であり、親の現在の3 Source に限定しない。tests、resolved の試験、replacedTests、open、B_eff の hash を同じ集合から作る。J は B_eff と ExpectedSet を artifact として S に渡し、job output の hash と criterion の D に結ぶ。


## Risks / Trade-offs

既定alias予算を実測する。C2bは実候補の所有hashが変われば設計へ戻る。C2aの固定値引数は基準側の責任であり、利用者が自己指定して採否検証済みとするAPIへ公開しない。

## Migration Plan

通常L3で実装・受入・同期・archive後にC2bを再開する。全データ・元6試験・全採否・REQ-378全5 Scenario、C3以降とS1の全条件を保持する。
