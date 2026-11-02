## Why

C001の初回記録を欠かさず固定するC2は、計画・全データ・元6試験だけで205,674 bytesとなり、通常上限204,800 bytesを超えた。取得済みOpus設計§9の案Sに従い、私的な読取り部品をC2aとして先に受け入れ、実データと採否はREQ-378のC2bへ残す。

## What Changes

- expected_specだけの閉じたYAMLを読み、既存のREQ-377の構造照合と、基準側から渡す15件数・canonical sha256を照合する。
- 構文・展開・非JSON・固定値不一致を、日本語のproblemsとnullで返す。成功時も採否主体や新しい試験実行を確認済みにしない。
- 元14文書から作る47契約の合成fixtureで、構造だけなら通る変異とYAMLの負例を確かめる。既存試験の本文・期待値・期限、入力とalias予算、品質設定は変えない。
- C2bへ全候補・基準側PIN定数・元6試験・9採否・REQ-378の全5 Scenarioを残す。CLI・公開exports・S1の接続、親・live・S2の完了は含めない。

## Capabilities

### New Capabilities
- trusted-baseline-reader: 初回基準の閉じたYAMLと、基準側の固定値を照合する私的部品。

### Modified Capabilities
なし。

## Impact

L3。packages/kitの私的モジュール、新しいID付き試験、計画と作業記録だけを変更する。実行時依存を追加しない。C001の同じ担当枠でC2aを先行させ、C2bとS1は依存待ちとする。通常DoD・必須CI・3OS・独立レビュー後に同期・archiveする。
