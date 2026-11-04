# trusted-baseline Specification

## Purpose

固定したGit文書から仕様と原契約の構造を復元し、初回基準の候補と照合するための部品を提供する。対象側の作業ファイルや自己申告だけで所有本文を確定せず、構造の一致と採否主体の検証を区別する。

## Requirements

### Requirement: 固定Git文書と仕様manifestの構成

システムは完全なcommit SHAから通常のGit文書だけを読み、checkoutと置換参照に依存しない SHALL。危険なpath・不正UTF-8・通常file以外・文書予算の超過を拒否する MUST。JSONの配列順を保ちobject keyを整列し、JSONでない値やgetterを拒否する SHALL。差分仕様と主仕様を区別し、全文・Source・Scenarioを含むmanifestを構成する SHALL。

Source: REQ-376

#### Scenario: 固定commitから文書を読む
- **WHEN** checkoutが変更されても、完全なcommit SHAと安全なpathで文書を要求する
- **THEN** 指定したGit objectの本文・mode・blobを返し、作業ファイルや置換参照の内容を使わない

#### Scenario: 不正なGit入力を拒否する
- **WHEN** 不完全なSHA、危険なpath、不正UTF-8、symlink・submodule、または文書の件数・深さ・バイト予算を超える入力を渡す
- **THEN** 通常文書として読み取らず、失敗を返す

#### Scenario: JSONの情報を黙って落とさない
- **WHEN** 通常のJSONと、循環・未定義値・非有限数、objectの特殊prototype・Symbol・非列挙欄、疎な配列・追加欄・getterを持つ入力を渡す
- **THEN** 通常JSONはobject keyだけを整列し、ほかの入力はgetterを実行せず拒否する

#### Scenario: 仕様の境界を保持する
- **WHEN** fence、CRLF、改行のないEOF、連続Requirement、ADDED・MODIFIED・REMOVED・RENAMEDを含む差分仕様を渡す
- **THEN** 公開parserと同じRequirement境界と変更種別を使い、Scenario本文を含む全文とSourceの集合を照合できるmanifestを返す

#### Scenario: 差分仕様と主仕様を区別する
- **WHEN** 変更種別のない主仕様と差分仕様をそれぞれ対応する入口へ渡す
- **THEN** 主仕様のunchanged本文を照合でき、変更種別のない本文を差分仕様として受け入れない

### Requirement: 原契約の復元と初回候補の構造照合

システムは固定した全14原文書のbytes・mode・blob・hashを照合し、47 identity・158 Scenario・46 Source・16横断条件を独立復元する SHALL。初回候補の原契約・所有本文・Scenario対応・補完・置換・未対応・採否参照と試験参照の構造を照合する MUST。042 unchanged、324の両所有、038/042の未対応を保持し、未知欄や集合の欠落・追加・重複を拒否する SHALL。成功時も採否主体を検証済みとしない SHALL。

Source: REQ-377

#### Scenario: 原commitがないcheckoutで原集合を復元する
- **WHEN** 原commitを持たないrepositoryで、固定manifestと一致する14文書を渡す
- **THEN** 同じ47 identity・158 Scenario・46 Source・16横断条件を復元する

#### Scenario: 原本の不一致を拒否する
- **WHEN** 原文書の本文・mode・blob・BOMや文書集合が固定値と一致しない
- **THEN** 復元した集合を基準として受け入れない

#### Scenario: 各所有本文と元Scenarioを照合する
- **WHEN** 元集合を保つ候補と、その差分・主仕様・archiveの所有文書を渡す
- **THEN** 全所有本文と元Scenarioの対応、補完先、置換の参照、ID付きの試験参照を構造として照合し、同じSourceが別capabilityにある契約も区別する

#### Scenario: 未対応を保持する
- **WHEN** 042のunchanged、324の両所有、038/042の未対応、または元契約の対応を候補から消す
- **THEN** 構造不一致を返す。現Scenarioがない元義務は、元の集合と明示した未対応を保つ場合だけ記録できる

