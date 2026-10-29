## MODIFIED Requirements

### Requirement: 完了ゲート後の純粋な判断
runnerは、観測済みの作業状態の変更、v2検証のscope・実行状態・decision・完了状況、中断、期限超過、実施済みの修正回数と上限から、合格・再修正・停止を返す純粋関数を持つ SHALL。作業状態が変わったら最初に止まり、decision.requiredまたはabortedでも自動修正へ進まず止まる SHALL。変わらず要判断がなくlocal項目が全完了ならDraft PRへ進む SHALL。不合格で中断があればinterruptedの状態で止まり、期限超過なら停止し、それ以外でも修正回数が上限以上なら停止し、未満なら再修正する SHALL。要判断もabortedもないlocal完了の場合は、修正回数や期限超過の記録より完了を優先する SHALL。

Source: REQ-205

#### Scenario: 合格と状態変更
- **WHEN** 検証は合格だがHEADかブランチが変わる
- **THEN** 停止を選ぶ

#### Scenario: 修正回数と期限
- **WHEN** 検証が不合格で修正回数が上限の直前・一致・超過となる
- **THEN** 直前だけ再修正し、一致と超過は停止する。期限超過があれば回数より優先して停止する

#### Scenario: 合格の優先
- **WHEN** 作業状態が変わらず合格している
- **THEN** 修正回数の上限や期限超過の記録があっても合格を選ぶ

#### Scenario: 品質コマンドの中断
- **WHEN** 作業状態が変わらず完了ゲートが不合格で、品質コマンドが中断された
- **THEN** 再修正のエンジンを呼ばずinterruptedで止まる。検証中の状態変更と合格の優先順位は維持する


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
