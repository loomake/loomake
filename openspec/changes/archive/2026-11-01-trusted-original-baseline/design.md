# Design: trusted-original-baseline

## Context

Opusの2026-11-01の分割設計§2 C1と§3 C1に従い、S1の原本読取り・復元・構造照合を独立して受け入れる。原14文書はPR #306でmainへ受入済み。参照する実装はS1の固定版で、製品コード9ファイルと試験6ファイルに限定する。

## Goals / Non-Goals

この子は固定入力から返すmanifest・復元集合・候補の構造照合を完成させる。REQ-376/377を満たしても、S1の6要件・28 Scenario・14タスク、親C001の全契約、T PASS・live・S2の受入は完了しない。

具体的なC001初回候補の公開と採否主体・API・連鎖・有効基準の検証は後続で行う。既存の公開API・JSON・CLI・run.ts・依存・品質設定・保護期待値は変えない。

## Decisions

### 元の本文を保って移管する

| 要件 | 実装 | 試験 |
|---|---|---|
| REQ-376 | canonical.ts・git-objects.ts・spec-manifest.ts | trusted-git-objects・trusted-spec-manifest・trusted-main-spec-manifest |
| REQ-377 | original-snapshot.ts・original-contracts.ts・original-cross-conditions.ts・baseline-types.ts・baseline-shape.ts・baseline.ts | trusted-original-snapshot・trusted-original-contracts・trusted-baseline |

実装は`packages/kit/src/verify/trusted/`、試験は`tests/`に置く。packageの公開exportsへは追加しない。初回移管では元S1版から全実装blobと各試験callback本文を照合し、試験名には新しい要件番号だけを加える。元の370/371タグ、期待値、期限、skip条件を保持する。既存109件のcallbackは不変とし、バイト上限・ADDED・入力不変を直接確認する3試験（T-A/B/C）を追加する。baselineのJSON境界3宣言には376タグも加える。未登録タグを理由に元タグを置き換える案は採らない。

### 原本と所有の根拠を分ける

原本は`ORIGINAL_C001_SNAPSHOT_DIR`の14文書を固定manifestと照合し、論理的な原pathへ戻して復元する。元commitをremoteから取得する必要はなく、原commit本文・作者情報も追加しない。固定manifestと現在の候補を同時に書いたことを独立した採否検証とは呼ばない。

差分manifestは変更種別を必須とし、主仕様のunchangedは別の入口で扱う。所有本文は公開parserの開始行と全Scenarioを含むhashで照合する。JSONの非列挙欄・Symbol・配列追加欄・getterを落とす直列化は使わない。

### 構造照合の責任を限定する

初回候補は閉じた形で読み、原47 identityと158 Scenario、16条件、所有本文、補完と置換、open、非空の採否参照、ID付き試験参照を照合する。正例は原14文書から作る独立fixtureであり、現在のC001具体候補の受入票ではない。

主体の固定対応、GitHub API、コメントの編集状態、新しい実行の一意なfile/fullNameは後続の責任である。構造成功でも`adoptionsVerified:false`を返し、結果を防御的に複製・凍結する。

### 通常の受入を使う

この子だけを`loomake-change: trusted-original-baseline`として宣言し、通常のlocal done、ci gate、必須5チェック、3OS、別担当の自己レビューと独立Opusを通す。親C001のtasks・記録とS1の規範はこのPRで変更しない。同期とarchiveの段階は実差分で判定し、L1と決めつけない。

### 公開レビューで見つかった既存仕様の漏れを直す

自動Codexの指摘4435217459を採用し、REQ-377の集合重複拒否へ合わせる。`baseline.ts`に補完参照の一意性検査を加え、同じ有効参照1件は受理し、同じ参照2件は拒否する追加回帰T-DでREDからGREENを確かめる。8実装のblobと既存53宣言のcallback・入力表・期待値・期限は保持し、`baseline.ts`だけの修理差分を別に照合する。最初の3追加試験も保持し、全113ケースで検証する。

