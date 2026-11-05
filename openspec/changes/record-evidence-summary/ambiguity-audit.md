# 曖昧さの確認

req-to-openspecの全観点を、REQ460〜463と変更するREQ396のすべてへ当てた。Q14/15/21は補足設計と管理判断で回答し、親Q07は未回答のまま保持した。

| 対象 | 言葉・主語・例外 | 入力/出力・件数・ファイル | エラー・権限・状態・同時操作 | 既存データ・外部連携 | 非機能・文書整合 |
|---|---|---|---|---|---|
| REQ460 | 目印と旧形式、writer/readerの主体を限定 | 版・必須nullable・unknown・own proto、12Schema不変 | 同期拒否、古い成功へ戻らない、公開境界維持 | 旧Evidence1/2の未変更と別schema。外部呼出しなし | 遅延Zod、依存不変、入力/64MiB上限、Q02 |
| REQ461 | 実行元/CI識別/真正性を分ける | 正safe整数の正規十進文字列、canonical gap、UUID・実時刻、Q11 | CI欠損はnull、既存onVerify/期限、権限は追加しない | 元対象SHAと事実の出典、request/observationは未実装 | commandsはraw本文/任意名を保存しないQ15B/Q21、推定なし、Q01/08 |
| REQ462 | sameRun verifiedの意味と全件完了を区別 | raw hash/bytesはQ14Aとstrict decodeの表現区別、6件数/空配列/部分null | 不一致は拒否、失敗保存/安全性UsageError維持 | 未アップロード明示、共有参照Q04は親未実装 | 予算/上書き禁止/1summary再利用、Q03/09/13 |
| REQ463 | 当時保持と現在失効を区別 | raw Uint8Array入力Q14A、UTC年clamp、境界ちょうど、d/w/y | 不正/不明はunverified、availableは権限証明でない | 外部取得しない純粋関数、過去判断不変 | Q05/12、NFR09と実7d/方針90dを区別 |
| REQ396 | 品質未設定の雛形と既存配置主体を保持 | 既存5Scenario/旧本文とevidence既定値 | 旧保護/TTY/拒否/リンク時のコードと副作用維持 | root quality.yaml不変、外部接続なし | REQ285のenum/既定値不変、数値を緩めない |

お金・個人情報・権限・削除・外部連携・受入数値は仮定にしていない。既存認証を利用する実取得調査はproduct APIの承認や閲覧権限の証明と分ける。親の削除/索引/CI書き手はparent-handoffと補足設計に残し、本P1の未確認を完成へ読み替えない。
