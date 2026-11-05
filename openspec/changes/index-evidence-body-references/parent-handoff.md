# 親 #69 の未完了義務

このchangeはP1計画5b809c3fと補足Opus271bの通常PR-Refであり、receiptとresolverだけを所有する。部分段階受入の例外を使わず、親#69の完成範囲を縮めない。進捗の正本はIssue #69であり、この文書は後続へ渡す義務を示す。

| 義務 | 所有と確認点 |
|---|---|
| 判定要約の版・同期意味検証・旧形式閲覧 | P1 REQ460。Evidence1/2・未知storage・own key・documents省略・元の12Schema/固定fixture/全assertを保持する |
| 実行条件・CI識別・未確認・同じ実行の観測 | P1 REQ461/462。verify回数/旧結果/失敗保存を保ち、不一致拒否とnull/gapsを保持する。nameRefsは未観測を推測しない |
| raw本体の照合・保持期間/現在状態 | P1 REQ463。本体hashとZIPdigestを分け、raw bytesとstrict decodeを混同しない |
| evidence既定値の雛形 | P1 REQ396。既存配置・保護・品質目標未設定を保つ。root qualityと既存CI7dを緩めない |
| 共通秘密置換 | #65 P1 REQ447を実装前に受け入れる。新receiptが変わる場合は拒否し、hash/pathを置換保存しない。独自patternを作らない |
| 本体参照の版と索引 | 本change REQ470。小さなimmutable1receipt1file、原子的追加、固定summary原bytes不変 |
| 結付けとresolver | 本change REQ471。壊れた候補・矛盾を成功へ戻さず、resolvedの意味を索引一致に限る。#70はresolverを使う側として重複実装しない |
| 限定手動CI・bundle/fetch | 別通常PR REQ472。同じcheckoutでrecord1回→summary/body upload→実download/ZIPdigest/bodyhashを確認。contents:read、persist-credentials:false、SHA固定Action。CIからGitへ書かず、新認証・公開・write権限を加えない |
| 実際の保存期限と閲覧状態 | REQ472/親69。90d要求と実expiresAtを分け、短ければ不足。実actor取得と全member権限を同一にせずpolicyVerified:false/gapを保持する |
| 実運用の受入 | REQ472の別受入PR。同じCIのsummary原bytesとreceiptを同じ2-file commitへ追加し、run/attempt/checkout/workflow head/実期限/実取得を記録。埋込verifyがFAILでも品質合格と呼ばない。各PRの最終DoDは別に満たす |
| release形式・新recordだけのrelease予約 | 別通常PR REQ464。最上位sha/ciと固定summary hash、#71外部anchorとの対応、旧release閲覧を保持。生成・承認・公開はW5 |
| 失敗試行attempts | 別通常PR REQ465。execution/ci重複排除、失敗分類・summary参照、破損末尾拒否、再試行の真の履歴を保つ |
| 固定要約とリリース参照の不変 | 別locator追加で元summaryやrelease参照を書き換えない。receiptの自己hashを外部anchorに置き換えない |
| 旧raw記録と文書参照の整理 | 親Q69-07と通常整理PR。個別分類・元commit/blob/raw SHA/bytesの索引・実取得照合・固定fixture/信頼入力保持。未削除を完成と報告しない |
| 進行中verify-v2-dodの6候補 | 親Q69-07。固定入力/作業出力を分け、source-integrity等を無断で削除しない |
| 大きな削除差分 | 親Q69-07。単一200KiB超を--irreversible-deleteやバイナリ化でレビュー上限から外す承認はない。本文省略で規則を迂回しない |
| 三層・保管・取得・長期手動手順の案内 | P1/本change/REQ472/PR2。7.9の保存先・権限・保持期間・SHA照合・確認時刻を残す。未採用の開発本体を長期保存済みと呼ばない |
| #70のeval/history/status | #70担当。参照解決は本APIへ接続し、全要求追跡・重複排除・別期間を保持する。Refだけで#70も閉じない |

初期棚卸しは42候補・2,297,325 bytes（archive36/active6）であり、削除可能と判定した一覧ではない。Git追跡済み.loomake/evidenceが0件だった事実を、新規要約・索引・実本体参照の受入済みとは扱わない。

既存artifact13409552230のread例は、ZIP 67,929 bytesがGitHub digestと一致し、本体556,857 bytesを中立parserで読めたという事実だけである。checkoutとworkflow headは異なり、実保持は約7d、producerと方針上の全閲覧者は未確認、対応する固定summaryはない。新mainの合格・新規運用・親69完成へ流用しない。実ZIP・本体・認証値・署名URL・actor情報をこのchangeへcommitしない。

W2の必須gate自動化、W5のリリース生成/承認/公開/自動長期転送、W1-14のgzip切出しは別段階として残す。7.9の手動保存・所定閲覧者での取得・hash照合・保存先/期間/確認日時の記録は省略しない。根拠はP1のparent-handoff全文と採用済み補足設計であり、Ref単体で親を閉じない。

受入済みP1に関するIssue #454のM1（出典別hash）とM2（release境界）は別の後続で未修理のまま保持する。本体参照索引の実装を、その修理や親#69の完了へ読み替えない。#65 P3のprivacy対応も未完了であり、既存記録全体を保護したとの保証を追加しない。
