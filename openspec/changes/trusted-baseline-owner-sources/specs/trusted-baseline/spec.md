## ADDED Requirements

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
