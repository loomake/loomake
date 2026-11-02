## MODIFIED Requirements

### Requirement: 完了ゲート後の純粋な判断
runnerは観測済み作業状態、v2検証、中断/期限、修正回数と上限から純粋に合格・再修正・停止を返す SHALL。状態変更を最優先とし、必須の検証後状態が実観測不能なら原因順で停止する SHALL。既知不変で要判断/abortedがなく正規のscope:localでpending=fail=0ならcompleted/partialを問わず中断/期限/回数の記録より完了を優先する SHALL。それ以外は理由なし利用者中断をinterrupted、理由付き中断、usage/configのaborted、期限、他のaborted、不正結果またはscope:ci、要判断、回数上限の順で停止し、未満なら再修正する SHALL。checks/summary不一致や旧形式を不正とし、制限原因は実操作の型付き観測から取り文言や保存JSONから推測しない MUST。呼出し側は閉予算後の観測Gitを起動しない MUST。

Source: REQ-205

#### Scenario: 合格と状態変更
- **WHEN** local項目は全完了だがHEADかブランチが変わる
- **THEN** 停止を選ぶ

#### Scenario: 修正回数と期限
- **WHEN** 検証が不合格で修正回数が上限の直前・一致・超過となる
- **THEN** 直前だけ再修正し、一致と超過は停止する。期限超過があれば回数より優先して停止する

#### Scenario: 合格の優先
- **WHEN** 作業状態が変わらず、scope:localの項目が全完了で、要判断もabortedもない
- **THEN** 修正回数の上限や期限超過の記録があっても純粋判断はローカル完了を選ぶ。実際のDraft PRへの進行はREQ-105/182/208と検証後状態の観測可能性に従い、ciの最終合格と表示しない

#### Scenario: 品質コマンドの中断
- **WHEN** 作業状態が変わらず完了ゲートが不合格で、品質コマンドが利用者の中断（理由なし）で止まった
- **THEN** 再修正のエンジンを呼ばずinterruptedで止まる。検証中の状態変更と合格の優先順位は維持する


#### Scenario: abortedでは自動修正しない
- **WHEN** 作業状態が変わらずverifyがusage/configまたは実行エラーのabortedを返す
- **THEN** local完了や再修正へ進めず、実行エラーの理由を記録して停止する。修正回数が残っていても修正エンジンを呼ばない

#### Scenario: 既存優先順位と観測を保持する
- **WHEN** 状態不変のlocal完了と中断記録/期限/回数上限が重なる、または未完了のFAIL/不足それぞれと中断/期限/回数が重なる
- **THEN** 前者は観測を消さず完了を優先し、後者は同じ優先表で停止か再修正を選ぶ。旧13ケースの観測と期待文言を保持し、正規partialのpending=fail=0も同じに扱う

#### Scenario: 予算終了後に作業状態を観測できない
- **WHEN** 実操作の中断通知か共有予算の残り0により、必須の検証後状態を観測できない
- **THEN** Gitを追加起動せず観測不能として停止し、一時完了印を戻す。原因が重なれば利用者中断、理由付き中断、期限、不明の順とする。理由なし中断でlocal未完了ならinterrupted/「中断されました」を保ち、local完了時だけその事実をlastVerify/reasonへ付記する。理由付き中断は理由付きstopped、期限は期限理由のstoppedとする。単なるpartialやtimedOut記録で既知の不変状態を観測不能へ変えない

#### Scenario: 監視異常とabortedの競合
- **WHEN** 理由なし中断、空文字を含む理由付き中断、usage/configまたは他のaborted、期限、decisionが競合する
- **THEN** 本文の順で理由と状態を選び、理由付き監視異常を利用者中断へ変えず、decisionとFAILの内容も保持する。停止時は修正エンジンを呼ばない

#### Scenario: 不正な結果とciは停止する
- **WHEN** runnerへscope:ci、checks/summary不一致、旧1.0.0など正規でない結果が渡り、状態は不変で中断/期限/abortedがない
- **THEN** localゲートとして扱えない理由で停止し、修正回数が残っていてもエンジンを呼ばない。正規local completed/partialの完了は同じ優先順位で受け付ける

## ADDED Requirements

### Requirement: runnerのv2判定追従
runnerは準備と完了確認にv2 APIを使い、ローカル完了をscope:localとして扱う SHALL。decision.requiredなら終了コードだけで再修正を続けず理由を記録して停止する MUST。旧ok:trueやlocalの0をCI最終合格として使わない MUST。公開RunSummaryの既存外形と停止・予算・中断・変更保持の制約は維持し、lastVerify.okはそのローカル確認の完了だけを表す SHALL。CI成果物の取得・ready化全体は後続とする SHALL。

Source: REQ-317

#### Scenario: 要判断とFAIL
- **WHEN** v2にdecision.requiredとFAILが同時にある
- **THEN** FAILの内容と判断理由を保存し、自動修正エンジンを追加で呼ばず停止する

#### Scenario: localの完了と旧証拠
- **WHEN** localが完了する、または旧verify 1.0.0だけが存在する
- **THEN** 前者はDraft PRへ進むための完了として扱い、後者を自動再利用しない。どちらも最終CI合格に変換しない