#### Scenario: 構造成功と採否主体を区別する
- **WHEN** 候補の構造照合に成功する
- **THEN** 入力と共有prototypeを変えず、防御的な結果を返す。採否主体・API・新しい適格な試験実行を検証済みとせず、adoptionsVerifiedはfalseのままとする

### Requirement: 初回基準の所有先と原Sourceの対応

システムはC001の初回基準に構造照合を適用したあと、渡された本文で各所有先のRequirementを再照合し、所有先のcapabilityが原契約と一致することと、各行の1件以上の所有先が原Sourceを持つことを求める SHALL。原Sourceを持たない所有先は、コード側に固定した例外の行・種類・file・名前・block hash・Scenario・Sourceと全一致し、例外SourceのID付き試験が行にある場合だけ受け入れ、未使用の例外も拒否する MUST。成功時も採否主体・trace行・Git由来・新しい試験実行は未検証とする SHALL。

Source: REQ-388

#### Scenario: C001の実記録を受け入れる
- **WHEN** C2bの実記録、原14文書、所有文書を渡す
- **THEN** 全capabilityが原契約と一致する49件を凍結して返す。原Sourceを持たない所有先はREQ-100の主仕様REQ-331だけで判断ラベルQ-S1-14を示す。入力は変えずadoptionsVerifiedはfalseとする

#### Scenario: 別capabilityの所有先を拒否する
- **WHEN** 同じ本文を別capabilityのactiveまたはarchiveへ置き、所有先と対応先を合わせた構造照合が通る候補を渡す
- **THEN** 行とfileを示して拒否する。同じchange・capabilityのarchiveへの移動は受け入れる

#### Scenario: 原Sourceのない所有先だけの行を拒否する
- **WHEN** REQ-093の所有先をREQ-331へ置き換え、構造照合を通る候補を渡す
- **THEN** 原Sourceを持つ所有先がないことと固定した根拠がないことを示して拒否する。REQ-100の例外を他の行へ広げない

#### Scenario: 固定した例外との不一致を拒否する
- **WHEN** REQ-331の所有先を消す、別blockへ置き換える、または行からREQ-331のID付き試験を除いた構造照合が通る候補を渡す
- **THEN** それぞれ未使用の例外、固定した根拠の不一致、試験の欠落を示し、bindingsをnullとする

#### Scenario: 記録側の採否の自己申告を受理根拠にしない
- **WHEN** 固定例外にない原Sourceを持たない所有先を足し、同じ行のadoptionへQ-S1-14参照を足す
- **THEN** 所有先を拒否する。記録側の採否参照をコード側の固定根拠へ昇格しない

#### Scenario: 構造照合の失敗を引き継ぐ
- **WHEN** 所有文書の欠落・本文1字変更・null入力を渡す
- **THEN** 例外を投げず構造照合の日本語のproblemsを保持し、bindingsをnull、adoptionsVerifiedをfalseとする

### Requirement: 原本照合済みの文書だけによる初回基準の照合

システムは初回基準の構造照合とC001記録照合の私的入口で、原文書をGitの本文・mode・blobの形で受け取り、内部のsha256で全14原文書の集合・path・mode・blob・バイト長・hashを固定値と照合し、照合に成功した文書だけを構造照合または記録照合へ渡す SHALL。原本の照合に失敗したら候補を照合せず、基準とdigestをnull、adoptionsVerifiedをfalseとして原本の問題だけを返す MUST。入口はhash関数・論理原文書・記録の固定値を引数に取らず、記録照合には基準側のC001固定値を使う SHALL。成功してもGit由来・指定commitと所有文書の来歴・採否主体・新しい試験実行を検証済みとせず、本入口の保証を低位の照合の直接呼出しへ広げない SHALL。

Source: REQ-389

#### Scenario: 固定原本で既存の結果を保つ
- **WHEN** 固定14原文書、C001の実記録、所有文書を各入口へ渡す
- **THEN** 低位の照合と同じ凍結した基準とdigestを返し、入力を変えず、adoptionsVerifiedをfalseのままとする

