# 親#69の全未完了義務

PR1の要約拡張と参照検証APIだけで親#69は完成しない。以下は範囲削除やW5への黙示延期ではなく、同じW1で残る未実装の義務である。

| 義務 | 予定先 | 現在の事実 | 完成として確かめること |
|---|---|---|---|
| 既存Evidence1/2と未知欄の閲覧・不変 | PR1 REQ460 | 計画のみ | 固定版1/2JSON・12Schema・同期API・元assert保持。Q69-23の動的入力生成2件だけ追従 |
| 実行条件・CI識別・未確認・本体の観測照合 | PR1 REQ461/462 | 計画のみ | 実行回数/旧結果/失敗保存を保ち、未確認nullと不一致拒否 |
| 本体bytes/hash・実保持期間/現在状態のAPI | PR1 REQ463 | 計画のみ | 既知/不足/未確認/失効、raw bytesとstrict decodeの区別 |
| quality.yamlのevidence既定値 | PR1 REQ396 | 計画のみ | 旧雛形保護・品質未設定のまま既定値を明記 |
| 共有本体へ辿る参照と索引 | 別通常PR REQ470〜472・Q04/16 | 未実装 | 固定summary→hash-key索引→実取得し一致した本体、または生成時の検証済locatorを実在で示す |
| 参照の取得状態・実期限・権限確認 | 別通常PR REQ471/472・Q05/17/18 | 未実装 | metadataの存在と実downloadを分け、ZIPdigestとbodyhashを混同しない |
| リリース記録の版1・新recordだけのrelease予約 | 通常PR2 REQ464 | 予約のみ | 固定summaryのhash/CI/対象SHAとの対応、旧release閲覧維持。生成/承認/公開はW5のまま |
| 失敗試行attempts.jsonl | 通常PR2 REQ465 | 予約のみ | execution/ciの重複排除、失敗分類・summary参照、破損末尾拒否、成功で履歴を隠さない |
| 固定されたsummary/リリース参照の不変 | PR2と索引接続 | 未実装 | 後のlocatorを小さな索引へ追加する場合も元summaryを変更しない |
| 旧実行出力と文書参照の整理 | 親Q69-07・通常整理PR | 未実装・未削除 | 個別分類・元commit/blob/hash/bytes索引・実取得一致、固定fixture/信頼入力を保持 |
| 進行中verify-v2-dodの6候補 | 親Q69-07 | 保持 | それぞれ固定入力/作業出力かを確認し、保留を完成へ読み替えない |
| 旧記録の大ファイル削除レビュー | 親Q69-07 | 省略形式の例外未承認 | 200KiB上限を--irreversible-deleteで回避せず規則どおり確認 |
| 3層の保管・取得・手動長期保存の利用者案内 | PR1/PR2/参照接続 | 未作成 | 本体をGitに入れない、保存先・権限・期限の事実、旧形式を読めるまま保つ |
| #71正式schemaとの整合 | PR1/PR2/索引接続 | 受入済みAPIの原文をgit objectで照合したが、正式schemaの接続は未実装 | 最上位sha/ciと外部固定anchorの対応、自己hashに依存しないこと |
| #70評価・history・statusとの接続 | #70担当と親69 | C1のみ受入、C2/C3未実装 | 索引/参照を重複実装せず全要求と履歴の義務を保持 |

Git追跡済み.loomake/evidenceは対象mainでは0件。棚卸し42候補・2,297,325 bytesを見つけただけで、全てが削除可能だとは判定していない。archiveの36候補とactiveの6候補を分け、action-pinsやsource-integrity等の固定/信頼利用を確認する。本文を消していない。

Q69-04は追加の通常W1実装で満たす案を検討する。現在CIにtrace recordの書き手がないことだけで、人の範囲縮小が必要だと結論しない。既存のartifact uploadと既存認証のread、新しい限定API/手動receiptを組み合わせられるかを補足設計へ渡す。

W2の必須gate自動化、W5のリリース生成/承認/公開/長期転送、W1-14のgzip切出しは別段階の義務として維持し、その完成を本PRで主張しない。どのPRも通常DoDを満たし、段階受入の例外は使わない。P1だけ受け入れても親69はopenである。

新たに保存する文字列の秘密形をどう共有方針で扱うかはP1 Q69-15で確認する。#65の未受入APIを利用済みとせず、独自patternを追加しない。

## 補足設計271bの採用と、親を閉じるまでの残作業

- REQ470：indexVersion1の小さなimmutable receipt。_index/body/<bodySHA>/下へ1件1fileで原子的に追加し、同名を上書きしない。summary raw SHA/bytes、body raw SHA/bytes、CI run/attempt、実checkout SHA、stable locator、ZIPdigest、実createdAt/expiresAt、実取得時刻、policyVerified:false/gapを分ける。signed URL/token/actor login・本体本文は保存しない。
- REQ471：固定summary/receipt/bodyの結付けとresolver。不正・矛盾する候補を無視して成功へ戻らず、期限とaccess未確認を別状態として返す。resolvedは記録の一致だけで、現在の取得・真正性・品質合格を意味しない。外部anchorの責務をreceiptの自己hashへ移さない。#70はこのresolverを利用する側としhistory/statusを重複実装しない。
- REQ472：明示起動だけの限定手動workflow、bundle/fetch、実運用の受入。既存のSHA固定Action・contents:read・persist-credentials:falseを維持し、CIからGitへ書かない。同じCIでrecordを1回だけ行いsummary/bodyをuploadしてから実download/ZIPdigest/本体hashを照合する。保持の要求は90dで、既存ci.ymlの7dやroot方針を緩めず、実期限が短ければ不足と記録する。
- 運用受入は自己PRのchangeを対象にし、埋込verifyのFAIL等を品質合格へ読み替えない。summary原bytesとreceiptを一緒に追加する受入commitは2filesとなり、runnerの既存1summaryだけ再利用を緩めず通常再検証へ進む。P1のrecord自身は1summaryのまま。最終の各PRのCI/DoDは別に満たす。
- 長期保存先への自動転送・公開・リリース生成はW5だが、7.9の手動の長期保存手順と、採用した本体の取得・権限・SHA照合・保存先/期間/確認日時を残す義務を削らない。実リリースにまだ採用していない開発本体を、長期保存済みとは扱わない。
- attempts（REQ465）、release形式（REQ464）、全本体参照、90dの実観測、実運用、既存raw記録整理と親Q07はすべて未完了である。4つの大ファイルの本文省略レビューは未承認のまま。Q18は新しい承認待ちではないが、workflow本体・dispatchは未実施である。
- REQ470〜472はorigin/main b2b3f824のSourceに衝突なし（実git grep exit1/no match）を確認して採番した。REQ466〜469は#68用で本件に使わない。

Q69-14Aのraw入力とQ69-15B/Q21のコマンド参照はP1の決定済み仕様へ反映した。既存verify detailsのsecret保護は#65 P3残債として保持し、新規欄だけの変更で全privacy保証を宣言しない。