2要件・全10 Scenarioと原集合は変えない。Opusの元設計にある集合の重複拒否という受入条件を再利用し、私的部品の境界や入出力は追加しない。旧headのCI・レビューは履歴として保持し、修理後のheadで通常検証と必要なレビューを行う。統合前の別の残条件は[Issue #310](https://github.com/loomake/loomake/issues/310)で追跡する。

### 置換に関する集合の重複も拒否する

補完参照のT-Dを保持して17箇所の正例と重複を照合したところ、置換レコード、Scenario置換の採否参照、句置換の採否参照の3箇所は重複を受理した。REQ-377の集合重複拒否へ合わせ、既存のcanonicalな一意性検査を各箇所へ加える。正しい1件は受理し、同じ記録や参照を複製した入力は拒否して基準とdigestを返さない。追加回帰T-E/F/Gで修理前の失敗と修理後の成功を確認する。

元の8実装blob・53試験宣言と、追加済みT-A〜Dのcallback・期待値・入力表・期限を保持する。製品の修理は引き続きbaseline.tsだけで、この段階の全116ケースを確認した。2要件・10 Scenario・原集合・公開API・設定は変えない。当時送信承認待ちだった8363とその依頼は別の固定worktreeに保持し、同じ担当がこの隔離worktreeで追加修理する。並行するchangeや担当は増やさない。

### 同じ句の異なる記録を重複として拒否する

自己レビューの軽微1は、同じclauseに異なるbyまたはownerを付けた記録が受理される点である。REQ-377の集合重複拒否へ合わせ、supersessionsとopenの識別子をclauseとし、同じ句の2件を拒否する。採否の複数参照は同じレコード内のby配列に保ち、句の二重記録で表さない。各正常な1件が受理されることと、異なる採否/ownerでも同じ句が拒否されbaselineとdigestを返さないことを、新T-H/IでREDからGREENへ確認する。

8実装blobと既存60宣言、元53宣言と追加T-A〜Gのcallback・入力・期待値・期限を保持する。baseline.tsの2つの識別子を直し、追加のarchive修理も含めて全119関連ケースと通常品質・local done、修理後の自己レビューと独立最終レビュー・3OS CIを確認する。今回と後続headの同じ24ファイル・2要件10 Scenarioでの送信/公開は、利用者が本会話の質問call_c55b70faへ明示承認した。


### archive所有先の省略形と明示形の重複

自動Codex指摘4435476339を採用する。ownerBlockがarchive pathからchangeを解決し、本文・Scenarioまで照合した後で、実fileとRequirement名の組が一意か確認する。既存の入力側の重複検査や不正change拒否は残し、正規化用の別parserや公開APIを追加しない。新T-Jは明示形と省略形が各1件なら受理され、両方を同じ所有先へ並べた候補はbaselineとdigestを返さないことをREDからGREENへ確かめる。元62宣言と8実装blobを保持し、新しい拒否検査1行と新1宣言だけを加える。


### 採否参照は識別子で一意にする

所有のadoption、Scenario置換のby、句置換のbyに同じ識別子を使う。traceは種別・change・id、commentは種別・pr・id、prBodyは種別・pr・lineをキーにする。内容hashは参照の固定値であり別IDにはしない。rawとsha256:付きの表記や異なるhashでも、同じIDの2件を拒否する。入力値とcanonical digestの規則は保持し、hashをpayloadから消したり書き換えたりしない。新T-Kは3配列×4変種の12ケースで、各単一入力・異なるID2件の受理を保ち、同じIDの2件だけを拒否する。

元63試験宣言と8実装blob、既存の期待値・期限・設定を保持する。私的なキー関数と3selectorをbaseline.tsへ置き、公開API・型・依存を変えない。Q06/07を回答内容不変で表内へ移し、追加Q08を含む実読取り14件も確認する。

### 324も照合済みのchangeで両所有を判定する

archiveのchangeはpathから解決する既存規則を324にも適用する。ownerBlockの私的な結果に解決済みchangeを保持し、両所有はその結果で照合する。main-unchangedなどchangeのない所有はJSONにできるnullとして扱い、324の両所有として拒否する。新T-Lの4ケースは明示形・片方省略・両方省略の受理と、各ケースの片側欠落の拒否を確かめる。入力のpayload・hash・公開型・既存の期待値・期限・設定は変えない。

### Gitメタデータと文書のバイト予算を分ける

Opusの修理設計に従い、型・tree一覧・sizeの3出力には既存DOCUMENT_LIMITS.maxTotalBytesの16MiBを使う。本文は引き続き呼出し側のsize・合計予算を読取り前に検査する。メタデータのENOBUFSだけを日本語で区別し、ほかのGitエラーと期限の接続はIssue #310へ保持する。新T-Mは1 byte・空本文の正例、ファイルと合計超過時に本文を余計に読まない負例、3操作の有限上限と本物のENOBUFSの識別を検証する。観測用の包み関数は、本物のexecFileSyncへ同じ引数を転送し、新しい回帰で指定した操作だけ上限1で実行する。既存のcallback・期待値・期限・設定を変えない。初回移管時のblob一致は履歴として保持し、今回のgit-objects.tsの設計済み修理を別に照合する。

### 移管元S1の設計本文を保持する

採用済みR15の§5に従い、S1設計の§2のmanifest部分と§3を以下へ本文のまま写す。C1が完成させるのは原本・復元・構造照合の内部契約で、具体データ・採否・有効基準・新実行・統合はR15の後続の子とS1本体へ残る。原文のA/Mc/Jなどの全体の責務をC1の完了済み実装とは扱わない。

#### S1 §2のmanifest部分（原文）

`trusted/spec-manifest.ts` は `parseSpec` が返す開始行を唯一の block 境界に使う。CRLF/CR を LF にそろえ、開始行を0-basedにし、次の開始行の直前まで、最後は `lines.length` まで切り出す。末尾の空白行だけを除く。EOF に改行がなくても最終行を必ず含む。fence 内の見出しは開始行にしないが本文の byte は hash に含む。block を同じ operation の差分として再解析し、件数1・name・Source・Scenario 数が一致することも確認する。

manifest は change ごとに `{version,change,files,blocks,requiredSet}` を持つ。block は operation・name・FROM・Source・Scenario 数・開始行・hash、file は正規化した全本文の hash を持つ。集合は整列し重複を拒否する。canonical JSON は object の key を再帰的に辞書順にし、配列の意味上の順を保持して UTF-8・空白なしで直列化する。hash は sha256 とする。公開 parser と schema は変更しない。

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

- Git読取りはC1では試験からだけ呼ぶ未接続の部品である。verify・CLIへ統合する前にREQ-180/183の期限・出力予算へ接続し、不正UTF-8の拒否も保持する。既存規範の免除や統合済みという意味ではない。

- 構造成功が承認済みと誤読されるおそれがあるため、戻り値と試験に未検証の主体を明記する。
- callbackのタグ追加でfullNameは変わるため、後続の初回データは新しい全体reportから参照を確認する。旧reportを新headの適格な実行とは記録しない。
- WindowsのGit・CRLF・一時repositoryを3OSで確認する。元の期限を延ばして成功させない。
- PRが200KiBを超えた場合は設計のC1a/C1bに分ける。集合・試験・受入を削って収めない。

## Migration Plan

私的部品なので利用者の移行操作はない。受入後はこの子を同期・archiveし、後続のデータと採否の子で利用する。S1本体は子の全受入を待ち、最後に通常DoDと統合試験を通す。
