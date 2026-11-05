# Trace: record-evidence-summary

## 入力文書

| 文書 | 版 | 日付 |
|---|---|---|
| docs/requirements/loomake-v0.11.md 7.1/7.9、FR44〜47 | main71c9019a・v0.11.2 | 2026-11-05 |
| Issue #69とcomment6654873804 | 最新取得本文 | 2026-11-05 |
| 実Opus設計84f0136e-9521-4c01-ad3a-e94be632621d | main71c9019a・claude-opus-5-5・exit0 | 2026-11-05 |
| 実Opus補足設計271b9d31-e5b0-4cc3-a015-00b6d1f5eb76 | head4c5e6cf5・claude-opus-5-5・exit0 | 2026-11-05 |
| 管理役の推奨採用とPR分割の決定 | 本会話・ADR0006 | 2026-11-05 |

## 要件台帳

| ID | 出典 | 種別 | 要約（原文に忠実に） | 状態 | 反映先 |
|---|---|---|---|---|---|
| REQ-460 | 要件7.9 L565〜580・Issue69・実Opus設計4章PR1 | 機能 | 既存Evidenceと12Schemaを保つ要約拡張版1を追加し同期で検証する | 反映済 | specs/evidence-summary/spec.md |
| REQ-461 | 要件7.9 L565〜580・FR45・実Opus設計2章 | 機能 | 実行条件を事実から記録し、既知nullable欄の未確認理由を保持する | 反映済 | specs/evidence-summary/spec.md |
| REQ-462 | 要件7.9 L559〜580・実Opus設計3章・管理Q13 | 機能 | 同じ実行の観測照合と本体参照を持ち、既知不一致は拒否し未確認を合格にしない | 反映済 | specs/evidence-summary/spec.md |
| REQ-463 | 要件7.1 evidence・7.9 L595〜598・管理Q12 | 機能 | 本文照合と実保持期間・現在の失効を純粋関数で分けて判定する | 反映済 | specs/artifact-reference/spec.md |
| REQ-396 | 現init主仕様・要件7.1 evidence・O16 | 既存変更 | 既存雛形の配置・保護を保持して証跡保管方針の既定値を明記する | 反映済 | specs/init/spec.md |
| REQ-464 | 実Opus設計4章PR2・要件7.9 | 範囲外 | リリース記録版1とnew recordだけのrelease予約（同じW1の通常PR2） | 範囲外 | parent-handoff.md |
| REQ-465 | 実Opus設計4章PR2・FR47 | 範囲外 | attempts.jsonlの失敗試行追記と重複防止（同じW1の通常PR2） | 範囲外 | parent-handoff.md |
| REQ-470 | 補足設計S69-01・Q16 | 範囲外 | immutable本体参照receiptの版・保存（同じW1の別通常PR） | 範囲外 | parent-handoff.md |
| REQ-471 | 補足設計S69-02/06・Q17 | 範囲外 | 固定summaryと本体の結付け・resolver（同じW1の別通常PR） | 範囲外 | parent-handoff.md |
| REQ-472 | 補足設計S69-04・Q18/19 | 範囲外 | 限定手動CI・実運用の本体参照（同じW1の別通常PR） | 範囲外 | parent-handoff.md |

## 確認事項

