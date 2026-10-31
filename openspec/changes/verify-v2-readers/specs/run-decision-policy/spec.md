## MODIFIED Requirements

### Requirement: 完了ゲート後の純粋な判断
runnerは、観測済みの作業状態の変更、v2検証のscope・実行状態・decision・完了状況、中断、期限超過、実施済みの修正回数と上限から、合格・再修正・停止を返す純粋関数を持つ SHALL。作業状態が変わったら最初に止まり、decision.requiredまたはabortedでも自動修正へ進まず止まる SHALL。変わらず要判断がなくlocal項目が全完了ならDraft PRへ進む SHALL。不合格で中断があればinterruptedの状態で止まり、期限超過なら停止し、それ以外でも修正回数が上限以上なら停止し、未満なら再修正する SHALL。要判断もabortedもないlocal完了の場合は、修正回数や期限超過の記録より完了を優先する SHALL。

Source: REQ-205

#### Scenario: 合格と状態変更
- **WHEN** local項目は全完了だがHEADかブランチが変わる
- **THEN** 停止を選ぶ

#### Scenario: 修正回数と期限
- **WHEN** 検証が不合格で修正回数が上限の直前・一致・超過となる
- **THEN** 直前だけ再修正し、一致と超過は停止する。期限超過があれば回数より優先して停止する

#### Scenario: 合格の優先
- **WHEN** 作業状態が変わらず、scope:localの項目が全完了で、要判断もabortedもない
- **THEN** 修正回数の上限や期限超過の記録があってもローカル完了を選びDraft PRへ進む。ciの最終合格と表示しない

#### Scenario: 品質コマンドの中断
- **WHEN** 作業状態が変わらず完了ゲートが不合格で、品質コマンドが中断された
- **THEN** 再修正のエンジンを呼ばずinterruptedで止まる。検証中の状態変更と合格の優先順位は維持する

#### Scenario: abortedでは自動修正しない
- **WHEN** 作業状態が変わらずverifyがusage/configまたは実行エラーのabortedを返す
- **THEN** local完了や再修正へ進めず、実行エラーの理由を記録して停止する。修正回数が残っていても修正エンジンを呼ばない
