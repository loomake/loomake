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
