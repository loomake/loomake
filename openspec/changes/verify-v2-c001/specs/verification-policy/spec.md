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
kitは既存の共有4値と集約規則を使い、FAIL、証跡不足、PASSの順で優先し、空と全NAを不足とする MUST。summaryはfail・insufficient・not_applicableをchecksの該当件数として持ち、localのpendingはローカルの未完了件数とする SHALL。evaluatedの数え方はR-C001-02の回答を反映して確定する SHALL。decisionは品質判定と独立に保持し、NAや非blockingの指定で必須条件の違反を相殺しない MUST。

Source: REQ-314

#### Scenario: 集約と件数
- **WHEN** FAIL・不足・PASS・NAを含む項目を順序・重複を変えて評価する
- **THEN** 集約規則に従い、各件数はその実行のchecksと一致する。evaluatedの期待値はR-C001-02回答後に固定する

#### Scenario: localの未完了
- **WHEN** local項目に適格なPASS、確認済みNA、不足、FAILがある
- **THEN** 不足をpending、FAILをfailに数え、PASSと確認済みNAだけを完了とする。verdictを追加しない
