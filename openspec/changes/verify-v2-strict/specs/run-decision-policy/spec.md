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

#### Scenario: 完了ゲートにciの結果が来る
- **WHEN** 完了ゲートの検証結果がscope:ciで返る
- **THEN** ローカルの完了として扱わず、再修正のエンジンも呼ばずに理由を記録して停止する。ciのPASSをCI最終合格に変換しない
