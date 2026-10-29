# spec/verify-v2-c001

1. `verify-v2-c001` のタスク1.1として、proposal・7 capabilityの差分仕様・design・tasks・traceとDraft PR材料を準備した。製品コードは変更していない。
2. OpenSpec strictはexit 0。仕様ゲートは未回答のR-C001-01〜03だけでexit 1となり、解析・台帳・Source・Scenarioは合格した。日本語資料はyomiyasuで候補と資料を照合した。
3. 未回答はbare verifyの適用境界、evaluatedの意味、最小実証跡の先行範囲または並行準備・合同受入への変更。#60/REQ-307は当時未受入の依存と記録したが、その後PR #140・#141で受入済みで、現在の停止理由には数えない。
4. 次は管理役がDraft PRと#121へ質問を集約する。このターンは計画で止める。回答を反映し依存受入と仕様ゲート成功を確認したら、既存delivery指示に基づきapplyへ進む。

## 全Aの場合の未承認候補の整合

1. `verify-v2-c001`・[PR139](https://github.com/loomake/loomake/pull/139)の計画資料を整合し、詳細をdesign-candidate-a.mdへ分離した。#60の当時の履歴と現在の受入済み事実、kitのyaml未追加を訂正した。7 capabilityの差分仕様・質問行・製品・既存試験・設定は保持し、1.1だけ完了のままにした。
2. OpenSpec strictはexit 0。spec-onlyは未回答R-C001-01〜03だけでexit 1、解析・台帳・Source・Scenario等は成功した。yomiyasu run/verifyと差分範囲・7差分仕様/質問行の保持を確認した。全体試験・コード実装・完了ゲートは実行していない。
3. R-C001-01〜03は未回答。Opusの設計著述3回のactual session ID・exit 0・denials 0は[trace](../../../openspec/changes/verify-v2-c001/trace.md#全a候補と著述の出典)に記録した。追加AI評価0、過去PR139ローカル回数不明、上限リセットなし。独立レビュー・人の採否は未実施で、S1や設定操作の承認を代行していない。
4. 管理役へ計画headと検査結果を渡す。人の回答・具体案の採否と必要な保護差分の承認を記録し、差分仕様の反映と仕様ゲートexit 0を確認するまで実装しない。push・PR更新は管理役が行う。