| ID | 関連 | 質問 | 選択肢 | おすすめ | ブロッキング | 回答 | 回答者 | 回答日 |
|---|---|---|---|---|---|---|---|---|
| Q69-01 | REQ-461 | CI欄を#71とそろえ、実行元と分けるか | A:最上位ci / B:storage.originを正本に#71変更 | A。重複識別を避ける | yes | A。ci:nullとgapを許し環境値を真正性にしない（ADR0006） | 利用者（ADR0006の包括承認、管理役記録） | 2026-11-05 |
| Q69-02 | REQ-460 | 旧Evidenceと12Schemaを保つ拡張をどう公開するか | A:独立版1と目印 / B:Evidenceの新版 | A。旧契約を保つ | yes | A。summaryVersionのある拡張だけ検証し未知storageを保つ（ADR0006） | 利用者（ADR0006の包括承認、管理役記録） | 2026-11-05 |
| Q69-03 | REQ-462 | どの本体を同じ実行の観測として採用するか | A:check hash等の照合 / B:参照と未確認だけ | A。旧verifyを再実行しない | yes | A。不一致拒否、未確認counts:null、既存失敗保存を保つ（ADR0006） | 利用者（ADR0006の包括承認、管理役記録） | 2026-11-05 |
| Q69-04 | REQ-462 | 親69の共有先へ辿れる本体参照をどう実装するか | A:限定手動CIとimmutable索引 / B:未完了として保持 | A。同じ実行の実在参照を示せる | no | A。通常W1の別PRと実運用で実装し、P1だけで親を閉じない（ADR0006） | 利用者（ADR0006の包括承認、管理役記録） | 2026-11-05 |
| Q69-05 | REQ-463 | 実期限と方針の期間をどう区別するか | A:当時と現在を分ける / B:CI期間変更も含める | A。事実と設定を混同しない | yes | A。実7d/方針90dはどちらも変更しない（ADR0006） | 利用者（ADR0006の包括承認、管理役記録） | 2026-11-05 |
| Q69-06 | REQ-464 | releaseの名前予約と形式をどう扱うか | A:new recordだけ / B:共有assertで一律拒否 | A。旧閲覧を保つ | no | AをPR2へ残す。P1では予約・生成しない（ADR0006） | 利用者（ADR0006の包括承認、管理役記録） | 2026-11-05 |
| Q69-07 | REQ-460 | 上限超の旧記録削除のレビュー形式をどうするか | A:例外を人へ確認 / B:未削除で親に残す | 未承認の省略差分を使わない | no | | | |
| Q69-08 | REQ-461 | 7.9の欄を既知・未確認・対象外で表すか | A:全項目の出典を明示 / B:一部を準備PRへ分割 | A。推定値を作らない | yes | A。request/observationの担当は70でP1はnullと理由（ADR0006） | 利用者（ADR0006の包括承認、管理役記録） | 2026-11-05 |
| Q69-09 | REQ-462 | recordと索引の更新をどう分けるか | A:1summary追加維持 / B:runner再利用も変更 | A。既存再利用を保つ | yes | A。親のW1索引義務は未実装で保持しW5へ延期しない（ADR0006） | 利用者（ADR0006の包括承認、管理役記録） | 2026-11-05 |
| Q69-10 | REQ-460 | PRをどう分割するか | A:単独DoDの通常PR / B:全件1PR | A。上限と担当境界を保つ | yes | A。PR1/PR2/整理を分け親を閉じない（ADR0006） | 利用者（ADR0006の包括承認、管理役記録） | 2026-11-05 |
| Q69-11 | REQ-461・REQ-462 | null/gapsと読めないreport、数値の境界は何か | A:既知欄に1gap・不読は未確認 / B:未取得を例外にする | A。旧失敗保存を保つ | yes | A。artifacts空はgap1件の例外、runAttemptは正safe整数、未知欄と既存UsageError分類を保つ（ADR0006） | 利用者（ADR0006の包括承認、管理役記録） | 2026-11-05 |
| Q69-12 | REQ-463 | 閏日と期限ちょうどをどう扱うか | A:月末clamp・等しければexpired / B:翌月へ繰越す | A。保持期間と現在状態を分ける | yes | A。実createdAt/expiresAtの当時充足と明示nowを分ける（ADR0006） | 利用者（ADR0006の包括承認、管理役記録） | 2026-11-05 |
| Q69-13 | REQ-462 | sameRun verifiedで何を証明するか | A:観測照合のみ / B:全件完了の証明も行う | A。hidden bailを証明できない | yes | A。真正性/全件完了/品質合格を意味せず、既知部分はnull、未知未実行を0補完しない（ADR0006） | 利用者（ADR0006の包括承認、管理役記録） | 2026-11-05 |
| Q69-14 | REQ-462・REQ-463 | 元bytesと置換decode後textのどちらで照合するか | A:raw bytesとstrict decodeを分ける / B:textを前提にする | A。元の本体を取り違えない | yes | A。raw Uint8Array/Buffer、新readInputBytes、InputReader型不変、比較可能なhashだけ照合する（ADR0006） | 利用者（ADR0006の包括承認、管理役記録） | 2026-11-05 |
| Q69-15 | REQ-461 | 新たに保存するcommands等の秘密形をどう扱うか | A:共有mask / B:raw本文を保存せず設定hash/名参照 | B。独自patternと未受入API依存を避ける | yes | B。raw commandsは保存せずconfig raw hash/source/nameRefsを保存し、既存detailsのprivacyは65P3残債に保つ（ADR0006） | 利用者（ADR0006の包括承認、管理役記録） | 2026-11-05 |
| Q69-16 | REQ-470 | 索引receiptをどう保存するか | A:1receipt1file / B:追記JSONL | A。原子的公開と不変を保つ | no | A。_index/body以下のimmutableファイルとして別通常PRに残す（ADR0006） | 利用者（ADR0006の包括承認、管理役記録） | 2026-11-05 |
| Q69-17 | REQ-471 | 閲覧権限をどこまで実証するか | A:実測actorとpolicy未確認を分ける / B:全memberを調べる | A。権限と個人情報を増やさない | no | A。policyVerified:falseとgap、全member閲覧を証明しない。取得事実と方針充足を分ける（ADR0006） | 利用者（ADR0006の包括承認、管理役記録） | 2026-11-05 |
| Q69-18 | REQ-472 | 限定手動CIのdispatchと90dをどう扱うか | A:delivery範囲で通常実装検証 / B:起動しない | A。実在参照を実証する | no | A。利用者deliveryのCI検証権限に含み新承認不要。write権限/公開/認証新設はせず実expiresAtを別記する（管理判断） | 管理役 | 2026-11-05 |
| Q69-19 | REQ-472 | 運用でどのchangeを記録するか | A:受入PR自身 / B:既存active | A。対象SHAの存在を明確にする | no | A。自己運用changeを使い、埋込FAIL等を品質合格へ読み替えず、最終DoDは別に満たす（ADR0006） | 利用者（ADR0006の包括承認、管理役記録） | 2026-11-05 |
| Q69-20 | REQ-470・REQ-471・REQ-472 | 補足設計の追加REQを採番できるか | A:470〜472を予約 / B:他番号を調べる | A。466〜469は68予約と重なる | no | A。main b2b3f824のSource衝突なしを実検査し470〜472を別通常PRへ採番。P1には新定義を足さない（管理判断） | 管理役 | 2026-11-05 |
| Q69-21 | REQ-461 | config省略と任意command名をどう保存するか | A:省略null/gap・全名hashと任意known enum / B:raw custom名を保存 | A。元定義を追い秘密形を新保存しない | yes | A。config省略はdefaults/null、確認済名はUTF8 hashと任意knownName。現P1は専用観測なしでnameRefs:null/gap、設定順やchecksから推測しない（管理判断） | 管理役 | 2026-11-05 |

| Q69-22 | REQ-462 | OS不読と入力拒否を公開APIでどう識別するか | A:既存InputReadFailureをnamed export / B:constructor名等を推測 | A。instanceofで旧分類を保つ | yes | A。既存class/分類は不変、OS不読だけgap、入力拒否はthrow。管理役がADR0006に従い採用 | 管理役 | 2026-11-05 |

Q69-04/Q69-07は本PRの実装で解消したとはしない。親69の未完了としてparent-handoffに全義務を保つ。取得済み補足設計を採用したが、索引・手動CI・実運用は未実装である。Q69-14/15/21は補足設計と管理判断で回答済み。rawとhash表現・新文字列の保存をここで確定し、親のQ69-07は未回答のまま保持する。

## 仮定

| ID | 関連 | 仮定の内容 | 理由 | 承認 | 承認者 | 承認日 |
|---|---|---|---|---|---|---|

仮定として権限・外部連携・期限・削除を埋めない。採用した決定は上の確認事項へ記録した。日本時間の決定日は2026-11-05で、包括承認の根拠は [ADR0006](../../../docs/adr/0006-standing-approval-for-autonomous-delivery.md)。