#### Scenario: 改変原本と追従した候補を拒否する
- **WHEN** 原文書の本文を同じバイト長で変え、候補の原契約indexをそれに合わせ、blobは元の値のまま渡す
- **THEN** 低位の構造照合なら通る組でも原本の問題を返し、基準とdigestを返さない

#### Scenario: 構造が変わらない原本の改変も拒否する
- **WHEN** 原契約indexが変わらない原本の改変を、固定値と一致する記録と渡す
- **THEN** 低位の記録照合なら通る組でも拒否する

#### Scenario: 原本の不一致を構造の成功と取り違えない
- **WHEN** 原文書の欠落・追加・重複・mode・blob・CRLF・BOMの不一致と、不正な候補を一緒に渡す
- **THEN** 原本照合と同じ問題だけを返し、構造照合・記録照合の結果も問題も返さない

#### Scenario: 照合済みの原本での失敗を保持する
- **WHEN** 固定原本と、構造または記録の固定値が一致しない候補を渡す
- **THEN** 低位の照合と同じ日本語の問題を返す

#### Scenario: 入口の引数を限る
- **WHEN** 各入口を呼ぶ
- **THEN** 受け取るのは原文書・候補または記録・所有文書の3つだけで、hash関数・論理原文書・固定値を渡す引数を持たず、各原文書の欄を一度だけ読んで照合と後段に同じ値を渡す

### Requirement: 既定予算での文書sizeの一括照会

システムは既定文書予算と4値が一致し、tree の全行が通常 file・安全な path・許可された深さの2件以上の文書を読むとき、size を1回の Git 照会で tree 順に取得する SHALL。本文・予算・UTF-8 の判定は文書ごとの順序と結果を保ち、重複 blob も別文書として数える MUST。不正応答・欠落・通常の終了コード非0では旧方式で全体を読み直し、メタデータ上限・signal・期限・中断・起動失敗では後続を始めない SHALL。ほかの予算・単一文書・不適格な tree では旧方式を使う SHALL。

Source: REQ-418

#### Scenario: 既定予算の複数文書をまとめて照会する
- **WHEN** 既定と同じ4予算値で、重複 blob・実行可能 mode・BOM・空文書を含む複数文書を固定 commit から読む
- **THEN** size を1回で照会し、文書ごとの照会と同じ path・本文・oid・mode を tree 順で返し、checkout と置換参照を使わない

#### Scenario: 文書ごとの照会と同じ順序で拒否する
- **WHEN** 先の文書が不正 UTF-8・ファイル上限超過、後の行が不適格か、既定合計16MiBと等しい入力または1 byte超の入力を読む
- **THEN** 先の失敗を保持し、合計の等値は受け入れ、重複 blob も加算して1 byte超では超過本文を読まずに拒否する

#### Scenario: 照会結果の不一致と通常の失敗で読み直す
- **WHEN** 応答の行数・末尾・OID順・blob型・安全な非負整数 size が不正、不正 UTF-8・非ASCIIを含む、object が欠ける、または signal なしの数値 status 非0で終了する
- **THEN** 応答を使わず全体を旧方式で判定し、batch 固有の未対応 option でも旧方式で読める入力を受け入れる

#### Scenario: 一括照会の上限と中断を区別する
- **WHEN** 一括照会がメタデータ16MiB上限を超えるか、signal・期限・中断・起動失敗で止まる
- **THEN** 上限は既存のメタデータ上限エラーとし、その他は元の失敗を伝え、size 再照会や本文取得を始めない

#### Scenario: 適格でない入力では文書ごとに照会する
- **WHEN** 単一文書、既定と異なる tiny・custom・巨大な安全整数予算、通常 file 以外・不正 path・prefix外・深すぎる行を含む一覧を読む
- **THEN** 一括照会を使わず、先行文書の判定を含む既存の照会順・上限・拒否順を保つ
