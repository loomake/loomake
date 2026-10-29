## MODIFIED Requirements

### Requirement: 評価済み品質結果のCI集約

kit は評価済みの `readonly QualityResult[]` から CI verdict だけを返す named export `aggregateCiVerdict` を公開する SHALL。FAIL があれば FAIL、次に INSUFFICIENT_EVIDENCE があれば同値、PASS があり残りが PASS/NOT_APPLICABLE なら PASS、空配列と全件 NOT_APPLICABLE は INSUFFICIENT_EVIDENCE を返す MUST。順序と重複で結果を変えず、入力を変更せず、I/O・環境・時計を参照しない MUST。

API の説明には、評価済み入力の集約専用で、NA の理由・確認者と証跡適格性・個別条件は集約前の責務であり、証跡適格性や完了ゲート全体の最終合格を判定しないことを明記する SHALL。この集約関数の定義変更単独では件数・summaryの生成やverifyへの接続を行わない SHALL。呼出し側で件数・summary・verifyへの接続を定める別のchangeは、この単独変更の対象外とする SHALL。集約関数自身はverdictだけを返す契約を維持する MUST。

Source: REQ-306

#### Scenario: FAILが優先する
- **WHEN** PASS・FAIL・INSUFFICIENT_EVIDENCE・NOT_APPLICABLE を含む評価済み結果を渡す
- **THEN** FAIL を返す

#### Scenario: 証跡不足が優先する
- **WHEN** FAIL がなく INSUFFICIENT_EVIDENCE を含む結果を渡す
- **THEN** INSUFFICIENT_EVIDENCE を返す

#### Scenario: PASSがある
- **WHEN** PASS が1件以上あり、残りが PASS または NOT_APPLICABLE の結果を渡す
- **THEN** PASS を返す

#### Scenario: 対象がない
- **WHEN** 空配列または全件 NOT_APPLICABLE の結果を渡す
- **THEN** INSUFFICIENT_EVIDENCE を返す

#### Scenario: 順序・重複・入力保持
- **WHEN** 同じ種類の結果を順序と重複を変えて、読み取り専用の配列として渡す
- **THEN** 同じ verdict を返し、元の配列を変更しない

## ADDED Requirements

### Requirement: 限定した品質条件の純粋判定
kitは解析済みquality項目と、適格性・実施確認の結果を含む観測入力から4値と理由を返す純粋な判定を公開する SHALL。NAには理由と確認者を必須とし、未定義・未実施・取得不能・適格性未確認・targetまたは最低サンプル不足はINSUFFICIENT_EVIDENCEとする MUST。有効な必須証拠の条件違反はFAIL、必要証拠の全充足のみPASSとし、indicatorsは合格根拠にしない MUST。入力を変更せずI/O・環境・時計を読まない MUST。

Source: REQ-313

#### Scenario: 比較条件と最低サンプル
- **WHEN** 適格で実施を確認した有限の数値と <=・>=・==・<・> のtargetを、境界値・境界外・最低サンプル不足で渡す
- **THEN** 必須条件の充足・違反・不足を区別し、参考指標だけを満たしてもPASSにしない。適格な必須条件違反と別の証拠不足が同時にあればFAILを優先する

#### Scenario: 証拠の欠落と対象外
- **WHEN** evidence空・未実施・古いまたは適格性未確認の証拠・targetなし、および理由と確認者のあるNAを渡す
- **THEN** 前者は不足、後者はNAとなり、空配列の全件一致でPASSにしない

#### Scenario: 純粋性
- **WHEN** freezeした同じqualityと観測値を繰り返し渡す
- **THEN** 入力と順序を変更せず同じ結果を返す

### Requirement: 集約値と件数の一貫性
kitは既存の共有4値と集約規則を使い、FAIL、証跡不足、PASSの順で優先し、空と全NAを不足とする MUST。summaryはfail・insufficient・not_applicableをchecksの該当件数として持ち、localのpendingはローカルの未完了件数とする SHALL。evaluatedはPASS/FAIL/不足/NAを含む全checksの件数と一致する SHALL。decisionは品質判定と独立に保持し、NAや非blockingの指定で必須条件の違反を相殺しない MUST。

Source: REQ-314

#### Scenario: 集約と件数
- **WHEN** FAIL・不足・PASS・NAを含む項目を順序・重複を変えて評価する
- **THEN** 集約規則に従い、各件数はその実行のchecksと一致する。evaluatedはchecks.lengthと一致する

#### Scenario: localの未完了
- **WHEN** local項目に適格なPASS、確認済みNA、不足、FAILがある
- **THEN** 不足をpending、FAILをfailに数え、PASSと確認済みNAだけを完了とする。verdictを追加しない
